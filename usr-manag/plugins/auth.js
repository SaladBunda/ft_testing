const fp = require('fastify-plugin');
const { validateToken } = require('../utils/validateToken');

module.exports = fp(async function authPlugin(fastify) {
    fastify.decorate('authenticate', function (request, reply, done) {
        const token = request.cookies?.accessToken ||
            request.headers?.authorization?.replace('Bearer ', '');

        // Optional: debug
        // console.log('Token:', token);

        const result = validateToken(token);
        if (!result.valid) {
            reply.code(401).send({ error: result.error });
            return;
        }

        request.user = {
            id: result.userId,
            type: result.type,
        };
        done();
    });

    console.log('Auth plugin: authenticate function decorated');
});