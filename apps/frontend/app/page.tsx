'use client';

import { useEffect, useState } from 'react';

type ApiState = 'checking' | 'online' | 'offline';

export default function HomePage() {
  const [apiState, setApiState] = useState<ApiState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi(): Promise<void> {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
        });

        setApiState(response.ok ? 'online' : 'offline');
      } catch {
        if (!controller.signal.aborted) {
          setApiState('offline');
        }
      }
    }

    void checkApi();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main>
      <section className="card">
        <p className="eyebrow">Creator Operations Platform</p>
        <h1>Frontend and backend are separated.</h1>
        <p className="description">
          Next.js owns the user interface. Express owns the API and business
          logic.
        </p>
        <p className={`status status--${apiState}`} aria-live="polite">
          API status: {apiState}
        </p>
      </section>
    </main>
  );
}
