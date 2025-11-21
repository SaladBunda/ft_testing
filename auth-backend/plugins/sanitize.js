const xss = require('xss');

module.exports = async function (fastify) {
    // Sanitize plugin to clean input data
    fastify.addHook('preValidation', async (request, reply) => {
        // Sanitize body parameters
        if (request.body) {
            sanitizeObject(request.body);
        }
        
        // Sanitize query parameters
        if (request.query) {
            sanitizeObject(request.query);
        }
        
        // Sanitize URL parameters
        if (request.params) {
            sanitizeObject(request.params);
        }
    });
    
    // Helper function to recursively sanitize object properties
    function sanitizeObject(obj) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'string') {
                    // Trim whitespace and strip HTML tags
                    obj[key] = xss(obj[key].trim());
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    // Recursively sanitize nested objects
                    sanitizeObject(obj[key]);
                }
            }
        }
    }
    
    // Add sanitize utility to fastify instance for manual use
    fastify.decorate('sanitize', {
        string: (input) => {
            if (typeof input === 'string') {
                return xss(input.trim());
            }
            return input;
        },
        object: sanitizeObject
    });
};
