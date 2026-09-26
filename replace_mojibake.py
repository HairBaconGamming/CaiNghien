import os

replacements = {
    "CaiNghin": "CaiNghiện",
    "TA-nh Nng": "Tính Năng",
    "ChAnh Nim": "Chánh Niệm",
    "Tcnh TAm": "Tĩnh Tâm",
    "Ti Xu`ng": "Tải Xuống",
    "L<ch s- c-p nh-t": "Lịch sử cập nhật",
    "Ti cho Windows": "Tải cho Windows",
    "Ti v?": "Tải về",
    "PhiAn bn": "Phiên bản",
    "ChA-nh Thcc PhAt HAnh": "Chính Thức Phát Hành",
    "PhAo ?Ai K Lu-t ThAcp": "Pháo Đài Kỷ Luật Thép",
    "Cho S T-p Trung": "Cho Sự Tập Trung",
    "Ngn chn hoAn toAn s cAm d- s`.": "Ngăn chặn hoàn toàn sự cám dỗ số.",
    "CaiNghin can thip sAu vAo h th`ng Windows": "CaiNghiện can thiệp sâu vào hệ thống Windows",
    "`? khA3a cht cAc trang web xao nhAng, A(c)p bn phi gi_ k lu-t vA bo v th?i gian quA? bAu.": "để khóa chặt các trang web xao nhãng, ép bạn phải giữ kỷ luật và bảo vệ thời gian quý báu.",
    "Ti Min PhA-": "Tải Miễn Phí",
    "MA Ngu\"n MY": "Mã Nguồn Mở",
    "Can thip t ng h th`ng": "Can thiệp tầng hệ thống",
    "KhA'ng th A(c)p t_t bng Task Manager": "Không thể ép tắt bằng Task Manager",
    "MA khA'i phc an toAn 7 ngAy": "Mã khôi phục an toàn 7 ngày",
    "Bo V Th?i Gian Thc": "Bảo Vệ Thời Gian Thực",
    "Bng `i?u khin": "Bảng điều khiển",
    "PhAng T-p Trung": "Phòng Tập Trung",
    "Am thanh thiAn nhiAn, nhc Lofi": "Âm thanh thiên nhiên, nhạc Lofi",
    "Th- ThAch GA PhA-m": "Thử Thách Gõ Phím",
    "Giao din th- thAch gA phA-m chAnh nim": "Giao diện thử thách gõ phím chánh niệm",
    "T_t c": "Tất cả",
    "Ti?n nhim": "Tiền nhiệm",
    "Bn c-p nh-t bo m-t tuyt `\"i": "Bản cập nhật bảo mật tuyệt đối",
    "?Anh giA": "Đánh giá",
    "Ti trc tip t mAy ch ": "Tải trực tiếp từ máy chủ",
    "Ti t GitHub": "Tải từ GitHub",
    "Ti MSI": "Tải MSI",
    "Sao chA(c)p mA bm": "Sao chép mã băm",
    "?A sao chA(c)p": "Đã sao chép",
    "Thu gn lnh": "Thu gọn lệnh",
    "Xem lnh kim tra": "Xem lệnh kiểm tra",
    "Sn SAng ? T-p Trung?": "Sẵn Sàng Để Tập Trung?",
    "?A Sn SAng GiAnh Li Quy?n Kim SoAt?": "Đã Sẵn Sàng Giành Lại Quyền Kiểm Soát?",
    "Mu`n t_t cng dng? Bn bt buTc phi gA chA-nh xAc 100% mTt `on vAn cam kt.": "Muốn tắt ứng dụng? Bạn bắt buộc phải gõ chính xác 100% một đoạn văn cam kết.",
    "XAy dng bng": "Xây dựng bằng",
    "PhAt hAnh ngAy": "Phát hành ngày",
    "Kin trAc x64": "Kiến trúc x64",
    "KA-ch th>c file": "Kích thước file",
    "N?n tng": "Nền tảng",
    "KhuyAn dA1ng:": "Khuyên dùng:",
    "Bn cAi `t tiAu chun": "Bản cài đặt tiêu chuẩn",
    "t `Tng cu hAnh service n?n": "tự động cấu hình service nền",
    "GA3i cAi `t Windows Installer dAnh cho qun tr< viAn h th`ng.": "Gói cài đặt Windows Installer dành cho quản trị viên hệ thống.",
    "?im ni bt trong bn phAt hAnh": "Điểm nổi bật trong bản phát hành",
    "Xem toAn bT l<ch s- phAt hAnh & kim tra mA bm SHA-256 →": "Xem toàn bộ lịch sử phát hành & kiểm tra mã băm SHA-256 →",
    "CAi `t CaiNghin ngay hA'm nay `? bo v s t-p trung ca bn khi th gi>i ` y xao nhAng.": "Cài đặt CaiNghiện ngay hôm nay để bảo vệ sự tập trung của bạn khỏi thế giới đầy xao nhãng.",
    "T-ch hp": "Tích hợp",
    "vA": "và",
    "`T": "độ",
    "mc": "mức",
    "bo v": "bảo vệ",
    "h th`ng": "hệ thống",
    "bng": "bằng",
    "hiu cng": "hiệu ứng",
    "t`i u": "tối ưu",
    "hoAn toAn": "hoàn toàn",
    "kim soAt": "kiểm soát",
    "`a t ng": "đa tầng",
    "ti liu": "tài liệu",
    "chi tit": "chi tiết",
    "`Anh giA": "đánh giá",
    "chA-nh xAc": "chính xác",
    "chA-nh thcc": "chính thức",
    "mAu s_c": "màu sắc",
    "d_ liu": "dữ liệu",
    "cc bT": "cục bộ",
    "  `ca": "ổ đĩa",
    "khA'ng th": "không thể",
    "trAn": "trên",
    "lu tr_": "lưu trữ",
    "phA-m": "phím",
    "tAi nguyAn": "tài nguyên",
    "g ngang": "gỡ ngang",
    "ph n ccng": "phần cứng",
    "siAu mt mA": "siêu mượt mà",
    "cTng `\"ng": "cộng đồng",
    "bn phAt hAnh": "bản phát hành",
    "Bn PhAt HAnh": "Bản Phát Hành",
    "KhYi ? u": "Khởi Đầu",
    "?i tu toAn din thit k": "Đại tu toàn diện thiết kế"
}

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for bad, good in replacements.items():
            content = content.replace(bad, good)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed {filepath}')
    except Exception as e:
        print(e)

fix_file('web/src/App.jsx')
fix_file('web/src/pages/Home.jsx')
fix_file('web/src/pages/Releases.jsx')
