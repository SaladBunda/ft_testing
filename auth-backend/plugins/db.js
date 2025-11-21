const fp = require('fastify-plugin');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const promClient = require('prom-client');

const register = promClient.register;
const dbQueryDuration = register.getSingleMetric('db_query_duration_seconds') || new promClient.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['service', 'method', 'op'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});
const dbQueriesTotal = register.getSingleMetric('db_queries_total') || new promClient.Counter({
    name: 'db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['service', 'method', 'op'],
});
const dbQueryErrors = register.getSingleMetric('db_query_errors_total') || new promClient.Counter({
    name: 'db_query_errors_total',
    help: 'Total number of database query errors',
    labelNames: ['service', 'method', 'op'],
});
const dbQueriesInFlight = register.getSingleMetric('db_queries_in_flight') || new promClient.Gauge({
    name: 'db_queries_in_flight',
    help: 'Current number of in-flight database operations',
    labelNames: ['service', 'method', 'op'],
});

module.exports = fp(async function (fastify) {
    const config = require('../config');
    const dbPath = process.env.DB_FILE || path.join(__dirname, '..', 'db', 'sqlite.db');
    const serviceName = config.SERVICE_NAME || 'auth-backend';
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    let db;
    try {
        db = new sqlite3.Database(dbPath);
        db.run('PRAGMA journal_mode = WAL');
    } catch (err) {
        if (String(err && err.message).includes('file is not a database')) {
            try { fs.unlinkSync(dbPath); } catch (_) {}
            db = new sqlite3.Database(dbPath);
            db.run('PRAGMA journal_mode = WAL');
        } else {
            throw err;
        }
    }

    // Instrument selected sqlite3 methods
    ['get', 'all', 'run'].forEach((methodName) => {
        const original = db[methodName].bind(db);
        db[methodName] = (...args) => {
            const sql = args[0];
            const op = String(sql || '').trim().toLowerCase().split(' ')[0] || methodName;
            const labels = { service: serviceName, method: methodName, op };
            const start = process.hrtime.bigint();

            dbQueriesInFlight.inc(labels);
            dbQueriesTotal.inc(labels);

            const finalize = (err) => {
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                if (err) dbQueryErrors.inc(labels);
            };

            const lastArg = args[args.length - 1];
            const hasCallback = typeof lastArg === 'function';

            if (hasCallback) {
                const userCb = lastArg;
                args[args.length - 1] = function wrappedCallback(err, ...results) {
                    finalize(err);
                    return userCb.apply(this, [err, ...results]);
                };
                try {
                    return original(...args);
                } catch (err) {
                    finalize(err);
                    throw err;
                }
            } else {
                try {
                    const result = original(...args);
                    // sqlite3 without callback schedules work; we approximate completion
                    process.nextTick(() => finalize(null));
                    return result;
                } catch (err) {
                    finalize(err);
                    throw err;
                }
            }
        };
    });

    console.log('✅ Auth service connected to shared database');

    fastify.decorate('db', db);
    fastify.addHook('onClose', async () => db.close());
});