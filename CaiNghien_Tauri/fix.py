import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replaces = {
    'Dang b\?o v\?': 'Đang bảo vệ',
    'T\?m d\?ng': 'Tạm dừng',
    'Dang T\? Th\?': 'Đang Tử thủ',
    'D\?ng b\?o v\?': 'Dừng bảo vệ',
    'B\?t b\?o v\?': 'Bật bảo vệ',
    'V\?n t\?t b\?o v\?': 'Vẫn tắt bảo vệ',
    'Xc nh\?n T\?t b\?o v\?': 'Xác nhận Tắt bảo vệ',
    'Khng th\? t\?m d\?ng': 'Không thể tạm dừng',
    'Th\?i gian t\?p trung': 'Thời gian tập trung',
    'Vi ph\?m': 'Vi phạm',
    'Dang d\?m': 'Đang đếm',
    'S\? l\?n': 'Số lần',
    'Da luu m\?t kh\?u m\?i\.': 'Đã lưu mật khẩu mới.',
    'Da g\? b\? m\?t kh\?u\.': 'Đã gỡ bỏ mật khẩu.',
    'C\?p nh\?t M\?t kh\?u': 'Cập nhật Mật khẩu',
    'Thi\?t l\?p M\?t kh\?u': 'Thiết lập Mật khẩu',
    'Xc nh\?n D\?i/Xa M\?t kh\?u': 'Xác nhận Đổi/Xóa Mật khẩu',
    'Kha ph\?n m\?m': 'Khóa phần mềm',
    'Qun m\?t kh\?u\? Xin m\? kha \(Ch\? 7 ngy\)': 'Quên mật khẩu? Xin mở khóa (Chờ 7 ngày)',
    'Th\?ng k 7 ngy g\?n nh\?t \(Pht\)': 'Thống kê 7 ngày gần nhất (Phút)',
    'Ch\? d\? T\? th\?': 'Chế độ Tử thủ',
    'Gi\? t\? th\?': 'Giờ tử thủ',
    'M\?c d\?': 'Mức độ',
    'C\?p d\?': 'Cấp độ',
    'H\?n m\?c gi\?i tr hm nay': 'Hạn mức giải trí hôm nay',
    'H\?n g\?p l\?i vo ngy mai!': 'Hẹn gặp lại vào ngày mai!',
    'B\?t d\?u gi\?i tr': 'Bắt đầu giải trí',
    'H\?n m\?c th\?i gian': 'Hạn mức thời gian',
    'T\?ng th\?i gian gi\?i tr m\?i ngy:': 'Tổng thời gian giải trí mỗi ngày:',
    'pht': 'phút',
    'B\?n v\?a c  d\?nh m\? m\?t \?ng d\?ng/trang web khng lnh m\?nh\.': 'Bạn vừa có ý định mở một ứng dụng/trang web không lành mạnh.',
    'Hy ht th\? th\?t su...': 'Hãy hít thở thật sâu...',
    'Dang t\?i c\?u hnh h\? th\?ng\.\.\.': 'Đang tải cấu hình hệ thống...'
}

for k, v in replaces.items():
    text = re.sub(k, v, text)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
