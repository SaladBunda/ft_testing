import { getFrontendMetrics, metricsContentType } from '@/lib/metrics';
import { isMetricsAllowed } from '@/lib/metrics-protection';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: Request) {
  if (!isMetricsAllowed(request)) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await getFrontendMetrics();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': metricsContentType,
      'Cache-Control': 'no-store',
    },
  });
}
