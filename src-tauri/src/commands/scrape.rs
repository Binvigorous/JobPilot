use crate::ai;
use crate::models::*;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn scrape_url(url: String) -> Result<ScrapeResult, String> {
    crate::scraper::scrape_url(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scrape_image(
    file_base64: String,
    filename: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Fetch config in sync block, then drop lock before await
    let config = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        ai::fetch_active_config(&conn).map_err(|e| e.to_string())?
    }; // conn dropped

    let text = ai::parse_image_jd(&file_base64, &filename, &config)
        .await
        .map_err(|e| e.to_string())?;

    if text.len() < 20 {
        return Err("Could not extract JD content from image. Please try a clearer screenshot.".into());
    }

    Ok(text)
}
