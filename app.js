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
  ssl: { rejectUnauthorized: false },   // Bắt buộc với Neon
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log kết nối
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

    res.json({
      success: true,
      data: result.rows[0] || {}
    });
  } catch (err) {
    console.error('Lỗi /api/dashboard-stats:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy thống kê dashboard' });
  }
});

// Danh sách đơn vị (cho filter dropdown)
app.get('/api/don-vi-list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT doi FROM don_vi ORDER BY doi
    `);
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

// GeoJSON cho bản đồ (quan trọng nhất)
app.get('/api/lo-cao-su', async (req, res) => {
  try {
    const { doi, nam_trong, giong } = req.query;

    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    if (doi) {
      params.push(doi);
      whereClause += ` AND dv.doi = $${paramIndex++}`;
    }
    if (nam_trong) {
      params.push(parseInt(nam_trong));
      whereClause += ` AND l.nam_trong = $${paramIndex++}`;
    }
    if (giong) {
      params.push(giong);
      whereClause += ` AND l.giong = $${paramIndex++}`;
    }

    const result = await pool.query(`
      SELECT
        l.id_lo, l.ten_lo, l.giong, l.nam_trong,
        dv.doi, dv.du_an, dv.khu_vuc,
        dt.dien_tich_map,
        kh.che_do_cao,
        htc.cay_cao,
        ST_AsGeoJSON(ST_Transform(l.geometry, 4326)) AS geometry   -- Dùng trực tiếp, không cast
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      ${whereClause}
    `, params);

    console.log(`✅ /api/lo-cao-su thành công → ${result.rows.length} rows`);

    const features = result.rows
      .filter(row => row.geometry)
      .map(row => ({
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

    res.json({
      type: "FeatureCollection",
      features: features
    });

  } catch (err) {
    console.error('❌ Lỗi /api/lo-cao-su:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Lỗi lấy dữ liệu bản đồ', 
      details: err.message 
    });
  }
});
// ====================== API RANH GIỚI (BOUNDARY) ======================
app.get('/api/boundary', async (req, res) => {
  try {
    const { doi } = req.query;

    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    if (doi) {
      params.push(doi);
      whereClause += ` AND dv.doi = $${paramIndex++}`;
    }

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

    const features = result.rows
      .filter(row => row.geometry)
      .map(row => ({
        type: "Feature",
        geometry: JSON.parse(row.geometry),
        properties: {
          doi: row.doi || 'Toàn vùng',
          du_an: row.du_an,
          khu_vuc: row.khu_vuc,
          type: 'boundary'
        }
      }));

    res.json({
      type: "FeatureCollection",
      features: features
    });

  } catch (err) {
    console.error('Lỗi /api/boundary:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi lấy ranh giới bản đồ' });
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
        l.id_lo,
        l.ten_lo,
        l.nam_trong,
        l.giong,
        l.cao_trinh_tb,
        dv.id_don_vi,
        dv.doi,
        dv.du_an,
        dv.khu_vuc,
        hc.xa,
        hc.huyen,
        hc.tinh,
        dt.dien_tich_map,
        dt.dien_tich_010125,
        dt.dien_tich_010126,
        htc.tong_ho_kk,
        htc.cay_cao,
        htc.cay_chua_cao,
        htc.cay_kho_mu,
        htc.cay_khong_pt,
        htc.ho_trong,
        htc.mat_do_cc,
        kh.che_do_cao,
        kh.phien_cao,
        kh.nhip_do_cao,
        kh.nam_mc,
        kh.tuoi_cao,
        kh.nam_cao_up,
        kh.tinh_trang_mc,
        sl.ns25_kg_ha,
        sl.ns25_kg_cay,
        sl.ns26_kg_ha,
        sl.ns26_kg_cay,
        sl.tong_lat_cao,
        sl.san_luong,
        sl.phan_loai,
        sl.doi_tuong,
        sl.tai_canh_nam,
        ttt.hang_dat,
        ttt.phuong_phap_trong,
        ttt.khoang_cach_trong,
        ttt.mat_do_tk
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

// API thêm mới lô cây (xử lý transaction)
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

    // Tạo id_lo tự động (dùng timestamp + random)
    const id_lo = 'LO_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    
    // Chèn vào bảng lo
    await client.query(`
      INSERT INTO lo (id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id_lo, ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc]);

    // Chèn dien_tich (nếu có)
    if (dien_tich_map) {
      const id_dien_tich = 'DT_' + id_lo;
      await client.query(`
        INSERT INTO dien_tich (id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126)
        VALUES ($1, $2, $3, $4, $5)
      `, [id_dien_tich, id_lo, dien_tich_map, dien_tich_010125, dien_tich_010126]);
    }

    // Chèn hien_trang_cay
    if (tong_ho_kk !== undefined) {
      const id_htc = 'HTC_' + id_lo;
      await client.query(`
        INSERT INTO hien_trang_cay (id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id_htc, id_lo, tong_ho_kk, cay_cao, cay_chua_cao, cay_kho_mu, cay_khong_pt, ho_trong, mat_do_cc]);
    }

    // Chèn khai_thac
    if (che_do_cao) {
      const id_kt = 'KT_' + id_lo;
      await client.query(`
        INSERT INTO khai_thac (id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id_kt, id_lo, che_do_cao, phien_cao, nhip_do_cao, nam_mc, tuoi_cao, nam_cao_up, tinh_trang_mc]);
    }

    // Chèn san_luong
    if (san_luong !== undefined) {
      const id_sl = 'SL_' + id_lo;
      await client.query(`
        INSERT INTO san_luong (id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id_sl, id_lo, ns25_kg_ha, ns25_kg_cay, ns26_kg_ha, ns26_kg_cay, tong_lat_cao, san_luong, phan_loai, doi_tuong, tai_canh_nam]);
    }

    // Chèn thong_tin_trong
    if (hang_dat) {
      const id_ttt = 'TTT_' + id_lo;
      await client.query(`
        INSERT INTO thong_tin_trong (id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id_ttt, id_lo, hang_dat, phuong_phap_trong, khoang_cach_trong, mat_do_tk]);
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

// API cập nhật lô cây (xử lý transaction)
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

    // Cập nhật bảng lo
    await client.query(`
      UPDATE lo SET
        ten_lo = $1, nam_trong = $2, giong = $3, cao_trinh_tb = $4,
        id_don_vi = $5, id_hc = $6
      WHERE id_lo = $7
    `, [ten_lo, nam_trong, giong, cao_trinh_tb, id_don_vi, id_hc, id_lo]);

    // Cập nhật dien_tích (upsert)
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

    // Cập nhật hien_trang_cay (upsert)
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

    // Cập nhật khai_thac (upsert)
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

    // Cập nhật san_luong (upsert)
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

    // Cập nhật thong_tin_trong (upsert)
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
    // Xóa các bảng con trước (nếu chưa có ON DELETE CASCADE)
    await client.query('DELETE FROM dien_tich WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM hien_trang_cay WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM khai_thac WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM san_luong WHERE id_lo = $1', [id_lo]);
    await client.query('DELETE FROM thong_tin_trong WHERE id_lo = $1', [id_lo]);
    // Xóa bảng lo
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
app.get('/api/hanh-chinh-list', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_hc, xa, huyen, tinh FROM hanh_chinh ORDER BY xa');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
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
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lô cây' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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