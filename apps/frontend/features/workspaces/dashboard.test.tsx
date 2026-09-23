import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from './dashboard';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

describe('Dashboard', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
  });

  it('loads the authenticated user and tenant workspaces', async () => {
    const responses = [
      {
        user: {
          id: 'a58cb521-0d85-43d1-9854-d72f928d5d3d',
          email: 'creator@example.com',
        },
      },
      {
        workspaces: [
          {
            id: '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41',
            name: 'Creator Studio',
            role: 'owner',
          },
        ],
      },
    ];
    const fetchMock = vi.fn().mockImplementation(() => {
      const body = responses.shift();
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Dashboard />);

    expect(await screen.findByText('Creator Studio')).toBeInTheDocument();
    expect(
      screen.getByText('Signed in as creator@example.com'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(
      screen.getByRole('link', { name: /Creator Studio/ }),
    ).toHaveAttribute(
      'href',
      '/workspaces/7a53cb19-a18b-4fd4-bb5b-c9b881f90d41',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
