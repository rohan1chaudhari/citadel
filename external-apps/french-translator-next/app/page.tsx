'use client';

import { useState, useRef } from 'react';

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
      const res = await fetch('/api/translate', {
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
    if (prompt) formData.append('prompt', prompt);

    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const frenchText = await transcribeWithWhisper(audioBlob, promptContextRef.current);
          if (frenchText) {
            setTranscript(frenchText);
            promptContextRef.current += `\n${frenchText}`;
            if (promptContextRef.current.length > 500) promptContextRef.current = promptContextRef.current.slice(-500);
            const englishText = await translateText(frenchText);
            setTranslation(englishText);
            setHistory(prev => [{ id: Date.now().toString(), french: frenchText, english: englishText, timestamp: new Date().toLocaleTimeString() }, ...prev]);
          }
        } catch (err: any) {
          setError(err?.message || 'Transcription failed');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch {
      setError('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  return (
    <div className="container" style={{display:'grid', gap:16}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{marginBottom:4}}>French Translator</h1>
        <p style={{color:'#71717a', margin:0}}>Record French audio, get English translation</p>
      </div>

      {error && <div className="card" style={{borderColor:'#fecaca', color:'#b91c1c'}}>{error}</div>}

      <div className="card" style={{display:'grid', placeItems:'center', gap:12}}>
        <button onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing} className={`btn ${isRecording ? 'btn-danger':'btn-primary'}`}>
          {isProcessing ? 'Processing...' : isRecording ? 'Stop' : 'Record'}
        </button>
        <p style={{margin:0, color:'#71717a'}}>{isProcessing ? 'Transcribing...' : isRecording ? 'Recording...' : 'Tap to record French'}</p>
      </div>

      {(transcript || translation) && (
        <div className="card" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div><div style={{fontSize:12,color:'#2563eb'}}>French</div><p>{transcript || '...'}</p></div>
          <div><div style={{fontSize:12,color:'#16a34a'}}>English</div><p>{translation || '...'}</p></div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2 style={{fontSize:14}}>History</h2>
          <div style={{display:'grid', gap:8}}>
            {history.map((item) => (
              <div key={item.id} style={{border:'1px solid #e4e4e7', borderRadius:8, padding:10}}>
                <div style={{fontSize:12,color:'#71717a'}}>{item.timestamp}</div>
                <div>🇫🇷 {item.french}</div>
                <div>🇬🇧 {item.english}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
