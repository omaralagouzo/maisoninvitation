/**
 * Maison Invitation — RSVP → Google Sheet
 *
 * 1. Create a Google Sheet → Extensions → Apps Script → paste this file → Save.
 * 2. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 * 3. Copy the Web app URL into the invitation's "RSVP link / Google Sheet endpoint" field and set
 *    "RSVP method" to "sheet".
 *
 * Each reply becomes a row: time · invitation · name · attending · guests · message.
 */
const SHEET_NAME = 'RSVPs';

function doPost(e) {
  const p = (e && e.parameter) || {};
  const sheet = getSheet_();
  sheet.appendRow([
    new Date(),
    p['contact[Invitation]'] || '',
    p['contact[name]'] || '',
    p['contact[Attending]'] || '',
    Number(p['contact[Guests]'] || 0) || '',
    p['contact[Message]'] || '',
  ]);
  // Shown only when a guest's browser has JavaScript turned off (the invitation normally stays on its own page).
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font:18px/1.6 Georgia,serif;text-align:center;padding:60px 20px;color:#1F1D1A;background:#F7F3EC;min-height:100vh">' +
      'Thank you — your reply has been received.<br>شكرًا لكم — تم استلام ردّكم.</div>'
  );
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Received', 'Invitation', 'Name', 'Attending', 'Guests', 'Message']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:F1').setFontWeight('bold');
  }
  return sheet;
}
