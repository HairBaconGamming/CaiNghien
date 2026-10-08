use crate::db::DbState;
use crate::config::ConfigState;
use crate::config;
use crate::cambridge::{fetch_word_data, CambridgeEntry};
use serde::{Deserialize, Serialize};
use tauri::{State, AppHandle};
use rusqlite::params;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct IeltsTopic {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub icon: String,
}

#[derive(Serialize)]
pub struct IeltsWord {
    pub id: i64,
    pub topic_id: i64,
    pub word: String,
}

#[derive(Serialize)]
pub struct VocabProgress {
    pub word_id: i64,
    pub status: String,
    pub correct_streak: i64,
}

#[derive(Serialize)]
pub struct IeltsTestResult {
    pub success: bool,
    pub quota_added: u32,
    pub message: String,
}

#[tauri::command]
pub async fn get_ielts_topics(db: State<'_, DbState>) -> Result<Vec<IeltsTopic>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, icon FROM ielts_topics").map_err(|e| e.to_string())?;
    let topics = stmt.query_map([], |row| {
        Ok(IeltsTopic {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(topics)
}

#[tauri::command]
pub async fn get_topic_words(db: State<'_, DbState>, topic_id: i64) -> Result<Vec<IeltsWord>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT id, topic_id, word FROM ielts_words WHERE topic_id = ?1").map_err(|e| e.to_string())?;
    let words = stmt.query_map([topic_id], |row| {
        Ok(IeltsWord {
            id: row.get(0)?,
            topic_id: row.get(1)?,
            word: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(words)
}

#[tauri::command]
pub async fn fetch_cambridge(db: State<'_, DbState>, word: String) -> Result<CambridgeEntry, String> {
    {
        let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let cached: Option<CambridgeEntry> = conn.query_row(
            "SELECT pos, ipa_uk, ipa_us, audio_url_uk, audio_url_us, definition, examples FROM cambridge_cache WHERE word = ?1",
            [&word],
            |row| {
                let examples_json: String = row.get(6).unwrap_or_default();
                let examples: Vec<String> = serde_json::from_str(&examples_json).unwrap_or_default();
                Ok(CambridgeEntry {
                    pos: row.get(0).unwrap_or_default(),
                    ipa_uk: row.get(1).unwrap_or_default(),
                    ipa_us: row.get(2).unwrap_or_default(),
                    audio_url_uk: row.get(3).unwrap_or_default(),
                    audio_url_us: row.get(4).unwrap_or_default(),
                    definition: row.get(5).unwrap_or_default(),
                    examples,
                })
            }
        ).ok();
        if let Some(entry) = cached {
            return Ok(entry);
        }
    }
    
    let entry = fetch_word_data(&word).await?;
    
    {
        let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
        let examples_json = serde_json::to_string(&entry.examples).unwrap_or_default();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO cambridge_cache (word, pos, ipa_uk, ipa_us, audio_url_uk, audio_url_us, definition, examples, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
            params![word, entry.pos, entry.ipa_uk, entry.ipa_us, entry.audio_url_uk, entry.audio_url_us, entry.definition, examples_json]
        );
    }
    
    Ok(entry)
}

#[tauri::command]
pub async fn update_vocab_progress(db: State<'_, DbState>, word_id: i64, correct: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    
    let current_streak: i64 = conn.query_row("SELECT correct_streak FROM user_vocab_progress WHERE word_id = ?1", [word_id], |row| row.get(0)).unwrap_or(0);
    
    let new_streak = if correct { current_streak + 1 } else { 0 };
    let status = if new_streak >= 3 { "mastered" } else { "learning" };
    
    conn.execute(
        "INSERT INTO user_vocab_progress (word_id, status, correct_streak, last_tested_at) VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(word_id) DO UPDATE SET status = ?2, correct_streak = ?3, last_tested_at = datetime('now')",
        params![word_id, status, new_streak]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_vocab_progress(db: State<'_, DbState>, topic_id: i64) -> Result<Vec<VocabProgress>, String> {
    let conn = db.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    let mut stmt = conn.prepare("SELECT p.word_id, p.status, p.correct_streak FROM user_vocab_progress p JOIN ielts_words w ON p.word_id = w.id WHERE w.topic_id = ?1").map_err(|e| e.to_string())?;
    let progress = stmt.query_map([topic_id], |row| {
        Ok(VocabProgress {
            word_id: row.get(0)?,
            status: row.get(1)?,
            correct_streak: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();
    Ok(progress)
}

#[tauri::command]
pub async fn submit_ielts_test(
    app: AppHandle,
    state: State<'_, ConfigState>,
    score: u32,
    total: u32,
    mode: String
) -> Result<IeltsTestResult, String> {
    if score != total || total == 0 {
        return Ok(IeltsTestResult {
            success: false,
            quota_added: 0,
            message: "Báº¡n pháº£i Ä‘áº¡t 100% Ä‘á»ƒ nháº­n thÆ°á»Ÿng.".to_string()
        });
    }

    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;

    if mode == "quota" {
        let reward = crate::commands::calculate_study_reward_quota(
            total,
            config_data.study_minutes_required,
            config_data.reward_quota_minutes,
        );
        config_data.daily_quota_minutes = config_data.daily_quota_minutes.saturating_add(reward);
        let _ = config::save_config(&app, &config_data);
        Ok(IeltsTestResult {
            success: true,
            quota_added: reward,
            message: format!("ÄÃ£ cá»™ng {} phÃºt vÃ o Quota.", reward)
        })
    } else if mode == "unlock" {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        config_data.temporary_unlock_until = Some(now + 300);
        let _ = config::save_config(&app, &config_data);
        Ok(IeltsTestResult {
            success: true,
            quota_added: 0,
            message: "ÄÃ£ má»Ÿ khÃ³a cÃ i Ä‘áº·t trong 5 phÃºt.".to_string()
        })
    } else {
        Err("Invalid mode".to_string())
    }
}


#[tauri::command]
pub async fn open_ielts_battle(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // If it already exists, just focus it
    if let Some(existing_window) = app.get_webview_window("ielts_battle") {
        let _ = existing_window.set_focus();
        let _ = existing_window.show();
        return Ok(());
    }

    let main_window = app.get_webview_window("main").ok_or("No main window")?;
    let outer_pos = main_window.outer_position().map_err(|e| e.to_string())?;
    let inner_size = main_window.inner_size().map_err(|e| e.to_string())?;

    let init_script = r#"
        setInterval(() => {
            try {
                let text = document.body.innerText.toLowerCase();
                // Detected end of match screen
                if (text.includes('match result') || text.includes('victory') || text.includes('defeat') || window.location.href.includes('/result')) {
                    if (!sessionStorage.getItem('__ielts_success_sent_match')) {
                        sessionStorage.setItem('__ielts_success_sent_match', 'true');
                        window.__TAURI__.core.invoke('ielts_battle_success', {}).catch(console.error);
                    }
                } else if (!window.location.href.includes('/result')) {
                    sessionStorage.removeItem('__ielts_success_sent_match');
                }
            } catch(e) {}

            if (window.location.href.includes('/profile') || window.location.href.includes('/user')) {
                try {
                    let match = document.body.innerText.match(/Total battles\s+(\d+)|Total battles.*?\n(\d+)/i);
                    if (match) {
                        let battles = parseInt(match[1] || match[2], 10);
                        let initial = sessionStorage.getItem('__ielts_initial_battles');
                        if (initial === null) {
                            sessionStorage.setItem('__ielts_initial_battles', battles.toString());
                        } else if (battles > parseInt(initial, 10)) {
                            sessionStorage.setItem('__ielts_initial_battles', battles.toString());
                            window.__TAURI__.core.invoke('ielts_battle_success', {}).catch(console.error);
                        }
                    }
                } catch(e) {}
            }
        }, 2000);
        
    "#;

    let _webview = tauri::WebviewWindowBuilder::new(
        &app,
        "ielts_battle",
        tauri::WebviewUrl::External("https://ieltsleague.app".parse().unwrap())
    )
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    .title("IELTS League")
    .decorations(true) // Set decorations true so user can close or manipulate it
    .visible(true)
    .focused(true)
    .inner_size(inner_size.width as f64, (inner_size.height.saturating_sub(80)) as f64)
    .position(outer_pos.x as f64, (outer_pos.y + 80) as f64)
    .initialization_script(init_script)
    .on_new_window(|_, _| tauri::webview::NewWindowResponse::Allow)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ielts_battle_success(
    app: AppHandle,
    state: State<'_, ConfigState>
) -> Result<(), String> {
    use tauri::{Manager, Emitter};
    
    
    let mut config_data = state.0.lock().map_err(|_| "Mutex poisoned".to_string())?;
    config_data.daily_quota_minutes = config_data.daily_quota_minutes.saturating_add(30);
    let _ = crate::config::save_config(&app, &config_data);
    
    let _ = app.emit("battle_success", ());
    Ok(())
}



