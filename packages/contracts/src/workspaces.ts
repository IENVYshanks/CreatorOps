import { z } from 'zod';

import { emailSchema } from './auth.js';

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const addWorkspaceMemberRequestSchema = z.object({
  email: emailSchema,
});

export const workspaceRoleSchema = z.enum(['owner', 'member']);

export const workspaceIdParametersSchema = z.object({
  workspaceId: z.uuid(),
});

export const workspaceMemberParametersSchema =
  workspaceIdParametersSchema.extend({
    userId: z.uuid(),
  });

export const workspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: workspaceRoleSchema,
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceSummarySchema),
});

export const workspaceDetailsSchema = workspaceSummarySchema.extend({
  createdAt: z.iso.datetime(),
});

export const workspaceMemberSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  role: workspaceRoleSchema,
  joinedAt: z.iso.datetime(),
});

export const workspaceMemberListResponseSchema = z.object({
  members: z.array(workspaceMemberSchema),
});

export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;
export type AddWorkspaceMemberRequest = z.infer<
  typeof addWorkspaceMemberRequestSchema
>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
export type WorkspaceDetails = z.infer<typeof workspaceDetailsSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceMemberListResponse = z.infer<
  typeof workspaceMemberListResponseSchema
>;
