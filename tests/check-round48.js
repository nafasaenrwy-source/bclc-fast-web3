global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});
// ===== tests/check-round48.js =====
// ทดสอบรอบ 48:
//   1. เมื่อนำเข้าไฟล์ Excel (ทดสอบด้วยข้อมูลจริงจาก คลองซอย10RMC_แม่วัง_7แท็บ.xlsx)
//      ค่าคอลัมน์ "ช่วงคูน้ำ" ในตารางทั้ง 4 แท็บ (ระดับดินเดิม, ระดับคูส่งน้ำ, อาคารประกอบ, อาคารท่อรับน้ำเข้าแปลงไร่นา)
//      ต้องตรงกับคอลัมน์ "ช่วงคูน้ำ" ในไฟล์นำเข้าทุกแถว (234, 119, 275, 120 แถว)
//   2. แท็บระดับดินเดิม ในไฟล์มีคอลัมน์ P1 / P2 ("กม. P1", "ระดับ P1", "กม. P2", "ระดับ P2")
//      ต้องนำค่าจากไฟล์มาใส่ค่า P1 / P2 ในตารางครบทั้ง 37 คูส่งน้ำ

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadFixture } = require('./lib/fixture');

const base = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  PASS:', name);
  } else {
    fail++;
    console.log('  FAIL:', name, detail ? '-> ' + detail : '');
  }
}

// โหลดไฟล์ Excel จริงเป็น AOA (ค้นหาอัตโนมัติจาก Downloads / fixtures / env var)
const fixture = loadFixture();
if (!fixture || !fixture.sheets) {
  console.log('  FAIL: ไม่พบไฟล์ตัวอย่าง "คลองซอย10RMC_แม่วัง_7แท็บ.xlsx"');
  console.log('         ตั้งค่า env var BCLC_FIXTURE_XLSX ให้ชี้ไปยังไฟล์ .xlsx ที่ต้องการ');
  console.log(`\nสรุปผล check-round48: PASS = ${pass}, FAIL = ${fail}`);
  process.exit(1);
}
console.log('  (ไฟล์ตัวอย่าง: ' + fixture.path + ')');
const excelSheetsAOA = fixture.sheets;

// ตั้งค่า Mock DOM + Sandbox
const mockElements = {};
function makeEl(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, f) {
          if (f === undefined) {
            if (this._set.has(c)) { this._set.delete(c); return false; }
            this._set.add(c); return true;
          }
          if (f) this._set.add(c); else this._set.delete(c);
          return !!f;
        },
        contains(c) { return this._set.has(c); }
      },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; }
    };
  }
  return mockElements[id];
}

['p1XVal', 'p1YVal', 'p2XVal', 'p2YVal', 'tableContainer', 'Header Title', 'projectBannerTitle', 'projectBannerLocation'].forEach(makeEl);

function aoaToJsonObjects(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return [];
  const headers = aoa[0].map(h => String(h || '').trim());
  const res = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = {};
    headers.forEach((h, cIdx) => {
      if (!h) return;
      const val = r[cIdx];
      if (val !== '' && val !== null && val !== undefined) {
        obj[h] = val;
      }
    });
    res.push(obj);
  }
  return res;
}

function makeSheetFromAOA(aoa) {
  const sheet = { _aoa: aoa };
  const maxR = Math.max(0, aoa.length - 1);
  const maxC = aoa.reduce((m, r) => Math.max(m, (r ? r.length : 0) - 1), 0);
  sheet['!ref'] = `A1:${String.fromCharCode(65 + Math.min(25, Math.max(0, maxC)))}${maxR + 1}`;
  for (let r = 0; r <= maxR; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
        const colLetter = String.fromCharCode(65 + c);
        sheet[`${colLetter}${r + 1}`] = { v: row[c] };
      }
    }
  }
  return sheet;
}

const sandbox = {
  console,
  Math,
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Set,
  Map,
  Promise,
  Uint8Array,
  Blob: function (parts) { this.parts = parts; },
  Image: function () {},
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  alert: () => {},
  confirm: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  document: {
    getElementById: (id) => makeEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => makeEl('created_' + tag + '_' + Math.random()),
    body: { appendChild() {}, removeChild() {} },
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
    devicePixelRatio: 1
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  FileReader: function () {
    this.readAsArrayBuffer = function () {
      if (this.onload) {
        this.onload({ target: { result: new ArrayBuffer(8) } });
      }
    };
  },
  XLSX: {
    read: () => {
      const Sheets = {};
      Object.keys(excelSheetsAOA).forEach(k => {
        Sheets[k] = makeSheetFromAOA(excelSheetsAOA[k]);
      });
      return { Sheets, SheetNames: Object.keys(Sheets) };
    },
    utils: {
      sheet_to_json: (sheet, opts) => {
        if (opts && opts.header === 1) return sheet._aoa || [];
        return aoaToJsonObjects(sheet._aoa || []);
      },
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 30, c: 15 } }),
      encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`,
      book_new: () => ({ Sheets: {}, SheetNames: [] }),
      aoa_to_sheet: (aoa) => makeSheetFromAOA(aoa),
      book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); }
    },
    write: () => new Uint8Array(8)
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const scripts = [
  'js/state.js',
  'js/table-core.js',
  'js/table-sync.js',
  'js/tab-project.js',
  'js/tab-ditch.js',
  'js/tab-dimension.js',
  'js/tab-ground.js',
  'js/tab-level.js',
  'js/tab-structure.js',
  'js/tab-attachment.js',
  'js/tab-type.js',
  'js/tab-earthwork.js',
  'js/io-manager.js'
];
scripts.forEach(s => {
  const code = fs.readFileSync(path.join(base, s), 'utf8');
  vm.runInContext(code, sandbox, { filename: s });
});

console.log('=== ทดสอบรอบ 48: นำเข้าไฟล์ คลองซอย10RMC_แม่วัง_7แท็บ.xlsx ===');
sandbox.importAllFromExcel({ target: { files: [{ name: 'คลองซอย10RMC_แม่วัง_7แท็บ.xlsx' }], value: 'x' } });

const groundExcelRows = aoaToJsonObjects(excelSheetsAOA['ระดับดินเดิม']);
const levelExcelRows = aoaToJsonObjects(excelSheetsAOA['ระดับคูส่งน้ำ']);
const structExcelRows = aoaToJsonObjects(excelSheetsAOA['อาคารประกอบ']);
const attachExcelRows = aoaToJsonObjects(excelSheetsAOA['อาคารท่อรับน้ำเข้าแปลงไร่นา']);

const groundAppRows = vm.runInContext('groundRowsData', sandbox);
const levelAppRows = vm.runInContext('levelRowsData', sandbox);
const structAppRows = vm.runInContext('structureRowsData', sandbox);
const attachAppRows = vm.runInContext('attachmentRowsData', sandbox);
const channelsApp = vm.runInContext('channels', sandbox);
const groundGroupStateApp = vm.runInContext('groundGroupState', sandbox);

// 1. ตรวจสอบจำนวนแถวทั้ง 4 แท็บตรงกับไฟล์นำเข้า
check('R48.1a จำนวนแถวแท็บระดับดินเดิมตรงกับไฟล์นำเข้า (234 แถว)',
  groundAppRows.length === groundExcelRows.length,
  `app=${groundAppRows.length}, excel=${groundExcelRows.length}`);
check('R48.1b จำนวนแถวแท็บระดับคูส่งน้ำตรงกับไฟล์นำเข้า (119 แถว)',
  levelAppRows.length === levelExcelRows.length,
  `app=${levelAppRows.length}, excel=${levelExcelRows.length}`);
check('R48.1c จำนวนแถวแท็บอาคารประกอบตรงกับไฟล์นำเข้า (275 แถว)',
  structAppRows.length === structExcelRows.length,
  `app=${structAppRows.length}, excel=${structExcelRows.length}`);
check('R48.1d จำนวนแถวแท็บอาคารท่อรับน้ำเข้าแปลงไร่นาตรงกับไฟล์นำเข้า (120 แถว)',
  attachAppRows.length === attachExcelRows.length,
  `app=${attachAppRows.length}, excel=${attachExcelRows.length}`);

// 2. ตรวจสอบค่า "ช่วงคูน้ำ" ในตารางตรงกับไฟล์นำเข้าทุกแถว
const checkSectionMatch = (tabName, appRows, excelRows) => {
  let mismatches = [];
  const n = Math.min(appRows.length, excelRows.length);
  for (let i = 0; i < n; i++) {
    const appSec = String(sandbox.getDitchSectionIndex(appRows[i].channelId, appRows[i]));
    const xlsSec = String(excelRows[i]['ช่วงคูน้ำ']);
    if (appSec !== xlsSec) {
      mismatches.push(`row ${i}: app=${appSec} vs excel=${xlsSec}`);
    }
  }
  check(`R48.2 ช่วงคูน้ำของแท็บ "${tabName}" ตรงกับไฟล์นำเข้าครบทุกแถว (${n} แถว)`,
    mismatches.length === 0 && appRows.length === excelRows.length,
    mismatches.slice(0, 5).join('; '));
};

checkSectionMatch('ระดับดินเดิม', groundAppRows, groundExcelRows);
checkSectionMatch('ระดับคูส่งน้ำ', levelAppRows, levelExcelRows);
checkSectionMatch('อาคารประกอบ', structAppRows, structExcelRows);
checkSectionMatch('อาคารท่อรับน้ำเข้าแปลงไร่นา', attachAppRows, attachExcelRows);

// 3. ตรวจสอบ HTML ที่เรนเดอร์จริงในทั้ง 4 แท็บ ว่าแสดงค่าช่วงคูน้ำตรงกับไฟล์นำเข้า
function extractRenderedSections(renderFnName) {
  sandbox[renderFnName]();
  const html = makeEl('tableContainer').innerHTML;
  const matches = [...html.matchAll(/<td class="ditch-section-cell">[\s\S]*?<span class="ditch-section-index"[^>]*>([^<]+)<\/span>[\s\S]*?<\/td>/g)];
  return matches.map(m => m[1].trim());
}

const renderedGroundSecs = extractRenderedSections('renderGroundTab');
const renderedLevelSecs = extractRenderedSections('renderLevelTab');
const renderedStructSecs = extractRenderedSections('renderStructureTab');
const renderedAttachSecs = extractRenderedSections('renderAttachmentTab');

check('R48.3a HTML แท็บระดับดินเดิมแสดงคอลัมน์ช่วงคูน้ำตรงกับไฟล์นำเข้าทุกแถว',
  renderedGroundSecs.length === groundExcelRows.length &&
  renderedGroundSecs.every((v, i) => v === String(groundExcelRows[i]['ช่วงคูน้ำ'])),
  `len=${renderedGroundSecs.length}`);
check('R48.3b HTML แท็บระดับคูส่งน้ำแสดงคอลัมน์ช่วงคูน้ำตรงกับไฟล์นำเข้าทุกแถว',
  renderedLevelSecs.length === levelExcelRows.length &&
  renderedLevelSecs.every((v, i) => v === String(levelExcelRows[i]['ช่วงคูน้ำ'])),
  `len=${renderedLevelSecs.length}`);
check('R48.3c HTML แท็บอาคารประกอบแสดงคอลัมน์ช่วงคูน้ำตรงกับไฟล์นำเข้าทุกแถว',
  renderedStructSecs.length === structExcelRows.length &&
  renderedStructSecs.every((v, i) => v === String(structExcelRows[i]['ช่วงคูน้ำ'])),
  `len=${renderedStructSecs.length}`);
check('R48.3d HTML แท็บอาคารท่อรับน้ำเข้าแปลงไร่นาแสดงคอลัมน์ช่วงคูน้ำตรงกับไฟล์นำเข้าทุกแถว',
  renderedAttachSecs.length === attachExcelRows.length &&
  renderedAttachSecs.every((v, i) => v === String(attachExcelRows[i]['ช่วงคูน้ำ'])),
  `len=${renderedAttachSecs.length}`);

// 4. ตรวจสอบค่า P1 / P2 จากแท็บระดับดินเดิมในไฟล์นำเข้า
const expectedP1P2ByDitch = {};
groundExcelRows.forEach(r => {
  if (r['กม. P1'] !== undefined || r['ระดับ P1'] !== undefined || r['กม. P2'] !== undefined || r['ระดับ P2'] !== undefined) {
    expectedP1P2ByDitch[String(r['คูส่งน้ำ'])] = {
      p1Km: Number(sandbox.parseKmInput(r['กม. P1'])),
      p1Elev: parseFloat(r['ระดับ P1']),
      p2Km: Number(sandbox.parseKmInput(r['กม. P2'])),
      p2Elev: parseFloat(r['ระดับ P2'])
    };
  }
});

let p1p2Mismatches = [];
channelsApp.forEach(ch => {
  const exp = expectedP1P2ByDitch[String(ch.ditch)];
  const grp = groundGroupStateApp['ground_ch_' + ch.id];
  if (!exp) {
    p1p2Mismatches.push(`ditch ${ch.ditch}: missing expected`);
    return;
  }
  if (!grp || grp.p1Km !== exp.p1Km || grp.p1Elev !== exp.p1Elev || grp.p2Km !== exp.p2Km || grp.p2Elev !== exp.p2Elev) {
    p1p2Mismatches.push(`ditch ${ch.ditch}: got ${JSON.stringify(grp)} vs exp ${JSON.stringify(exp)}`);
  }
});
check('R48.4a นำเข้าค่า P1 / P2 (กม. P1, ระดับ P1, กม. P2, ระดับ P2) ลง groundGroupState ครบทั้ง 37 คูส่งน้ำ',
  Object.keys(expectedP1P2ByDitch).length === 37 && p1p2Mismatches.length === 0,
  p1p2Mismatches.slice(0, 5).join('; '));

// ทดสอบเมื่อขยายตารางระดับดินเดิม (collapsed = false) ช่อง input P1/P2 แสดงค่าที่นำเข้าจากไฟล์
Object.keys(groundGroupStateApp).forEach(k => { groundGroupStateApp[k].collapsed = false; });
sandbox.renderGroundTab();
const groundHtml = makeEl('tableContainer').innerHTML;
check('R48.4b ตารางระดับดินเดิมแสดงค่า P1/P2 ของคูส่งน้ำ 02 (กม. 0, ระดับ 253 / กม. 200, ระดับ 258)',
  groundHtml.includes('data-calib-ch="1" data-calib-field="p1Km" value="0"') &&
  groundHtml.includes('data-calib-ch="1" data-calib-field="p1Elev" value="253"') &&
  groundHtml.includes('data-calib-ch="1" data-calib-field="p2Km" value="200"') &&
  groundHtml.includes('data-calib-ch="1" data-calib-field="p2Elev" value="258"'));
check('R48.4c ตารางระดับดินเดิมแสดงค่า P1/P2 ของคูส่งน้ำ 04 (กม. 0, ระดับ 248 / กม. 900, ระดับ 255)',
  groundHtml.includes('data-calib-ch="2" data-calib-field="p1Km" value="0"') &&
  groundHtml.includes('data-calib-ch="2" data-calib-field="p1Elev" value="248"') &&
  groundHtml.includes('data-calib-ch="2" data-calib-field="p2Km" value="900"') &&
  groundHtml.includes('data-calib-ch="2" data-calib-field="p2Elev" value="255"'));

// ทดสอบส่งออกกลับเป็นข้อมูลชีต (buildExportSheetsData) ว่าคงค่า ช่วงคูน้ำ และ P1/P2 ครบถ้วน
const exportedSheets = sandbox.buildExportSheetsData();
const expGroundSheet = exportedSheets.find(s => s.name === 'ระดับดินเดิม');
check('R48.5 ส่งออกชีตระดับดินเดิมมีคอลัมน์ กม. P1, ระดับ P1, กม. P2, ระดับ P2 และค่าตรงกับที่นำเข้า',
  expGroundSheet &&
  expGroundSheet.rows[0].includes('กม. P1') &&
  expGroundSheet.rows[1][5] === 1 &&
  expGroundSheet.rows[1][6] === '0+000' &&
  expGroundSheet.rows[1][7] === 253 &&
  expGroundSheet.rows[1][8] === '0+200' &&
  expGroundSheet.rows[1][9] === 258,
  JSON.stringify(expGroundSheet && expGroundSheet.rows[1]));

console.log(`\nสรุปผล check-round48: PASS = ${pass}, FAIL = ${fail}`);
if (fail > 0) process.exit(1);
