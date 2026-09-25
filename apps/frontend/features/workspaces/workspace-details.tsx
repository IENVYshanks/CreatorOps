'use client';

import type {
  WorkspaceDetails as WorkspaceDetailsData,
  WorkspaceMember,
  PlatformConnection,
} from '@creatorpilot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useState } from 'react';

import {
  addWorkspaceMember,
  ApiClientError,
  beginInstagramAuthorization,
  getWorkspace,
  listWorkspaceConnections,
  listWorkspaceMembers,
} from '../../lib/api';

const workspaceDateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

export interface WorkspaceDetailsProperties {
  workspaceId: string;
  navigateToExternalUrl?: (url: string) => void;
}

export function WorkspaceDetails({
  workspaceId,
  navigateToExternalUrl = (url) => {
    window.location.assign(url);
  },
}: WorkspaceDetailsProperties) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDetailsData>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [memberError, setMemberError] = useState<string>();
  const [addingMember, setAddingMember] = useState(false);
  const [connectionError, setConnectionError] = useState<string>();
  const [connectingInstagram, setConnectingInstagram] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const [workspaceDetails, memberList, connectionList] =
          await Promise.all([
            getWorkspace(workspaceId, controller.signal),
            listWorkspaceMembers(workspaceId, controller.signal),
            listWorkspaceConnections(workspaceId, controller.signal),
          ]);
        setWorkspace(workspaceDetails);
        setMembers(memberList.members);
        setConnections(connectionList.connections);
      } catch (caught: unknown) {
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace('/login');
          return;
        }

        if (!controller.signal.aborted) {
          setError(
            caught instanceof ApiClientError && caught.status === 404
              ? 'Workspace not found.'
              : caught instanceof Error
                ? caught.message
                : 'Unable to load workspace',
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
  }, [router, workspaceId]);

  async function connectInstagram(): Promise<void> {
    setConnectionError(undefined);
    setConnectingInstagram(true);

    try {
      const authorization = await beginInstagramAuthorization(workspaceId);
      navigateToExternalUrl(authorization.authorizationUrl);
    } catch (caught: unknown) {
      if (caught instanceof ApiClientError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setConnectionError(
        caught instanceof Error
          ? caught.message
          : 'Unable to connect Instagram',
      );
      setConnectingInstagram(false);
    }
  }

  async function submitMember(
    event: SyntheticEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setMemberError(undefined);
    setAddingMember(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email');

    try {
      const member = await addWorkspaceMember(workspaceId, {
        email: typeof email === 'string' ? email : '',
      });
      setMembers((current) => [...current, member]);
      form.reset();
    } catch (caught: unknown) {
      if (caught instanceof ApiClientError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setMemberError(
        caught instanceof Error ? caught.message : 'Unable to add member',
      );
    } finally {
      setAddingMember(false);
    }
  }

  if (loading) {
    return (
      <main className="workspace-details-shell">Loading workspace...</main>
    );
  }

  return (
    <main className="workspace-details-shell">
      <div className="workspace-details-layout">
        <Link className="secondary-link" href="/dashboard">
          Back to dashboard
        </Link>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {workspace ? (
          <>
            <header className="workspace-details-header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h1>{workspace.name}</h1>
              </div>
              <span className="workspace-role">{workspace.role}</span>
            </header>

            <p className="muted">
              Created{' '}
              <time dateTime={workspace.createdAt}>
                {workspaceDateFormatter.format(new Date(workspace.createdAt))}
              </time>
            </p>

            <Link
              className="secondary-link"
              href={`/workspaces/${workspaceId}/content`}
            >
              Open content studio
            </Link>

            {connections.length > 0 ? (
              <Link
                className="secondary-link"
                href={`/workspaces/${workspaceId}/analytics`}
              >
                Open Instagram dashboard
              </Link>
            ) : null}

            <section
              className="connection-panel"
              aria-labelledby="connections-heading"
            >
              <h2 id="connections-heading">Connected platforms</h2>
              {connections.length === 0 ? (
                <p className="muted">No platforms connected yet.</p>
              ) : (
                connections.map((connection) => (
                  <article className="connection-card" key={connection.id}>
                    <div>
                      <strong>Instagram</strong>
                      <p className="muted">@{connection.username}</p>
                    </div>
                    <span>Connected</span>
                  </article>
                ))
              )}
              {workspace.role === 'owner' && connections.length === 0 ? (
                <button
                  disabled={connectingInstagram}
                  onClick={() => void connectInstagram()}
                  type="button"
                >
                  {connectingInstagram
                    ? 'Connecting Instagram...'
                    : 'Connect Instagram'}
                </button>
              ) : null}
              {connectionError ? (
                <p className="form-error" role="alert">
                  {connectionError}
                </p>
              ) : null}
            </section>

            {workspace.role === 'owner' ? (
              <section
                className="add-member-panel"
                aria-labelledby="add-member-heading"
              >
                <h2 id="add-member-heading">Add a member</h2>
                <p className="muted">
                  The person must already have a CreatorPilot account.
                </p>
                <form onSubmit={(event) => void submitMember(event)}>
                  <label>
                    Member email
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <button disabled={addingMember} type="submit">
                    {addingMember ? 'Adding member...' : 'Add member'}
                  </button>
                </form>
                {memberError ? (
                  <p className="form-error" role="alert">
                    {memberError}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="member-list" aria-labelledby="members-heading">
              <h2 id="members-heading">Members</h2>
              {members.map((member) => (
                <article className="member-card" key={member.userId}>
                  <div>
                    <strong>{member.email}</strong>
                    <p className="muted">
                      Joined{' '}
                      <time dateTime={member.joinedAt}>
                        {workspaceDateFormatter.format(
                          new Date(member.joinedAt),
                        )}
                      </time>
                    </p>
                  </div>
                  <span>{member.role}</span>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
