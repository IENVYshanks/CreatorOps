import { z } from 'zod';

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const workspaceRoleSchema = z.enum(['owner', 'member']);

export const workspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: workspaceRoleSchema,
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceSummarySchema),
});

export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
