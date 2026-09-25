---
name: release-it
description: Custom release pipeline for CaiNghien. Prompts user for release type, builds apps, and updates Github + Web.
---

# Release It (CaiNghien Custom Release Pipeline)

This skill automates the release and git sync process for the CaiNghien project.
When the user invokes this skill (e.g. by saying "release it" or using a slash command if configured), follow these exact instructions:

## Step 1: Prompt the User
Use the `ask_question` tool to ask the user what type of release/sync they want to perform.
**Question:** "Bạn muốn thực hiện tác vụ Release nào cho dự án CaiNghiện?"
**Options:**
1. **Push lên GitHub (Chỉ đẩy code)** - Đẩy các thay đổi mã nguồn mới nhất lên GitHub (git add, commit, push) mà không tạo bản phát hành mới.
2. **Pull từ GitHub (Cập nhật code)** - Lấy mã nguồn mới nhất từ GitHub về máy (git pull).
3. **Phát hành Phiên bản mới (Full Release)** - Tự động tăng phiên bản, build MSI/EXE, cập nhật Website và tạo GitHub Release mới.

## Step 2: Handle the User's Choice

### If "Push lên GitHub":
1. Ask the user for a commit message (or generate a concise one based on `git status` and recent chat context).
2. Run `git add .`
3. Run `git commit -m "<message>"`
4. Run `git push origin main`
5. Report success to the user.

### If "Pull từ GitHub":
1. Run `git pull origin main`.
2. Report success to the user.

### If "Phát hành Phiên bản mới (Full Release)":
This is the complete release pipeline.
1. **Determine Version:** Ask the user what the new version number should be (e.g. `v1.4.0`), and ask them to provide a brief list of Release Notes (or auto-generate based on recent features).
2. **Bump Versions:** Update `CaiNghien_Tauri/package.json`, `CaiNghien_Tauri/src-tauri/tauri.conf.json`, and `CaiNghien_Tauri/src-tauri/Cargo.toml` with the new version string (e.g. `1.4.0`).
3. **Update Web Database:** Read `web/public/data/releases.json`. Prepend a new release object to the `releases` array matching the exact schema of previous releases (including `files.installer` and `files.msi` objects). Set `latest` to the new version.
4. **Build the Tauri App:** Run `npm run tauri build` in `CaiNghien_Tauri` to generate the `.exe` (nsis) and `.msi` installers. (This may take several minutes; use the `schedule` tool to wait if necessary).
5. **Build the Web App:** Run `npm run build` in the `web/` directory.
6. **Commit & Tag:** 
   - `git add .`
   - `git commit -m "chore(release): bump version to v<version>"`
   - `git tag -a v<version> -m "Release v<version>"`
   - `git push origin main`
   - `git push origin v<version>`
7. **Create GitHub Release:** Use the GitHub CLI to create the release and upload the assets:
   - `gh release create v<version> "CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_<version>_x64-setup.exe" "CaiNghien_Tauri/src-tauri/target/release/bundle/msi/cainghien_tauri_<version>_x64_en-US.msi" --title "v<version>" --notes "<release notes>"`
8. **Finalize:** Inform the user that the full release is complete and the website has been updated!
