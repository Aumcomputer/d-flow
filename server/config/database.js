const mariadb = require('mariadb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { recordSlowQuery, getSlowQueryConfig } = require('../services/slowQueryService');

/**
 * Execute query function with timing and slow query logging
 */
async function executeWithSlowLog(poolName, origFn, args) {
    const start = Date.now();
    try {
        const result = await origFn(...args);
        const duration = Date.now() - start;

        // Check if slow logging is enabled & exceeded threshold (non-blocking)
        getSlowQueryConfig().then(config => {
            if (config && config.enabled && duration >= config.threshold_ms) {
                const rawSql = typeof args[0] === 'string' ? args[0] : (args[0]?.sql || JSON.stringify(args[0]));
                const cleanSql = rawSql.replace(/\s+/g, ' ').trim();
                
                console.warn(`⚠️ [SLOW QUERY ${duration}ms] [${poolName}]: ${cleanSql.slice(0, 160)}...`);

                let rows = null;
                if (Array.isArray(result)) {
                    rows = result.length;
                } else if (result && result.affectedRows !== undefined) {
                    rows = result.affectedRows;
                }

                recordSlowQuery({
                    pool: poolName,
                    duration_ms: duration,
                    sql: cleanSql,
                    values: args[1] || null,
                    rows,
                    timestamp: new Date().toISOString()
                }).catch(() => {});
            }
        }).catch(() => {});

        return result;
    } catch (err) {
        throw err;
    }
}

/**
 * Wrap a MariaDB pool so that pool.query and all connection.query calls are intercepted
 */
function wrapPoolWithSlowQueryLogger(pool, poolName) {
    if (!pool || pool.__wrappedSlowLogger) return pool;
    pool.__wrappedSlowLogger = true;

    // 1. Wrap direct pool.query
    const origPoolQuery = pool.query.bind(pool);
    pool.query = function(...args) {
        return executeWithSlowLog(poolName, origPoolQuery, args);
    };

    // 2. Wrap pool.getConnection so connections returned have query intercepted
    const origGetConn = pool.getConnection.bind(pool);
    pool.getConnection = async function(...args) {
        const conn = await origGetConn(...args);
        if (!conn.__wrappedSlowLogger) {
            conn.__wrappedSlowLogger = true;
            const origConnQuery = conn.query.bind(conn);
            conn.query = function(...qArgs) {
                return executeWithSlowLog(poolName, origConnQuery, qArgs);
            };
        }
        return conn;
    };

    return pool;
}

const hisPool = wrapPoolWithSlowQueryLogger(mariadb.createPool({
    host: process.env.HIS_DB_HOST,
    user: process.env.HIS_DB_USER,
    password: process.env.HIS_DB_PASSWORD,
    database: process.env.HIS_DB_NAME,
    port: process.env.HIS_DB_PORT || 3306,
    charset: 'tis620', 
    initSql: "SET NAMES tis620",
    connectionLimit: 20,
    acquireTimeout: 30000,
    connectTimeout: 10000,
    socketTimeout: 30000,
    idleTimeout: 60,
    minimumIdle: 1
}), 'his');

const dflowPool = wrapPoolWithSlowQueryLogger(mariadb.createPool({
    host: process.env.DFLOW_DB_HOST,
    user: process.env.DFLOW_DB_USER,
    password: process.env.DFLOW_DB_PASSWORD,
    database: process.env.DFLOW_DB_NAME,
    port: process.env.DFLOW_DB_PORT || 3306,
    charset: 'utf8mb4',
    connectionLimit: 20,
    acquireTimeout: 30000,
    connectTimeout: 10000,
    socketTimeout: 30000,
    idleTimeout: 60,
    minimumIdle: 1
}), 'd-flow');

const smartorPool = wrapPoolWithSlowQueryLogger(mariadb.createPool({
    host: process.env.SMARTOR_DB_HOST,
    user: process.env.SMARTOR_DB_USER,
    password: process.env.SMARTOR_DB_PASSWORD,
    database: process.env.SMARTOR_DB_NAME,
    port: process.env.SMARTOR_DB_PORT || 3306,
    charset: 'tis620',
    connectionLimit: 5,
    acquireTimeout: 30000,
    connectTimeout: 10000,
    socketTimeout: 30000,
    idleTimeout: 60,
    minimumIdle: 1
}), 'smartor');

const teamcom3Pool = wrapPoolWithSlowQueryLogger(mariadb.createPool({
    host: process.env.DFLOW_DB_HOST || '10.10.10.17',
    user: process.env.DFLOW_DB_USER || 'd-flow',
    password: process.env.DFLOW_DB_PASSWORD,
    database: 'teamcom3_pis',
    port: Number(process.env.DFLOW_DB_PORT) || 3306,
    charset: 'utf8mb4',
    connectionLimit: 5,
    acquireTimeout: 30000,
    connectTimeout: 10000,
    socketTimeout: 30000,
    idleTimeout: 60,
    minimumIdle: 1
}), 'teamcom3');

let hisWritePool = null;

function getHisWritePool() {
    if (!hisWritePool) {
        if (!process.env.HIS_WRITE_DB_USER) {
            throw new Error('ยังไม่ได้กำหนด HIS_WRITE_DB_USER ใน .env (กรุณาระบุ Username และ Password สำหรับเขียนลงฐานข้อมูล HOSxP)');
        }
        hisWritePool = wrapPoolWithSlowQueryLogger(mariadb.createPool({
            host: process.env.HIS_WRITE_DB_HOST || process.env.HIS_DB_HOST,
            user: process.env.HIS_WRITE_DB_USER,
            password: process.env.HIS_WRITE_DB_PASSWORD,
            database: process.env.HIS_WRITE_DB_NAME || process.env.HIS_DB_NAME,
            port: Number(process.env.HIS_WRITE_DB_PORT || process.env.HIS_DB_PORT) || 3306,
            charset: 'tis620',
            initSql: "SET NAMES tis620",
            connectionLimit: 10,
            acquireTimeout: 30000,
            connectTimeout: 10000,
            socketTimeout: 30000,
            idleTimeout: 60,
            minimumIdle: 1
        }), 'his-write');
    }
    return hisWritePool;
}

module.exports = {
    hisPool,
    dflowPool,
    smartorPool,
    teamcom3Pool,
    getHisConnection: () => hisPool.getConnection(),
    getHisWriteConnection: () => getHisWritePool().getConnection(),
    getDflowConnection: () => dflowPool.getConnection(),
    getSmartorConnection: () => smartorPool.getConnection(),
    getTeamcom3Connection: () => teamcom3Pool.getConnection()
};
