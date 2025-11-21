const fp = require('fastify-plugin');
const { setupRegistry } = require('./registry.js');
const { registerHttpHooks } = require('./http.js');
const { registerMetricsEndpoint } = require('./endpoint.js');
const { registerExternalMetrics } = require('./external.js');

module.exports = fp(async function metricsPlugin(fastify) {
  setupRegistry();
  registerHttpHooks(fastify);
  registerMetricsEndpoint(fastify);
  registerExternalMetrics(fastify);
});

