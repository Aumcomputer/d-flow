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
    connectionLimit: 5,
    acquireTimeout: 15000,
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
    connectionLimit: 5,
    acquireTimeout: 15000,
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
    connectionLimit: 2,
    acquireTimeout: 15000,
    connectTimeout: 10000,
    socketTimeout: 30000,
    idleTimeout: 60,
    minimumIdle: 1
});

module.exports = {
    hisPool,
    dflowPool,
    smartorPool,
    getHisConnection: () => hisPool.getConnection(),
    getDflowConnection: () => dflowPool.getConnection(),
    getSmartorConnection: () => smartorPool.getConnection()
};
