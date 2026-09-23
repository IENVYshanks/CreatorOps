import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthForm } from './auth-form';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

describe('AuthForm', () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.refresh.mockReset();
  });

  it('registers and routes to the dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'a58cb521-0d85-43d1-9854-d72f928d5d3d',
            email: 'creator@example.com',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AuthForm mode="register" />);
    await user.type(screen.getByLabelText('Email'), 'creator@example.com');
    await user.type(screen.getByLabelText('Password'), 'a secure password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(navigation.push).toHaveBeenCalledWith('/dashboard');
  });
});
