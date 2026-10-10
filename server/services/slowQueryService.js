const { getRedisClient } = require('../lib/redis');

const SLOW_QUERY_CONFIG_KEY = 'dflow:slow_query:config';
const SLOW_QUERY_LIST_KEY = 'dflow:slow_queries:list';
const DEFAULT_TTL_SECONDS = 72 * 60 * 60; // 72 hours = 259,200 seconds
const MAX_LOG_ENTRIES = 1000;

// Local in-memory cache of config to avoid querying Redis on every single DB query
let inMemoryConfig = {
    enabled: true,
    threshold_ms: 1000
};
let lastConfigSync = 0;

/**
 * Get current Slow Query configuration (cached with 5-second in-memory refresh)
 */
async function getSlowQueryConfig(forceSync = false) {
    const now = Date.now();
    if (!forceSync && now - lastConfigSync < 5000) {
        return inMemoryConfig;
    }

    try {
        const redis = getRedisClient();
        const raw = await redis.get(SLOW_QUERY_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            inMemoryConfig = {
                enabled: parsed.enabled !== false,
                threshold_ms: Number(parsed.threshold_ms) || 1000
            };
        } else {
            // First time: write default into Redis with 72h TTL
            await redis.set(SLOW_QUERY_CONFIG_KEY, JSON.stringify(inMemoryConfig));
        }
        lastConfigSync = now;
    } catch (err) {
        // Fallback to in-memory config if Redis is not yet connected
    }

    return inMemoryConfig;
}

/**
 * Save new configuration (Enable/Disable, Threshold in ms)
 */
async function updateSlowQueryConfig({ enabled, threshold_ms }) {
    inMemoryConfig = {
        enabled: enabled !== false,
        threshold_ms: Math.max(10, Number(threshold_ms) || 1000)
    };
    lastConfigSync = Date.now();

    try {
        const redis = getRedisClient();
        await redis.set(SLOW_QUERY_CONFIG_KEY, JSON.stringify(inMemoryConfig));
    } catch (err) {
        console.error('[SlowQueryService] Failed to save config to Redis:', err.message);
    }

    return inMemoryConfig;
}

/**
 * Record a slow query into Redis list with 72h TTL
 */
async function recordSlowQuery(entry) {
    try {
        const redis = getRedisClient();
        const payload = JSON.stringify({
            id: entry.id || `sq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            pool: entry.pool || 'unknown',
            duration_ms: entry.duration_ms,
            sql: String(entry.sql || '').trim(),
            values: entry.values ? (Array.isArray(entry.values) ? entry.values.slice(0, 30) : entry.values) : null,
            rows: entry.rows ?? null,
            timestamp: entry.timestamp || new Date().toISOString()
        });

        // Push to Redis List (newest first)
        await redis.lPush(SLOW_QUERY_LIST_KEY, payload);
        // Keep at most MAX_LOG_ENTRIES
        await redis.lTrim(SLOW_QUERY_LIST_KEY, 0, MAX_LOG_ENTRIES - 1);
        // Set/refresh 72 hours TTL
        await redis.expire(SLOW_QUERY_LIST_KEY, DEFAULT_TTL_SECONDS);
    } catch (err) {
        // Non-blocking: fail quietly if Redis is down
    }
}

/**
 * Get paginated list of slow query logs and summary statistics
 */
async function getSlowQueryLogs({ page = 1, limit = 50, pool = null, search = null } = {}) {
    try {
        const redis = getRedisClient();
        // Fetch up to MAX_LOG_ENTRIES from Redis
        const rawList = await redis.lRange(SLOW_QUERY_LIST_KEY, 0, MAX_LOG_ENTRIES - 1);

        const allLogs = (rawList || []).map(item => {
            try { return JSON.parse(item); } catch (e) { return null; }
        }).filter(Boolean);

        let filteredLogs = allLogs;

        // Filter by database pool
        if (pool && pool !== 'all') {
            filteredLogs = filteredLogs.filter(l => l.pool === pool);
        }

        // Filter by SQL text or pool name
        if (search && String(search).trim()) {
            const term = String(search).trim().toLowerCase();
            filteredLogs = filteredLogs.filter(l =>
                (l.sql && l.sql.toLowerCase().includes(term)) ||
                (l.pool && l.pool.toLowerCase().includes(term))
            );
        }

        const total = filteredLogs.length;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 50);
        const startIndex = (pageNum - 1) * pageSize;
        const pagedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

        // Calculate summary stats across all logs
        const stats = {
            total_logs: allLogs.length,
            max_duration: allLogs.reduce((max, l) => Math.max(max, l.duration_ms || 0), 0),
            avg_duration: allLogs.length > 0
                ? Math.round(allLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / allLogs.length)
                : 0,
            pool_counts: allLogs.reduce((acc, l) => {
                acc[l.pool] = (acc[l.pool] || 0) + 1;
                return acc;
            }, {})
        };

        return {
            logs: pagedLogs,
            pagination: {
                page: pageNum,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 1
            },
            stats
        };
    } catch (err) {
        console.error('[SlowQueryService] Failed to get logs from Redis:', err.message);
        return {
            logs: [],
            pagination: { page: 1, limit, total: 0, totalPages: 1 },
            stats: { total_logs: 0, max_duration: 0, avg_duration: 0, pool_counts: {} }
        };
    }
}

/**
 * Clear all slow query logs in Redis
 */
async function clearSlowQueryLogs() {
    try {
        const redis = getRedisClient();
        await redis.del(SLOW_QUERY_LIST_KEY);
        return true;
    } catch (err) {
        console.error('[SlowQueryService] Failed to clear logs from Redis:', err.message);
        return false;
    }
}

module.exports = {
    getSlowQueryConfig,
    updateSlowQueryConfig,
    recordSlowQuery,
    getSlowQueryLogs,
    clearSlowQueryLogs
};
