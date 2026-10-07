use cainghien_tauri::models::AppConfig;
fn main() {
    let config = AppConfig::default();
    println!("{}", serde_json::to_string(&config).unwrap());
}
