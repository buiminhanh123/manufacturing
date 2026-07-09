const express = require('express');
const { queryAll, queryOne, runQuery } = require('../db');

const router = express.Router();



// 2. Add or Update BOM entry
router.post('/', (req, res) => {
    try {
        const { sp_id, nvl_id, so_luong, ty_le_hao_hut, ghi_chu } = req.body;

        if (!sp_id || !nvl_id || so_luong === undefined) {
            return res.status(400).json({ error: 'Product ID, Material ID, and Quantity are required' });
        }

        const qty = parseFloat(so_luong);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive number' });
        }

        const lossRate = parseFloat(ty_le_hao_hut !== undefined ? ty_le_hao_hut : 0);
        if (isNaN(lossRate) || lossRate < 0) {
            return res.status(400).json({ error: 'Loss rate must be a non-negative number' });
        }

        // Check if product and material exist
        const spExists = queryOne('SELECT id FROM san_pham WHERE id = ?', [sp_id]);
        const nvlExists = queryOne('SELECT id FROM nvl WHERE id = ?', [nvl_id]);

        if (!spExists || !nvlExists) {
            return res.status(400).json({ error: 'Invalid Product ID or Material ID' });
        }

        // Check if relationship already exists
        const existing = queryOne('SELECT id FROM dinh_muc WHERE sp_id = ? AND nvl_id = ?', [sp_id, nvl_id]);

        if (existing) {
            runQuery(
                `UPDATE dinh_muc 
                 SET so_luong = ?, ty_le_hao_hut = ?, ghi_chu = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [qty, lossRate, ghi_chu || '', existing.id]
            );
            res.json({ message: 'BOM updated successfully' });
        } else {
            runQuery(
                `INSERT INTO dinh_muc (sp_id, nvl_id, so_luong, ty_le_hao_hut, ghi_chu)
                 VALUES (?, ?, ?, ?, ?)`,
                [sp_id, nvl_id, qty, lossRate, ghi_chu || '']
            );
            res.status(201).json({ message: 'BOM entry created successfully' });
        }
    } catch (err) {
        console.error('Error saving BOM:', err);
        res.status(500).json({ error: 'Failed to save BOM details' });
    }
});

// 3. Delete BOM entry
router.delete('/:id', (req, res) => {
    try {
        const exists = queryOne('SELECT id FROM dinh_muc WHERE id = ?', [req.params.id]);
        if (!exists) {
            return res.status(404).json({ error: 'BOM entry not found' });
        }

        runQuery('DELETE FROM dinh_muc WHERE id = ?', [req.params.id]);
        res.json({ message: 'BOM entry deleted successfully' });
    } catch (err) {
        console.error('Error deleting BOM entry:', err);
        res.status(500).json({ error: 'Failed to delete BOM entry' });
    }
});

// 4. Calculate required materials for production order
router.post('/tinh-toan', (req, res) => {
    try {
        const { productionItems } = req.body; // Array of { sp_id, quantity }

        if (!productionItems || !Array.isArray(productionItems) || productionItems.length === 0) {
            return res.status(400).json({ error: 'List of production items is required' });
        }

        // Retrieve all BOM records for the specified products
        const spIds = productionItems.map(item => parseInt(item.sp_id)).filter(id => !isNaN(id));
        if (spIds.length === 0) {
            return res.status(400).json({ error: 'Invalid product IDs provided' });
        }

        const placeholders = spIds.map(() => '?').join(',');
        const bomRows = queryAll(`
            SELECT d.sp_id, d.nvl_id, n.ma_nvl, n.ten_nvl, n.quy_cach, n.dvt, n.ton_kho_hien_tai, d.so_luong, d.ty_le_hao_hut
            FROM dinh_muc d
            JOIN nvl n ON d.nvl_id = n.id
            WHERE d.sp_id IN (${placeholders})
        `, spIds);

        // Aggregate material requirements
        const materialRequirements = {};

        productionItems.forEach(item => {
            const spId = parseInt(item.sp_id);
            const targetQty = parseFloat(item.quantity);
            if (isNaN(spId) || isNaN(targetQty) || targetQty <= 0) return;

            // Find BOM entries for this product
            const productBoms = bomRows.filter(row => row.sp_id === spId);

            productBoms.forEach(bom => {
                const lossFactor = 1 + (parseFloat(bom.ty_le_hao_hut) || 0) / 100;
                const reqQty = bom.so_luong * lossFactor * targetQty;
                if (!materialRequirements[bom.nvl_id]) {
                    materialRequirements[bom.nvl_id] = {
                        nvl_id: bom.nvl_id,
                        ma_nvl: bom.ma_nvl,
                        ten_nvl: bom.ten_nvl,
                        quy_cach: bom.quy_cach,
                        dvt: bom.dvt,
                        ton_kho_hien_tai: bom.ton_kho_hien_tai,
                        required_quantity: 0
                    };
                }
                materialRequirements[bom.nvl_id].required_quantity += reqQty;
            });
        });

        // Convert to array and calculate shortages
        const results = Object.values(materialRequirements).map(mat => {
            const shortage = Math.max(0, mat.required_quantity - mat.ton_kho_hien_tai);
            return {
                ...mat,
                shortage: parseFloat(shortage.toFixed(3)),
                required_quantity: parseFloat(mat.required_quantity.toFixed(3))
            };
        });

        res.json(results);
    } catch (err) {
        console.error('Error calculating materials requirements:', err);
        res.status(500).json({ error: 'Failed to calculate requirements' });
    }
});

// 5. Automated outward transaction for materials based on production calculations
router.post('/tinh-toan/xuat-kho', (req, res) => {
    try {
        const { productionItems, reference, notes } = req.body;

        if (!productionItems || !Array.isArray(productionItems) || productionItems.length === 0) {
            return res.status(400).json({ error: 'List of production items is required' });
        }

        // First calculate aggregated required materials
        const spIds = productionItems.map(item => parseInt(item.sp_id)).filter(id => !isNaN(id));
        const placeholders = spIds.map(() => '?').join(',');
        const bomRows = queryAll(`
            SELECT d.sp_id, d.nvl_id, n.ma_nvl, n.ten_nvl, n.ton_kho_hien_tai, d.so_luong, d.ty_le_hao_hut
            FROM dinh_muc d
            JOIN nvl n ON d.nvl_id = n.id
            WHERE d.sp_id IN (${placeholders})
        `, spIds);

        const requirements = {};
        productionItems.forEach(item => {
            const spId = parseInt(item.sp_id);
            const targetQty = parseFloat(item.quantity);
            if (isNaN(spId) || isNaN(targetQty) || targetQty <= 0) return;

            const productBoms = bomRows.filter(row => row.sp_id === spId);
            productBoms.forEach(bom => {
                const lossFactor = 1 + (parseFloat(bom.ty_le_hao_hut) || 0) / 100;
                const reqQty = bom.so_luong * lossFactor * targetQty;
                if (!requirements[bom.nvl_id]) {
                    requirements[bom.nvl_id] = {
                        nvl_id: bom.nvl_id,
                        ten_nvl: bom.ten_nvl,
                        ton_kho_hien_tai: bom.ton_kho_hien_tai,
                        required_quantity: 0
                    };
                }
                requirements[bom.nvl_id].required_quantity += reqQty;
            });
        });

        const reqList = Object.values(requirements);

        if (reqList.length === 0) {
            return res.status(400).json({ error: 'No materials found in BOM for the selected products' });
        }

        // Validate stock sufficiency
        const insufficient = reqList.filter(r => r.ton_kho_hien_tai < r.required_quantity);
        if (insufficient.length > 0) {
            const names = insufficient.map(i => `${i.ten_nvl} (Thiếu: ${(i.required_quantity - i.ton_kho_hien_tai).toFixed(2)})`).join(', ');
            return res.status(400).json({ error: `Không đủ nguyên vật liệu để xuất kho: ${names}` });
        }

        const today = new Date().toISOString().split('T')[0];

        // Execute transactions and update stock
        reqList.forEach(req => {
            const qty = parseFloat(req.required_quantity.toFixed(3));
            
            // Insert outward transaction
            runQuery(
                `INSERT INTO nvl_transactions (nvl_id, type, quantity, date, reference, notes, created_by)
                 VALUES (?, 'OUT', ?, ?, ?, ?, ?)`,
                [req.nvl_id, qty, today, reference || 'EXPORT-BOM', notes || 'Xuất kho sản xuất tự động theo định mức', req.user.id]
            );

            // Update NVL stock
            const newStock = req.ton_kho_hien_tai - qty;
            runQuery('UPDATE nvl SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, req.nvl_id]);
        });

        // Also record the product inward transactions (Nhập kho thành phẩm) for target products
        productionItems.forEach(item => {
            const spId = parseInt(item.sp_id);
            const targetQty = parseFloat(item.quantity);
            if (isNaN(spId) || isNaN(targetQty) || targetQty <= 0) return;

            const product = queryOne('SELECT ton_kho_hien_tai FROM san_pham WHERE id = ?', [spId]);
            if (!product) return;

            runQuery(
                `INSERT INTO sp_transactions (sp_id, type, quantity, date, reference, notes, created_by)
                 VALUES (?, 'IN', ?, ?, ?, ?, ?)`,
                [spId, targetQty, today, reference || 'IMPORT-PROD', notes || 'Nhập kho thành phẩm sản xuất mới', req.user.id]
            );

            const newProductStock = product.ton_kho_hien_tai + targetQty;
            runQuery('UPDATE san_pham SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newProductStock, spId]);
        });

        res.json({ message: 'Đã xuất kho NVL và nhập kho thành phẩm thành công.' });
    } catch (err) {
        console.error('Error performing automated export:', err);
        res.status(500).json({ error: 'Failed to perform automatic export transactions' });
    }
});

// 6. Get all production orders
router.get('/lenh-san-xuat', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT l.id, l.ma_lenh, l.date, l.notes, l.status, l.ten_lenh, l.ngay_bat_dau, l.ngay_ket_thuc, u.display_name as creator
            FROM lenh_san_xuat l
            LEFT JOIN users u ON l.created_by = u.id
            ORDER BY l.date DESC, l.id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching production orders:', err);
        res.status(500).json({ error: 'Failed to fetch production orders' });
    }
});

// 7. Get single production order details
router.get('/lenh-san-xuat/:id', (req, res) => {
    try {
        const order = queryOne('SELECT * FROM lenh_san_xuat WHERE id = ?', [req.params.id]);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        const items = queryAll(`
            SELECT li.id, li.sp_id, li.quantity, s.ma_sp, s.ten_sp, s.loai_xe, s.bo_phan
            FROM lenh_san_xuat_items li
            JOIN san_pham s ON li.sp_id = s.id
            WHERE li.lenh_id = ?
        `, [req.params.id]);

        // Calculate materials needed for this order's products
        let bomResults = [];
        if (items.length > 0) {
            const spIds = items.map(item => item.sp_id);
            const placeholders = spIds.map(() => '?').join(',');
            const bomRows = queryAll(`
                SELECT d.sp_id, d.nvl_id, n.ma_nvl, n.ten_nvl, n.quy_cach, n.dvt, n.ton_kho_hien_tai, d.so_luong, d.ty_le_hao_hut
                FROM dinh_muc d
                JOIN nvl n ON d.nvl_id = n.id
                WHERE d.sp_id IN (${placeholders})
            `, spIds);

            const requirements = {};
            items.forEach(item => {
                const spId = item.sp_id;
                const targetQty = item.quantity;
                const productBoms = bomRows.filter(row => row.sp_id === spId);

                productBoms.forEach(bom => {
                    const lossFactor = 1 + (parseFloat(bom.ty_le_hao_hut) || 0) / 100;
                    const reqQty = bom.so_luong * lossFactor * targetQty;
                    if (!requirements[bom.nvl_id]) {
                        requirements[bom.nvl_id] = {
                            nvl_id: bom.nvl_id,
                            ma_nvl: bom.ma_nvl,
                            ten_nvl: bom.ten_nvl,
                            quy_cach: bom.quy_cach,
                            dvt: bom.dvt,
                            ton_kho_hien_tai: bom.ton_kho_hien_tai,
                            required_quantity: 0
                        };
                    }
                    requirements[bom.nvl_id].required_quantity += reqQty;
                });
            });

            bomResults = Object.values(requirements).map(mat => {
                const shortage = Math.max(0, mat.required_quantity - mat.ton_kho_hien_tai);
                return {
                    ...mat,
                    shortage: parseFloat(shortage.toFixed(3)),
                    required_quantity: parseFloat(mat.required_quantity.toFixed(3))
                };
            });
        }

        res.json({ order, items, bomResults });
    } catch (err) {
        console.error('Error fetching production order details:', err);
        res.status(500).json({ error: 'Failed to fetch production order details' });
    }
});

// 8. Create production order
router.post('/lenh-san-xuat', (req, res) => {
    try {
        const { date, notes, items, ma_lenh, ten_lenh, ngay_bat_dau, ngay_ket_thuc } = req.body;
        if (!date || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Date and list of production items are required' });
        }

        // Generate ma_lenh if not provided: LSX-YYYYMMDD-XXXX
        let finalMaLenh = ma_lenh ? ma_lenh.trim() : '';
        if (!finalMaLenh) {
            const cleanDate = date.replace(/-/g, '');
            const todayOrders = queryOne("SELECT COUNT(*) as count FROM lenh_san_xuat WHERE date = ?", [date]);
            const nextNum = (todayOrders?.count || 0) + 1;
            finalMaLenh = `LSX-${cleanDate}-${String(nextNum).padStart(3, '0')}`;
        } else {
            // Check uniqueness of ma_lenh
            const existingOrder = queryOne('SELECT id FROM lenh_san_xuat WHERE ma_lenh = ?', [finalMaLenh]);
            if (existingOrder) {
                return res.status(400).json({ error: `Mã lệnh sản xuất '${finalMaLenh}' đã tồn tại.` });
            }
        }

        // Insert order
        runQuery(
            `INSERT INTO lenh_san_xuat (ma_lenh, date, notes, status, ten_lenh, ngay_bat_dau, ngay_ket_thuc, created_by)
             VALUES (?, ?, ?, 'Chờ cấp phát', ?, ?, ?, ?)`,
            [finalMaLenh, date, notes || '', ten_lenh || '', ngay_bat_dau || '', ngay_ket_thuc || '', req.user.id]
        );

        const insertedOrder = queryOne('SELECT id FROM lenh_san_xuat WHERE ma_lenh = ?', [finalMaLenh]);
        if (!insertedOrder) {
            return res.status(500).json({ error: 'Failed to create production order record' });
        }

        const lenh_id = insertedOrder.id;

        // Insert items
        items.forEach(item => {
            runQuery(
                `INSERT INTO lenh_san_xuat_items (lenh_id, sp_id, quantity)
                 VALUES (?, ?, ?)`,
                [lenh_id, parseInt(item.sp_id), parseFloat(item.quantity)]
            );
        });

        res.status(201).json({ id: lenh_id, ma_lenh: finalMaLenh, message: 'Production order created successfully' });
    } catch (err) {
        console.error('Error creating production order:', err);
        res.status(500).json({ error: 'Failed to create production order' });
    }
});

// 9. Update production order
router.put('/lenh-san-xuat/:id', (req, res) => {
    try {
        const { date, notes, items, ma_lenh, ten_lenh, ngay_bat_dau, ngay_ket_thuc } = req.body;
        if (!date || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Date and list of production items are required' });
        }

        const order = queryOne('SELECT * FROM lenh_san_xuat WHERE id = ?', [req.params.id]);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        if (order.status === 'Đã cấp phát') {
            return res.status(400).json({ error: 'Cannot modify a production order that has already been issued' });
        }

        // Validate ma_lenh uniqueness if changed
        let finalMaLenh = ma_lenh ? ma_lenh.trim() : '';
        if (finalMaLenh && finalMaLenh !== order.ma_lenh) {
            const existingOrder = queryOne('SELECT id FROM lenh_san_xuat WHERE ma_lenh = ?', [finalMaLenh]);
            if (existingOrder) {
                return res.status(400).json({ error: `Mã lệnh sản xuất '${finalMaLenh}' đã tồn tại.` });
            }
        } else if (!finalMaLenh) {
            finalMaLenh = order.ma_lenh;
        }

        // Update main order info
        runQuery(
            `UPDATE lenh_san_xuat
             SET ma_lenh = ?, date = ?, notes = ?, ten_lenh = ?, ngay_bat_dau = ?, ngay_ket_thuc = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [finalMaLenh, date, notes || '', ten_lenh || '', ngay_bat_dau || '', ngay_ket_thuc || '', req.params.id]
        );

        // Delete old items
        runQuery('DELETE FROM lenh_san_xuat_items WHERE lenh_id = ?', [req.params.id]);

        // Insert new items
        items.forEach(item => {
            runQuery(
                `INSERT INTO lenh_san_xuat_items (lenh_id, sp_id, quantity)
                 VALUES (?, ?, ?)`,
                [req.params.id, parseInt(item.sp_id), parseFloat(item.quantity)]
            );
        });

        res.json({ message: 'Production order updated successfully' });
    } catch (err) {
        console.error('Error updating production order:', err);
        res.status(500).json({ error: 'Failed to update production order' });
    }
});

// 10. Delete production order
router.delete('/lenh-san-xuat/:id', (req, res) => {
    try {
        const order = queryOne('SELECT status FROM lenh_san_xuat WHERE id = ?', [req.params.id]);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        if (order.status === 'Đã cấp phát') {
            return res.status(400).json({ error: 'Cannot delete a production order that has already been issued' });
        }

        runQuery('DELETE FROM lenh_san_xuat WHERE id = ?', [req.params.id]);
        res.json({ message: 'Production order deleted successfully' });
    } catch (err) {
        console.error('Error deleting production order:', err);
        res.status(500).json({ error: 'Failed to delete production order' });
    }
});

// 11. Issue stock materials for production order (Xác nhận & Trừ kho)
router.post('/lenh-san-xuat/:id/cap-phat', (req, res) => {
    try {
        const orderId = req.params.id;
        const order = queryOne('SELECT * FROM lenh_san_xuat WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ error: 'Production order not found' });
        }

        if (order.status === 'Đã cấp phát') {
            return res.status(400).json({ error: 'This order has already been issued' });
        }

        // Get items for calculations
        const items = queryAll(`
            SELECT li.sp_id, li.quantity, s.ten_sp
            FROM lenh_san_xuat_items li
            JOIN san_pham s ON li.sp_id = s.id
            WHERE li.lenh_id = ?
        `, [orderId]);

        if (items.length === 0) {
            return res.status(400).json({ error: 'Production order has no items' });
        }

        // Get BOM to calculate required materials
        const spIds = items.map(item => item.sp_id);
        const placeholders = spIds.map(() => '?').join(',');
        const bomRows = queryAll(`
            SELECT d.sp_id, d.nvl_id, n.ma_nvl, n.ten_nvl, n.ton_kho_hien_tai, d.so_luong, d.ty_le_hao_hut
            FROM dinh_muc d
            JOIN nvl n ON d.nvl_id = n.id
            WHERE d.sp_id IN (${placeholders})
        `, spIds);

        const requirements = {};
        items.forEach(item => {
            const spId = item.sp_id;
            const targetQty = item.quantity;
            const productBoms = bomRows.filter(row => row.sp_id === spId);

            productBoms.forEach(bom => {
                const lossFactor = 1 + (parseFloat(bom.ty_le_hao_hut) || 0) / 100;
                const reqQty = bom.so_luong * lossFactor * targetQty;
                if (!requirements[bom.nvl_id]) {
                    requirements[bom.nvl_id] = {
                        nvl_id: bom.nvl_id,
                        ten_nvl: bom.ten_nvl,
                        ton_kho_hien_tai: bom.ton_kho_hien_tai,
                        required_quantity: 0
                    };
                }
                requirements[bom.nvl_id].required_quantity += reqQty;
            });
        });

        const reqList = Object.values(requirements);

        const { bypassShortage } = req.body;
        const insufficient = reqList.filter(r => r.ton_kho_hien_tai < r.required_quantity);
        if (insufficient.length > 0 && !bypassShortage) {
            const names = insufficient.map(i => `${i.ten_nvl} (Thiếu: ${(i.required_quantity - i.ton_kho_hien_tai).toFixed(2)})`).join(', ');
            return res.status(400).json({ 
                error: `Không đủ nguyên vật liệu để xuất kho: ${names}`,
                shortageCode: 'INSUFFICIENT_STOCK'
            });
        }

        const today = new Date().toISOString().split('T')[0];

        // Execute transactions and update stock for materials
        reqList.forEach(reqItem => {
            const qty = parseFloat(reqItem.required_quantity.toFixed(3));
            
            // Insert outward transaction
            runQuery(
                `INSERT INTO nvl_transactions (nvl_id, type, quantity, date, reference, notes, created_by)
                 VALUES (?, 'OUT', ?, ?, ?, ?, ?)`,
                [reqItem.nvl_id, qty, today, order.ma_lenh, `Xuất kho sản xuất tự động theo Lệnh: ${order.ma_lenh}`, req.user.id]
            );

            // Update NVL stock
            const newStock = reqItem.ton_kho_hien_tai - qty;
            runQuery('UPDATE nvl SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, reqItem.nvl_id]);
        });

        // Record the product inward transactions (Nhập kho thành phẩm) for target products
        items.forEach(item => {
            const spId = item.sp_id;
            const targetQty = item.quantity;

            const product = queryOne('SELECT ton_kho_hien_tai FROM san_pham WHERE id = ?', [spId]);
            if (!product) return;

            runQuery(
                `INSERT INTO sp_transactions (sp_id, type, quantity, date, reference, notes, created_by)
                 VALUES (?, 'IN', ?, ?, ?, ?, ?)`,
                [spId, targetQty, today, order.ma_lenh, `Nhập kho thành phẩm theo Lệnh sản xuất: ${order.ma_lenh}`, req.user.id]
            );

            const newProductStock = product.ton_kho_hien_tai + targetQty;
            runQuery('UPDATE san_pham SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newProductStock, spId]);
        });

        // Update status of order to 'Đã cấp phát'
        runQuery("UPDATE lenh_san_xuat SET status = 'Đã cấp phát', updated_at = datetime('now') WHERE id = ?", [orderId]);

        res.json({ message: 'Đã cấp phát nguyên vật liệu và cập nhật lệnh sản xuất thành công.' });
    } catch (err) {
        console.error('Error issuing materials for order:', err);
        res.status(500).json({ error: 'Failed to issue materials for production order' });
    }
});

// 12. Get BOM for a specific Product (wildcard parameter route at bottom to avoid hijacking other endpoints)
router.get('/:sp_id', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT d.id, d.sp_id, d.nvl_id, n.ma_nvl, n.ten_nvl, n.quy_cach, n.dvt, n.ton_kho_hien_tai, d.so_luong, d.ty_le_hao_hut, d.ghi_chu
            FROM dinh_muc d
            JOIN nvl n ON d.nvl_id = n.id
            WHERE d.sp_id = ?
            ORDER BY n.ten_nvl ASC
        `, [req.params.sp_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching BOM:', err);
        res.status(500).json({ error: 'Failed to fetch BOM details' });
    }
});

module.exports = router;
