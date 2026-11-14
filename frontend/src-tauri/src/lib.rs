use serde::Serialize;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
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

// 判断Cookie域名是否属于Apple
fn is_apple_cookie_domain(domain: &str) -> bool {
    let host = domain.trim().trim_start_matches('.').to_ascii_lowercase();
    host == "apple.com" || host.ends_with(".apple.com")
}

// 将单个Cookie转换为Netscape文本行
fn to_netscape_cookie_line(cookie: &tauri::webview::Cookie<'_>) -> Option<String> {
    let name = cookie.name().trim();
    let value = cookie.value().trim();
    if name.is_empty() || value.is_empty() {
        return None;
    }

    let mut domain = cookie
        .domain()
        .unwrap_or("music.apple.com")
        .trim()
        .to_string();
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

// 探测登录窗口中的Apple Cookies并返回Netscape文本
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
        let mut lines: Vec<String> = COOKIE_HEADER_LINES
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        let mut count = 0usize;

        for cookie in cookies {
            let domain = cookie.domain().unwrap_or("");
            if !is_apple_cookie_domain(domain) {
                continue;
            }

            if cookie.name().eq_ignore_ascii_case("media-user-token") {
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

// 启动后端sidecar并将输出写入用户日志
fn start_backend(app: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let backend_dir = resource_dir.join("backend");
    let backend_exe = backend_dir.join("run_backend.exe");
    if !backend_exe.is_file() {
        return Err(format!("backend executable not found: {}", backend_exe.display()));
    }

    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("backend.log"))
        .map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;

    Command::new(&backend_exe)
        .current_dir(&backend_dir)
        .env("LINGOMUSIC_DATA_DIR", &data_dir)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn()
        .map_err(|e| format!("failed to start backend: {e}"))
}

// 启动Tauri应用并注册Cookies探测命令
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let backend_setup = backend.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            match start_backend(app.handle()) {
                Ok(child) => {
                    *backend_setup.lock().unwrap() = Some(child);
                }
                Err(error) => {
                    eprintln!("{error}");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![probe_apple_music_login_cookies])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = backend.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
