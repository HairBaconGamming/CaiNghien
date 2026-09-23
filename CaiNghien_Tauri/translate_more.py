import os

# TypingChallengeScreen
path = "src/components/typing/TypingChallengeScreen.tsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("TYPING CHALLENGE", "THỬ THÁCH GÕ PHÍM")
text = text.replace("QUANTUM SPEED", "TỐC ĐỘ LƯỢNG TỬ")
text = text.replace("PARAGRAPH TO TYPE", "ĐOẠN VĂN MẪU")
text = text.replace("Mode:", "Chế độ:")
text = text.replace("YOUR TYPING INPUT", "BẠN GÕ TẠI ĐÂY")
text = text.replace("The quick brown fox jumped...", "Con cáo nâu nhanh nhẹn nhảy qua...")
text = text.replace("Typing must be typed by hand — copy/paste disabled", "Bạn phải tự gõ — không cho phép copy/paste")
text = text.replace("Click vortex to reset challenge", "Nhấp vào vòng xoáy để tải lại thử thách")
text = text.replace("LOCK PROGRESS", "TIẾN TRÌNH KHÓA")
text = text.replace("CANCEL", "HỦY")
text = text.replace("SUBMIT", "NỘP BÀI")
text = text.replace("SAVING...", "ĐANG LƯU...")
text = text.replace("QUANTUM LOCK ACHIEVED!", "ĐẠT MỐC LƯỢNG TỬ!")
text = text.replace("Rank:", "Hạng:")
text = text.replace("Quantum Voyager", "Lữ khách lượng tử")
text = text.replace("Speed", "Tốc độ")
text = text.replace("Accuracy", "Độ chính xác")
text = text.replace("Time", "Thời gian")
text = text.replace("Cosmic XP Earned:", "Cosmic XP Đạt được:")
text = text.replace("Score verified and synced to Activity Heatmap", "Điểm đã được xác minh và đồng bộ vào Bản đồ Hoạt động")
text = text.replace("Try Again", "Thử lại")
text = text.replace("Next Difficulty", "Mức khó tiếp theo")
text = text.replace("Score recorded locally (Backend offline)", "Lưu điểm cục bộ (Backend offline)")
text = text.replace("Please type the paragraph before submitting.", "Vui lòng gõ đoạn văn trước khi nộp bài.")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

# TypingInput
path = "src/components/typing/TypingInput.tsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("Restart challenge", "Bắt đầu lại thử thách")
text = text.replace("Restart", "Bắt đầu lại")
text = text.replace("Load another cosmic text", "Tải văn bản cosmic khác")
text = text.replace("New Challenge", "Thử thách mới")
text = text.replace("Type the text above here...", "Gõ đoạn văn mẫu ở trên vào đây...")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

# FocusRoomScreen
path = "src/components/focus/FocusRoomScreen.tsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("FOCUS ROOM", "PHÒNG TẬP TRUNG")
text = text.replace("ABANDON SESSION", "HỦY PHIÊN")
text = text.replace("RESUME SESSION", "TIẾP TỤC PHIÊN")
text = text.replace("PAUSE SESSION", "TẠM DỪNG PHIÊN")
text = text.replace("Are you sure you want to abandon?", "Bạn có chắc chắn muốn hủy bỏ?")
text = text.replace("All current progress and potential XP will be lost. Your streak is safe, but no focus time will be recorded.", "Toàn bộ tiến trình hiện tại và XP sẽ bị mất. Chuỗi của bạn vẫn an toàn, nhưng thời gian tập trung sẽ không được ghi lại.")
text = text.replace("KEEP FOCUSING", "TIẾP TỤC TẬP TRUNG")
text = text.replace("ABANDON", "HỦY BỎ")
text = text.replace("SESSION COMPLETED", "PHIÊN HOÀN THÀNH")
text = text.replace("Outstanding focus! Your discipline fuels the cosmic engine.", "Tập trung xuất sắc! Kỷ luật của bạn tiếp nhiên liệu cho động cơ vũ trụ.")
text = text.replace("Focus Time:", "Thời gian tập trung:")
text = text.replace("XP Earned:", "XP Đạt được:")
text = text.replace("RETURN TO DASHBOARD", "QUAY LẠI TỔNG QUAN")
text = text.replace("Focus room strict mode engaged. Stay on task.", "Chế độ nghiêm ngặt phòng tập trung đã bật. Hãy tập trung vào nhiệm vụ.")
text = text.replace("Deep Focus", "Tập trung sâu")
text = text.replace("Pomodoro", "Pomodoro")
text = text.replace("Short Break", "Nghỉ ngắn")
text = text.replace("Long Break", "Nghỉ dài")
text = text.replace("Mode", "Chế độ")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

# Titlebar
path = "src/components/layout/Titlebar.tsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("CaiNghien Cosmic", "CaiNghien Cosmic") # Keep it or change? Let's keep it.

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Additional translation complete.")
