const { getRedisClient } = require('./redis');
const { getHisConnection } = require('../config/database');

/**
 * Get staff name by loginname with Redis caching
 * @param {string} loginname 
 * @returns {Promise<string|null>}
 */
async function getNameByLoginname(loginname) {
    if (!loginname) return null;
    const names = await getNamesByLoginnames([loginname]);
    return names[loginname] || null;
}

/**
 * Get multiple staff names by loginnames with Redis caching
 * @param {string[]} loginnames 
 * @returns {Promise<Object>} Map of { [loginname]: name }
 */
async function getNamesByLoginnames(loginnames) {
    if (!Array.isArray(loginnames) || loginnames.length === 0) return {};
    const uniqueLoginnames = [...new Set(loginnames.filter(Boolean))];
    if (uniqueLoginnames.length === 0) return {};

    const userMap = {};
    const missingNames = [];

    let redis;
    try {
        redis = getRedisClient();
        const keys = uniqueLoginnames.map(u => `user:name:${u}`);
        const cachedNames = await redis.mGet(keys);
        uniqueLoginnames.forEach((u, index) => {
            if (cachedNames[index]) {
                userMap[u] = cachedNames[index];
            } else {
                missingNames.push(u);
            }
        });
    } catch (err) {
        console.error('Redis MGET Error in userService:', err);
        missingNames.push(...uniqueLoginnames);
    }

    if (missingNames.length > 0) {
        let hisConn;
        try {
            hisConn = await getHisConnection();
            const placeholders = missingNames.map(() => '?').join(',');
            const users = await hisConn.query(
                `SELECT loginname, name FROM opduser WHERE loginname IN (${placeholders})`,
                missingNames
            );

            users.forEach(u => {
                userMap[u.loginname] = u.name;
            });

            if (redis && users.length > 0) {
                try {
                    const multi = redis.multi();
                    users.forEach(u => {
                        multi.setEx(`user:name:${u.loginname}`, 604800, u.name); // 7 days TTL
                    });
                    await multi.exec();
                } catch (err) {
                    console.error('Redis SETEX Error in userService:', err);
                }
            }
        } catch (err) {
            console.error('Fetch opduser error in userService:', err);
        } finally {
            if (hisConn) hisConn.release();
        }
    }

    return userMap;
}

module.exports = {
    getNameByLoginname,
    getNamesByLoginnames
};
