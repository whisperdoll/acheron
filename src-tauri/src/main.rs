// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{self, BufRead};
use std::process::{Command, Stdio};

fn run_script(
    script: &str,
    args: &[&str],
    on_line: Option<impl Fn(String) + 'static>,
) -> Result<String, io::Error> {
    let mut lines: Vec<String> = Vec::new();

    println!("running script {} with args {:#?}", script, args);

    let stdout = Command::new("ruby")
        .arg(format!("./lib/scripts/{}.rb", script))
        .args(args)
        .stdout(Stdio::piped())
        .spawn()?
        .stdout
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::Other, "Could not capture standard output.")
        })?;

    let reader = io::BufReader::new(stdout);

    reader
        .lines()
        .filter_map(|line| line.ok())
        .for_each(|string| {
            lines.push(string.clone());
            if let Some(callback) = on_line.as_ref() {
                callback(string);
            }
        });

    Ok(lines.join("\n"))
}

#[tauri::command]
async fn example_script(example_arg: String) -> Result<String, String> {
    match run_script("example_script", &[&example_arg], None::<fn(String)>) {
        Ok(output) => Ok(output),
        Err(e) => Err(format!("Failed to run Ruby script: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![example_script])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
