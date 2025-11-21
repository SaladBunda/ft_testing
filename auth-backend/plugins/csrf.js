const fp = require('fastify-plugin');

async function csrfPlugin(fastify) {
  
  //! Store for CSRF tokens (in production, use Redis or database) === TO BE ADDED
  const csrfTokens = new Map();
  
  // Generate CSRF token
  fastify.decorate('generateCsrfToken', () => {
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    csrfTokens.set(token, expiresAt);
    return token;
  });
  
  // Validate CSRF token
  fastify.decorate('validateCsrfToken', (token) => {
    const expiresAt = csrfTokens.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      csrfTokens.delete(token);
      return false;
    }
    return true;
  });
  
  // Clean up expired tokens periodically
  setInterval(() => {
    const now = Date.now();
    for (const [token, expiresAt] of csrfTokens.entries()) {
      if (now > expiresAt) {
        csrfTokens.delete(token);
      }
    }
  }, 60 * 60 * 1000); // Clean up every hour

  // Add global CSRF protection for all POST/PUT/DELETE requests
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip CSRF check for GET requests, CSRF token endpoint, and auth endpoints
    if (request.method === 'GET' || 
        request.url === '/api/csrf-token' ||
        request.url.startsWith('/api/auth/')
        || request.url.startsWith('/api/auth/service-auth/')) {
      return;
    }

    // Check for CSRF token in headers or body
    const csrfToken = request.headers['x-csrf-token'] || request.body?._csrf;
    
    if (!csrfToken || !fastify.validateCsrfToken(csrfToken)) {
      return reply.code(403).send({ error: 'Invalid or missing CSRF token' });
    }
  });
}

module.exports = fp(csrfPlugin);
