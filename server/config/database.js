const mariadb = require('mariadb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const hisPool = mariadb.createPool({
    host: process.env.HIS_DB_HOST,
    user: process.env.HIS_DB_USER,
    password: process.env.HIS_DB_PASSWORD,
    database: process.env.HIS_DB_NAME,
    port: process.env.HIS_DB_PORT || 3306,
    charset: 'utf8', 
    connectionLimit: 10
});

const dflowPool = mariadb.createPool({
    host: process.env.DFLOW_DB_HOST,
    user: process.env.DFLOW_DB_USER,
    password: process.env.DFLOW_DB_PASSWORD,
    database: process.env.DFLOW_DB_NAME,
    port: process.env.DFLOW_DB_PORT || 3306,
    charset: 'utf8mb4',
    connectionLimit: 10
});

const smartorPool = mariadb.createPool({
    host: process.env.SMARTOR_DB_HOST,
    user: process.env.SMARTOR_DB_USER,
    password: process.env.SMARTOR_DB_PASSWORD,
    database: process.env.SMARTOR_DB_NAME,
    port: process.env.SMARTOR_DB_PORT || 3306,
    charset: 'tis620',
    connectionLimit: 10
});

module.exports = {
    hisPool,
    dflowPool,
    smartorPool,
    getHisConnection: () => hisPool.getConnection(),
    getDflowConnection: () => dflowPool.getConnection(),
    getSmartorConnection: () => smartorPool.getConnection()
};
