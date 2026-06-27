use serde::{Deserialize, Serialize};

// ─── Job ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub title: String,
    pub company: String,
    pub salary: Option<String>,
    pub location: Option<String>,
    pub experience: Option<String>,
    pub education: Option<String>,
    pub company_size: Option<String>,
    pub company_address: Option<String>,
    pub source_url: Option<String>,
    pub source_text: Option<String>,
    pub jd_raw_content: String,
    pub jd_parsed_content: Option<String>,
    pub keywords: Option<String>,
    pub preference_level: String,
    pub application_status: String,
    pub recruitment_status: String,
    pub interview_date: Option<String>,
    pub interview_feedback: Option<String>,
    pub interview_questions: Option<String>,
    pub interview_rounds: Option<String>,
    pub notes: Option<String>,
    pub ai_interview_guide: String,
    pub role_analysis: Option<String>,
    pub interview_insights: Option<String>,
    pub preparation_guide: Option<String>,
    pub jd_images: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobCreateInput {
    pub jd_raw_content: String,
    #[serde(default)]
    pub skip_parsing: Option<bool>,
    pub title: Option<String>,
    pub company: Option<String>,
    pub salary: Option<String>,
    pub location: Option<String>,
    pub experience: Option<String>,
    pub education: Option<String>,
    pub company_size: Option<String>,
    pub company_address: Option<String>,
    pub source_url: Option<String>,
    pub source_text: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobUpdateInput {
    pub title: Option<String>,
    pub company: Option<String>,
    pub salary: Option<String>,
    pub location: Option<String>,
    pub experience: Option<String>,
    pub education: Option<String>,
    pub company_size: Option<String>,
    pub company_address: Option<String>,
    pub source_url: Option<String>,
    pub source_text: Option<String>,
    pub jd_raw_content: Option<String>,
    pub jd_parsed_content: Option<serde_json::Value>,
    pub keywords: Option<serde_json::Value>,
    pub preference_level: Option<String>,
    pub application_status: Option<String>,
    pub recruitment_status: Option<String>,
    pub interview_date: Option<String>,
    pub interview_feedback: Option<String>,
    pub interview_questions: Option<serde_json::Value>,
    pub interview_rounds: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub ai_interview_guide: Option<String>,
    pub role_analysis: Option<serde_json::Value>,
    pub interview_insights: Option<serde_json::Value>,
    pub preparation_guide: Option<serde_json::Value>,
    pub jd_images: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobsListParams {
    pub status: Option<String>,
    pub preference: Option<String>,
    pub search: Option<String>,
    pub sort: Option<String>,
    pub city: Option<String>,
}

// ─── AI Provider Config ───

/// AI provider configuration stored in SQLite.
/// `provider` field now stores the protocol type:
/// - `openai_compatible` — OpenAI-compatible API (/chat/completions, Bearer auth)
/// - `anthropic_compatible` — Anthropic-compatible API (/messages, x-api-key auth)
/// Any model that supports one of these protocols can be used by setting
/// the appropriate `base_url` and `model`.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub multimodal_model: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigCreateInput {
    pub name: String,
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub multimodal_model: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigUpdateInput {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub multimodal_model: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
}

// ─── Scrape ───

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapeResult {
    pub content: String,
    pub source: Option<String>,
}

// ─── AI Parse Result (internal) ───

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiParseResult {
    pub extracted_fields: serde_json::Value,
    pub parsed_content: serde_json::Value,
    pub keywords: serde_json::Value,
    pub role_analysis: serde_json::Value,
    pub interview_insights: serde_json::Value,
    pub preparation_guide: serde_json::Value,
}

// ─── AI call request types ───

// ─── Masking helper ───

pub fn mask_api_key(key: &str) -> String {
    if key.len() > 8 {
        format!("{}...••••", &key[..8])
    } else {
        "•••••••••".to_string()
    }
}

// ─── Row mapping helpers ───

impl Job {
    pub fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        Ok(Job {
            id: row.get("id")?,
            title: row.get("title")?,
            company: row.get("company")?,
            salary: row.get("salary")?,
            location: row.get("location")?,
            experience: row.get("experience")?,
            education: row.get("education")?,
            company_size: row.get("company_size")?,
            company_address: row.get("company_address")?,
            source_url: row.get("source_url")?,
            source_text: row.get("source_text")?,
            jd_raw_content: row.get("jd_raw_content")?,
            jd_parsed_content: row.get("jd_parsed_content")?,
            keywords: row.get("keywords")?,
            preference_level: row.get("preference_level")?,
            application_status: row.get("application_status")?,
            recruitment_status: row.get("recruitment_status")?,
            interview_date: row.get("interview_date")?,
            interview_feedback: row.get("interview_feedback")?,
            interview_questions: row.get("interview_questions")?,
            interview_rounds: row.get("interview_rounds")?,
            notes: row.get("notes")?,
            ai_interview_guide: row.get("ai_interview_guide")?,
            role_analysis: row.get("role_analysis")?,
            interview_insights: row.get("interview_insights")?,
            preparation_guide: row.get("preparation_guide")?,
            jd_images: row.get("jd_images")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl AiProviderConfig {
    pub fn from_row(row: &rusqlite::Row) -> Result<Self, rusqlite::Error> {
        let is_active: i32 = row.get("is_active")?;
        Ok(AiProviderConfig {
            id: row.get("id")?,
            name: row.get("name")?,
            provider: row.get("provider")?,
            api_key: row.get("api_key")?,
            base_url: row.get("base_url")?,
            model: row.get("model")?,
            multimodal_model: row.get("multimodal_model")?,
            is_active: is_active != 0,
            created_at: row.get("created_at")?,
        })
    }

    pub fn masked(&self) -> Self {
        let mut c = self.clone();
        c.api_key = mask_api_key(&c.api_key);
        c
    }
}
