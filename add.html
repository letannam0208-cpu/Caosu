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
        COUNT(DISTINCT l.id_lo) as tong_lo_cay,
        ROUND(SUM(COALESCE(dt.dien_tich_map, 0))::numeric, 3) as tong_dien_tich,
        COUNT(DISTINCT l.giong) as tong_giong,
        COUNT(DISTINCT dv.doi) as tong_doi
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
    `);
    res.json({ success: true, data: result.rows[0] || {} });
  } catch (err) {
    console.error('Lỗi /api/dashboard-stats:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy thống kê dashboard' });
  }
});

// Danh sách đơn vị (cho filter dropdown)
app.get('/api/don-vi-list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id_don_vi, doi FROM don_vi ORDER BY doi');
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
    const { doi, nam_trong, giong, phien_cao, nhip_do_cao, tai_canh_nam } = req.query;
    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND dv.doi = $${paramIndex++}`; }
    if (nam_trong) { params.push(parseInt(nam_trong)); whereClause += ` AND l.nam_trong = $${paramIndex++}`; }
    if (giong) { params.push(giong); whereClause += ` AND l.giong = $${paramIndex++}`; }
    if (phien_cao) { params.push(phien_cao); whereClause += ` AND kh.phien_cao = $${paramIndex++}`; }
    if (nhip_do_cao) { params.push(nhip_do_cao); whereClause += ` AND kh.nhip_do_cao = $${paramIndex++}`; }
    if (tai_canh_nam) { params.push(parseInt(tai_canh_nam)); whereClause += ` AND sl.tai_canh_nam = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT
        l.id_lo, l.ten_lo, l.giong, l.nam_trong,
        dv.doi, dv.du_an, dv.khu_vuc,
        dt.dien_tich_map,
        kh.che_do_cao, kh.phien_cao, kh.nhip_do_cao, kh.tuoi_cao,
        htc.cay_cao,
        sl.tai_canh_nam,
        ST_AsGeoJSON(ST_Transform(l.geometry, 4326)) AS geometry
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      LEFT JOIN san_luong sl ON l.id_lo = sl.id_lo
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
        khu_vuc: row.khu_vuc,          // thêm khu_vuc
        tuoi_cao: row.tuoi_cao          // thêm tuoi_cao
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
    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND dv.doi = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT 
        dv.doi,
        dv.du_an,
        dv.khu_vuc,
        ST_AsGeoJSON(ST_Transform(ST_Union(l.geometry), 4326)) as geometry
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      ${whereClause}
      GROUP BY dv.doi, dv.du_an, dv.khu_vuc
      ORDER BY dv.doi
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
        l.id_lo, l.ten_lo, l.nam_trong, l.giong, l.cao_trinh_tb,
        dv.id_don_vi, dv.doi, dv.du_an, dv.khu_vuc,
        hc.xa, hc.huyen, hc.tinh,
        dt.dien_tich_map, dt.dien_tich_010125, dt.dien_tich_010126,
        htc.tong_ho_kk, htc.cay_cao, htc.cay_chua_cao, htc.cay_kho_mu, htc.cay_khong_pt, htc.ho_trong, htc.mat_do_cc,
        kh.che_do_cao, kh.phien_cao, kh.nhip_do_cao, kh.nam_mc, kh.tuoi_cao, kh.nam_cao_up, kh.tinh_trang_mc,
        sl.ns25_kg_ha, sl.ns25_kg_cay, sl.ns26_kg_ha, sl.ns26_kg_cay, sl.tong_lat_cao, sl.san_luong, sl.phan_loai, sl.doi_tuong, sl.tai_canh_nam,
        ttt.hang_dat, ttt.phuong_phap_trong, ttt.khoang_cach_trong, ttt.mat_do_tk
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN hanh_chinh hc ON l.id_hc = hc.id_hc
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN san_luong sl ON l.id_lo = sl.id_lo
      LEFT JOIN thong_tin_trong ttt ON l.id_lo = ttt.id_lo
      ORDER BY l.ten_lo
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
    const result = await pool.query(`
      SELECT
        l.*,
        dv.doi, dv.du_an, dv.khu_vuc, dv.id_don_vi,
        hc.xa, hc.huyen, hc.tinh,
        dt.*,
        htc.*,
        kh.*,
        sl.*,
        ttt.*
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN hanh_chinh hc ON l.id_hc = hc.id_hc
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN san_luong sl ON l.id_lo = sl.id_lo
      LEFT JOIN thong_tin_trong ttt ON l.id_lo = ttt.id_lo
      WHERE l.id_lo = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy lô cây' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lo-cay', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      ten_lo, nam_trong, giong, cao_trinh_tb,
      id_don_vi, id_hc,
      dien_tich_map, dien_tich_010125, dien_tich_010126,
      tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
      che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
      ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
      hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
    } = req.body;

    const id_lo = 'LO_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

    await client.query(`
      INSERT INTO lo (id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc]);

    if (dien_tich_map !== undefined && dien_tich_map !== null && dien_tich_map !== '') {
      await client.query(`
        INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
        VALUES ('DT_' || $1, $1, $2, $3, $4)
      `, [id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
    }
    if (tong_ho_kk !== undefined && tong_ho_kk !== null && tong_ho_kk !== '') {
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ('HTC_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
      `, [id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
    }
    if (che_do_cao && che_do_cao !== '') {
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ('KT_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
      `, [id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
    }
    if (san_luong !== undefined && san_luong !== null && san_luong !== '') {
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ('SL_' || $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]);
    }
    if (hang_dat && hang_dat !== '') {
      await client.query(`
        INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
        VALUES ('TTT_' || $1, $1, $2, $3, $4, $5)
      `, [id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Thêm lô cây thành công', id: id_lo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi thêm lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ====================== API CẬP NHẬT LÔ CÂY (ĐÃ SỬA) ======================
app.put('/api/lo-cay/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const id_lo = req.params.id;
  try {
    await client.query('BEGIN');
    const {
      ten_lo, nam_trong, giong, cao_trinh_tb,
      id_don_vi, id_hc,
      dien_tich_map, dien_tich_010125, dien_tich_010126,
      tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
      che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
      ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam,
      hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk
    } = req.body;

    // Cập nhật bảng lo
    await client.query(`
      UPDATE lo SET
        ten_lo = $1, nam_trong = $2, giong = $3, cao_trinh_tb = $4,
        id_don_vi = $5, id_hc = $6
      WHERE id_lo = $7
    `, [ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc, id_lo]);

    // Upsert dien_tich
    if (dien_tich_map !== undefined) {
      await client.query(`
        INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
        VALUES ('DT_' || $1, $1, $2, $3, $4)
        ON CONFLICT (id_lo) DO UPDATE SET
          dien_tich_map = EXCLUDED.dien_tich_map,
          dien_tich_010125 = EXCLUDED.dien_tich_010125,
          dien_tich_010126 = EXCLUDED.dien_tich_010126
      `, [id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
    }
    // Upsert hien_trang_cay
    if (tong_ho_kk !== undefined) {
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ('HTC_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_lo) DO UPDATE SET
          tong_ho_kk = EXCLUDED.tong_ho_kk,
          cay_cao = EXCLUDED.cay_cao,
          cay_chua_cao = EXCLUDED.cay_chua_cao,
          cay_kho_mu = EXCLUDED.cay_kho_mu,
          cay_khong_pt = EXCLUDED.cay_khong_pt,
          ho_trong = EXCLUDED.ho_trong,
          mat_do_cc = EXCLUDED.mat_do_cc
      `, [id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
    }
    // Upsert khai_thac
    if (che_do_cao !== undefined) {
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ('KT_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_lo) DO UPDATE SET
          che_do_cao = EXCLUDED.che_do_cao,
          phien_cao = EXCLUDED.phien_cao,
          nhip_do_cao = EXCLUDED.nhip_do_cao,
          nam_mc = EXCLUDED.nam_mc,
          tuoi_cao = EXCLUDED.tuoi_cao,
          nam_cao_up = EXCLUDED.nam_cao_up,
          tinh_trang_mc = EXCLUDED.tinh_trang_mc
      `, [id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
    }
    // Upsert san_luong (quan trọng: dùng id_lo làm conflict)
    if (san_luong !== undefined) {
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ('SL_' || $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id_lo) DO UPDATE SET
          ns25_kg_ha = EXCLUDED.ns25_kg_ha,
          ns25_kg_cay = EXCLUDED.ns25_kg_cay,
          ns26_kg_ha = EXCLUDED.ns26_kg_ha,
          ns26_kg_cay = EXCLUDED.ns26_kg_cay,
          tong_lat_cao = EXCLUDED.tong_lat_cao,
          san_luong = EXCLUDED.san_luong,
          phan_loai = EXCLUDED.phan_loai,
          doi_tuong = EXCLUDED.doi_tuong,
          tai_canh_nam = EXCLUDED.tai_canh_nam
      `, [id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]);
    }
    // Upsert thong_tin_trong
    if (hang_dat !== undefined) {
      await client.query(`
        INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
        VALUES ('TTT_' || $1, $1, $2, $3, $4, $5)
        ON CONFLICT (id_lo) DO UPDATE SET
          hang_dat = EXCLUDED.hang_dat,
          phuong_phap_trong = EXCLUDED.phuong_phap_trong,
          khoang_cach_trong = EXCLUDED.khoang_cach_trong,
          mat_do_tk = EXCLUDED.mat_do_tk
      `, [id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật lô cây thành công' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi cập nhật lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ====================== API XÓA LÔ CÂY ======================
app.delete('/api/lo-cay/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const id_lo = req.params.id;
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM dien_tich WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM hien_trang_cay WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM khai_thac WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM san_luong WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM thong_tin_trong WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM lo WHERE id_lo = $1', [id_lo]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Xóa lô cây thành công' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi xóa lô cây:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ====================== API UPSERT CHO CÁC BẢNG (Hỗ trợ nhập file) ======================
// UPSERT cho bảng lô cây
app.post('/api/lo-cay/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const {
      id_lo, ten_lo, nam_trong, giong, cao_trinh_tb,
      id_don_vi, id_hc
    } = req.body;

    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }

    await client.query('BEGIN');
    
    const existing = await client.query('SELECT * FROM lo WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ 
          success: true, 
          action: 'skip',
          message: `Bỏ qua (ID ${id_lo} đã tồn tại)`
        });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (ten_lo !== undefined) { updateFields.push(`ten_lo = $${paramIndex++}`); updateValues.push(ten_lo); }
      if (nam_trong !== undefined) { updateFields.push(`nam_trong = $${paramIndex++}`); updateValues.push(nam_trong); }
      if (giong !== undefined) { updateFields.push(`giong = $${paramIndex++}`); updateValues.push(giong); }
      if (cao_trinh_tb !== undefined) { updateFields.push(`cao_trinh_tb = $${paramIndex++}`); updateValues.push(cao_trinh_tb); }
      if (id_don_vi !== undefined) { updateFields.push(`id_don_vi = $${paramIndex++}`); updateValues.push(id_don_vi); }
      if (id_hc !== undefined) { updateFields.push(`id_hc = $${paramIndex++}`); updateValues.push(id_hc); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE lo SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ 
        success: true, 
        action: 'update',
        message: `Cập nhật lô ${id_lo} thành công`
      });
    } else {
      await client.query(`
        INSERT INTO lo (id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc]);
      
      await client.query('COMMIT');
      res.json({ 
        success: true, 
        action: 'insert',
        message: `Thêm mới lô ${id_lo} thành công`
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT lo-cay:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng đơn vị (giữ nguyên)
app.post('/api/don-vi/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_don_vi, du_an, doi, khu_vuc } = req.body;
    
    if (!id_don_vi) {
      return res.status(400).json({ success: false, error: 'Thiếu id_don_vi' });
    }
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM don_vi WHERE id_don_vi = $1', [id_don_vi]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (ID ${id_don_vi} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (du_an !== undefined) { updateFields.push(`du_an = $${paramIndex++}`); updateValues.push(du_an); }
      if (doi !== undefined) { updateFields.push(`doi = $${paramIndex++}`); updateValues.push(doi); }
      if (khu_vuc !== undefined) { updateFields.push(`khu_vuc = $${paramIndex++}`); updateValues.push(khu_vuc); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_don_vi);
        await client.query(
          `UPDATE don_vi SET ${updateFields.join(', ')} WHERE id_don_vi = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật đơn vị ${id_don_vi} thành công` });
    } else {
      await client.query(
        'INSERT INTO don_vi (id_don_vi, du_an, doi, khu_vuc) VALUES ($1, $2, $3, $4)',
        [id_don_vi, du_an, doi, khu_vuc]
      );
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới đơn vị ${id_don_vi} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT don-vi:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng hành chính
app.post('/api/hanh-chinh/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_hc, xa, huyen, tinh } = req.body;
    
    if (!id_hc) {
      return res.status(400).json({ success: false, error: 'Thiếu id_hc' });
    }
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM hanh_chinh WHERE id_hc = $1', [id_hc]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (ID ${id_hc} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (xa !== undefined) { updateFields.push(`xa = $${paramIndex++}`); updateValues.push(xa); }
      if (huyen !== undefined) { updateFields.push(`huyen = $${paramIndex++}`); updateValues.push(huyen); }
      if (tinh !== undefined) { updateFields.push(`tinh = $${paramIndex++}`); updateValues.push(tinh); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_hc);
        await client.query(
          `UPDATE hanh_chinh SET ${updateFields.join(', ')} WHERE id_hc = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật hành chính ${id_hc} thành công` });
    } else {
      await client.query(
        'INSERT INTO hanh_chinh (id_hc, xa, huyen, tinh) VALUES ($1, $2, $3, $4)',
        [id_hc, xa, huyen, tinh]
      );
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới hành chính ${id_hc} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT hanh-chinh:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng diện tích
app.post('/api/dien-tich/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126 } = req.body;
    
    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }
    
    const finalId = id_dien_tich || `DT_${id_lo}`;
    
    await client.query('BEGIN');
    
    // Kiểm tra tồn tại theo id_lo
    const existing = await client.query('SELECT * FROM dien_tich WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (diện tích lô ${id_lo} đã tồn tại)` });
      }
      
      // Cập nhật theo id_lo
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (dien_tich_map !== undefined) { updateFields.push(`dien_tich_map = $${paramIndex++}`); updateValues.push(dien_tich_map); }
      if (dien_tich_010125 !== undefined) { updateFields.push(`dien_tich_010125 = $${paramIndex++}`); updateValues.push(dien_tich_010125); }
      if (dien_tich_010126 !== undefined) { updateFields.push(`dien_tich_010126 = $${paramIndex++}`); updateValues.push(dien_tich_010126); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE dien_tich SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật diện tích cho lô ${id_lo} thành công` });
    } else {
      await client.query(`
        INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
        VALUES ($1, $2, $3, $4, $5)
      `, [finalId, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới diện tích cho lô ${id_lo} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT dien-tich:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng hiện trạng cây
app.post('/api/hien-trang-cay/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
    
    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }
    
    const finalId = id_htc || `HTC_${id_lo}`;
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM hien_trang_cay WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (hiện trạng lô ${id_lo} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (tong_ho_kk !== undefined) { updateFields.push(`tong_ho_kk = $${paramIndex++}`); updateValues.push(tong_ho_kk); }
      if (cay_cao !== undefined) { updateFields.push(`cay_cao = $${paramIndex++}`); updateValues.push(cay_cao); }
      if (cay_chua_cao !== undefined) { updateFields.push(`cay_chua_cao = $${paramIndex++}`); updateValues.push(cay_chua_cao); }
      if (cay_kho_mu !== undefined) { updateFields.push(`cay_kho_mu = $${paramIndex++}`); updateValues.push(cay_kho_mu); }
      if (cay_khong_pt !== undefined) { updateFields.push(`cay_khong_pt = $${paramIndex++}`); updateValues.push(cay_khong_pt); }
      if (ho_trong !== undefined) { updateFields.push(`ho_trong = $${paramIndex++}`); updateValues.push(ho_trong); }
      if (mat_do_cc !== undefined) { updateFields.push(`mat_do_cc = $${paramIndex++}`); updateValues.push(mat_do_cc); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE hien_trang_cay SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật hiện trạng cho lô ${id_lo} thành công` });
    } else {
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [finalId, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới hiện trạng cho lô ${id_lo} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT hien-trang-cay:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng khai thác
app.post('/api/khai-thac/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
    
    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }
    
    const finalId = id_kt || `KT_${id_lo}`;
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM khai_thac WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (khai thác lô ${id_lo} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (che_do_cao !== undefined) { updateFields.push(`che_do_cao = $${paramIndex++}`); updateValues.push(che_do_cao); }
      if (phien_cao !== undefined) { updateFields.push(`phien_cao = $${paramIndex++}`); updateValues.push(phien_cao); }
      if (nhip_do_cao !== undefined) { updateFields.push(`nhip_do_cao = $${paramIndex++}`); updateValues.push(nhip_do_cao); }
      if (nam_mc !== undefined) { updateFields.push(`nam_mc = $${paramIndex++}`); updateValues.push(nam_mc); }
      if (tuoi_cao !== undefined) { updateFields.push(`tuoi_cao = $${paramIndex++}`); updateValues.push(tuoi_cao); }
      if (nam_cao_up !== undefined) { updateFields.push(`nam_cao_up = $${paramIndex++}`); updateValues.push(nam_cao_up); }
      if (tinh_trang_mc !== undefined) { updateFields.push(`tinh_trang_mc = $${paramIndex++}`); updateValues.push(tinh_trang_mc); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE khai_thac SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật khai thác cho lô ${id_lo} thành công` });
    } else {
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [finalId, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới khai thác cho lô ${id_lo} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT khai-thac:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng sản lượng
app.post('/api/san-luong/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
    
    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }
    
    const finalId = id_sl || `SL_${id_lo}`;
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM san_luong WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (sản lượng lô ${id_lo} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (ns25_kg_ha !== undefined) { updateFields.push(`ns25_kg_ha = $${paramIndex++}`); updateValues.push(ns25_kg_ha); }
      if (ns25_kg_cay !== undefined) { updateFields.push(`ns25_kg_cay = $${paramIndex++}`); updateValues.push(ns25_kg_cay); }
      if (ns26_kg_ha !== undefined) { updateFields.push(`ns26_kg_ha = $${paramIndex++}`); updateValues.push(ns26_kg_ha); }
      if (ns26_kg_cay !== undefined) { updateFields.push(`ns26_kg_cay = $${paramIndex++}`); updateValues.push(ns26_kg_cay); }
      if (tong_lat_cao !== undefined) { updateFields.push(`tong_lat_cao = $${paramIndex++}`); updateValues.push(tong_lat_cao); }
      if (san_luong !== undefined) { updateFields.push(`san_luong = $${paramIndex++}`); updateValues.push(san_luong); }
      if (phan_loai !== undefined) { updateFields.push(`phan_loai = $${paramIndex++}`); updateValues.push(phan_loai); }
      if (doi_tuong !== undefined) { updateFields.push(`doi_tuong = $${paramIndex++}`); updateValues.push(doi_tuong); }
      if (tai_canh_nam !== undefined) { updateFields.push(`tai_canh_nam = $${paramIndex++}`); updateValues.push(tai_canh_nam); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE san_luong SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật sản lượng cho lô ${id_lo} thành công` });
    } else {
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [finalId, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]);
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới sản lượng cho lô ${id_lo} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT san-luong:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// UPSERT cho bảng thông tin trồng
app.post('/api/thong-tin-trong/upsert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const importMode = req.headers['x-import-mode'] || 'upsert';
  
  try {
    const { id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
    
    if (!id_lo) {
      return res.status(400).json({ success: false, error: 'Thiếu id_lo' });
    }
    
    const finalId = id_ttt || `TTT_${id_lo}`;
    
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM thong_tin_trong WHERE id_lo = $1', [id_lo]);
    
    if (existing.rows.length > 0) {
      if (importMode === 'insert') {
        await client.query('COMMIT');
        return res.json({ success: true, action: 'skip', message: `Bỏ qua (thông tin trồng lô ${id_lo} đã tồn tại)` });
      }
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (hang_dat !== undefined) { updateFields.push(`hang_dat = $${paramIndex++}`); updateValues.push(hang_dat); }
      if (phuong_phap_trong !== undefined) { updateFields.push(`phuong_phap_trong = $${paramIndex++}`); updateValues.push(phuong_phap_trong); }
      if (khoang_cach_trong !== undefined) { updateFields.push(`khoang_cach_trong = $${paramIndex++}`); updateValues.push(khoang_cach_trong); }
      if (mat_do_tk !== undefined) { updateFields.push(`mat_do_tk = $${paramIndex++}`); updateValues.push(mat_do_tk); }
      
      if (updateFields.length > 0) {
        updateValues.push(id_lo);
        await client.query(
          `UPDATE thong_tin_trong SET ${updateFields.join(', ')} WHERE id_lo = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true, action: 'update', message: `Cập nhật thông tin trồng cho lô ${id_lo} thành công` });
    } else {
      await client.query(`
        INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [finalId, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]);
      await client.query('COMMIT');
      res.json({ success: true, action: 'insert', message: `Thêm mới thông tin trồng cho lô ${id_lo} thành công` });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi UPSERT thong-tin-trong:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ====================== API CHO CÁC BẢNG KHÁC ======================
// ĐƠN VỊ
app.get('/api/don-vi', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM don_vi ORDER BY doi');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/don-vi/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM don_vi WHERE id_don_vi = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/don-vi', authenticateToken, async (req, res) => {
  const { id_don_vi, du_an, doi, khu_vuc } = req.body;
  const finalId = id_don_vi || `DV_${Date.now()}`;
  try {
    await pool.query(
      'INSERT INTO don_vi (id_don_vi, du_an, doi, khu_vuc) VALUES ($1, $2, $3, $4)',
      [finalId, du_an, doi, khu_vuc]
    );
    res.json({ success: true, message: 'Thêm đơn vị thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/don-vi/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { du_an, doi, khu_vuc } = req.body;
  try {
    await pool.query(
      'UPDATE don_vi SET du_an=$1, doi=$2, khu_vuc=$3 WHERE id_don_vi=$4',
      [du_an, doi, khu_vuc, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/don-vi/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM don_vi WHERE id_don_vi=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HÀNH CHÍNH
app.get('/api/hanh-chinh', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hanh_chinh ORDER BY xa');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/hanh-chinh/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM hanh_chinh WHERE id_hc = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/hanh-chinh', authenticateToken, async (req, res) => {
  const { id_hc, xa, huyen, tinh } = req.body;
  const finalId = id_hc || `HC_${Date.now()}`;
  try {
    await pool.query(
      'INSERT INTO hanh_chinh (id_hc, xa, huyen, tinh) VALUES ($1, $2, $3, $4)',
      [finalId, xa, huyen, tinh]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hanh-chinh/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { xa, huyen, tinh } = req.body;
  try {
    await pool.query(
      'UPDATE hanh_chinh SET xa=$1, huyen=$2, tinh=$3 WHERE id_hc=$4',
      [xa, huyen, tinh, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/hanh-chinh/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hanh_chinh WHERE id_hc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DIỆN TÍCH
app.get('/api/dien-tich', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT dt.*, l.ten_lo FROM dien_tich dt
      LEFT JOIN lo l ON dt.id_lo = l.id_lo
      ORDER BY l.ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/dien-tich/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT dt.*, l.ten_lo FROM dien_tich dt
      LEFT JOIN lo l ON dt.id_lo = l.id_lo
      WHERE dt.id_dien_tich = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/dien-tich', authenticateToken, async (req, res) => {
  const { id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126 } = req.body;
  const finalId = id_dien_tich || `DT_${id_lo}_${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
       VALUES ($1, $2, $3, $4, $5)`,
      [finalId, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/dien-tich/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { dien_tich_map, dien_tich_010125, dien_tich_010126, id_lo } = req.body;
  try {
    await pool.query(
      `UPDATE dien_tich SET id_lo=$1, dien_tich_map=$2, dien_tich_010125=$3, dien_tich_010126=$4
       WHERE id_dien_tich=$5`,
      [id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/dien-tich/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM dien_tich WHERE id_dien_tich=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HIỆN TRẠNG CÂY
app.get('/api/hien-trang-cay', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT htc.*, l.ten_lo FROM hien_trang_cay htc
      LEFT JOIN lo l ON htc.id_lo = l.id_lo
      ORDER BY l.ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/hien-trang-cay/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT htc.*, l.ten_lo FROM hien_trang_cay htc
      LEFT JOIN lo l ON htc.id_lo = l.id_lo
      WHERE htc.id_htc = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/hien-trang-cay', authenticateToken, async (req, res) => {
  const { id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
  const finalId = id_htc || `HTC_${id_lo}_${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [finalId, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hien-trang-cay/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
  try {
    await pool.query(
      `UPDATE hien_trang_cay SET id_lo=$1, tong_ho_kk=$2, cay_cao=$3, cay_chua_cao=$4,
       cay_kho_mu=$5, cay_khong_pt=$6, ho_trong=$7, mat_do_cc=$8
       WHERE id_htc=$9`,
      [id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/hien-trang-cay/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hien_trang_cay WHERE id_htc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// KHAI THÁC
app.get('/api/khai-thac', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT kh.*, l.ten_lo FROM khai_thac kh
      LEFT JOIN lo l ON kh.id_lo = l.id_lo
      ORDER BY l.ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/khai-thac/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT kh.*, l.ten_lo FROM khai_thac kh
      LEFT JOIN lo l ON kh.id_lo = l.id_lo
      WHERE kh.id_kt = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/khai-thac', authenticateToken, async (req, res) => {
  const { id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
  const finalId = id_kt || `KT_${id_lo}_${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [finalId, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/khai-thac/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
  try {
    await pool.query(
      `UPDATE khai_thac SET id_lo=$1, che_do_cao=$2, phien_cao=$3, nhip_do_cao=$4,
       nam_mc=$5, tuoi_cao=$6, nam_cao_up=$7, tinh_trang_mc=$8
       WHERE id_kt=$9`,
      [id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/khai-thac/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM khai_thac WHERE id_kt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SẢN LƯỢNG
app.get('/api/san-luong', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sl.*, l.ten_lo FROM san_luong sl
      LEFT JOIN lo l ON sl.id_lo = l.id_lo
      ORDER BY l.ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/san-luong/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT sl.*, l.ten_lo FROM san_luong sl
      LEFT JOIN lo l ON sl.id_lo = l.id_lo
      WHERE sl.id_sl = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/san-luong', authenticateToken, async (req, res) => {
  const { id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
  const finalId = id_sl || `SL_${id_lo}_${Date.now()}`; 
  try {
    await pool.query(
      `INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [finalId, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/san-luong/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
  try {
    await pool.query(
      `UPDATE san_luong SET id_lo=$1, ns25_kg_ha=$2, ns25_kg_cay=$3, ns26_kg_ha=$4,
       ns26_kg_cay=$5, tong_lat_cao=$6, san_luong=$7, phan_loai=$8, doi_tuong=$9, tai_canh_nam=$10
       WHERE id_sl=$11`,
      [id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/san-luong/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM san_luong WHERE id_sl=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// THÔNG TIN TRỒNG
app.get('/api/thong-tin-trong', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ttt.*, l.ten_lo FROM thong_tin_trong ttt
      LEFT JOIN lo l ON ttt.id_lo = l.id_lo
      ORDER BY l.ten_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Thông tin trồng theo id
app.get('/api/thong-tin-trong/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT ttt.*, l.ten_lo FROM thong_tin_trong ttt
      LEFT JOIN lo l ON ttt.id_lo = l.id_lo
      WHERE ttt.id_ttt = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/thong-tin-trong', authenticateToken, async (req, res) => {
  const { id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
  const finalId = id_ttt || `TTT_${id_lo}_${Date.now()}`; 
  try {
    await pool.query(
      `INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [finalId, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/thong-tin-trong/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
  try {
    await pool.query(
      `UPDATE thong_tin_trong SET id_lo=$1, hang_dat=$2, phuong_phap_trong=$3, khoang_cach_trong=$4, mat_do_tk=$5
       WHERE id_ttt=$6`,
      [id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/thong-tin-trong/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM thong_tin_trong WHERE id_ttt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
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