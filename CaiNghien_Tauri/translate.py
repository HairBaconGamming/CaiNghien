import os
import re

# 1. Update commands.rs with Vietnamese paragraphs
commands_rs_path = "src-tauri/src/commands.rs"
with open(commands_rs_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('"Cosmic Spark".to_string()', '"Tia Lửa Vũ Trụ".to_string()')
content = content.replace('"Carl Sagan".to_string()', '"Vũ Trụ Học".to_string()')
content = content.replace('"The cosmos is within us. We are made of star-stuff. We are a way for the universe to know itself.".to_string()', '"Vũ trụ ở ngay bên trong chúng ta. Chúng ta được tạo ra từ những vì sao. Chúng ta là cách để vũ trụ tự nhận thức chính nó.".to_string()')

content = content.replace('"Deep Space Singularity".to_string()', '"Điểm Kỳ Dị Không Gian".to_string()')
content = content.replace('"Cosmic Astrobiology".to_string()', '"Sinh Vật Học Vũ Trụ".to_string()')
content = content.replace('"Navigating across relativistic spacetime requires unmatched discipline and pristine focus. Beyond the event horizon of distraction lies the luminous core of profound human potential, where every intentional stroke weaves the fabric of achievement.".to_string()', '"Vượt qua không thời gian tương đối đòi hỏi kỷ luật vô song và sự tập trung thuần khiết. Vượt xa khỏi chân trời sự kiện của sự xao nhãng là cốt lõi rực sáng của tiềm năng con người, nơi mọi nỗ lực đều dệt nên bức tranh thành tựu.".to_string()')

content = content.replace('"Quantum Speed".to_string()', '"Tốc Độ Lượng Tử".to_string()')
content = content.replace('"Cosmos Voyager".to_string()', '"Lữ Khách Vũ Trụ".to_string()')
content = content.replace('"The quick brown fox jumped gracefully over the lazy, sleeping dog. He then sprinted across the galaxy, weaving through constellations of glowing nebulae and vibrant supernovas, navigating the void with speed and accuracy.".to_string()', '"Con cáo nâu nhanh nhẹn nhảy qua con chó lười biếng đang ngủ. Sau đó, nó chạy nước rút qua dải ngân hà, len lỏi qua các chòm sao, tinh vân rực rỡ và siêu tân tinh sống động, băng qua khoảng không với tốc độ và độ chính xác đáng kinh ngạc.".to_string()')

with open(commands_rs_path, "w", encoding="utf-8") as f:
    f.write(content)

# 2. Update Navbar.tsx
navbar_path = "src/components/layout/Navbar.tsx"
with open(navbar_path, "r", encoding="utf-8") as f:
    navbar = f.read()

navbar = navbar.replace("label: 'Dashboard'", "label: 'Tổng quan'")
navbar = navbar.replace("label: 'Focus Room'", "label: 'Phòng tập trung'")
navbar = navbar.replace("label: 'Settings'", "label: 'Cài đặt'")
navbar = navbar.replace("label: 'Typing'", "label: 'Gõ phím'")
navbar = navbar.replace('title="Settings"', 'title="Cài đặt"')
navbar = navbar.replace("LVL", "CẤP")

with open(navbar_path, "w", encoding="utf-8") as f:
    f.write(navbar)

# 3. Update DashboardScreen.tsx
dashboard_path = "src/components/dashboard/DashboardScreen.tsx"
with open(dashboard_path, "r", encoding="utf-8") as f:
    dash = f.read()

dash = dash.replace("Dashboard", "Tổng quan")
dash = dash.replace("OVERVIEW", "TỔNG QUAN")
dash = dash.replace("Current Streak", "Chuỗi hiện tại")
dash = dash.replace("Total Contributions", "Tổng đóng góp")
dash = dash.replace("Longest Streak", "Chuỗi dài nhất")
dash = dash.replace("Focus Hours", "Giờ tập trung")
dash = dash.replace("Activity Heatmap", "Bản đồ hoạt động")
dash = dash.replace("Recent Focus Sessions", "Phiên tập trung gần đây")
dash = dash.replace("No recent focus sessions", "Không có phiên tập trung gần đây")
dash = dash.replace("Complete a session in the Focus Room to earn XP and build your streak.", "Hoàn thành một phiên trong Phòng tập trung để nhận XP và giữ chuỗi.")
dash = dash.replace("Daily Overview", "Tổng quan hàng ngày")
dash = dash.replace("Focus Mode", "Chế độ tập trung")
dash = dash.replace("Start Session", "Bắt đầu")

with open(dashboard_path, "w", encoding="utf-8") as f:
    f.write(dash)

print("Translation script complete.")
