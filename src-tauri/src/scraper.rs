use crate::error::AppError;
use crate::models::ScrapeResult;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use scraper::{Html, Selector};
use std::time::Duration;

struct ScraperStrategy {
    selectors: Vec<(&'static str, &'static str)>, // (field, css_selector)
    #[allow(dead_code)]
    fallback: &'static str,
}

fn get_strategies() -> Vec<(&'static str, ScraperStrategy)> {
    vec![
        (
            "zhipin.com",
            ScraperStrategy {
                selectors: vec![
                    ("description", ".job-detail-section, .job-sec, .detail-content, .job-detail-box, .job-info"),
                    ("title", ".job-title h3, .info-primary h1"),
                    ("company", ".company-name, .info-primary a"),
                    ("salary", ".salary, .info-primary .salary"),
                    ("location", ".location-name, .info-primary .location"),
                ],
                fallback: "body",
            },
        ),
        (
            "zhilian.com",
            ScraperStrategy {
                selectors: vec![
                    ("description", ".job-detail, .job-description, .detail-content"),
                    ("title", ".job-title, .base-info h1"),
                    ("company", ".company-name, .company-content h2"),
                ],
                fallback: "body",
            },
        ),
        (
            "51job.com",
            ScraperStrategy {
                selectors: vec![
                    ("description", "#jobDetail, .job-detail, .detail-content"),
                    ("title", ".title, .job-title, h1.title"),
                    ("company", ".company, .company-name"),
                ],
                fallback: "body",
            },
        ),
        (
            "lagou.com",
            ScraperStrategy {
                selectors: vec![
                    ("description", ".job-detail, .job-description"),
                    ("title", ".job-name, .position-title"),
                    ("company", ".company-name, .company"),
                ],
                fallback: "body",
            },
        ),
        (
            "liepin.com",
            ScraperStrategy {
                selectors: vec![
                    ("description", ".job-description, .detail-content"),
                    ("title", ".job-title, .title"),
                    ("company", ".company-name"),
                ],
                fallback: "body",
            },
        ),
    ]
}

fn detect_strategy(url: &str) -> &'static str {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            let host = host.to_lowercase();
            for (key, _) in get_strategies() {
                if host.contains(key) {
                    return key;
                }
            }
        }
    }
    "default"
}

fn extract_content(document: &Html, strategy_key: &str) -> Option<String> {
    let strategies = get_strategies();
    let strategy = strategies
        .iter()
        .find(|(k, _)| *k == strategy_key)
        .map(|(_, s)| s);

    // Try strategy-specific selectors
    if let Some(s) = strategy {
        for (field, selector_str) in &s.selectors {
            if *field == "description" || *field == "title" || *field == "company" {
                if let Ok(sel) = Selector::parse(selector_str) {
                    for el in document.select(&sel) {
                        let text = el.text().collect::<Vec<_>>().join("").trim().to_string();
                        if text.len() > 30 {
                            return Some(text);
                        }
                    }
                }
            }
        }
    }

    // Fallback: try common content selectors
    let fallback_selectors = [
        "article",
        "main",
        "[role='main']",
        ".content",
        ".main-content",
        ".job-content",
        "#content",
        "#main",
    ];

    for sel_str in &fallback_selectors {
        if let Ok(sel) = Selector::parse(sel_str) {
            for el in document.select(&sel) {
                let text = el.text().collect::<Vec<_>>().join("").trim().to_string();
                if text.len() > 100 {
                    return Some(text);
                }
            }
        }
    }

    // Last resort: body text
    if let Ok(sel) = Selector::parse("body") {
        if let Some(body) = document.select(&sel).next() {
            let text = body.text().collect::<Vec<_>>().join(" ");
            let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
            if !cleaned.is_empty() {
                return Some(cleaned);
            }
        }
    }

    None
}

pub async fn scrape_url(url: &str) -> Result<ScrapeResult, AppError> {
    let strategy_key = detect_strategy(url);

    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    );
    headers.insert(
        ACCEPT_LANGUAGE,
        HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"),
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .default_headers(headers)
        .build()
        .map_err(|e| AppError::Scraping(e.to_string()))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AppError::Scraping("Request timed out. Please try again or paste the text manually.".into())
            } else {
                AppError::Scraping(format!("Scraping failed: {}", e))
            }
        })?;

    if !resp.status().is_success() {
        return Err(AppError::Scraping(format!(
            "Failed to fetch page: {}",
            resp.status()
        )));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| AppError::Scraping(e.to_string()))?;

    let document = Html::parse_document(&html);

    let content = extract_content(&document, strategy_key).unwrap_or_default();

    // Clean up content
    let content = content
        .lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    if content.len() < 50 {
        return Err(AppError::Scraping(
            "Could not extract JD content from the page. Please paste the text manually.".into(),
        ));
    }

    let source = if strategy_key == "default" {
        None
    } else {
        Some(strategy_key.to_string())
    };

    Ok(ScrapeResult { content, source })
}
