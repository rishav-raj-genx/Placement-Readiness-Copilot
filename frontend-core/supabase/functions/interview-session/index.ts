import { createClient } from "npm:@supabase/supabase-js@2.58.0";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:3000";
  const allowedList = allowed.split(",").map((s) => s.trim());
  const matchedOrigin = allowedList.includes(origin) || allowedList.includes("*") ? origin : (allowedList[0] || "*");
  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

type Difficulty = "easy" | "medium" | "hard" | "adaptive";
type ExperienceLevel = "internship" | "entry_level" | "one_to_three" | "three_plus";
type CompanyType = "product_based" | "startup" | "service_based" | "other";
type InterviewMode = "voice" | "text";
type InterviewProvider = "cloud_api" | "ollama_local";

interface SessionRequest {
  studentId?: string;
  targetRole: string;
  jobId?: string;
  resumeId?: string;
  topics: string[];
  difficulty: Difficulty;
  durationMinutes: 15 | 20;
  experienceLevel: ExperienceLevel;
  companyType: CompanyType;
  targetCompany?: string;
  customInstructions?: string;
  focusAreas: string[];
  mode: InterviewMode;
  provider: InterviewProvider;
}

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  targetRole: string;
  skills: string[];
  githubUsername: string;
}

interface StructuredProject {
  title?: string;
  description?: string;
  tech_stack?: string[];
  live_url?: string;
  github_url?: string;
}

interface ResumeInfo {
  parsedText: string;
  keySkills: string[];
  pdfUrl: string;
  isVerified?: boolean;
  structuredProjects?: StructuredProject[];
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
  durationMinutes?: number;
  target_duration_minutes?: number;
  mode?: string;
  provider?: string;
}

function hasWrappingQuotes(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function stringList(value: unknown, maxItems = 8, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function parseSessionRequest(value: unknown): SessionRequest | null {
  if (!isRecord(value)) return null;
  const targetRole = optionalText(value.targetRole, 120);
  if (!targetRole) return null;

  const focusAreas = stringList(value.focusAreas ?? value.topics);
  const durationMinutes = value.durationMinutes === 20 ? 20 : 15;

  return {
    studentId: optionalText(value.studentId, 64),
    targetRole,
    jobId: optionalText(value.jobId, 200),
    resumeId: optionalText(value.resumeId, 200),
    topics: focusAreas,
    focusAreas,
    difficulty: enumValue(value.difficulty, ["easy", "medium", "hard", "adaptive"] as const, "medium"),
    durationMinutes,
    experienceLevel: enumValue(
      value.experienceLevel,
      ["internship", "entry_level", "one_to_three", "three_plus"] as const,
      "entry_level",
    ),
    companyType: enumValue(
      value.companyType,
      ["product_based", "startup", "service_based", "other"] as const,
      "other",
    ),
    targetCompany: optionalText(value.targetCompany, 120),
    customInstructions: optionalText(value.customInstructions, 500),
    mode: enumValue(value.mode, ["voice", "text"] as const, "voice"),
    provider: enumValue(value.provider, ["cloud_api", "ollama_local"] as const, "cloud_api"),
  };
}

// Ambient declaration for IDE TypeScript language services
// Supabase Edge Functions run natively on Deno runtime where 'Deno' is globally available.
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};


Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
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
    const requestPayload: unknown = await req.json().catch(() => null);
    const body = parseSessionRequest(requestPayload);

    if (!body) {
      return new Response(
        JSON.stringify({ error: "A valid targetRole and interview configuration are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validatedDuration = body.durationMinutes;

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

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, email, display_name, role, target_role, skills, github_username, resume_pdf_path, linkedin_pdf_path, interview_credits, is_premium, projects")
      .eq("id", jwtUserId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Failed to load candidate profile:", profileError);
      return new Response(
        JSON.stringify({ error: "A candidate profile is required before starting an interview" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile?.display_name) {
      studentName = profile.display_name;
    }

    // --- Freemium Gatekeeper Check ---
    const isPremium = profile.is_premium === true;
    const interviewCredits = typeof profile.interview_credits === "number"
      ? profile.interview_credits
      : 0;

    if (!isPremium && interviewCredits <= 0) {
      return new Response(
        JSON.stringify({ error: "Premium required. Out of credits." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch candidate projects from profile to provide grounded structured context ---
    const profileProjects: unknown[] = profile && Array.isArray(profile.projects) ? profile.projects : [];
    const candidateProjects: StructuredProject[] = profileProjects
      .filter((proj): proj is Record<string, unknown> => typeof proj === "object" && proj !== null && !Array.isArray(proj))
      .map((proj) => ({
        title: typeof proj.name === "string" ? proj.name : typeof proj.title === "string" ? proj.title : undefined,
        description: typeof proj.description === "string" ? proj.description : undefined,
        tech_stack: Array.isArray(proj.tech_stack)
          ? (proj.tech_stack as string[])
          : Array.isArray(proj.skills)
          ? (proj.skills as string[])
          : undefined,
        live_url: typeof proj.liveUrl === "string" ? proj.liveUrl : typeof proj.live_url === "string" ? proj.live_url : undefined,
        github_url: typeof proj.repositoryUrl === "string" ? proj.repositoryUrl : typeof proj.github_url === "string" ? proj.github_url : undefined,
      }))
      .slice(0, 5);

    // --- Fetch resume from private storage ---
    let resumeInfo: ResumeInfo = {
      parsedText: body.resumeId ? `Resume reference: ${body.resumeId}` : "",
      keySkills: profile?.skills || [],
      pdfUrl: "",
      isVerified: false,
      structuredProjects: candidateProjects || [],
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
        keySkills: profile?.skills || [],
        pdfUrl: signedUrl,
        isVerified: false,
        structuredProjects: candidateProjects || [],
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
        .from("discovered_jobs")
        .select("title, company")
        .eq("id", body.jobId)
        .maybeSingle();

      if (job) {
        jobInfo = {
          title: job.title || body.targetRole,
          company: job.company || body.targetCompany || "Target Company",
          minimumThresholdScore: 70,
        };
      }
    }

    // --- Validate LiveKit configuration first before doing any database mutations ---
    const rawLivekitUrl = Deno.env.get("LIVEKIT_URL");
    const rawLiveKitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const rawLiveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!rawLivekitUrl?.trim() || !rawLiveKitApiKey?.trim() || !rawLiveKitApiSecret?.trim()) {
      console.error("LiveKit environment variables not configured");
      return new Response(
        JSON.stringify({
          error: "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET as edge function secrets.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const livekitUrl = rawLivekitUrl.trim();
    const liveKitApiKey = rawLiveKitApiKey.trim();
    const liveKitApiSecret = rawLiveKitApiSecret.trim();

    if (hasWrappingQuotes(liveKitApiKey) || hasWrappingQuotes(liveKitApiSecret)) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: LiveKit credentials must not include wrapping quotes." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const protocol = new URL(livekitUrl).protocol;
      if (protocol !== "wss:" && protocol !== "ws:") throw new Error("Invalid protocol");
    } catch {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: LIVEKIT_URL must use ws:// or wss://." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Generate UUID-based interview ID and room name to prevent collisions ---
    const sessionUuid = crypto.randomUUID();
    const interviewId = `intv_${sessionUuid}`;
    const roomName = `interview_${jwtUserId}_${sessionUuid.slice(0, 8)}`;

    // --- Build focus areas ---
    const focusAreas = body.focusAreas;
    const resolvedDuration = body.durationMinutes;

    // --- Build room metadata ---
    const roomMetadata: RoomMetadata = {
      interviewId,
      student: {
        id: jwtUserId,
        name: studentName,
        email: jwtEmail,
        targetRole: body.targetRole,
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        githubUsername: profile.github_username || "",
      },
      resume: resumeInfo,
      job: jobInfo,
      focusAreas,
      config: body,
      durationMinutes: resolvedDuration,
      target_duration_minutes: resolvedDuration,
      mode: body.mode,
      provider: body.provider,
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
    // Generate LiveKit access token using the server SDK
    const {
      AccessToken: LiveKitAccessToken,
      AgentDispatchClient,
      RoomServiceClient,
    } = await import("npm:livekit-server-sdk@2.19.1");

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
    } catch (roomErr: unknown) {
      console.warn("createRoom threw, verifying if room already exists for this interview:", roomErr);
      try {
        const existingRooms = await roomService.listRooms([roomName]);
        const matchingRoom = existingRooms.find((room: { name: string; metadata?: string }) => room.name === roomName);
        if (matchingRoom) {
          let existingMetadata: Record<string, unknown> = {};
          try {
            const parsedMetadata: unknown = JSON.parse(matchingRoom.metadata || "{}");
            if (typeof parsedMetadata === "object" && parsedMetadata !== null && !Array.isArray(parsedMetadata)) {
              existingMetadata = parsedMetadata as Record<string, unknown>;
            }
          } catch (metadataError) {
            console.warn("Existing room metadata is not valid JSON:", metadataError);
          }

          // Fallback ONLY for a verified existing room belonging to this exact interview
          if (existingMetadata.interviewId === interviewId) {
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
        await serviceClient
          .from("interview_sessions")
          .update({ status: "error" })
          .eq("id", interviewId);
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
      await serviceClient
        .from("interview_sessions")
        .update({ status: "error" })
        .eq("id", interviewId);
      return new Response(
        JSON.stringify({ error: "Failed to establish LiveKit room", interviewId }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Explicitly dispatch the registered mock-interview worker to this room.
    // Creating a room alone does not assign a room worker.
    try {
      const dispatchClient = new AgentDispatchClient(
        livekitUrl,
        liveKitApiKey,
        liveKitApiSecret,
      );
      await dispatchClient.createDispatch(roomName, "mock-interview", {
        metadata: metadataJson,
      });
    } catch (dispatchError) {
      console.error("Failed to dispatch mock-interview worker:", dispatchError);
      try {
        await roomService.deleteRoom(roomName);
      } catch (delErr) {
        console.warn("Failed to delete room after dispatch failure:", delErr);
      }
      await serviceClient
        .from("interview_sessions")
        .update({ status: "error" })
        .eq("id", interviewId);
      return new Response(
        JSON.stringify({
          error: "LiveKit worker dispatch failed",
          interviewId,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token TTL comfortably exceeds session duration (minimum 45 minutes)
    const tokenTtlSeconds = Math.max((validatedDuration + 15) * 60, 45 * 60);

    // Generate the student participant token
    const livekitToken = new LiveKitAccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: `student_${jwtUserId}`,
      name: studentName,
      metadata: JSON.stringify({ interviewId, role: "student" }),
      ttl: tokenTtlSeconds,
    });

    livekitToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await livekitToken.toJwt();

    let remainingCredits = interviewCredits;
    if (!isPremium) {
      const { data: creditBalance, error: creditError } = await serviceClient.rpc(
        "consume_interview_credit",
        { p_user_id: jwtUserId, p_interview_id: interviewId },
      );

      if (creditError || typeof creditBalance !== "number") {
        console.error("Failed to consume interview credit:", creditError);
        try {
          await roomService.deleteRoom(roomName);
        } catch (deleteError) {
          console.warn("Failed to delete room after credit-consumption failure:", deleteError);
        }
        await serviceClient
          .from("interview_sessions")
          .update({ status: "error" })
          .eq("id", interviewId);

        const exhausted = creditError?.code === "P0001";
        return new Response(
          JSON.stringify({
            error: exhausted
              ? "Premium required. Out of credits."
              : "Unable to reserve an interview credit. Please try again.",
          }),
          {
            status: exhausted ? 403 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      remainingCredits = creditBalance;
    }

    // Mark the authoritative backend session as in progress.
    const { error: activeUpdateErr } = await serviceClient
      .from("interview_sessions")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", interviewId);
    if (activeUpdateErr) {
      console.warn("Warning: Failed to update interview_session status to active:", activeUpdateErr);
    }

    // --- Return the session response ---
    return new Response(
      JSON.stringify({
        serverUrl: livekitUrl,
        roomName,
        token,
        interviewId,
        remainingCredits,
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
