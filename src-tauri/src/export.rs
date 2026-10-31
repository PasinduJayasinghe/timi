//! Export to Excel (Phase 11; the hours template since Phase 12): the Save As dialog and the
//! workbook, written here so the web view needs no file or dialog permissions.

use rust_xlsxwriter::{ExcelDateTime, Format, Workbook, Worksheet, XlsxError};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// One row of the hours sheet: a timer session, in the timesheet template's columns.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimesheetRow {
    /// The work day, "YYYY-MM-DD".
    date: String,
    /// Local times, "YYYY-MM-DDThh:mm:ss".
    start: String,
    finish: String,
    kind_of_work: String,
    clients: String,
    project: String,
    worked_on: String,
    note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    file_name: String,
    rows: Vec<TimesheetRow>,
}

/// The template's columns, left to right.
const COLUMNS: [&str; 8] = [
    "Date",
    "Start",
    "Finish",
    "Kind of work",
    "Clients",
    "Project",
    "What you worked on",
    "Note",
];

/// The template's font size (Calibri 12).
const FONT_SIZE: f64 = 12.0;

/// Workbooks saved by `export_xlsx` in this run. `open_export` opens only these, so the web view
/// can't use it to open (and run) any other file.
#[derive(Default)]
pub struct Exports(Mutex<Vec<PathBuf>>);

struct Formats {
    text: Format,
    date: Format,
    time: Format,
}

fn formats() -> Formats {
    Formats {
        text: Format::new().set_font_size(FONT_SIZE),
        date: Format::new().set_font_size(FONT_SIZE).set_num_format("yyyy-mm-dd"),
        // 24-hour, as in the template: 09:00, 17:00
        time: Format::new().set_font_size(FONT_SIZE).set_num_format("hh:mm"),
    }
}

/// A date or time cell; text that isn't one is written as it is.
fn write_when(sheet: &mut Worksheet, row: u32, col: u16, value: &str, format: &Format) -> Result<(), XlsxError> {
    match ExcelDateTime::parse_from_str(value) {
        Ok(when) => sheet.write_datetime_with_format(row, col, &when, format).map(|_| ()),
        Err(_) => sheet.write_string_with_format(row, col, value, format).map(|_| ()),
    }
}

/// The hours sheet: the template's header row, then one row per session.
fn hours_sheet(sheet: &mut Worksheet, rows: &[TimesheetRow], formats: &Formats) -> Result<(), XlsxError> {
    sheet.set_name("Hours")?;
    for (col, name) in COLUMNS.iter().enumerate() {
        sheet.write_string_with_format(0, col as u16, *name, &formats.text)?;
    }
    sheet.set_freeze_panes(1, 0)?;
    for (index, entry) in rows.iter().enumerate() {
        let row = index as u32 + 1;
        write_when(sheet, row, 0, &entry.date, &formats.date)?;
        write_when(sheet, row, 1, &entry.start, &formats.time)?;
        write_when(sheet, row, 2, &entry.finish, &formats.time)?;
        let texts = [
            &entry.kind_of_work,
            &entry.clients,
            &entry.project,
            &entry.worked_on,
            &entry.note,
        ];
        for (offset, text) in texts.into_iter().enumerate() {
            sheet.write_string_with_format(row, 3 + offset as u16, text, &formats.text)?;
        }
    }
    sheet.autofit();
    Ok(())
}

fn build_workbook(request: &ExportRequest) -> Result<Workbook, XlsxError> {
    let mut workbook = Workbook::new();
    hours_sheet(workbook.add_worksheet(), &request.rows, &formats())?;
    Ok(workbook)
}

/// Asks where to save (the Windows Save As dialog, starting in Downloads) and writes the
/// workbook there. Returns the saved path, or None if the dialog was cancelled.
#[tauri::command]
pub async fn export_xlsx(
    app: AppHandle,
    exports: tauri::State<'_, Exports>,
    request: ExportRequest,
) -> Result<Option<String>, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Export to Excel")
        .set_file_name(&request.file_name)
        .add_filter("Excel workbook", &["xlsx"]);
    if let Ok(downloads) = app.path().download_dir() {
        dialog = dialog.set_directory(downloads);
    }
    dialog.save_file(move |path| {
        let _ = sender.send(path);
    });
    let Some(path) = receiver.await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let mut path = path.into_path().map_err(|e| e.to_string())?;
    // Always a workbook, whatever name was typed
    if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("xlsx")) {
        path.set_extension("xlsx");
    }

    let mut workbook = build_workbook(&request).map_err(|e| e.to_string())?;
    // Fails if the file is open in Excel; the toast says so (9c)
    workbook
        .save(&path)
        .map_err(|e| format!("save-failed: {e}"))?;
    let saved = path.to_string_lossy().into_owned();
    if let Ok(mut list) = exports.0.lock() {
        list.push(path);
    }
    Ok(Some(saved))
}

/// Opens an exported workbook in its default app (the toast's "Open file"). Only a workbook
/// saved by `export_xlsx` in this run can be opened.
#[tauri::command]
pub fn open_export(app: AppHandle, exports: tauri::State<'_, Exports>, path: String) -> Result<(), String> {
    let known = exports
        .0
        .lock()
        .map(|list| list.iter().any(|saved| saved.as_os_str() == path.as_str()))
        .unwrap_or(false);
    if !known {
        return Err("not an exported workbook".into());
    }
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_the_hours_sheet() {
        let request = ExportRequest {
            file_name: "Timi 2026-10-31.xlsx".into(),
            rows: vec![TimesheetRow {
                date: "2026-10-31".into(),
                start: "2026-10-31T09:00:00".into(),
                finish: "2026-10-31T17:00:00".into(),
                kind_of_work: "Internal".into(),
                clients: String::new(),
                project: "SLE Hub".into(),
                worked_on: "Onboarding calls".into(),
                note: "=not a formula".into(),
            }],
        };
        let mut workbook = build_workbook(&request).expect("workbook");
        let bytes = workbook.save_to_buffer().expect("saved");
        // An .xlsx file is a zip archive
        assert_eq!(&bytes[..2], b"PK");
    }
}
