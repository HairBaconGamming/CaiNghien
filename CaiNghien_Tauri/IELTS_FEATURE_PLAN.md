# Kế Hoạch Triển Khai: Học Từ Vựng IELTS Tích Hợp Cambridge (Study-to-Earn & Unlock)

## 1. Kiến trúc Hệ thống (Architecture)
Tính năng mới sẽ bao phủ cả 3 tầng của ứng dụng CaiNghien_Tauri: Frontend (Giao diện học), Backend (Rust Web Scraper), và Cơ sở dữ liệu (SQLite lưu lịch sử và offline data).

### 1.1 Cơ sở dữ liệu (SQLite)
Cần bổ sung/tạo mới các bảng để quản lý quá trình học và dữ liệu Cambridge:
- `ielts_topics`: Chứa thông tin chủ đề (id, name, description, total_words).
- `ielts_words`: Lưu từ vựng nguyên bản (id, topic_id, word).
- `cambridge_cache`: Bảng lưu cache dữ liệu cào từ Cambridge để dùng offline. 
  - Schema: `word` (PK), `ipa`, `audio_url`, `definition_json`, `examples_json`, `updated_at`.
- `user_vocab_progress`: Theo dõi tiến độ học của user (word_id, status: `learning`|`mastered`, last_tested_at, correct_streak).

### 1.2 Backend (Tauri Rust)
Xây dựng một module Scraper tinh gọn bằng thư viện `reqwest` và `scraper`.
- **Command `fetch_cambridge_data(word)`**: 
  1. Check `cambridge_cache` trong SQLite. Nếu có và chưa cũ -> trả về.
  2. Nếu không có, HTTP GET tới `https://dictionary.cambridge.org/dictionary/english/{word}`.
  3. Bóc tách HTML lấy: Loại từ (Noun, Verb...), Phát âm (IPA), Link Audio UK/US, Định nghĩa chính, và 1-2 câu ví dụ.
  4. Lưu xuống `cambridge_cache` và trả về JSON cho Frontend.
- **Command `submit_ielts_test(score, type)`**: Xử lý logic cộng Quota (nếu mode=earn_quota) hoặc Mở khóa bảo vệ (nếu mode=unlock) dựa trên điểm số bài test.

## 2. Dữ Liệu Mầm (Seed Data)
Tạo file `src/assets/data/ielts_topics.json` chứa các danh sách từ theo chủ đề. Khi app khởi động lần đầu, Rust sẽ đọc file này và seed vào bảng `ielts_topics` và `ielts_words`.
- **Ví dụ Chủ đề**: Technology (AI, algorithm, obsolete...), Environment (emission, sustainable, footprint...), Education (curriculum, pedagogy, literacy...).

## 3. Giao diện (Frontend React)
Xóa bỏ / Thay thế `TypingChallengeScreen.tsx` hiện tại bằng `IeltsChallengeScreen.tsx`.

### 3.1 Màn hình Danh sách Chủ đề (Topic Selection)
- Hiển thị UI lưới thẻ (Grid Cards) với các chủ đề IELTS.
- Tiến độ học: Hiển thị thanh Progress bar (vd: 15/50 từ đã thuộc) cho từng chủ đề.

### 3.2 Luồng Học (Learning Phase)
- **Flashcard UI**: Hiển thị từ vựng kèm dữ liệu Cambridge (Định nghĩa, Ví dụ, Nút bấm nghe Audio). 
- UI hỗ trợ lật thẻ bằng CSS 3D Transform mang phong cách Cosmos Glassmorphism.
- Người dùng bấm "Đã nhớ" để chuyển sang test.

### 3.3 Luồng Test (Testing Phase)
- **Logic**: App che từ vựng tiếng Anh. Chỉ hiển thị định nghĩa (Tiếng Anh), Loại từ, Audio, và câu ví dụ bị đục lỗ `_____`.
- **Nhiệm vụ**: Người dùng phải gõ chính xác từ vựng tiếng Anh vào ô Input. Không cho phép Copy/Paste.
- **Tính điểm**: Phải gõ đúng liên tiếp 10 từ (hoặc số lượng tùy chỉnh) mới tính là vượt qua ải (Đạt 100%).

## 4. Tích Hợp Vòng Lặp "Cai Nghiện"
- **Tính năng Mở khóa**: Trong màn hình Cài đặt (Settings), khi user bấm tắt "Chế độ bảo vệ", một Modal sẽ hiện ra yêu cầu họ vượt qua 1 bài test IELTS ngẫu nhiên từ những chủ đề đang học dở. Pass -> Cho phép tắt. Failed -> Khóa cài đặt.
- **Tính năng Cày Quota**: Nếu app đang bật bảo vệ và hết Quota rảnh, user vào tab IELTS Challenge, chọn học một chủ đề mới hoặc ôn tập. Vượt qua 1 bài test -> Gọi backend `add_quota_minutes(X phút)`.

## 5. Rủi Ro Kỹ Thuật & Giảm Thiểu
1. **Cambridge chặn Bot (Cloudflare / 403 Forbidden)**: 
   - *Cách giải quyết*: Giả mạo `User-Agent` (Chrome/Windows) khi gửi request bằng `reqwest`. Nếu bị chặn gắt, tích hợp cơ chế fallback về một API từ điển mở (như Free Dictionary API) để app không bị crash.
2. **Audio Playback**: 
   - *Cách giải quyết*: Lấy URL file `.mp3` từ Cambridge và dùng HTML5 `<audio>` tag trong React để phát. Trình duyệt WebView2 của Windows hỗ trợ định dạng này tốt.
