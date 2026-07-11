const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, runQuery } = require('../db');

const router = express.Router();

// 1. Get all users with their permissions
router.get('/', (req, res) => {
    try {
        const users = queryAll(`
            SELECT id, username, email, display_name, role, is_active, created_at, updated_at
            FROM users
            ORDER BY id ASC
        `);
        
        for (const user of users) {
            const permissionsRes = queryAll('SELECT feature FROM permissions WHERE user_id = ?', [user.id]);
            user.permissions = permissionsRes.map(p => p.feature);
        }
        
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// 2. Create new user/employee
router.post('/', (req, res) => {
    try {
        const { username, email, password, display_name, role, is_active, permissions } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const usernameVal = username || email;

        // Check uniqueness of username and email
        const userExists = queryOne('SELECT id FROM users WHERE username = ?', [usernameVal]);
        if (userExists) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const emailExists = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (emailExists) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const isActiveVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;
        const roleVal = role || 'user';

        runQuery(
            `INSERT INTO users (username, email, password_hash, display_name, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [usernameVal, email, hash, display_name || '', roleVal, isActiveVal]
        );

        const newUser = queryOne('SELECT id, username, email, display_name, role, is_active FROM users WHERE username = ?', [usernameVal]);
        
        // Insert permissions
        if (Array.isArray(permissions)) {
            for (const feature of permissions) {
                runQuery('INSERT OR IGNORE INTO permissions (user_id, feature) VALUES (?, ?)', [newUser.id, feature]);
            }
        }

        newUser.permissions = Array.isArray(permissions) ? permissions : [];
        res.status(201).json(newUser);
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// 3. Update user
router.put('/:id', (req, res) => {
    try {
        const { email, display_name, role, is_active, permissions } = req.body;
        const id = req.params.id;

        const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if new email is taken by another user
        if (email && email !== user.email) {
            const emailExists = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
            if (emailExists) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        const isActiveVal = is_active !== undefined ? (is_active ? 1 : 0) : user.is_active;
        const roleVal = role || user.role;

        runQuery(
            `UPDATE users 
             SET username = ?, email = ?, display_name = ?, role = ?, is_active = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [email || user.email, email || user.email, display_name !== undefined ? display_name : user.display_name, roleVal, isActiveVal, id]
        );

        // Update permissions
        runQuery('DELETE FROM permissions WHERE user_id = ?', [id]);
        if (Array.isArray(permissions)) {
            for (const feature of permissions) {
                runQuery('INSERT OR IGNORE INTO permissions (user_id, feature) VALUES (?, ?)', [id, feature]);
            }
        }

        const updatedUser = queryOne('SELECT id, username, email, display_name, role, is_active FROM users WHERE id = ?', [id]);
        updatedUser.permissions = Array.isArray(permissions) ? permissions : [];
        res.json(updatedUser);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// 4. Change user password
router.put('/:id/password', (req, res) => {
    try {
        const { password } = req.body;
        const id = req.params.id;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = queryOne('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hash = bcrypt.hashSync(password, 10);
        runQuery('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, id]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error changing user password:', err);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// 5. Delete user
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const user = queryOne('SELECT id, username, role FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is the last admin
        if (user.role === 'admin') {
            const adminCountRes = queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1");
            if (adminCountRes?.count <= 1) {
                return res.status(400).json({ error: 'Cannot delete the only active admin account' });
            }
        }

        runQuery('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: `User '${user.username}' deleted successfully` });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
