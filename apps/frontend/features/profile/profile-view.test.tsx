import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileView } from './profile-view';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

describe('ProfileView', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('loads and displays the authenticated user profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            id: '4e075cf1-a65a-4f1e-b62f-c4a3cb4bf23d',
            email: 'creator@example.com',
            createdAt: '2026-09-23T08:30:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ProfileView />);

    expect(await screen.findByText('creator@example.com')).toBeInTheDocument();
    expect(screen.getByText('September 23, 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to dashboard' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('redirects an unauthenticated user to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Authentication required',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    render(<ProfileView />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('displays a non-authentication API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Unable to retrieve profile',
            },
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    render(<ProfileView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to retrieve profile',
    );
  });
});
