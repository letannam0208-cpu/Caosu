// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mock user
const getMockUser = () => ({
  username: "tannam",
  displayName: "Tấn Nam",
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

// Routes chính
app.get('/', (req, res) => {
  res.locals.path = '/';
  renderPage(res, 'index', 'WebGIS · Vườn Cây Cao Su', {
    stats: { totalLots: 425, totalArea: '7,244 ha' }
  });
});

app.get('/dashboard', (req, res) => {
  res.locals.path = '/dashboard';
  renderPage(res, 'index', 'Dashboard - WebGIS Cao Su');
});

// API mock GeoJSON cho Leaflet
app.get('/api/lo-cao-su', (req, res) => {
  res.json({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[106.65, 10.82], [106.68, 10.82], [106.68, 10.79], [106.65, 10.79], [106.65, 10.82]]]
        },
        properties: {
          ten_lo: "Lô demo 1",
          ma_lo: "5.15TK.N1.2020.001",
          dien_tich_ha: 12.5,
          nam_trong: 2018,
          giong: "PB 260"
        }
      },
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[106.70, 10.85], [106.73, 10.85], [106.73, 10.82], [106.70, 10.82], [106.70, 10.85]]]
        },
        properties: {
          ten_lo: "Lô demo 2",
          ma_lo: "5.15TK.N2.2019.015",
          dien_tich_ha: 8.7,
          nam_trong: 2019,
          giong: "RRIV 4"
        }
      }
    ]
  });
});

// Quản lý lô cây (với mock data)
app.get('/quan-ly-lo-cay', (req, res) => {
  const mockStats = {
    total: 425,
    area: '7,244 ha'
  };

  const mockLots = [
    { id: 1, ten_lo: "AB 15.1 - KV1", ma_lo: "5.515TK.01.001", doi: "NT 1", so_cay: 1200, nam_trong: 2015, giong: "PB 260", dien_tich_ha: 8.5, vi_tri: "Kraya, Santuk" },
    { id: 2, ten_lo: "CD 20.3 - KV2", ma_lo: "5.515TK.02.015", doi: "NT 2", so_cay: 950, nam_trong: 2018, giong: "RRIV 4", dien_tich_ha: 6.2, vi_tri: "Santuk" },
    { id: 3, ten_lo: "EF 10.5 - KV3", ma_lo: "5.515TK.03.008", doi: "NT 3", so_cay: 1100, nam_trong: 2017, giong: "PB 255", dien_tich_ha: 7.8, vi_tri: "Baray, Kampong Thom" },
    // Có thể thêm dữ liệu mock khác ở đây
  ];

  res.locals.path = '/quan-ly-lo-cay';
  renderPage(res, 'quan-ly-lo-cay', 'Quản Lý Lô Cây Cao Su', {
    stats: mockStats,
    lots: mockLots,
    error: null,
    success: null
  });
});

// Các trang khác
app.get('/quan-ly-nguoi-dung', (req, res) => {
  res.locals.path = '/quan-ly-nguoi-dung';
  renderPage(res, 'quan-ly-nguoi-dung', 'Quản Lý Người Dùng - WebGIS Cao Su');
});

app.get('/thong-ke', (req, res) => {
  res.locals.path = '/thong-ke';
  renderPage(res, 'thong-ke', 'Thống Kê - WebGIS Cao Su');
});

app.get('/them-du-lieu-lo-cay', (req, res) => {
  res.locals.path = '/them-du-lieu-lo-cay';
  renderPage(res, 'them-du-lieu-lo-cay', 'Thêm Dữ Liệu Lô Cây - WebGIS Cao Su');
});

// Placeholder routes cho các trang đang phát triển
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

// Đăng xuất (placeholder)
app.get('/logout', (req, res) => {
  res.send('Đã đăng xuất thành công. <a href="/">Đăng nhập lại</a>');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Không tìm thấy trang',
    user: getMockUser(),
    path: req.path
  });
});

// Khởi động server (chỉ chạy local, Vercel sẽ tự handle)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server chạy tại → http://localhost:${port}`);
    console.log(`Môi trường: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;