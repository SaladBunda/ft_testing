import fp from 'fastify-plugin';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import promClient from 'prom-client';
import { register } from './metrics/registry.js';
import config from '../config.js';

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

export default fp(async function (fastify) {
    const dbPath = config.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';
    const serviceName = config.SERVICE_NAME || 'chat';
    
    // Create directory if it doesn't exist
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    let db;
    try {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
    } catch (err) {
        if (String(err && err.message).includes('file is not a database')) {
            try { fs.unlinkSync(dbPath); } catch (_) {}
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');
        } else {
            throw err;
        }
    }

    // Instrument better-sqlite3 prepare() method to wrap prepared statements
    const originalPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
        const stmt = originalPrepare(sql);
        const op = String(sql || '').trim().toLowerCase().split(' ')[0] || 'unknown';

        // Wrap the statement methods (get, all, run)
        const originalGet = stmt.get.bind(stmt);
        const originalAll = stmt.all.bind(stmt);
        const originalRun = stmt.run.bind(stmt);

        stmt.get = function(...args) {
            const labels = { service: serviceName, method: 'get', op };
            const start = process.hrtime.bigint();
            dbQueriesInFlight.inc(labels);
            dbQueriesTotal.inc(labels);

            try {
                const result = originalGet(...args);
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                return result;
            } catch (err) {
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                dbQueryErrors.inc(labels);
                throw err;
            }
        };

        stmt.all = function(...args) {
            const labels = { service: serviceName, method: 'all', op };
            const start = process.hrtime.bigint();
            dbQueriesInFlight.inc(labels);
            dbQueriesTotal.inc(labels);

            try {
                const result = originalAll(...args);
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                return result;
            } catch (err) {
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                dbQueryErrors.inc(labels);
                throw err;
            }
        };

        stmt.run = function(...args) {
            const labels = { service: serviceName, method: 'run', op };
            const start = process.hrtime.bigint();
            dbQueriesInFlight.inc(labels);
            dbQueriesTotal.inc(labels);

            try {
                const result = originalRun(...args);
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                return result;
            } catch (err) {
                const duration = Number(process.hrtime.bigint() - start) / 1e9;
                dbQueryDuration.observe(labels, duration);
                dbQueriesInFlight.dec(labels);
                dbQueryErrors.inc(labels);
                throw err;
            }
        };

        return stmt;
    };

    console.log('✅ Chat service connected to shared database with metrics');

    fastify.decorate('db', db);
    fastify.addHook('onClose', async () => db.close());
});

