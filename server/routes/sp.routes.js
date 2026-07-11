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
        const worksheet = workbook.addWorksheet('Sản Phẩm');

        // Merged Title Row (Row 1)
        worksheet.mergeCells('A1:H1');
        const titleRow = worksheet.getRow(1);
        titleRow.getCell(1).value = 'DANH SÁCH SẢN PHẨM';
        titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        titleRow.height = 40;

        // Header Row (Row 2)
        const headers = [
            'Mã SP',
            'Tên sản phẩm *',
            'Loại xe',
            'Bộ phận sản xuất',
            'Người phụ trách',
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
        const sampleData = ['SP-001', 'Ốp cản trước xe Accent', 'Hyundai Accent', 'Hút ngoại thất', 'Nguyễn Văn A', 50, 50, 'Mẫu mới 2026'];
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
            { width: 20 },
            { width: 20 },
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
            'attachment; filename=mau_import_san_pham.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error generating Product template:', err);
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

            const ten_sp = String(nameVal).trim();
            const ma_sp = getCellValue(row.getCell(1)) ? String(getCellValue(row.getCell(1))).trim() : '';
            const loai_xe = getCellValue(row.getCell(3)) ? String(getCellValue(row.getCell(3))).trim() : '';
            const bo_phan = getCellValue(row.getCell(4)) ? String(getCellValue(row.getCell(4))).trim() : '';
            const nguoi_phu_trach = getCellValue(row.getCell(5)) ? String(getCellValue(row.getCell(5))).trim() : '';
            
            const rawInitial = getCellValue(row.getCell(6));
            const ton_kho_ban_dau = rawInitial !== '' && !isNaN(parseFloat(rawInitial)) ? parseFloat(rawInitial) : 0;
            
            const rawCurrent = getCellValue(row.getCell(7));
            const ton_kho_hien_tai = rawCurrent !== '' && !isNaN(parseFloat(rawCurrent)) ? parseFloat(rawCurrent) : ton_kho_ban_dau;
            
            const ghi_chu = getCellValue(row.getCell(8)) ? String(getCellValue(row.getCell(8))).trim() : '';

            let code = ma_sp;
            if (!code) {
                const countRes = queryOne('SELECT COUNT(*) as count FROM san_pham');
                const nextId = (countRes?.count || 0) + 1;
                code = `SP-${String(nextId).padStart(3, '0')}`;
            }

            const exists = queryOne('SELECT id FROM san_pham WHERE ma_sp = ?', [code]);
            if (exists) {
                runQuery(
                    `UPDATE san_pham 
                     SET ten_sp = ?, loai_xe = ?, bo_phan = ?, nguoi_phu_trach = ?, ghi_chu = ?, ton_kho_ban_dau = ?, ton_kho_hien_tai = ?, updated_at = datetime('now')
                     WHERE id = ?`,
                    [ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, exists.id]
                );
            } else {
                runQuery(
                    `INSERT INTO san_pham (ma_sp, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [code, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai]
                );
            }
            importedCount++;
        }

        res.json({ message: `Đã nhập (import) thành công ${importedCount} dòng sản phẩm.` });
    } catch (err) {
        console.error('Error importing Product:', err);
        res.status(500).json({ error: 'Import thất bại: ' + err.message });
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
