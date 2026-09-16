# CaiNghiện Focus Guard 🛡️

Một ứng dụng hỗ trợ tập trung và chặn xao nhãng mạnh mẽ, được xây dựng bằng kiến trúc hiện đại **Tauri + Rust + React (Tailwind CSS)**.

## ✨ Tính năng nổi bật

- **Giao diện hiện đại**: Thiết kế Glassmorphism, Dark Theme đẹp mắt với React và TailwindCSS v4.
- **Chặn web cấp hệ thống**: Tự động chỉnh sửa file `hosts` của Windows để chặn triệt để các trang web gây xao nhãng (Facebook, TikTok, YouTube...).
- **Theo dõi thông minh**: Lõi Rust chạy ngầm nhẹ nhàng (< 5MB RAM) liên tục kiểm tra cửa sổ đang hoạt động.
- **Khay hệ thống (System Tray)**: Ứng dụng chạy ẩn hoàn toàn, không vướng víu trên Taskbar.
- **Lịch học tự động**: Tự động kích hoạt chế độ bảo vệ theo khung giờ được định sẵn mỗi ngày.

## 🚀 Hướng dẫn phát triển

### Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (Khuyên dùng bản LTS)
- [Rust](https://rustup.rs/) (Sử dụng rustup)
- **C++ Build Tools** (Visual Studio 2017/2019/2022) - Bắt buộc trên Windows để biên dịch Rust.

### Khởi động dự án
```bash
# Cài đặt các thư viện Frontend
npm install

# Chạy ứng dụng trong môi trường phát triển (HMR)
npm run tauri dev
```

### Đóng gói (Build)
```bash
# Đóng gói ra file cài đặt (.exe / .msi)
npm run tauri build
```

---
*Dự án được xây dựng với mục tiêu nâng cao năng suất cá nhân và cai nghiện môi trường số.*
