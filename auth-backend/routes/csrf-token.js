async function csrfTokenRoutes(fastify, options) {
  fastify.get('/csrf-token', {
    schema: {
      description: 'Generate a new CSRF token for state-changing requests',
      tags: ['Security'],
      summary: 'Get CSRF Token',
      response: {
        200: {
          description: 'CSRF token generated successfully',
          type: 'object',
          properties: {
            csrfToken: {
              type: 'string',
              description: 'Cryptographically secure CSRF token (32-byte hex string)',
              example: 'da1a252075235f899c614a9f47e1f13600f37efb854da10051f426b16f22ab52'
            }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Failed to generate CSRF token'
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const token = fastify.generateCsrfToken();
      return { csrfToken: token };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate CSRF token' });
    }
  });
}

module.exports = csrfTokenRoutes;