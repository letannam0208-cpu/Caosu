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
  max: 5,                        // Neon free tier: giảm số connection
  idleTimeoutMillis: 20000,      // Đóng connection idle sau 20s
  connectionTimeoutMillis: 30000, // Chờ kết nối tối đa 30s (Neon cold start)
  statement_timeout: 120000,     // 120 giây cho query lớn
  query_timeout: 120000,
  keepAlive: true,               // Giữ kết nối sống
  keepAliveInitialDelayMillis: 10000,
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

// Giống cây
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
    let whereClause = 'WHERE geojson IS NOT NULL';
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
        id_lo, ten_lo, nam_trong, cao_trinh_tb, giong, du_an, doi, khu_vuc,
        hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk,
        dien_tich_010125, dien_tich_010126, dien_tich_map, tong_ho_kk,
        cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc,
        che_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc,
        ns25_kg_ha, ns25_kg_cay, tong_lat_cao, ns26_kg_cay, phan_loai,
        xa, huyen, tinh, ns26_kg_ha, san_luong, phien_cao, nhip_do_cao,
        tai_canh_nam, doi_tuong, nam_cap_nhat,
        geojson
      FROM lo
      ${whereClause}
    `, params);

    const features = result.rows
      .filter(row => row.geojson)
      .map(row => {
        let geojsonObj;
        try {
          geojsonObj = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
        } catch (e) {
          console.error(`Lỗi parse geojson cho lô ${row.id_lo}:`, e.message);
          return null;
        }

        let feature;
        if (geojsonObj.type === 'Feature') {
          feature = geojsonObj;
        } else {
          feature = {
            type: "Feature",
            geometry: geojsonObj,
            properties: {}
          };
        }

        // Gán toàn bộ các trường từ database vào properties
        feature.properties = {
          id_lo: row.id_lo,
          ten_lo: row.ten_lo,
          nam_trong: row.nam_trong,
          cao_trinh_tb: row.cao_trinh_tb,
          giong: row.giong,
          du_an: row.du_an,
          doi: row.doi,
          khu_vuc: row.khu_vuc,
          hang_dat: row.hang_dat,
          phuong_phap_trong: row.phuong_phap_trong,
          khoang_cach_trong: row.khoang_cach_trong,
          mat_do_tk: row.mat_do_tk,
          dien_tich_010125: row.dien_tich_010125,
          dien_tich_010126: row.dien_tich_010126,
          dien_tich_map: row.dien_tich_map,
          tong_ho_kk: row.tong_ho_kk,
          cay_cao: row.cay_cao,
          cay_chua_cao: row.cay_chua_cao,
          cay_kho_mu: row.cay_kho_mu,
          cay_khong_pt: row.cay_khong_pt,
          ho_trong: row.ho_trong,
          mat_do_cc: row.mat_do_cc,
          che_do_cao: row.che_do_cao,
          nam_mc: row.nam_mc,
          tuoi_cao: row.tuoi_cao,
          nam_cao_up: row.nam_cao_up,
          tinh_trang_mc: row.tinh_trang_mc,
          ns25_kg_ha: row.ns25_kg_ha,
          ns25_kg_cay: row.ns25_kg_cay,
          tong_lat_cao: row.tong_lat_cao,
          ns26_kg_cay: row.ns26_kg_cay,
          phan_loai: row.phan_loai,
          xa: row.xa,
          huyen: row.huyen,
          tinh: row.tinh,
          ns26_kg_ha: row.ns26_kg_ha,
          san_luong: row.san_luong,
          phien_cao: row.phien_cao,
          nhip_do_cao: row.nhip_do_cao,
          tai_canh_nam: row.tai_canh_nam,
          doi_tuong: row.doi_tuong,
          nam_cap_nhat: row.nam_cap_nhat
        };
        return feature;
      })
      .filter(f => f !== null);

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
    let whereClause = 'WHERE geojson IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND doi = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT 
        doi,
        du_an,
        khu_vuc,
        geojson
      FROM lo
      ${whereClause}
    `, params);

    const features = result.rows
      .filter(row => row.geojson)
      .map(row => {
        let geojsonObj;
        try {
          geojsonObj = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
        } catch (e) {
          return null;
        }
        let feature;
        if (geojsonObj.type === 'Feature') {
          feature = geojsonObj;
        } else {
          feature = {
            type: "Feature",
            geometry: geojsonObj,
            properties: {}
          };
        }
        feature.properties = {
          doi: row.doi || 'Toàn vùng',
          du_an: row.du_an,
          khu_vuc: row.khu_vuc,
          type: 'boundary'
        };
        return feature;
      })
      .filter(f => f !== null);

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
            sameSite: 'lax'
            // không set maxAge/expires → session cookie, tự xóa khi đóng trình duyệt
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

// ====================== IMPORT EXCEL & LƯU LỊCH SỬ (FIXED VERSION) ======================
const multer = require('multer');
const XLSX = require('xlsx');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Các cột cố định
const fixedColumns = ['id_lo', 'geojson', 'xa', 'huyen', 'tinh'];

// Các cột có thể cập nhật
const updatableCols = [
    'ten_lo',
    'nam_trong', 'cao_trinh_tb', 'giong', 'du_an', 'doi', 'khu_vuc',
    'hang_dat', 'phuong_phap_trong', 'khoang_cach_trong', 'mat_do_tk',
    'dien_tich_010125', 'dien_tich_010126', 'dien_tich_map', 'tong_ho_kk',
    'cay_cao', 'cay_chua_cao', 'cay_kho_mu', 'cay_khong_pt', 'ho_trong', 'mat_do_cc',
    'che_do_cao', 'nam_mc', 'tuoi_cao', 'nam_cao_up', 'tinh_trang_mc',
    'ns25_kg_ha', 'ns25_kg_cay', 'tong_lat_cao', 'ns26_kg_cay', 'phan_loai',
    'ns26_kg_ha', 'san_luong', 'phien_cao', 'nhip_do_cao', 'tai_canh_nam', 'doi_tuong'
];

app.post('/api/import-excel', authenticateToken, upload.single('file'), async (req, res) => {
    const { nam_cap_nhat } = req.body;
    if (!nam_cap_nhat) {
        return res.status(400).json({ success: false, error: 'Vui lòng cung cấp năm cập nhật' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Chưa chọn file Excel' });
    }
    try {
        console.log('🚀 Bắt đầu import file Excel');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) throw new Error('File Excel không có dữ liệu');
        console.log(`📊 Số dòng cần xử lý: ${rows.length}`);

        // Chuyển đổi số thập phân dấu phẩy thành dấu chấm
        const parseDecimal = (val) => {
            if (val === undefined || val === null || val === "") return null;
            if (typeof val === 'number') return val;
            const str = String(val).trim().replace(',', '.');
            const num = parseFloat(str);
            return isNaN(num) ? null : num;
        };

        // Xử lý từng dòng: chuyển đổi các cột số
        rows = rows.map(row => {
            const newRow = {};
            for (const [key, value] of Object.entries(row)) {
                const numberCols = [
                    'cao_trinh_tb', 'dien_tich_010125', 'dien_tich_010126', 'dien_tich_map',
                    'mat_do_cc', 'ns25_kg_ha', 'ns25_kg_cay', 'tong_lat_cao', 'ns26_kg_cay',
                    'ns26_kg_ha', 'san_luong', 'mat_do_tk', 'tong_ho_kk', 'cay_cao', 'cay_chua_cao',
                    'cay_kho_mu', 'cay_khong_pt', 'ho_trong', 'nam_trong', 'tuoi_cao', 'nam_cao_up',
                    'tai_canh_nam'
                ];
                if (numberCols.includes(key)) {
                    newRow[key] = parseDecimal(value);
                } else {
                    const trimmed = (value === undefined || value === null) ? '' : String(value).trim();
                    newRow[key] = trimmed === '' ? null : trimmed;
                }
            }
            return newRow;
        });

        const client = await pool.connect();
        await client.query('BEGIN');

        // 1. Kiểm tra bảng lo_history tồn tại
        const checkHistory = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'lo_history'
            );
        `);
        if (!checkHistory.rows[0].exists) {
            throw new Error('Bảng lo_history chưa được tạo. Vui lòng chạy script tạo bảng trước.');
        }

        // 2. Xóa bảng tạm nếu tồn tại (tránh lỗi "already exists")
        await client.query(`DROP TABLE IF EXISTS temp_import`);
        // Tạo bảng tạm mới
        await client.query(`
            CREATE TEMP TABLE temp_import (
                id_lo VARCHAR(50) PRIMARY KEY,
                ten_lo VARCHAR(255),
                nam_trong INTEGER,
                cao_trinh_tb DOUBLE PRECISION,
                giong VARCHAR(100),
                du_an VARCHAR(255),
                doi VARCHAR(100),
                khu_vuc VARCHAR(100),
                hang_dat VARCHAR(100),
                phuong_phap_trong VARCHAR(100),
                khoang_cach_trong VARCHAR(50),
                mat_do_tk INTEGER,
                dien_tich_010125 DOUBLE PRECISION,
                dien_tich_010126 DOUBLE PRECISION,
                dien_tich_map DOUBLE PRECISION,
                tong_ho_kk INTEGER,
                cay_cao INTEGER,
                cay_chua_cao INTEGER,
                cay_kho_mu INTEGER,
                cay_khong_pt INTEGER,
                ho_trong INTEGER,
                mat_do_cc DOUBLE PRECISION,
                che_do_cao VARCHAR(100),
                nam_mc INTEGER,
                tuoi_cao INTEGER,
                nam_cao_up INTEGER,
                tinh_trang_mc VARCHAR(100),
                ns25_kg_ha DOUBLE PRECISION,
                ns25_kg_cay DOUBLE PRECISION,
                tong_lat_cao DOUBLE PRECISION,
                ns26_kg_cay DOUBLE PRECISION,
                phan_loai VARCHAR(100),
                xa VARCHAR(100),
                huyen VARCHAR(100),
                tinh VARCHAR(100),
                ns26_kg_ha DOUBLE PRECISION,
                san_luong DOUBLE PRECISION,
                phien_cao VARCHAR(50),
                nhip_do_cao VARCHAR(50),
                tai_canh_nam INTEGER,
                doi_tuong VARCHAR(100),
                geojson JSONB
            )
        `);
        console.log('✅ Đã tạo bảng tạm');

        // Lấy danh sách cột của bảng tạm để lọc
        const tempColsRes = await client.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name='temp_import'
        `);
        const tempColumnsSet = new Set(tempColsRes.rows.map(r => r.column_name));

        // 3. Chèn dữ liệu vào bảng tạm (chỉ lấy cột tồn tại trong temp_import)
        for (const row of rows) {
            const id_lo = row.ID_lo || row.id_lo;
            if (!id_lo) continue;
            const columns = Object.keys(row).filter(k => k !== 'ID_lo' && k !== 'id_lo' && tempColumnsSet.has(k));
            const values = columns.map(c => row[c]);
            const placeholders = columns.map((_, i) => `$${i+2}`).join(',');
            const insertSql = `
                INSERT INTO temp_import (id_lo, ${columns.join(',')})
                VALUES ($1, ${placeholders})
                ON CONFLICT (id_lo) DO UPDATE SET
                ${columns.map(c => `${c}=EXCLUDED.${c}`).join(',')}
            `;
            await client.query(insertSql, [id_lo, ...values]);
        }
        console.log('✅ Đã chèn dữ liệu vào bảng tạm');

        // 4. Lấy danh sách id_lo đã tồn tại
        const existingIdsRes = await client.query(`
            SELECT id_lo FROM lo WHERE id_lo IN (SELECT id_lo FROM temp_import)
        `);
        const existingIds = existingIdsRes.rows.map(r => r.id_lo);
        console.log(`📌 Số lô đã tồn tại: ${existingIds.length}`);

        // 5. Lưu lịch sử (chỉ lô đã tồn tại)
        if (existingIds.length > 0) {
            await client.query(`
                INSERT INTO lo_history (
                    id_lo, ten_lo, nam_trong, cao_trinh_tb, giong,
                    du_an, doi, khu_vuc, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk,
                    dien_tich_010125, dien_tich_010126, dien_tich_map, tong_ho_kk, cay_cao, cay_chua_cao,
                    cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc, che_do_cao, nam_mc, tuoi_cao,
                    nam_cao_up, tinh_trang_mc, ns25_kg_ha, ns25_kg_cay, tong_lat_cao, ns26_kg_cay,
                    phan_loai, xa, huyen, tinh, ns26_kg_ha, san_luong, phien_cao, nhip_do_cao,
                    tai_canh_nam, doi_tuong, geojson, nam_cap_nhat_history, ngay_luu
                )
                SELECT 
                    l.id_lo, l.ten_lo, l.nam_trong, l.cao_trinh_tb, l.giong,
                    l.du_an, l.doi, l.khu_vuc, l.hang_dat, l.phuong_phap_trong, l.khoang_cach_trong, l.mat_do_tk,
                    l.dien_tich_010125, l.dien_tich_010126, l.dien_tich_map, l.tong_ho_kk, l.cay_cao, l.cay_chua_cao,
                    l.cay_kho_mu, l.cay_khong_pt, l.ho_trong, l.mat_do_cc, l.che_do_cao, l.nam_mc, l.tuoi_cao,
                    l.nam_cao_up, l.tinh_trang_mc, l.ns25_kg_ha, l.ns25_kg_cay, l.tong_lat_cao, l.ns26_kg_cay,
                    l.phan_loai, l.xa, l.huyen, l.tinh, l.ns26_kg_ha, l.san_luong, l.phien_cao, l.nhip_do_cao,
                    l.tai_canh_nam, l.doi_tuong, l.geojson, l.nam_cap_nhat, NOW()
                FROM lo l
                WHERE l.id_lo = ANY($1::text[])
            `, [existingIds]);
            console.log('✅ Đã lưu lịch sử');
        }

        // 6. Cập nhật các lô đã tồn tại (chỉ cột updatableCols)
        const updatableColsSet = new Set(updatableCols);
        const tempColumns = await client.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name='temp_import' AND column_name != 'id_lo'
        `);
        const updateCols = tempColumns.rows
            .map(r => r.column_name)
            .filter(col => updatableColsSet.has(col));
        
        if (updateCols.length > 0 && existingIds.length > 0) {
            // COALESCE: nếu giá trị từ Excel là NULL (ô trống) thì giữ nguyên giá trị cũ
            const setClause = updateCols.map(col => `${col} = COALESCE(temp.${col}, lo.${col})`).join(', ');
            await client.query(`
                UPDATE lo
                SET ${setClause}, nam_cap_nhat = $1
                FROM temp_import temp
                WHERE lo.id_lo = temp.id_lo AND lo.id_lo = ANY($2::text[])
            `, [parseInt(nam_cap_nhat), existingIds]);
            console.log('✅ Đã cập nhật các lô tồn tại');
        }

        // 7. Thêm mới các lô chưa tồn tại (không bắt buộc geojson)
        const newIdsRes = await client.query(`
            SELECT t.* FROM temp_import t
            WHERE NOT EXISTS (SELECT 1 FROM lo l WHERE l.id_lo = t.id_lo)
        `);
        const newRows = newIdsRes.rows;
        if (newRows.length > 0) {
            // Lấy tất cả cột từ bảng tạm (bao gồm geojson)
            const allColumns = tempColumns.rows.map(r => r.column_name);
            const insertCols = ['id_lo', 'nam_cap_nhat', ...allColumns];
            const valuesPlaceholders = newRows.map((_, idx) => {
                const base = idx * (insertCols.length);
                return `($${base+1}, $${base+2}, ${allColumns.map((_, i) => `$${base+3+i}`).join(', ')})`;
            }).join(',');
            const flatValues = [];
            for (const row of newRows) {
                flatValues.push(row.id_lo, parseInt(nam_cap_nhat));
                for (const col of allColumns) {
                    flatValues.push(row[col] !== undefined ? row[col] : null);
                }
            }
            await client.query(`
                INSERT INTO lo (${insertCols.join(',')})
                VALUES ${valuesPlaceholders}
            `, flatValues);
            console.log(`✅ Đã thêm mới ${newRows.length} lô`);
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Import thành công! Thêm mới: ${newRows.length}, Cập nhật: ${existingIds.length}, Tổng số dòng xử lý: ${rows.length}`
        });
    } catch (err) {
        console.error('❌ Lỗi import Excel chi tiết:', err);
        try {
            await pool.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('Lỗi rollback:', rollbackErr);
        }
        res.status(500).json({ 
            success: false, 
            error: err.message,
            stack: err.stack,
            hint: 'Kiểm tra log server để biết thêm chi tiết'
        });
    }
});

// API lấy lịch sử của một lô
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
app.get('/login', (req, res) => {
    if (req.cookies.token) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Đăng nhập' });
});

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
        title: 'Quản lý lô cao su',
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