/* Reps sync
   Runs in your own Google account and keeps a shared copy of your Reps log in a Google Sheet
   called "Reps data", so you and your training partner can see each other's workouts.
   Only phones that know the key below can read or add to it. It never touches anything else.

   Set up:
   1. Paste this whole file into a new project on script.google.com.
   2. Deploy > New deployment > Select type > Web app.
      Execute as: Me. Who has access: Anyone. Then Deploy, and allow access when Google asks.
   3. Copy the Web app URL into Reps (More > Train together).
   The key is what keeps the link private. Don't share this file once it has your key in it. */

const KEY = '__REPS_KEY__';
const VERSION = 1;
const COLS = ['id', 'kind', 'person', 'updated', 'server', 'deleted', 'data'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!keyOk(p.key)) return reply({ error: 'key' });
  return reply({ v: VERSION, ok: true });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return reply({ error: 'bad' }); }
  if (!keyOk(body.key)) return reply({ error: 'key' });
  const push = Array.isArray(body.push) ? body.push : [];
  const since = Number(body.since) || 0;

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = sheet();
    const props = PropertiesService.getScriptProperties();
    const n = sh.getLastRow() - 1;
    const rows = n > 0 ? sh.getRange(2, 1, n, COLS.length).getValues() : [];
    const index = {};
    rows.forEach(function (r, i) { index[String(r[0])] = i; });

    // A counter that only goes up, so each phone can ask for "everything since my last sync".
    let clock = Number(props.getProperty('clock')) || 0;
    const stamp = push.length ? Math.max(Date.now(), clock + 1) : clock;
    let wrote = false;
    push.forEach(function (rec) {
      if (!rec || typeof rec.id !== 'string' || !rec.kind) return;
      const json = JSON.stringify(rec);
      if (json.length > 45000) return;
      const row = [rec.id, String(rec.kind), String(rec.person || ''), Number(rec.updated) || 0, stamp, rec.deleted ? 1 : 0, json];
      const i = index[rec.id];
      if (i == null) { index[rec.id] = rows.length; rows.push(row); wrote = true; }
      else if (row[3] >= Number(rows[i][3])) { rows[i] = row; wrote = true; }
    });
    if (wrote) {
      sh.getRange(2, 1, rows.length, COLS.length).setValues(rows);
      clock = stamp;
      props.setProperty('clock', String(clock));
    }
    const out = [];
    rows.forEach(function (r) {
      if (Number(r[4]) > since) { try { out.push(JSON.parse(r[6])); } catch (x) { /* skip a damaged row */ } }
    });
    return reply({ v: VERSION, now: clock, records: out });
  } finally {
    lock.releaseLock();
  }
}

function keyOk(k) { return KEY.indexOf('__') !== 0 && k === KEY; }

function sheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('sheet');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (x) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Reps data');
    props.setProperty('sheet', ss.getId());
    props.deleteProperty('clock');
    const sh = ss.getSheets()[0];
    sh.setName('records');
    sh.getRange('A:C').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return ss.getSheetByName('records') || ss.getSheets()[0];
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
