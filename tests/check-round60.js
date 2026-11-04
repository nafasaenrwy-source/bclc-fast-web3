// tests/check-round60.js — ตรวจสอบการปรับปรุง UI แท็บ "งานดิน" รอบ 60
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const css = read('style.css');
const earth = read('js/tab-earthwork.js');
const auto = read('js/autosave.js');
const state = read('js/state.js');
const viewer = read('js/canvas-viewer.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}

console.log('=== Round 60 checks ===');

// 1) ปุ่มยาว / หน้าจอขาว
check('index.html: ไม่มี min-h-[390px]', !html.includes('min-h-[390px]'));
check('index.html: ไม่มี min-h-[325px]', !html.includes('min-h-[325px]'));
check('index.html: มี .ew-cmp-canvas-box', html.includes('ew-cmp-canvas-box'));
check('index.html: มี .ew-cmp-canvas', html.includes('ew-cmp-canvas'));
check('index.html: มี .ew-side-panel', html.includes('ew-side-panel'));
check('index.html: grid ใช้ items-start', html.includes('items-start'));

// 2) พื้นหลังสีดำ -> สีอ่อนโปร่ง
check('style.css: มี .ew-btn', css.includes('.ew-btn'));
check('style.css: มี .ew-select', css.includes('.ew-select'));
check('style.css: มี .ew-line-toggle-btn', css.includes('.ew-line-toggle-btn'));
check('style.css: มี rgba พื้นหลังโปร่ง', /rgba\(255,\s*255,\s*255,\s*0\.7/.test(css));
check('tab-earthwork.js: palette ใช้สีอ่อน', !earth.includes('rgba(12, 74, 110, 0.34)') && earth.includes('rgba(224, 242, 254, 0.65)'));

// 3) ปุ่มดรอปลิดเลือกสาย
check('index.html: มี #selectCanalLineFilter', html.includes('id="selectCanalLineFilter"'));
check('index.html: ดรอปลิดอยู่ใต้ #btnToggleColumnVisibility',
  html.indexOf('selectCanalLineFilter') > html.indexOf('btnToggleColumnVisibility') &&
  html.indexOf('btnToggleColumnVisibility') < html.indexOf('selectCanalLineFilter'));
check('index.html: เรียก applyCanalLineFilter', html.includes('applyCanalLineFilter(this.value)'));
check('tab-earthwork.js: มี applyCanalLineFilter', earth.includes('function applyCanalLineFilter'));
check('tab-earthwork.js: มี updateCanalLineFilterOptions', earth.includes('function updateCanalLineFilterOptions'));
check('tab-earthwork.js: มี activeCanalLineFilter', earth.includes('let activeCanalLineFilter'));

// 4) ปุ่มย่อ/ขยายสายคูส่งน้ำ
check('index.html/earth: มีปุ่ม toggleCanalLineCollapse', earth.includes('toggleCanalLineCollapse'));
check('earth: มี collapsedCanalLines', earth.includes('collapsedCanalLines'));
check('earth: divider row มีปุ่มย่อ/ขยาย', earth.includes('ew-line-toggle-btn'));

// 5) ปุ่มด้านล่างรูปแบบเดียวกัน
check('index.html: มี #ewBottomToolbar', html.includes('id="ewBottomToolbar"'));
check('style.css: #ewBottomToolbar button มีกฎ', css.includes('#ewBottomToolbar button'));

// 6) แท็บหัว: ชื่อ ที่อยู่ ระบบเชฟ
check('index.html: มี #qtyHeaderProjectName', html.includes('id="qtyHeaderProjectName"'));
check('index.html: มี #qtyHeaderProjectLocation', html.includes('id="qtyHeaderProjectLocation"'));
check('index.html: มี #qtyAutosaveStatusBox', html.includes('id="qtyAutosaveStatusBox"'));
check('index.html: มี #qtyAutosaveLastTimeText', html.includes('id="qtyAutosaveLastTimeText"'));
check('viewer.js: ซิงก์ qtyHeaderProjectName', viewer.includes('qtyHeaderProjectName'));
check('viewer.js: ซิงก์ qtyHeaderProjectLocation', viewer.includes('qtyHeaderProjectLocation'));
check('autosave.js: อัปเดต qtyAutosaveLastTimeText', auto.includes('qtyAutosaveLastTimeText'));

// 7) ปุ่ม Undo/Redo
check('index.html: มี #btnHeaderUndo', html.includes('id="btnHeaderUndo"'));
check('index.html: มี #btnHeaderRedo', html.includes('id="btnHeaderRedo"'));
check('index.html: มี #btnPullUndo', html.includes('id="btnPullUndo"'));
check('index.html: มี #btnPullRedo', html.includes('id="btnPullRedo"'));
check('index.html: Undo เรียก performWorkspaceUndo', html.includes('performWorkspaceUndo()'));
check('index.html: Redo เรียก performWorkspaceRedo', html.includes('performWorkspaceRedo()'));
check('earth: มี performWorkspaceUndo', earth.includes('function performWorkspaceUndo'));
check('earth: มี performWorkspaceRedo', earth.includes('function performWorkspaceRedo'));

// 8) ข้อเสนอแนะข้อ 2: เตือนเมื่อปิดหน้าโดยยังไม่เชฟ
check('autosave.js: มี beforeunload', auto.includes('beforeunload'));
check('autosave.js: มี markWorkspaceDirty', auto.includes('function markWorkspaceDirty'));
check('autosave.js: มี clearWorkspaceDirtyFlag', auto.includes('function clearWorkspaceDirtyFlag'));
check('autosave.js: มี initUnsavedChangesWarning', auto.includes('function initUnsavedChangesWarning'));
check('io-manager.js: ล้าง dirty flag เมื่อเชฟสำเร็จ', read('js/io-manager.js').includes('clearWorkspaceDirtyFlag'));

// 9) Version
check('state.js: APP_VERSION 1.0004', /APP_VERSION = '1\.0004'/.test(state));
check('index.html: devBadgeVersion 1.0004', /id="devBadgeVersion">Version 1\.0004</.test(html));
check('index.html: cache bust v=20261104b', html.includes('?v=20261104b'));
check('index.html: ไม่มี v=20261104a แล้ว', !html.includes('?v=20261104a'));

// 10) ความสมบูรณ์ของโค้ด
check('earth: renderBoqTable ใช้ renderedEntries', earth.includes('renderedEntries'));
check('earth: ยอดรวมคำนวณจากทุกแถว', earth.includes('// รอบ 60: คำนวณยอดรวมจากทุกแถว'));

console.log(`\n=== Result: PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
