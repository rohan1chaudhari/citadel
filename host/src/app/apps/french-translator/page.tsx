'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Card } from '@/components/Shell';

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface TranscriptEntry {
  id: string;
  french: string;
  english: string;
  timestamp: Date;
  isInterim: boolean;
}

export default function FrenchTranslatorPage() {
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [currentFrench, setCurrentFrench] = useState('');
  const [currentEnglish, setCurrentEnglish] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptBufferRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';
    
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (event.error === 'no-speech') {
        // Just restart, no error message needed
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        // Add buffer content + final transcript
        const fullText = transcriptBufferRef.current + ' ' + finalTranscript;
        transcriptBufferRef.current = fullText.trim();
        setCurrentFrench(fullText.trim());
        
        // Trigger translation
        translateText(fullText.trim());
      } else if (interimTranscript) {
        // Show interim results live
        const displayText = transcriptBufferRef.current + ' ' + interimTranscript;
        setCurrentFrench(displayText.trim());
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    };
  }, []);

  const translateText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    // Debounce translation to avoid too many API calls
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    
    translationTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/apps/french-translator/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        if (data.ok && data.translation) {
          setCurrentEnglish(data.translation);
          
          // Add to entries if this is a substantial update
          setEntries(prev => {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry && lastEntry.isInterim) {
              // Update the last interim entry
              return [
                ...prev.slice(0, -1),
                {
                  ...lastEntry,
                  french: text,
                  english: data.translation,
                  isInterim: false
                }
              ];
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Translation error:', err);
      }
    }, 300);
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      // Save the current entry
      if (currentFrench && currentEnglish) {
        setEntries(prev => {
          const lastEntry = prev[prev.length - 1];
          if (lastEntry && lastEntry.french === currentFrench) {
            return prev;
          }
          return [...prev, {
            id: Date.now().toString(),
            french: currentFrench,
            english: currentEnglish,
            timestamp: new Date(),
            isInterim: false
          }];
        });
      }
      transcriptBufferRef.current = '';
      setCurrentFrench('');
      setCurrentEnglish('');
    } else {
      transcriptBufferRef.current = '';
      setCurrentFrench('');
      setCurrentEnglish('');
      recognitionRef.current.start();
    }
  }, [isListening, currentFrench, currentEnglish]);

  const clearHistory = useCallback(() => {
    setEntries([]);
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  if (!supported) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-6">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Browser Not Supported</h2>
            <p className="text-zinc-600">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">🇫🇷 French Translator</h1>
        <p className="text-sm text-zinc-500 mt-1">Speak French, see English translations in real-time</p>
      </div>

      {/* Error message */}
      {error && (
        <Card className="mb-4 p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {/* Main recording interface */}
      <Card className="mb-4 p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Record button */}
          <button
            onClick={toggleListening}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-300 transform
              ${isListening 
                ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-lg shadow-red-200' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200'
              }
            `}
          >
            <span className="text-3xl">{isListening ? '⏹️' : '🎙️'}</span>
            {isListening && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30" />
            )}
          </button>
          
          <p className="text-sm font-medium text-zinc-600">
            {isListening ? 'Listening... Click to stop' : 'Tap to start speaking French'}
          </p>

          {/* Live display */}
          <div className="w-full grid gap-3 mt-4">
            {/* French */}
            <div className="bg-zinc-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">French</span>
                {currentFrench && (
                  <button 
                    onClick={() => copyToClipboard(currentFrench)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Copy
                  </button>
                )}
              </div>
              <p className={`text-lg ${currentFrench ? 'text-zinc-900' : 'text-zinc-400 italic'}`}>
                {currentFrench || 'Parlez en français...'}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <span className="text-zinc-400 text-xl">⬇️</span>
            </div>

            {/* English */}
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">English</span>
                {currentEnglish && (
                  <button 
                    onClick={() => copyToClipboard(currentEnglish)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Copy
                  </button>
                )}
              </div>
              <p className={`text-lg ${currentEnglish ? 'text-zinc-900' : 'text-zinc-400 italic'}`}>
                {currentEnglish || 'Translation will appear here...'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* History */}
      {entries.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">History ({entries.length})</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? 'Hide' : 'Show'}
              </Button>
              <Button variant="secondary" onClick={clearHistory}>
                Clear
              </Button>
            </div>
          </div>
          
          {showHistory && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {entries.slice().reverse().map((entry) => (
                <div 
                  key={entry.id} 
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="text-xs text-zinc-400 mb-1">
                    {entry.timestamp.toLocaleTimeString()}
                  </div>
                  <div className="grid gap-2">
                    <div>
                      <span className="text-xs font-medium text-zinc-500">FR:</span>
                      <p className="text-sm text-zinc-900">{entry.french}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-blue-600">EN:</span>
                      <p className="text-sm text-zinc-900">{entry.english}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tips */}
      <div className="mt-6 text-center text-xs text-zinc-400">
        <p>💡 Speak clearly in French. Common accents and dialects are supported.</p>
        <p className="mt-1">Translations appear within 1-2 seconds for best accuracy.</p>
      </div>
    </div>
  );
}
