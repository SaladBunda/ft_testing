import { client, getOrCreateGauge, getOrCreateHistogram } from './registry.js';
import config from '../../config.js';

const serviceName = config.SERVICE_NAME || 'chat';

// Shared HTTP metrics
const httpRequestDuration = getOrCreateHistogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.5, 1, 3, 5, 10],
});

const httpRequestsInFlight = getOrCreateGauge({
  name: 'http_requests_in_flight',
  help: 'In-flight HTTP requests',
  labelNames: ['service', 'method', 'route'],
});

const sizeBuckets = [
  200, 500,
  1024, 2048, 5120,
  10240, 51200, 102400,
  524288, 1048576, 5242880,
];

const httpRequestSize = getOrCreateHistogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['service', 'method', 'route'],
  buckets: sizeBuckets,
});

const httpResponseSize = getOrCreateHistogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: sizeBuckets,
});

const httpRequestErrors =
  client.register.getSingleMetric('http_request_errors_total') ||
  new client.Counter({
    name: 'http_request_errors_total',
    help: 'HTTP error responses',
    labelNames: ['service', 'method', 'route', 'status_code'],
  });

export function registerHttpHooks(fastify) {
  fastify.addHook('onRequest', (req, _reply, done) => {
    const route = req.routerPath || req.url || 'unknown';
    req.__metrics = req.__metrics || {};
    req.__metrics.route = route;
    req.__metrics.method = req.method;
    req.startTimeNs = process.hrtime.bigint();

    httpRequestsInFlight.inc({ service: serviceName, method: req.method, route });

    const cl = req.headers && (req.headers['content-length'] || req.headers['Content-Length']);
    const clNum = cl ? parseInt(Array.isArray(cl) ? cl[0] : cl, 10) : NaN;
    if (Number.isFinite(clNum)) {
      req.__metrics.requestSizeBytes = clNum;
    }
    done();
  });

  fastify.addHook('preHandler', (req, _reply, done) => {
    if (!req.__metrics) req.__metrics = {};
    if (typeof req.__metrics.requestSizeBytes !== 'number') {
      let size = 0;
      try {
        if (typeof req.body === 'string') {
          size = Buffer.byteLength(req.body);
        } else if (req.body !== undefined && req.body !== null) {
          size = Buffer.byteLength(JSON.stringify(req.body));
        }
      } catch {}
      req.__metrics.requestSizeBytes = size;
    }
    done();
  });

  fastify.addHook('onSend', (req, reply, payload, done) => {
    try {
      let size = 0;
      if (payload !== undefined && payload !== null) {
        if (Buffer.isBuffer(payload)) {
          size = payload.length;
        } else if (typeof payload === 'string') {
          size = Buffer.byteLength(payload);
        } else {
          size = Buffer.byteLength(JSON.stringify(payload));
        }
      }
      if (!req.__metrics) req.__metrics = {};
      req.__metrics.responseSizeBytes = size;
    } finally {
      done();
    }
  });

  fastify.addHook('onResponse', (req, reply, done) => {
    try {
      const route = (req.__metrics && req.__metrics.route) || req.routerPath || req.url || 'unknown';
      const method = (req.__metrics && req.__metrics.method) || req.method;
      const endNs = process.hrtime.bigint();
      const duration = Number(endNs - (req.startTimeNs || endNs)) / 1e9;
      httpRequestDuration.observe({ service: serviceName, method, route, status_code: reply.statusCode }, duration);

      httpRequestsInFlight.dec({ service: serviceName, method, route });

      const reqSize = (req.__metrics && typeof req.__metrics.requestSizeBytes === 'number')
        ? req.__metrics.requestSizeBytes
        : 0;
      httpRequestSize.observe({ service: serviceName, method, route }, reqSize);

      const cl = reply.getHeader && reply.getHeader('content-length');
      const clNum = cl ? parseInt(Array.isArray(cl) ? cl[0] : String(cl), 10) : NaN;
      const respSize = Number.isFinite(clNum)
        ? clNum
        : ((req.__metrics && typeof req.__metrics.responseSizeBytes === 'number') ? req.__metrics.responseSizeBytes : 0);
      httpResponseSize.observe({ service: serviceName, method, route, status_code: reply.statusCode }, respSize);

      const errLabels = { service: serviceName, method, route, status_code: reply.statusCode };
      const incValue = reply.statusCode >= 400 ? 1 : 0;
      httpRequestErrors.inc(errLabels, incValue);
    } finally {
      done();
    }
  });
}