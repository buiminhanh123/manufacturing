const express = require('express');
const { queryAll, queryOne, runQuery } = require('../db');

const router = express.Router();

// 1. Get all tickets
router.get('/', (req, res) => {
    try {
        const { type_prefix } = req.query; // 'NVL' or 'SP'
        let sql = `
            SELECT p.id, p.ma_phieu, p.type, p.date, p.notes, u.display_name as creator_name, p.created_at
            FROM phieu p
            LEFT JOIN users u ON p.created_by = u.id
        `;
        let params = [];
        if (type_prefix) {
            sql += ` WHERE p.type LIKE ?`;
            params.push(`%_${type_prefix}`);
        }
        sql += ` ORDER BY p.date DESC, p.id DESC`;
        
        const rows = queryAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching tickets:', err);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// 2. Get ticket details with items
router.get('/:id', (req, res) => {
    try {
        const id = req.params.id;
        const ticket = queryOne(`
            SELECT p.id, p.ma_phieu, p.type, p.date, p.notes, u.display_name as creator_name, p.created_at
            FROM phieu p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = ?
        `, [id]);

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        let items = [];
        if (ticket.type.endsWith('_NVL')) {
            items = queryAll(`
                SELECT t.id, t.nvl_id, n.ma_nvl, n.ten_nvl, n.dvt, t.quantity, t.notes
                FROM nvl_transactions t
                JOIN nvl n ON t.nvl_id = n.id
                WHERE t.phieu_id = ?
            `, [id]);
        } else if (ticket.type.endsWith('_SP')) {
            items = queryAll(`
                SELECT t.id, t.sp_id, s.ma_sp, s.ten_sp, s.loai_xe, s.bo_phan, t.quantity, t.notes
                FROM sp_transactions t
                JOIN san_pham s ON t.sp_id = s.id
                WHERE t.phieu_id = ?
            `, [id]);
        }

        res.json({ ...ticket, items });
    } catch (err) {
        console.error('Error fetching ticket details:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Create a ticket (with multiple items)
router.post('/', (req, res) => {
    try {
        const { type, date, notes, items } = req.body;

        if (!type || !date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Type, Date and non-empty Items list are required' });
        }

        // Validate type
        if (!['IN_NVL', 'OUT_NVL', 'IN_SP', 'OUT_SP'].includes(type)) {
            return res.status(400).json({ error: 'Invalid ticket type' });
        }

        // Pre-validate all items quantities and check stock for OUT types
        for (const item of items) {
            const qty = parseFloat(item.quantity);
            if (isNaN(qty) || qty <= 0) {
                return res.status(400).json({ error: 'Quantity must be a positive number' });
            }

            if (type.endsWith('_NVL')) {
                if (!item.nvl_id) {
                    return res.status(400).json({ error: 'Material ID (nvl_id) is required for each item' });
                }
                const material = queryOne('SELECT ten_nvl, ton_kho_hien_tai FROM nvl WHERE id = ?', [item.nvl_id]);
                if (!material) {
                    return res.status(404).json({ error: `Material with ID ${item.nvl_id} not found` });
                }
                if (type.startsWith('OUT_') && material.ton_kho_hien_tai < qty) {
                    return res.status(400).json({ error: `Insufficient inventory for material '${material.ten_nvl}'. Available: ${material.ton_kho_hien_tai}` });
                }
            } else if (type.endsWith('_SP')) {
                if (!item.sp_id) {
                    return res.status(400).json({ error: 'Product ID (sp_id) is required for each item' });
                }
                const product = queryOne('SELECT ten_sp, ton_kho_hien_tai FROM san_pham WHERE id = ?', [item.sp_id]);
                if (!product) {
                    return res.status(404).json({ error: `Product with ID ${item.sp_id} not found` });
                }
                if (type.startsWith('OUT_') && product.ton_kho_hien_tai < qty) {
                    return res.status(400).json({ error: `Insufficient inventory for product '${product.ten_sp}'. Available: ${product.ton_kho_hien_tai}` });
                }
            }
        }

        // Generate ma_phieu
        // Prefix mappings
        const prefixMap = {
            'IN_NVL': 'PN-NVL-',
            'OUT_NVL': 'PX-NVL-',
            'IN_SP': 'PN-SP-',
            'OUT_SP': 'PX-SP-',
        };
        const prefix = prefixMap[type];

        // Format date string for the code (YYMMDD)
        const dateClean = date.replace(/-/g, '').slice(2); // '2026-07-11' -> '260711'
        const fullPrefix = `${prefix}${dateClean}-`; // e.g. PN-NVL-260711-

        // Search count for that prefix today
        const countRes = queryOne("SELECT COUNT(*) as count FROM phieu WHERE ma_phieu LIKE ?", [`${fullPrefix}%`]);
        const nextNum = (countRes?.count || 0) + 1;
        const ma_phieu = `${fullPrefix}${String(nextNum).padStart(3, '0')}`;

        // Insert ticket
        runQuery(
            `INSERT INTO phieu (ma_phieu, type, date, notes, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [ma_phieu, type, date, notes || '', req.user.id]
        );

        const newPhieu = queryOne('SELECT id FROM phieu WHERE ma_phieu = ?', [ma_phieu]);
        const phieu_id = newPhieu.id;

        // Process items
        for (const item of items) {
            const qty = parseFloat(item.quantity);

            if (type.endsWith('_NVL')) {
                // Insert transaction log
                const tType = type.startsWith('IN_') ? 'IN' : 'OUT';
                runQuery(
                    `INSERT INTO nvl_transactions (nvl_id, type, quantity, date, reference, notes, created_by, phieu_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.nvl_id, tType, qty, date, ma_phieu, item.notes || '', req.user.id, phieu_id]
                );

                // Update stock in nvl table
                const material = queryOne('SELECT ton_kho_hien_tai FROM nvl WHERE id = ?', [item.nvl_id]);
                const newStock = tType === 'IN' 
                    ? material.ton_kho_hien_tai + qty 
                    : material.ton_kho_hien_tai - qty;
                runQuery('UPDATE nvl SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, item.nvl_id]);

            } else if (type.endsWith('_SP')) {
                // Insert transaction log
                const tType = type.startsWith('IN_') ? 'IN' : 'OUT';
                runQuery(
                    `INSERT INTO sp_transactions (sp_id, type, quantity, date, reference, notes, created_by, phieu_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.sp_id, tType, qty, date, ma_phieu, item.notes || '', req.user.id, phieu_id]
                );

                // Update stock in san_pham table
                const product = queryOne('SELECT ton_kho_hien_tai FROM san_pham WHERE id = ?', [item.sp_id]);
                const newStock = tType === 'IN'
                    ? product.ton_kho_hien_tai + qty
                    : product.ton_kho_hien_tai - qty;
                runQuery('UPDATE san_pham SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, item.sp_id]);
            }
        }

        res.status(201).json({ id: phieu_id, ma_phieu, message: 'Ticket created and inventory updated successfully' });
    } catch (err) {
        console.error('Error creating ticket:', err);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// 4. Delete a ticket
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;
        const ticket = queryOne('SELECT * FROM phieu WHERE id = ?', [id]);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const type = ticket.type;

        // Revert inventory and delete transactions
        if (type.endsWith('_NVL')) {
            const txs = queryAll('SELECT id, nvl_id, type, quantity FROM nvl_transactions WHERE phieu_id = ?', [id]);
            for (const tx of txs) {
                const material = queryOne('SELECT ton_kho_hien_tai FROM nvl WHERE id = ?', [tx.nvl_id]);
                if (material) {
                    // Revert stock: subtract if IN, add if OUT
                    const newStock = tx.type === 'IN' 
                        ? material.ton_kho_hien_tai - tx.quantity 
                        : material.ton_kho_hien_tai + tx.quantity;
                    runQuery('UPDATE nvl SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, tx.nvl_id]);
                }
            }
            // Delete nvl transactions
            runQuery('DELETE FROM nvl_transactions WHERE phieu_id = ?', [id]);

        } else if (type.endsWith('_SP')) {
            const txs = queryAll('SELECT id, sp_id, type, quantity FROM sp_transactions WHERE phieu_id = ?', [id]);
            for (const tx of txs) {
                const product = queryOne('SELECT ton_kho_hien_tai FROM san_pham WHERE id = ?', [tx.sp_id]);
                if (product) {
                    const newStock = tx.type === 'IN'
                        ? product.ton_kho_hien_tai - tx.quantity
                        : product.ton_kho_hien_tai + tx.quantity;
                    runQuery('UPDATE san_pham SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, tx.sp_id]);
                }
            }
            // Delete sp transactions
            runQuery('DELETE FROM sp_transactions WHERE phieu_id = ?', [id]);
        }

        // Delete ticket itself
        runQuery('DELETE FROM phieu WHERE id = ?', [id]);

        res.json({ message: 'Ticket deleted and inventory reverted successfully' });
    } catch (err) {
        console.error('Error deleting ticket:', err);
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});

module.exports = router;
