# WebGIS Quản lý Vườn Cây Cao Su

Hệ thống WebGIS quản lý dữ liệu lô cây cao su, tích hợp bản đồ, thống kê, và phân quyền người dùng.  
Xây dựng với **Node.js (Express)** + **PostgreSQL (Neon)** + **EJS** + **Leaflet** (giả định từ frontend).

## Tính năng chính

- 🔐 **Xác thực & phân quyền** – Đăng nhập, đăng xuất, quản lý người dùng (admin, quản lý đội, kỹ thuật viên, nhập liệu).
- 🗺️ **Bản đồ tương tác** – Hiển thị GeoJSON các lô cây, ranh giới đơn vị, lọc theo nhiều tiêu chí.
- 📊 **Dashboard & Thống kê** – Tổng số lô, diện tích, giống cây, đơn vị, biểu đồ phân bố.
- 🌱 **Quản lý lô cây** – CRUD lô cây, thông tin diện tích, hiện trạng cây, khai thác, sản lượng, thông tin trồng.
- 👥 **Quản lý người dùng** – Thêm/sửa/xóa user, khóa/mở khóa, phân quyền, theo dõi lần đăng nhập cuối.
- 📂 **Nhập dữ liệu hàng loạt** – Hỗ trợ UPSERT qua API cho tất cả các bảng.
- 📱 **Giao diện responsive** – Thiết kế tối giản, hoạt động trên mobile/desktop.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Neon) |
| Xác thực | express-session, bcrypt |
| Template | EJS |
| Frontend | HTML5, CSS3, JavaScript, Leaflet, Chart.js |
| GIS | PostGIS (geometry, ST_AsGeoJSON) |

## Cài đặt & Chạy dự án

### Yêu cầu

- Node.js >= 18.x
- PostgreSQL (hoặc tài khoản Neon)
- DBeaver / pgAdmin (tuỳ chọn)

### Bước 1: Clone repository

```bash
git clone https://github.com/your-repo/webgis-caosu.git
cd webgis-caosu