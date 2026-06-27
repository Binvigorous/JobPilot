use crate::ai;
use crate::error::AppError;
use crate::models::*;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn jobs_list(
    params: JobsListParams,
    state: State<'_, AppState>,
) -> Result<Vec<Job>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from("SELECT * FROM job WHERE 1=1");
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref status) = params.status {
        if status != "all" {
            sql.push_str(" AND application_status = ?");
            param_values.push(Box::new(status.clone()));
        }
    }

    if let Some(ref preference) = params.preference {
        if preference != "all" {
            sql.push_str(" AND preference_level = ?");
            param_values.push(Box::new(preference.clone()));
        }
    }

    if let Some(ref search) = params.search {
        if !search.is_empty() {
            sql.push_str(" AND (title LIKE ? OR company LIKE ?)");
            let pattern = format!("%{}%", search);
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }
    }

    if let Some(ref city) = params.city {
        if city != "all" && !city.is_empty() {
            sql.push_str(" AND location LIKE ?");
            param_values.push(Box::new(format!("%{}%", city)));
        }
    }

    let sort = params.sort.as_deref().unwrap_or("createdAt");
    match sort {
        "interviewDate" => sql.push_str(" ORDER BY interview_date ASC"),
        "preference" => sql.push_str(" ORDER BY CASE preference_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END"),
        _ => sql.push_str(" ORDER BY created_at DESC"),
    }

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let jobs = stmt
        .query_map(params_refs.as_slice(), |row| Job::from_row(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(jobs)
}

#[tauri::command]
pub fn job_get(id: String, state: State<'_, AppState>) -> Result<Job, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM job WHERE id = ?")
        .map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| Job::from_row(row))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound("Job not found".into()).into(),
            other => other.to_string(),
        })
}

#[tauri::command]
pub async fn job_create(
    input: JobCreateInput,
    state: State<'_, AppState>,
) -> Result<Job, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let skip_parsing = input.skip_parsing.unwrap_or(false);

    let mut title = input.title.clone().unwrap_or_default();
    let mut company = input.company.clone().unwrap_or_default();
    let mut company_address = input.company_address.clone();
    let mut salary = input.salary.clone();
    let mut location = input.location.clone();
    let mut experience = input.experience.clone();
    let mut education = input.education.clone();
    let company_size = input.company_size.clone();

    let mut jd_parsed_content: Option<String> = None;
    let mut keywords: Option<String> = None;
    let mut ai_interview_guide = String::new();
    let mut role_analysis: Option<String> = None;
    let mut interview_insights: Option<String> = None;
    let mut preparation_guide: Option<String> = None;

    // AI parsing — fetch config in sync block, then await AI call outside the lock
    if !skip_parsing {
        let config = {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            ai::fetch_active_config(&conn).ok()
        }; // conn dropped here

        if let Some(config) = config {
            match ai::parse_jd(&input.jd_raw_content, &config).await {
                Ok(result) => {
                    let ef = &result.extracted_fields;

                    if title.is_empty() {
                        title = ef.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    }
                    if company.is_empty() {
                        company = ef.get("company").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    }
                    if salary.is_none() || salary.as_deref().unwrap_or("").is_empty() {
                        salary = ef.get("salary").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                    if location.is_none() || location.as_deref().unwrap_or("").is_empty() {
                        location = ef.get("location").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                    if experience.is_none() || experience.as_deref().unwrap_or("").is_empty() {
                        experience = ef.get("experience").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                    if education.is_none() || education.as_deref().unwrap_or("").is_empty() {
                        education = ef.get("education").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }

                    if let Some(addr) = ef.get("companyAddress").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                        company_address = Some(addr.to_string());
                    }

                    jd_parsed_content = Some(serde_json::to_string(&result.parsed_content).unwrap_or_default());
                    keywords = Some(serde_json::to_string(&result.keywords).unwrap_or_default());
                    role_analysis = Some(serde_json::to_string(&result.role_analysis).unwrap_or_default());
                    interview_insights = Some(serde_json::to_string(&result.interview_insights).unwrap_or_default());
                    preparation_guide = Some(serde_json::to_string(&result.preparation_guide).unwrap_or_default());
                }
                Err(e) => {
                    log::warn!("AI parsing failed during job create: {}", e);
                    ai_interview_guide = format!("⚠️ AI 解析失败：{}\n\n请检查 AI 配置是否正确，或尝试重新解析。", e);
                }
            }
        } else {
            ai_interview_guide = "⚠️ 未配置 AI 服务，无法自动解析。\n\n请前往「AI 设置」添加并启用 AI 配置。".to_string();
        }
    }

    if title.is_empty() {
        title = "未命名岗位".to_string();
    }
    if company.is_empty() {
        company = "未知公司".to_string();
    }

    let application_status = input.status.clone().unwrap_or_else(|| "not_applied".to_string());

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO job (id, title, company, salary, location, experience, education, company_size, company_address, source_url, source_text, jd_raw_content, jd_parsed_content, keywords, preference_level, application_status, recruitment_status, interview_date, interview_feedback, interview_questions, notes, ai_interview_guide, role_analysis, interview_insights, preparation_guide, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id, title, company, salary, location, experience, education, company_size,
            company_address,
            input.source_url, input.source_text, input.jd_raw_content,
            jd_parsed_content, keywords, "none", application_status, "active",
            None::<String>, None::<String>, None::<String>, None::<String>, ai_interview_guide,
            role_analysis, interview_insights, preparation_guide, now, now
        ],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| Job::from_row(row)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn job_update(
    id: String,
    input: JobUpdateInput,
    state: State<'_, AppState>,
) -> Result<Job, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let mut sets: Vec<String> = vec!["updated_at = ?".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    macro_rules! add_field {
        ($sets:expr, $params:expr, $col:expr, $val:expr) => {
            if let Some(v) = $val {
                $sets.push(format!("{} = ?", $col));
                $params.push(Box::new(v));
            }
        };
    }

    add_field!(sets, param_values, "title", input.title);
    add_field!(sets, param_values, "company", input.company);
    add_field!(sets, param_values, "salary", input.salary);
    add_field!(sets, param_values, "location", input.location);
    add_field!(sets, param_values, "experience", input.experience);
    add_field!(sets, param_values, "education", input.education);
    add_field!(sets, param_values, "company_size", input.company_size);
    add_field!(sets, param_values, "company_address", input.company_address);
    add_field!(sets, param_values, "source_url", input.source_url);
    add_field!(sets, param_values, "source_text", input.source_text);
    add_field!(sets, param_values, "jd_raw_content", input.jd_raw_content);
    add_field!(sets, param_values, "preference_level", input.preference_level);
    add_field!(sets, param_values, "application_status", input.application_status);
    add_field!(sets, param_values, "recruitment_status", input.recruitment_status);
    add_field!(sets, param_values, "interview_date", input.interview_date);
    add_field!(sets, param_values, "interview_feedback", input.interview_feedback);
    add_field!(sets, param_values, "notes", input.notes);
    add_field!(sets, param_values, "ai_interview_guide", input.ai_interview_guide);

    // JSON fields
    let json_fields: Vec<(&str, Option<serde_json::Value>)> = vec![
        ("jd_parsed_content", input.jd_parsed_content),
        ("keywords", input.keywords),
        ("interview_questions", input.interview_questions),
        ("interview_rounds", input.interview_rounds),
        ("role_analysis", input.role_analysis),
        ("interview_insights", input.interview_insights),
        ("preparation_guide", input.preparation_guide),
        ("jd_images", input.jd_images),
    ];
    for (col, val) in json_fields {
        if let Some(v) = val {
            let s = if v.is_string() {
                v.as_str().unwrap_or_default().to_string()
            } else {
                serde_json::to_string(&v).unwrap_or_default()
            };
            sets.push(format!("{} = ?", col));
            param_values.push(Box::new(s));
        }
    }

    param_values.push(Box::new(id.clone()));
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let sql = format!("UPDATE job SET {} WHERE id = ?", sets.join(", "));
    conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| Job::from_row(row)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn job_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM job WHERE id = ?", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn job_reparse(id: String, state: State<'_, AppState>) -> Result<Job, String> {
    // Fetch job + config in sync block
    let (job, config) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
        let job = stmt.query_row(rusqlite::params![id], |row| Job::from_row(row))
            .map_err(|_| "Job not found".to_string())?;
        let config = ai::fetch_active_config(&conn).map_err(|e| e.to_string())?;
        (job, config)
    }; // conn dropped

    let result = ai::parse_jd(&job.jd_raw_content, &config).await.map_err(|e| {
        format!("AI 解析失败：{}。请检查 AI 配置是否正确。", e)
    })?;
    let ef = &result.extracted_fields;

    let title = ef.get("title").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or(&job.title).to_string();
    let company = ef.get("company").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or(&job.company).to_string();
    let salary = ef.get("salary").and_then(|v| v.as_str()).map(|s| s.to_string()).or(job.salary.clone());
    let location = ef.get("location").and_then(|v| v.as_str()).map(|s| s.to_string()).or(job.location.clone());
    let experience = ef.get("experience").and_then(|v| v.as_str()).map(|s| s.to_string()).or(job.experience.clone());
    let education = ef.get("education").and_then(|v| v.as_str()).map(|s| s.to_string()).or(job.education.clone());
    let company_size = ef.get("companySize").and_then(|v| v.as_str()).map(|s| s.to_string()).or(job.company_size.clone());
    let company_address = ef.get("companyAddress").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string())
        .or(job.company_address);

    let jd_parsed_content = serde_json::to_string(&result.parsed_content).unwrap_or_default();
    let keywords = serde_json::to_string(&result.keywords).unwrap_or_default();
    let role_analysis = serde_json::to_string(&result.role_analysis).unwrap_or_default();
    let interview_insights = serde_json::to_string(&result.interview_insights).unwrap_or_default();
    let preparation_guide = serde_json::to_string(&result.preparation_guide).unwrap_or_default();
    let now = chrono::Utc::now().to_rfc3339();

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE job SET title=?, company=?, salary=?, location=?, experience=?, education=?, company_size=?, company_address=?, jd_parsed_content=?, keywords=?, ai_interview_guide='', role_analysis=?, interview_insights=?, preparation_guide=?, updated_at=? WHERE id=?",
        rusqlite::params![title, company, salary, location, experience, education, company_size, company_address, jd_parsed_content, keywords, role_analysis, interview_insights, preparation_guide, now, id],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| Job::from_row(row)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn job_generate_interview_questions(
    id: String,
    state: State<'_, AppState>,
) -> Result<Job, String> {
    let (job, config) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
        let job = stmt.query_row(rusqlite::params![id], |row| Job::from_row(row))
            .map_err(|_| "Job not found".to_string())?;
        let config = ai::fetch_active_config(&conn).map_err(|e| e.to_string())?;
        (job, config)
    }; // conn dropped

    let questions = ai::generate_interview_questions(&job.jd_raw_content, &config)
        .await
        .map_err(|e| e.to_string())?;

    let questions_json = serde_json::to_string(&questions).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE job SET interview_questions = ?, updated_at = ? WHERE id = ?",
        rusqlite::params![questions_json, now, id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM job WHERE id = ?").map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| Job::from_row(row)).map_err(|e| e.to_string())
}
