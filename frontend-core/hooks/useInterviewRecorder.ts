'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createInterviewRecordingPath,
  INTERVIEW_RECORDING_BUCKET,
  selectInterviewRecordingMimeType,
} from '@/lib/interview-recording';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export type InterviewRecorderStatus =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'uploading'
  | 'uploaded'
  | 'error';

interface UseInterviewRecorderOptions {
  interviewId: string;
  userId: string | null | undefined;
  onError?: (message: string) => void;
  onUploadComplete?: (audioUrl: string) => void;
}

export interface UseInterviewRecorderReturn {
  status: InterviewRecorderStatus;
  chunks: readonly Blob[];
  audioUrl: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopAndUpload: () => Promise<string | null>;
  setCaptureEnabled: (enabled: boolean) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone permission is required to record this interview.';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'The interview recording could not be saved.';
}

function createRecordingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useInterviewRecorder({
  interviewId,
  userId,
  onError,
  onUploadComplete,
}: UseInterviewRecorderOptions): UseInterviewRecorderReturn {
  const [status, setStatus] = useState<InterviewRecorderStatus>('idle');
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const uploadPromiseRef = useRef<Promise<string | null> | null>(null);
  const uploadedUrlRef = useRef<string | null>(null);
  const captureEnabledRef = useRef(true);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onError, onUploadComplete });

  useEffect(() => {
    callbacksRef.current = { onError, onUploadComplete };
  }, [onError, onUploadComplete]);

  const reportError = useCallback((caught: unknown) => {
    const message = getErrorMessage(caught);
    if (mountedRef.current) {
      setError(message);
      setStatus('error');
    }
    callbacksRef.current.onError?.(message);
  }, []);

  const setCaptureEnabled = useCallback((enabled: boolean) => {
    captureEnabledRef.current = enabled;
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') return;
    if (startPromiseRef.current) return startPromiseRef.current;

    const startPromise = (async () => {
      try {
        if (!userId) throw new Error('You must be signed in to record an interview.');
        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Audio recording is not supported by this browser.');
        }
        if (typeof MediaRecorder === 'undefined') {
          throw new Error('MediaRecorder is not supported by this browser.');
        }

        const mimeType = selectInterviewRecordingMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
        if (!mimeType) {
          throw new Error('This browser cannot create WebM interview recordings.');
        }

        if (mountedRef.current) {
          setStatus('requesting_permission');
          setError(null);
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = captureEnabledRef.current;
        });
        mediaStreamRef.current = stream;
        chunksRef.current = [];
        recordingBlobRef.current = null;
        if (mountedRef.current) setChunks([]);

        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.addEventListener('dataavailable', (event: BlobEvent) => {
          if (event.data.size === 0) return;
          const nextChunks = [...chunksRef.current, event.data];
          chunksRef.current = nextChunks;
          if (mountedRef.current) setChunks(nextChunks);
        });
        recorder.addEventListener('error', (event: Event) => {
          const recorderError = 'error' in event && event.error instanceof Error
            ? event.error
            : new Error('The browser stopped recording unexpectedly.');
          reportError(recorderError);
        });

        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        if (mountedRef.current) setStatus('recording');
      } catch (caught) {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        reportError(caught);
        throw caught;
      }
    })();

    startPromiseRef.current = startPromise;
    try {
      await startPromise;
    } finally {
      startPromiseRef.current = null;
    }
  }, [reportError, userId]);

  const stopRecorder = useCallback(async (): Promise<Blob | null> => {
    if (recordingBlobRef.current) return recordingBlobRef.current;

    await startPromiseRef.current;
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    const blob = await new Promise<Blob>((resolve, reject) => {
      const handleStop = () => {
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType });
        recordingBlobRef.current = recording;
        resolve(recording);
      };
      const handleError = (event: Event) => {
        const recorderError = 'error' in event && event.error instanceof Error
          ? event.error
          : new Error('The browser could not finalize the interview recording.');
        reject(recorderError);
      };

      recorder.addEventListener('stop', handleStop, { once: true });
      recorder.addEventListener('error', handleError, { once: true });
      if (recorder.state === 'inactive') {
        handleStop();
      } else {
        recorder.stop();
      }
    });

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    return blob.size > 0 ? blob : null;
  }, []);

  const stopAndUpload = useCallback(async (): Promise<string | null> => {
    if (uploadedUrlRef.current) return uploadedUrlRef.current;
    if (uploadPromiseRef.current) return uploadPromiseRef.current;

    const uploadPromise = (async () => {
      try {
        if (!userId) throw new Error('You must be signed in to save an interview recording.');
        const recording = await stopRecorder();
        if (!recording) return null;

        if (mountedRef.current) {
          setStatus('uploading');
          setError(null);
        }

        const objectPath = createInterviewRecordingPath(userId, interviewId, createRecordingId());
        const client = getSupabaseBrowserClient();
        const { error: uploadError } = await client.storage
          .from(INTERVIEW_RECORDING_BUCKET)
          .upload(objectPath, recording, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw new Error(`Recording upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = client.storage
          .from(INTERVIEW_RECORDING_BUCKET)
          .getPublicUrl(objectPath);
        const publicUrl = publicUrlData.publicUrl;
        if (!publicUrl) {
          await client.storage.from(INTERVIEW_RECORDING_BUCKET).remove([objectPath]);
          throw new Error('Supabase did not return a recording URL.');
        }

        const { data: updatedSession, error: updateError } = await client
          .from('interview_sessions')
          .update({ audio_url: publicUrl })
          .eq('id', interviewId)
          .eq('user_id', userId)
          .select('id')
          .maybeSingle();

        if (updateError || !updatedSession) {
          await client.storage.from(INTERVIEW_RECORDING_BUCKET).remove([objectPath]);
          throw new Error(updateError?.message ?? 'The interview session was not found.');
        }

        uploadedUrlRef.current = publicUrl;
        chunksRef.current = [];
        recordingBlobRef.current = null;
        if (mountedRef.current) {
          setAudioUrl(publicUrl);
          setChunks([]);
          setStatus('uploaded');
        }
        callbacksRef.current.onUploadComplete?.(publicUrl);
        return publicUrl;
      } catch (caught) {
        reportError(caught);
        throw caught;
      }
    })();

    uploadPromiseRef.current = uploadPromise;
    try {
      return await uploadPromise;
    } finally {
      uploadPromiseRef.current = null;
    }
  }, [interviewId, reportError, stopRecorder, userId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

  return {
    status,
    chunks,
    audioUrl,
    error,
    startRecording,
    stopAndUpload,
    setCaptureEnabled,
  };
}
