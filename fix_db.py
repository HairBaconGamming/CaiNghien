import re

with open('CaiNghien_Tauri/src-tauri/src/db.rs', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''#[derive(serde::Deserialize)]
struct SeedTopic {
    name: String,
    description: String,
    icon: String,
    words: Vec<String>,
}

fn seed_ielts_data(tx: &rusqlite::Transaction) -> Result<(), rusqlite::Error> {
    let json_data = include_str!(\"../../assets/ielts_vocab.json\");
    let topics: Vec<SeedTopic> = serde_json::from_str(json_data).unwrap_or_else(|_| vec![]);

    let mut topic_stmt = tx.prepare(\"INSERT INTO ielts_topics (name, description, icon) VALUES (?1, ?2, ?3)\")?;
    let mut word_stmt = tx.prepare(\"INSERT INTO ielts_words (topic_id, word) VALUES (?1, ?2)\")?;

    for topic in topics {
        topic_stmt.execute(rusqlite::params![topic.name, topic.description, topic.icon])?;
        let topic_id = tx.last_insert_rowid();
        for word in topic.words {
            word_stmt.execute(rusqlite::params![topic_id, word])?;
        }
    }
    Ok(())
}'''

pattern = re.compile(r'fn seed_ielts_data.*?Ok\(\(\)\)\n\}', re.DOTALL)
new_content = pattern.sub(replacement, content)

with open('CaiNghien_Tauri/src-tauri/src/db.rs', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Replaced seed_ielts_data function.')
