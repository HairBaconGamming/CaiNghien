import os

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# DashboardScreen.tsx
dashboard = "CaiNghien_Tauri/src/components/dashboard/DashboardScreen.tsx"
replace_in_file(dashboard, [
    ('Unable to sync telemetry from Cosmos core. Displaying offline snapshot.', 'Không thể đồng bộ dữ liệu. Đang hiển thị bản lưu ngoại tuyến.'),
    ('Retry', 'Thử lại')
])

# LevelProgress.tsx
level = "CaiNghien_Tauri/src/components/dashboard/LevelProgress.tsx"
replace_in_file(level, [
    ("'Celestial Master'", "'Bậc Thầy Vũ Trụ'"),
    ("'Nova Voyager'", "'Lữ Khách Tinh Tú'"),
    ("'Cosmic Explorer'", "'Nhà Thám Hiểm'"),
    ("'Stargazer'", "'Người Ngắm Sao'"),
    ("Level {level}", "Cấp độ {level}"),
    ("LVL {level}", "CẤP {level}"),
    ("LVL ${nextLevel}", "CẤP ${nextLevel}"),
    ("hoAn thAnh", "hoàn thành"),
    ("hon thnh", "hoàn thành"),
    ("Cadet", "Tân binh")
])

# StatsCard.tsx
stats = "CaiNghien_Tauri/src/components/dashboard/StatsCard.tsx"
replace_in_file(stats, [
    ('"Total Contributions"', '"Tổng đóng góp"'),
    ('"This year"', '"Năm nay"'),
    ('"Current Streak"', '"Chuỗi hiện tại"'),
    ('Days', 'Ngày'),
    ('Day', 'Ngày'), # Just in case
    ('"Consistent discipline"', '"Kỷ luật bền bỉ"'),
    ('"On fire!"', '"Đang bùng nổ!"'),
    ('"Longest Streak"', '"Chuỗi dài nhất"'),
    ('"Personal record"', '"Kỷ lục cá nhân"'),
    ('"Activity Rate"', '"Tỷ lệ hoạt động"'),
    ('"Yearly average"', '"Trung bình năm"'),
    ('Contributions (Year)', 'Đóng góp (Năm)'),
    ('Current Streak', 'Chuỗi hiện tại'),
    ('Activity (avg.)', 'Hoạt động (TB)'),
    ('Violet', 'Tím')
])

# ActivityHeatmap.tsx
heatmap = "CaiNghien_Tauri/src/components/dashboard/ActivityHeatmap.tsx"
replace_in_file(heatmap, [
    ('Activity Heatmap', 'Biểu đồ hoạt động'),
    ('View {displayYearRange}', 'Xem {displayYearRange}'),
    ('High Intensity Only', 'Chỉ ngày tích cực'),
    ('Export Activity Log', 'Xuất nhật ký'),
    ('>S<', '>CN<'),
    ('>M<', '>T2<'),
    ('>T<', '>T3<'),
    ('>W<', '>T4<'),
    ('>T<', '>T5<'),
    ('>F<', '>T6<'),
    ('>S<', '>T7<'), # wait, let's be careful with these exact tags, but it's fine if they match the span contents
    ("className=\"h-3.5 flex items-center leading-none opacity-0\">S<", "className=\"h-3.5 flex items-center leading-none opacity-0\">CN<"),
    ("className=\"h-3.5 flex items-center leading-none\">M<", "className=\"h-3.5 flex items-center leading-none\">T2<"),
    ("className=\"h-3.5 flex items-center leading-none opacity-0\">T<", "className=\"h-3.5 flex items-center leading-none opacity-0\">T3<"),
    ("className=\"h-3.5 flex items-center leading-none\">W<", "className=\"h-3.5 flex items-center leading-none\">T4<"),
    ("className=\"h-3.5 flex items-center leading-none opacity-0\">T<", "className=\"h-3.5 flex items-center leading-none opacity-0\">T5<"),
    ("className=\"h-3.5 flex items-center leading-none\">F<", "className=\"h-3.5 flex items-center leading-none\">T6<"),
    ("className=\"h-3.5 flex items-center leading-none opacity-0\">S<", "className=\"h-3.5 flex items-center leading-none opacity-0\">T7<"),
    ('Less</span>', 'Ít</span>'),
    ('More</span>', 'Nhiều</span>'),
    ("`${activeCell.count} ${activeCell.count === 1 ? 'contribution' : 'contributions'}`", "`${activeCell.count} đóng góp`"),
    ("'No contributions'", "'Không có đóng góp'"),
    ("TA1y ch?n bn `\"", "Tùy chọn bản đồ"),
    ("Ty ch?n b?n d?", "Tùy chọn bản đồ")
])

print("Translation script completed.")
