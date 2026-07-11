const express = require('express');
const cors = require('cors');
const { requireAuth, requireAdmin } = require('./auth');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3102;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', (req, res, next) => {
    if (req.path === '/login' && req.method === 'POST') {
        return next();
    }
    requireAuth(req, res, next);
}, authRoutes);

// NVL routes
const nvlRoutes = require('./routes/nvl.routes');
app.use('/api/nvl', requireAuth, nvlRoutes);

// San Pham routes
const spRoutes = require('./routes/sp.routes');
app.use('/api/san-pham', requireAuth, spRoutes);

// Dinh Muc & Tinh Toan routes
const dinhMucRoutes = require('./routes/dinh_muc.routes');
app.use('/api/dinh-muc', requireAuth, dinhMucRoutes);

// Users routes (Admin only)
const userRoutes = require('./routes/users.routes');
app.use('/api/users', requireAuth, requireAdmin, userRoutes);

// API 404
app.all('/api/{*splat}', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════╗
║   Anh Trung Autoparts - Inventory Server     ║
║   🚀 Running on http://localhost:${PORT}        ║
║   🗄️  Database: ./data/app.db               ║
║                                              ║
║   Default admin: admin / admin123            ║
╚══════════════════════════════════════════════╝
            `);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();

module.exports = app; // trigger watch reload 2
