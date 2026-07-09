const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'anh-trung-inventory-secret-key';
const JWT_EXPIRES_IN = '7d';

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            display_name: user.display_name,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function checkPermission(feature) {
    return (req, res, next) => {
        if (req.user.role === 'admin') {
            return next();
        }

        const { permissionQueries } = require('./db');
        const hasPermission = permissionQueries.hasPermission(req.user.id, feature);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        next();
    };
}

module.exports = {
    generateToken,
    requireAuth,
    requireAdmin,
    checkPermission,
    JWT_SECRET,
};
