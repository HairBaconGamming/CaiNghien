import re

with open('src/App.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

replaces = [
    (r'TAnh n.*ng nAy s.* Acp `.* i DNS m.*ng sang Cloudflare Family vA t.* `.*Tng `.*A3ng s.*p \(Kill\).*?nhy c.*m\.', 'Tính năng này sẽ ép đổi DNS mạng sang Cloudflare Family và tự động đóng sập (Kill) bất kỳ trình duyệt nào truy cập web cấm.'),
    (r'T.*A1y ch.*%nh N.*Ang cao H.* th.*`ng', 'Tùy chỉnh Nâng cao Hệ thống'),
    (r'Kh.*Yi `.*Tng cA1ng Windows \(ch.*y ng.* m d.*>i System Tray\)', 'Khởi động cùng Windows (chạy ngầm dưới System Tray)'),
    (r'K.*A-ch ho.*t Ch.*`ng H.*`i H.*-n \(Kh.*A3a n.*At T.*_t b.*o v.* trong 60 gi.*Ay\)', 'Kích hoạt Chống Hối Hận (Khóa nút Tắt bảo vệ trong 60 giây)'),
    (r'C.*-p nh.*-t M.*-t kh.*cu', 'Cập nhật Mật khẩu'),
    (r'Thi.*t l.*-p M.*-t kh.*cu', 'Thiết lập Mật khẩu'),
    (r'Ng.*n ch.*n b.*n th.*An t.* A.* t.*_t ph.* n m.*\\?m\. \\? tr.*`ng m.*t kh.*cu m.*>i n.*u mu.*`n g.* b.*o v.*\\.', 'Ngăn chặn bản thân tự ý tắt phần mềm. Để trống mật khẩu mới nếu muốn gỡ bảo vệ.'),
    (r'M.*-t kh.*cu hi.*n t.*i', 'Mật khẩu hiện tại'),
    (r'M.*-t kh.*cu m.*>i \{config\.password_hash && "\(\\? tr.*`ng `.* x.*A3a\)"\}', 'Mật khẩu mới {config.password_hash && "(Để trống để xóa)"}'),
    (r'X.*A.*c nh.*-n m.*-t kh.*cu m.*>i', 'Xác nhận mật khẩu mới'),
    (r'X.*Ac nh.*-n \\? i/X.*A3a M.*-t kh.*cu', 'Xác nhận Đổi/Xóa Mật khẩu'),
    (r'Kh.*A3a ph.* n m.*\\?m', 'Khóa phần mềm'),
    (r'\\?A ht th.*\\?i gian ch.*\\?, b.*n cA3 th.* t.*_t b.*o v.*!', 'Đã hết thời gian chờ, bạn có thể tắt bảo vệ!'),
    (r'Qu.*An m.*-t kh.*cu\\? Xin m.*Y kh.*A3a \(Ch.*\\? 7 ng.*Ay\)', 'Quên mật khẩu? Xin mở khóa (Chờ 7 ngày)'),
    (r'B.*\\? qua m.*-t kh.*cu \(\\?A `.*  7 ng.*Ay\)', 'Bỏ qua mật khẩu (Đã đủ 7 ngày)'),
    (r'Nh.*-p m.*-t kh.*cu `.* ti.*p t.*c', 'Nhập mật khẩu để tiếp tục'),
    (r'M.*-t kh.*cu c.* a b.*n\.\.\.', 'Mật khẩu của bạn...'),
    (r'CaiNghi.*n', 'CaiNghiện'),
    (r'Ti.*n tr.*Anh c.*p `.*T', 'Tiến trình cấp độ'),
    (r'ng.*Ay li.*An ti.*p', 'ngày liên tiếp'),
    (r'dY" ', '🔥 '),
    (r'Lv\.', 'Cấp '),
]

for k, v in replaces:
    text = re.sub(k, v, text)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
