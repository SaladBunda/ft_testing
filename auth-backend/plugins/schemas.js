const fp = require('fastify-plugin');

module.exports = fp(async function (fastify) {
  fastify.addSchema({
    $id: 'User',
    type: 'object',
    required: ['id', 'email'],
    properties: {
      id: { type: 'integer' },
      email: { type: 'string', format: 'email' }
    }
  });

  fastify.addSchema({
    $id: 'AuthRegisterBody',
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', minLength: 3, maxLength: 255 },
      password: { type: 'string', minLength: 12, maxLength: 128 }
    }
  });

  fastify.addSchema({
    $id: 'AuthLoginBody',
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 12, maxLength: 128 }
    }
  });
  
  fastify.addSchema({
    $id: 'LockoutError',
    type: 'object',
    required: ['error'],
    properties: {
      error: { type: 'string' },
      lockedUntil: { type: 'number' },
      remainingAttempts: { type: 'number' },
    }
  });
  
  fastify.addSchema({
    $id: 'AuthError',
    type: 'object',
    required: ['error'],
    properties: {
      error: { type: 'string' },
      remainingAttempts: { type: 'number' },
    }
  });

  // 2FA schemas
  fastify.addSchema({
    $id: 'TwoFATokenBody',
    type: 'object',
    required: ['token'],
    additionalProperties: false,
    properties: {
      token: { type: 'string', minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$' }
    }
  });

  fastify.addSchema({
    $id: 'TwoFADisableBody',
    type: 'object',
    required: ['password'],
    additionalProperties: false,
    properties: {
      password: { type: 'string', minLength: 12, maxLength: 128 }
    }
  });

  // OAuth schemas
  fastify.addSchema({
    $id: 'OAuthCallbackQuery',
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Authorization code from Google' },
      state: { type: 'string', description: 'CSRF state parameter' },
      error: { type: 'string', description: 'OAuth error if user denied access' }
    }
  });

  fastify.addSchema({
    $id: 'OAuthError',
    type: 'object',
    required: ['error'],
    properties: {
      error: { type: 'string', description: 'OAuth error message' }
    }
  });
});
