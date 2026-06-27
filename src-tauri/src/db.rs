use rusqlite::Connection;

pub fn init(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS job (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            salary TEXT,
            location TEXT,
            experience TEXT,
            education TEXT,
            company_size TEXT,
            source_url TEXT,
            source_text TEXT,
            jd_raw_content TEXT NOT NULL,
            jd_parsed_content TEXT,
            keywords TEXT,
            preference_level TEXT NOT NULL DEFAULT 'none',
            application_status TEXT NOT NULL DEFAULT 'not_applied',
            recruitment_status TEXT NOT NULL DEFAULT 'active',
            interview_date TEXT,
            interview_feedback TEXT,
            interview_questions TEXT,
            interview_rounds TEXT,
            notes TEXT,
            ai_interview_guide TEXT NOT NULL DEFAULT '',
            role_analysis TEXT,
            interview_insights TEXT,
            preparation_guide TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_provider_config (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT NOT NULL,
            base_url TEXT,
            model TEXT NOT NULL,
            multimodal_model TEXT,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );",
    )?;

    // Migrate: add new columns if they don't exist (compatible with old DB)
    let new_columns = [
        ("role_analysis", "TEXT"),
        ("interview_insights", "TEXT"),
        ("preparation_guide", "TEXT"),
        ("company_address", "TEXT"),
        ("interview_rounds", "TEXT"),
        ("jd_images", "TEXT"),
    ];
    for (col, ty) in new_columns {
        // ALTER TABLE ADD COLUMN fails silently if column exists in SQLite >= 3.35
        // but for broader compat, ignore the error
        let _ = conn.execute_batch(&format!(
            "ALTER TABLE job ADD COLUMN {} {};",
            col, ty
        ));
    }

    // Migrate: 「已拒绝 rejected」已合并进「已淘汰 eliminated」，把存量数据归一（幂等）
    let _ = conn.execute_batch(
        "UPDATE job SET application_status = 'eliminated' WHERE application_status = 'rejected';",
    );

    Ok(())
}
