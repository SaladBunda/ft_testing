import { client } from './registry';

client.register.setDefaultLabels({
    service: process.env.TARGET_1 || 'auth-backend',
});

export default metricsDependency;