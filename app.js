// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
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
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // Quan trọng với Neon
  max: 20,                    // Số kết nối tối đa
  idleTimeoutMillis: 30000,   // Thời gian chờ trước khi đóng
  connectionTimeoutMillis: 2000,
});

// Test kết nối
pool.on('connect', () => {
  console.log('✅ Kết nối PostgreSQL (Neon) thành công!');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi kết nối Pool:', err.message);
});

// Mock user
const getMockUser = () => ({
  username: "tannam",
  displayName: "Lê Tấn Nam",
  role: "admin"
});

// Helper render trang
const renderPage = (res, viewName, title, extraData = {}) => {
  res.render(viewName, {
    title,
    user: getMockUser(),
    path: res.locals.path || `/${viewName.replace(/\.ejs$/, '')}`,
    ...extraData
  });
};

// ====================== API ENDPOINTS ======================

/**
 * GET /api/dashboard-stats
 * Lấy tất cả thống kê cho dashboard
 */
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT l.id_lo) as tong_lo_cay,
        ROUND(SUM(dt.dien_tich_map)::numeric, 3) as tong_dien_tich,
        COUNT(DISTINCT l.giong) as tong_giong,
        COUNT(DISTINCT l.id_don_vi) as tong_don_vi,
        COUNT(DISTINCT l.id_hc) as tong_hang_chinh
      FROM lo l
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
    `);

    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        tongLoCay: stats.tong_lo_cay || 0,
        tongDienTich: stats.tong_dien_tich || 0,
        tongGiong: stats.tong_giong || 0,
        tongDonVi: stats.tong_don_vi || 0,
        tongHanhChinh: stats.tong_hang_chinh || 0
      }
    });
  } catch (err) {
    console.error('Lỗi GET /api/dashboard-stats:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thống kê dashboard'
    });
  }
});

/**
 * GET /api/giong-stats
 * Lấy thống kê về giống cây
 */
app.get('/api/giong-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        giong,
        COUNT(*) as so_lo,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM lo))::numeric, 1) as phan_tram
      FROM lo
      WHERE giong IS NOT NULL AND giong != ''
      GROUP BY giong
      ORDER BY so_lo DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Lỗi GET /api/giong-stats:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thống kê giống'
    });
  }
});

/**
 * GET /api/don-vi-list
 * Lấy danh sách đơn vị
 */
app.get('/api/don-vi-list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        dv.id_don_vi,
        dv.du_an,
        dv.doi,
        dv.khu_vuc,
        COUNT(l.id_lo) as so_lo,
        ROUND(SUM(dt.dien_tich_map)::numeric, 2) as tong_dien_tich
      FROM don_vi dv
      LEFT JOIN lo l ON dv.id_don_vi = l.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      GROUP BY dv.id_don_vi, dv.du_an, dv.doi, dv.khu_vuc
      ORDER BY so_lo DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Lỗi GET /api/don-vi-list:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy danh sách đơn vị'
    });
  }
});

/**
 * GET /api/nam-trong-stats
 * Lấy thống kê theo năm trồng
 */
app.get('/api/nam-trong-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.nam_trong,
        COUNT(*) as so_lo,
        ROUND(AVG(dt.dien_tich_map)::numeric, 2) as tb_dien_tich
      FROM lo l
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      WHERE l.nam_trong IS NOT NULL
      GROUP BY l.nam_trong
      ORDER BY l.nam_trong DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Lỗi GET /api/nam-trong-stats:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thống kê năm trồng'
    });
  }
});

/**
 * GET /api/lo-cao-su
 * Lấy dữ liệu GeoJSON của các lô cao su
 */
app.get('/api/lo-cao-su', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id_lo,
        l.ten_lo,
        l.giong,
        l.nam_trong,
        l.cao_trinh_tb,
        dv.du_an,
        dv.doi,
        dv.khu_vuc,
        dt.dien_tich_map,
        kh.che_do_cao,
        kh.nam_mc,
        kh.tinh_trang_mc,
        htc.tong_ho_kk,
        htc.cay_cao,
        sl.san_luong,
        sl.phan_loai,
        ST_AsGeoJSON(l.geometry) as geometry
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      LEFT JOIN san_luong sl ON l.id_lo = sl.id_lo
      WHERE l.geometry IS NOT NULL
    `);

    // Chuyển đổi thành GeoJSON FeatureCollection
    const features = result.rows.map(row => {
      const geom = row.geometry ? JSON.parse(row.geometry) : null;
      return {
        type: "Feature",
        geometry: geom,
        properties: {
          id_lo: row.id_lo,
          ten_lo: row.ten_lo,
          giong: row.giong,
          nam_trong: row.nam_trong,
          cao_trinh_tb: row.cao_trinh_tb,
          du_an: row.du_an,
          doi: row.doi,
          khu_vuc: row.khu_vuc,
          dien_tich_map: row.dien_tich_map,
          che_do_cao: row.che_do_cao,
          nam_mc: row.nam_mc,
          tinh_trang_mc: row.tinh_trang_mc,
          tong_ho_kk: row.tong_ho_kk,
          cay_cao: row.cay_cao,
          san_luong: row.san_luong,
          phan_loai: row.phan_loai
        }
      };
    });

    res.json({
      type: "FeatureCollection",
      features: features
    });
  } catch (err) {
    console.error('Lỗi GET /api/lo-cao-su:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy dữ liệu bản đồ'
    });
  }
});

/**
 * GET /api/san-luong-stats
 * Lấy thống kê sản lượng
 */
app.get('/api/san-luong-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        phan_loai,
        COUNT(*) as so_lo,
        ROUND(SUM(san_luong)::numeric, 2) as tong_san_luong,
        ROUND(AVG(san_luong)::numeric, 2) as tb_san_luong
      FROM san_luong
      WHERE san_luong IS NOT NULL AND phan_loai IS NOT NULL
      GROUP BY phan_loai
      ORDER BY tong_san_luong DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Lỗi GET /api/san-luong-stats:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thống kê sản lượng'
    });
  }
});

/**
 * GET /api/hien-trang-cay-stats
 * Lấy thống kê tình trạng cây
 */
app.get('/api/hien-trang-cay-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as tong_lo,
        SUM(tong_ho_kk) as tong_ho,
        SUM(cay_cao) as tong_cay_cao,
        SUM(cay_chua_cao) as tong_cay_chua_cao,
        SUM(cay_kho_mu) as tong_cay_kho_mu,
        SUM(cay_khong_pt) as tong_cay_khong_pt,
        SUM(ho_trong) as tong_ho_trong,
        ROUND(AVG(mat_do_cc)::numeric, 2) as tb_mat_do_cc
      FROM hien_trang_cay
    `);

    res.json({
      success: true,
      data: result.rows[0] || {}
    });
  } catch (err) {
    console.error('Lỗi GET /api/hien-trang-cay-stats:', err.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thống kê tình trạng cây'
    });
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
  renderPage(res, 'quan-ly-lo-cay', 'Quản Lý Lô Cây Cao Su');
});

// Các route placeholder
const placeholderRoutes = [
  '/motadulieu', '/cndl', '/qldl', '/hsnd', '/lichsu',
  '/total-score', '/doimatkhau', '/xbtk', '/thong-ke',
  '/quan-ly-nguoi-dung', '/them-du-lieu-lo-cay'
];

placeholderRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.locals.path = route;
    res.render('placeholder', {
      title: route.replace('/', '').replace(/-/g, ' ').toUpperCase(),
      user: getMockUser(),
      path: route,
      message: `Trang ${route} đang được phát triển...`
    });
  });
});

// Logout
app.get('/logout', (req, res) => {
  res.send('Đã đăng xuất thành công. <a href="/">Đăng nhập lại</a>');
});

// 404
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
    // Test kết nối DB
    await pool.query('SELECT NOW()');
    console.log('🟢 Kết nối Neon Database thành công!');

    app.listen(port, () => {
      console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
      console.log(`🌐 Database: Neon (${process.env.DB_HOST})`);
      console.log(`📡 API Endpoints:`);
      console.log(`   - GET /api/dashboard-stats`);
      console.log(`   - GET /api/giong-stats`);
      console.log(`   - GET /api/don-vi-list`);
      console.log(`   - GET /api/nam-trong-stats`);
      console.log(`   - GET /api/lo-cao-su (GeoJSON)`);
      console.log(`   - GET /api/san-luong-stats`);
      console.log(`   - GET /api/hien-trang-cay-stats`);
    });
  } catch (err) {
    console.error('❌ Không thể kết nối đến Neon Database:', err.message);
    process.exit(1);
  }
};

startServer();
// server.js (hoặc app.js)
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

const pool = new Pool({
  user: 'your_user',
  host: 'localhost',
  database: 'your_db',
  password: 'your_password',
  port: 5432,
});

app.use(express.static('public')); // thư mục chứa index.ejs

// ==================== API 1: GeoJSON cho Bản đồ ====================
app.get('/api/lo-cao-su', async (req, res) => {
  try {
    const { doi, nam_trong, giong, phien_cao } = req.query; // hỗ trợ filter

    let whereClause = 'WHERE l.geometry IS NOT NULL';
    const params = [];

    if (doi) {
      params.push(doi);
      whereClause += ` AND dv.doi = $${params.length}`;
    }
    if (nam_trong) {
      params.push(parseInt(nam_trong));
      whereClause += ` AND l.nam_trong = $${params.length}`;
    }
    if (giong) {
      params.push(giong);
      whereClause += ` AND l.giong = $${params.length}`;
    }
    if (phien_cao) {
      params.push(phien_cao);
      whereClause += ` AND kt.phien_cao = $${params.length}`;
    }

    const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'id', l.id_lo,
            'geometry', ST_AsGeoJSON(l.geometry)::json,
            'properties', jsonb_build_object(
              'id_lo',        l.id_lo,
              'ten_lo',       l.ten_lo,
              'nam_trong',    l.nam_trong,
              'giong',        l.giong,
              'doi',          dv.doi,                    -- Đội (thay cho Ten_nt)
              'dien_tich_map', COALESCE(dt.dien_tich_map, dt.dien_tich_010126),
              'phien_cao',    kt.phien_cao,
              'nhip_do_cao',  kt.nhip_do_cao,
              'cao_trinh_tb', l.cao_trinh_tb,
              'cay_cao',      htc.cay_cao
            )
          )
        )
      ) AS geojson
      FROM public.lo l
      LEFT JOIN public.don_vi dv          ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN public.khai_thac kt       ON l.id_lo = kt.id_lo
      LEFT JOIN public.hien_trang_cay htc ON l.id_lo = htc.id_lo
      LEFT JOIN public.dien_tich dt       ON l.id_lo = dt.id_lo
      ${whereClause}
    `;

    const result = await pool.query(query, params);
    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu bản đồ' });
  }
});

// ==================== API 2: Dashboard Stats (KPI) ====================
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT l.id_lo) AS tong_lo_cay,
        ROUND(SUM(COALESCE(dt.dien_tich_map, 0))::numeric, 3) AS tong_dien_tich,
        COUNT(DISTINCT l.giong) AS tong_giong,
        COUNT(DISTINCT dv.doi) AS tong_doi
      FROM public.lo l
      LEFT JOIN public.don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN public.dien_tich dt ON l.id_lo = dt.id_lo;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== API 3: Các filter dropdown ====================
app.get('/api/don-vi-list', async (req, res) => {
  const result = await pool.query("SELECT DISTINCT doi FROM public.don_vi ORDER BY doi");
  res.json({ success: true, data: result.rows });
});

app.get('/api/giong-stats', async (req, res) => {
  const result = await pool.query(`
    SELECT giong, COUNT(*) as so_lo 
    FROM public.lo 
    GROUP BY giong ORDER BY so_lo DESC
  `);
  res.json({ success: true, data: result.rows });
});

app.get('/api/nam-trong-stats', async (req, res) => {
  const result = await pool.query(`
    SELECT nam_trong, COUNT(*) as so_lo 
    FROM public.lo 
    GROUP BY nam_trong ORDER BY nam_trong
  `);
  res.json({ success: true, data: result.rows });
});

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
// Export pool để dùng ở các file khác sau này
module.exports = { app, pool };