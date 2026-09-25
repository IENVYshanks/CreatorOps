import type {
  ContentDraft,
  UpdateContentDraftRequest,
} from '@creatorpilot/contracts';
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type {
  ContentRepository,
  CreateContentDraftInput,
} from '../../src/modules/content/repositories/content-repository.js';
import { createContentRoutes } from '../../src/modules/content/routes/content-routes.js';
import {
  ContentService,
  type ContentWorkspaceAccess,
} from '../../src/modules/content/services/content-service.js';
import { ApplicationError } from '../../src/shared/application-error.js';

const userId = 'a58cb521-0d85-43d1-9854-d72f928d5d3d';
const workspaceId = '7a53cb19-a18b-4fd4-bb5b-c9b881f90d41';
const contentId = 'd69a9d2d-cef8-454a-b6e3-9d7a50b6f70d';
const variantId = '89b38e92-b614-4c58-b975-9e683a66eb1f';

class MemoryContentRepository implements ContentRepository {
  private content: ContentDraft | undefined;

  public create(input: CreateContentDraftInput): Promise<ContentDraft> {
    this.content = {
      id: contentId,
      workspaceId: input.workspaceId,
      title: input.title,
      body: input.body ?? null,
      status: input.status,
      instagram: {
        id: variantId,
        caption: input.instagram.caption,
        mediaUrl: input.instagram.mediaUrl ?? null,
      },
      createdByUserId: input.createdByUserId,
      createdAt: '2026-09-24T10:00:00.000Z',
      updatedAt: '2026-09-24T10:00:00.000Z',
    };
    return Promise.resolve(this.content);
  }

  public listForWorkspace(requestedWorkspaceId: string) {
    return Promise.resolve(
      this.content?.workspaceId === requestedWorkspaceId ? [this.content] : [],
    );
  }

  public findForWorkspace(
    requestedWorkspaceId: string,
    requestedContentId: string,
  ) {
    return Promise.resolve(
      this.content?.workspaceId === requestedWorkspaceId &&
        this.content.id === requestedContentId
        ? this.content
        : undefined,
    );
  }

  public update(
    requestedWorkspaceId: string,
    requestedContentId: string,
    input: UpdateContentDraftRequest,
  ) {
    if (
      this.content?.workspaceId !== requestedWorkspaceId ||
      this.content.id !== requestedContentId
    ) {
      return Promise.resolve(undefined);
    }

    this.content = {
      ...this.content,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.status === undefined ? {} : { status: input.status }),
      instagram: {
        ...this.content.instagram,
        caption: input.instagram?.caption ?? this.content.instagram.caption,
        mediaUrl: input.instagram?.mediaUrl ?? this.content.instagram.mediaUrl,
      },
      updatedAt: '2026-09-24T11:00:00.000Z',
    };
    return Promise.resolve(this.content);
  }

  public delete(requestedWorkspaceId: string, requestedContentId: string) {
    const found =
      this.content?.workspaceId === requestedWorkspaceId &&
      this.content.id === requestedContentId;
    if (found) this.content = undefined;
    return Promise.resolve(found);
  }
}

function createTestApp() {
  const getForUser = vi.fn().mockResolvedValue({
    id: workspaceId,
    name: 'Creator Studio',
    role: 'owner',
    createdAt: '2026-09-24T10:00:00.000Z',
  });
  const workspaceAccess: ContentWorkspaceAccess = {
    getForUser,
  };
  const service = new ContentService(
    new MemoryContentRepository(),
    workspaceAccess,
  );
  const authentication: RequestHandler = (_request, response, next) => {
    response.locals.user = { id: userId, email: 'creator@example.com' };
    next();
  };
  const trustedOrigin: RequestHandler = (_request, _response, next) => {
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(createContentRoutes(service, authentication, trustedOrigin));
  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    if (error instanceof ApplicationError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  };
  app.use(errorHandler);
  return { app, getForUser };
}

describe('content draft API', () => {
  it('creates, lists, updates, and deletes an Instagram content draft', async () => {
    const { app, getForUser } = createTestApp();
    const created = await request(app)
      .post(`/workspaces/${workspaceId}/content`)
      .send({
        title: 'Launch post',
        body: 'Campaign notes',
        instagram: {
          caption: 'Launching today.',
          mediaUrl: 'https://example.com/launch.jpg',
        },
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: contentId,
      title: 'Launch post',
      status: 'draft',
      instagram: { caption: 'Launching today.' },
    });

    const listed = await request(app).get(`/workspaces/${workspaceId}/content`);
    expect((listed.body as { content: unknown[] }).content).toHaveLength(1);

    const updated = await request(app)
      .patch(`/workspaces/${workspaceId}/content/${contentId}`)
      .send({ status: 'ready' });
    expect((updated.body as { status: string }).status).toBe('ready');

    expect(
      (
        await request(app).delete(
          `/workspaces/${workspaceId}/content/${contentId}`,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app).get(
          `/workspaces/${workspaceId}/content/${contentId}`,
        )
      ).status,
    ).toBe(404);
    expect(getForUser).toHaveBeenCalledWith(userId, workspaceId);
  });
});
