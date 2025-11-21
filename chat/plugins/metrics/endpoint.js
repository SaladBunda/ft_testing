import fs from 'node:fs';
import { register } from './registry.js';
import ipRangeCheck from 'ip-range-check';

const DEFAULT_ALLOWED_CIDRS = ['172.16.0.0/12'];
const DEFAULT_BLOCKED_IPS = ['127.0.0.1', '::1'];

const toList = (value, fallback = []) => {
  if (!value) return [...fallback];
  const list = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length ? list : [...fallback];
};

const hexToIp = (hex) => {
  if (!hex || hex.length !== 8) return null;
  const num = parseInt(hex, 16);
  const octets = [
    num & 0xff,
    (num >> 8) & 0xff,
    (num >> 16) & 0xff,
    (num >> 24) & 0xff,
  ];
  return octets.join('.');
};

const detectDockerGateway = () => {
  if (process.env.METRICS_GATEWAY_IP) {
    return process.env.METRICS_GATEWAY_IP.trim();
  }

  try {
    const routeTable = fs.readFileSync('/proc/net/route', 'utf8');
    const lines = routeTable.trim().split('\n').slice(1);
    for (const line of lines) {
      const [iface, destination, gateway, flags, , , , mask] = line.trim().split(/\s+/);
      const isDefaultRoute = destination === '00000000' && mask === '00000000';
      const isValidIface = iface && iface !== 'lo';

      if (isDefaultRoute && isValidIface) {
        const gatewayIp = hexToIp(gateway);
        if (gatewayIp) {
          return gatewayIp;
        }
      }
    }
  } catch (error) {
    console.warn('[metrics] Unable to determine Docker gateway IP', error);
  }

  return null;
};

const allowedCidrs = toList(process.env.METRICS_ALLOW_CIDRS, DEFAULT_ALLOWED_CIDRS);
const blockedIpSet = new Set(toList(process.env.METRICS_DENY_IPS, DEFAULT_BLOCKED_IPS));

const dockerGatewayIp = detectDockerGateway();
if (dockerGatewayIp) {
  blockedIpSet.add(dockerGatewayIp);
}

export function registerMetricsEndpoint(fastify) {
  fastify.get(
    '/metrics',
    {
      schema: {
        response: {
          200: { type: 'string', description: 'Prometheus metrics' },
          403: { type: 'string', description: 'Forbidden' },
        },
      },
      preHandler: (req, rep, done) => {
        const socketIp = req.socket?.remoteAddress;
        const forwardedIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
        const candidateIp = socketIp || forwardedIp || req.ip || 'unknown';

        const cleanIp = candidateIp.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');

        if (blockedIpSet.has(cleanIp)) {
          fastify.log.warn({
            msg: 'Metrics endpoint access denied - blocked IP',
            ip: cleanIp,
            socketIp,
            forwardedIp,
            blockedIpSet: Array.from(blockedIpSet),
          });
          return rep
            .code(403)
            .send('Forbidden: Metrics endpoint is not exposed outside internal network');
        }

        const isAllowedCidr = allowedCidrs.some((cidr) => ipRangeCheck(cleanIp, cidr));
        const userAgent = req.headers['user-agent'] || '';
        const isPrometheus = userAgent.includes('Prometheus');

        if (!isAllowedCidr && !isPrometheus) {
          fastify.log.warn({
            msg: 'Metrics endpoint access denied - not in allow list',
            ip: cleanIp,
            socketIp,
            forwardedIp,
            allowedCidrs,
            blockedIpSet: Array.from(blockedIpSet),
            userAgent,
          });
          return rep
            .code(403)
            .send('Forbidden: Metrics endpoint is only accessible from Prometheus within Docker network');
        }

        if (process.env.NODE_ENV !== 'production') {
          fastify.log.debug({
            msg: 'Metrics endpoint accessed',
            ip: cleanIp,
            isAllowedCidr,
            isPrometheus,
            socketIp,
            forwardedIp,
          });
        }
        done();
      }
    },
    async (_req, reply) => {
      reply.header('Content-Type', register.contentType);
      return register.metrics();
    }
  );
}