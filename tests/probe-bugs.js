global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});
// ===== tests/probe-bugs.js =====
// สคริปต์ "ตรวจหาบั๊ก" ด้วยการรันโค้ดจริงของเว็บใน DOM จำลอง (ไม่แก้ไฟล์เว็บใด ๆ)
//   - DOM จำลองคล้าย tests/smoke-test.js แต่เพิ่ม canvas/Image/XLSX ที่ใกล้ของจริงกว่า
//   - XLSX จำลองมี read() + sheet_to_json() ที่อ่านหัวตารางเป็น key เหมือนไลบรารีจริง
//     (ของเดิมใน smoke-test ไม่มี XLSX.read → ทาง import ล้มเหลวเงียบ ๆ)
// รัน: node tests\probe-bugs.js
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');

let capturedHtml = '';
let capturedSheets = [];
let lastWorkbook = null;
let lastFileRead = null;
const mockElements = {};

// ================= DOM จำลอง =================
function makeCtx() {
  const noop = () => {};
  return {
    setTransform: noop, clearRect: noop, beginPath: noop, arc: noop, fill: noop,
    moveTo: noop, lineTo: noop, stroke: noop, save: noop, restore: noop,
    setLineDash: noop, fillText: noop, rect: noop, closePath: noop, drawImage: noop,
    translate: noop, rotate: noop, scale: noop, clip: noop, strokeRect: noop, fillRect: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1
  };
}
function makeEl(id) {
  const el = {
    id: id, innerHTML: '', value: '', innerText: '', textContent: '',
    style: {}, readOnly: false, width: 0, height: 0,
    offsetWidth: 800, offsetHeight: 600, offsetLeft: 0, offsetTop: 0,
    clientWidth: 800, clientHeight: 600, scrollLeft: 0, scrollTop: 0,
    parentNode: null, children: [], type: 'text', tagName: 'INPUT',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); }
    },
    getAttribute() { return null; }, setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; },
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, dispatchEvent() {},
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { return c; },
    scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: this.clientWidth, height: this.clientHeight }; },
    click() {},
    toDataURL() { return 'data:image/png;base64,ROTATED-' + this.width + 'x' + this.height; },
    getContext() { if (!this.__ctx) this.__ctx = makeCtx(); return this.__ctx; }
  };
  return el;
}
function el(id) {
  if (!mockElements[id]) mockElements[id] = makeEl(id);
  return mockElements[id];
}

global.window = { addEventListener() {}, alert() {}, innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1 };
global.document = {
  getElementById(id) {
    const e = el(id);
    if (id === 'tableContainer' && !e.__hooked) {
      e.__hooked = true;
      let html = '';
      Object.defineProperty(e, 'innerHTML', {
        get() { return html; }, set(v) { html = String(v); capturedHtml = html; }, configurable: true
      });
    }
    return e;
  },
  querySelectorAll(sel) { return []; },
  querySelector() { return null; },
  createElement(tag) {
    if (tag === 'canvas') { const c = makeEl('canvas'); c.tagName = 'CANVAS'; return c; }
    const e = makeEl(tag); e.tagName = String(tag).toUpperCase(); return e;
  },
  body: makeEl('body'),
  addEventListener() {}, removeEventListener() {}
};
global.Image = class {
  constructor() {
    this._src = ''; this.width = 0; this.height = 0;
    this.naturalWidth = 0; this.naturalHeight = 0; this.complete = false; this.onload = null;
  }
  get src() { return this._src; }
  set src(v) {
    this._src = v; this.complete = false; this.naturalWidth = 0;
    const m = /ROTATED-(\d+)x(\d+)/.exec(String(v));   // ภาพที่เกิดจาก "หมุนภาพ" → รู้ขนาดจริงจาก canvas ต้นทาง
    setTimeout(() => {                       // เหมือนเบราว์เซอร์จริง: ถอดรหัสเสร็จแบบ async
      if (m) { this.width = parseInt(m[1], 10); this.height = parseInt(m[2], 10); }
      if (!this.width) this.width = 600;
      if (!this.height) this.height = 400;
      this.naturalWidth = this.width; this.naturalHeight = this.height;
      this.complete = true;
      if (typeof this.onload === 'function') this.onload();
    }, 0);
  }
};
global.FileReader = class {
  readAsText() { if (this.onload) this.onload({ target: { result: lastFileRead } }); }
  readAsArrayBuffer() { if (this.onload) this.onload({ target: { result: lastFileRead } }); }
};
global.Blob = class { constructor(a) { this.a = a; Blob.last = a; } };
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, writable: true, configurable: true });
global.uiPrompt = () => Promise.resolve(null);   // ให้ exportAllToExcel() เดินจนจบโดยไม่ต้องบันทึกไฟล์จริง
global.alert = () => {};
global.Event = class { constructor(t) { this.type = t; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };

// ================= XLSX จำลอง (อ่านหัวตารางเป็น key เหมือนของจริง) =================
function makeSheet(aoa) {
  const sheet = {};
  aoa.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === "" || v === null || v === undefined) return;
      const addr = String.fromCharCode(65 + c) + (r + 1);
      sheet[addr] = { v: v, t: typeof v === 'number' ? 'n' : 's' };
    });
  });
  const maxCols = aoa.reduce((m, r) => Math.max(m, r.length), 1);
  sheet['!ref'] = 'A1:' + String.fromCharCode(64 + maxCols) + Math.max(1, aoa.length);
  return sheet;
}
global.XLSX = {
  utils: {
    book_new: () => { const wb = { Sheets: {}, SheetNames: [] }; lastWorkbook = wb; return wb; },
    aoa_to_sheet: (rows) => makeSheet(rows),
    book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); capturedSheets.push({ name, ws }); },
    decode_range: (ref) => {
      const m = String(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      const colIdx = (s) => s.split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
      if (!m) return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      return { s: { r: parseInt(m[2]) - 1, c: colIdx(m[1]) }, e: { r: parseInt(m[4]) - 1, c: colIdx(m[3]) } };
    },
    encode_cell: (o) => String.fromCharCode(65 + o.c) + (o.r + 1),
    // เลียนแบบ XLSX.utils.sheet_to_json: แถวแรก = หัวคอลัมน์, ข้ามแถวที่ว่างทั้งแถว
    sheet_to_json: (ws, opts) => {
      const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      const get = (r, c) => { const a = XLSX.utils.encode_cell({ r, c }); return ws[a] ? ws[a].v : undefined; };
      if (opts && opts.header === 1) {
        const out = [];
        for (let r = ref.s.r; r <= ref.e.r; r++) {
          const row = [];
          for (let c = ref.s.c; c <= ref.e.c; c++) row.push(get(r, c));
          out.push(row);
        }
        return out;
      }
      const heads = [];
      for (let c = ref.s.c; c <= ref.e.c; c++) heads[c] = get(ref.s.r, c);
      const out = [];
      for (let r = ref.s.r + 1; r <= ref.e.r; r++) {
        const obj = {}; let has = false;
        for (let c = ref.s.c; c <= ref.e.c; c++) {
          const h = heads[c];
          if (h === undefined || h === null || h === '') continue;
          const v = get(r, c);
          if (v !== undefined) { obj[String(h)] = v; has = true; }
        }
        if (has) out.push(obj);
      }
      return out;
    }
  },
  write: () => new ArrayBuffer(8),
  read: () => lastWorkbook            // เทสต์ป้อนกลับ workbook ที่เพิ่ง export
};

// ================= โหลดโค้ดจริงของเว็บ =================
const files = ['js/state.js', 'js/canvas-viewer.js', 'js/table-core.js', 'js/table-sync.js', 'js/tab-project.js', 'js/tab-ditch.js',
  'js/tab-dimension.js', 'js/tab-level.js', 'js/tab-ground.js', 'js/tab-structure.js', 'js/tab-attachment.js',
  'js/tab-type.js',
  'js/tab-earthwork.js', 'js/tab-ai-result.js', 'js/tab-validate.js', 'js/io-manager.js', 'js/ai-reader.js', 'js/autosave.js',
  'js/tab-export-preview.js', 'js/ai-credit.js'];
let code = '';
files.forEach(f => { code += fs.readFileSync(path.join(base, f), 'utf8') + '\n;\n'; });
code = code.replace(/^(let|const) /gm, 'var ');
eval(code);

// uiPrompt/uiConfirm ของจริงใน canvas-viewer.js จะ "รอผู้ใช้คลิก" → ในเทสต์ต้องแทนด้วยเวอร์ชันอัตโนมัติ
// (ไม่งั้น await saveFileWithDialog() จะค้างแล้วโปรเซสจบเงียบ ๆ ด้วย exit code 0)
uiPrompt = () => Promise.resolve(null);
uiConfirm = (message, onOk) => { if (typeof onOk === 'function') onOk(); };

// ================= ตัวช่วย =================
let fails = 0, warns = 0;
function check(label, cond, extra) {
  if (cond) console.log('  PASS  ' + label);
  else { fails++; console.log('  FAIL  ' + label + (extra !== undefined ? '   -> ' + extra : '')); }
}
function note(msg) { console.log('  NOTE  ' + msg); }
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function resetState() {
  channels = [{ id: 1, canal: 'คลอง', ditch: '01', totalArea: '', waterArea: '', collapsed: false, rows: [] }];
  dimensionRows = [];
  levelRowsData = [];
  groundRowsData = [];
  structureRowsData = [];
  attachmentRowsData = [];
  levelGroupState = {}; groundGroupState = {}; structureGroupState = {}; attachmentGroupState = {};
  currentTab = 'ditch';
  syncDimensionRowsWithChannels();
}
function attRow(chId, remark, name) {
  return { channelId: chId, km: '', name: name || ATTACHMENT_BASE_NAME, h: '0.00', pipeDia: '0.20', length: '1.00', count: '1', remark: remark };
}

(async () => {

console.log('=== P1) แทรกคูส่งน้ำกลางตาราง → แถวของแท็บ "อาคารท่อรับน้ำเข้าแปลงไร่นา" ตามคูผิด ===');
resetState();
addChannelAt(0);                       // channels: [01(id1), ใหม่(id2)]
channels[1].ditch = '02';              // คู 02 = id 2
attachmentRowsData.length = 0;
attachmentRowsData.push(attRow(2, 'ของคู02'));   // ผูกกับ channelId 2 (คู 02)
addChannelAt(0);                       // แทรกคูใหม่คั่นกลาง → channels: [01(id1), ใหม่(id3), 02(id2)]
check('P1.0 ลำดับคูหลังแทรก = 01, -, 02', channels.map(c => c.ditch).join(',') === '01,-,02', channels.map(c => c.ditch).join(','));
const movedRow = attachmentRowsData.find(r => r.remark === 'ของคู02');
check('P1.1 แถวอาคารของคู 02 ยังผูกกับ channelId = 2 (id คงที่ ไม่เลื่อนตาม index)',
  movedRow && movedRow.channelId === 2, movedRow ? 'channelId=' + movedRow.channelId : 'ไม่พบแถว');
check('P1.2 แถวของคู 02 ยังชี้ถูกคู (ditch = 02)',
  movedRow && getChannelById(movedRow.channelId) && getChannelById(movedRow.channelId).ditch === '02',
  movedRow && getChannelById(movedRow.channelId) ? 'ditch=' + getChannelById(movedRow.channelId).ditch : 'ไม่พบ');
const rowsOfNewChan = attachmentRowsData.filter(r => r.channelId === 3);
check('P1.3 คูใหม่ (id 3) ต้องมีแถวตั้งต้นของตัวเองเท่านั้น', rowsOfNewChan.length === 1 && rowsOfNewChan[0].name === ATTACHMENT_BASE_NAME && rowsOfNewChan[0].remark === '',
  rowsOfNewChan.map(r => r.name + '/' + r.remark).join(' | '));

console.log('\n=== P2) ลบคูกลางตาราง → เกิดแถว "ลอย" (orphan) และแถวสลับคู ===');
resetState();
addChannelAt(0); channels[1].ditch = '02';   // 02 = id 2
addChannelAt(1); channels[2].ditch = '03';   // 03 = id 3
attachmentRowsData.length = 0;
attachmentRowsData.push(attRow(2, 'ของคู02'));
attachmentRowsData.push(attRow(3, 'ของคู03'));
deleteChannelAt(1);                    // ลบคู 02 (id 2) → channels: [01(id1), 03(id3)]
check('P2.0 ลำดับคูหลังลบ = 01, 03', channels.map(c => c.ditch).join(',') === '01,03', channels.map(c => c.ditch).join(','));
const orphan = attachmentRowsData.filter(r => !getChannelById(r.channelId));
check('P2.1 ต้องไม่มีแถวที่ชี้คูที่ถูกลบไปแล้ว (orphan)', orphan.length === 0,
  'orphan = ' + orphan.map(r => 'ch' + r.channelId + ':' + r.remark).join(', '));
const row02 = attachmentRowsData.find(r => r.remark === 'ของคู02');
const row03 = attachmentRowsData.find(r => r.remark === 'ของคู03');
check('P2.2 แถวของคูที่ถูกลบ (02) ต้องหายไป', row02 === undefined, row02 ? 'ยังมี channelId=' + row02.channelId : '');
check('P2.3 แถวของคู 03 ยังผูกกับ channelId = 3 และชี้คู 03', row03 && row03.channelId === 3 && getChannelById(3) && getChannelById(3).ditch === '03',
  row03 ? 'channelId=' + row03.channelId + ' · ditch=' + (getChannelById(row03.channelId) ? getChannelById(row03.channelId).ditch : '-') : 'ไม่พบ');
switchTableTab('attachment');
const groupCount = (capturedHtml.match(/btn-collapse-rows/g) || []).length;
check('P2.4 ตารางแท็บอาคารท่อรับน้ำ ต้องมีกลุ่มเท่าจำนวนคูที่เหลือ (2) และแถวของคูที่ถูกลบต้องหายไป',
  groupCount === channels.length && !capturedHtml.includes('ของคู02'),
  'กลุ่มที่ render = ' + groupCount + ' (คูเหลือ ' + channels.length + ') · พบ "ของคู02" = ' + capturedHtml.includes('ของคู02'));
switchTableTab('ditch');

console.log('\n=== P3) โหลด JSON ที่ไม่มีคีย์บางตัว → ข้อมูลโปรเจกต์เดิมค้างอยู่ในโปรเจกต์ใหม่ ===');
resetState();
attachmentRowsData.length = 0;
attachmentRowsData.push(attRow(1, 'ของโปรเจกต์เก่า'));
structureRowsData.length = 0;
structureRowsData.push({ channelIdx: 0, isBoundary: true, isEndBoundary: false, km: 0, name: 'อาคารทดสอบเก่า', pipeDia: '0.00', pipeCount: '0.00', remark: '' });
lastFileRead = JSON.stringify({
  channels: [{ id: 1, canal: 'คลองใหม่', ditch: '99', totalArea: '', waterArea: '', collapsed: false, rows: [] }],
  dimensionRows: [{ channelIdx: 0, kmStart: 0, kmEnd: 100, q: 0.03, slope: 4000, b: 0.35, d: 0.36, type: 'VU1', tbl: 0.5, tbr: 0.5 }],
  levelRowsData: [{ channelIdx: 0, isDynamicRow: false, customType: '', customSlope: '', customKmStart: '', customKmEnd: '', h: 0, bl1: '', tbl1: '', bl2: '', tbl2: '' }],
  groundRowsData: [{ channelIdx: 0, isBoundary: true, km: 0, groundElevation: '' }]
  // ⚠️ จงใจไม่มี attachmentRowsData และ structureRowsData (เหมือนไฟล์ที่บันทึกก่อนมีแท็บเหล่านี้)
});
loadProjectJSON({ target: { files: [{}], value: '' } });
check('P3.1 หลังโหลดไฟล์ที่ไม่มี attachmentRowsData → แถวเดิมต้องถูกล้าง',
  !attachmentRowsData.some(r => r.remark === 'ของโปรเจกต์เก่า'),
  'ยังเหลือ: ' + J(attachmentRowsData.filter(r => r.remark === 'ของโปรเจกต์เก่า').map(r => r.remark)));
check('P3.2 หลังโหลดไฟล์ที่ไม่มี structureRowsData → แถวเดิมต้องถูกล้าง',
  !structureRowsData.some(r => r.name === 'อาคารทดสอบเก่า'),
  'ยังเหลือ: ' + J(structureRowsData.filter(r => r.name === 'อาคารทดสอบเก่า').map(r => r.name)));

console.log('\n=== P4) เทสต์เดิม (tests/smoke-test.js) — import Excel ไม่ได้ทดสอบอะไรจริง ===');
resetState();
await exportAllToExcel({ skipPreview: true, skipValidate: true });
const names = capturedSheets.map(s => s.name);
check('P4.0 export ได้ครบทุกชีต', names.length >= 8, names.join(' | '));
const savedRead = XLSX.read;
delete XLSX.read;                      // เลียนแบบ XLSX จำลองของ smoke-test.js (ไม่มี read)
channels[0].ditch = 'MARKER';
importAllFromExcel({ target: { files: [{}], value: '' } });
check('P4.1 ถ้าไม่มี XLSX.read: import จะล้มเหลวเงียบ ๆ และข้อมูลไม่เปลี่ยนแม้แต่ช่องเดียว',
  channels[0].ditch === 'MARKER',
  'ditch=' + channels[0].ditch + ' (ถ้าไม่ใช่ MARKER แปลว่า import ทำงานจริง)');
note('smoke-test.js ไม่ได้ประกาศ XLSX.read เลย → ข้อ "นำเข้าชีต setting แล้วได้ ... เท่าเดิม" ทั้งชุด ' +
  'ผ่านเพราะไม่มีอะไรถูกนำเข้า (เทียบค่าเดิมกับค่าเดิม) ไม่ได้แปลว่า import ถูกต้อง');
XLSX.read = savedRead;

console.log('\n=== P5) Excel export → import จริง (ด้วย XLSX จำลองที่อ่านหัวตารางเป็น key) ===');
resetState();
channels[0].canal = 'คลองA'; channels[0].ditch = '01'; channels[0].totalArea = '10.50'; channels[0].waterArea = '8.00';
addChannelAt(0);
channels[1].canal = 'คลองA'; channels[1].ditch = '02';
syncDimensionRowsWithChannels();
// ชุดข้อมูลตั้งต้นต้อง "สอดคล้องกันเอง" ตามกติกาของโปรแกรม
//   (แถวสุดท้ายของระดับ = กม.สิ้นสุดของสาย · ขอบเขตดินเดิม = ช่วงของมิติ · แถวสิ้นสุดอาคาร = กม.สิ้นสุดของสาย)
// มิติ: คู 01 = 0 → 1050.4 · คู 02 = 1050.4 → 2000
dimensionRows[0].kmStart = 0; dimensionRows[0].kmEnd = 1050.4;
dimensionRows[1].kmStart = 1050.4; dimensionRows[1].kmEnd = 2000; dimensionRows[1].type = 'VU2';
levelRowsData.length = 0;
levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: 'VU1', customSlope: '4000', customKmStart: 0, customKmEnd: 525, h: 0.00, bl1: '1.00', tbl1: '1.50', bl2: '0.74', tbl2: '1.24' });
levelRowsData.push({ channelId: 1, isDynamicRow: true, customType: 'VU2', customSlope: '3000', customKmStart: 525, customKmEnd: 1050.4, h: 0.50, bl1: '0.24', tbl1: '0.79', bl2: '-0.09', tbl2: '0.46' });
levelRowsData.push({ channelId: 2, isDynamicRow: false, customType: 'VU2', customSlope: '4000', customKmStart: 1050.4, customKmEnd: 2000, h: 0.00, bl1: '', tbl1: '', bl2: '', tbl2: '' });
groundRowsData.length = 0;
groundRowsData.push({ channelId: 1, isDynamicRow: false, isBoundary: true, km: 0, groundElevation: '12.50' });
groundRowsData.push({ channelId: 1, isDynamicRow: true, isBoundary: false, km: 500, groundElevation: '11.75' });
groundRowsData.push({ channelId: 1, isDynamicRow: false, isBoundary: true, km: 1050.4, groundElevation: '10.25' });
groundRowsData.push({ channelId: 2, isDynamicRow: false, isBoundary: true, km: 1050.4, groundElevation: '' });
groundRowsData.push({ channelId: 2, isDynamicRow: false, isBoundary: true, km: 2000, groundElevation: '' });
structureRowsData.length = 0;
structureRowsData.push({ channelId: 1, isBoundary: true, isEndBoundary: false, km: 0, name: 'อาคารท่อส่งน้ำเข้านา (เดิม)', pipeDia: '0.00', pipeCount: '0.00', remark: '' });
structureRowsData.push({ channelId: 1, isBoundary: false, isFromLevel: true, km: 525, name: 'อาคารลดระดับ', pipeDia: '', pipeCount: '', remark: '' });
structureRowsData.push({ channelId: 1, isBoundary: false, km: 800, name: 'อาคารท่อลอดถนนลดระดับ', pipeDia: '', pipeCount: '', hOverride: '1.25', remark: '' });
structureRowsData.push({ channelId: 1, isBoundary: true, isEndBoundary: true, km: 1050.4, name: 'ปลายคู', pipeDia: '0.00', pipeCount: '0.00', remark: '' });
structureRowsData.push({ channelId: 2, isBoundary: true, isEndBoundary: false, km: 1050.4, name: 'อาคารท่อส่งน้ำเข้านา (เดิม)', pipeDia: '0.00', pipeCount: '0.00', remark: '' });
structureRowsData.push({ channelId: 2, isBoundary: true, isEndBoundary: true, km: 2000, name: 'ปลายคู', pipeDia: '0.00', pipeCount: '0.00', remark: '' });
attachmentRowsData.length = 0;
attachmentRowsData.push(attRow(1, 'ร่องที่ 1'));
attachmentRowsData.push({ channelId: 1, km: '', name: 'อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ', h: '0.35', pipeDia: '0.20', length: '1.00', count: '3', remark: 'หลังบ้าน' });
attachmentRowsData.push(attRow(2, ''));

function snap() {
  return {
    'ระบบคูส่งน้ำ': channels.map(c => [c.canal, c.ditch, c.totalArea, c.waterArea].join('|')),
    'มิติคูส่งน้ำ': dimensionRows.map(r => [r.channelId, r.kmStart, r.kmEnd, r.q, r.slope, r.b, r.d, r.type, r.tbl, r.tbr].join('|')),
    'ระดับคูส่งน้ำ': levelRowsData.map(r => [r.channelId, !!r.isDynamicRow, r.customType, r.customSlope, r.customKmStart, r.customKmEnd, r.h, r.bl1, r.tbl1, r.bl2, r.tbl2].join('|')),
    'ระดับดินเดิม': groundRowsData.map(r => [r.channelId, !!r.isBoundary, r.km, r.groundElevation].join('|')),
    // อาคารประกอบ: เทียบ "ค่าที่มีผลจริง" (ค่าที่แสดง/ใช้คิดชื่อ) ไม่ใช่ค่าในหน่วยความจำดิบ
    // เพราะช่องที่ถูกล็อกตามตาราง ค่าดิบจะถูกแทนด้วยค่าเริ่มต้นจากตารางเสมอ (ไม่มีผลกับผู้ใช้)
    'อาคารประกอบ': structureRowsData.map(r => {
      let e = getStructureTypeEntry(r.name);
      return [r.channelId, !!r.isBoundary, !!r.isEndBoundary, !!r.isFromLevel, r.km, r.name,
        structureNameValue(r.pipeDia, e ? e.pipeDia : "", !!(e && e.diaEditable)),
        structureNameValue(r.pipeCount, e ? e.length : "", !!(e && e.lenEditable)),
        structureNameValue(r.hOverride, e ? e.h : "", !!(e && e.hEditable)),
        computeStructureItemName(r, r.channelId), r.remark].join('|');
    }),
    'อาคารท่อรับน้ำ': attachmentRowsData.map(r => [r.channelId, r.name, r.count, r.h, r.pipeDia, r.length, r.remark].join('|'))
  };
}
const nameBefore = structureRowsData.map(r => computeStructureItemName(r, r.channelId));
const before = snap();
capturedSheets = [];
await exportAllToExcel({ skipPreview: true, skipValidate: true });
importAllFromExcel({ target: { files: [{}], value: '' } });
const after = snap();
const nameAfter = structureRowsData.map(r => computeStructureItemName(r, r.channelId));

let diffCount = 0;
Object.keys(before).forEach(k => {
  const b = before[k], a = after[k];
  const n = Math.max(b.length, a.length);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    if (b[i] !== a[i]) diffs.push(`แถว ${i}\n        ก่อน: ${b[i]}\n        หลัง: ${a[i]}`);
  }
  console.log(`  [${k}] แถวก่อน ${b.length} → หลัง ${a.length} | ต่างกัน ${diffs.length} แถว`);
  diffs.slice(0, 4).forEach(d => { diffCount++; note(d); });
  if (diffs.length > 4) note('  ... ต่างอีก ' + (diffs.length - 4) + ' แถว');
});
check('P5.0 export → import ต้องได้ข้อมูลเดิมทุกชีต', diffCount === 0, 'พบความต่าง ' + diffCount + ' แถว (ดู NOTE ด้านบน)');
if (nameBefore.join('|') !== nameAfter.join('|')) {
  console.log('  [ชื่ออาคารประกอบ] ก่อน: ' + nameBefore.join(' / '));
  console.log('  [ชื่ออาคารประกอบ] หลัง: ' + nameAfter.join(' / '));
}

console.log('\n=== P6) ปุ่ม "หมุนภาพ": ต้องหมุนพิกัด overlay ตาม + วาดภาพใหม่หลังถอดรหัสเสร็จ ===');
resetState();
imgScale = 1;
img = new Image();
img.width = 600; img.height = 400; img.naturalWidth = 600; img.naturalHeight = 400; img.complete = true;
img._src = 'data:image/png;base64,ORIGINAL';
refPixels = { p1: { x: 100, y: 50 }, p2: { x: 500, y: 300 } };
manualGroundLinePoints = [{ x: 100, y: 50, xData: 0, yData: 10 }, { x: 500, y: 300, xData: 100, yData: 5 }];
let drawImageCalls = 0;
const ctx2d = canvas.getContext('2d');
ctx2d.drawImage = () => { drawImageCalls++; };
const origRedraw = redraw;
let redrawCount = 0;
redraw = function () { redrawCount++; return origRedraw.apply(this, arguments); };
const imgBeforeRotate = img;
rotateImageView();
check('P6.1 ยังไม่สลับภาพทันที (รอถอดรหัสเสร็จ — ไม่ fit/วาดด้วยภาพขนาด 0x0)',
  img === imgBeforeRotate && img.width === 600, img.width + 'x' + img.height + ' · img.complete=' + img.complete);
await sleep(30);                       // ให้ภาพที่หมุนแล้ว (data URL) ถอดรหัสเสร็จ
redraw = origRedraw;
check('P6.2 หลังถอดรหัสเสร็จ ภาพถูกสลับเป็นขนาดที่หมุนแล้ว (400x600)',
  img.width === 400 && img.height === 600, img.width + 'x' + img.height);
check('P6.3 หลังหมุนมีการวาดภาพจริงบน canvas (drawImage) ในจังหวะที่ภาพพร้อม',
  drawImageCalls > 0 && redrawCount >= 1, 'drawImage=' + drawImageCalls + ' · redraw=' + redrawCount);
check('P6.4 P1 ถูกแปลงพิกัดตามการหมุน ((100,50) → (400-50,100) แล้วคูณสเกลใหม่)',
  Math.abs(refPixels.p1.y - 100 * imgScale) < 0.51 && Math.abs(refPixels.p1.x - 350 * imgScale) < 0.51,
  J(refPixels.p1) + ' · คาดหวัง x=' + (350 * imgScale).toFixed(2) + ' y=' + (100 * imgScale).toFixed(2));
check('P6.5 เส้นดินเดิมที่ลากไว้ถูกแปลงพิกัดตามการหมุนด้วย',
  Math.abs(manualGroundLinePoints[0].x - 350 * imgScale) < 0.51 && Math.abs(manualGroundLinePoints[0].y - 100 * imgScale) < 0.51,
  J(manualGroundLinePoints[0]));

console.log('\n=== P7) สถานะล็อก/ยุบของกลุ่ม (คีย์ตาม channelId คงที่) ไม่เลื่อนเมื่อเพิ่ม/ลบคู ===');
  resetState();
  addChannelAt(0);                                   // 2 คู: [id1, id2]
  structureGroupState['struct_ch_2'] = { locked: false, collapsed: true };
  attachmentGroupState['attach_ch_2'] = { locked: false, collapsed: false };
  deleteChannelAt(0);                                // ลบคูแรก (id1) → คูที่เหลือ (id2) คงสถานะเดิม
  check('P7.1 สถานะกลุ่มของคูที่ถูกลบ (id1) ถูกลบออกจากแผนที่สถานะ',
    !structureGroupState['struct_ch_1'],
    'struct_ch_1=' + J(structureGroupState['struct_ch_1']));
  check('P7.2 คูที่เหลือ (id2) ยังเก็บสถานะของตัวเองไว้ (ไม่เลื่อน index)',
    structureGroupState['struct_ch_2'] && structureGroupState['struct_ch_2'].locked === false,
    'struct_ch_2=' + J(structureGroupState['struct_ch_2']));
  check('P7.3 เช่นเดียวกันกับสถานะกลุ่มของแท็บอาคารท่อรับน้ำ',
    attachmentGroupState['attach_ch_2'] && attachmentGroupState['attach_ch_2'].locked === false,
    'attach_ch_2=' + J(attachmentGroupState['attach_ch_2']));

  console.log('\n=== P8) Excel: คูส่งน้ำชื่อซ้ำ (หรือว่าง "-") → import รวมข้อมูลทุกคูเข้าคูแรก ===');
  resetState();
  channels[0].canal = 'คลองA'; channels[0].ditch = '01';
  addChannelAt(0);
  channels[1].canal = 'คลองA'; channels[1].ditch = '01';     // ผู้ใช้ตั้งชื่อคูซ้ำ
  syncDimensionRowsWithChannels();
  dimensionRows[0].kmEnd = 1000; dimensionRows[1].kmStart = 1000; dimensionRows[1].kmEnd = 2000; dimensionRows[1].type = 'VU6';
  levelRowsData.length = 0;
  levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: 'VU1', customSlope: '4000', customKmStart: 0, customKmEnd: 1000, h: 0, bl1: '1.00', tbl1: '', bl2: '', tbl2: '' });
  levelRowsData.push({ channelId: 2, isDynamicRow: false, customType: 'VU6', customSlope: '4000', customKmStart: 1000, customKmEnd: 2000, h: 0, bl1: '2.00', tbl1: '', bl2: '', tbl2: '' });
  capturedSheets = [];
  await exportAllToExcel({ skipPreview: true, skipValidate: true });
  importAllFromExcel({ target: { files: [{}], value: '' } });
  check('P8.1 หลัง import ต้องยังมี 2 คู', channels.length === 2, 'channels=' + channels.length);
  check('P8.2 ข้อมูล "ระดับคูส่งน้ำ" ของคูที่ 2 (TYPE=VU6, 1+000–2+000) ต้องอยู่ใต้คูที่ 2',
    levelRowsData.some(r => r.channelId === 2 && r.customType === 'VU6'),
    'channelId:TYPE = ' + J(levelRowsData.map(r => r.channelId + ':' + r.customType)));
  check('P8.3 คูแรกต้องไม่มีแถวของคูที่ 2 ปนเข้ามา',
    !levelRowsData.some(r => r.channelId === 1 && r.customType === 'VU6'),
    'channelId:TYPE = ' + J(levelRowsData.map(r => r.channelId + ':' + r.customType)));
  check('P8.4 ข้อมูล "มิติคูส่งน้ำ" ของคูที่ 2 (TYPE=VU6) ต้องอยู่ใต้คูที่ 2',
    dimensionRows.some(r => r.channelId === 2 && r.type === 'VU6'),
    'channelId:TYPE = ' + J(dimensionRows.map(r => r.channelId + ':' + r.type)));

  console.log('\n=== P9) กด + ที่แถวสุดท้ายของแท็บระดับคูส่งน้ำ → แถวใหม่มีความยาว 0 ===');
  resetState();
  dimensionRows[0].kmEnd = 100;
  enforceLevelLastKmEnd();
  const rowsBefore = levelRowsData.length;
  addLevelRowAt(0);
  const newLvl = levelRowsData[1];
  check('P9.1 กด + แล้วมีแถวใหม่', levelRowsData.length === rowsBefore + 1, levelRowsData.length);
  check('P9.2 แถวใหม่ต้องมีช่วง กม. ที่ใช้งานได้ (เริ่มต้น ≠ สิ้นสุด)',
    !!newLvl && Number(newLvl.customKmStart) !== Number(newLvl.customKmEnd),
    newLvl ? 'แถวใหม่ = ' + formatKmDisplay(newLvl.customKmStart) + ' → ' + formatKmDisplay(newLvl.customKmEnd) : 'ไม่พบแถวใหม่');

  console.log('\n=== P10) บั๊กที่เจอล่าสุด: ยืนยันก่อนลบ · เปลี่ยนชื่อ Type · คัดลอก · ภาพในไฟล์โปรเจกต์ · เพดาน canvas ===');

// (1) ปุ่มลบต้องถามก่อน — กด "ยกเลิก" แล้วข้อมูลต้องอยู่ครบ
resetState();
addStructureRowAt(0);
let askedCount = 0;
const origUiConfirm = uiConfirm;
const cancelIdx = structureRowsData.findIndex(r => !r.isBoundary && !r.isFromLevel);
const rowsBeforeCancel = structureRowsData.length;
uiConfirm = () => { askedCount++; };                    // เลียนแบบผู้ใช้กด "ยกเลิก" (ไม่เรียก onOk)
deleteStructureRowAt(cancelIdx);
check('P10.1 กดลบแถวอาคาร → มีกล่องยืนยันขึ้นก่อน', askedCount === 1, 'asked=' + askedCount);
check('P10.2 กด "ยกเลิก" → แถวไม่ถูกลบ', structureRowsData.length === rowsBeforeCancel, structureRowsData.length);
uiConfirm = origUiConfirm;
deleteStructureRowAt(cancelIdx);
check('P10.3 กด "ลบ" → แถวถูกลบจริง', structureRowsData.length === rowsBeforeCancel - 1, structureRowsData.length);

resetState();
addChannelAt(0);
const chanBefore = channels.length;
askedCount = 0;
uiConfirm = () => { askedCount++; };                    // ยกเลิก
deleteChannelAt(1);
check('P10.4 ลบคู → ยืนยันก่อน และยกเลิกได้ (ข้อมูลคูอยู่ครบ)', askedCount === 1 && channels.length === chanBefore,
  'asked=' + askedCount + ' · channels=' + channels.length);
uiConfirm = origUiConfirm;
deleteChannelAt(1);
check('P10.5 ยืนยันลบคู → จำนวนคูลดลงจริง', channels.length === chanBefore - 1, channels.length);

// (2) เปลี่ยนชื่อ Type อาคารประกอบ → แถวที่ใช้ชื่อเดิมต้องเปลี่ยนตาม (เดิมแถวเสื่อมสภาพเพราะหาประเภทไม่เจอ)
resetState();
const TARGET_TYPE = 'อาคารท่อลอดถนนลดระดับ';
const RENAMED_TYPE = 'อาคารท่อลอดถนนลดระดับ (ทดสอบ)';
const tIdx = structureTypeDatabase.findIndex(t => t.type === TARGET_TYPE);
structureRowsData.length = 0;
structureRowsData.push({ channelId: 1, isBoundary: true, isEndBoundary: false, km: 0, name: TARGET_TYPE, pipeDia: '', pipeCount: '', remark: '' });
structureRowsData.push({ channelId: 1, isBoundary: true, isEndBoundary: true, km: 100, name: 'ปลายคู', pipeDia: '', pipeCount: '', remark: '' });
updateStructureTypeField(tIdx, RENAMED_TYPE);
check('P10.6 เปลี่ยนชื่อ Type → แถวอาคารประกอบที่ใช้ชื่อเดิมเปลี่ยนตาม',
  structureRowsData[0].name === RENAMED_TYPE, structureRowsData[0].name);
check('P10.7 แถวที่เปลี่ยนชื่อตามยังหาประเภทเจอ → ช่องต่าง ๆ ไม่กลายเป็นว่าง',
  (function () { let e = getStructureTypeEntry(structureRowsData[0].name); return !!e && e.hEditable === true && e.diaEditable === true; })(),
  J(getStructureTypeEntry(structureRowsData[0].name)));
updateStructureTypeField(tIdx, TARGET_TYPE);            // คืนชื่อเดิม

// (3) คัดลอก: ต้องไม่พังเงียบทั้งกรณีสำเร็จและล้มเหลว
resetState();
currentTab = 'ditch';
const alertLog = [];
const origAlert = global.alert;
const origWriteText = navigator.clipboard.writeText;
global.alert = (m) => alertLog.push(String(m));
navigator.clipboard.writeText = () => Promise.resolve();
copyTableData();
await sleep(5);
check('P10.8 คัดลอกสำเร็จ → แจ้งเตือน "เรียบร้อย"', alertLog.some(m => m.indexOf('เรียบร้อย') !== -1), alertLog.join(' | '));
alertLog.length = 0;
navigator.clipboard.writeText = () => Promise.reject(new Error('NotAllowedError'));
copyTableData();
await sleep(5);
check('P10.9 คัดลอกล้มเหลว → ต้องมีข้อความบอกผู้ใช้ (ไม่พังเงียบ)', alertLog.length > 0, alertLog.join(' | '));
navigator.clipboard.writeText = origWriteText;
global.alert = origAlert;

// (4) บันทึก/โหลดโปรเจกต์ต้องแนบภาพ + พิกัดต้องไม่ผูกกับซูม
resetState();
imgScale = 1;
img = new Image();
img.width = 4000; img.height = 2000; img.naturalWidth = 4000; img.naturalHeight = 2000; img.complete = true;
img._src = 'data:image/png;base64,ORIGINAL';
refPixels = { p1: { x: 2000, y: 1000 }, p2: null };
manualGroundLinePoints = [{ x: 1000, y: 500, xData: 0, yData: 10 }];
imageRotation = 90;
Blob.last = null;
saveProjectJSON();
await sleep(5);
const savedJson = Blob.last ? JSON.parse(Blob.last[0]) : null;
check('P10.10 ไฟล์โปรเจกต์มีภาพแนบ (imageData) + จำขนาดภาพเต็มไว้',
  !!savedJson && !!savedJson.imageData && savedJson.imageData.fullWidth === 4000 && !!savedJson.imageData.dataUrl,
  savedJson && savedJson.imageData ? ('fullWidth=' + savedJson.imageData.fullWidth + ' · dataUrl=' + String(savedJson.imageData.dataUrl).slice(0, 22)) : 'ไม่มี imageData');
check('P10.11 ไฟล์โปรเจกต์เก็บมุมหมุนของภาพ', !!savedJson && savedJson.imageRotation === 90, savedJson && savedJson.imageRotation);
check('P10.12 พิกัดถูกบันทึกเป็น "พิกัดภาพเต็ม" (ไม่ผูกกับซูม/ขนาดหน้าต่าง)',
  !!savedJson && !!savedJson.drawingData && savedJson.drawingData.coordSpace === 'image' &&
  Math.abs(savedJson.drawingData.refPixels.p1.x - 2000) < 0.001,
  savedJson && savedJson.drawingData ? J(savedJson.drawingData.refPixels) : '-');

img = new Image(); img.width = 0; img.height = 0; img.complete = false; img._src = '';
refPixels = { p1: null, p2: null };
manualGroundLinePoints = []; tableGroundLinePoints = []; canalLevelDrawingLines = [];
lastFileRead = JSON.stringify(savedJson);
loadProjectJSON({ target: { files: [{}], value: '' } });
await sleep(30);
const dispW = img.width * imgScale;
check('P10.13 โหลดโปรเจกต์ → ได้ภาพกลับมาแสดงบนจอ', !!img.src && img.width > 0,
  'ภาพ ' + img.width + 'x' + img.height + ' · src=' + String(img.src).slice(0, 22));
check('P10.14 จุด P1 กลับไปอยู่ตำแหน่งเดิมของภาพ (เดิมอยู่กลางภาพ = สัดส่วน 0.5)',
  !!refPixels.p1 && Math.abs((refPixels.p1.x / dispW) - 0.5) < 0.01 && Math.abs((refPixels.p1.y / (img.height * imgScale)) - 0.5) < 0.01,
  refPixels.p1 ? ('p1=' + J(refPixels.p1) + ' · ภาพที่แสดง ' + dispW.toFixed(1) + 'x' + (img.height * imgScale).toFixed(1)) : 'ไม่มี p1');
check('P10.15 มุมหมุนถูกกู้กลับด้วย', imageRotation === 90, imageRotation);

// (5) เพดาน bitmap ของ canvas (กันซูมลึกจน canvas ใหญ่เกินเพดานเบราว์เซอร์ → จอว่าง)
const huge = 20000;
const dprHuge = computeRenderDPR(huge, huge);
check('P10.16 ซูมภาพใหญ่มาก → bitmap ต้องไม่เกินเพดาน canvas (8192)',
  huge * dprHuge <= 8192 + 1, 'dpr=' + dprHuge.toFixed(4) + ' → bitmap=' + Math.round(huge * dprHuge));


console.log('\n=== P11) รอบ 33: ตรวจกันบั๊กกลับมา (Label Layer · เส้นระดับ AI · นำเข้า AI · Copy · เมนู Setting) ===');
// (1) scaleOverlayPixels + rotateOverlayPixels ต้องปรับปลายเส้นระดับ AI (x2, y2) ด้วย
resetState();
activeMediaViewTab = 'image';
pdfCropFrames = [{ id: 'fr_1', index: 1, source: 'pdf_crop', name: 'รูปภาพ 1', dataUrl: 'data:image/png;base64,AAA', imgWidth: 1000, imgHeight: 500 }];
activeCropFrameIndex = 0;
canvasLabels = [
  { id: 'lvl_1', frameId: 'fr_1', kind: 'level', levelType: 'BL', text: 'BL', x: 100, y: 200, x2: 300, y2: 400, normX: 0.1, normY: 0.4, normX2: 0.3, normY2: 0.8, angle: 0, source: 'ai' },
  { id: 'lbl_other', frameId: 'fr_2', kind: 'station', text: '0+050', x: 50, y: 60, normX: 0.05, normY: 0.12, angle: 0, source: 'ai' }
];
scaleOverlayPixels(2);
check('P11.1 ซูมภาพ → ปลายเส้นระดับ AI (x2, y2) ในกรอบปัจจุบันขยายตามด้วย',
  canvasLabels[0].x === 200 && canvasLabels[0].y === 400 && canvasLabels[0].x2 === 600 && canvasLabels[0].y2 === 800,
  J(canvasLabels[0]));
check('P11.2 ซูมภาพในกรอบ 1 → ป้ายของกรอบ 2 (fr_2) ไม่ถูกคูณสเกลข้ามกรอบ',
  canvasLabels[1].x === 50 && canvasLabels[1].y === 60, J(canvasLabels[1]));

rotateOverlayPixels(90, 1000, 500);
check('P11.3 หมุนภาพ 90° → ปลายเส้นระดับ AI (x2, y2) หมุนตามด้วย ((600,800) → (500-800, 600))',
  canvasLabels[0].x2 === -300 && canvasLabels[0].y2 === 600, J(canvasLabels[0]));

// (2) findHitCanvasLabel รองรับป้ายที่หมุน 90° และข้อความหลายบรรทัด
canvasLabels = [
  { id: 'lbl_rot', frameId: 'fr_1', kind: 'structure', text: 'อาคารท่อส่งน้ำเข้านา\nปลายคู', x: 200, y: 200, angle: 90, _hitBox: { cx: 200, cy: 200, w: 140, h: 30 } }
];
check('P11.4 ป้ายหมุน 90° → คลิกตามแนวตั้ง (200, 260) จับป้ายได้ และคลิกแนวนอนนอกกรอบ (260, 200) ไม่โดน',
  findHitCanvasLabel(200, 260) === canvasLabels[0] && findHitCanvasLabel(260, 200) === null);

// (3) applyAiResultsToTables: เรียงแถวระดับดินเดิม [ขอบเขตต้น, ...ข้อมูล, ขอบเขตปลาย] + อาคารประกอบปลายคูอยู่ท้ายสุด
resetState();
const aiNorm = normalizeAiResult({
  channels: [{
    canal: 'คลองส่งน้ำสายใหญ่',
    ditch: '1L',
    dimension: { kmStart: 0, kmEnd: 200, q: 0.06, slope: 3000, b: 0.5, d: 0.4, type: 'VU2', tbl: 0.5, tbr: 0.5 },
    ground: [{ km: 50, groundElevation: 12.3 }, { km: 120, groundElevation: 12.1 }],
    level: [{ kmStart: 0, kmEnd: 100, h: 0, bl1: 11.9, tbl1: 12.45, bl2: 11.8, tbl2: 12.35, slope: 3000 },
            { kmStart: 100, kmEnd: 200, h: 0.2, bl1: 11.6, tbl1: 12.15, bl2: 11.5, tbl2: 12.05, slope: 3000 }],
    structures: [{ km: 80, name: 'อาคารท่อส่งน้ำเข้านา (ใหม่)', pipeDia: 0, pipeCount: 0, remark: '' }],
    attachments: []
  }]
}, { frameId: 'fr_1', frameName: 'รูปภาพ 1' });
applyAiResultsToTables([aiNorm], { matchExisting: true });
const newCh = channels.find(c => c.ditch === '1L');
const gRows = groundRowsData.filter(g => g.channelId === newCh.id);
check('P11.5 นำเข้าระดับดินเดิมจาก AI → แถวแรกและแถวสุดท้ายเป็นขอบเขต (isBoundary) ส่วนแถวกลางเป็นข้อมูลเรียง กม.',
  gRows.length === 4 && gRows[0].isBoundary === true && gRows[3].isBoundary === true &&
  gRows[1].isBoundary === false && gRows[1].km === 50 && gRows[2].km === 120 && gRows[0] !== gRows[3],
  J(gRows));
const sRows = structureRowsData.filter(s => s.channelId === newCh.id);
check('P11.6 นำเข้าอาคารประกอบจาก AI → ต้นคูอยู่แถวแรก ปลายคูอยู่แถวสุดท้าย แถวจากระดับไม่หาย และค่า 0 ไม่ทับค่าตาราง',
  sRows.length === 4 && sRows[0].isBoundary && !sRows[0].isEndBoundary &&
  sRows[sRows.length - 1].isBoundary && sRows[sRows.length - 1].isEndBoundary &&
  sRows.some(s => s.isFromLevel && s.km === 100) &&
  sRows.find(s => s.km === 80).pipeDia === '',
  J(sRows));

// (4) Copy ตาราง Typeคูส่งน้ำ และ Typeอาคารประกอบ มีคอลัมน์ครบตามหน้าเว็บ
let lastCopied = '';
const origClipWrite = navigator.clipboard.writeText;
navigator.clipboard.writeText = (txt) => { lastCopied = txt; return Promise.resolve(); };
currentTab = 'setting-type';
copyTableData();
check('P11.7 Copy แท็บ Typeคูส่งน้ำ มีคอลัมน์ความหนากำแพงและความหนาพื้นครบ 5 คอลัมน์',
  lastCopied.includes('ความหนากำแพง (ม.)') && lastCopied.includes('ความหนาพื้น (ม.)') && lastCopied.split('\n')[0].split('\t').length === 5,
  lastCopied.split('\n')[0]);
currentTab = 'setting-structure';
copyTableData();
check('P11.8 Copy แท็บ Typeอาคารประกอบ มีครบ 8 คอลัมน์ (รวมชื่ออาคารประกอบ + UP + DOWN)',
  lastCopied.includes('ชื่ออาคารประกอบ') && lastCopied.includes('UP') && lastCopied.includes('DOWN') && lastCopied.split('\n')[0].split('\t').length === 8,
  lastCopied.split('\n')[0]);
navigator.clipboard.writeText = origClipWrite;


console.log('\n=== P12) รอบ 34: ตรวจการอ่านค่า AI · สเกล P1/P2 · การแสดงผลบนรูป · เส้นดินเดิม · ช่วง H · แท็บผลอ่าน AI ===');
// (1) ชื่อคูส่งน้ำมีแต่ตัวเลข
check('P12.1 cleanDitchNumber ตัดคำว่า "คูส่งน้ำ/สาย" เหลือแต่ตัวเลข ("01", "04-1")',
  cleanDitchNumber('คูส่งน้ำ 01') === '01' &&
  cleanDitchNumber('คูส่งน้ำสายที่ 04-1') === '04-1' &&
  cleanDitchNumber('02') === '02');

// (2) ปรับเทียบ P1/P2 ตามสเกลตารางกราฟมาตรฐาน + กรองค่าระดับแกนซ้าย/FSL/จุดดำ + แบ่งช่วงตารางระดับตาม กม. ที่มีค่า H
const rawR34 = {
  channels: [{
    canal: 'คลองส่งน้ำสายใหญ่',
    ditch: 'คูส่งน้ำ 04',
    dimension: { kmStart: 0, kmEnd: 300, q: 0.04, slope: 1000, b: 0.35, d: 0.36, type: 'VU1', tbl: 0.5, tbr: 0.5 },
    ground: [
      { km: 0, groundElevation: 252.38, x: 0.10, y: 0.55 },
      { km: 100, groundElevation: 252.10, x: 0.40, y: 0.60 },
      { km: 300, groundElevation: 251.50, x: 0.90, y: 0.72 }
    ],
    level: [
      { kmStart: 0,   kmEnd: 100, h: 0,    bl1: 252.36, tbl1: 252.86, bl2: 252.26, tbl2: 252.76, slope: 1000 },
      { kmStart: 100, kmEnd: 200, h: 0,    bl1: 252.26, tbl1: 252.76, bl2: 252.16, tbl2: 252.66, slope: 1000 },
      { kmStart: 200, kmEnd: 300, h: 0.20, bl1: 251.96, tbl1: 252.46, bl2: 251.86, tbl2: 252.36, slope: 1000 }
    ],
    structures: [
      { km: 100, name: 'อาคารปากคูซอย', h: 0, pipeDia: 0, pipeCount: 0, remark: '' },
      { km: 200, name: 'อาคารลดระดับ', h: 0.20, pipeDia: 0, pipeCount: 0, remark: '' }
    ],
    attachments: []
  }],
  // สมมติ AI ส่ง P1/P2 สลับบน-ล่าง หรือค่าไม่ลงช่องตาราง 1 เมตร
  refPoints: {
    p1: { x: 0.10, y: 0.25, km: 0,   elev: 253.50 },
    p2: { x: 0.90, y: 0.85, km: 300, elev: 251.20 }
  },
  labels: [
    { kind: 'elev', text: '+250.00', x: 0.04, y: 0.85, angle: 0 },
    { kind: 'elev', text: 'F.S.L. +252.95', x: 0.35, y: 0.48, angle: 0 },
    { kind: 'station', text: '● 0+200', x: 0.60, y: 0.18, angle: -90, group: 'g_st' },
    { kind: 'structure', text: 'อาคารลดระดับ', x: 0.62, y: 0.18, angle: -90, group: 'g_st' },
    { kind: 'h', text: '0.20', x: 0.64, y: 0.18, angle: -90, group: 'g_st' },
    { kind: 'elev', text: '252.46', x: 0.60, y: 0.52, angle: -90, group: 'g_el' },
    { kind: 'elev', text: '252.05', x: 0.62, y: 0.52, angle: -90, group: 'g_el' },
    { kind: 'elev', text: '251.96', x: 0.64, y: 0.52, angle: -90, group: 'g_el' },
    { kind: 'slope', text: 'S 1:1000', x: 0.50, y: 0.45, angle: 0 }
  ],
  levelLines: [
    { type: 'BL',  x1: 0.10, y1: 0.56, x2: 0.90, y2: 0.68, kmStart: 0, kmEnd: 300 },
    { type: 'TBL', x1: 0.10, y1: 0.46, x2: 0.90, y2: 0.58, kmStart: 0, kmEnd: 300 }
  ]
};
const normR34 = normalizeAiResult(rawR34, { frameId: 'fr_r34', frameName: 'รูปภาพ 1' });
check('P12.2 normalizeAiResult ปรับชื่อคูเป็นตัวเลข "04" และปรับ P1/P2 ให้ถูกต้องตามสเกล (P1 ล่าง 251.00 < P2 บน 255.00)',
  normR34.channels[0].ditch === '04' &&
  normR34.refPoints.p1.elev < normR34.refPoints.p2.elev &&
  normR34.refPoints.p1.y > normR34.refPoints.p2.y &&
  normR34.refPoints.p1.km === 0 && normR34.refPoints.p2.km === 300,
  J(normR34.refPoints));

check('P12.3 กรองค่าระดับเส้นตารางแกนซ้าย (+250.00), ค่า F.S.L. และจุดดำ ● ออกทั้งหมด',
  !normR34.labels.some(l => /250\.00|F\.?S\.?L|●/i.test(l.text)),
  J(normR34.labels));

check('P12.4 ตารางระดับคูส่งน้ำบันทึกเป็นช่วงตาม กม. ที่มีค่า H เท่านั้น (รวม 0→100 และ 100→200 ที่ H=0 เป็น 0→200, แล้วตัดช่วงที่ กม. 200 ซึ่ง H=0.20)',
  normR34.channels[0].level.length === 2 &&
  normR34.channels[0].level[0].kmStart === 0 && normR34.channels[0].level[0].kmEnd === 200 &&
  normR34.channels[0].level[1].kmStart === 200 && normR34.channels[0].level[1].kmEnd === 300 &&
  normR34.channels[0].level[1].h === 0.2,
  J(normR34.channels[0].level));

// (3) สร้าง overlay บนรูปภาพ: เส้นดินเดิมสีส้ม (#fd7e14), BL สีน้ำเงิน (#0056b3), TBL สีเขียว (#28a745), ป้ายอาคารชิดซ้าย, ป้าย 3 ระดับอยู่ท้ายสุด
canvasLabels = [];
activeMediaViewTab = 'image';
pdfCropFrames = [{ id: 'fr_r34', index: 1, name: 'รูปภาพ 1', dataUrl: 'data:image/png;base64,xx', imgWidth: 1000, imgHeight: 500 }];
activeCropFrameIndex = 0;
buildAiOverlayFromResult(normR34, { frameId: 'fr_r34', frameWidth: 1000, frameHeight: 500 });
const hasGroundSeg = canvasLabels.some(l => l.kind === 'ground' && l.color === '#fd7e14');
const hasBlSeg = canvasLabels.some(l => l.kind === 'level' && l.levelType === 'BL' && l.color === '#0056b3');
const hasTblSeg = canvasLabels.some(l => l.kind === 'level' && l.levelType === 'TBL' && l.color === '#28a745');
const structLbl = canvasLabels.find(l => l.kind === 'structure');
const lastLbl = canvasLabels[canvasLabels.length - 1];
check('P12.5 Overlay มีเส้นดินเดิมสีส้ม (#fd7e14), เส้น BL สีน้ำเงิน (#0056b3), เส้น TBL สีเขียว (#28a745), ป้ายอาคารชิดซ้าย และป้าย 3 ระดับอยู่ท้ายสุด',
  hasGroundSeg && hasBlSeg && hasTblSeg && structLbl && structLbl.align === 'left' && lastLbl && lastLbl.kind === 'elev',
  J(canvasLabels.map(l => ({ kind: l.kind, color: l.color, align: l.align }))));

// (4) สถานะปุ่มแสดงแท็บขวาควบคุมสิ่งที่แสดงในรูปจริง + ปุ่มเปลี่ยนชื่อเป็น "แสดงชื่ออาคาร"
// รอบ 41: สถานะการแสดงเลเยอร์แยกต่อแท็บ → ใช้ตัวของแท็บที่กำลังดูอยู่
const visForCurTab = getOverlayVisibilityForCurrentTab();
visForCurTab.elevationLabels = false;
drawCanvasLabels(ctx);
const elevHiddenHitBox = lastLbl._hitBox;
visForCurTab.elevationLabels = true;
drawCanvasLabels(ctx);
const elevShownHitBox = lastLbl._hitBox;
const htmlForBtnCheck = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
check('P12.6 ปุ่มแท็บขวาเปิด/ปิดป้ายในรูปได้จริง และปุ่ม #btn-toggle-structures ใช้ชื่อ "แสดงชื่ออาคาร"',
  elevHiddenHitBox === null && elevShownHitBox !== null && /id="btn-toggle-structures"[^>]*>[^<]*แสดงชื่ออาคาร/.test(htmlForBtnCheck));

// (5) แท็บผลอ่าน AI แยกเป็นชุดข้อมูลภาพ แสดงตารางเหมือนแต่ละแท็บ และซิงก์รูปภาพ <-> ชุดข้อมูล
renderAiResultTab([normR34]);
const aiTabHtml = document.getElementById('tableContainer').innerHTML;
check('P12.7 แท็บผลอ่าน AI แยกชุดข้อมูลภาพ (ai-frame-dataset-card) และแสดงตารางเหมือนแต่ละแท็บ (ai-mirror-table)',
  aiTabHtml.includes('ai-frame-dataset-card') &&
  aiTabHtml.includes('ai-mirror-table') &&
  aiTabHtml.includes('ชุดข้อมูลภาพที่ 1: รูปภาพ 1') &&
  aiTabHtml.includes('บันทึกเป็นช่วงตาม กม. ที่มีค่า H'));

console.log('\n=== S1) ตรวจแบบ static: handler ที่เรียกฟังก์ชันไม่มีจริง · id ซ้ำ · ไฟล์ที่ <script src> ไม่มี ===');
  const jsAll = files.map(f => fs.readFileSync(path.join(base, f), 'utf8')).join('\n');
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const defined = new Set();
  (jsAll.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/g) || []).forEach(s => defined.add(s.replace(/^function\s+/, '').replace(/\s*\($/, '')));
  const builtins = new Set(['alert', 'confirm', 'prompt', 'parseFloat', 'parseInt', 'Number', 'String', 'Math', 'JSON', 'isNaN', 'setTimeout', 'clearTimeout']);
  const src = html + '\n' + jsAll;
  const calls = new Set();
  const re = /\bon(?:click|change|input|mousedown|mouseup)="([^"]*)"/g;
  let mm;
  while ((mm = re.exec(src))) {
    (mm[1].match(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g) || []).forEach(s => calls.add(s.replace(/\s*\($/, '')));
  }
  const missing = [...calls].filter(f => !defined.has(f) && !builtins.has(f));
  check('S1.1 ทุกฟังก์ชันใน onclick/onchange/oninput มีอยู่จริง', missing.length === 0, 'ไม่พบฟังก์ชัน: ' + missing.join(', '));
  console.log('        (สแกน ' + calls.size + ' ชื่อ · นิยามในโค้ด ' + defined.size + ' ฟังก์ชัน)');

  const idList = (html.match(/\bid="([^"]+)"/g) || []).map(s => s.replace(/\bid="|"/g, ''));
  const dupIds = idList.filter((v, i) => idList.indexOf(v) !== i);
  check('S1.2 index.html ไม่มี id ซ้ำ', dupIds.length === 0, 'id ซ้ำ: ' + dupIds.join(', '));

  // รอบ 30: ตัด query string (?v=...) ออกก่อนตรวจ — ใช้กัน cache ของเบราว์เซอร์
  const srcs = (html.match(/<script src="([^"]+)"/g) || []).map(s => s.replace(/<script src="|"/g, '').split('?')[0]);
  const missingFiles = srcs.filter(s => !/^https?:/.test(s) && /\.js$/.test(s) && !fs.existsSync(path.join(base, s)));
  check('S1.3 ไฟล์ js ที่ index.html โหลด (ในโปรเจกต์) มีอยู่จริงทุกไฟล์', missingFiles.length === 0, 'ไม่พบ: ' + missingFiles.join(', '));
  const onDisk = fs.readdirSync(path.join(base, 'js')).filter(f => f.endsWith('.js') && !f.includes('.bak'));
  const notLoaded = onDisk.filter(f => !srcs.includes('js/' + f));
  check('S1.4 ไม่มีไฟล์ js ในโฟลเดอร์ js/ ที่ถูกลืมไม่ได้โหลด', notLoaded.length === 0, 'ไม่ได้โหลด: ' + notLoaded.join(', '));

console.log('\n===== สรุป =====');
console.log('FAIL = ' + fails + ' ข้อ' + (fails === 0 ? '  ✅ ผ่านทั้งหมด (ไม่พบบั๊กตามรายการที่ตรวจ)' : ''));
process.exit(fails === 0 ? 0 : 1);

})();
