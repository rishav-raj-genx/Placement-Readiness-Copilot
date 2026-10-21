import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Server-side audio transcription fallback endpoint.
 * Supports Groq Whisper (ultra-fast sub-second STT), Deepgram Nova-3, and OpenAI Whisper.
 * Used when browser Web Speech API fails, is blocked, or produces empty results.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'No audio data provided in request' },
        { status: 400 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY?.trim();
    const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
    const openAiKey = process.env.OPENAI_API_KEY?.trim();

    // 1. Try Groq Whisper (ultra-fast, free tier available, extremely accurate)
    if (groqKey) {
      try {
        const groqBody = new FormData();
        groqBody.append('file', audioFile, 'candidate_response.webm');
        groqBody.append('model', 'whisper-large-v3-turbo');
        groqBody.append('temperature', '0');
        groqBody.append('response_format', 'json');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqBody,
        });

        if (groqRes.ok) {
          const data = (await groqRes.json()) as { text?: string };
          if (data.text && data.text.trim()) {
            return NextResponse.json({
              success: true,
              text: data.text.trim(),
              provider: 'groq-whisper',
            });
          }
        } else {
          const errText = await groqRes.text().catch(() => '');
          console.warn('Groq transcription returned non-ok:', groqRes.status, errText);
        }
      } catch (err) {
        console.warn('Groq transcription request failed:', err);
      }
    }

    // 2. Try Deepgram Nova-3
    if (deepgramKey) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const deepgramRes = await fetch(
          'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${deepgramKey}`,
              'Content-Type': audioFile.type || 'audio/webm',
            },
            body: arrayBuffer,
          }
        );

        if (deepgramRes.ok) {
          const dgData = (await deepgramRes.json()) as {
            results?: {
              channels?: Array<{
                alternatives?: Array<{ transcript?: string }>;
              }>;
            };
          };
          const transcript =
            dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
          if (transcript) {
            return NextResponse.json({
              success: true,
              text: transcript,
              provider: 'deepgram',
            });
          }
        }
      } catch (err) {
        console.warn('Deepgram transcription request failed:', err);
      }
    }

    // 3. Try OpenAI Whisper
    if (openAiKey) {
      try {
        const openAiBody = new FormData();
        openAiBody.append('file', audioFile, 'candidate_response.webm');
        openAiBody.append('model', 'whisper-1');

        const openAiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiKey}`,
          },
          body: openAiBody,
        });

        if (openAiRes.ok) {
          const data = (await openAiRes.json()) as { text?: string };
          if (data.text && data.text.trim()) {
            return NextResponse.json({
              success: true,
              text: data.text.trim(),
              provider: 'openai-whisper',
            });
          }
        }
      } catch (err) {
        console.warn('OpenAI transcription request failed:', err);
      }
    }

    // No server keys configured or all providers returned empty
    return NextResponse.json({
      success: false,
      error:
        'No server STT keys (GROQ_API_KEY, DEEPGRAM_API_KEY, OPENAI_API_KEY) configured or audio was silent.',
      fallbackToBrowser: true,
    });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal transcription error',
      },
      { status: 500 }
    );
  }
}
