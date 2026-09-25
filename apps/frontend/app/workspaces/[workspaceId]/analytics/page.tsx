import { InstagramDashboard } from '../../../../features/analytics/instagram-dashboard';

export interface AnalyticsPageProperties {
  params: Promise<{ workspaceId: string }>;
}

export default async function AnalyticsPage({
  params,
}: AnalyticsPageProperties) {
  const { workspaceId } = await params;
  return <InstagramDashboard workspaceId={workspaceId} />;
}
