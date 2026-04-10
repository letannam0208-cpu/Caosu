require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;


// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.JWT_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ====================== DATABASE CONNECTION (NEON) ======================
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('✅ Kết nối PostgreSQL (Neon) thành công!'));
pool.on('error', (err) => console.error('❌ Lỗi kết nối Pool:', err.message));

// ====================== MIDDLEWARE XÁC THỰC JWT ======================
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }
    return res.redirect('/login');
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    console.error('Lỗi xác thực token:', err.message);
    res.clearCookie('token');
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'Token không hợp lệ' });
    }
    res.redirect('/login');
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    if (req.path.startsWith('/api/')) {
      res.status(403).json({ success: false, error: 'Không có quyền truy cập' });
    } else {
      res.status(403).render('403', { title: 'Truy cập bị từ chối', user: req.user, path: req.path });
    }
  }
};

// ====================== API ENDPOINTS ======================

// Dashboard Stats
app.get('/api/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT id_lo) as tong_lo_cay,
        ROUND(SUM(COALESCE(dien_tich_map, 0))::numeric, 3) as tong_dien_tich,
        COUNT(DISTINCT giong) as tong_giong,
        COUNT(DISTINCT doi) as tong_doi
      FROM lo
    `);
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (err) {
    console.error('Lỗi /api/dashboard-stats:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy thống kê dashboard' });
  }
});

// lấy danh sách đội (cho filter dropdown)
app.get('/api/don-vi-list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT doi FROM lo WHERE doi IS NOT NULL AND doi != \'\' ORDER BY doi');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Giống cây (cho filter)
app.get('/api/giong-stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT giong, COUNT(*) as so_lo 
      FROM lo 
      WHERE giong IS NOT NULL 
      GROUP BY giong 
      ORDER BY so_lo DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Năm trồng (cho filter)
app.get('/api/nam-trong-stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nam_trong, COUNT(*) as so_lo 
      FROM lo 
      WHERE nam_trong IS NOT NULL 
      GROUP BY nam_trong 
      ORDER BY nam_trong
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GeoJSON cho bản đồ
app.get('/api/lo-cao-su', authenticateToken, async (req, res) => {
  try {
    const { doi, nam_trong, giong, phien_cao, nhip_do_cao, tai_canh_nam, khu_vuc, tuoi_cao, che_do_cao } = req.query;
    let whereClause = 'WHERE geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND doi = $${paramIndex++}`; }
    if (nam_trong) { params.push(parseInt(nam_trong)); whereClause += ` AND nam_trong = $${paramIndex++}`; }
    if (giong) { params.push(giong); whereClause += ` AND giong = $${paramIndex++}`; }
    if (phien_cao) { params.push(phien_cao); whereClause += ` AND phien_cao = $${paramIndex++}`; }
    if (nhip_do_cao) { params.push(nhip_do_cao); whereClause += ` AND nhip_do_cao = $${paramIndex++}`; }
    if (tai_canh_nam) { params.push(parseInt(tai_canh_nam)); whereClause += ` AND tai_canh_nam = $${paramIndex++}`; }
    if (khu_vuc) { params.push(khu_vuc); whereClause += ` AND khu_vuc = $${paramIndex++}`; }
    if (tuoi_cao) { params.push(parseInt(tuoi_cao)); whereClause += ` AND tuoi_cao = $${paramIndex++}`; }
    if (che_do_cao) { params.push(che_do_cao); whereClause += ` AND che_do_cao = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT
        id_lo, ten_lo, giong, nam_trong, doi, du_an, khu_vuc,
        dien_tich_map, che_do_cao, phien_cao, nhip_do_cao, tuoi_cao,
        cay_cao, tai_canh_nam,
        ST_AsGeoJSON(ST_Transform(geometry, 4326)) AS geometry
      FROM lo
      ${whereClause}
    `, params);

    const features = result.rows.filter(row => row.geometry).map(row => ({
      type: "Feature",
      geometry: JSON.parse(row.geometry),
      properties: {
        id_lo: row.id_lo,
        ten_lo: row.ten_lo,
        giong: row.giong,
        nam_trong: row.nam_trong,
        doi: row.doi,
        dien_tich_map: row.dien_tich_map,
        che_do_cao: row.che_do_cao,
        cay_cao: row.cay_cao,
        phien_cao: row.phien_cao,
        nhip_do_cao: row.nhip_do_cao,
        tai_canh_nam: row.tai_canh_nam,
        khu_vuc: row.khu_vuc,
        tuoi_cao: row.tuoi_cao
      }
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error('❌ Lỗi /api/lo-cao-su:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy dữ liệu bản đồ', details: err.message });
  }
});

// API ranh giới
app.get('/api/boundary', authenticateToken, async (req, res) => {
  try {
    const { doi } = req.query;
    let whereClause = 'WHERE geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND doi = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT 
        doi,
        du_an,
        khu_vuc,
        ST_AsGeoJSON(ST_Transform(ST_Union(geometry), 4326)) as geometry
      FROM lo
      ${whereClause}
      GROUP BY doi, du_an, khu_vuc
      ORDER BY doi
    `, params);

    const features = result.rows.filter(row => row.geometry).map(row => ({
      type: "Feature",
      geometry: JSON.parse(row.geometry),
      properties: {
        doi: row.doi || 'Toàn vùng',
        du_an: row.du_an,
        khu_vuc: row.khu_vuc,
        type: 'boundary'
      }
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error('Lỗi /api/boundary:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy ranh giới bản đồ' });
  }
});

// ====================== API QUẢN LÝ NGƯỜI DÙNG ======================

// Lấy danh sách users (có filter)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const { role, status, search } = req.query;
        let sql = `SELECT id, username, fullname, email, role, status, unit, avatar_color, last_login, created_at
                   FROM users WHERE 1=1`;
        const params = [];
        if (role) { params.push(role); sql += ` AND role = $${params.length}`; }
        if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (fullname ILIKE $${params.length} OR username ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        sql += ` ORDER BY fullname`;
        const result = await pool.query(sql, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Lấy thông tin user theo id
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT id, username, fullname, email, role, status, unit, avatar_color, last_login
                                         FROM users WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Thêm user mới
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password, fullname, email, role, status, unit, avatar_color } = req.body;
    if (!username || !password || !fullname) {
        return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, fullname, email, role, status, unit, avatar_color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [username, hashed, fullname, email, role || 'staff', status || 'active', unit, avatar_color || '#10b981']
        );
        res.json({ success: true, message: 'Thêm người dùng thành công', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') res.status(400).json({ success: false, error: 'Tên đăng nhập hoặc email đã tồn tại' });
        else res.status(500).json({ success: false, error: err.message });
    }
});

// Cập nhật user
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { fullname, email, role, status, unit, avatar_color, password } = req.body;
    try {
        let updateFields = [];
        let values = [];
        let idx = 1;
        if (fullname !== undefined) { updateFields.push(`fullname = $${idx++}`); values.push(fullname); }
        if (email !== undefined) { updateFields.push(`email = $${idx++}`); values.push(email); }
        if (role !== undefined) { updateFields.push(`role = $${idx++}`); values.push(role); }
        if (status !== undefined) { updateFields.push(`status = $${idx++}`); values.push(status); }
        if (unit !== undefined) { updateFields.push(`unit = $${idx++}`); values.push(unit); }
        if (avatar_color !== undefined) { updateFields.push(`avatar_color = $${idx++}`); values.push(avatar_color); }
        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            updateFields.push(`password_hash = $${idx++}`);
            values.push(hashed);
        }
        updateFields.push(`updated_at = NOW()`);
        values.push(id);
        if (updateFields.length > 0) {
            await pool.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = $${idx}`, values);
        }
        res.json({ success: true, message: 'Cập nhật thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Xóa user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user?.id) {
        return res.status(400).json({ success: false, error: 'Không thể xóa chính mình' });
    }
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'Xóa người dùng thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Đăng nhập (tạo JWT)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`SELECT id, username, password_hash, fullname, role, status, unit, avatar_color
                                         FROM users WHERE username = $1`, [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        const user = result.rows[0];
        if (user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'Tài khoản đã bị khóa hoặc chưa kích hoạt' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        // Cập nhật last_login
        await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
        
        // Tạo JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, fullname: user.fullname, role: user.role, unit: user.unit, avatar_color: user.avatar_color },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        // Set cookie httpOnly
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        res.json({ success: true, message: 'Đăng nhập thành công', redirect: '/' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Đăng xuất (xóa cookie)
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, redirect: '/login' });
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// Lấy thông tin user hiện tại từ token
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ success: true, data: req.user });
});

// ====================== QUẢN LÝ LÔ CÂY ======================
app.get('/api/lo-cay', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id_lo, ten_lo, nam_trong, giong, cao_trinh_tb,
        du_an, doi, khu_vuc,
        xa, huyen, tinh,
        dien_tich_map, dien_tich_010125, dien_tich_010126,
        tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
        che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
        ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
        hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
      FROM lo
      ORDER BY ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Lỗi /api/lo-cay:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/lo-cay/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM lo WHERE id_lo = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy lô cây' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lo-cay', authenticateToken, async (req, res) => {
  try {
    const {
      id_lo, ten_lo, nam_trong, giong, cao_trinh_tb,
      du_an, doi, khu_vuc, xa, huyen, tinh,
      dien_tich_map, dien_tich_010125, dien_tich_010126,
      tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
      che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
      ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
      hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
    } = req.body;

    const newId = id_lo || ('LO_' + Date.now() + '_' + Math.floor(Math.random() * 10000));

    await pool.query(`
      INSERT INTO lo (
        id_lo, ten_lo, nam_trong, giong, cao_trinh_tb,
        du_an, doi, khu_vuc, xa, huyen, tinh,
        dien_tich_map, dien_tich_010125, dien_tich_010126,
        tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
        che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
        ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
        hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42)
    `, [
      newId, ten_lo, nam_trong, giong, cao_trinh_tb,
      du_an, doi, khu_vuc, xa, huyen, tinh,
      dien_tich_map, dien_tich_010125, dien_tich_010126,
      tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
      che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
      ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
      hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
    ]);
    res.json({ success: true, message: 'Thêm lô cây thành công', id: newId });
  } catch (err) {
    console.error('Lỗi thêm lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API CẬP NHẬT LÔ CÂY (ĐÃ SỬA) ======================
app.put('/api/lo-cay/:id', authenticateToken, async (req, res) => {
  const id_lo = req.params.id;
  const {
    ten_lo, nam_trong, giong, cao_trinh_tb,
    du_an, doi, khu_vuc, xa, huyen, tinh,
    dien_tich_map, dien_tich_010125, dien_tich_010126,
    tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
    che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
    ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
    hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
  } = req.body;

  try {
    await pool.query(`
      UPDATE lo SET
        ten_lo = $1, nam_trong = $2, giong = $3, cao_trinh_tb = $4,
        du_an = $5, doi = $6, khu_vuc = $7, xa = $8, huyen = $9, tinh = $10,
        dien_tich_map = $11, dien_tich_010125 = $12, dien_tich_010126 = $13,
        tong_ho_kk = $14, cay_cao = $15, cay_chua_cao = $16, cay_kho_mu = $17, cay_khong_pt = $18, ho_trong = $19, mat_do_cc = $20,
        che_do_cao = $21, phien_cao = $22, nhip_do_cao = $23, nam_mc = $24, tuoi_cao = $25, nam_cao_up = $26, tinh_trang_mc = $27,
        ns25_kg_ha = $28, ns25_kg_cay = $29, ns26_kg_ha = $30, ns26_kg_cay = $31, tong_lat_cao = $32, san_luong = $33, phan_loai = $34, doi_tuong = $35, tai_canh_nam = $36,
        hang_dat = $37, phuong_phap_trong = $38, khoang_cach_trong = $39, mat_do_tk = $40
      WHERE id_lo = $41
    `, [
      ten_lo, nam_trong, giong, cao_trinh_tb,
      du_an, doi, khu_vuc, xa, huyen, tinh,
      dien_tich_map, dien_tich_010125, dien_tich_010126,
      tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
      che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
      ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
      hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk,
      id_lo
    ]);
    res.json({ success: true, message: 'Cập nhật lô cây thành công' });
  } catch (err) {
    console.error('Lỗi cập nhật lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API XÓA LÔ CÂY ======================
app.delete('/api/lo-cay/:id', authenticateToken, async (req, res) => {
  const id_lo = req.params.id;
  try {
    await pool.query('DELETE FROM lo WHERE id_lo = $1', [id_lo]);
    res.json({ success: true, message: 'Xóa lô cây thành công' });
  } catch (err) {
    console.error('Lỗi xóa lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== IMPORT EXCEL & LƯU LỊCH SỬ ======================
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

// Cấu hình multer để lưu file tạm
const upload = multer({ dest: 'uploads/' });

// API import file Excel (có lưu lịch sử)
app.post('/api/import-excel', authenticateToken, upload.single('file'), async (req, res) => {
    const { nam_cap_nhat } = req.body; // năm của dữ liệu mới (ví dụ 2027)
    if (!nam_cap_nhat) {
        return res.status(400).json({ success: false, error: 'Vui lòng cung cấp năm cập nhật' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Chưa chọn file Excel' });
    }
    const filePath = req.file.path;
    try {
        // Đọc file Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (rows.length === 0) {
            throw new Error('File Excel không có dữ liệu');
        }

        const client = await pool.connect();
        await client.query('BEGIN');

        let insertedCount = 0;
        let updatedCount = 0;

        for (const row of rows) {
            // Lấy id_lo (có thể là cột 'ID_lo' hoặc 'id_lo')
            const id_lo = row.ID_lo || row.id_lo;
            if (!id_lo) {
                console.warn('Bỏ qua dòng không có ID_lo:', row);
                continue;
            }

            // Kiểm tra xem lô đã tồn tại trong bảng lo chưa
            const existing = await client.query('SELECT * FROM lo WHERE id_lo = $1', [id_lo]);

            if (existing.rows.length > 0) {
                const oldRecord = existing.rows[0];
                // Lưu bản ghi cũ vào lo_history với nam_cap_nhat_history = oldRecord.nam_cap_nhat
                await client.query(`
                    INSERT INTO lo_history (
                        id_lo, ten_lo, nam_trong, cao_trinh_tb, giong, geometry,
                        du_an, doi, khu_vuc, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk,
                        dien_tich_010125, dien_tich_010126, dien_tich_map, tong_ho_kk, cay_cao, cay_chua_cao,
                        cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc, che_do_cao, nam_mc, tuoi_cao,
                        nam_cao_up, tinh_trang_mc, ns25_kg_ha, ns25_kg_cay, tong_lat_cao, ns26_kg_cay,
                        phan_loai, xa, huyen, tinh, ns26_kg_ha, san_luong, phien_cao, nhip_do_cao,
                        tai_canh_nam, doi_tuong, nam_cap_nhat_history
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
                        $34, $35, $36, $37, $38, $39, $40, $41, $42
                    )
                `, [
                    oldRecord.id_lo, oldRecord.ten_lo, oldRecord.nam_trong, oldRecord.cao_trinh_tb,
                    oldRecord.giong, oldRecord.geometry, oldRecord.du_an, oldRecord.doi, oldRecord.khu_vuc,
                    oldRecord.hang_dat, oldRecord.phuong_phap_trong, oldRecord.khoang_cach_trong,
                    oldRecord.mat_do_tk, oldRecord.dien_tich_010125, oldRecord.dien_tich_010126,
                    oldRecord.dien_tich_map, oldRecord.tong_ho_kk, oldRecord.cay_cao, oldRecord.cay_chua_cao,
                    oldRecord.cay_kho_mu, oldRecord.cay_khong_pt, oldRecord.ho_trong, oldRecord.mat_do_cc,
                    oldRecord.che_do_cao, oldRecord.nam_mc, oldRecord.tuoi_cao, oldRecord.nam_cao_up,
                    oldRecord.tinh_trang_mc, oldRecord.ns25_kg_ha, oldRecord.ns25_kg_cay, oldRecord.tong_lat_cao,
                    oldRecord.ns26_kg_cay, oldRecord.phan_loai, oldRecord.xa, oldRecord.huyen, oldRecord.tinh,
                    oldRecord.ns26_kg_ha, oldRecord.san_luong, oldRecord.phien_cao, oldRecord.nhip_do_cao,
                    oldRecord.tai_canh_nam, oldRecord.doi_tuong, oldRecord.nam_cap_nhat
                ]);

                // Cập nhật bảng lo với dữ liệu mới (chỉ các cột có trong file)
                const updateFields = [];
                const updateValues = [];
                let idx = 1;
                // Danh sách các cột có thể cập nhật (trừ geometry và các cột cố định nếu không muốn thay đổi)
                const updatableCols = [
                    'ten_lo', 'nam_trong', 'cao_trinh_tb', 'giong', 'du_an', 'doi', 'khu_vuc',
                    'hang_dat', 'phuong_phap_trong', 'khoang_cach_trong', 'mat_do_tk',
                    'dien_tich_010125', 'dien_tich_010126', 'dien_tich_map', 'tong_ho_kk',
                    'cay_cao', 'cay_chua_cao', 'cay_kho_mu', 'cay_khong_pt', 'ho_trong', 'mat_do_cc',
                    'che_do_cao', 'nam_mc', 'tuoi_cao', 'nam_cao_up', 'tinh_trang_mc',
                    'ns25_kg_ha', 'ns25_kg_cay', 'tong_lat_cao', 'ns26_kg_cay', 'phan_loai',
                    'xa', 'huyen', 'tinh', 'ns26_kg_ha', 'san_luong', 'phien_cao', 'nhip_do_cao',
                    'tai_canh_nam', 'doi_tuong'
                ];
                for (const col of updatableCols) {
                    if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
                        updateFields.push(`${col} = $${idx++}`);
                        updateValues.push(row[col]);
                    }
                }
                // Luôn cập nhật nam_cap_nhat thành năm mới
                updateFields.push(`nam_cap_nhat = $${idx++}`);
                updateValues.push(parseInt(nam_cap_nhat));
                updateValues.push(id_lo);

                if (updateFields.length > 0) {
                    await client.query(
                        `UPDATE lo SET ${updateFields.join(', ')} WHERE id_lo = $${idx}`,
                        updateValues
                    );
                    updatedCount++;
                }
            } else {
                // Insert mới
                const insertCols = ['id_lo', 'nam_cap_nhat'];
                const insertValues = [id_lo, parseInt(nam_cap_nhat)];
                const updatableCols = [
                    'ten_lo', 'nam_trong', 'cao_trinh_tb', 'giong', 'du_an', 'doi', 'khu_vuc',
                    'hang_dat', 'phuong_phap_trong', 'khoang_cach_trong', 'mat_do_tk',
                    'dien_tich_010125', 'dien_tich_010126', 'dien_tich_map', 'tong_ho_kk',
                    'cay_cao', 'cay_chua_cao', 'cay_kho_mu', 'cay_khong_pt', 'ho_trong', 'mat_do_cc',
                    'che_do_cao', 'nam_mc', 'tuoi_cao', 'nam_cao_up', 'tinh_trang_mc',
                    'ns25_kg_ha', 'ns25_kg_cay', 'tong_lat_cao', 'ns26_kg_cay', 'phan_loai',
                    'xa', 'huyen', 'tinh', 'ns26_kg_ha', 'san_luong', 'phien_cao', 'nhip_do_cao',
                    'tai_canh_nam', 'doi_tuong'
                ];
                for (const col of updatableCols) {
                    if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
                        insertCols.push(col);
                        insertValues.push(row[col]);
                    }
                }
                // Nếu file có cột geometry (dạng WKT), có thể xử lý riêng
                if (row.geometry && typeof row.geometry === 'string') {
                    insertCols.push('geometry');
                    insertValues.push(`ST_GeomFromText('${row.geometry}', 32648)`); // cần escape cẩn thận
                }
                const placeholders = insertValues.map((_, i) => `$${i+1}`).join(',');
                await client.query(
                    `INSERT INTO lo (${insertCols.join(',')}) VALUES (${placeholders})`,
                    insertValues
                );
                insertedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Import thành công! Thêm mới: ${insertedCount}, Cập nhật: ${updatedCount}, Tổng số dòng xử lý: ${rows.length}`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Lỗi import Excel:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        // Xóa file tạm
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

// (Tuỳ chọn) API lấy lịch sử của một lô
app.get('/api/lo-history/:id_lo', authenticateToken, async (req, res) => {
    const { id_lo } = req.params;
    try {
        const result = await pool.query(`
            SELECT * FROM lo_history
            WHERE id_lo = $1
            ORDER BY nam_cap_nhat_history DESC, ngay_luu DESC
        `, [id_lo]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ====================== CÁC TRANG (VIEW) ======================
// Trang đăng nhập (không cần xác thực)
app.get('/login', (req, res) => {
    if (req.cookies.token) {
        // Nếu đã có token thì chuyển về trang chủ
        return res.redirect('/');
    }
    res.render('login', { title: 'Đăng nhập' });
});

// Trang chủ và các trang khác đều yêu cầu đăng nhập
app.get('/', authenticateToken, (req, res) => {
    res.render('index', {
        title: 'WebGIS · Vườn Cây Cao Su',
        user: req.user,
        path: '/'
    });
});

app.get('/dashboard', authenticateToken, (req, res) => {
    res.render('index', {
        title: 'Dashboard - WebGIS Cao Su',
        user: req.user,
        path: '/dashboard'
    });
});

app.get('/quan-ly-lo-cay', authenticateToken, (req, res) => {
    res.render('quan-ly-lo-cay', {
        title: 'Quản lý lô cây cao su',
        user: req.user,
        path: '/quan-ly-lo-cay'
    });
});

app.get('/them-du-lieu-lo-cay', authenticateToken, (req, res) => {
    res.render('them-du-lieu-lo-cay', {
        title: 'Thêm dữ liệu lô cây',
        user: req.user,
        path: '/them-du-lieu-lo-cay'
    });
});

app.get('/thong-ke', authenticateToken, (req, res) => {
    res.render('thong-ke', {
        title: 'Thống kê vườn cây',
        user: req.user,
        path: '/thong-ke'
    });
});

app.get('/quan-ly-nguoi-dung', authenticateToken, (req, res) => {
    res.render('quan-ly-nguoi-dung', {
        title: 'Quản lý người dùng',
        user: req.user,
        path: '/quan-ly-nguoi-dung'
    });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Không tìm thấy trang', user: req.user || null, path: req.path });
});

// ====================== START SERVER ======================
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('🟢 Kết nối Neon Database thành công!');
    app.listen(port, () => {
      console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
      console.log(`🌐 Database: Neon (${process.env.DB_HOST})`);
      console.log(`🔐 Xác thực JWT đã được kích hoạt.`);
    });
  } catch (err) {
    console.error('❌ Không thể kết nối đến Neon Database:', err.message);
    process.exit(1);
  }
};

startServer();