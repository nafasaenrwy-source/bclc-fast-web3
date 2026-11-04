/**
 * รอบ 59: ตรวจสอบหน้า "ส่วนคำนวณปริมาณ" -> แท็บ "งานดิน"
 * - ตรวจการนำหลักส่วนที่ 3 ของ canal_cross_section_V3.html มาใส่ใน #quantityCalcPage
 * - ตรวจการดึงค่าจาก "ส่วนถอดแบบ" (channels, dimensionRows, levelRowsData, groundRowsData, ditchTypeDatabase)
 *   เข้าสู่ตาราง BoQ และโปรไฟล์ NGL ของแท็บ "งานดิน" อัตโนมัติผ่าน syncEarthworkFromTakeoff()
 * - ตรวจการคำนวณพิกัด 14 จุด (P1–P14), พื้นที่หน้าตัด A1/A2, ระยะ L และปริมาตร 8 หมวดงาน
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log('  PASS ', name);
  } else {
    fail++;
    console.log('  FAIL ', name, detail ? ' -> ' + detail : '');
  }
}

console.log('=== รอบ 59: ตรวจส่วนคำนวณปริมาณ -> แท็บงานดิน และการเชื่อมข้อมูลจากส่วนถอดแบบ ===');

// 1. ตรวจโครงสร้าง HTML ของ #quantityCalcPage และแท็บงานดิน
check('1a. index.html มีหน้า #quantityCalcPage', html.includes('id="quantityCalcPage"'));
check('1b. มีแท็บ "งานดิน" (#qty-calc-tab-earthwork)', html.includes('id="qty-calc-tab-earthwork"') && html.includes('งานดิน'));
check('1c. มีปุ่ม "ดึงค่าจากส่วนถอดแบบ" เรียก syncEarthworkFromTakeoff(true)', html.includes('syncEarthworkFromTakeoff(true)') && html.includes('ดึงค่าจากส่วนถอดแบบ'));
check('1d. มีส่วนที่ 3 (#sectionExternalData) อยู่ใน #quantityCalcPage', html.includes('id="sectionExternalData"'));
check('1e. มีกราฟรูปตัดตามยาว (#canvasLongProfile) และกราฟเปรียบเทียบ 2 หน้าตัด (#canvasCompareStart / #canvasCompareEnd)',
  html.includes('id="canvasLongProfile"') && html.includes('id="canvasCompareStart"') && html.includes('id="canvasCompareEnd"'));
check('1f. มีตาราง BoQ (#boqTable, #boqTableBody, #boqTableFoot) และตารางเปรียบเทียบ (#cmpBreakdownBody)',
  html.includes('id="boqTable"') && html.includes('id="boqTableBody"') && html.includes('id="boqTableFoot"') && html.includes('id="cmpBreakdownBody"'));
check('1g. มี Modal รายการคำนวณ (#calcReportModal), พิมพ์ตาราง BoQ (#printableBoqTableModal), ตารางมาตรฐานคลอง (#canalDefaultsModal)',
  html.includes('id="calcReportModal"') && html.includes('id="printableBoqTableModal"') && html.includes('id="canalDefaultsModal"'));
check('1h. style.css มีสไตล์สำหรับ .quantity-calc-page และ .quantity-calc-earthwork-scroll',
  css.includes('.quantity-calc-page') && css.includes('.quantity-calc-earthwork-scroll'));
check('1i. แยกโค้ดแท็บงานดินเป็นไฟล์ย่อย js/tab-earthwork.js และโหลดใน index.html',
  fs.existsSync(path.join(ROOT, 'js/tab-earthwork.js')) && html.includes('src="js/tab-earthwork.js'));
check('1j. ปรับพื้นหลังแท็บงานดิน (#sectionExternalData, #boqTable, #canvasLongProfile) เป็นสีขาว (#ffffff) เหมือนเว็บหลัก',
  css.includes('#quantityCalcPage #sectionExternalData') && css.includes('background: #ffffff !important'));

// 2. โหลด JS ทั้ง 19 ไฟล์ในสภาพแวดล้อมจำลองเพื่อทดสอบการทำงานจริง
const elements = {};
function makeEl(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    style: { display: '' },
    dataset: {},
    className: '',
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._set.has(c)) { this._set.delete(c); return false; }
          this._set.add(c); return true;
        }
        if (force) this._set.add(c); else this._set.delete(c);
        return !!force;
      },
      contains(c) { return this._set.has(c); }
    },
    appendChild() {},
    removeChild() {},
    insertAdjacentHTML() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 300 }; },
    getContext() {
      return {
        clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        closePath() {}, stroke() {}, fill() {}, arc() {}, rect() {}, roundRect() {},
        fillText() {}, strokeText() {}, save() {}, restore() {}, translate() {}, scale() {},
        rotate() {}, setLineDash() {}, setTransform() {},
        measureText(t) { return { width: String(t || '').length * 6 }; },
        createLinearGradient() { return { addColorStop() {} }; }
      };
    }
  };
}

let lastClipboard = { text: '', msg: '' };
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
// หมายเหตุ: Node รุ่นใหม่ (>=21) มี navigator เป็น getter ที่ assign ตรง ๆ ไม่ได้
// ต้องใช้ Object.defineProperty เหมือนที่ smoke-test.js / probe-bugs.js ทำ
Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText(t) {
        lastClipboard.text = t;
        return Promise.resolve();
      }
    }
  },
  writable: true,
  configurable: true
});
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};
global.document = {
  body: makeEl('body'),
  getElementById(id) {
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  },
  querySelector(sel) {
    if (sel && sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return null;
  },
  querySelectorAll() { return []; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {}
};
global.Image = function() {};
global.requestAnimationFrame = fn => {};
global.alert = () => {};
global.confirm = () => true;

const jsFiles = [
  'js/state.js',
  'js/autosave.js',
  'js/table-core.js',
  'js/tab-project.js',
  'js/tab-ditch.js',
  'js/tab-dimension.js',
  'js/tab-ground.js',
  'js/tab-level.js',
  'js/tab-structure.js',
  'js/tab-attachment.js',
  'js/tab-type.js',
  'js/tab-earthwork.js',
  'js/tab-ai-result.js',
  'js/tab-validate.js',
  'js/tab-export-preview.js',
  'js/table-sync.js',
  'js/canvas-viewer.js',
  'js/io-manager.js',
  'js/ai-reader.js',
  'js/ai-credit.js'
];
let fullCode = '';
for (const f of jsFiles) {
  fullCode += '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^(let|const) /gm, 'var ');
}
eval(fullCode);

if (typeof initEarthworkSection3 === 'function') {
  initEarthworkSection3();
}

// 3. ทดสอบการสลับไปยังเมนู "ส่วนคำนวณปริมาณ" -> แท็บ "งานดิน"
const subBtnQuantity = makeEl('sub-btn-quantity');
switchSubMenu('quantity', subBtnQuantity);
check('2a. switchSubMenu("quantity") แสดงหน้า #quantityCalcPage (display === "flex")',
  document.getElementById('quantityCalcPage').style.display === 'flex');
check('2b. switchSubMenu("quantity") ซ่อน #centerContent และ #structureCalcPage',
  document.getElementById('centerContent').style.display === 'none' &&
  document.getElementById('structureCalcPage').style.display === 'none');
check('2c. แท็บ #qty-calc-tab-earthwork มีสถานะ active',
  document.getElementById('qty-calc-tab-earthwork').classList.contains('active'));

// 4. ทดสอบการดึงค่าจาก "ส่วนถอดแบบ" มาใส่ในแท็บ "งานดิน"
channels = [
  { id: 1, canal: '1L-2R', ditch: '01', remark: '' },
  { id: 2, canal: '1L-2R', ditch: '02', remark: '' }
];
ditchTypeDatabase = [
  { type: 'VU1', b: '0.35', h: '0.50', tw: '0.10', tf: '0.10', isDefault: true },
  { type: 'VU2', b: '0.40', h: '0.60', tw: '0.12', tf: '0.12', isDefault: true }
];
dimensionRows = [
  { channelId: 1, kmStart: 0, kmEnd: 100, q: 0.07, slope: 1000, b: 0.35, d: 0.50, type: 'VU1', tbl: 0.50, tbr: 0.50 },
  { channelId: 2, kmStart: 0, kmEnd: 50,  q: 0.12, slope: 1000, b: 0.40, d: 0.60, type: 'VU2', tbl: 0.60, tbr: 0.60 }
];
levelRowsData = [
  { channelId: 1, customKmStart: 0, customKmEnd: 50,  bl1: 215.50, tbl1: 216.00, bl2: 215.45, tbl2: 215.95, h: 0.20 },
  { channelId: 1, customKmStart: 50, customKmEnd: 100, bl1: 215.25, tbl1: 215.75, bl2: 215.20, tbl2: 215.70, h: 0 },
  { channelId: 2, customKmStart: 0, customKmEnd: 50,  bl1: 214.00, tbl1: 214.60, bl2: 213.95, tbl2: 214.55, h: 0 }
];
groundRowsData = [
  { channelId: 1, km: 0,   groundElevation: 215.70, isBoundary: true },
  { channelId: 1, km: 25,  groundElevation: 215.65, isBoundary: false },
  { channelId: 1, km: 50,  groundElevation: 215.60, isBoundary: false },
  { channelId: 1, km: 100, groundElevation: 215.40, isBoundary: true },
  { channelId: 2, km: 0,   groundElevation: 214.20, isBoundary: true },
  { channelId: 2, km: 50,  groundElevation: 214.10, isBoundary: true }
];

const syncedRows = syncEarthworkFromTakeoff(false);
check('3a. syncEarthworkFromTakeoff() สร้างแถวช่วง กม. ใน boqRows จากข้อมูลส่วนถอดแบบสำเร็จ',
  Array.isArray(syncedRows) && boqRows.length === 4,
  `boqRows.length = ${boqRows ? boqRows.length : 'null'}`);

const ditch01Rows = boqRows.filter(r => r.subCanalName === '01');
const ditch02Rows = boqRows.filter(r => r.subCanalName === '02');
check('3b. แบ่งช่วงคูส่งน้ำ 01 ตามจุดหักดินเดิมและช่วงระดับ (0->25, 25->50, 50->100) ได้ 3 ช่วง และคู 02 (0->50) ได้ 1 ช่วง',
  ditch01Rows.length === 3 && ditch02Rows.length === 1,
  `ditch01=${ditch01Rows.length}, ditch02=${ditch02Rows.length}`);

check('3c. ดึงมิติคูส่งน้ำ (Type, B, H, TBL, TBR) และความหนา (tw, tb) จาก Typeคูส่งน้ำถูกต้อง',
  ditch01Rows[0].type === 'VU1' && ditch01Rows[0].B === 0.35 && ditch01Rows[0].H === 0.50 &&
  ditch01Rows[0].TBL === 0.50 && ditch01Rows[0].TBR === 0.50 && ditch01Rows[0].tw === 0.10 && ditch01Rows[0].tb === 0.10 &&
  ditch02Rows[0].type === 'VU2' && ditch02Rows[0].B === 0.40 && ditch02Rows[0].H === 0.60 &&
  ditch02Rows[0].tw === 0.12 && ditch02Rows[0].tb === 0.12);

check('3d. ดึงระดับก้นคลอง (blStart, blEnd) และระดับหลังคลอง (tblStart, tblEnd) พร้อมลดระดับที่ กม. 0+050 (215.45 -> 215.25) ถูกต้อง',
  Math.abs(ditch01Rows[0].blStart - 215.50) < 1e-6 &&
  Math.abs(ditch01Rows[0].blEnd - 215.48) < 1e-2 &&
  Math.abs(ditch01Rows[1].blEnd - 215.45) < 1e-6 &&
  Math.abs(ditch01Rows[2].blStart - 215.25) < 1e-6 &&
  Math.abs(ditch01Rows[2].blEnd - 215.20) < 1e-6);

check('3e. ดึงค่าระดับดินเดิม (nglStart, nglEnd) และสร้างโปรไฟล์ savedNglProfilesByLine ครบทุกสาย',
  Math.abs(ditch01Rows[0].nglStart - 215.70) < 1e-6 &&
  Math.abs(ditch01Rows[0].nglEnd - 215.65) < 1e-6 &&
  Array.isArray(savedNglProfilesByLine) && savedNglProfilesByLine.length === 2 &&
  savedNglProfilesByLine[0].points.length === 4 && savedNglProfilesByLine[1].points.length === 2);

// 5. ตรวจสอบการคำนวณพิกัด 14 จุด และปริมาณงาน 8 หมวดหมู่ใน evaluateBoqRow()
const evaluated = boqRows.map(r => evaluateBoqRow(r));
check('4a. evaluateBoqRow() คำนวณครบทุกช่วงและมีพิกัดหน้าตัด 14 จุด (p1–p14)',
  evaluated.length === 4 && evaluated[0].secStart && evaluated[0].secStart.nodes &&
  evaluated[0].secStart.nodes.p1 && evaluated[0].secStart.nodes.p14);

const hasNaN = evaluated.some(ev =>
  isNaN(ev.L) ||
  Object.values(ev.calcByCat).some(c => isNaN(c.a1) || isNaN(c.a2) || isNaN(c.L) || isNaN(c.vol))
);
check('4b. พื้นที่หน้าตัด (A1, A2), ความยาวช่วง (L) และปริมาตรทั้ง 8 หมวดงาน ไม่มีค่า NaN และคำนวณปริมาตร > 0',
  !hasNaN && evaluated[0].L === 25 && evaluated[0].calcByCat.concrete.vol > 0 &&
  (evaluated[0].calcByCat.compacted.vol + evaluated[0].calcByCat.excavation.vol) > 0);

// 6. ทดสอบปุ่ม Copy เมื่ออยู่ในหน้าส่วนคำนวณปริมาณ -> งานดิน
document.getElementById('quantityCalcPage').style.display = 'flex';
lastClipboard = { text: '', msg: '' };
copyTableData();
check('5a. กดปุ่ม Copy ในหน้าส่วนคำนวณปริมาณ คัดลอกตาราง BoQ งานดินลง Clipboard สำเร็จ',
  lastClipboard.text.includes('1L-2R') && lastClipboard.text.includes('VU1'));

console.log(`\n=== สรุปผลรอบ 59: PASS = ${pass}, FAIL = ${fail} ===`);
if (fail > 0) process.exit(1);
