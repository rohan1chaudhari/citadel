'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  needsSetup: boolean;
  redirectTo: string;
}

export default function LoginForm({ needsSetup, redirectTo }: LoginFormProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (needsSetup && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          passphrase,
          setup: needsSetup 
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Success - redirect
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label 
          htmlFor="passphrase" 
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          {needsSetup ? 'Create passphrase' : 'Passphrase'}
        </label>
        <input
          id="passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={needsSetup ? 'Min 8 characters' : 'Enter your passphrase'}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg 
                     bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="current-password"
          autoFocus
        />
      </div>

      {needsSetup && (
        <div>
          <label 
            htmlFor="confirmPassphrase" 
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Confirm passphrase
          </label>
          <input
            id="confirmPassphrase"
            type="password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Re-enter your passphrase"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg 
                       bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                   text-white font-medium rounded-lg transition
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {isLoading 
          ? (needsSetup ? 'Setting up...' : 'Logging in...') 
          : (needsSetup ? 'Create Passphrase' : 'Login')
        }
      </button>
    </form>
  );
}
