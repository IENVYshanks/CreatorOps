'use client';

import type { ContentDraft, ContentStatus } from '@creatorpilot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useState } from 'react';

import {
  ApiClientError,
  createContentDraft,
  deleteContentDraft,
  listContentDrafts,
  updateContentDraft,
} from '../../lib/api';

export interface ContentDraftsProperties {
  workspaceId: string;
}

export function ContentDrafts({ workspaceId }: ContentDraftsProperties) {
  const router = useRouter();
  const [content, setContent] = useState<ContentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [editingId, setEditingId] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();

    void listContentDrafts(workspaceId, controller.signal)
      .then((response) => {
        setContent(response.content);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace('/login');
          return;
        }
        if (!controller.signal.aborted) {
          setError(toMessage(caught));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [router, workspaceId]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);

    try {
      if (editingId) {
        const updated = await updateContentDraft(workspaceId, editingId, {
          title,
          body: body || null,
          instagram: { caption, mediaUrl: mediaUrl || null },
        });
        replaceContent(updated);
      } else {
        const created = await createContentDraft(workspaceId, {
          title,
          ...(body ? { body } : {}),
          status: 'draft',
          instagram: { caption, ...(mediaUrl ? { mediaUrl } : {}) },
        });
        setContent((current) => [created, ...current]);
      }
      resetForm();
    } catch (caught: unknown) {
      handleError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(draft: ContentDraft, status: ContentStatus) {
    setError(undefined);
    try {
      const updated = await updateContentDraft(workspaceId, draft.id, {
        status,
      });
      replaceContent(updated);
    } catch (caught: unknown) {
      handleError(caught);
    }
  }

  async function remove(draft: ContentDraft) {
    setError(undefined);
    try {
      await deleteContentDraft(workspaceId, draft.id);
      setContent((current) => current.filter((item) => item.id !== draft.id));
    } catch (caught: unknown) {
      handleError(caught);
    }
  }

  function edit(draft: ContentDraft) {
    setEditingId(draft.id);
    setTitle(draft.title);
    setBody(draft.body ?? '');
    setCaption(draft.instagram.caption);
    setMediaUrl(draft.instagram.mediaUrl ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setBody('');
    setCaption('');
    setMediaUrl('');
  }

  function replaceContent(updated: ContentDraft) {
    setContent((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function handleError(caught: unknown) {
    if (caught instanceof ApiClientError && caught.status === 401) {
      router.replace('/login');
      return;
    }
    setError(toMessage(caught));
  }

  return (
    <main className="workspace-details-shell">
      <div className="content-layout">
        <Link className="secondary-link" href={`/workspaces/${workspaceId}`}>
          Back to workspace
        </Link>
        <header className="content-header">
          <p className="eyebrow">Content studio</p>
          <h1>Instagram drafts</h1>
          <p className="muted">
            Prepare the canonical idea and its Instagram caption in one place.
          </p>
        </header>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="content-studio-grid">
          <form
            className="content-composer"
            onSubmit={(event) => void submit(event)}
          >
            <h2>{editingId ? 'Edit draft' : 'Create a draft'}</h2>
            <label>
              Internal title
              <input
                maxLength={160}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                required
                value={title}
              />
            </label>
            <label>
              Canonical notes
              <textarea
                maxLength={10_000}
                onChange={(event) => {
                  setBody(event.target.value);
                }}
                rows={4}
                value={body}
              />
            </label>
            <label>
              Instagram caption
              <textarea
                maxLength={2_200}
                onChange={(event) => {
                  setCaption(event.target.value);
                }}
                rows={6}
                value={caption}
              />
            </label>
            <label>
              Media URL
              <input
                onChange={(event) => {
                  setMediaUrl(event.target.value);
                }}
                placeholder="https://example.com/media.jpg"
                type="url"
                value={mediaUrl}
              />
            </label>
            <button disabled={saving} type="submit">
              {saving
                ? 'Saving draft...'
                : editingId
                  ? 'Update draft'
                  : 'Save draft'}
            </button>
            {editingId ? (
              <button
                className="secondary-button"
                onClick={resetForm}
                type="button"
              >
                Cancel editing
              </button>
            ) : null}
          </form>

          <section className="instagram-preview" aria-label="Instagram preview">
            <p className="eyebrow">Live preview</p>
            <div className="preview-media">
              {mediaUrl || 'Your media URL will appear here'}
            </div>
            <strong>{title || 'Untitled draft'}</strong>
            <p>{caption || 'Your Instagram caption will appear here.'}</p>
          </section>
        </div>

        <section className="content-list" aria-labelledby="drafts-heading">
          <h2 id="drafts-heading">Saved content</h2>
          {loading ? <p className="muted">Loading drafts...</p> : null}
          {!loading && content.length === 0 ? (
            <p className="muted">No content drafts yet.</p>
          ) : null}
          {content.map((draft) => (
            <article className="content-card" key={draft.id}>
              <div>
                <span className={`content-status status-${draft.status}`}>
                  {draft.status}
                </span>
                <h3>{draft.title}</h3>
                {draft.body ? <p className="muted">{draft.body}</p> : null}
                <p>{draft.instagram.caption || 'No Instagram caption.'}</p>
                {draft.instagram.mediaUrl ? (
                  <a
                    href={draft.instagram.mediaUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open media
                  </a>
                ) : null}
              </div>
              <div className="content-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    edit(draft);
                  }}
                  type="button"
                >
                  Edit
                </button>
                {draft.status === 'draft' ? (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void changeStatus(draft, 'ready');
                    }}
                    type="button"
                  >
                    Mark ready
                  </button>
                ) : null}
                {draft.status === 'ready' ? (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void changeStatus(draft, 'published');
                    }}
                    type="button"
                  >
                    Mark published
                  </button>
                ) : null}
                <button
                  className="danger-button"
                  onClick={() => {
                    void remove(draft);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function toMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Unable to load content';
}
