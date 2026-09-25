import { ContentDrafts } from '../../../../features/content/content-drafts';

export interface ContentPageProperties {
  params: Promise<{ workspaceId: string }>;
}

export default async function ContentPage({ params }: ContentPageProperties) {
  const { workspaceId } = await params;
  return <ContentDrafts workspaceId={workspaceId} />;
}
