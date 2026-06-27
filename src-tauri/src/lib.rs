mod ai;
mod commands;
mod db;
mod error;
mod models;
mod scraper;
mod state;

use state::AppState;
use tauri::Manager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = app_data_dir.join("jobpilot.db");
            let conn =
                rusqlite::Connection::open(&db_path).expect("Failed to open database");
            db::init(&conn).expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::jobs::jobs_list,
            commands::jobs::job_get,
            commands::jobs::job_create,
            commands::jobs::job_update,
            commands::jobs::job_delete,
            commands::jobs::job_reparse,
            commands::jobs::job_generate_interview_questions,
            commands::ai_config::ai_config_list,
            commands::ai_config::ai_config_get_active,
            commands::ai_config::ai_config_create,
            commands::ai_config::ai_config_update,
            commands::ai_config::ai_config_activate,
            commands::ai_config::ai_config_delete,
            commands::ai_config::ai_config_test,
            commands::scrape::scrape_url,
            commands::scrape::scrape_image,
            commands::mineru::mineru_parse,
            commands::mineru::mineru_get_settings,
            commands::mineru::mineru_save_settings,
            commands::mineru::mineru_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
