import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
  type AuthSessionResponse,
  type CreateWorkspaceRequest,
  type LoginRequest,
  type RegisterRequest,
  type WorkspaceListResponse,
  type WorkspaceSummary,
  workspaceListResponseSchema,
  workspaceSummarySchema,
} from '@creatorpilot/contracts';
import type { ZodType } from 'zod';

export class ApiClientError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function register(input: RegisterRequest): Promise<AuthSessionResponse> {
  return request('/auth/register', authSessionResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: LoginRequest): Promise<AuthSessionResponse> {
  return request('/auth/login', authSessionResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await requestWithoutBody('/auth/logout', { method: 'POST' });
}

export function getSession(signal?: AbortSignal): Promise<AuthSessionResponse> {
  return request('/auth/session', authSessionResponseSchema, {
    ...(signal ? { signal } : {}),
  });
}

export function listWorkspaces(
  signal?: AbortSignal,
): Promise<WorkspaceListResponse> {
  return request('/workspaces', workspaceListResponseSchema, {
    ...(signal ? { signal } : {}),
  });
}

export function createWorkspace(
  input: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return request('/workspaces', workspaceSummarySchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function request<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = createJsonHeaders(init.headers);
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    throw toApiClientError(response.status, body);
  }

  return schema.parse(body);
}

async function requestWithoutBody(
  path: string,
  init: RequestInit,
): Promise<void> {
  const headers = createJsonHeaders(init.headers);
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (!response.ok) {
    const body: unknown = await response.json();
    throw toApiClientError(response.status, body);
  }
}

function createJsonHeaders(initialHeaders?: HeadersInit): Headers {
  const headers = new Headers(initialHeaders);
  headers.set('Content-Type', 'application/json');
  return headers;
}

function toApiClientError(status: number, body: unknown): ApiClientError {
  const parsed = apiErrorResponseSchema.safeParse(body);

  if (parsed.success) {
    return new ApiClientError(
      status,
      parsed.data.error.code,
      parsed.data.error.message,
    );
  }

  return new ApiClientError(status, 'UNEXPECTED_RESPONSE', 'Request failed');
}
