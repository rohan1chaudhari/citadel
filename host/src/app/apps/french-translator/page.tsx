'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Card } from '@/components/Shell';

interface Translation {
  id: string;
  french: string;
  english: string;
  timestamp: string;
}

export default function FrenchTranslatorPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [history, setHistory] = useState<Translation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const promptContextRef = useRef<string>('This is French spoken audio being translated to English.');

  const translateText = async (text: string): Promise<string> => {
    try {
      const res = await fetch('/api/apps/french-translator/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'fr', target: 'en' })
      });
      const data = await res.json();
      return data.translation || 'Translation failed';
    } catch {
      return 'Translation error';
    }
  };

  const transcribeWithWhisper = async (audioBlob: Blob, prompt?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    if (prompt) {
      formData.append('prompt', prompt);
    }

    const res = await fetch('/api/apps/french-translator/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Transcription failed');
    }

    const data = await res.json();
    return data.text || '';
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Transcribe with Whisper (with context prompt)
          const frenchText = await transcribeWithWhisper(audioBlob, promptContextRef.current);
          
          if (frenchText) {
            setTranscript(frenchText);
            
            // Update prompt context for next transcription
            promptContextRef.current += `\n${frenchText}`;
            if (promptContextRef.current.length > 500) {
              promptContextRef.current = promptContextRef.current.slice(-500);
            }
            
            // Translate
            const englishText = await translateText(frenchText);
            setTranslation(englishText);
            
            // Add to history
            setHistory(prev => [{
              id: Date.now().toString(),
              french: frenchText,
              english: englishText,
              timestamp: new Date().toLocaleTimeString()
            }, ...prev]);
          }
        } catch (err: any) {
          setError(err?.message || 'Transcription failed');
        } finally {
          setIsProcessing(false);
        }
      };
      
      mediaRecorder.start(1000); // Collect chunks every second for longer recordings
      setIsRecording(true);
    } catch (err: any) {
      setError('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">French Translator</h1>
        <p className="text-zinc-600 text-sm">Record French audio, get English translation</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Recording Button */}
      <Card>
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            } ${isProcessing ? 'opacity-50' : ''}`}
          >
            {isProcessing ? (
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            ) : isRecording ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </button>
          
          <p className="text-sm text-zinc-600">
            {isProcessing 
              ? 'Transcribing with Whisper...' 
              : isRecording 
                ? 'Recording... Click to stop' 
                : 'Tap to record French'}
          </p>
        </div>
      </Card>

      {/* Current Result */}
      {(transcript || translation) && (
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-700 uppercase">French (Original)</span>
                <button 
                  onClick={() => copyToClipboard(transcript)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Copy
                </button>
              </div>
              <p className="text-zinc-900">{transcript || '...'}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-green-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-700 uppercase">English (Translation)</span>
                <button 
                  onClick={() => copyToClipboard(translation)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Copy
                </button>
              </div>
              <p className="text-zinc-900">{translation || '...'}</p>
            </div>
          </div>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-4">History</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-500">{item.timestamp}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <p className="text-sm text-zinc-700">🇫🇷 {item.french}</p>
                  <p className="text-sm text-zinc-700">🇬🇧 {item.english}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
