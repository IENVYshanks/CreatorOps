'use client';

import type {
  AuthenticatedUser,
  WorkspaceSummary,
} from '@creatorpilot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useState } from 'react';

import {
  ApiClientError,
  createWorkspace,
  getSession,
  listWorkspaces,
  logout,
} from '../../lib/api';

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser>();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const [session, workspaceList] = await Promise.all([
          getSession(controller.signal),
          listWorkspaces(controller.signal),
        ]);
        setUser(session.user);
        setWorkspaces(workspaceList.workspaces);
      } catch (caught: unknown) {
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace('/login');
          return;
        }

        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Unable to load');
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

  async function submitWorkspace(
    event: SyntheticEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get('name');

    try {
      const workspace = await createWorkspace({
        name: typeof name === 'string' ? name : '',
      });
      setWorkspaces((current) => [...current, workspace]);
      form.reset();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to create workspace',
      );
    }
  }

  async function signOut(): Promise<void> {
    await logout();
    router.replace('/login');
    router.refresh();
  }

  if (loading) {
    return <main className="dashboard-shell">Loading your workspace…</main>;
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">CreatorPilot</p>
          <h1>Your workspaces</h1>
          <p className="muted">Signed in as {user?.email}</p>
        </div>
        <div className="dashboard-actions">
          <Link className="secondary-link" href="/profile">
            View profile
          </Link>
          <button className="secondary-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="workspace-grid" aria-label="Workspaces">
        {workspaces.map((workspace) => (
          <Link
            className="workspace-card workspace-card-link"
            href={`/workspaces/${workspace.id}`}
            key={workspace.id}
          >
            <span>{workspace.role}</span>
            <h2>{workspace.name}</h2>
          </Link>
        ))}
      </section>

      <section className="create-workspace">
        <h2>Create a workspace</h2>
        <form onSubmit={(event) => void submitWorkspace(event)}>
          <label>
            Workspace name
            <input name="name" minLength={2} maxLength={80} required />
          </label>
          <button type="submit">Create workspace</button>
        </form>
      </section>
    </main>
  );
}
