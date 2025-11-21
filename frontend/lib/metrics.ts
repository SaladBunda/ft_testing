import { Registry, collectDefaultMetrics } from 'prom-client';

const GLOBAL_REGISTRY_KEY = '__frontend_metrics_registry__';
const GLOBAL_INIT_KEY = '__frontend_metrics_initialized__';

export const frontendServiceName =
  process.env.NEXT_PUBLIC_SERVICE_NAME ??
  process.env.SERVICE_NAME ??
  'frontend';

type WithRegistry = typeof globalThis & {
  [GLOBAL_REGISTRY_KEY]?: Registry;
  [GLOBAL_INIT_KEY]?: boolean;
};

const globalWithRegistry = globalThis as WithRegistry;

const registry = globalWithRegistry[GLOBAL_REGISTRY_KEY] ?? new Registry();

if (!globalWithRegistry[GLOBAL_INIT_KEY]) {
  registry.setDefaultLabels({
    service: frontendServiceName,
  });

  collectDefaultMetrics({
    register: registry,
    eventLoopMonitoringPrecision: 10,
  });

  globalWithRegistry[GLOBAL_INIT_KEY] = true;
  globalWithRegistry[GLOBAL_REGISTRY_KEY] = registry;
}

export async function getFrontendMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;