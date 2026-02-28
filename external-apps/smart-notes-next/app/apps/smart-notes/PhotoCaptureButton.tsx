'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/Shell';

export default function PhotoCaptureButton() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{id?: number; title?: string; preview?: string} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append('image', file);

      const res = await fetch('/api/smart-notes/photo', {
        method: 'POST',
        body: form
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to process image');
      }

      setResult({
        id: data.id,
        title: data.title,
        preview: data.preview
      });

      // Navigate to the new note after a moment
      setTimeout(() => {
        window.location.href = `/apps/smart-notes/${data.id}`;
      }, 1500);
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Failed to process image'));
    } finally {
      setUploading(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onClick() {
    inputRef.current?.click();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*;capture=camera"
        onChange={onChange}
        className="hidden"
        capture="environment"
      />
      <Button 
        variant="secondary" 
        onClick={onClick}
        disabled={uploading}
        className="flex items-center gap-2"
      >
        {uploading ? (
          <>
            <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Photo Note
          </>
        )}
      </Button>

      {result && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="text-sm font-medium text-green-800">✓ Note created!</div>
          <div className="text-xs text-green-700 mt-1">Opening: {result.title?.slice(0, 50)}…</div>
        </div>
      )}
    </>
  );
}
