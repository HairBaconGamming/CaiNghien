# CaiNghien Focus Guard

App Python cho Windows giup cai nghien may tinh theo 2 che do:

- `Binh thuong`: chan cac domain mang xa hoi trong khung gio da dat, mac dinh `17:00 -> 20:00`.
- `Nghiem khac`: chan web va hien man hinh khoa toan man hinh; muon tat bao ve phai nhap mat khau.

Gemini (`gemini.google.com`) la domain duy nhat duoc giu san trong allow-list mac dinh.

## Tinh nang

- UI desktop hien dai bang `PySide6`, bo cuc dang card ro rang.
- Lich theo tung ngay trong tuan.
- Canh bao truoc gio khoa, manual lock countdown, va tri hoan thay doi cau hinh khi dang sat gio khoa.
- Safe mode chong lach, heartbeat giua UI va service, nhat ky chong pha, thong ke 7 ngay.
- Service nen Windows de giu hosts blocking, pending change va startup self-heal.
- Updater co hoi y kien nguoi dung, tu tai installer moi va don cache ban cap nhat cu.
- Website release hub trong thu muc `web/`, san sang deploy len Render static site.
- Luu cau hinh, state va event log trong `%PROGRAMDATA%\CaiNghienFocusGuard` (installer tao quyen ghi cho user thuong).
- Chan domain qua file `hosts` cua Windows.
- Ho tro khoi dong cung Windows o che do background.
- Che do nghiem khac co mat khau hash bang PBKDF2.

## Cai dat

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

## Build release Windows

De dong goi lai ban `.exe` va installer:

```powershell
.venv\Scripts\python -m pip install -r requirements-build.txt
.\build_release.ps1
```

Artifacts sau khi build:

- `.release_dist\<timestamp>\CaiNghienFocusGuard.exe`: ban app one-file co icon va metadata.
- `.release_dist\<timestamp>\CaiNghienFocusGuardService.exe`: service/watcher nen Windows.
- `dist\installer\CaiNghienFocusGuard-Setup-<timestamp>.exe`: bo cai installer cho Windows.
- `assets\CaiNghienFocusGuard.ico`: icon release.

Sau moi lan build, script se:

- cap nhat `web\data\releases.json`
- cap nhat `web\data\update-manifest.json`
- copy ban moi vao `web\downloads\`
- don bot artifact build cu trong `.release_dist`, `.release_work` va `dist\installer`

## Web Render

Static site nam trong thu muc `web\`.

- build local: `npm run build --prefix web`
- cau hinh Render: `render.yaml`
- file updater manifest: `web\data\update-manifest.json`
- lich su versions: `web\data\releases.json`

## Luu y

- De chan website bang `hosts`, hay mo app bang quyen `Run as administrator`.
- Che do nghiem khac trong ban nay van khoa o tang user session:
  - Hien man hinh khoa full-screen.
  - Goi `LockWorkStation()` theo chu ky tu UI khi dang trong khung gio khoa.
  - Service nen khong ve UI, chi giu enforcement va watchdog.
- Windows van khong cho app nguoi dung chan hoan toan cac phim he thong nhu `Ctrl + Alt + Del`.
