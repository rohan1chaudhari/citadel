/**
 * Login page for optional auth layer
 * 
 * Shows:
 * - First-time setup: create passphrase
 * - Returning user: enter passphrase
 * 
 * Redirects to home or specified redirect URL on success.
*/

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isAuthEnabled, isAuthConfigured, validateSession } from '@citadel/core';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login - Citadel',
};

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If auth is disabled, redirect to home
  if (!isAuthEnabled()) {
    redirect('/');
  }
  
  // Check if already authenticated
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('citadel_session')?.value;
  
  if (sessionToken) {
    const session = validateSession(sessionToken);
    if (session.authenticated) {
      // Already logged in, redirect
      const params = await searchParams;
      redirect(params.redirect || '/');
    }
  }
  
  const needsSetup = !isAuthConfigured();
  const params = await searchParams;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Citadel
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            {needsSetup ? 'Create your admin passphrase' : 'Enter your passphrase'}
          </p>
        </div>
        
        <LoginForm 
          needsSetup={needsSetup} 
          redirectTo={params.redirect || '/'}
        />
        
        {needsSetup && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>First time setup:</strong> Create a passphrase to secure your Citadel instance. 
              You&apos;ll need this to access the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
