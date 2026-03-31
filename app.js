// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// ====================== MOCK USER ======================
const getMockUser = () => ({
  username: "tannam",
  displayName: "Lê Tấn Nam",
  role: "admin"
});

// ====================== HELPER RENDER ======================
const renderPage = (res, viewName, title, extraData = {}) => {
  res.render(viewName, {
    title,
    user: getMockUser(),
    path: res.locals.path || `/${viewName.replace(/\.ejs$/, '')}`,
    ...extraData
  });
};

// ====================== API ENDPOINTS ======================

// Dashboard Stats
app.get('/api/dashboard-stats', async (req, res) => {
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
app.get('/api/don-vi-list', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_don_vi, doi FROM don_vi ORDER BY doi');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Giống cây (cho filter)
app.get('/api/giong-stats', async (req, res) => {
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
app.get('/api/nam-trong-stats', async (req, res) => {
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
app.get('/api/lo-cao-su', async (req, res) => {
  try {
    const { doi, nam_trong, giong } = req.query;
    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;
    if (doi) { params.push(doi); whereClause += ` AND dv.doi = $${paramIndex++}`; }
    if (nam_trong) { params.push(parseInt(nam_trong)); whereClause += ` AND l.nam_trong = $${paramIndex++}`; }
    if (giong) { params.push(giong); whereClause += ` AND l.giong = $${paramIndex++}`; }

    const result = await pool.query(`
      SELECT
        l.id_lo, l.ten_lo, l.giong, l.nam_trong,
        dv.doi, dv.du_an, dv.khu_vuc,
        dt.dien_tich_map,
        kh.che_do_cao,
        htc.cay_cao,
        ST_AsGeoJSON(ST_Transform(l.geometry, 4326)) AS geometry
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
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
        cay_cao: row.cay_cao
      }
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error('❌ Lỗi /api/lo-cao-su:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy dữ liệu bản đồ', details: err.message });
  }
});

// API ranh giới
app.get('/api/boundary', async (req, res) => {
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

// ====================== QUẢN LÝ LÔ CÂY ======================
// Render trang quản lý
app.get('/quan-ly-lo-cay', (req, res) => {
  res.locals.path = '/quan-ly-lo-cay';
  res.render('quan-ly-lo-cay', {
    title: 'Quản lý lô cây cao su',
    user: getMockUser(),
    path: '/quan-ly-lo-cay'
  });
});

// API lấy danh sách lô cây (full thông tin)
app.get('/api/lo-cay', async (req, res) => {
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

// API chi tiết lô cây theo id
app.get('/api/lo-cay/:id', async (req, res) => {
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

// API thêm mới lô cây (transaction)
app.post('/api/lo-cay', async (req, res) => {
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

    if (dien_tich_map) {
      await client.query(`
        INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
        VALUES ('DT_' || $1, $1, $2, $3, $4)
      `, [id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
    }
    if (tong_ho_kk !== undefined) {
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ('HTC_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
      `, [id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
    }
    if (che_do_cao) {
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ('KT_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
      `, [id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
    }
    if (san_luong !== undefined) {
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ('SL_' || $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]);
    }
    if (hang_dat) {
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

// API cập nhật lô cây (transaction)
app.put('/api/lo-cay/:id', async (req, res) => {
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
        ON CONFLICT (id_dien_tich) DO UPDATE SET
          dien_tich_map = EXCLUDED.dien_tich_map,
          dien_tich_010125 = EXCLUDED.dien_tich_010125,
          dien_tich_010126 = EXCLUDED.dien_tich_010126
      `, [id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
    }
    if (tong_ho_kk !== undefined) {
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ('HTC_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_htc) DO UPDATE SET
          tong_ho_kk = EXCLUDED.tong_ho_kk,
          cay_cao = EXCLUDED.cay_cao,
          cay_chua_cao = EXCLUDED.cay_chua_cao,
          cay_kho_mu = EXCLUDED.cay_kho_mu,
          cay_khong_pt = EXCLUDED.cay_khong_pt,
          ho_trong = EXCLUDED.ho_trong,
          mat_do_cc = EXCLUDED.mat_do_cc
      `, [id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
    }
    if (che_do_cao) {
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ('KT_' || $1, $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_kt) DO UPDATE SET
          che_do_cao = EXCLUDED.che_do_cao,
          phien_cao = EXCLUDED.phien_cao,
          nhip_do_cao = EXCLUDED.nhip_do_cao,
          nam_mc = EXCLUDED.nam_mc,
          tuoi_cao = EXCLUDED.tuoi_cao,
          nam_cao_up = EXCLUDED.nam_cao_up,
          tinh_trang_mc = EXCLUDED.tinh_trang_mc
      `, [id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
    }
    if (san_luong !== undefined) {
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ('SL_' || $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id_sl) DO UPDATE SET
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
    if (hang_dat) {
      await client.query(`
        INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
        VALUES ('TTT_' || $1, $1, $2, $3, $4, $5)
        ON CONFLICT (id_ttt) DO UPDATE SET
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

// API xóa lô cây (xóa cascade)
app.delete('/api/lo-cay/:id', async (req, res) => {
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

// ====================== API CHO CÁC BẢNG KHÁC ======================
// ====================== API QUẢN LÝ ĐƠN VỊ ======================
app.get('/api/don-vi', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM don_vi ORDER BY doi');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/don-vi', async (req, res) => {
  const { id_don_vi, du_an, doi, khu_vuc } = req.body;
  try {
    await pool.query(
      'INSERT INTO don_vi (id_don_vi, du_an, doi, khu_vuc) VALUES ($1, $2, $3, $4)',
      [id_don_vi, du_an, doi, khu_vuc]
    );
    res.json({ success: true, message: 'Thêm đơn vị thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/don-vi/:id', async (req, res) => {
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
app.delete('/api/don-vi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM don_vi WHERE id_don_vi=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ HÀNH CHÍNH ======================
app.get('/api/hanh-chinh', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hanh_chinh ORDER BY xa');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/hanh-chinh', async (req, res) => {
  const { id_hc, xa, huyen, tinh } = req.body;
  try {
    await pool.query(
      'INSERT INTO hanh_chinh (id_hc, xa, huyen, tinh) VALUES ($1, $2, $3, $4)',
      [id_hc, xa, huyen, tinh]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hanh-chinh/:id', async (req, res) => {
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
app.delete('/api/hanh-chinh/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hanh_chinh WHERE id_hc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ DIỆN TÍCH ======================
app.get('/api/dien-tich', async (req, res) => {
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
app.post('/api/dien-tich', async (req, res) => {
  const { id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126 } = req.body;
  try {
    await pool.query(
      `INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
       VALUES ($1, $2, $3, $4, $5)`,
      [id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/dien-tich/:id', async (req, res) => {
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
app.delete('/api/dien-tich/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM dien_tich WHERE id_dien_tich=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ HIỆN TRẠNG CÂY ======================
app.get('/api/hien-trang-cay', async (req, res) => {
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
app.post('/api/hien-trang-cay', async (req, res) => {
  const { id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
  try {
    await pool.query(
      `INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hien-trang-cay/:id', async (req, res) => {
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
app.delete('/api/hien-trang-cay/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hien_trang_cay WHERE id_htc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ KHAI THÁC ======================
app.get('/api/khai-thac', async (req, res) => {
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
app.post('/api/khai-thac', async (req, res) => {
  const { id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
  try {
    await pool.query(
      `INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/khai-thac/:id', async (req, res) => {
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
app.delete('/api/khai-thac/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM khai_thac WHERE id_kt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ SẢN LƯỢNG ======================
app.get('/api/san-luong', async (req, res) => {
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
app.post('/api/san-luong', async (req, res) => {
  const { id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
  try {
    await pool.query(
      `INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/san-luong/:id', async (req, res) => {
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
app.delete('/api/san-luong/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM san_luong WHERE id_sl=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== API QUẢN LÝ THÔNG TIN TRỒNG ======================
app.get('/api/thong-tin-trong', async (req, res) => {
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
app.post('/api/thong-tin-trong', async (req, res) => {
  const { id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
  try {
    await pool.query(
      `INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]
    );
    res.json({ success: true, message: 'Thêm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/thong-tin-trong/:id', async (req, res) => {
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
app.delete('/api/thong-tin-trong/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM thong_tin_trong WHERE id_ttt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Bảng đơn vị
app.get('/api/don-vi', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM don_vi ORDER BY doi');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/don-vi', async (req, res) => {
  const { id_don_vi, du_an, doi, khu_vuc } = req.body;
  try {
    await pool.query(
      'INSERT INTO don_vi (id_don_vi, du_an, doi, khu_vuc) VALUES ($1, $2, $3, $4)',
      [id_don_vi, du_an, doi, khu_vuc]
    );
    res.json({ success: true, message: 'Thêm đơn vị thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/don-vi/:id', async (req, res) => {
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
app.delete('/api/don-vi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM don_vi WHERE id_don_vi=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng hành chính
app.get('/api/hanh-chinh', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hanh_chinh ORDER BY xa');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/hanh-chinh', async (req, res) => {
  const { id_hc, xa, huyen, tinh } = req.body;
  try {
    await pool.query(
      'INSERT INTO hanh_chinh (id_hc, xa, huyen, tinh) VALUES ($1, $2, $3, $4)',
      [id_hc, xa, huyen, tinh]
    );
    res.json({ success: true, message: 'Thêm hành chính thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hanh-chinh/:id', async (req, res) => {
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
app.delete('/api/hanh-chinh/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hanh_chinh WHERE id_hc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng diện tích
app.get('/api/dien-tich', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT dt.*, l.ten_lo 
      FROM dien_tich dt 
      LEFT JOIN lo l ON dt.id_lo = l.id_lo
      ORDER BY dt.id_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/dien-tich', async (req, res) => {
  const { id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126 } = req.body;
  try {
    await pool.query(
      'INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126) VALUES ($1, $2, $3, $4, $5)',
      [id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]
    );
    res.json({ success: true, message: 'Thêm diện tích thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/dien-tich/:id', async (req, res) => {
  const { id } = req.params;
  const { dien_tich_map, dien_tich_010125, dien_tich_010126 } = req.body;
  try {
    await pool.query(
      'UPDATE dien_tich SET dien_tich_map=$1, dien_tich_010125=$2, dien_tich_010126=$3 WHERE id_dien_tich=$4',
      [dien_tich_map, dien_tich_010125, dien_tich_010126, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/dien-tich/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM dien_tich WHERE id_dien_tich=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng hiện trạng cây
app.get('/api/hien-trang-cay', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT htc.*, l.ten_lo 
      FROM hien_trang_cay htc 
      LEFT JOIN lo l ON htc.id_lo = l.id_lo
      ORDER BY htc.id_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/hien-trang-cay', async (req, res) => {
  const { id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
  try {
    await pool.query(
      'INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]
    );
    res.json({ success: true, message: 'Thêm hiện trạng cây thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/hien-trang-cay/:id', async (req, res) => {
  const { id } = req.params;
  const { tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc } = req.body;
  try {
    await pool.query(
      'UPDATE hien_trang_cay SET tong_ho_kk=$1, cay_cao=$2, cay_chua_cao=$3, cay_kho_mu=$4, cay_khong_pt=$5, ho_trong=$6, mat_do_cc=$7 WHERE id_htc=$8',
      [tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/hien-trang-cay/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hien_trang_cay WHERE id_htc=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng khai thác
app.get('/api/khai-thac', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT kh.*, l.ten_lo 
      FROM khai_thac kh 
      LEFT JOIN lo l ON kh.id_lo = l.id_lo
      ORDER BY kh.id_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/khai-thac', async (req, res) => {
  const { id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
  try {
    await pool.query(
      'INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]
    );
    res.json({ success: true, message: 'Thêm khai thác thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/khai-thac/:id', async (req, res) => {
  const { id } = req.params;
  const { che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc } = req.body;
  try {
    await pool.query(
      'UPDATE khai_thac SET che_do_cao=$1, phien_cao=$2, nhip_do_cao=$3, nam_mc=$4, tuoi_cao=$5, nam_cao_up=$6, tinh_trang_mc=$7 WHERE id_kt=$8',
      [che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/khai-thac/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM khai_thac WHERE id_kt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng sản lượng
app.get('/api/san-luong', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sl.*, l.ten_lo 
      FROM san_luong sl 
      LEFT JOIN lo l ON sl.id_lo = l.id_lo
      ORDER BY sl.id_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/san-luong', async (req, res) => {
  const { id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
  try {
    await pool.query(
      'INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]
    );
    res.json({ success: true, message: 'Thêm sản lượng thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/san-luong/:id', async (req, res) => {
  const { id } = req.params;
  const { ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam } = req.body;
  try {
    await pool.query(
      'UPDATE san_luong SET ns25_kg_ha=$1, ns25_kg_cay=$2, ns26_kg_ha=$3, ns26_kg_cay=$4, tong_lat_cao=$5, san_luong=$6, phan_loai=$7, doi_tuong=$8, tai_canh_nam=$9 WHERE id_sl=$10',
      [ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/san-luong/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM san_luong WHERE id_sl=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bảng thông tin trồng
app.get('/api/thong-tin-trong', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ttt.*, l.ten_lo 
      FROM thong_tin_trong ttt 
      LEFT JOIN lo l ON ttt.id_lo = l.id_lo
      ORDER BY ttt.id_lo
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/thong-tin-trong', async (req, res) => {
  const { id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
  try {
    await pool.query(
      'INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk) VALUES ($1, $2, $3, $4, $5, $6)',
      [id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]
    );
    res.json({ success: true, message: 'Thêm thông tin trồng thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.put('/api/thong-tin-trong/:id', async (req, res) => {
  const { id } = req.params;
  const { hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk } = req.body;
  try {
    await pool.query(
      'UPDATE thong_tin_trong SET hang_dat=$1, phuong_phap_trong=$2, khoang_cach_trong=$3, mat_do_tk=$4 WHERE id_ttt=$5',
      [hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk, id]
    );
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete('/api/thong-tin-trong/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM thong_tin_trong WHERE id_ttt=$1', [id]);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================== ROUTES ======================
app.get('/', (req, res) => {
  res.locals.path = '/';
  renderPage(res, 'index', 'WebGIS · Vườn Cây Cao Su');
});

app.get('/dashboard', (req, res) => {
  res.locals.path = '/dashboard';
  renderPage(res, 'index', 'Dashboard - WebGIS Cao Su');
});

app.get('/quan-ly-lo-cay', (req, res) => {
  res.locals.path = '/quan-ly-lo-cay';
  renderPage(res, 'quan-ly-lo-cay', 'Quản lý lô cây cao su');
});

app.get('/them-du-lieu-lo-cay', (req, res) => {
  res.locals.path = '/them-du-lieu-lo-cay';
  renderPage(res, 'them-du-lieu-lo-cay', 'Thêm dữ liệu lô cây');
});

app.get('/thong-ke', (req, res) => {
  res.locals.path = '/thong-ke';
  renderPage(res, 'thong-ke', 'Thống kê vườn cây');
});

app.get('/quan-ly-nguoi-dung', (req, res) => {
  res.locals.path = '/quan-ly-nguoi-dung';
  renderPage(res, 'quan-ly-nguoi-dung', 'Quản lý người dùng');
});
// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Không tìm thấy trang',
    user: getMockUser(),
    path: req.path
  });
});

// ====================== START SERVER ======================
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('🟢 Kết nối Neon Database thành công!');
    app.listen(port, () => {
      console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
      console.log(`🌐 Database: Neon (${process.env.DB_HOST})`);
    });
  } catch (err) {
    console.error('❌ Không thể kết nối đến Neon Database:', err.message);
    process.exit(1);
  }
};

startServer();