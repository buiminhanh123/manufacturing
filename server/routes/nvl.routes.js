const express = require('express');
const { queryAll, queryOne, runQuery } = require('../db');

const router = express.Router();

// 1. Get all NVLs
router.get('/', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT id, ma_nvl, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, min_inventory
            FROM nvl
            ORDER BY id ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching NVL:', err);
        res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
});

// Helper to extract clean cell values
const getCellValue = (cell) => {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText) {
            return cell.value.richText.map(t => t.text).join('');
        }
        if (cell.value.text !== undefined) return cell.value.text;
    }
    return cell.value;
};

// Multer in-memory storage for import
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Template Excel Download
router.get('/template', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NVL');

        // Merged Title Row (Row 1)
        worksheet.mergeCells('A1:H1');
        const titleRow = worksheet.getRow(1);
        titleRow.getCell(1).value = 'DANH SÁCH NGUYÊN VẬT LIỆU';
        titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        titleRow.height = 40;

        // Header Row (Row 2)
        const headers = [
            'Mã NVL',
            'Tên nguyên vật liệu *',
            'Quy cách',
            'Đơn vị tính *',
            'Tồn tối thiểu',
            'Tồn ban đầu',
            'Tồn hiện tại',
            'Ghi chú'
        ];
        
        const headerRow = worksheet.getRow(2);
        headerRow.height = 25;
        headers.forEach((h, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' } // Gray background
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Sample Data Row (Row 3)
        const sampleRow = worksheet.getRow(3);
        const sampleData = ['NVL-001', 'Decal phản quang màu đỏ', 'Cuộn 50m', 'Cuộn', 10, 100, 100, 'Vật tư chính'];
        sampleData.forEach((val, index) => {
            const cell = sampleRow.getCell(index + 1);
            cell.value = val;
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Column widths
        worksheet.columns = [
            { width: 15 },
            { width: 30 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 25 }
        ];

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=mau_import_nvl.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error generating NVL template:', err);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Import Excel File
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng tải lên file excel' });
        }

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            return res.status(400).json({ error: 'File Excel không có dữ liệu hoặc sai định dạng' });
        }

        let importedCount = 0;
        const rowCount = worksheet.rowCount;

        for (let i = 3; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const nameVal = getCellValue(row.getCell(2));
            if (!nameVal) continue; // Skip empty rows or rows without name

            const ten_nvl = String(nameVal).trim();
            const ma_nvl = getCellValue(row.getCell(1)) ? String(getCellValue(row.getCell(1))).trim() : '';
            const quy_cach = getCellValue(row.getCell(3)) ? String(getCellValue(row.getCell(3))).trim() : '';
            const dvt = getCellValue(row.getCell(4)) ? String(getCellValue(row.getCell(4))).trim() : 'Cái';
            
            const rawMin = getCellValue(row.getCell(5));
            const min_inventory = rawMin !== '' && !isNaN(parseFloat(rawMin)) ? parseFloat(rawMin) : 10;
            
            const rawInitial = getCellValue(row.getCell(6));
            const ton_kho_ban_dau = rawInitial !== '' && !isNaN(parseFloat(rawInitial)) ? parseFloat(rawInitial) : 0;
            
            const rawCurrent = getCellValue(row.getCell(7));
            const ton_kho_hien_tai = rawCurrent !== '' && !isNaN(parseFloat(rawCurrent)) ? parseFloat(rawCurrent) : ton_kho_ban_dau;
            
            const ghi_chu = getCellValue(row.getCell(8)) ? String(getCellValue(row.getCell(8))).trim() : '';

            let code = ma_nvl;
            if (!code) {
                const countRes = queryOne('SELECT COUNT(*) as count FROM nvl');
                const nextId = (countRes?.count || 0) + 1;
                code = `NVL-${String(nextId).padStart(3, '0')}`;
            }

            const exists = queryOne('SELECT id FROM nvl WHERE ma_nvl = ?', [code]);
            if (exists) {
                runQuery(
                    `UPDATE nvl 
                     SET ten_nvl = ?, quy_cach = ?, dvt = ?, ghi_chu = ?, min_inventory = ?, ton_kho_ban_dau = ?, ton_kho_hien_tai = ?, updated_at = datetime('now')
                     WHERE id = ?`,
                    [ten_nvl, quy_cach, dvt, ghi_chu, min_inventory, ton_kho_ban_dau, ton_kho_hien_tai, exists.id]
                );
            } else {
                runQuery(
                    `INSERT INTO nvl (ma_nvl, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, min_inventory)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [code, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, min_inventory]
                );
            }
            importedCount++;
        }

        res.json({ message: `Đã nhập (import) thành công ${importedCount} dòng nguyên vật liệu.` });
    } catch (err) {
        console.error('Error importing NVL:', err);
        res.status(500).json({ error: 'Import thất bại: ' + err.message });
    }
});

// 2. Get single NVL
router.get('/:id', (req, res) => {
    try {
        const row = queryOne('SELECT * FROM nvl WHERE id = ?', [req.params.id]);
        if (!row) {
            return res.status(404).json({ error: 'Raw material not found' });
        }
        res.json(row);
    } catch (err) {
        console.error('Error fetching single NVL:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Create new NVL
router.post('/', (req, res) => {
    try {
        const { ma_nvl, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, min_inventory } = req.body;
        
        if (!ten_nvl || !dvt) {
            return res.status(400).json({ error: 'Name and unit (ĐVT) are required' });
        }

        // Generate ma_nvl if not provided
        let code = ma_nvl;
        if (!code) {
            const countRes = queryOne('SELECT COUNT(*) as count FROM nvl');
            const nextId = (countRes?.count || 0) + 1;
            code = `NVL-${String(nextId).padStart(3, '0')}`;
        }

        // Check if code exists
        const exists = queryOne('SELECT id FROM nvl WHERE ma_nvl = ?', [code]);
        if (exists) {
            return res.status(400).json({ error: `Material code '${code}' already exists` });
        }

        const initialStock = parseFloat(ton_kho_ban_dau || 0);
        const minInv = parseFloat(min_inventory || 10);

        runQuery(
            `INSERT INTO nvl (ma_nvl, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, min_inventory)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, ten_nvl, quy_cach || '', dvt, ghi_chu || '', initialStock, initialStock, minInv]
        );

        const newNvl = queryOne('SELECT * FROM nvl WHERE ma_nvl = ?', [code]);
        res.status(201).json(newNvl);
    } catch (err) {
        console.error('Error creating NVL:', err);
        res.status(500).json({ error: 'Failed to create raw material' });
    }
});

// 4. Update NVL
router.put('/:id', (req, res) => {
    try {
        const { ten_nvl, quy_cach, dvt, ghi_chu, min_inventory } = req.body;
        const id = req.params.id;

        const exists = queryOne('SELECT id FROM nvl WHERE id = ?', [id]);
        if (!exists) {
            return res.status(404).json({ error: 'Raw material not found' });
        }

        if (!ten_nvl || !dvt) {
            return res.status(400).json({ error: 'Name and unit (ĐVT) are required' });
        }

        const minInv = parseFloat(min_inventory || 10);

        runQuery(
            `UPDATE nvl 
             SET ten_nvl = ?, quy_cach = ?, dvt = ?, ghi_chu = ?, min_inventory = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [ten_nvl, quy_cach || '', dvt, ghi_chu || '', minInv, id]
        );

        const updatedNvl = queryOne('SELECT * FROM nvl WHERE id = ?', [id]);
        res.json(updatedNvl);
    } catch (err) {
        console.error('Error updating NVL:', err);
        res.status(500).json({ error: 'Failed to update raw material' });
    }
});

// 5. Delete NVL
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;
        const exists = queryOne('SELECT id FROM nvl WHERE id = ?', [id]);
        if (!exists) {
            return res.status(404).json({ error: 'Raw material not found' });
        }

        runQuery('DELETE FROM nvl WHERE id = ?', [id]);
        res.json({ message: 'Deleted raw material successfully' });
    } catch (err) {
        console.error('Error deleting NVL:', err);
        res.status(500).json({ error: 'Failed to delete raw material' });
    }
});

// 6. Get all NVL Transactions
router.get('/transactions/all', (req, res) => {
    try {
        const rows = queryAll(`
            SELECT t.id, t.nvl_id, n.ma_nvl, n.ten_nvl, n.dvt, t.type, t.quantity, t.date, t.reference, t.notes, u.display_name as creator_name, t.phieu_id
            FROM nvl_transactions t
            JOIN nvl n ON t.nvl_id = n.id
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.date DESC, t.id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching NVL transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transaction logs' });
    }
});

// 7. Add new NVL Transaction (Inward/Outward)
router.post('/transactions', (req, res) => {
    try {
        const { nvl_id, type, quantity, date, reference, notes } = req.body;

        if (!nvl_id || !type || !quantity || !date) {
            return res.status(400).json({ error: 'Material ID, Type, Quantity, and Date are required' });
        }

        if (type !== 'IN' && type !== 'OUT') {
            return res.status(400).json({ error: "Type must be 'IN' or 'OUT'" });
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive number' });
        }

        const material = queryOne('SELECT ton_kho_hien_tai FROM nvl WHERE id = ?', [nvl_id]);
        if (!material) {
            return res.status(404).json({ error: 'Raw material not found' });
        }

        // If outward, check if stock is enough
        if (type === 'OUT' && material.ton_kho_hien_tai < qty) {
            return res.status(400).json({ error: `Insufficient inventory. Available: ${material.ton_kho_hien_tai}` });
        }

        // Record transaction
        runQuery(
            `INSERT INTO nvl_transactions (nvl_id, type, quantity, date, reference, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nvl_id, type, qty, date, reference || '', notes || '', req.user.id]
        );

        // Update inventory
        const newStock = type === 'IN' 
            ? material.ton_kho_hien_tai + qty 
            : material.ton_kho_hien_tai - qty;

        runQuery('UPDATE nvl SET ton_kho_hien_tai = ?, updated_at = datetime("now") WHERE id = ?', [newStock, nvl_id]);

        res.status(201).json({ message: 'Transaction logged and inventory updated successfully', newStock });
    } catch (err) {
        console.error('Error creating NVL transaction:', err);
        res.status(500).json({ error: 'Failed to complete transaction' });
    }
});

module.exports = router;
