import sqlite3
import urllib.request
import os
import sys

def fetch_words():
    # Fetch top 10000 english words, filter for length >= 5 to get more meaningful words
    url = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"
    try:
        response = urllib.request.urlopen(url)
        data = response.read().decode('utf-8')
        words = data.split('\n')
        words = [w.strip() for w in words if len(w.strip()) >= 5][:1000]
        return words
    except Exception as e:
        print("Failed to fetch words:", e)
        # Fallback list if internet is not available
        return ["abandon", "ability", "absence", "academy", "account", "achieve", "acquire", "address", "advance", "adverse"] * 100

def main():
    words = fetch_words()
    topics = [
        {"name": "Education", "icon": "🎓", "desc": "Words related to school, learning, and academic environments."},
        {"name": "Environment", "icon": "🌳", "desc": "Words related to nature, ecology, and climate."},
        {"name": "Technology", "icon": "💻", "desc": "Words related to computers, internet, and digital tech."},
        {"name": "Health", "icon": "⚕️", "desc": "Words related to medicine, well-being, and fitness."},
        {"name": "Business", "icon": "💼", "desc": "Words related to economics, corporate work, and finance."},
        {"name": "Society", "icon": "🏙️", "desc": "Words related to people, culture, and communities."},
        {"name": "Science", "icon": "🔬", "desc": "Words related to research, physics, and biology."},
        {"name": "Arts", "icon": "🎨", "desc": "Words related to creativity, design, and expression."},
        {"name": "Travel", "icon": "✈️", "desc": "Words related to tourism, places, and transportation."},
        {"name": "History", "icon": "🏛️", "desc": "Words related to the past, historical events, and heritage."}
    ]
    
    # Path to DB - CAINGHIEN_DB_PATH or APPDATA or fallback to data/cainghien.db
    db_path = os.environ.get("CAINGHIEN_DB_PATH")
    if not db_path:
        appdata = os.environ.get('APPDATA')
        if appdata:
            db_path = os.path.join(appdata, "com.cainghien.desktop", "cainghien.db")
        else:
            db_path = os.path.join(os.path.dirname(__file__), "..", "data", "cainghien.db")

    if not os.path.exists(db_path):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        print(f"Database file not found at {db_path}. SQLite will create it, but ensure the app uses this path.")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables if not exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ielts_topics (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT DEFAULT '📚'
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ielts_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL REFERENCES ielts_topics(id),
        word TEXT NOT NULL,
        UNIQUE(topic_id, word)
    )
    """)

    # Insert topics and words
    words_per_topic = len(words) // len(topics)
    word_idx = 0

    for i, topic in enumerate(topics):
        cursor.execute("INSERT OR REPLACE INTO ielts_topics (id, name, description, icon) VALUES (?, ?, ?, ?)",
                       (i+1, topic["name"], topic["desc"], topic["icon"]))
        
        for _ in range(words_per_topic):
            if word_idx < len(words):
                cursor.execute("INSERT OR IGNORE INTO ielts_words (topic_id, word) VALUES (?, ?)",
                               (i+1, words[word_idx]))
                word_idx += 1

    conn.commit()
    conn.close()
    print(f"Successfully inserted {word_idx} words into {len(topics)} topics at {db_path}")

if __name__ == "__main__":
    main()
