import client from 'prom-client';
import config from '../../config.js';

const collectDefaultMetrics = client.collectDefaultMetrics;
let registryInitialized = false;

export function setupRegistry() {
    if (registryInitialized) return;

    collectDefaultMetrics({ eventLoopMonitoringPrecision: 10 });

    client.register.setDefaultLabels({
        service: config.SERVICE_NAME || 'chat',
    });

    registryInitialized = true;
}

export const register = client.register;
export { client };

export function getOrCreateHistogram(opts) {
    const existing = register.getSingleMetric(opts.name);
    if (existing) return existing;
    return new client.Histogram(opts);
}

export function getOrCreateGauge(opts) {
    const existing = register.getSingleMetric(opts.name);
    if (existing) return existing;
    return new client.Gauge(opts);
}