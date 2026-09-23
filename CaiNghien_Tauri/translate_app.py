import os

app_path = "src/App.tsx"
with open(app_path, "r", encoding="utf-8") as f:
    app = f.read()

app = app.replace("Focus Guard & Cosmos Settings", "Cài đặt Focus Guard & Cosmos")
app = app.replace("Configure discipline thresholds, password protection, and deep space aesthetics.", "Định cấu hình kỷ luật, mật khẩu bảo vệ và giao diện.")
app = app.replace("Master Protection", "Bảo vệ chính")
app = app.replace("Active Protection Engaged", "Đã bật bảo vệ")
app = app.replace("Focus Guard is active. Settings and password modifications are strictly locked. Complete a challenge to unlock.", "Focus Guard đang hoạt động. Cài đặt và mật khẩu đã bị khóa. Hoàn thành thử thách để mở khóa.")
app = app.replace("Type to Unlock", "Gõ để mở khóa")
app = app.replace("Password & Security", "Mật khẩu & Bảo mật")
app = app.replace("App Password is ", "Mật khẩu app ")
app = app.replace("'Set' : 'Not Set'", "'Đã đặt' : 'Chưa đặt'")
app = app.replace("Enforce strict exit barriers", "Áp đặt rào cản thoát nghiêm ngặt")
app = app.replace("Change Password", "Đổi mật khẩu")
app = app.replace("Discipline Enforcement", "Thực thi kỷ luật")
app = app.replace("Blocked Domains", "Tên miền bị chặn")
app = app.replace("One domain per line", "Mỗi tên miền một dòng")
app = app.replace("Save Domains", "Lưu tên miền")
app = app.replace("System & Startup", "Hệ thống & Khởi động")
app = app.replace("Start with Windows", "Khởi động cùng window")
app = app.replace("Launch CaiNghien in background on system boot", "Chạy CaiNghien ngầm khi khởi động hệ thống")
app = app.replace("Block NSFW", "Chặn nội dung NSFW")
app = app.replace("Automatically block known adult content", "Tự động chặn nội dung người lớn")
app = app.replace("Settings Lock Delay", "Độ trễ khóa cài đặt")
app = app.replace("Enforce a delay when disabling protection", "Áp đặt độ trễ khi tắt bảo vệ")
app = app.replace("System Updates", "Cập nhật hệ thống")
app = app.replace("Cosmic Core Engine", "Cập nhật phần mềm")
app = app.replace("Check for the latest features", "Kiểm tra tính năng mới nhất")
app = app.replace("isCheckingUpdate ? 'Checking...' : 'Check'", "isCheckingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra'")

# Add Reset Data button
reset_data_html = """                  <div className="glass-panel rounded-2xl p-6 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-red-400" />
                      <h3 className="text-base font-bold text-white">Xóa dữ liệu (Reset Data)</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Xóa toàn bộ dữ liệu</p>
                          <p className="text-xs text-slate-400">Xóa lịch sử tập trung, thành tích và đưa tài khoản về cấp độ 1</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu? Thao tác này không thể hoàn tác.')) {
                              try {
                                await api.resetAllData();
                                alert('Đã xóa dữ liệu thành công!');
                                window.location.reload();
                              } catch (e) {
                                alert('Lỗi: ' + e);
                              }
                            }
                          }}
                          disabled={settingsLocked}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-red-600/80 hover:bg-red-500 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          Xóa dữ liệu
                        </button>
                      </div>
                    </div>
                  </div>
                </div>"""

app = app.replace("                </div>\n              </div>", reset_data_html + "\n              </div>")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(app)

print("App.tsx translation complete.")
