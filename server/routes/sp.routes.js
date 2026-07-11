const express = require('express');
const { queryAll, queryOne, runQuery } = require('../db');

const router = express.Router();

// 1. Get all Products
router.get('/', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT id, ma_sp, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai
            FROM san_pham
            ORDER BY id ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching Products:', err);
        res.status(500).json({ error: 'Failed to fetch products list' });
    }
});

// 2. Get single Product
router.get('/:id', (req, res) => {
    try {
        const row = queryOne('SELECT * FROM san_pham WHERE id = ?', [req.params.id]);
        if (!row) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(row);
    } catch (err) {
        console.error('Error fetching single Product:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Create new Product
router.post('/', (req, res) => {
    try {
        const { ma_sp, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau } = req.body;

        if (!ten_sp) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        // Generate ma_sp if not provided
        let code = ma_sp;
        if (!code) {
            const countRes = queryOne('SELECT COUNT(*) as count FROM san_pham');
            const nextId = (countRes?.count || 0) + 1;
            code = `SP-${String(nextId).padStart(3, '0')}`;
        }

        // Check duplicate
        const exists = queryOne('SELECT id FROM san_pham WHERE ma_sp = ?', [code]);
        if (exists) {
            return res.status(400).json({ error: `Product code '${code}' already exists` });
        }

        const initialStock = parseFloat(ton_kho_ban_dau || 0);

        runQuery(
            `INSERT INTO san_pham (ma_sp, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, ten_sp, loai_xe || '', bo_phan || '', nguoi_phu_trach || '', ghi_chu || '', initialStock, initialStock]
        );

        const newSp = queryOne('SELECT * FROM san_pham WHERE ma_sp = ?', [code]);
        res.status(201).json(newSp);
    } catch (err) {
        console.error('Error creating Product:', err);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// 4. Update Product
router.put('/:id', (req, res) => {
    try {
        const { ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu } = req.body;
        const id = req.params.id;

        const exists = queryOne('SELECT id FROM san_pham WHERE id = ?', [id]);
        if (!exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!ten_sp) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        runQuery(
            `UPDATE san_pham
             SET ten_sp = ?, loai_xe = ?, bo_phan = ?, nguoi_phu_trach = ?, ghi_chu = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [ten_sp, loai_xe || '', bo_phan || '', nguoi_phu_trach || '', ghi_chu || '', id]
        );

        const updatedSp = queryOne('SELECT * FROM san_pham WHERE id = ?', [id]);
        res.json(updatedSp);
    } catch (err) {
        console.error('Error updating Product:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// 5. Delete Product
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;
        const exists = queryOne('SELECT id FROM san_pham WHERE id = ?', [id]);
        if (!exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        runQuery('DELETE FROM san_pham WHERE id = ?', [id]);
        res.json({ message: 'Deleted product successfully' });
    } catch (err) {
        console.error('Error deleting Product:', err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// 6. Get Product Transactions
router.get('/transactions/all', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT t.id, t.sp_id, s.ma_sp, s.ten_sp, s.bo_phan, t.type, t.quantity, t.date, t.reference, t.notes, u.display_name as creator_name, t.phieu_id
            FROM sp_transactions t
            JOIN san_pham s ON t.sp_id = s.id
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.date DESC, t.id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching product transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transaction logs' });
    }
});

// 7. Add Product Transaction (Inward/Outward)
router.post('/transactions', (req, res) => {
    try {
        const { sp_id, type, quantity, date, reference, notes } = req.body;

        if (!sp_id || !type || !quantity || !date) {
            return res.status(400).json({ error: 'Product ID, Type, Quantity, and Date are required' });
        }

        if (type !== 'IN' && type !== 'OUT') {
            return res.status(400).json({ error: "Type must be 'IN' or 'OUT'" });
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Quantity must be positive' });
        }

        const product = queryOne('SELECT ton_kho_hien_tai FROM san_pham WHERE id = ?', [sp_id]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (type === 'OUT' && product.ton_kho_hien_tai < qty) {
            return res.status(400).json({ error: `Insufficient inventory. Available: ${product.ton_kho_hien_tai}` });
        }

        // Insert transaction
        runQuery(
            `INSERT INTO sp_transactions (sp_id, type, quantity, date, reference, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sp_id, type, qty, date, reference || '', notes || '', req.user.id]
        );

        // Update inventory
        const newStock = type === 'IN'
            ? product.ton_kho_hien_tai + qty
            : product.ton_kho_hien_tai - qty;

        runQuery('UPDATE san_pham SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, sp_id]);

        res.status(201).json({ message: 'Product transaction logged successfully', newStock });
    } catch (err) {
        console.error('Error creating product transaction:', err);
        res.status(500).json({ error: 'Failed to complete transaction' });
    }
});

module.exports = router;
