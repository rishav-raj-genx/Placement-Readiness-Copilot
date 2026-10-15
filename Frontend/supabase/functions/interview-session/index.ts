import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SessionRequest {
  studentId?: string;
  targetRole: string;
  jobId?: string;
  resumeId?: string;
  topics?: string[];
  difficulty?: string;
  durationMinutes?: number;
  experienceLevel?: string;
  companyType?: string;
  targetCompany?: string;
  customInstructions?: string;
  focusAreas?: string[];
}

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  targetRole: string;
}

interface ResumeInfo {
  parsedText: string;
  keySkills: string[];
  pdfUrl: string;
}

interface JobInfo {
  title: string;
  company: string;
  minimumThresholdScore: number;
}

interface RoomMetadata {
  interviewId: string;
  student: StudentInfo;
  resume: ResumeInfo;
  job: JobInfo | null;
  focusAreas: string[];
  config: SessionRequest;
// Ambient declaration for IDE TypeScript language services
// Supabase Edge Functions run natively on Deno runtime where 'Deno' is globally available.
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // --- JWT verification ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Service-role client for DB writes and storage access
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the JWT and extract the user
    const { data: userData, error: userError } = await serviceClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwtUserId = userData.user.id;
    const jwtEmail = userData.user.email || "";

    // --- Parse request body ---
    const body: SessionRequest = await req.json();

    if (!body.targetRole || body.targetRole.trim() === "") {
      return new Response(
        JSON.stringify({ error: "targetRole is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // JWT sub is the authoritative student ID. Any studentId in request body is advisory only.
    if (body.studentId && body.studentId !== jwtUserId) {
      console.info(`Advisory studentId ${body.studentId} provided; using authoritative JWT sub ${jwtUserId}`);
    }

    // --- Fetch student profile (graceful fallback if profile not yet initialized) ---
    let studentName =
      userData.user.user_metadata?.display_name ||
      userData.user.user_metadata?.full_name ||
      jwtEmail.split("@")[0] ||
      "Student";

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, email, display_name, role, github_username, linkedin_url, resume_pdf_path, linkedin_pdf_path")
      .eq("id", jwtUserId)
      .maybeSingle();

    if (profile?.display_name) {
      studentName = profile.display_name;
    }

    // --- Fetch resume from private storage ---
    let resumeInfo: ResumeInfo = {
      parsedText: body.resumeId ? `Resume reference: ${body.resumeId}` : "",
      keySkills: [],
      pdfUrl: "",
    };

    if (profile?.resume_pdf_path) {
      // Create a short-lived signed URL (valid for 30 minutes) for the worker to download
      const { data: signedUrlData } = await serviceClient
        .storage
        .from("candidate-documents")
        .createSignedUrl(profile.resume_pdf_path, 1800);

      const signedUrl = signedUrlData?.signedUrl || "";

      resumeInfo = {
        parsedText: body.resumeId ? `Resume reference: ${body.resumeId}` : "",
        keySkills: [],
        pdfUrl: signedUrl,
      };
    }

    // --- Fetch job info or provide canonical fallback ---
    let jobInfo: JobInfo = {
      title: body.targetRole,
      company: body.targetCompany || "Target Company",
      minimumThresholdScore: 70,
    };

    if (body.jobId) {
      const { data: job } = await serviceClient
        .from("jobs")
        .select("title, company, minimum_threshold_score")
        .eq("id", body.jobId)
        .maybeSingle();

      if (job) {
        jobInfo = {
          title: job.title || body.targetRole,
          company: job.company || body.targetCompany || "Target Company",
          minimumThresholdScore: job.minimum_threshold_score || 70,
        };
      }
    }

    // --- Generate interview ID and room name ---
    const timestamp = Date.now();
    const interviewId = `intv_${timestamp}`;
    const roomName = `interview_${jwtUserId.slice(0, 8)}_${timestamp}`;

    // --- Build focus areas ---
    const focusAreas = body.focusAreas || body.topics || [];

    // --- Build room metadata ---
    const roomMetadata: RoomMetadata = {
      interviewId,
      student: {
        id: jwtUserId,
        name: studentName,
        email: jwtEmail,
        targetRole: body.targetRole,
      },
      resume: resumeInfo,
      job: jobInfo,
      focusAreas,
      config: body,
    };

    const metadataJson = JSON.stringify(roomMetadata);

    // --- Create the interview session record in the database ---
    const { error: insertError } = await serviceClient
      .from("interview_sessions")
      .insert({
        id: interviewId,
        user_id: jwtUserId,
        student_id: jwtUserId,
        livekit_room_name: roomName,
        target_role: body.targetRole,
        job_id: body.jobId || null,
        resume_id: body.resumeId || null,
        config: body,
        room_metadata: roomMetadata,
        status: "created",
      });

    if (insertError) {
      console.error("Failed to insert interview session:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create interview session record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Create LiveKit room and generate participant token ---
    const livekitUrl = Deno.env.get("LIVEKIT_URL") || "";
    const liveKitApiKey = Deno.env.get("LIVEKIT_API_KEY") || "";
    const liveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") || "";

    if (!livekitUrl || !liveKitApiKey || !liveKitApiSecret) {
      console.error("LiveKit environment variables not configured");
      return new Response(
        JSON.stringify({
          error: "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET as edge function secrets.",
          interviewId,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate LiveKit access token using the server SDK
    const { AccessToken: LiveKitAccessToken, RoomServiceClient } = await import("npm:livekit-server-sdk@2.0.5");

    // Create the room with metadata — fails closed on errors
    const roomService = new RoomServiceClient(livekitUrl, liveKitApiKey, liveKitApiSecret);
    let roomCreated = false;

    try {
      await roomService.createRoom({
        name: roomName,
        metadata: metadataJson,
        emptyTimeout: 600, // 10 minutes empty timeout
        maxParticipants: 2, // student + worker
      });
      roomCreated = true;
    } catch (roomErr: any) {
      console.warn("createRoom threw, verifying if room already exists for this interview:", roomErr);
      try {
        const existingRooms = await roomService.listRooms([roomName]);
        const matchingRoom = existingRooms.find((r: any) => r.name === roomName);
        if (matchingRoom) {
          let existingMetadata: any = {};
          try {
            existingMetadata = JSON.parse(matchingRoom.metadata || "{}");
          } catch (_) {}

          // Fallback only for a verified existing room belonging to the same interview
          if (existingMetadata.interviewId === interviewId || matchingRoom.name === roomName) {
            await roomService.updateRoomMetadata(roomName, metadataJson);
            roomCreated = true;
          } else {
            throw new Error(`Room ${roomName} exists but does not belong to interview ${interviewId}`);
          }
        } else {
          throw roomErr;
        }
      } catch (fallbackErr) {
        console.error("Failed to create or verify existing LiveKit room:", fallbackErr);
        // Fail closed!
        return new Response(
          JSON.stringify({
            error: `LiveKit room creation failed: ${fallbackErr instanceof Error ? fallbackErr.message : "Room creation failed"}`,
            interviewId,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!roomCreated) {
      return new Response(
        JSON.stringify({ error: "Failed to establish LiveKit room", interviewId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the student participant token
    const livekitToken = new LiveKitAccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: `student_${jwtUserId}`,
      name: studentName,
      metadata: JSON.stringify({ interviewId, role: "student" }),
      ttl: 30 * 60, // 30 minutes
    });

    livekitToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await livekitToken.toJwt();

    // Update session status to 'active'
    await serviceClient
      .from("interview_sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", interviewId);

    // --- Return the session response ---
    return new Response(
      JSON.stringify({
        serverUrl: livekitUrl,
        roomName,
        token,
        interviewId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("interview-session error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
