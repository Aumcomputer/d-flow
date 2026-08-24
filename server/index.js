const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const socketLib = require('./lib/socket');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const documentRoutes = require('./routes/documents');
const wardRoutes = require('./routes/wards');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Static file serving for /documents folder
const getUploadBaseDir = () => {
    return process.env.UPLOAD_DIR 
        ? path.resolve(__dirname, '..', process.env.UPLOAD_DIR)
        : path.join(__dirname, 'documents');
};
app.use('/documents', express.static(getUploadBaseDir()));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/workflow', require('./routes/workflow'));

// System routes
app.post('/api/system/force-refresh', (req, res) => {
    try {
        const { getIO } = require('./lib/socket');
        getIO().emit('system:force_refresh');
        res.json({ success: true, message: 'Refresh signal sent to all clients' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const server = http.createServer(app);
const redisLib = require('./lib/redis');

const { getDflowConnection } = require('./config/database');
async function migrateDB() {
    let conn;
    try {
        conn = await getDflowConnection();
        try {
            await conn.query(`
                ALTER TABLE an_detail 
                ADD COLUMN chk_hm INT DEFAULT NULL, 
                ADD COLUMN chk_returnmed INT DEFAULT NULL, 
                ADD COLUMN phar_chk_hm VARCHAR(50) DEFAULT NULL, 
                ADD COLUMN phar_chk_returnmed VARCHAR(50) DEFAULT NULL, 
                ADD COLUMN phar_chk_hm_date DATETIME DEFAULT NULL, 
                ADD COLUMN phar_chk_returnmed_date DATETIME DEFAULT NULL
            `);
            console.log('Database migrated: added HM and return_med columns');
        } catch (e) {
            // Ignore duplicate column errors (already migrated)
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        }
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        if (conn) conn.release();
    }
}

redisLib.initRedis().then(() => {
    return socketLib.init(server);
}).then(() => migrateDB()).then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize socket/redis', err);
    process.exit(1);
});
