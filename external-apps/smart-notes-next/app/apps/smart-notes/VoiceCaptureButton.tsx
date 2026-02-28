'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/Shell';

type Status = 'idle' | 'recording' | 'uploading';

export default function VoiceCaptureButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{ id?: number; title?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const isRecording = status === 'recording';
  const isUploading = status === 'uploading';

  async function startRecording() {
    setError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm'
        });
        await uploadRecording(blob);
        cleanupStream();
      };

      recorder.start();
      setStatus('recording');
    } catch (e: any) {
      setError(e?.message || 'Unable to access microphone.');
      cleanupStream();
      setStatus('idle');
    }
  }

  function cleanupStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    mediaRecorderRef.current.stop();
  }

  async function uploadRecording(blob: Blob) {
    setStatus('uploading');

    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-note.${ext}`, {
        type: blob.type || 'audio/webm'
      });

      const form = new FormData();
      form.append('audio', file);

      const res = await fetch('/api/smart-notes/voice', {
        method: 'POST',
        body: form
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to process voice note');

      setResult({ id: data.id, title: data.title });

      setTimeout(() => {
        window.location.href = `/apps/smart-notes/${data.id}`;
      }, 1200);
    } catch (e: any) {
      setError(e?.message || 'Failed to upload voice note');
    } finally {
      setStatus('idle');
      chunksRef.current = [];
    }
  }

  return (
    <>
      <Button
        variant={isRecording ? 'danger' : 'secondary'}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isUploading}
        className="flex items-center gap-2"
      >
        {isUploading ? (
          <>
            <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            Transcribing…
          </>
        ) : isRecording ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Stop Recording
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v11m0 0a3 3 0 003-3V6a3 3 0 10-6 0v3a3 3 0 003 3zm0 0v4m-4 0h8" />
            </svg>
            Voice Note
          </>
        )}
      </Button>

      {error ? (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="text-sm font-medium text-red-800">Voice note failed</div>
          <div className="text-xs text-red-700 mt-1">{error}</div>
        </div>
      ) : null}

      {result ? (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="text-sm font-medium text-green-800">✓ Voice note created!</div>
          <div className="text-xs text-green-700 mt-1">Opening: {result.title?.slice(0, 50)}…</div>
        </div>
      ) : null}
    </>
  );
}
