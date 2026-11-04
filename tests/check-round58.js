global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});
// ===== tests/check-round58.js =====
// รอบ 58 — แก้บั๊ก + ทำให้ชุดเทสต์เดิมรันได้ครบ
//   1. แก้ชื่อไฟล์ที่ Google Drive sync เติมเลข "(1)" (state/canvas-viewer/tab-export-preview/style)
//   2. tests/check-round48.js + check-round51.js ใช้ตัวอ่าน xlsx ในเครื่อง (ไม่ต้องพึ่ง python/openpyxl)
//   3. tests/verify-file.js รันได้โดยไม่ต้องมีไฟล์ index.html.restored
//   4. ตัดโค้ดตายที่อ้าง breadcrumb ที่ถูกลบไปตั้งแต่รอบ 46 (headerMainTabName/headerSubTabName/headerBreadcrumbSep)
//   5. ค่าตัวเลข 0 ต้องไม่กลายเป็นค่าว่าง (falsy-zero) ในทุกที่ที่คำนวณระดับและในตาราง
//   6. แถวที่เติมตาม กม. ต้องมี กม.สิ้นสุด / BL สิ้นสุด / TBL สิ้นสุด ที่สอดคล้องกับช่วงคูน้ำของแถวนั้น
// รัน: node tests\check-round58.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const base = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra !== undefined ? ' -> ' + extra : '')); }
}

// ---------- Mock DOM สำหรับรันโค้ดจริง ----------
function makeCtx() {
  const noop = () => {};
  return { setTransform: noop, clearRect: noop, beginPath: noop, arc: noop, fill: noop, moveTo: noop,
    lineTo: noop, stroke: noop, save: noop, restore: noop, setLineDash: noop, fillText: noop,
    strokeText: noop, rect: noop, closePath: noop, drawImage: noop, translate: noop, rotate: noop,
    scale: noop, clip: noop, strokeRect: noop, fillRect: noop,
    measureText: (t) => ({ width: String(t || '').length * 7 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1 };
}
function makeEl(id) {
  return { id, innerHTML: '', value: '', innerText: '', textContent: '', title: '', style: {},
    readOnly: false, width: 1000, height: 600, offsetWidth: 1000, offsetHeight: 600, dataset: {}, __attrs: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); } },
    getAttribute(k) { return (k in this.__attrs) ? this.__attrs[k] : (this[k] || null); },
    setAttribute(k, v) { this.__attrs[k] = v; this[k] = v; },
    removeAttribute(k) { delete this.__attrs[k]; delete this[k]; },
    hasAttribute(k) { return (k in this.__attrs) || (k in this); },
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, dispatchEvent() {},
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, removeChild(c) { return c; },
    scrollIntoView() {}, getBoundingClientRect() { return { top: 0, left: 0, width: 1000, height: 1000 }; },
    click() {}, toDataURL() { return 'data:image/png;base64,IMG'; },
    getContext() { if (!this.__ctx) this.__ctx = makeCtx(); return this.__ctx; } };
}
const mockElements = {};
function el(id) { if (!mockElements[id]) mockElements[id] = makeEl(id); return mockElements[id]; }

global.window = { addEventListener() {}, alert() {}, innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1 };
global.document = { getElementById(id) { return el(id); }, querySelectorAll() { return []; },
  querySelector(sel) { if (sel === '.tabs-area') return el('bottomTabsArea');
    if (sel === '.viewport-outer-container') return el('viewportOuterContainer'); return null; },
  createElement(tag) { const e = makeEl(tag); e.tagName = String(tag).toUpperCase(); return e; },
  body: makeEl('body'), addEventListener() {}, removeEventListener() {} };
global.Image = class { constructor() { this._src = ''; this.width = 1000; this.height = 600;
    this.naturalWidth = 1000; this.naturalHeight = 600; this.complete = true; this.onload = null; }
  get src() { return this._src; }
  set src(v) { this._src = v; this.complete = true; if (this.onload) this.onload(); } };
global.FileReader = class { readAsText() {} readAsArrayBuffer() {} };
global.Blob = class { constructor(a) { this.a = a; } };
global.alert = () => {};
global.Event = class { constructor(t) { this.type = t; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
global.XLSX = { utils: { book_new: () => ({ Sheets: {}, SheetNames: [] }),
    aoa_to_sheet: (r) => ({ '!ref': 'A1:A1', __rows: r }),
    book_append_sheet: (wb, ws, n) => { wb.Sheets[n] = ws; wb.SheetNames.push(n); } },
  write: () => new ArrayBuffer(8), read: () => ({ Sheets: {} }) };

const jsFiles = ['js/state.js', 'js/canvas-viewer.js', 'js/table-core.js', 'js/table-sync.js', 'js/tab-project.js',
  'js/tab-ditch.js', 'js/tab-dimension.js', 'js/tab-level.js', 'js/tab-ground.js', 'js/tab-structure.js',
  'js/tab-attachment.js', 'js/tab-type.js',
  'js/tab-earthwork.js', 'js/tab-ai-result.js', 'js/tab-validate.js', 'js/io-manager.js',
  'js/ai-reader.js', 'js/autosave.js', 'js/tab-export-preview.js', 'js/ai-credit.js'];
let code = jsFiles.map(f => fs.readFileSync(path.join(base, f), 'utf8')).join('\n;\n');
code = code.replace(/^(let|const) /gm, 'var ');
eval(code);
global.uiToast = () => {}; uiToast = global.uiToast;

(async () => {
  console.log('=== รอบ 58: ตรวจบั๊ก + ชุดเทสต์เดิมรันได้ครบ ===');

  // ── 1) ไม่มีไฟล์หลักที่ถูก Google Drive sync เติมเลข "(1)" ──
  const jsDir = path.join(base, 'js');
  const conflated = fs.readdirSync(jsDir).filter(f => /\s\(\d+\)\.js$/.test(f));
  check('1a. ไม่มีไฟล์ js ที่ถูก sync เปลี่ยนชื่อเป็น "... (1).js"', conflated.length === 0, conflated.join(', '));
  const rootFiles = fs.readdirSync(base);
  const conflatedRoot = rootFiles.filter(f => /\s\(\d+\)\.css$/.test(f));
  check('1b. ไม่มีไฟล์ css ที่ถูก sync เปลี่ยนชื่อเป็น "... (1).css"', conflatedRoot.length === 0, conflatedRoot.join(', '));

  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const scriptSrcs = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1].split('?')[0]);
  const missingFiles = scriptSrcs.filter(p => !fs.existsSync(path.join(base, p)));
  check('1c. ไฟล์ js ทุกไฟล์ที่ index.html โหลด มีอยู่จริง', missingFiles.length === 0, missingFiles.join(', '));
  const cssHref = /<link rel="stylesheet" href="([^"]+)"/.exec(html);
  check('1d. ไฟล์ css ที่ index.html โหลด มีอยู่จริง',
    !!cssHref && fs.existsSync(path.join(base, cssHref[1].split('?')[0])), cssHref ? cssHref[1] : 'ไม่พบ link');

  // ── 2) ชุดเทสต์ที่เคยพังใช้ตัวอ่าน xlsx ในเครื่องแล้ว ──
  const r48Path = path.join(base, 'tests/check-round48.js');
  const r51Path = path.join(base, 'tests/check-round51.js');
  const r48 = fs.existsSync(r48Path) ? fs.readFileSync(r48Path, 'utf8') : '';
  const r51 = fs.existsSync(r51Path) ? fs.readFileSync(r51Path, 'utf8') : '';
  check('2a. check-round48.js ไม่เรียก python/openpyxl อีกแล้ว',
    !r48.includes('openpyxl') && !r48.includes('execSync(`python3'), 'ยังมีการเรียก python');
  check('2b. check-round51.js ไม่เรียก python/openpyxl อีกแล้ว',
    !r51.includes('openpyxl') && !r51.includes('execSync(`python3'), 'ยังมีการเรียก python');
  check('2c. มีตัวอ่าน xlsx ในเครื่อง (tests/lib/xlsx-reader.js)',
    fs.existsSync(path.join(base, 'tests/lib/xlsx-reader.js')));
  check('2d. verify-file.js ไม่อ้างไฟล์ index.html.restored ที่ไม่มีอยู่',
    !fs.readFileSync(path.join(base, 'tests/verify-file.js'), 'utf8').includes('index.html.restored'));

  // ── 3) ไม่มีโค้ดตายที่อ้าง breadcrumb ซึ่งถูกลบไปแล้ว ──
  const cv = fs.readFileSync(path.join(base, 'js/canvas-viewer.js'), 'utf8');
  const cvCode = cv.replace(/\/\/[^\n]*/g, ''); // ตัดคอมเมนต์ออก (ชื่อ id ที่กล่าวถึงในคอมเมนต์ไม่ถือเป็นการอ้างอิงโค้ด)
  check('3a. canvas-viewer.js ไม่อ้าง headerMainTabName / headerSubTabName / headerBreadcrumbSep',
    !cvCode.includes('headerMainTabName') && !cvCode.includes('headerSubTabName') && !cvCode.includes('headerBreadcrumbSep'));
  check('3b. index.html ไม่มี id headerMainTabName (ตรงกับรอบ 46 ที่ถูกลบออก)',
    !html.includes('id="headerMainTabName"'));

  // ── 4) ค่าตัวเลข 0 ต้องไม่กลายเป็นค่าว่าง ──
  check('4a. keepNumValue(0) = 0', keepNumValue(0) === 0, String(keepNumValue(0)));
  check('4b. keepNumValue("0") = 0', keepNumValue('0') === 0, String(keepNumValue('0')));
  check('4c. keepNumValue("0.00") ไม่ว่าง', keepNumValue('0.00') !== '', String(keepNumValue('0.00')));
  check('4d. keepNumValue("") = ""', keepNumValue('') === '');
  check('4e. keepNumValue(null) = ""', keepNumValue(null) === '');
  check('4f. keepNumValue(undefined) = ""', keepNumValue(undefined) === '');
  check('4g. epKeepNum(0) = 0', epKeepNum(0) === 0, String(epKeepNum(0)));
  check('4h. epKeepNum("") = ""', epKeepNum('') === '');

  // ช่วงคูน้ำที่ BL1 = 0 ต้องยังคงค่า 0 ไม่กลายเป็นค่าว่าง
  const zeroLevelRows = [{
    src: 'level', canal: 'ค', ditch: '1', km: 0, kmEnd: 100,
    values: { levelType: 'VU1', hTbl: 0.5, slope: 4000, levelH: 0, bl1: 0, tbl1: 0.5, bl2: 0, tbl2: 0.5 }
  }];
  const segZero = epPrepareCanalLevelSegments(zeroLevelRows, 'ค', '1');
  check('4i. ช่วงคูน้ำที่ BL1 = 0 ยังคงค่า 0 ไม่กลายเป็นค่าว่าง',
    segZero.length === 1 && segZero[0].values.bl1 !== '' && Number(segZero[0].values.bl1) === 0,
    JSON.stringify(segZero[0] && segZero[0].values));
  const evalZero = epEvalCanalLevelAtKm(zeroLevelRows, 0, 'ค', '1');
  check('4j. epEvalCanalLevelAtKm ที่ BL1 = 0 ยังคงค่า 0',
    !!evalZero && evalZero.values.bl1 !== '' && Number(evalZero.values.bl1) === 0,
    JSON.stringify(evalZero && evalZero.values));

  // ไม่มีการใช้ || ในการดึงค่าตัวเลขระดับที่อาจเป็น 0
  const ep = fs.readFileSync(path.join(base, 'js/tab-export-preview.js'), 'utf8');
  check('4k. tab-export-preview.js ไม่ใช้ "v.bl1 ||" / "v.tbl1 ||" / "v.bl2 ||" / "v.tbl2 ||"',
    !/v\.(bl1|tbl1|bl2|tbl2)\s*\|\|/.test(ep));

  // ── 5) แถวที่เติมตาม กม. ต้องสอดคล้องกับช่วงคูน้ำของแถวนั้น ──
  projectPlanData = { name: 'ทดสอบ 58', location: 'ลำปาง', description: '' };
  channels = [{ id: 1, canal: 'คลองทดสอบ', ditch: '02', totalArea: '1', waterArea: '1', collapsed: false, rows: [] }];
  dimensionRows = [{ channelId: 1, kmStart: 0, kmEnd: 200, type: 'VU1', slope: 4000, q: 0.03, b: 0.35, d: 0.36, tbl: 0.5, tbr: 0.5 }];
  groundRowsData = [
    { channelId: 1, isBoundary: true, km: 0, groundElevation: '100.00', ditchSection: 1 },
    { channelId: 1, isBoundary: false, km: 100, groundElevation: '99.90', ditchSection: 1 },
    { channelId: 1, isBoundary: true, km: 200, groundElevation: '99.80', ditchSection: 1 }
  ];
  levelRowsData = [
    { channelId: 1, isDynamicRow: false, customType: 'VU1', customSlope: 4000, customKmStart: 0, customKmEnd: 100, h: 0.00, bl1: '100.00', tbl1: '', bl2: '', tbl2: '', ditchSection: 1 },
    { channelId: 1, isDynamicRow: true, customType: 'VU1', customSlope: 4000, customKmStart: 100, customKmEnd: 200, h: 0.50, bl1: '', tbl1: '', bl2: '', tbl2: '', ditchSection: 1 }
  ];
  structureRowsData = [];
  attachmentRowsData = [];

  const dlg = openExportPreviewDialog('ทดสอบ');
  exportPreviewState.kmStep = 20;
  const merged = epGetMergedRows();
  const gen = merged.filter(r => r.isGenerated);
  const levelRowsRaw = merged.filter(r => r.src === 'level' && !r.isGenerated);
  const segs = epPrepareCanalLevelSegments(levelRowsRaw, 'คลองทดสอบ', '02');

  check('5a. แถวที่เติมตาม กม. มีจำนวนถูกต้อง (8 แถว)', gen.length === 8, 'got ' + gen.length);

  const mism = [];
  gen.forEach(r => {
    const seg = segs.find(s => Math.abs(s.km - r.km) < 0.001) || segs.find(s => r.km > s.km && r.km <= s.kmEnd);
    if (!seg) { mism.push('km ' + r.km + ': ไม่พบช่วงคูน้ำ'); return; }
    if (Math.abs(Number(r.kmEnd) - Number(seg.kmEnd)) > 0.001) {
      mism.push('km ' + r.km + ': กม.สิ้นสุด=' + r.kmEnd + ' แต่ช่วงสิ้นสุด=' + seg.kmEnd);
    }
    if (Math.abs(Number(r.values.bl2) - Number(seg.values.bl2)) > 0.011) {
      mism.push('km ' + r.km + ': BL สิ้นสุด=' + r.values.bl2 + ' แต่ช่วง=' + seg.values.bl2);
    }
    if (Math.abs(Number(r.values.tbl2) - Number(seg.values.tbl2)) > 0.011) {
      mism.push('km ' + r.km + ': TBL สิ้นสุด=' + r.values.tbl2 + ' แต่ช่วง=' + seg.values.tbl2);
    }
  });
  check('5b. แถวที่เติมตาม กม. มี กม.สิ้นสุด / BL สิ้นสุด / TBL สิ้นสุด ตรงกับช่วงคูน้ำของแถวนั้น',
    mism.length === 0, mism.slice(0, 6).join('; '));

  // ค่า BL เริ่มต้นของแถวที่เติมตาม กม. ต้องเปลี่ยนตามระยะ (ไม่ใช่ค่าเดียวทั้งช่วง)
  const bl1s = gen.map(r => Number(r.values.bl1));
  check('5c. ค่า "ระดับ BL. เริ่มต้น" ของแถวที่เติมตาม กม. เปลี่ยนตามระยะ (ไม่ใช่ค่าเดียวทั้งช่วง)',
    new Set(bl1s).size > 1, 'ค่าทั้งหมด = ' + bl1s.join(','));

  closeExportPreviewDialog(false);
  await dlg;

  // ── 6) เลขเวอร์ชันตรงกันระหว่าง state.js กับป้ายในหน้าเว็บ ──
  const stateSrc = fs.readFileSync(path.join(base, 'js/state.js'), 'utf8');
  const appVer = /APP_VERSION\s*=\s*'([^']+)'/.exec(stateSrc)?.[1];
  const badgeVer = /id="devBadgeVersion">Version ([^<]+)</.exec(html)?.[1];
  check('6a. เลขเวอร์ชันใน state.js ตรงกับป้ายใน index.html',
    !!appVer && !!badgeVer && appVer === badgeVer, `state=${appVer}, badge=${badgeVer}`);

  console.log(`\n=== สรุปผลรอบ 58: PASS = ${pass}, FAIL = ${fail} ===`);
  if (fail > 0) process.exit(1);
})();
