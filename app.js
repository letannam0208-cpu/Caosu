// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// ── Kết nối Neon PostgreSQL ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mock user (sẽ thay bằng session/auth sau)
const getMockUser = () => ({
  username: "tannam",
  displayName: "Tấn Nam",
  role: "admin"  // hoặc "user", "kythuatvien", v.v.
});

// ── Helper: render trang với layout chung ──
const renderPage = (res, viewName, title, extraData = {}) => {
  res.render(viewName, {
    title,
    user: getMockUser(),
    path: res.locals.path || `/${viewName.replace(/\.ejs$/, '')}`, // fallback
    ...extraData
  });
};

// ── Route chính ──

// Trang chủ / dashboard (index.ejs)
app.get('/', (req, res) => {
  res.locals.path = '/dashboard';
  renderPage(res, 'index', 'WebGIS · Vườn Cây Cao Su', {
    // Có thể truyền thêm dữ liệu dashboard nếu cần
    stats: { totalLots: 425, totalArea: '7,244 ha' }
  });
});

// Dashboard (nếu bạn muốn tách riêng)
app.get('/dashboard', (req, res) => {
  res.locals.path = '/dashboard';
  renderPage(res, 'index', 'Dashboard - WebGIS Cao Su');
});
app.get('/api/lo-cao-su', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(row) - 'geom'
          )
        )
      )
      FROM lo_cao_su row;
    `);

    res.json(result.rows[0].jsonb_build_object);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});
// Quản lý lô cây
app.get('/quan-ly-lo-cay', async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) AS total_lots,
        COALESCE(SUM(dien_tich_ha), 0) AS total_area
      FROM lo_cay
    `);

    const stats = {
      total: statsResult.rows[0].total_lots || 425,
      area: Number(statsResult.rows[0].total_area || 7244).toLocaleString('vi-VN') + ' ha'
    };

    const lotsResult = await pool.query(`
      SELECT 
        id, ten_lo, ma_lo, doi, so_cay, nam_trong, giong, dien_tich_ha, vi_tri
      FROM lo_cay
      ORDER BY ma_lo
      LIMIT 50
    `);

    res.locals.path = '/quan-ly-lo-cay';
    renderPage(res, 'quan-ly-lo-cay', 'Quản Lý Lô Cây Cao Su', {
      stats,
      lots: lotsResult.rows,
      error: null,
      success: null
    });

  } catch (err) {
    console.error('Lỗi truy vấn lo_cay:', err);
    res.locals.path = '/quan-ly-lo-cay';
    renderPage(res, 'quan-ly-lo-cay', 'Quản Lý Lô Cây Cao Su', {
      stats: { total: '—', area: '—' },
      lots: [],
      error: 'Không thể tải dữ liệu từ cơ sở dữ liệu',
      success: null
    });
  }
});

// Quản lý người dùng
app.get('/quan-ly-nguoi-dung', (req, res) => {
  res.locals.path = '/quan-ly-nguoi-dung';
  renderPage(res, 'quan-ly-nguoi-dung', 'Quản Lý Người Dùng - WebGIS Cao Su');
});

// Thêm dữ liệu lô cây
app.get('/them-du-lieu-lo-cay', (req, res) => {
  res.locals.path = '/cndl';  // hoặc '/them-du-lieu-lo-cay' tùy bạn muốn active menu nào
  renderPage(res, 'them-du-lieu-lo-cay', 'Thêm Dữ Liệu Lô Cây - WebGIS Cao Su');
});

// Thống kê
app.get('/thong-ke', (req, res) => {
  res.locals.path = '/thong-ke';  // hoặc '/xbtk' nếu muốn map vào Xuất báo cáo
  renderPage(res, 'thong-ke', 'Thống Kê - WebGIS Cao Su');
});

// ── Các route placeholder cho menu sidebar mới ──
const placeholderRoutes = [
  '/motadulieu', '/cndl', '/qldl', '/hsnd', '/lichsu',
  '/total-score', '/doimatkhau', '/xbtk'
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

// Tạo file views/placeholder.ejs đơn giản nếu chưa có
// Nội dung gợi ý cho placeholder.ejs:
// <h1><%= title %></h1>
// <p><%= message %></p>
// <p>Trở về <a href="/dashboard">Dashboard</a></p>

// Đăng xuất (placeholder)
app.get('/logout', (req, res) => {
  // Xử lý logout thật → destroy session, clear cookie, v.v.
  res.send('Đã đăng xuất thành công. <a href="/">Đăng nhập lại</a>');
});

// 404
app.use((req, res) => {
  res.status(404).render('404', {  // tạo file 404.ejs nếu muốn
    title: 'Không tìm thấy trang',
    user: getMockUser(),
    path: req.path
  });
});
app.listen(3000, () => {
  console.log('Server chạy tại http://localhost:3000');
});
// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại → http://localhost:${port}`);
  console.log(`Môi trường: ${process.env.NODE_ENV || 'development'}`);
});