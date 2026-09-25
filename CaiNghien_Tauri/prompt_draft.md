# Teamwork Project Prompt — Draft

> Status: Step 2 — Xác định chi tiết và phương pháp xác thực
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team (Tauri Rust Backend + React Frontend)

Triển khai cơ chế "Study-to-Earn" (Học để kiếm giờ chơi) cho ứng dụng CaiNghien_Tauri. Người dùng bật Chế độ Học tập, sau mỗi khoảng thời gian học thực tế sẽ được thưởng thời gian giải trí vào Quota trong ngày.

Working directory: d:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri
Integrity mode: development

## Requirements

### R1. Giao diện Study Mode
Tạo một phân hệ UI trong Phòng Tập Trung (Focus Room) để kích hoạt "Study Mode". Giao diện cần hiển thị đồng hồ đếm thời gian đang học và dự báo số giờ chơi (quota) sẽ nhận được.

### R2. Cơ chế Tính toán Phần thưởng
Xây dựng logic đếm giờ. Khi đạt đủ mốc thời gian học yêu cầu (ví dụ: 60 phút), tự động gọi API Rust để cộng thêm thời gian thưởng vào `daily_quota_minutes` (hoặc biến số tương đương) trong `AppConfig`.

### R3. Cơ chế Xác minh Học tập (Đang chờ định hình)
[TBD - Đang chờ người dùng chọn phương án xác minh để tránh việc treo máy lấy giờ]

## Acceptance Criteria

### Tính năng cốt lõi
- [ ] User có thể Bật/Tắt Study Mode thành công từ UI.
- [ ] Khi hoàn thành một phiên học, thời gian giải trí (Quota) trong Rust backend thực sự tăng lên tương ứng và lưu thành công vào file cấu hình.
- [ ] [TBD - Tiêu chí kiểm chứng việc học thực sự]

---
*Next: Hoàn thiện các câu hỏi hệ thống -> Bạn duyệt Prompt -> Delegate cho Teamwork Agent.*
