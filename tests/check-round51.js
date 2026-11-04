global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});
// ===== tests/check-round51.js =====
// ทดสอบรอบ 51:
//   ตรวจสอบปัญหา "เส้นดินเดิม ถูกเขียนขึ้นมาหลายสายในรูปเดียว"
//   เมื่อนำเข้าไฟล์ที่มีหลายสาย (เช่น คลองซอย10RMC_แม่วัง_7แท็บ.xlsx ทั้ง 37 สาย)
//   แล้วกำหนดจุด P1, P2 ที่คูสายแรก (สาย 02, channelId = 1)
//   ต้องวาดเส้นดินเดิมเฉพาะของคูสายแรกสายเดียวเท่านั้น (5 จุด) ห้ามนำ P1/P2 ของสายแรกไปวาดสายที่ 2..37 ซ้อนขึ้นมา

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

// โหลดไฟล์ Excel ตัวอย่าง (ค้นหาอัตโนมัติจาก Downloads / fixtures / env var)
const fixture = loadFixture();
if (!fixture || !fixture.sheets) {
  console.log('  FAIL: ไม่พบไฟล์ตัวอย่าง "คลองซอย10RMC_แม่วัง_7แท็บ.xlsx"');
  console.log('         ตั้งค่า env var BCLC_FIXTURE_XLSX ให้ชี้ไปยังไฟล์ .xlsx ที่ต้องการ');
  console.log(`\nสรุปผล check-round51: PASS = ${pass}, FAIL = ${fail}`);
  process.exit(1);
}
console.log('  (ไฟล์ตัวอย่าง: ' + fixture.path + ')');
const excelSheetsAOA = fixture.sheets;

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
      if (val !== '' && val !== null && val !== undefined) obj[h] = val;
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
        sheet[`${String.fromCharCode(65 + c)}${r + 1}`] = { v: row[c] };
      }
    }
  }
  return sheet;
}

let orangeStrokesCount = 0;
const mockCtx = {
  save() {},
  restore() {},
  clearRect() {},
  drawImage() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {
    if (this.strokeStyle === '#fd7e14') orangeStrokesCount++;
  },
  fill() {},
  arc() {},
  fillRect() {},
  strokeRect() {},
  setLineDash() {},
  translate() {},
  rotate() {},
  measureText(t) { return { width: String(t).length * 7 }; },
  fillText() {},
  setTransform() {},
  font: '11px Arial',
  fillStyle: '#000',
  strokeStyle: '#000',
  lineWidth: 1,
  textAlign: 'left',
  textBaseline: 'middle'
};

const canvasListeners = {};
const mockCanvas = {
  width: 1000,
  height: 600,
  offsetLeft: 0,
  offsetTop: 0,
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  getContext() { return mockCtx; },
  addEventListener(ev, fn) { canvasListeners[ev] = fn; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 600 }; }
};

const els = { canvas: mockCanvas };
function getEl(id) {
  if (!els[id]) {
    els[id] = {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      innerText: '',
      style: {},
      dataset: {},
      focus() {},
      getContext() { return mockCtx; },
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        toggle(c, f) {
          if (f === undefined) {
            if (this._s.has(c)) { this._s.delete(c); return false; }
            this._s.add(c); return true;
          }
          if (f) this._s.add(c); else this._s.delete(c);
          return !!f;
        },
        contains(c) { return this._s.has(c); }
      },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; }
    };
  }
  return els[id];
}

const sandbox = {
  console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Set, Map, Promise, Uint8Array,
  Blob: function (p) { this.parts = p; },
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => fn(), clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
  alert: () => {}, confirm: () => true,
  Image: function () { this.width = 1000; this.height = 600; this.complete = true; this.naturalWidth = 1000; },
  window: {
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {}
  },
  document: {
    getElementById: (id) => getEl(id),
    querySelector: () => getEl('qs_dummy'),
    querySelectorAll: () => [],
    createElement: (t) => (t === 'canvas' ? mockCanvas : getEl('el_' + Math.random())),
    body: { appendChild() {}, removeChild() {}, style: {} },
    addEventListener() {}
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  FileReader: function () {
    this.readAsArrayBuffer = function () {
      if (this.onload) this.onload({ target: { result: new ArrayBuffer(8) } });
    };
  },
  XLSX: {
    read: () => {
      const Sheets = {};
      Object.keys(excelSheetsAOA).forEach(k => { Sheets[k] = makeSheetFromAOA(excelSheetsAOA[k]); });
      return { Sheets, SheetNames: Object.keys(Sheets) };
    },
    utils: {
      sheet_to_json: (sheet, opts) => (opts && opts.header === 1) ? (sheet._aoa || []) : aoaToJsonObjects(sheet._aoa || []),
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 30, c: 15 } }),
      encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`,
      book_new: () => ({ Sheets: {}, SheetNames: [] }),
      aoa_to_sheet: (aoa) => makeSheetFromAOA(aoa),
      book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); }
    },
    write: () => new Uint8Array(8)
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

[
  'js/state.js',
  'js/tab-project.js',
  'js/table-core.js',
  'js/table-sync.js',
  'js/tab-ditch.js',
  'js/tab-dimension.js',
  'js/tab-ground.js',
  'js/tab-level.js',
  'js/tab-structure.js',
  'js/tab-attachment.js',
  'js/tab-type.js',
  'js/tab-earthwork.js',
  'js/io-manager.js',
  'js/canvas-viewer.js'
].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), sandbox, { filename: f });
});

console.log('=== ทดสอบรอบ 51: ป้องกันการวาดเส้นดินเดิมหลายสายซ้อนกันในรูปเดียว ===');

// 1. นำเข้าไฟล์ Excel 37 สาย
vm.runInContext(`
  img = { src: 'data:image/png;base64,xx', width: 1000, height: 600, complete: true, naturalWidth: 1000 };
  imgScale = 1.0;
  activeMediaViewTab = 'image';
  currentTab = 'ground';
`, sandbox);
sandbox.importAllFromExcel({ target: { files: [{ name: 'คลองซอย10RMC_แม่วัง_7แท็บ.xlsx' }], value: 'x' } });

check('R51.1 โหลดข้อมูลคูส่งน้ำครบ 37 สาย',
  vm.runInContext('channels.length', sandbox) === 37);

// 2. ปลดล็อกคูสายแรก (channelId = 1, คูส่งน้ำ 02) แล้วกดปุ่ม "กำหนด P1,P2" คลิกจุด P1 และ P2 บนภาพ
sandbox.toggleGroundGroupLock('ground_ch_1');
sandbox.selectChannelCalibPoint(1, 'p1');
orangeStrokesCount = 0;
canvasListeners.click({ button: 0, offsetX: 150, offsetY: 520 });
canvasListeners.click({ button: 0, offsetX: 540, offsetY: 120 });

const ptsAll = vm.runInContext('tableGroundLinePoints', sandbox);
const chanIdsInPts = [...new Set(ptsAll.map(p => p.channelId))];

check('R51.2 เมื่อกำหนด P1, P2 ที่คูสายแรก (สาย 02) มีเฉพาะจุดของสายแรกสายเดียวใน tableGroundLinePoints (5 จุด, ไม่มีสาย 2..37 ปน)',
  ptsAll.length === 5 && chanIdsInPts.length === 1 && chanIdsInPts[0] === 1,
  `pts=${ptsAll.length}, channels=${JSON.stringify(chanIdsInPts)}`);

check('R51.3 getChannelCalibParams ของสายที่ 2..37 คืนค่า null เพราะยังไม่ได้กำหนด P1, P2 ของสายเหล่านั้น',
  sandbox.getChannelCalibParams(2) === null && sandbox.getChannelCalibParams(37) === null);

orangeStrokesCount = 0;
sandbox.redraw();
check('R51.4 วาดเส้นดินเดิมสีส้ม (#fd7e14) บนแคนวาสเพียง 1 เส้น (ของสายแรกสายเดียว ไม่วาดซ้อน 37 สาย)',
  orangeStrokesCount === 1,
  `orangeStrokesCount=${orangeStrokesCount}`);

// 3. ทดสอบกรณีมีข้อมูลค้างใน tableGroundLinePoints ของสายอื่นที่ไม่มี p1Ref/p2Ref (เช่น ค้างจาก autosave เดิม)
vm.runInContext(`
  tableGroundLinePoints.push({ x: 200, y: 300, xData: 0, yData: 252, channelId: 2, gIdx: 5, isBoundary: true });
  tableGroundLinePoints.push({ x: 400, y: 350, xData: 100, yData: 251, channelId: 2, gIdx: 6, isBoundary: true });
`, sandbox);
orangeStrokesCount = 0;
sandbox.redraw();
const remainingChanIds = [...new Set(vm.runInContext('tableGroundLinePoints.map(p => p.channelId)', sandbox))];
check('R51.5 หากมีจุดของสายที่ยังไม่ได้ตั้ง p1Ref/p2Ref ค้างใน tableGroundLinePoints ระบบจะกรองออกอัตโนมัติเหลือเฉพาะสายที่ตั้ง P1/P2 แล้ว',
  remainingChanIds.length === 1 && remainingChanIds[0] === 1 && orangeStrokesCount === 1,
  `remaining=${JSON.stringify(remainingChanIds)}, strokes=${orangeStrokesCount}`);

console.log(`\nสรุปผล check-round51: PASS = ${pass}, FAIL = ${fail}`);
if (fail > 0) process.exit(1);
