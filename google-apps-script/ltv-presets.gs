// Google Apps Script - LTV Presets API
// Sheet: 기본양식_BizStrategy 또는 CPI 대시보드 시트 아무곳에나 붙여넣기
// 배포: 확장 프로그램 → Apps Script → 배포 → 새 배포 → 웹앱 → 누구나 액세스

const SHEET_NAME = "LTV_Presets";

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["id", "name", "d1", "k", "arpdau", "iapPct", "cpi", "installs", "savedAt"]);
  }
  return sheet;
}

function doGet(e) {
  const action = e.parameter.action || "list";
  const sheet = getOrCreateSheet();

  if (action === "list") {
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
    const data = JSON.parse(e.parameter.data);
    const id = Date.now();
    sheet.appendRow([id, data.name, data.d1, data.k, data.arpdau, data.iapPct, data.cpi, data.installs, new Date().toISOString()]);
    return response({ ok: true, id });
  }

  if (action === "delete") {
    const id = Number(e.parameter.id);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return response({ ok: true });
  }

  return response({ error: "unknown action" });
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
