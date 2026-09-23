'use client';

import type { UserProfile } from '@creatorpilot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiClientError, getProfile } from '../../lib/api';

const profileDateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

export function ProfileView() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const response = await getProfile(controller.signal);
        setProfile(response.profile);
      } catch (caught: unknown) {
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace('/login');
          return;
        }

        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error ? caught.message : 'Unable to load profile',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [router]);

  if (loading) {
    return <main className="profile-shell">Loading your profile...</main>;
  }

  return (
    <main className="profile-shell">
      <section className="profile-card">
        <p className="eyebrow">CreatorPilot</p>
        <h1>Your profile</h1>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {profile ? (
          <dl className="profile-details">
            <div>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>
                <time dateTime={profile.createdAt}>
                  {profileDateFormatter.format(new Date(profile.createdAt))}
                </time>
              </dd>
            </div>
          </dl>
        ) : null}

        <Link className="secondary-link" href="/dashboard">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
