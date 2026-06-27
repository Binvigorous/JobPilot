use crate::ai;
use crate::models::*;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn ai_config_list(state: State<'_, AppState>) -> Result<Vec<AiProviderConfig>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM ai_provider_config ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let configs = stmt
        .query_map([], |row| AiProviderConfig::from_row(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(configs.into_iter().map(|c| c.masked()).collect())
}

/// Return unmasked config for internal use (AI calls).
/// The masked version is only for display in the UI list.
#[tauri::command]
pub fn ai_config_get_active(
    state: State<'_, AppState>,
) -> Result<Option<AiProviderConfig>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM ai_provider_config WHERE is_active = 1")
        .map_err(|e| e.to_string())?;

    match stmt.query_row([], |row| AiProviderConfig::from_row(row)) {
        Ok(config) => Ok(Some(config.masked())),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn ai_config_create(
    input: AiConfigCreateInput,
    state: State<'_, AppState>,
) -> Result<AiProviderConfig, String> {
    // Validate protocol type
    if input.provider != "openai_compatible" && input.provider != "anthropic_compatible" {
        return Err("provider must be 'openai_compatible' or 'anthropic_compatible'".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let is_active = input.is_active.unwrap_or(false) as i32;

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if is_active != 0 {
        conn.execute("UPDATE ai_provider_config SET is_active = 0", [])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO ai_provider_config (id, name, provider, api_key, base_url, model, multimodal_model, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![id, input.name, input.provider, input.api_key, input.base_url, input.model, input.multimodal_model, is_active, now],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM ai_provider_config WHERE id = ?").map_err(|e| e.to_string())?;
    let config = stmt.query_row(rusqlite::params![id], |row| AiProviderConfig::from_row(row)).map_err(|e| e.to_string())?;
    Ok(config.masked())
}

#[tauri::command]
pub fn ai_config_update(
    id: String,
    input: AiConfigUpdateInput,
    state: State<'_, AppState>,
) -> Result<AiProviderConfig, String> {
    // Validate protocol type if being updated
    if let Some(ref provider) = input.provider {
        if provider != "openai_compatible" && provider != "anthropic_compatible" {
            return Err("provider must be 'openai_compatible' or 'anthropic_compatible'".into());
        }
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(is_active) = input.is_active {
        if is_active {
            conn.execute("UPDATE ai_provider_config SET is_active = 0", [])
                .map_err(|e| e.to_string())?;
        }
    }

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    macro_rules! add_field {
        ($sets:expr, $params:expr, $col:expr, $val:expr) => {
            if let Some(v) = $val {
                $sets.push(format!("{} = ?", $col));
                $params.push(Box::new(v));
            }
        };
    }

    add_field!(sets, param_values, "name", input.name);
    add_field!(sets, param_values, "provider", input.provider);
    // If api_key looks masked (contains ••••), don't overwrite the real key
    if let Some(ref key) = input.api_key {
        if !key.contains('\u{2022}') {
            sets.push("api_key = ?".to_string());
            param_values.push(Box::new(key.clone()));
        }
    }
    add_field!(sets, param_values, "base_url", input.base_url);
    add_field!(sets, param_values, "model", input.model);
    add_field!(sets, param_values, "multimodal_model", input.multimodal_model);

    if let Some(is_active) = input.is_active {
        sets.push("is_active = ?".to_string());
        param_values.push(Box::new(is_active as i32));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM ai_provider_config WHERE id = ?").map_err(|e| e.to_string())?;
        let config = stmt.query_row(rusqlite::params![id], |row| AiProviderConfig::from_row(row)).map_err(|e| e.to_string())?;
        return Ok(config.masked());
    }

    param_values.push(Box::new(id.clone()));
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let sql = format!(
        "UPDATE ai_provider_config SET {} WHERE id = ?",
        sets.join(", ")
    );
    conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM ai_provider_config WHERE id = ?").map_err(|e| e.to_string())?;
    let config = stmt.query_row(rusqlite::params![id], |row| AiProviderConfig::from_row(row)).map_err(|e| e.to_string())?;
    Ok(config.masked())
}

#[tauri::command]
pub fn ai_config_activate(
    id: String,
    state: State<'_, AppState>,
) -> Result<AiProviderConfig, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute("UPDATE ai_provider_config SET is_active = 0 WHERE is_active = 1", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE ai_provider_config SET is_active = 1 WHERE id = ?",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM ai_provider_config WHERE id = ?").map_err(|e| e.to_string())?;
    let config = stmt.query_row(rusqlite::params![id], |row| AiProviderConfig::from_row(row)).map_err(|e| e.to_string())?;
    Ok(config.masked())
}

#[tauri::command]
pub fn ai_config_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM ai_provider_config WHERE id = ?",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn ai_config_test(
    id: String,
    state: State<'_, AppState>,
) -> Result<TestConnectionResult, String> {
    // Fetch config in sync block, then drop lock before await
    let config = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT * FROM ai_provider_config WHERE id = ?")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![id], |row| AiProviderConfig::from_row(row))
            .map_err(|_| "Config not found".to_string())?
    }; // conn dropped

    let result = ai::test_connection(&config).await;
    Ok(result)
}
