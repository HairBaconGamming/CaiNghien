import os

# fix api.ts
api_path = "src/services/api.ts"
with open(api_path, "r", encoding="utf-8", errors='ignore') as f:
    text = f.read()

# remove duplicate resetAllData at bottom
if text.endswith("\n\nexport async function resetAllData(): Promise<void> {\n  return safeInvoke<void>('reset_all_data', {});\n}\n\nexport async function resetAllData(): Promise<void> {\n  return safeInvoke<void>('reset_all_data', {});\n}"):
    text = text.replace("\n\nexport async function resetAllData(): Promise<void> {\n  return safeInvoke<void>('reset_all_data', {});\n}\n\nexport async function resetAllData(): Promise<void> {\n  return safeInvoke<void>('reset_all_data', {});\n}", "")

if not "export async function resetAllData(): Promise<void>" in text:
    text = text + "\nexport async function resetAllData(): Promise<void> {\n  return safeInvoke<void>('reset_all_data', {});\n}\n"

if "  resetAllData,\n  isTauriEnvironment," not in text:
    text = text.replace("  isTauriEnvironment,", "  resetAllData,\n  isTauriEnvironment,")

with open(api_path, "w", encoding="utf-8") as f:
    f.write(text)

# fix db.rs
db_path = "src-tauri/src/db.rs"
with open(db_path, "r", encoding="utf-8", errors='ignore') as f:
    text = f.read()

text = text.replace("'Alex Chen'", "'Người Dùng'")
text = text.replace("'@astro_alex'", "'@nguoidung'")
text = text.replace("'Stargazer'", "'Tân Binh'")
text = text.replace("'Nova Voyager (LVL 29)'", "'Tân binh (LVL 2)'")
text = text.replace("level INTEGER NOT NULL DEFAULT 28,", "level INTEGER NOT NULL DEFAULT 1,")
text = text.replace("current_xp INTEGER NOT NULL DEFAULT 14350,", "current_xp INTEGER NOT NULL DEFAULT 0,")
text = text.replace("next_level_xp INTEGER NOT NULL DEFAULT 15000,", "next_level_xp INTEGER NOT NULL DEFAULT 1000,")
text = text.replace("streak INTEGER NOT NULL DEFAULT 128,", "streak INTEGER NOT NULL DEFAULT 0,")
text = text.replace("longest_streak INTEGER NOT NULL DEFAULT 156,", "longest_streak INTEGER NOT NULL DEFAULT 0,")

if "pub fn reset_all_data" not in text:
    text += """

pub fn reset_all_data(conn: &mut Connection) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM daily_contributions;", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM focus_sessions;", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM typing_scores;", []).map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE user_profile SET
            level = 1,
            level_title = 'Người mới',
            next_level_title = 'Tân binh (LVL 2)',
            current_xp = 0,
            next_level_xp = 1000,
            streak = 0,
            longest_streak = 0,
            total_focus_hours = 0,
            rank = 'Tân Binh'
         WHERE id = 1;",
        [],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
"""

with open(db_path, "w", encoding="utf-8") as f:
    f.write(text)


# fix commands.rs
cmds_path = "src-tauri/src/commands.rs"
with open(cmds_path, "r", encoding="utf-8", errors='ignore') as f:
    text = f.read()

if "pub fn reset_all_data" not in text:
    text += """
#[tauri::command]
pub fn reset_all_data(state: State<'_, DbState>) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::reset_all_data(&mut conn)
}
"""

with open(cmds_path, "w", encoding="utf-8") as f:
    f.write(text)


print("Fix script complete.")
