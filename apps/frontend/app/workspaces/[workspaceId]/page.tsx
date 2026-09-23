import { WorkspaceDetails } from '../../../features/workspaces/workspace-details';

export interface WorkspacePageProperties {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({
  params,
}: WorkspacePageProperties) {
  const { workspaceId } = await params;
  return <WorkspaceDetails workspaceId={workspaceId} />;
}
