'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useState } from 'react';

import { login, register } from '../../lib/api';

export interface AuthFormProperties {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProperties) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const isRegistration = mode === 'register';

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    const data = new FormData(event.currentTarget);
    const email = data.get('email');
    const password = data.get('password');
    const input = {
      email: typeof email === 'string' ? email : '',
      password: typeof password === 'string' ? password : '',
    };

    try {
      if (isRegistration) {
        await register(input);
      } else {
        await login(input);
      }

      router.push('/dashboard');
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          CreatorPilot
        </Link>
        <p className="eyebrow">
          {isRegistration ? 'Get started' : 'Welcome back'}
        </p>
        <h1>{isRegistration ? 'Create your account' : 'Sign in'}</h1>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                isRegistration ? 'new-password' : 'current-password'
              }
              minLength={isRegistration ? 12 : 1}
              maxLength={128}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button disabled={submitting} type="submit">
            {submitting
              ? 'Please wait…'
              : isRegistration
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegistration ? 'Already have an account?' : 'New to CreatorPilot?'}{' '}
          <Link href={isRegistration ? '/login' : '/signup'}>
            {isRegistration ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  );
}
