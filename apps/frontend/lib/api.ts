import {
  type AddWorkspaceMemberRequest,
  apiErrorResponseSchema,
  authSessionResponseSchema,
  type AuthSessionResponse,
  type CreateWorkspaceRequest,
  type CreateContentDraftRequest,
  type ContentDraft,
  type ContentDraftListResponse,
  contentDraftListResponseSchema,
  contentDraftSchema,
  type LoginRequest,
  type InstagramAuthorizationResponse,
  instagramAuthorizationResponseSchema,
  type PlatformConnectionListResponse,
  platformConnectionListResponseSchema,
  type ProfileResponse,
  profileResponseSchema,
  type RegisterRequest,
  type WorkspaceListResponse,
  type WorkspaceDetails,
  type WorkspaceMemberListResponse,
  type WorkspaceMember,
  type WorkspaceSummary,
  type UpdateContentDraftRequest,
  workspaceDetailsSchema,
  workspaceListResponseSchema,
  workspaceMemberSchema,
  workspaceMemberListResponseSchema,
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

export function getProfile(signal?: AbortSignal): Promise<ProfileResponse> {
  return request('/profile', profileResponseSchema, {
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

export function getWorkspace(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceDetails> {
  return request(`/workspaces/${workspaceId}`, workspaceDetailsSchema, {
    ...(signal ? { signal } : {}),
  });
}

export function listWorkspaceMembers(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceMemberListResponse> {
  return request(
    `/workspaces/${workspaceId}/members`,
    workspaceMemberListResponseSchema,
    {
      ...(signal ? { signal } : {}),
    },
  );
}

export function addWorkspaceMember(
  workspaceId: string,
  input: AddWorkspaceMemberRequest,
): Promise<WorkspaceMember> {
  return request(`/workspaces/${workspaceId}/members`, workspaceMemberSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listWorkspaceConnections(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<PlatformConnectionListResponse> {
  try {
    return await request(
      `/workspaces/${workspaceId}/connections`,
      platformConnectionListResponseSchema,
      { ...(signal ? { signal } : {}) },
    );
  } catch (error: unknown) {
    // Keeps workspace pages compatible while the backend integration is disabled
    // or while the frontend is deployed before its matching backend version.
    if (error instanceof ApiClientError && error.status === 404) {
      return { connections: [] };
    }

    throw error;
  }
}

export async function beginInstagramAuthorization(
  workspaceId: string,
): Promise<InstagramAuthorizationResponse> {
  try {
    return await request(
      `/workspaces/${workspaceId}/connections/instagram/authorization`,
      instagramAuthorizationResponseSchema,
      { method: 'POST' },
    );
  } catch (error: unknown) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new ApiClientError(
        503,
        'INSTAGRAM_NOT_CONFIGURED',
        'Instagram connections are not configured yet',
      );
    }

    throw error;
  }
}

export function listContentDrafts(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<ContentDraftListResponse> {
  return request(
    `/workspaces/${workspaceId}/content`,
    contentDraftListResponseSchema,
    { ...(signal ? { signal } : {}) },
  );
}

export function createContentDraft(
  workspaceId: string,
  input: CreateContentDraftRequest,
): Promise<ContentDraft> {
  return request(`/workspaces/${workspaceId}/content`, contentDraftSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateContentDraft(
  workspaceId: string,
  contentId: string,
  input: UpdateContentDraftRequest,
): Promise<ContentDraft> {
  return request(
    `/workspaces/${workspaceId}/content/${contentId}`,
    contentDraftSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function deleteContentDraft(
  workspaceId: string,
  contentId: string,
): Promise<void> {
  await requestWithoutBody(`/workspaces/${workspaceId}/content/${contentId}`, {
    method: 'DELETE',
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
