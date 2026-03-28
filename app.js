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

    let whereClause = 'WHERE l.geometry_old IS NOT NULL';
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
        l.id_lo, l.ten_lo, l.giong, l.nam_trong, l.cao_trinh_tb,
        dv.doi, dv.du_an, dv.khu_vuc,
        dt.dien_tich_map,
        kh.che_do_cao, kh.nam_mc, kh.tinh_trang_mc,
        htc.cay_cao,
        ST_AsGeoJSON(ST_Transform(l.geometry_old::geometry, 4326)) as geometry
      FROM lo l
      LEFT JOIN don_vi dv ON l.id_don_vi = dv.id_don_vi
      LEFT JOIN dien_tich dt ON l.id_lo = dt.id_lo
      LEFT JOIN khai_thac kh ON l.id_lo = kh.id_lo
      LEFT JOIN hien_trang_cay htc ON l.id_lo = htc.id_lo
      ${whereClause}
    `, params);

    console.log(`✅ /api/lo-cao-su thành công - Trả về ${result.rows.length} rows`);

    const features = result.rows
      .filter(row => row.geometry)   // chỉ lấy những row có geometry
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

    console.log(`✅ Đã tạo ${features.length} features GeoJSON`);

    res.json({
      type: "FeatureCollection",
      features: features
    });

  } catch (err) {
    console.error('❌ Lỗi /api/lo-cao-su:', err.message);
    console.error('Stack:', err.stack);   // thêm stack để xem chi tiết
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

    let whereClause = 'WHERE l.geometry_old IS NOT NULL';
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
        ST_AsGeoJSON(ST_Union(l.geometry_old::geometry)) as geometry
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

// Placeholder routes
const placeholderRoutes = [
  '/quan-ly-lo-cay', '/motadulieu', '/cndl', '/qldl', '/hsnd', 
  '/lichsu', '/thong-ke', '/quan-ly-nguoi-dung', '/them-du-lieu-lo-cay'
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