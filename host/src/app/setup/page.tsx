'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Label, Shell } from '@/components/Shell';

type Step = 'welcome' | 'data-directory' | 'api-keys' | 'done';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step === 'welcome') setStep('data-directory');
    else if (step === 'data-directory') setStep('api-keys');
    else if (step === 'api-keys') handleComplete();
  };

  const handleBack = () => {
    if (step === 'data-directory') setStep('welcome');
    else if (step === 'api-keys') setStep('data-directory');
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openaiApiKey: openaiKey || undefined,
          anthropicApiKey: anthropicKey || undefined,
        }),
      });

      if (res.ok) {
        setStep('done');
        // Redirect to home after a short delay
        setTimeout(() => router.push('/'), 1500);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to complete setup');
      }
    } catch (e) {
      alert('Failed to complete setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipApiKeys = () => {
    handleComplete();
  };

  const dataDir = process.env.NEXT_PUBLIC_CITADEL_DATA_DIR || '../data';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <Shell title="Welcome to Citadel" subtitle="Let's get you set up" hideBrand>
          {/* Progress indicator */}
          <div className="flex gap-2 mb-6">
            {['welcome', 'data-directory', 'api-keys', 'done'].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  ['welcome', 'data-directory', 'api-keys', 'done'].indexOf(step) >= i
                    ? 'bg-blue-500'
                    : 'bg-zinc-200 dark:bg-zinc-800'
                }`}
              />
            ))}
          </div>

          <Card>
            {step === 'welcome' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your local-first app hub</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                    Citadel is a personal platform for running self-hosted apps. Your data stays on your machine.
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p>• Run apps locally with isolated data</p>
                  <p>• Built-in SQLite and file storage</p>
                  <p>• AI integration ready</p>
                </div>
              </div>
            )}

            {step === 'data-directory' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Data Directory</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                    This is where your app data and databases will be stored.
                  </p>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                  <code className="text-xs text-zinc-700 dark:text-zinc-300 break-all">{dataDir}</code>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  You can change this later by setting the CITADEL_DATA_ROOT environment variable.
                </p>
              </div>
            )}

            {step === 'api-keys' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">API Keys (Optional)</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                    Add AI provider keys to enable features like autopilot and smart features in apps.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>OpenAI API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Anthropic API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-ant-..."
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  You can skip this and add keys later in settings.
                </p>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 rounded-2xl mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">You're all set!</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Redirecting you to Citadel...
                </p>
              </div>
            )}
          </Card>

          {/* Navigation buttons */}
          {step !== 'done' && (
            <div className="flex gap-3 mt-4">
              {step !== 'welcome' ? (
                <Button variant="secondary" onClick={handleBack} disabled={isSubmitting} className="flex-1">
                  Back
                </Button>
              ) : (
                <div className="flex-1" />
              )}
              
              {step === 'api-keys' ? (
                <div className="flex gap-2 flex-1">
                  <Button variant="secondary" onClick={handleSkipApiKeys} disabled={isSubmitting} className="flex-1">
                    Skip
                  </Button>
                  <Button onClick={handleNext} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'Saving...' : 'Complete'}
                  </Button>
                </div>
              ) : (
                <Button onClick={handleNext} className="flex-1">
                  Next
                </Button>
              )}
            </div>
          )}
        </Shell>
      </div>
    </div>
  );
}
