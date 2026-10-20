//! Export to Excel (Phase 11, 9a–9d): the Save As dialog and the workbook, written here so the
//! web view needs no file or dialog permissions.

use rust_xlsxwriter::{
    ExcelDateTime, Format, FormatAlign, Formula, Workbook, Worksheet, XlsxError,
};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// One row of the Tasks sheet: a task on one work day.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRow {
    /// The work day, "YYYY-MM-DD".
    day: String,
    title: String,
    type_label: String,
    where_label: String,
    estimate_minutes: Option<f64>,
    tracked_seconds: f64,
    done: bool,
}

/// One row of the Sessions sheet.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    day: String,
    title: String,
    type_label: String,
    where_label: String,
    /// Local time, "YYYY-MM-DDThh:mm:ss".
    start: String,
    end: String,
    seconds: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    file_name: String,
    tasks: Vec<TaskRow>,
    sessions: Vec<SessionRow>,
}

const SECONDS_PER_DAY: f64 = 86_400.0;

/// Workbooks saved by `export_xlsx` in this run. `open_export` opens only these, so the web view
/// can't use it to open (and run) any other file.
#[derive(Default)]
pub struct Exports(Mutex<Vec<PathBuf>>);

struct Formats {
    header: Format,
    date: Format,
    time: Format,
    duration: Format,
    total: Format,
    total_duration: Format,
}

fn formats() -> Formats {
    Formats {
        header: Format::new().set_bold(),
        date: Format::new()
            .set_num_format("ddd d mmm")
            .set_align(FormatAlign::Left),
        time: Format::new().set_num_format("hh:mm"),
        // Durations as times, so Excel can add them up: 2:08
        duration: Format::new().set_num_format("[h]:mm"),
        total: Format::new().set_bold(),
        total_duration: Format::new().set_bold().set_num_format("[h]:mm"),
    }
}

fn write_header(sheet: &mut Worksheet, names: &[&str], formats: &Formats) -> Result<(), XlsxError> {
    for (col, name) in names.iter().enumerate() {
        sheet.write_string_with_format(0, col as u16, *name, &formats.header)?;
    }
    sheet.set_freeze_panes(1, 0)?;
    Ok(())
}

fn write_day(
    sheet: &mut Worksheet,
    row: u32,
    col: u16,
    day: &str,
    formats: &Formats,
) -> Result<(), XlsxError> {
    match ExcelDateTime::parse_from_str(day) {
        Ok(date) => sheet
            .write_datetime_with_format(row, col, &date, &formats.date)
            .map(|_| ()),
        Err(_) => sheet.write_string(row, col, day).map(|_| ()),
    }
}

fn write_time(
    sheet: &mut Worksheet,
    row: u32,
    col: u16,
    value: &str,
    formats: &Formats,
) -> Result<(), XlsxError> {
    match ExcelDateTime::parse_from_str(value) {
        Ok(time) => sheet
            .write_datetime_with_format(row, col, &time, &formats.time)
            .map(|_| ()),
        Err(_) => sheet.write_string(row, col, value).map(|_| ()),
    }
}

fn column(col: u16) -> char {
    (b'A' + col as u8) as char
}

/// The Tasks sheet (9d): date, task, type, client/project, estimate, tracked, done, and totals.
fn tasks_sheet(
    sheet: &mut Worksheet,
    rows: &[TaskRow],
    formats: &Formats,
) -> Result<(), XlsxError> {
    sheet.set_name("Tasks")?;
    write_header(
        sheet,
        &[
            "Date",
            "Task",
            "Type",
            "Client / project",
            "Estimate",
            "Tracked",
            "Done",
        ],
        formats,
    )?;
    for (index, task) in rows.iter().enumerate() {
        let row = index as u32 + 1;
        write_day(sheet, row, 0, &task.day, formats)?;
        sheet.write_string(row, 1, &task.title)?;
        sheet.write_string(row, 2, &task.type_label)?;
        sheet.write_string(row, 3, &task.where_label)?;
        if let Some(minutes) = task.estimate_minutes {
            sheet.write_number_with_format(
                row,
                4,
                minutes * 60.0 / SECONDS_PER_DAY,
                &formats.duration,
            )?;
        }
        sheet.write_number_with_format(
            row,
            5,
            task.tracked_seconds / SECONDS_PER_DAY,
            &formats.duration,
        )?;
        sheet.write_string(row, 6, if task.done { "Yes" } else { "No" })?;
    }
    let total = rows.len() as u32 + 1;
    sheet.write_string_with_format(total, 0, "Total", &formats.total)?;
    for col in [4u16, 5] {
        let letter = column(col);
        let formula = Formula::new(format!("=SUM({letter}2:{letter}{total})"));
        sheet.write_formula_with_format(total, col, formula, &formats.total_duration)?;
    }
    sheet.autofit();
    Ok(())
}

/// The Sessions sheet (9d): every timer session, in local time, and the total.
fn sessions_sheet(
    sheet: &mut Worksheet,
    rows: &[SessionRow],
    formats: &Formats,
) -> Result<(), XlsxError> {
    sheet.set_name("Sessions")?;
    write_header(
        sheet,
        &[
            "Date",
            "Task",
            "Type",
            "Client / project",
            "Start",
            "End",
            "Duration",
        ],
        formats,
    )?;
    for (index, session) in rows.iter().enumerate() {
        let row = index as u32 + 1;
        write_day(sheet, row, 0, &session.day, formats)?;
        sheet.write_string(row, 1, &session.title)?;
        sheet.write_string(row, 2, &session.type_label)?;
        sheet.write_string(row, 3, &session.where_label)?;
        write_time(sheet, row, 4, &session.start, formats)?;
        write_time(sheet, row, 5, &session.end, formats)?;
        sheet.write_number_with_format(
            row,
            6,
            session.seconds / SECONDS_PER_DAY,
            &formats.duration,
        )?;
    }
    let total = rows.len() as u32 + 1;
    sheet.write_string_with_format(total, 0, "Total", &formats.total)?;
    let formula = Formula::new(format!("=SUM(G2:G{total})"));
    sheet.write_formula_with_format(total, 6, formula, &formats.total_duration)?;
    sheet.autofit();
    Ok(())
}

fn build_workbook(request: &ExportRequest) -> Result<Workbook, XlsxError> {
    let formats = formats();
    let mut workbook = Workbook::new();
    tasks_sheet(workbook.add_worksheet(), &request.tasks, &formats)?;
    sessions_sheet(workbook.add_worksheet(), &request.sessions, &formats)?;
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
    fn builds_both_sheets() {
        let request = ExportRequest {
            file_name: "Timi 2026-10-12 to 2026-10-18.xlsx".into(),
            tasks: vec![TaskRow {
                day: "2026-10-12".into(),
                title: "Payment provider spike".into(),
                type_label: "Client project".into(),
                where_label: "Client A · Storefront".into(),
                estimate_minutes: Some(120.0),
                tracked_seconds: 7680.0,
                done: true,
            }],
            sessions: vec![SessionRow {
                day: "2026-10-12".into(),
                title: "Payment provider spike".into(),
                type_label: "Client project".into(),
                where_label: "Client A · Storefront".into(),
                start: "2026-10-12T19:02:00".into(),
                end: "2026-10-12T21:10:00".into(),
                seconds: 7680.0,
            }],
        };
        let mut workbook = build_workbook(&request).expect("workbook");
        let bytes = workbook.save_to_buffer().expect("saved");
        // An .xlsx file is a zip archive
        assert_eq!(&bytes[..2], b"PK");
    }
}
