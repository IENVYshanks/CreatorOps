import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceDetails } from './workspace-details';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WorkspaceDetails', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads workspace details and members', async () => {
    const responses = [
      {
        id: workspaceId,
        name: 'Creator Studio',
        role: 'owner',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      {
        members: [
          {
            userId: 'a58cb521-0d85-43d1-9854-d72f928d5d3d',
            email: 'creator@example.com',
            role: 'owner',
            joinedAt: '2026-09-20T10:00:00.000Z',
          },
        ],
      },
    ];
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(responses.shift())),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    expect(
      await screen.findByRole('heading', { name: 'Creator Studio' }),
    ).toBeInTheDocument();
    expect(screen.getByText('creator@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('owner')).toHaveLength(2);
    expect(screen.getAllByText('September 20, 2026')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Back to dashboard' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}`,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/members`,
      expect.any(Object),
    );
    expect(
      screen.getByRole('heading', { name: 'Add a member' }),
    ).toBeInTheDocument();
  });

  it('lets an owner add a registered member', async () => {
    const newMember = {
      userId: 'd69a9d2d-cef8-454a-b6e3-9d7a50b6f70d',
      email: 'member@example.com',
      role: 'member',
      joinedAt: '2026-09-23T10:00:00.000Z',
    };
    const responses = [
      {
        id: workspaceId,
        name: 'Creator Studio',
        role: 'owner',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      { members: [] },
      newMember,
    ];
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(responses.shift())),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    const emailInput = await screen.findByRole('textbox', {
      name: 'Member email',
    });
    await user.type(emailInput, 'member@example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    expect(emailInput).toHaveValue('');
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/workspaces/${workspaceId}/members`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'member@example.com' }),
      }),
    );
  });

  it('does not show the add-member form to a regular member', async () => {
    const responses = [
      {
        id: workspaceId,
        name: 'Creator Studio',
        role: 'member',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      { members: [] },
    ];
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(responses.shift())),
        ),
    );

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    expect(
      await screen.findByRole('heading', { name: 'Creator Studio' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Add a member' }),
    ).not.toBeInTheDocument();
  });

  it('shows the API message when adding a member fails', async () => {
    const responses = [
      jsonResponse({
        id: workspaceId,
        name: 'Creator Studio',
        role: 'owner',
        createdAt: '2026-09-20T10:00:00.000Z',
      }),
      jsonResponse({ members: [] }),
      jsonResponse(
        {
          error: {
            code: 'WORKSPACE_MEMBER_EXISTS',
            message: 'User is already a workspace member',
          },
        },
        409,
      ),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(responses.shift())),
    );
    const user = userEvent.setup();

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    await user.type(
      await screen.findByRole('textbox', { name: 'Member email' }),
      'member@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User is already a workspace member',
    );
  });

  it('redirects to login when the session expires while adding a member', async () => {
    const responses = [
      jsonResponse({
        id: workspaceId,
        name: 'Creator Studio',
        role: 'owner',
        createdAt: '2026-09-20T10:00:00.000Z',
      }),
      jsonResponse({ members: [] }),
      jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        401,
      ),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(responses.shift())),
    );
    const user = userEvent.setup();

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    await user.type(
      await screen.findByRole('textbox', { name: 'Member email' }),
      'member@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects an unauthenticated visitor to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse(
              { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
              401,
            ),
          ),
        ),
    );

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows a clear message when the workspace is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse(
              { error: { code: 'NOT_FOUND', message: 'Not found' } },
              404,
            ),
          ),
        ),
    );

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workspace not found.',
    );
  });

  it('shows the API message for another request failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Unable to load members',
              },
            },
            500,
          ),
        ),
      ),
    );

    render(<WorkspaceDetails workspaceId={workspaceId} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load members',
    );
  });
});
