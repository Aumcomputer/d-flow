const mariadb = require('mariadb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const hisPool = mariadb.createPool({
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
});

const dflowPool = mariadb.createPool({
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
});

const smartorPool = mariadb.createPool({
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
});

const teamcom3Pool = mariadb.createPool({
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
});

let hisWritePool = null;

function getHisWritePool() {
    if (!hisWritePool) {
        if (!process.env.HIS_WRITE_DB_USER) {
            throw new Error('ยังไม่ได้กำหนด HIS_WRITE_DB_USER ใน .env (กรุณาระบุ Username และ Password สำหรับเขียนลงฐานข้อมูล HOSxP)');
        }
        hisWritePool = mariadb.createPool({
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
        });
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
