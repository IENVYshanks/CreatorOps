import { z } from 'zod';

export const contentStatusSchema = z.enum(['draft', 'ready', 'published']);

export const instagramContentVariantSchema = z.object({
  id: z.uuid(),
  caption: z.string().max(2_200),
  mediaUrl: z.url().nullable(),
});

export const contentDraftSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  title: z.string().min(1).max(160),
  body: z.string().max(10_000).nullable(),
  status: contentStatusSchema,
  instagram: instagramContentVariantSchema,
  createdByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const instagramVariantInputSchema = z.object({
  caption: z.string().trim().max(2_200),
  mediaUrl: z.url().optional(),
});

export const createContentDraftRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(10_000).optional(),
  status: contentStatusSchema.default('draft'),
  instagram: instagramVariantInputSchema,
});

const updateInstagramVariantInputSchema = z
  .object({
    caption: z.string().trim().max(2_200).optional(),
    mediaUrl: z.url().nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one Instagram field is required',
  });

export const updateContentDraftRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    body: z.string().trim().max(10_000).nullable().optional(),
    status: contentStatusSchema.optional(),
    instagram: updateInstagramVariantInputSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one content field is required',
  });

export const contentDraftListResponseSchema = z.object({
  content: z.array(contentDraftSchema),
});

export const contentDraftParametersSchema = z.object({
  workspaceId: z.uuid(),
  contentId: z.uuid(),
});

export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type InstagramContentVariant = z.infer<
  typeof instagramContentVariantSchema
>;
export type ContentDraft = z.infer<typeof contentDraftSchema>;
export type CreateContentDraftRequest = z.infer<
  typeof createContentDraftRequestSchema
>;
export type UpdateContentDraftRequest = z.infer<
  typeof updateContentDraftRequestSchema
>;
export type ContentDraftListResponse = z.infer<
  typeof contentDraftListResponseSchema
>;
