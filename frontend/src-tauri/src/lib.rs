use serde::Serialize;
use tauri::Manager;

const COOKIE_HEADER_LINES: [&str; 4] = [
  "# Netscape HTTP Cookie File",
  "# https://curl.haxx.se/rfc/cookie_spec.html",
  "# This is a generated file! Do not edit.",
  "",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CookieProbeResponse {
  success: bool,
  message: String,
  cookies_count: usize,
  has_media_user_token: bool,
  login_detected: bool,
  cookies_content: String,
}

fn is_apple_cookie_domain(domain: &str) -> bool {
  let host = domain.trim().to_ascii_lowercase();
  host.contains("apple.com") || host.contains("music.apple.com")
}

fn to_netscape_cookie_line(cookie: &tauri::webview::Cookie<'_>) -> Option<String> {
  let name = cookie.name().trim();
  let value = cookie.value().trim();
  if name.is_empty() || value.is_empty() {
    return None;
  }

  let mut domain = cookie.domain().unwrap_or("music.apple.com").trim().to_string();
  if domain.is_empty() {
    domain = "music.apple.com".to_string();
  }
  if !domain.starts_with('.') {
    domain = format!(".{}", domain);
  }

  let path = cookie.path().unwrap_or("/").trim();
  let path = if path.is_empty() { "/" } else { path };
  let secure = if cookie.secure().unwrap_or(false) {
    "TRUE"
  } else {
    "FALSE"
  };
  let expiry = cookie
    .expires_datetime()
    .map(|dt| dt.unix_timestamp().max(0))
    .unwrap_or(0);

  Some(format!(
    "{domain}\tTRUE\t{path}\t{secure}\t{expiry}\t{name}\t{value}"
  ))
}

#[tauri::command]
async fn probe_apple_music_login_cookies(
  app: tauri::AppHandle,
  window_label: String,
) -> Result<CookieProbeResponse, String> {
  let label = window_label.trim().to_string();
  if label.is_empty() {
    return Err("window_label is empty".to_string());
  }

  let response = tauri::async_runtime::spawn_blocking(move || {
    let window = app
      .get_webview_window(&label)
      .ok_or_else(|| format!("登录窗口不存在: {}", label))?;

    let cookies = window
      .cookies()
      .map_err(|e| format!("读取登录窗口 Cookies 失败: {e}"))?;

    let mut has_media_user_token = false;
    let mut lines: Vec<String> = COOKIE_HEADER_LINES.iter().map(|s| (*s).to_string()).collect();
    let mut count = 0usize;

    for cookie in cookies {
      let domain = cookie.domain().unwrap_or("");
      if !is_apple_cookie_domain(domain) {
        continue;
      }

      if cookie.name().eq_ignore_ascii_case("media-user-token")
        && domain.to_ascii_lowercase().contains("music.apple.com")
      {
        has_media_user_token = true;
      }

      if let Some(line) = to_netscape_cookie_line(&cookie) {
        lines.push(line);
        count += 1;
      }
    }

    lines.push(String::new());
    let content = lines.join("\n");
    let success = count > 0;
    let message = if has_media_user_token {
      "已检测到 Apple 登录态 Cookie".to_string()
    } else if success {
      "已读取 Cookies，但尚未检测到完整登录态".to_string()
    } else {
      "未从登录窗口读取到 Apple Cookies".to_string()
    };

    Ok::<CookieProbeResponse, String>(CookieProbeResponse {
      success,
      message,
      cookies_count: count,
      has_media_user_token,
      login_detected: has_media_user_token,
      cookies_content: content,
    })
  })
  .await
  .map_err(|e| format!("后台 Cookie 检测线程异常: {e}"))??;

  Ok(response)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![probe_apple_music_login_cookies])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
