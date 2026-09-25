import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentDrafts } from '../../features/content/content-drafts';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';
const createdDraft = {
  id: 'd69a9d2d-cef8-454a-b6e3-9d7a50b6f70d',
  workspaceId,
  title: 'Launch post',
  body: 'Campaign notes',
  status: 'draft',
  instagram: {
    id: '89b38e92-b614-4c58-b975-9e683a66eb1f',
    caption: 'Launching today.',
    mediaUrl: 'https://example.com/launch.jpg',
  },
  createdByUserId: 'a58cb521-0d85-43d1-9854-d72f928d5d3d',
  createdAt: '2026-09-24T10:00:00.000Z',
  updatedAt: '2026-09-24T10:00:00.000Z',
};

describe('ContentDrafts', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('creates a draft and displays its Instagram preview', async () => {
    const responses = [{ content: [] }, createdDraft];
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responses.shift()), {
          status: responses.length === 0 ? 201 : 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ContentDrafts workspaceId={workspaceId} />);

    expect(
      await screen.findByText('No content drafts yet.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Internal title'), 'Launch post');
    await user.type(screen.getByLabelText('Canonical notes'), 'Campaign notes');
    await user.type(
      screen.getByLabelText('Instagram caption'),
      'Launching today.',
    );
    await user.type(
      screen.getByLabelText('Media URL'),
      'https://example.com/launch.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(screen.getByText('Campaign notes')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/workspaces/${workspaceId}/content`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
