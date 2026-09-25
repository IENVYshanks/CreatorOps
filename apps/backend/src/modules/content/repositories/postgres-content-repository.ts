import {
  contentDraftSchema,
  type ContentDraft,
  type UpdateContentDraftRequest,
} from '@creatorpilot/contracts';
import { and, desc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../../../database/client.js';
import { contentItems, contentVariants } from '../database/content-schema.js';
import type {
  ContentRepository,
  CreateContentDraftInput,
} from './content-repository.js';

export class PostgresContentRepository implements ContentRepository {
  public constructor(private readonly database: AppDatabase) {}

  public create(input: CreateContentDraftInput): Promise<ContentDraft> {
    return this.database.transaction(async (transaction) => {
      const now = new Date();
      const [item] = await transaction
        .insert(contentItems)
        .values({
          workspaceId: input.workspaceId,
          title: input.title,
          body: input.body ?? null,
          status: input.status,
          createdByUserId: input.createdByUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!item) {
        throw new Error('Content item insert returned no record');
      }

      const [variant] = await transaction
        .insert(contentVariants)
        .values({
          contentItemId: item.id,
          platform: 'instagram',
          caption: input.instagram.caption,
          mediaUrl: input.instagram.mediaUrl ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!variant) {
        throw new Error('Instagram content variant insert returned no record');
      }

      return toContentDraft({ ...item, variant });
    });
  }

  public async listForWorkspace(workspaceId: string): Promise<ContentDraft[]> {
    const rows = await this.baseSelection()
      .where(
        and(
          eq(contentItems.workspaceId, workspaceId),
          eq(contentVariants.platform, 'instagram'),
        ),
      )
      .orderBy(desc(contentItems.updatedAt));

    return rows.map(toContentDraft);
  }

  public async findForWorkspace(
    workspaceId: string,
    contentId: string,
  ): Promise<ContentDraft | undefined> {
    const [row] = await this.baseSelection()
      .where(
        and(
          eq(contentItems.workspaceId, workspaceId),
          eq(contentItems.id, contentId),
          eq(contentVariants.platform, 'instagram'),
        ),
      )
      .limit(1);

    return row ? toContentDraft(row) : undefined;
  }

  public async update(
    workspaceId: string,
    contentId: string,
    input: UpdateContentDraftRequest,
  ): Promise<ContentDraft | undefined> {
    const updated = await this.database.transaction(async (transaction) => {
      const itemChanges: {
        title?: string;
        body?: string | null;
        status?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (input.title !== undefined) itemChanges.title = input.title;
      if (input.body !== undefined) itemChanges.body = input.body;
      if (input.status !== undefined) itemChanges.status = input.status;

      const [item] = await transaction
        .update(contentItems)
        .set(itemChanges)
        .where(
          and(
            eq(contentItems.id, contentId),
            eq(contentItems.workspaceId, workspaceId),
          ),
        )
        .returning({ id: contentItems.id });

      if (!item) return false;

      if (input.instagram) {
        const variantChanges: {
          caption?: string;
          mediaUrl?: string | null;
          updatedAt: Date;
        } = { updatedAt: new Date() };
        if (input.instagram.caption !== undefined) {
          variantChanges.caption = input.instagram.caption;
        }
        if (input.instagram.mediaUrl !== undefined) {
          variantChanges.mediaUrl = input.instagram.mediaUrl;
        }

        await transaction
          .update(contentVariants)
          .set(variantChanges)
          .where(
            and(
              eq(contentVariants.contentItemId, contentId),
              eq(contentVariants.platform, 'instagram'),
            ),
          );
      }

      return true;
    });

    return updated ? this.findForWorkspace(workspaceId, contentId) : undefined;
  }

  public async delete(
    workspaceId: string,
    contentId: string,
  ): Promise<boolean> {
    const deleted = await this.database
      .delete(contentItems)
      .where(
        and(
          eq(contentItems.id, contentId),
          eq(contentItems.workspaceId, workspaceId),
        ),
      )
      .returning({ id: contentItems.id });

    return deleted.length > 0;
  }

  private baseSelection() {
    return this.database
      .select({
        id: contentItems.id,
        workspaceId: contentItems.workspaceId,
        title: contentItems.title,
        body: contentItems.body,
        status: contentItems.status,
        createdByUserId: contentItems.createdByUserId,
        createdAt: contentItems.createdAt,
        updatedAt: contentItems.updatedAt,
        variant: {
          id: contentVariants.id,
          caption: contentVariants.caption,
          mediaUrl: contentVariants.mediaUrl,
        },
      })
      .from(contentItems)
      .innerJoin(
        contentVariants,
        eq(contentVariants.contentItemId, contentItems.id),
      );
  }
}

function toContentDraft(row: {
  id: string;
  workspaceId: string;
  title: string;
  body: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  variant: { id: string; caption: string; mediaUrl: string | null };
}): ContentDraft {
  return contentDraftSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    body: row.body,
    status: row.status,
    instagram: row.variant,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
