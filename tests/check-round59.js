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
global.navigator = {
  clipboard: {
    writeText(t) {
      lastClipboard.text = t;
      return Promise.resolve();
    }
  }
};
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
  'js/tab-qty-structure.js',
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


// 7. ตรวจสอบการปรับปรุงรอบ 60 (ตามรูปที่ 1–5)
check("6a. แถบหัวหน้า #quantityCalcPage มีชื่อโครงการ ที่อยู่ และระบบเชฟอัตโนมัติเหมือนส่วนถอดแบบ (ตามรูป 5)",
  html.includes("id=\"qtyTopToolbarBar\"") && html.includes("id=\"qtyHeaderProjectName\"") &&
  html.includes("id=\"qtyHeaderProjectLocation\"") && html.includes("id=\"qtyAutosaveStatusBox\""));

projectPlanData = { name: "งานปรับปรุงคลองซอย 10 RMC", location: "ต.บ้านเสด็จ อ.เมือง จ.ลำปาง", description: "" };
updateTopHeaderBanner();
check("6b. updateTopHeaderBanner() ซิงก์ชื่อโครงการและที่อยู่ไปยัง #qtyHeaderProjectName และ #qtyHeaderProjectLocation",
  document.getElementById("qtyHeaderProjectName").textContent === "งานปรับปรุงคลองซอย 10 RMC" &&
  document.getElementById("qtyHeaderProjectLocation").textContent.includes("ต.บ้านเสด็จ อ.เมือง จ.ลำปาง"));

check("6c. ส่วนหัวแท็บงานดินแยกแถวปุ่มข้อมูล (#earthworkDataActionsRow) และปุ่ม Undo / Redo เป็นภาษาอังกฤษ (ตามรูป 1)",
  html.includes("id=\"earthworkDataActionsRow\"") && html.includes("↩ Undo") && html.includes("↪ Redo"));

pushUndoSnapshot("ทดสอบแก้ไขแถวที่ 1");
boqRows[0].B = 0.99;
updateUndoRedoButtonsUI();
check("6d. ปุ่ม Undo แสดงชื่อภาษาอังกฤษ ↩ Undo (1) และย้อนการทำงานทีละ 1 ครั้งได้จริง",
  document.getElementById("btnUndoAction").innerHTML.includes("Undo (1)") &&
  (performWorkspaceUndo(), Math.abs(boqRows[0].B - 0.35) < 1e-6) &&
  document.getElementById("btnRedoAction").innerHTML.includes("Redo (1)"));
performWorkspaceRedo();
check("6e. ปุ่ม Redo ทำซ้ำการทำงานทีละ 1 ครั้งได้จริง",
  Math.abs(boqRows[0].B - 0.99) < 1e-6);
performWorkspaceUndo();

const ewJs = fs.readFileSync(path.join(ROOT, "js/tab-earthwork.js"), "utf8");
check("6f. กราฟรูปตัดและ Tooltip โปรไฟล์ตามยาวเปลี่ยนพื้นหลังสีดำเป็นสีอ่อนโปร่งแสง และความสูงรูปตัดกะทัดรัด 220px (ตามรูป 2)",
  (ewJs.includes("rgba(226, 232, 240, 0.28)") || ewJs.includes("rgba(203, 213, 225, 0.34)")) && ewJs.includes("rgba(255, 255, 255, 0.85)") &&
  ewJs.includes("rgba(255, 255, 255, 0.88)") && ewJs.includes("cmpStartH = 220;"));

const lineKey01 = makeCanalLineKey("1L-2R", "01");
toggleEarthworkCanalLineCollapse(lineKey01);
check("6g. ปุ่มย่อ/ขยายข้อมูลสายคูส่งน้ำเป็นสัญลักษณ์ +/- และย่อ/ขยายแถวของสายนั้นได้จริง (ตามรูป 3)",
  collapsedEarthworkCanalLines.has(lineKey01) &&
  document.getElementById("boqTableBody").innerHTML.includes(">+</button>"));
toggleEarthworkCanalLineCollapse(lineKey01);
check("6h. เมื่อขยายข้อมูลสายคูส่งน้ำ ปุ่มสัญลักษณ์แสดง - และปุ่มทั้งหมดใช้คลาสสีอ่อนโปร่งแสง .ew-soft-btn (ตามรูป 3 และ 4)",
  !collapsedEarthworkCanalLines.has(lineKey01) &&
  document.getElementById("boqTableBody").innerHTML.includes(">-</button>") &&
  css.includes(".ew-soft-btn"));


// 8. ตรวจสอบการปรับปรุงรอบ 61 (ตารางงานดิน + กลุ่มปุ่มแบ่ง กม.)
// 8a. ย้ายส่วนตาราง (#boqTableContainer) และกลุ่มปุ่มแบ่ง กม. (#btnSubdivideStations) มาไว้ด้านบน (ก่อน #canvasLongProfile)
const idxBoqTableInHtml = html.indexOf("id=\"boqTableContainer\"");
const idxSubdivideInHtml = html.indexOf("id=\"btnSubdivideStations\"");
const idxLongProfileInHtml = html.indexOf("id=\"canvasLongProfile\"");
check("7a. ย้ายส่วนตาราง BoQ และกลุ่มปุ่มแบ่ง กม. มาไว้ด้านบนสุดของแท็บงานดิน (อยู่เหนือกราฟโปรไฟล์ตามยาวและรูปตัด)",
  idxBoqTableInHtml > 0 && idxSubdivideInHtml > 0 && idxLongProfileInHtml > 0 &&
  idxBoqTableInHtml < idxLongProfileInHtml && idxSubdivideInHtml < idxLongProfileInHtml);

// 8b. มีดรอปลิสต์เลือกแสดงเฉพาะสาย และทั้งหมด (#selectEarthworkCanalLineFilter) อยู่เหนือตาราง
const idxFilterSelectInHtml = html.indexOf("id=\"selectEarthworkCanalLineFilter\"");
check("7b. มีดรอปลิสต์เลือกแสดงเฉพาะสายและทั้งหมด (#selectEarthworkCanalLineFilter) อยู่เหนือตาราง BoQ",
  idxFilterSelectInHtml > 0 && idxFilterSelectInHtml < idxBoqTableInHtml &&
  document.getElementById("selectEarthworkCanalLineFilter").innerHTML.includes("แสดงทั้งหมดทุกสาย"));

// 8c. ปุ่มย่อ/ขยาย (+/-) แต่ละสายทำงานจริง และคงสถานะซ่อนแถว (ew-row-hidden / display: none !important) แม้หลัง updateComparisonView()
renderBoqTable();
toggleEarthworkCanalLineCollapse(lineKey01);
const tbodyHtmlCollapsed = document.getElementById("boqTableBody").innerHTML;
check("7c. ปุ่มย่อ/ขยาย (+/-) ของแต่ละสายซ่อนแถวของสายนั้นจริง (มี ew-row-hidden และ display: none !important)",
  collapsedEarthworkCanalLines.has(lineKey01) &&
  tbodyHtmlCollapsed.includes("data-row-tr=\"0\"") &&
  tbodyHtmlCollapsed.includes("ew-row-hidden"));
toggleEarthworkCanalLineCollapse(lineKey01);

// 8d. ทดสอบการกรองเฉพาะสายด้วยดรอปลิสต์ #selectEarthworkCanalLineFilter
const lineKey02 = makeCanalLineKey("1L-2R", "02");
onEarthworkCanalLineFilterChange(lineKey02);
const tbodyHtmlFiltered = document.getElementById("boqTableBody").innerHTML;
check("7d. ดรอปลิสต์เลือกแสดงเฉพาะสาย กรองแสดงเฉพาะสายที่เลือก (ซ่อนสายอื่นด้วย ew-row-hidden) และกลับมาแสดงทั้งหมดได้",
  selectedEarthworkCanalFilter === lineKey02 &&
  tbodyHtmlFiltered.split(`tr data-row-tr="0"`)[1].split(">")[0].includes("ew-row-hidden") &&
  !tbodyHtmlFiltered.split(`tr data-row-tr="3"`)[1].split(">")[0].includes("ew-row-hidden"));
onEarthworkCanalLineFilterChange("ALL");

// 8e. ลำดับ (คอลัมน์แรก) เรียงลำดับ 1, 2, 3... แยกตามแต่ละสาย
const tbodyHtmlAll = document.getElementById("boqTableBody").innerHTML;
const row3Match = tbodyHtmlAll.match(/<tr data-row-tr="3"[\s\S]*?<td[^>]*>(\d+)<\/td>/);
check("7e. คอลัมน์ลำดับ (#) เริ่มนับ 1 ใหม่ในแต่ละสายคูส่งน้ำ (แถวแรกของสายที่ 2 แสดงลำดับ 1 ไม่ใช่ 4)",
  row3Match && row3Match[1] === "1",
  row3Match ? `got ${row3Match[1]}` : "row 3 not found");

// 8f. ทุกช่องสถานะล็อก (readonly) และแถวจากส่วนถอดแบบไม่มีปุ่มลบ
check("7f. ทุกช่องในแถวที่ได้จากส่วนถอดแบบมีสถานะล็อก (readonly) และไม่มีปุ่มลบแถว",
  !tbodyHtmlAll.includes("ew-cell-editable") &&
  !tbodyHtmlAll.includes("deleteEarthworkUserRow("));

// 8g. คอลัมน์ เพิ่มแถว อยู่หน้าคอลัมน์ ลบแถว, แถวสุดท้ายของแต่ละสายไม่มีปุ่มเพิ่มแถว, กดเพิ่มแถวแล้วแก้ไขได้เฉพาะ กม.สิ้นสุด
const headHtmlNow = document.getElementById("boqTableHead").innerHTML;
const idxAddCol = headHtmlNow.indexOf("เพิ่มแถว");
const idxDelCol = headHtmlNow.indexOf("ลบแถว");
check("7g. มีคอลัมน์ เพิ่มแถว อยู่หน้าคอลัมน์ ลบแถว และแถวสุดท้ายของแต่ละสายไม่มีปุ่มเพิ่มแถว",
  idxAddCol > 0 && idxDelCol > idxAddCol &&
  tbodyHtmlAll.includes("addEarthworkRowBelow(0)") &&
  tbodyHtmlAll.includes("addEarthworkRowBelow(1)") &&
  !tbodyHtmlAll.includes("addEarthworkRowBelow(2)") &&
  !tbodyHtmlAll.includes("addEarthworkRowBelow(3)"));

// ทดสอบกดเพิ่มแถวใต้แถวที่ 0 (0+000 -> 0+025)
addEarthworkRowBelow(0);
const addedRow = boqRows[1];
const tbodyAfterAdd = document.getElementById("boqTableBody").innerHTML;
check("7h. กดปุ่ม + เพิ่มแถวใต้แถวนั้นสำเร็จ แถวที่เพิ่มมี isUserAdded=true, มีปุ่มลบเฉพาะแถวที่เพิ่ม และแก้ไขได้เฉพาะช่อง กม.สิ้นสุด (staEnd)",
  boqRows.length === 5 &&
  addedRow && addedRow.isUserAdded === true &&
  tbodyAfterAdd.includes("ew-cell-editable") &&
  tbodyAfterAdd.includes("deleteEarthworkUserRow(1)") &&
  !tbodyAfterAdd.includes("deleteEarthworkUserRow(0)"));

// ทดสอบแก้ไข กม.สิ้นสุด ของแถวที่เพิ่มมา (จาก 0+038 เป็น 0+035)
updateEarthworkUserRowStaEnd(1, "0+035");
check("7i. แก้ไข กม.สิ้นสุด ของแถวที่เพิ่มมา อัปเดต staEnd และปรับ staStart ของแถวถัดไปในสายเดียวกันให้ต่อเนื่องอัตโนมัติ",
  Math.abs(boqRows[1].staEnd - 35) < 1e-6 &&
  Math.abs(boqRows[2].staStart - 35) < 1e-6);

// ทดสอบลบแถวที่ผู้ใช้เพิ่มมา
deleteEarthworkUserRow(1);
check("7j. ลบแถวที่ผู้ใช้เพิ่มมาได้ และเชื่อม กม. ของแถวก่อนหน้ากลับเข้ากับแถวถัดไปอย่างถูกต้อง",
  boqRows.length === 4 &&
  Math.abs(boqRows[0].staStart - 0) < 1e-6 &&
  Math.abs(boqRows[0].staEnd - 25) < 1e-6);

// 8h. ทดสอบการทำงานของกลุ่มปุ่มแบ่ง กม. (แบ่ง กม. ทุกๆ X เมตร, แสดง/ซ่อน, ลบ กม. ที่แบ่ง, แบ่ง กม. พื้นที่เป็น 0)
document.getElementById("inputSubdivideStep").value = "10";
if (typeof elements["btnSubdivideStations"]?._click === "function") {
  elements["btnSubdivideStations"]._click();
}
check("7k. กลุ่มปุ่มแบ่ง กม. ทำงานได้ครบถ้วนโดยไม่เกิด Error (rebuildVisibleBoqRowsFromMaster และ handleSplitZeroTransitionByCategory ทำงานปกติ)",
  typeof rebuildVisibleBoqRowsFromMaster === "function" &&
  typeof handleSplitZeroTransitionByCategory === "function" &&
  typeof toggleShowHideStationCategory === "function" &&
  typeof removeStationsByOriginTag === "function" &&
  (rebuildVisibleBoqRowsFromMaster(), handleSplitZeroTransitionByCategory("excavation"), true));


// 9. ตรวจสอบการปรับปรุงรอบ 62 (แบ่งเป็น 3 ส่วน, เส้นแบ่งส่วน, รูปที่ 1–3, แบบจำลองรูปตัดขวางงานดินส่วนที่ 3)
const idxPart1 = html.indexOf('id="sectionExternalData"');
const idxDiv12 = html.indexOf('id="ewDividerPart1To2"');
const idxPart2 = html.indexOf('id="sectionEarthworkPart2"');
const idxActiveRowBar = html.indexOf('id="ewPart2ActiveRowBar"');
const idxLongCanvas = html.indexOf('id="canvasLongProfile"');
const idxDiv23 = html.indexOf('id="ewDividerPart2To3"');
const idxPart3 = html.indexOf('id="sectionCrossSection"');
const idxPart3Canvas = html.indexOf('id="ewCrossSectionCanvas"');

check("8a. แบ่งแท็บงานดินเป็น 3 ส่วนตามลำดับ (ส่วนที่ 1 ตารางคำนวณ -> ส่วนที่ 2 กราฟโปรไฟล์และรูปตัดขวาง -> ส่วนที่ 3 แบบจำลองรูปตัดขวางงานดิน) พร้อมเส้นแบ่งส่วน (.ew-section-divider)",
  idxPart1 > 0 && idxDiv12 > idxPart1 && idxPart2 > idxDiv12 && idxDiv23 > idxPart2 && idxPart3 > idxDiv23 && idxPart3Canvas > idxPart3);

check("8b. ตามรูปที่ 1: ย้ายแถบข้อมูลแถวที่เลือก (#ewPart2ActiveRowBar: #cmpRowBadge, #cmpCanalTitle, #cmpStructSummary, ปุ่มก่อนหน้า/ถัดไป/แสดงรายการคำนวณ) ไปอยู่ใต้หัวข้อส่วนที่ 2 เหนือกราฟโปรไฟล์ตามยาว",
  idxActiveRowBar > idxPart2 && idxActiveRowBar < idxLongCanvas);

check("8c. ตามรูปที่ 2 ข้อ 1: พื้นที่แสดง 2 รูปตัดและตารางขวามือในส่วนที่ 2 ใช้คลาส .ew-compare-equal-grid / items-stretch ให้ขอบล่างเท่ากัน",
  html.includes("ew-compare-equal-grid") && css.includes(".ew-compare-equal-grid"));

// ทดสอบตามรูปที่ 2 ข้อ 2: ปุ่ม #btnLoadStartToMain / #btnLoadEndToMain ส่งข้อมูลไปแสดงในส่วนที่ 3 (#sectionCrossSection)
boqRows[0].B = 0.60;
boqRows[0].H = 0.70;
boqRows[0].blStart = 215.50;
boqRows[0].nglStart = 215.70;
boqRows[0].blEnd = 215.40;
boqRows[0].nglEnd = 215.10;
selectedRowIndex = 0;
loadSelectedRowStationToMain('start');
check("8d. ตามรูปที่ 2 ข้อ 2: กดปุ่มส่งข้อมูลรูปที่ 1 (กม.เริ่มต้น) ไปแสดงในส่วนที่ 3 (#sectionCrossSection) อัปเดต B, H, BL., NGL และตารางพื้นที่ส่วนที่ 3 ถูกต้อง",
  Math.abs(paramB - 0.60) < 1e-6 &&
  Math.abs(paramH - 0.70) < 1e-6 &&
  Math.abs(paramInvert - 215.50) < 1e-6 &&
  Math.abs(ngl - 215.70) < 1e-6 &&
  document.getElementById("mainStationText").innerText.includes("0+000") &&
  parseFloat(document.getElementById("valAreaConcrete").innerText) > 0);

loadSelectedRowStationToMain('end');
check("8e. ตามรูปที่ 2 ข้อ 2: กดปุ่มส่งข้อมูลรูปที่ 2 (กม.สิ้นสุด) ไปแสดงในส่วนที่ 3 อัปเดต BL. และ NGL ของ กม.สิ้นสุด ถูกต้อง",
  Math.abs(paramInvert - 215.40) < 1e-6 &&
  Math.abs(ngl - 215.10) < 1e-6);

check("8f. ตามรูปที่ 3 ข้อ 1: ย้ายแท็บงานดินขึ้นด้านบน (#quantityCalcTopTabsArea) และซ่อนแถบข้างซ้ายเดิม (#quantityCalcSidebar)",
  html.includes('id="quantityCalcTopTabsArea"') &&
  html.indexOf('id="quantityCalcTopTabsArea"') < idxPart1 &&
  html.includes('id="quantityCalcSidebar" style="display: none !important;"'));

// ทดสอบตามรูปที่ 3 ข้อ 2: แจ้งเตือนทำเป็นหน้าต่างแจ้งเตือน (#fileStatusModal) แทนแถบแจ้งเตือนเดิม
closeFileStatusModal();
showBanner("ทดสอบหน้าต่างแจ้งเตือนสถานะ", "emerald");
check("8g. ตามรูปที่ 3 ข้อ 2: showBanner() แสดงผลเป็นหน้าต่างแจ้งเตือน (#fileStatusModal) และปิดหน้าต่างได้ด้วย closeFileStatusModal()",
  !document.getElementById("fileStatusModal").classList.contains("hidden") &&
  document.getElementById("fileStatusText").innerText === "ทดสอบหน้าต่างแจ้งเตือนสถานะ" &&
  (closeFileStatusModal(), document.getElementById("fileStatusModal").classList.contains("hidden")));

// ทดสอบตามรูปที่ 3 ข้อ 3: ลบรายการที่กากบาทสีแดงออก (ไม่มี btnHeaderColEye ในหัวคอลัมน์ลำดับ, ไม่มีข้อความหัวข้อซ้ายมือหน้าดรอปลิสต์)
const headAfterR62 = document.getElementById("boqTableHead").innerHTML;
check("8h. ตามรูปที่ 3 ข้อ 3: หัวคอลัมน์ลำดับไม่มีปุ่มดวงตา (#btnHeaderColEye) และหัวข้อส่วนที่ 1 เปลี่ยนเป็น 'ส่วนที่ 1'",
  !headAfterR62.includes("btnHeaderColEye") &&
  html.includes('<span class="ew-badge ew-badge-emerald">ส่วนที่ 1</span>') &&
  !html.includes("ส่วนที่ 3 • ตาราง BoQ & เปรียบเทียบรูปตัด") &&
  !html.includes("<span>ตารางข้อมูล พิกัดจุด 14 จุด และผลการคำนวณปริมาณงาน</span>"));


// 10. ตรวจสอบการปรับปรุงรอบ 63 (Version 1.0007 — ตามรูปที่ 1–4)
const idxFilterInActions = html.indexOf("id=\"selectEarthworkCanalLineFilter\"");
const idxUndoBtn = html.indexOf("id=\"btnUndoAction\"");
const idxRedoBtn = html.indexOf("id=\"btnRedoAction\"");
const idxPullBtn = html.indexOf("id=\"btnPullFromTakeoffSec3\"");
const idxDownloadTplBtn = html.indexOf("id=\"btnDownloadTemplate\"");
const idxCopyBoqBtn = html.indexOf("id=\"btnSyncEarthworkFromTakeoffTop\"");
const idxCanalDefaultsBtn = html.indexOf("id=\"btnOpenCanalDefaultsModal\"");
const idxPrintableModalBtn = html.indexOf("id=\"btnShowPrintableTableModal\"");

check("9a. ส่วนที่ 1 (รูป 1 ข้อ 1, 3, 4): ดรอปลิสต์เลือกสายอยู่ซ้ายสุดของแถวปุ่ม, ปุ่ม Undo/Redo อยู่หน้าปุ่มดึงค่าจากส่วนถอดแบบ, และปุ่มค่าเริ่มต้นคูส่งน้ำ/แสดงข้อมูลตารางอยู่ต่อท้ายปุ่ม Copy ตาราง",
  idxFilterInActions > 0 && idxUndoBtn > idxFilterInActions && idxRedoBtn > idxUndoBtn &&
  idxPullBtn > idxRedoBtn && idxCopyBoqBtn > idxDownloadTplBtn &&
  idxCanalDefaultsBtn > idxCopyBoqBtn && idxPrintableModalBtn > idxCanalDefaultsBtn);

check("9b. ส่วนที่ 1 (รูป 1 ข้อ 2, 5): ซ่อนปุ่มอัปโหลดไฟล์ Excel, เปลี่ยนชื่อปุ่มเป็น ตัวอย่าง Excel, และปุ่มรีเฟรช #btnRefreshBoqTableData อยู่ชิดขวา (ml-auto)",
  html.includes("id=\"btnUploadExcel\"") && !html.slice(html.indexOf("id=\"earthworkDataActionsRow\""), html.indexOf("aria-hidden=\"true\"")).includes("id=\"btnUploadExcel\"") &&
  html.includes("<span>📥 ตัวอย่าง Excel</span>") &&
  html.includes("id=\"btnRefreshBoqTableData\"") &&
  html.includes("ml-auto shrink-0"));

const idxPart2Select = html.indexOf("id=\"selectPart2CanalLine\"");
const idxBtnPrevRow = html.indexOf("id=\"btnPrevRow\"");
const idxBtnNextRow = html.indexOf("id=\"btnNextRow\"");
const idxCmpRowBadge = html.indexOf("id=\"cmpRowBadge\"");
const idxCmpCanalTitle = html.indexOf("id=\"cmpCanalTitle\"");
const idxCmpStructSummary = html.indexOf("id=\"cmpStructSummary\"");

check("9c. ส่วนที่ 2 (รูป 2 ข้อ 1, 2, 3): มีดรอปลิสต์เลือกคูส่งน้ำ (#selectPart2CanalLine) ตามด้วยปุ่ม ก่อนหน้า/ถัดไป และข้อความคลอง/คู/กม. ต่อด้วย TYPE/B/H ในแถวเดียวกัน",
  idxPart2Select > idxActiveRowBar && idxBtnPrevRow > idxPart2Select && idxBtnNextRow > idxBtnPrevRow &&
  idxCmpRowBadge > idxBtnNextRow && idxCmpCanalTitle > idxCmpRowBadge && idxCmpStructSummary > idxCmpCanalTitle);

onPart2CanalLineSelectChange(lineKey02);
check("9d. ส่วนที่ 2: การเปลี่ยนดรอปลิสต์ #selectPart2CanalLine ซิงก์กับ #selectEarthworkCanalLineFilter และอัปเดตข้อความคลอง/คู/กม. ใน #cmpCanalTitle",
  selectedEarthworkCanalFilter === lineKey02 &&
  document.getElementById("selectEarthworkCanalLineFilter").value === lineKey02 &&
  document.getElementById("cmpCanalTitle").innerText.includes("คลอง:") &&
  document.getElementById("cmpCanalTitle").innerText.includes("กม."));
onPart2CanalLineSelectChange("ALL");

updateZeroSplitCountBadges();
check("9e. ส่วนที่ 3 (รูป 3 ข้อ 1, 2, 3): ปุ่มย่อ/ขยายส่วนที่ 3 (#btnToggleCrossSectionCollapse) ไม่ถูกเขียนทับเป็นข้อความยาว, มีสไตล์สไลเดอร์แนวดิ่ง (.ew-ngl-visual-track), และแถบขนาดโครงสร้างด้านขวา (.ew-part3-right-sidebar) กะทัดรัดชิดขอบบน",
  !ewJs.includes("ย่อ / ขยายส่วนที่ 1") &&
  css.includes(".ew-ngl-visual-track") &&
  css.includes(".ew-part3-right-sidebar") &&
  css.includes(".ew-part3-param-list"));

check("9f. รูป 4: ปรับสีในรูปตัด (renderCalcDiagramWhiteBg และ renderSectionToCanvas) เป็นสีอ่อนพาสเทล ไม่มีสีพื้นดำ #0f172a / #1e293b ในรูปตัด",
  ewJs.includes("rgba(241, 245, 249, 0.55)") &&
  ewJs.includes("rgba(186, 230, 253, 0.38)") &&
  !ewJs.includes("fillPoly(sec.polys.fullEarthPoly, '#0f172a'") &&
  !ewJs.includes("fillPoly(sec.polys.concretePts, '#1e293b'"));


// 11. ตรวจสอบการปรับปรุงรอบ 64 (Version 1.0008 — ตามรูปที่ 1–2)
check("10a. ส่วนที่ 3 (รูป 1 ข้อ 1): ปรับขนาดตัวอักษรหัวแถบสไลเดอร์แนวดิ่ง (.ew-ngl-panel-title, .ew-ngl-val-badge) ให้กะทัดรัด",
  css.includes(".ew-ngl-panel-title") && css.includes(".ew-ngl-val-badge"));

check("10b. ส่วนที่ 3 (รูป 1 ข้อ 2): ช่องกรอกขนาดโครงสร้างแยกเป็นอีกแถว (.ew-part3-param-input-row) ตามด้วยหน่วย 'เมตร' (.ew-part3-param-unit)",
  html.includes("class=\"ew-part3-param-input-row\"") &&
  html.includes("<span class=\"ew-part3-param-unit\">เมตร</span>") &&
  css.includes(".ew-part3-param-input-row") &&
  css.includes(".ew-part3-param-unit"));

check("10c. ส่วนที่ 3 (รูป 1 ข้อ 3): ลดความลึกส่วนที่ 3 (.ew-part3-canvas-viewport, cssHeight = 310) ให้แสดงได้เต็ม 1 หน้า",
  html.includes("ew-part3-canvas-viewport") &&
  css.includes("#quantityCalcPage #crossSectionViewport.ew-part3-canvas-viewport") &&
  (ewJs.includes("cssHeight = 310;") || ewJs.includes("Math.max(380, Math.floor(rect.height || 380))")));

// ทดสอบตามรูป 2: หน้าต่างแจ้งเตือนเป็นหน้าต่างเล็ก (.ew-status-modal-card, max-width: 360px) และปุ่ม Undo/Redo ไม่แสดงหน้าต่างแจ้งเตือน
closeFileStatusModal();
pushUndoSnapshot("ทดสอบ Undo ไม่แจ้งเตือน");
boqRows[0].B = 0.88;
performWorkspaceUndo();
const modalHiddenAfterUndo = document.getElementById("fileStatusModal").classList.contains("hidden");
performWorkspaceRedo();
const modalHiddenAfterRedo = document.getElementById("fileStatusModal").classList.contains("hidden");
performWorkspaceUndo();
check("10d. รูป 2: หน้าต่างแจ้งเตือนปรับเป็นหน้าต่างเล็ก (.ew-status-modal-card, max-width: 360px) และปุ่ม Undo / Redo ไม่เด้งหน้าต่างแจ้งเตือน",
  html.includes("ew-status-modal-card") &&
  css.includes("max-width: 360px !important") &&
  modalHiddenAfterUndo && modalHiddenAfterRedo);


// 12. ตรวจสอบการปรับปรุงรอบ 65 (Version 1.0009 — ตามรูปข้อ 1–5)
check("11a. ข้อ 1: เพิ่มความสูงกรอบส่วนที่ 3 (#sectionCrossSection) ให้สูงเต็มหน้าจอเท่ากับขอบบน (min-height: calc(100vh - 108px))",
  css.includes("#quantityCalcPage #sectionCrossSection.ew-part3-compact-section") &&
  css.includes("min-height: calc(100vh - 108px) !important"));

check("11b. ข้อ 2: ให้กรอบ เลือกกรณีทดสอบ ชิดขอบล่างของกรอบซ้าย (justify-content: space-between และ margin-top: auto)",
  css.includes("#quantityCalcPage #sectionCrossSection aside:first-child > div:last-child") &&
  css.includes("margin-top: auto !important"));

check("11c. ข้อ 3: เพิ่มกรอบรูป (#crossSectionViewport และ #ewCrossSectionCanvas) ให้ยืดลงมาติดกรอบปุ่มด้านล่าง (flex: 1 1 auto, min-height: 380px)",
  css.includes("min-height: 380px !important") &&
  ewJs.includes("cssHeight = Math.max(380, Math.floor(rect.height || 380));") &&
  ewJs.includes("ewCanvas.style.height = '100%';"));

check("11d. ข้อ 4: เพิ่มขอบล่างของแถบสไลเดอร์แนวดิ่ง (.ew-ngl-vertical-panel) มาชิดขอบล่าง (max-height: none, align-self: stretch)",
  css.includes("#quantityCalcPage .ew-ngl-vertical-panel") &&
  css.includes("max-height: none !important") &&
  css.includes("align-self: stretch !important"));

check("11e. ข้อ 5: ลดความกว้างแท็บขวา (.ew-part3-right-sidebar) ให้เท่ากับปุ่ม แสดงรายการคำนวณ (#btnShowCalcSheet = 146px)",
  css.includes("#quantityCalcPage #btnShowCalcSheet") &&
  css.includes("width: 146px !important") &&
  css.includes("max-width: 146px !important"));


// 13. ตรวจสอบการปรับปรุงรอบ 66 (Version 1.0010 — ตัดคำว่า "สายคูส่งน้ำที่" ในดรอปลิสต์และลดความกว้างลง)
check("12a. ดรอปลิสต์ #selectEarthworkCanalLineFilter และ #selectPart2CanalLine ตัดคำว่า 'สายคูส่งน้ำที่' ออก และลดความกว้างด้วย max-width ใน .ew-canal-filter-select",
  !document.getElementById("selectEarthworkCanalLineFilter").innerHTML.includes("สายคูส่งน้ำที่") &&
  document.getElementById("selectEarthworkCanalLineFilter").innerHTML.includes("1: คลอง 1L-2R • คู 01") &&
  css.includes("max-width: 225px"));


// 14. ตรวจสอบการปรับปรุงรอบ 67 (Version 1.0011 — ย้ายปุ่มค่าเริ่มต้นไปชิดขอบล่าง และช่องกรอกลดให้ชิดกัน ไม่กระจายเต็ม)
const idxInputTopsoil = html.indexOf('id="inputTopsoil"');
const idxResetParamsBtn = html.indexOf('id="resetParamsBtn"');
check("13a. ย้ายปุ่ม ค่าเริ่มต้น (#resetParamsBtn) ลงไปไว้ใน .ew-part3-right-footer ชิดขอบล่าง (margin-top: auto) และช่องกรอก .ew-part3-param-list เรียงชิดกันด้านบน (justify-content: flex-start, flex: 0 0 auto)",
  idxResetParamsBtn > idxInputTopsoil &&
  html.includes('class="ew-part3-right-footer"') &&
  css.includes("#quantityCalcPage .ew-part3-right-footer") &&
  css.includes("margin-top: auto !important") &&
  css.includes("flex: 0 0 auto !important"));


// 15. ตรวจสอบการปรับปรุงรอบ 68 (Version 1.0012 — ตามรูปข้อ 1–2: เพิ่มปุ่มย่อ/ขยายแถบซ้าย และแก้ปัญหาปุ่มย่อเข้าด้านข้างแล้วหน้าต่างเดิมยังแสดงอยู่)
check("14a. ข้อ 1: เพิ่มปุ่มย่อ/ขยายแถบตารางแสดงค่าพื้นที่เข้าด้านข้างซ้าย (#leftSidebarExpanded, #btnCollapseLeftSidebar, #leftSidebarCollapsedStrip, #btnExpandLeftSidebar)",
  html.includes('id="leftSidebarExpanded"') &&
  html.includes('id="btnCollapseLeftSidebar"') &&
  html.includes('id="leftSidebarCollapsedStrip"') &&
  html.includes('id="btnExpandLeftSidebar"') &&
  typeof setLeftSidebarCollapsed === "function");

setLeftSidebarCollapsed(true);
const leftCollapsedOk = document.getElementById("leftSidebarExpanded").classList.contains("hidden") &&
  document.getElementById("leftSidebarExpanded").style.display === "none" &&
  !document.getElementById("leftSidebarCollapsedStrip").classList.contains("hidden") &&
  document.getElementById("leftSidebarCollapsedStrip").style.display === "flex";
setLeftSidebarCollapsed(false);
const leftExpandedOk = !document.getElementById("leftSidebarExpanded").classList.contains("hidden") &&
  document.getElementById("leftSidebarExpanded").style.display === "" &&
  document.getElementById("leftSidebarCollapsedStrip").classList.contains("hidden") &&
  document.getElementById("leftSidebarCollapsedStrip").style.display === "none";

setRightSidebarCollapsed(true);
const rightCollapsedOk = document.getElementById("rightSidebarExpanded").classList.contains("hidden") &&
  document.getElementById("rightSidebarExpanded").style.display === "none" &&
  !document.getElementById("rightSidebarCollapsedStrip").classList.contains("hidden") &&
  document.getElementById("rightSidebarCollapsedStrip").style.display === "flex";
setRightSidebarCollapsed(false);
const rightExpandedOk = !document.getElementById("rightSidebarExpanded").classList.contains("hidden") &&
  document.getElementById("rightSidebarExpanded").style.display === "" &&
  document.getElementById("rightSidebarCollapsedStrip").classList.contains("hidden") &&
  document.getElementById("rightSidebarCollapsedStrip").style.display === "none";

check("14b. ข้อ 2: กดปุ่มย่อเข้าด้านข้างแล้วซ่อนหน้าต่างเดิมได้จริงทั้งแถบซ้ายและแถบขวา (ทั้ง class hidden, style.display = 'none' และ CSS #rightSidebarExpanded.hidden { display: none !important })",
  leftCollapsedOk && leftExpandedOk && rightCollapsedOk && rightExpandedOk &&
  css.includes("#quantityCalcPage #rightSidebarExpanded.hidden") &&
  css.includes("#quantityCalcPage #leftSidebarExpanded.hidden"));


// 16. ตรวจสอบการปรับปรุงรอบ 69 (Version 1.0013 — เพิ่มแท็บ "งานอาคารประกอบ" ต่อจาก "งานดิน" และแยกไฟล์ js/tab-qty-structure.js)
const idxTabEarthwork = html.indexOf('id="qty-calc-tab-earthwork"');
const idxTabStructure = html.indexOf('id="qty-calc-tab-structure"');
check("15a. มีปุ่มแท็บ 'งานอาคารประกอบ' (#qty-calc-tab-structure) อยู่ต่อจากแท็บ 'งานดิน' (#qty-calc-tab-earthwork) และแยกไฟล์เป็น js/tab-qty-structure.js",
  idxTabEarthwork > 0 && idxTabStructure > idxTabEarthwork &&
  html.includes('🏗️ งานอาคารประกอบ') &&
  fs.existsSync(path.join(ROOT, 'js/tab-qty-structure.js')) &&
  html.includes('src="js/tab-qty-structure.js'));

// เตรียมข้อมูลทดสอบสำหรับงานอาคารประกอบ (มีอาคารประเภทเดียวกัน คูส่งน้ำเดียวกัน Type และขนาดเดียวกันหลายจุด กม. เพื่อตรวจการจัดกลุ่มรวมกัน)
structureRowsData = [
  { channelId: 1, isBoundary: true, isEndBoundary: false, km: 0,   name: 'อาคารท่อส่งน้ำเข้านา (เดิม)', hOverride: '', pipeDia: '0.30', pipeCount: '5.00', remark: '' },
  { channelId: 1, isBoundary: false, isFromLevel: true,   km: 25,  name: 'อาคารลดระดับ', hOverride: '0.20', pipeDia: '', pipeCount: '', remark: '' },
  { channelId: 1, isBoundary: false, isFromLevel: true,   km: 50,  name: 'อาคารลดระดับ', hOverride: '0.20', pipeDia: '', pipeCount: '', remark: '' },
  { channelId: 1, isBoundary: false, isFromLevel: false,  km: 75,  name: 'อาคารลดระดับ', hOverride: '0.30', pipeDia: '', pipeCount: '', remark: '' },
  { channelId: 1, isBoundary: true, isEndBoundary: true,  km: 100, name: 'ปลายคู', hOverride: '', pipeDia: '', pipeCount: '', remark: '' },
  { channelId: 2, isBoundary: true, isEndBoundary: false, km: 0,   name: 'อาคารท่อส่งน้ำเข้านา (เดิม)', hOverride: '', pipeDia: '0.30', pipeCount: '5.00', remark: '' },
  { channelId: 2, isBoundary: false, isFromLevel: true,   km: 25,  name: 'อาคารลดระดับ', hOverride: '0.20', pipeDia: '', pipeCount: '', remark: '' },
  { channelId: 2, isBoundary: true, isEndBoundary: true,  km: 50,  name: 'ปลายคู', hOverride: '', pipeDia: '', pipeCount: '', remark: '' }
];
attachmentRowsData = [
  { channelId: 1, km: 0, name: 'อาคารท่อรับน้ำเข้าแปลงไร่นา', h: '0.00', pipeDia: '0.20', length: '1.00', count: '4', remark: '' },
  { channelId: 2, km: 0, name: 'อาคารท่อรับน้ำเข้าแปลงไร่นา', h: '0.00', pipeDia: '0.20', length: '1.00', count: '3', remark: '' }
];

switchQuantityCalcTab('structure');
check("15b. สลับไปยังแท็บ 'งานอาคารประกอบ' (switchQuantityCalcTab('structure')) แสดง #quantityCalcStructureContainer และซ่อน #quantityCalcEarthworkContainer",
  quantityCalcActiveTab === 'structure' &&
  document.getElementById('qty-calc-tab-structure').classList.contains('active') &&
  !document.getElementById('qty-calc-tab-earthwork').classList.contains('active') &&
  document.getElementById('quantityCalcStructureContainer').style.display === 'flex' &&
  document.getElementById('quantityCalcEarthworkContainer').style.display === 'none');

const dropGroup = qtyStructureGroupedByDitch.find(g => g.structureType === 'อาคารลดระดับ');
const dropSameDitchSameSize = dropGroup ? dropGroup.rows.find(r => r.ditchName === '01' && r.h === '0.20') : null;
check("15c. สรุปเป็นแต่ละอาคาร โดยรวมแถวที่มี คูส่งน้ำ + Type + ขนาด เหมือนกันให้อยู่ด้วยกัน (เช่น อาคารลดระดับ คู 01 Type VU1 ขนาด H=0.20 ที่ กม. 0+025 และ 0+050 รวมเป็น 2 แห่งในแถวเดียว)",
  dropGroup && dropGroup.totalCount === 4 &&
  dropSameDitchSameSize && dropSameDitchSameSize.totalCount === 2 &&
  dropSameDitchSameSize.kmList.includes('0+025') && dropSameDitchSameSize.kmList.includes('0+050'));

const bodyByDitchHtml = document.getElementById('qtyStructByDitchTableBody').innerHTML;
const bodyAcrossHtml = document.getElementById('qtyStructAcrossDitchesTableBody').innerHTML;
check("15d. Render ตารางส่วนที่ 1 (#qtyStructByDitchTableBody) และตารางส่วนที่ 2 (#qtyStructAcrossDitchesTableBody) ครบถ้วน",
  bodyByDitchHtml.includes('อาคารลดระดับ') &&
  bodyByDitchHtml.includes('0+025, 0+050') &&
  bodyAcrossHtml.includes('อาคารท่อส่งน้ำเข้านา (เดิม)') &&
  bodyAcrossHtml.includes('อาคารท่อรับน้ำเข้าแปลงไร่นา'));

lastClipboard = { text: '', msg: '' };
copyTableData();
check("15e. กดปุ่ม Copy ขณะอยู่ที่แท็บ 'งานอาคารประกอบ' คัดลอกตารางสรุปงานอาคารประกอบลง Clipboard สำเร็จ",
  lastClipboard.text.includes('ประเภทอาคาร') &&
  lastClipboard.text.includes('อาคารลดระดับ') &&
  lastClipboard.text.includes('0+025, 0+050'));

// สลับกลับไปแท็บงานดินเพื่อคืนสถานะเริ่มต้น
switchQuantityCalcTab('earthwork');


// 16. ตรวจสอบการปรับปรุงรอบ 70 (Version 1.0014):
//   - เพิ่มสีเส้นแบ่ง ช่วงคูน้ำ ในตาราง (#boqTable)
//   - ตัวหนังสือ กม.เริ่มต้น (staStart) ที่แบ่ง กม. ตามปุ่ม 6 ปุ่ม เปลี่ยนสีตามปุ่ม
renderBoqTable();
const tbodyR70 = document.getElementById("boqTableBody").innerHTML;
check("16a. ในตาราง (#boqTable) มีคลาสเส้นแบ่งช่วงคูน้ำ (ew-section-divider-top / ew-new-section-row) และตัวแปรสี --ew-sec-color",
  tbodyR70.includes("ew-section-divider-top") &&
  tbodyR70.includes("ew-new-section-row") &&
  tbodyR70.includes("--ew-sec-color:") &&
  css.includes("tr.ew-section-divider-top td") &&
  css.includes("border-top: 2.5px solid var(--ew-sec-color"));

const stStep = getSingleStationVisualStyle({ staStartTags: ["step:25"], remark: "" }, true);
const stNgl = getSingleStationVisualStyle({ staStartTags: ["ngl"], remark: "" }, true);
const stZStrip = getSingleStationVisualStyle({ staStartTags: ["zero_stripping"], remark: "" }, true);
const stZComp = getSingleStationVisualStyle({ staStartTags: ["zero_compacted"], remark: "" }, true);
const stZExc = getSingleStationVisualStyle({ staStartTags: ["zero_excavation"], remark: "" }, true);
const stZMan = getSingleStationVisualStyle({ staStartTags: ["zero_manual"], remark: "" }, true);

check("16b. ตัวหนังสือ กม.เริ่มต้น (staStart) ที่แบ่งตามปุ่มทั้ง 6 ปุ่ม เปลี่ยนคลาสสีตรงตามปุ่มทั้ง 6 ปุ่มครบถ้วน",
  stStep.inputCls.includes("ew-sta-split-step") &&
  stNgl.inputCls.includes("ew-sta-split-ngl") &&
  stZStrip.inputCls.includes("ew-sta-split-zero-stripping") &&
  stZComp.inputCls.includes("ew-sta-split-zero-compacted") &&
  stZExc.inputCls.includes("ew-sta-split-zero-excavation") &&
  stZMan.inputCls.includes("ew-sta-split-zero-manual") &&
  tbodyR70.includes("ew-sta-split-ngl") &&
  css.includes(".ew-sta-split-step") &&
  css.includes(".ew-sta-split-ngl") &&
  css.includes(".ew-sta-split-zero-stripping") &&
  css.includes(".ew-sta-split-zero-compacted") &&
  css.includes(".ew-sta-split-zero-excavation") &&
  css.includes(".ew-sta-split-zero-manual"));

console.log(`\n=== สรุปผลรอบ 59-70: PASS = ${pass}, FAIL = ${fail} ===`);
if (fail > 0) process.exit(1);
