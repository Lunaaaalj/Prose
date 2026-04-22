use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

static LOG_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
fn log_conversion(app: tauri::AppHandle, line: String) -> Result<(), String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("conversion.log");
    let _guard = LOG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", line).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_markdown_files(dir: String) -> Result<Vec<FileEntry>, String> {
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut files: Vec<FileEntry> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let is_markdown = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                let lower = ext.to_ascii_lowercase();
                lower == "md" || lower == "markdown"
            })
            .unwrap_or(false);
        if !is_markdown {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let path_str = match path.to_str() {
            Some(p) => p.to_string(),
            None => continue,
        };
        files.push(FileEntry {
            name,
            path: path_str,
        });
    }
    files.sort_by(|a, b| a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()));
    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            log_conversion,
            read_file,
            write_file,
            list_markdown_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
