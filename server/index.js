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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const server = http.createServer(app);
socketLib.init(server).then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize socket/redis', err);
    process.exit(1);
});
