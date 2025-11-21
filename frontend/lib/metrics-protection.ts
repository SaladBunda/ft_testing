import { readFileSync } from 'fs';
import ipRangeCheck from 'ip-range-check';

const ALLOWED_CIDR = '172.16.0.0/12';
const BLOCKED_IPS = ['127.0.0.1', '::1'];

// Detect Docker gateway IP (the IP host machine uses when accessing via port mapping)
const detectDockerGateway = (): string | null => {
  if (process.env.METRICS_GATEWAY_IP) {
    return process.env.METRICS_GATEWAY_IP.trim();
  }
  
  try {
    const routeTable = readFileSync('/proc/net/route', 'utf8');
    const lines = routeTable.trim().split('\n').slice(1);
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const [iface, destination, gateway, , , , , mask] = parts;
      
      // Find default route (destination 0.0.0.0, mask 0.0.0.0)
      if (destination === '00000000' && mask === '00000000' && iface && iface !== 'lo') {
        // Convert hex gateway to IP
        if (gateway && gateway.length === 8) {
          const num = parseInt(gateway, 16);
          const ip = [
            num & 0xff,
            (num >> 8) & 0xff,
            (num >> 16) & 0xff,
            (num >> 24) & 0xff,
          ].join('.');
          return ip;
        }
      }
    }
  } catch (error) {
    // Silently fail if route table not accessible
  }
  
  return null;
};

// Initialize blocked IPs with gateway IP
const blockedSet = new Set(BLOCKED_IPS);
const gatewayIp = detectDockerGateway();
if (gatewayIp) {
  blockedSet.add(gatewayIp);
}

export function isMetricsAllowed(request: Request): boolean {
  // Get IP from headers
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  
  // Clean IP
  const cleanIp = ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
  
  // Block explicitly blocked IPs (including gateway)
  if (blockedSet.has(cleanIp)) {
    return false;
  }
  
  // Allow only Docker network IPs
  return ipRangeCheck(cleanIp, ALLOWED_CIDR);
}