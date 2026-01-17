'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await response.json();
      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
            Sign in here
          </Link>
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              icon={<UserIcon className="h-5 w-5 text-gray-400" />}
              autoComplete="given-name"
            />
            <Input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              icon={<UserIcon className="h-5 w-5 text-gray-400" />}
              autoComplete="family-name"
            />
          </div>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<EnvelopeIcon className="h-5 w-5 text-gray-400" />}
            autoComplete="email"
            required
          />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<LockClosedIcon className="h-5 w-5 text-gray-400" />}
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-md bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-blue-600 to-purple-600 py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </div>
      </form>
    </>
  );
}

// Reusable Input Component for consistent styling
function Input({ icon, ...props }: React.ComponentPropsWithoutRef<'input'> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        {icon}
      </div>
      <input
        {...props}
        className="block w-full rounded-md border-0 bg-white/5 py-2.5 pl-10 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm"
      />
    </div>
  );
}