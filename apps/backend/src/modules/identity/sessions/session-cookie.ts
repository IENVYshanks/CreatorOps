import { parseCookie, stringifySetCookie } from 'cookie';
import type { Request, Response } from 'express';

// Cookie settings shared by authentication routes and middleware.
export interface SessionCookieOptions {
  name: string;
  secure: boolean;
}

export function readSessionToken(
  request: Request,
  configuration: SessionCookieOptions,
): string | undefined {
  const cookies = parseCookie(request.headers.cookie ?? '');
  return cookies[configuration.name];
}

export function setSessionCookie(
  response: Response,
  configuration: SessionCookieOptions,
  token: string,
  expiresAt: Date,
): void {
  response.append(
    'Set-Cookie',
    stringifySetCookie({
      name: configuration.name,
      value: token,
      httpOnly: true,
      secure: configuration.secure,
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
      priority: 'high',
    }),
  );
}

export function clearSessionCookie(
  response: Response,
  configuration: SessionCookieOptions,
): void {
  response.append(
    'Set-Cookie',
    stringifySetCookie({
      name: configuration.name,
      value: '',
      httpOnly: true,
      secure: configuration.secure,
      sameSite: 'strict',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      priority: 'high',
    }),
  );
}
