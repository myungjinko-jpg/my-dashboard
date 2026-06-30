// Google Apps Script - LTV Presets + AppMagic Benchmark API
// Sheet: 기본양식_BizStrategy 또는 CPI 대시보드 시트 아무곳에나 붙여넣기
// 배포: 확장 프로그램 → Apps Script → 배포 → 새 배포 → 웹앱 → 누구나 액세스

const SHEET_NAME = "LTV_Presets";
const AM_SHEET_NAME = "AppMagic_Data";

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["id", "name", "d1", "k", "arpdau", "iapPct", "cpi", "installs", "savedAt"]);
  }
  return sheet;
}

function getOrCreateAmSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AM_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AM_SHEET_NAME);
    sheet.appendRow(["app", "publisher", "genre", "d1", "d7", "d14", "k", "cumRpd", "cpi", "months", "updated"]);
  }
  return sheet;
}

function doGet(e) {
  const action = e.parameter.action || "list";

  if (action === "list") {
    const sheet = getOrCreateSheet();
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const presets = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).filter(p => p.id);
    return response(presets);
  }

  if (action === "save") {
    const sheet = getOrCreateSheet();
    const data = JSON.parse(e.parameter.data);
    const id = Date.now();
    sheet.appendRow([id, data.name, data.d1, data.k, data.arpdau, data.iapPct, data.cpi, data.installs, new Date().toISOString()]);
    return response({ ok: true, id });
  }

  if (action === "delete") {
    const sheet = getOrCreateSheet();
    const id = Number(e.parameter.id);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) { sheet.deleteRow(i + 1); break; }
    }
    return response({ ok: true });
  }

  if (action === "saveAppMagic") {
    const sheet = getOrCreateAmSheet();
    const rows = JSON.parse(e.parameter.data);
    const existing = sheet.getDataRange().getValues();
    const headers = existing[0];
    const appCol = headers.indexOf("app");

    rows.forEach(row => {
      let foundRow = -1;
      for (let i = 1; i < existing.length; i++) {
        if (existing[i][appCol] === row.app) { foundRow = i + 1; break; }
      }
      const rowData = [row.app, row.publisher, row.genre, row.d1, row.d7, row.d14, row.k, row.cumRpd, row.cpi, row.months, new Date().toISOString()];
      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    });
    return response({ ok: true, count: rows.length });
  }

  if (action === "listAppMagic") {
    const sheet = getOrCreateAmSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return response([]);
    const headers = data[0];
    const result = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return response(result);
  }

  return response({ error: "unknown action" });
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
