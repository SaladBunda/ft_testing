const { register, client } = require('./registry.js');
const config = require('../../config');

const serviceName = config.SERVICE_NAME || 'auth-backend';

const externalDuration =
  register.getSingleMetric('external_request_duration_seconds') ||
  new client.Histogram({
    name: 'external_request_duration_seconds',
    help: 'External dependency call duration in seconds',
    labelNames: ['service', 'dependency'],
    buckets: [0.05, 0.1, 0.5, 1, 3, 5, 10],
  });

const externalErrors =
  register.getSingleMetric('external_request_errors_total') ||
  new client.Counter({
    name: 'external_request_errors_total',
    help: 'External dependency call errors',
    labelNames: ['service', 'dependency'],
  });

async function trackExternal(dependency, fn) {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    externalDuration.observe({ service: serviceName, dependency }, Number(process.hrtime.bigint() - start) / 1e9);
    return result;
  } catch (err) {
    externalDuration.observe({ service: serviceName, dependency }, Number(process.hrtime.bigint() - start) / 1e9);
    externalErrors.inc({ service: serviceName, dependency });
    throw err;
  }
}

function registerExternalMetrics(fastify) {
  if (!fastify.hasDecorator('trackExternal')) {
    fastify.decorate('trackExternal', trackExternal);
  }
}

module.exports = {
  trackExternal,
  registerExternalMetrics,
};


