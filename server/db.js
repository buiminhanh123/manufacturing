const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

let db;
const DB_PATH = path.join(__dirname, 'data', 'app.db');

/**
 * Initialize the SQLite database.
 */
async function initDatabase() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Enable WAL mode
    db.run('PRAGMA journal_mode = WAL;');
    // Enable Foreign Keys support
    db.run('PRAGMA foreign_keys = ON;');

    // ──────────────────────────────────────────────────────────
    //  SCHEMAS
    // ──────────────────────────────────────────────────────────

    // 1. Users
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // 2. Permissions
    db.run(`
        CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            feature TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, feature)
        )
    `);

    // 3. Nguyên Vật Liệu (NVL)
    db.run(`
        CREATE TABLE IF NOT EXISTS nvl (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ma_nvl TEXT UNIQUE,
            ten_nvl TEXT NOT NULL,
            quy_cach TEXT DEFAULT '',
            dvt TEXT NOT NULL,
            ghi_chu TEXT DEFAULT '',
            ton_kho_ban_dau REAL DEFAULT 0,
            ton_kho_hien_tai REAL DEFAULT 0,
            min_inventory REAL DEFAULT 10,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // 4. NVL Transactions (Nhập/Xuất NVL)
    db.run(`
        CREATE TABLE IF NOT EXISTS nvl_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nvl_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- 'IN' (Nhập) hoặc 'OUT' (Xuất)
            quantity REAL NOT NULL,
            date TEXT NOT NULL, -- YYYY-MM-DD
            reference TEXT DEFAULT '', -- Mã phiếu / Số hóa đơn
            notes TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (nvl_id) REFERENCES nvl(id) ON DELETE CASCADE
        )
    `);

    // 5. Sản Phẩm (SP)
    db.run(`
        CREATE TABLE IF NOT EXISTS san_pham (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ma_sp TEXT UNIQUE,
            ten_sp TEXT NOT NULL,
            loai_xe TEXT DEFAULT '',
            bo_phan TEXT DEFAULT '',
            nguoi_phu_trach TEXT DEFAULT '',
            ghi_chu TEXT DEFAULT '',
            ton_kho_ban_dau REAL DEFAULT 0,
            ton_kho_hien_tai REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // 6. Sản Phẩm Transactions (Nhập/Xuất Sản Phẩm)
    db.run(`
        CREATE TABLE IF NOT EXISTS sp_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sp_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- 'IN' (Nhập - hoàn thành sản phẩm) hoặc 'OUT' (Xuất - bán hàng)
            quantity REAL NOT NULL,
            date TEXT NOT NULL, -- YYYY-MM-DD
            reference TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (sp_id) REFERENCES san_pham(id) ON DELETE CASCADE
        )
    `);

    // 7. Định Mức Vật Tư (BOM)
    db.run(`
        CREATE TABLE IF NOT EXISTS dinh_muc (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sp_id INTEGER NOT NULL,
            nvl_id INTEGER NOT NULL,
            so_luong REAL NOT NULL, -- Lượng NVL cần cho 1 đơn vị Sản Phẩm
            ty_le_hao_hut REAL DEFAULT 0, -- Tỷ lệ hao hụt (%)
            ghi_chu TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (sp_id) REFERENCES san_pham(id) ON DELETE CASCADE,
            FOREIGN KEY (nvl_id) REFERENCES nvl(id) ON DELETE CASCADE,
            UNIQUE(sp_id, nvl_id)
        )
    `);

    // 8. Lệnh sản xuất (Production Orders)
    db.run(`
        CREATE TABLE IF NOT EXISTS lenh_san_xuat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ma_lenh TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'Chờ cấp phát',
            ten_lenh TEXT DEFAULT '',
            ngay_bat_dau TEXT DEFAULT '',
            ngay_ket_thuc TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // 9. Chi tiết lệnh sản xuất (Production Order Items)
    db.run(`
        CREATE TABLE IF NOT EXISTS lenh_san_xuat_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lenh_id INTEGER NOT NULL,
            sp_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            FOREIGN KEY (lenh_id) REFERENCES lenh_san_xuat(id) ON DELETE CASCADE,
            FOREIGN KEY (sp_id) REFERENCES san_pham(id) ON DELETE CASCADE
        )
    `);

    // 10. Phiếu nhập xuất kho (Tickets)
    db.run(`
        CREATE TABLE IF NOT EXISTS phieu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ma_phieu TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL, -- 'IN_NVL', 'OUT_NVL', 'IN_SP', 'OUT_SP'
            date TEXT NOT NULL,
            notes TEXT DEFAULT '',
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Migrate existing table to add ty_le_hao_hut if it doesn't exist
    try {
        db.run('ALTER TABLE dinh_muc ADD COLUMN ty_le_hao_hut REAL DEFAULT 0');
    } catch (err) {
        // Column may already exist or table doesn't exist yet, ignore
    }

    try {
        db.run('ALTER TABLE lenh_san_xuat ADD COLUMN ten_lenh TEXT DEFAULT ""');
    } catch (err) {}
    try {
        db.run('ALTER TABLE lenh_san_xuat ADD COLUMN ngay_bat_dau TEXT DEFAULT ""');
    } catch (err) {}
    try {
        db.run('ALTER TABLE lenh_san_xuat ADD COLUMN ngay_ket_thuc TEXT DEFAULT ""');
    } catch (err) {}

    // Migrations to add phieu_id to transaction tables
    try {
        db.run('ALTER TABLE nvl_transactions ADD COLUMN phieu_id INTEGER REFERENCES phieu(id) ON DELETE CASCADE');
    } catch (err) {}
    try {
        db.run('ALTER TABLE sp_transactions ADD COLUMN phieu_id INTEGER REFERENCES phieu(id) ON DELETE CASCADE');
    } catch (err) {}

    // Seed default admin user
    const adminExists = db.exec("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
    const count = adminExists[0]?.values[0]?.[0] || 0;
    if (count === 0) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run(
            `INSERT INTO users (username, email, password_hash, display_name, role)
             VALUES (?, ?, ?, ?, ?)`,
            ['admin', 'admin@example.com', hash, 'Administrator', 'admin']
        );
    }

    // Seed data from Excel if databases are empty
    await seedFromExcel();

    saveDatabase();
    console.log('Database initialized successfully');
}

/**
 * Seed data from the provided Excel file if tables are empty.
 */
async function seedFromExcel() {
    try {
        const nvlCountRes = db.exec("SELECT COUNT(*) FROM nvl");
        const spCountRes = db.exec("SELECT COUNT(*) FROM san_pham");
        
        const nvlCount = nvlCountRes[0]?.values[0]?.[0] || 0;
        const spCount = spCountRes[0]?.values[0]?.[0] || 0;

        if (nvlCount > 0 && spCount > 0) {
            console.log('Database already has data. Skipping seed.');
            return;
        }

        const excelPath = path.join(__dirname, '..', 'DANH SÁCH CHI TIẾT CÁC SẢN PHẨM, NVL.xlsx');
        if (!fs.existsSync(excelPath)) {
            console.log(`Excel file not found at ${excelPath}. Skipping seed.`);
            return;
        }

        console.log(`Reading Excel file for seeding from: ${excelPath}`);
        const wb = XLSX.readFile(excelPath);

        // 1. Seed Nguyên Vật Liệu (NVL Sheet)
        if (nvlCount === 0 && wb.SheetNames.includes('NVL')) {
            const nvlSheet = wb.Sheets['NVL'];
            const nvlData = XLSX.utils.sheet_to_json(nvlSheet, { header: 1, defval: '' });
            let seededNvlCount = 0;
            
            for (let i = 3; i < nvlData.length; i++) {
                const row = nvlData[i];
                if (!row || row.length < 2 || !row[1] || String(row[1]).trim() === '') continue;

                const stt = row[0];
                const tenNvl = String(row[1]).trim();
                const quyCach = String(row[2] || '').trim();
                const dvt = String(row[3] || '').trim();
                const ghiChu = String(row[4] || '').trim();
                
                // Tạo mã NVL tự động (NVL-001, ...)
                const maNvl = `NVL-${String(stt || seededNvlCount + 1).padStart(3, '0')}`;

                db.run(
                    `INSERT INTO nvl (ma_nvl, ten_nvl, quy_cach, dvt, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai, min_inventory)
                     VALUES (?, ?, ?, ?, ?, 0, 0, 10)`,
                    [maNvl, tenNvl, quyCach, dvt, ghiChu]
                );
                seededNvlCount++;
            }
            console.log(`Seeded ${seededNvlCount} Raw Materials.`);
        }

        // 2. Seed Sản Phẩm (Sheet1 Sheet)
        if (spCount === 0 && wb.SheetNames.includes('Sheet1')) {
            const spSheet = wb.Sheets['Sheet1'];
            const spData = XLSX.utils.sheet_to_json(spSheet, { header: 1, defval: '' });
            let seededSpCount = 0;
            let currentBoPhan = '';
            let currentNguoiPhuTrach = '';

            for (let i = 3; i < spData.length; i++) {
                const row = spData[i];
                if (!row || row.length < 2 || !row[1] || String(row[1]).trim() === '') continue;

                const stt = row[0];
                const tenSp = String(row[1]).trim();
                const loaiXe = String(row[2] || '').trim();
                
                if (row[3] && String(row[3]).trim() !== '') {
                    currentBoPhan = String(row[3]).trim();
                }
                if (row[4] && String(row[4]).trim() !== '') {
                    currentNguoiPhuTrach = String(row[4]).trim();
                }

                const boPhan = currentBoPhan;
                const nguoiPhuTrach = currentNguoiPhuTrach;
                const ghiChu = String(row[5] || '').trim();
                
                const maSp = `SP-${String(stt || seededSpCount + 1).padStart(3, '0')}`;

                db.run(
                    `INSERT INTO san_pham (ma_sp, ten_sp, loai_xe, bo_phan, nguoi_phu_trach, ghi_chu, ton_kho_ban_dau, ton_kho_hien_tai)
                     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
                    [maSp, tenSp, loaiXe, boPhan, nguoiPhuTrach, ghiChu]
                );
                seededSpCount++;
            }
            console.log(`Seeded ${seededSpCount} Products.`);
        }
    } catch (err) {
        console.error('Error seeding database:', err);
    }
}

/**
 * Save database to disk
 */
function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Helper to run query and return array of objects
function queryAll(sql, params = []) {
    const res = db.exec(sql, params);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(vals => 
        Object.fromEntries(cols.map((col, idx) => [col, vals[idx]]))
    );
}

// Helper to run query and return first object
function queryOne(sql, params = []) {
    const res = db.exec(sql, params);
    if (!res[0]?.values[0]) return null;
    const cols = res[0].columns;
    const vals = res[0].values[0];
    return Object.fromEntries(cols.map((col, idx) => [col, vals[idx]]));
}

// Helper to run update/insert/delete statement
function runQuery(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
}

// ============================================================
//  QUERY HELPERS
// ============================================================
const userQueries = {
    findById: (id) => {
        return queryOne('SELECT id, username, email, display_name, role, is_active FROM users WHERE id = ?', [id]);
    },

    findByEmail: (email) => {
        return queryOne('SELECT * FROM users WHERE email = ?', [email]);
    },

    findByUsername: (username) => {
        return queryOne('SELECT * FROM users WHERE username = ?', [username]);
    },

    updatePassword: (id, hash) => {
        runQuery('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, id]);
    },
};

const permissionQueries = {
    getByUserId: (userId) => {
        const results = db.exec('SELECT feature FROM permissions WHERE user_id = ?', [userId]);
        if (!results[0]) return [];
        return results[0].values.map(v => v[0]);
    },

    hasPermission: (userId, feature) => {
        const results = db.exec('SELECT COUNT(*) FROM permissions WHERE user_id = ? AND feature = ?', [userId, feature]);
        return (results[0]?.values[0]?.[0] || 0) > 0;
    },
};

module.exports = {
    initDatabase,
    saveDatabase,
    getDb: () => db,
    userQueries,
    permissionQueries,
    queryAll,
    queryOne,
    runQuery,
};
