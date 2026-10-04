use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CambridgeEntry {
    pub pos: String,
    pub ipa_uk: String,
    pub ipa_us: String,
    pub audio_url_uk: String,
    pub audio_url_us: String,
    pub definition: String,
    pub examples: Vec<String>,
}

pub async fn fetch_word_data(word: &str) -> Result<CambridgeEntry, String> {
    let url = format!("https://dictionary.cambridge.org/dictionary/english/{}", word);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Ok(fallback_entry(word));
    }
    
    let html_content = res.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html_content);
    
    let pos_sel = Selector::parse(".pos.dpos").unwrap();
    let pos = document.select(&pos_sel).next().map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
    
    let uk_sel = Selector::parse(".uk.dpron-i").unwrap();
    let us_sel = Selector::parse(".us.dpron-i").unwrap();
    let ipa_sel = Selector::parse(".ipa.dipa").unwrap();
    let audio_sel = Selector::parse("source[src]").unwrap();

    let extract_ipa_audio = |parent_sel: &Selector| -> (String, String) {
        if let Some(block) = document.select(parent_sel).next() {
            let ipa = block.select(&ipa_sel).next().map(|el| el.text().collect::<Vec<_>>().join("")).unwrap_or_default();
            let audio = block.select(&audio_sel).next().and_then(|el| el.value().attr("src")).map(|s| format!("https://dictionary.cambridge.org{}", s)).unwrap_or_default();
            (ipa, audio)
        } else {
            (String::new(), String::new())
        }
    };

    let (ipa_uk, audio_url_uk) = extract_ipa_audio(&uk_sel);
    let (ipa_us, audio_url_us) = extract_ipa_audio(&us_sel);

    let def_sel = Selector::parse(".def.ddef_d").unwrap();
    let definition = document.select(&def_sel).next().map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_default();
    
    let eg_sel = Selector::parse(".eg.deg").unwrap();
    let examples = document.select(&eg_sel).take(3).map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string()).collect();

    if definition.is_empty() {
        return Ok(fallback_entry(word));
    }

    Ok(CambridgeEntry {
        pos,
        ipa_uk,
        ipa_us,
        audio_url_uk,
        audio_url_us,
        definition,
        examples,
    })
}

fn fallback_entry(_word: &str) -> CambridgeEntry {
    CambridgeEntry {
        pos: String::new(),
        ipa_uk: String::new(),
        ipa_us: String::new(),
        audio_url_uk: String::new(),
        audio_url_us: String::new(),
        definition: String::new(),
        examples: vec![],
    }
}
