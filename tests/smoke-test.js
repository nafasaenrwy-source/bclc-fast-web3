global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});
// ===== Smoke test: รันโค้ดจริงของเว็บด้วย DOM จำลอง =====
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');
let capturedHtml = '';
let capturedSheets = [];
// ทะเบียน element จำลอง: getElementById ต้องคืน "ตัวเดิม" ทุกครั้ง
// (ของจริงเป็น DOM เดียวกัน การเขียน innerHTML ทีหลังจึงมีผลกับ element นั้น)
const mockElements = {};

function makeEl(id) {
  return {
    id: id,
    innerHTML: '',
    value: '',
    style: {},
    readOnly: false,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); }
    },
    getAttribute() { return null; },
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return makeEl('q'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    focus() {},
    select() {},
    dispatchEvent() {}
  };
}

global.window = {
  addEventListener() {},
  alert() {}
};
// FileReader จำลอง: ให้ loadProjectJSON()/importAllFromExcel() ทำงานได้ในเทสต์
let lastFileRead = null;
global.FileReader = class {
  readAsText() { if (this.onload) this.onload({ target: { result: lastFileRead } }); }
  readAsArrayBuffer() { if (this.onload) this.onload({ target: { result: lastFileRead } }); }
};
global.document = {
  getElementById(id) {
    if (!mockElements[id]) mockElements[id] = makeEl(id);
    return mockElements[id];
  },
  // คืน "ปุ่มแท็บจริง" จากทะเบียน element เพื่อให้ตรวจสถานะ active ได้
  querySelectorAll(sel) {
    if (String(sel).includes('tab-btn')) {
      const ids = ['project', 'ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'setting'];
      return ids.map(id => mockElements['tab-btn-' + id]).filter(Boolean);
    }
    return [];
  },
  querySelector() { return null; }
};
// XLSX จำลอง — ทำ "ชีต" ให้มี cell ตาม address จริง (A1, H2, ...) เหมือนไลบรารีของจริง
// เพื่อให้ทั้งฝั่ง export และ import ทำงานเหมือนเบราว์เซอร์จริง
function makeSheet(aoa) {
  const sheet = {};
  aoa.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === "" || v === null || v === undefined) return; // ช่องว่างของจริงจะไม่มี cell
      const addr = String.fromCharCode(65 + c) + (r + 1);
      sheet[addr] = { v: v, t: typeof v === 'number' ? 'n' : 's' };
    });
  });
  const maxCols = aoa.reduce((m, r) => Math.max(m, r.length), 1);
  sheet['!ref'] = 'A1:' + String.fromCharCode(64 + maxCols) + Math.max(1, aoa.length);
  return sheet;
}
const dummyPromise = { then: () => dummyPromise, catch: () => dummyPromise };
// workbook ที่เพิ่ง export — ให้ XLSX.read() คืนกลับตอนนำเข้า (เดิม mock ไม่มี read → ทาง import ล้มเหลวเงียบ ๆ
// ทำให้ข้อ "นำเข้าชีต setting แล้วได้ … เท่าเดิม" ผ่านเพราะ "ไม่มีอะไรถูกนำเข้า" ไม่ได้ทดสอบจริง)
let lastWorkbook = null;
global.XLSX = {
  utils: {
    book_new: () => { const wb = { Sheets: {}, SheetNames: [] }; lastWorkbook = wb; return wb; },
    aoa_to_sheet: (rows) => makeSheet(rows),
    book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); capturedSheets.push({ name, ws }); },
    // เลียนแบบไลบรารีจริง: แถวแรก = หัวคอลัมน์ (key ของ object) · ข้ามแถวว่างทั้งแถว · รองรับ { header: 1 }
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
    },
    decode_range: (ref) => {
      const m = String(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      const colIdx = (s) => s.split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
      if (!m) return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      return { s: { r: parseInt(m[2]) - 1, c: colIdx(m[1]) }, e: { r: parseInt(m[4]) - 1, c: colIdx(m[3]) } };
    },
    encode_cell: (o) => String.fromCharCode(65 + o.c) + (o.r + 1)
  },
  write: () => new ArrayBuffer(8),
  read: () => lastWorkbook
};
global.Blob = class { constructor(a) { this.a = a; } };
global.Image = class { constructor() { this.src = ''; this.width = 0; this.height = 0; } };
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => dummyPromise } }, writable: true, configurable: true });
global.uiPrompt = () => dummyPromise;
global.alert = () => {};

const files = [
  'js/state.js',
  'js/table-core.js',
  'js/table-sync.js',
  'js/tab-project.js',
  'js/tab-ditch.js',
  'js/tab-dimension.js',
  'js/tab-level.js',
  'js/tab-ground.js',
  'js/tab-structure.js',
  'js/tab-attachment.js',
  'js/tab-type.js',
  'js/tab-earthwork.js',
  'js/io-manager.js',
  'js/tab-export-preview.js',
  'js/ai-credit.js'
];

let code = '';
files.forEach(f => { code += fs.readFileSync(path.join(base, f), 'utf8') + '\n;\n'; });

// eval ธรรมดาไม่ทำให้ let/const ข้างในหลุดออกมาเป็นตัวแปรของเทสต์
// จึงแปลง let/const ระดับบนสุดเป็น var เพื่อเข้าถึงตัวแปรสถานะได้
code = code.replace(/^(let|const) /gm, 'var ');

// เก็บ innerHTML ที่ถูกเขียนลง tableContainer
global.__origGetById = global.document.getElementById;
global.document.getElementById = function (id) {
  const el = global.__origGetById(id);
  if (id === 'tableContainer' && !el.__hooked) {
    el.__hooked = true;
    let _html = '';
    Object.defineProperty(el, 'innerHTML', {
      get() { return _html; },
      set(v) { _html = String(v); capturedHtml = _html; },
      configurable: true
    });
  }
  return el;
};

eval(code);

// เตรียมปุ่มแท็บให้มีอยู่จริงในทะเบียน (เลียนแบบ class ที่ index.html ตั้งไว้แต่แรก)
['project', 'ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'setting']
  .forEach(id => { mockElements['tab-btn-' + id] = makeEl('tab-btn-' + id); });
mockElements['tab-btn-ditch'].classList.add('active');

// ===== ตัวช่วยอ่านตารางจาก HTML จริง (thead/tbody/td + data-field) =====
function parseTable(html) {
  const theadM = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  const tbodyM = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  const header = theadM
    ? (theadM[1].match(/<th\b[^>]*>[\s\S]*?<\/th>/g) || []).map(t => t.replace(/<[^>]+>/g, '').trim())
    : [];
  const rows = [];
  if (tbodyM) {
    const trs = tbodyM[1].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) || [];
    trs.forEach(tr => {
      const tds = tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/g) || [];
      rows.push(tds.map(td => {
        const fieldM = td.match(/data-field="([^"]+)"/);
        const valM = td.match(/\bvalue="([^"]*)"/) || td.match(/>([^<]*)</);
        const ro = /\breadonly\b/.test(td);
        const cls = (td.match(/\bclass="([^"]*)"/) || [])[1] || '';
        const inpCls = (td.match(/class="([^"]*)"/g) || [])
          .map(s => s.replace(/class="|"/g, '')).join(' ');
        return {
          field: fieldM ? fieldM[1] : null,
          value: valM ? valM[1] : '',
          readonly: ro,
          hasEditable: /\beditable\b/.test(inpCls),
          hasLocked: /\blocked\b/.test(inpCls),
          tdClass: cls
        };
      }));
    });
  }
  return { header, rows };
}

// ===== รันการทดสอบ =====
let fails = 0;
function check(label, cond, extra) {
  if (cond) { console.log('  PASS  ' + label); }
  else { fails++; console.log('  FAIL  ' + label + (extra !== undefined ? '  -> ' + extra : '')); }
}

console.log('=== 1) render ทุกแท็บต้องไม่ throw ===');
['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'setting-type', 'setting-structure'].forEach(t => {
  try {
    switchTableTab(t);
    check('render ' + t, true);
  } catch (e) {
    check('render ' + t, false, e.message);
  }
});

console.log('\n=== 2) แท็บอาคารประกอบ: ชื่อคอลัมน์และค่าเริ่มต้น ===');
switchTableTab('structure');
let structLocked = capturedHtml;
check('หัวคอลัมน์ "ความยาว (ม.)"', structLocked.includes('ความยาว (ม.)'));
check('ไม่มีหัวคอลัมน์ "จำนวนท่อ" แล้ว', !structLocked.includes('>จำนวนท่อ<'), 'ยังพบหัวคอลัมน์ จำนวนท่อ');

// ปลดล็อกกลุ่มแรก
toggleStructureGroupLock('struct_ch_1');
switchTableTab('structure');
// ⚠️ ต้องสลับแท็บก่อน แล้วจึงแก้ข้อมูล เพราะ switchTableTab() จะ sync ค่าจาก DOM ทับข้อมูล
// เพิ่มแถวที่ผู้ใช้กำหนดเอง (ไม่ใช่ boundary / ไม่ได้มาจากแท็ประดับคูส่งน้ำ)
addStructureRowAt(0);
const editRow = structureRowsData.find(r => !r.isBoundary && !r.isFromLevel);
editRow.name = 'อาคารท่อลอดถนนลดระดับ';   // ตาราง: H แก้ได้ · ศก. ท่อ แก้ได้ · ความยาว แก้ได้
updateTable();
check('หลังปลดล็อก + เลือกอาคารที่แก้ได้: คอลัมน์ H แก้ไขได้ (มี data-field="hOverride")',
  capturedHtml.includes('data-field="hOverride"'), 'ไม่พบ hOverride');
check('หลังปลดล็อก + อาคารที่แก้ได้: ศก. ท่อ และ ความยาว เป็น combobox',
  capturedHtml.includes('diaInput_') && capturedHtml.includes('countInput_'));
check('แถวที่ล็อกตามตาราง (อาคารท่อส่งน้ำเข้านา (เดิม)) แสดงข้อความว่า H ถูกล็อกตามตาราง',
  capturedHtml.includes('อาคารนี้ถูกล็อกค่า H ตามตาราง Typeอาคารประกอบ'));

// กด + เพื่อเพิ่มแถว ต้องไม่ได้ค่าคัดลอกจากแถวบน
const beforeLen = structureRowsData.length;
addStructureRowAt(0);
check('กด + แล้วจำนวนแถวเพิ่มขึ้น', structureRowsData.length === beforeLen + 1, structureRowsData.length);
const added = structureRowsData[1];
check('แถวใหม่ H ไม่คัดลอกจากแถวบน (ว่าง)', String(added.hOverride) === "", JSON.stringify(added.hOverride));
check('แถวใหม่ หมายเหตุ = ""', added.remark === '', JSON.stringify(added.remark));
check('แถวใหม่ ความยาว ไม่คัดลอกจากแถวบน (ว่าง)', String(added.pipeCount) === "", JSON.stringify(added.pipeCount));
check('แถวใหม่ ศก. ท่อ ไม่คัดลอกจากแถวบน (ว่าง)', String(added.pipeDia) === "", JSON.stringify(added.pipeDia));

console.log('\n=== 3) แท็บอาคารประกอบ: หมายเหตุ (ล็อกตามตาราง Typeอาคาร) ===');
check('แถวเริ่มต้น หมายเหตุในข้อมูล = ""', structureRowsData[0].remark === '', JSON.stringify(structureRowsData[0].remark));
check('แถวปลายคู หมายเหตุในข้อมูล = ""', structureRowsData[structureRowsData.length - 1].remark === '', JSON.stringify(structureRowsData[structureRowsData.length - 1].remark));
switchTableTab('structure');
check('อาคารที่ตารางล็อกหมายเหตุ -> ช่องหมายเหตุแสดง "-" และ readonly',
  /data-col="8"[^>]*readonly/.test(capturedHtml), 'ไม่พบช่องหมายเหตุแบบ readonly');
// อาคารปากคูซอย: หมายเหตุแก้ได้เสมอ
structureRowsData[1].name = 'อาคารปากคูซอย';
switchTableTab('structure');
check('อาคารปากคูซอย -> ช่องหมายเหตุแก้ไขได้ (ไม่ readonly)',
  !/id="[^"]*"[^>]*data-col="8"[^>]*readonly/.test(capturedHtml) && /data-col="8"/.test(capturedHtml),
  'ยังไม่เจอช่องหมายเหตุที่แก้ได้');
structureRowsData[1].name = 'อาคารท่อลอดถนนลดระดับ';
switchTableTab('structure');

console.log('\n=== 4) แท็บใหม่: โครงสร้างตาราง ===');
switchTableTab('attachment');
const attHtml = capturedHtml;
['คลองส่งน้ำ', 'คูส่งน้ำ', 'รายการอาคาร', 'จำนวนอาคาร', 'H (ม.)', 'ศก. ท่อ (ม.)', 'ความยาว (ม.)', 'หมายเหตุ'].forEach(h => {
  check('มีหัวคอลัมน์ ' + h, attHtml.includes('>' + h + '<'));
});
check('ไม่มีหัวคอลัมน์ "ประเภทอาคาร" แล้ว', !attHtml.includes('>ประเภทอาคาร<'), 'ยังพบหัวคอลัมน์ ประเภทอาคาร');
check('ไม่มีคอลัมน์ "รายการอาคาร" ที่คำนวณอัตโนมัติซ้ำ', (attHtml.match(/>รายการอาคาร</g) || []).length === 1, (attHtml.match(/>รายการอาคาร</g) || []).length);
check('ดึงคลองส่งน้ำ/คูส่งน้ำจากแท็บมิติ (แสดงชื่อคู)', attHtml.includes('01'));

console.log('\n=== 5) แท็บใหม่: แถวแรก + ลิสต์รายการอาคาร ===');
check('แถวแรกเป็น อาคารท่อรับน้ำเข้าแปลงไร่นา', attachmentRowsData[0].name === 'อาคารท่อรับน้ำเข้าแปลงไร่นา', attachmentRowsData[0].name);
const attOpts = getAttachmentTypeOptions();
check('ลิสต์ตัด อาคารท่อรับน้ำเข้าแปลงไร่นา ออก', !attOpts.includes('อาคารท่อรับน้ำเข้าแปลงไร่นา'), JSON.stringify(attOpts));
check('ลิสต์มี 5 ตัว (แต่ละแบบมีทั้งปกติ/ลดระดับ)', attOpts.length === 5, attOpts.length);
check('ลิสต์มี "อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ"', attOpts.includes('อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ'));

console.log('\n=== 6) กฎล็อก/แก้ไข H ของแต่ละรายการอาคาร ===');
const cases = [
  ['อาคารท่อรับน้ำเข้าแปลงไร่นา', { h: false, dia: false, len: false }],
  ['อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ', { h: true, dia: false, len: false }],
  ['อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 1', { h: false, dia: false, len: true }],
  ['อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 1', { h: true, dia: false, len: true }],
  ['อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 2', { h: false, dia: false, len: true }],
  ['อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 2', { h: true, dia: false, len: true }]
];
cases.forEach(([name, exp]) => {
  const r = getAttachmentRule(name);
  check('กฎ ' + name, r.h === exp.h && r.dia === exp.dia && r.len === exp.len, JSON.stringify(r));
});
check('ลิสต์ขนาดท่อ (ศก. ท่อ) มีให้เลือก', Array.isArray(pipeDiameterOptions) && pipeDiameterOptions.length > 0, pipeDiameterOptions.length);

console.log('\n=== 7) ปุ่ม + ในแท็บใหม่ + ค่าเริ่มต้น + ไฮไลต์สีเขียว ===');
// ⚠️ แท็บอาคารท่อรับน้ำตั้งต้นเป็น "ล็อกทุกชุด" — ต้องกดปุ่มล็อกที่คอลัมน์คลองส่งน้ำก่อน
switchTableTab('attachment');
if (attachmentAllLocked()) toggleAttachmentGroupLock('attach_ch_1');
check('ปลดล็อกชุดข้อมูลก่อนทดสอบการแก้ไข', attachmentAllLocked() === false);
const nBefore = attachmentRowsData.length;
addAttachmentRowAt(0);
check('กด + แล้วเพิ่มแถว', attachmentRowsData.length === nBefore + 1, attachmentRowsData.length);
const newAtt = attachmentRowsData[1];
check('แถวใหม่: รายการอาคารเริ่มต้นจากลิสต์', attOpts.includes(newAtt.name), newAtt.name);
check('แถวใหม่: จำนวนอาคาร = 1', newAtt.count === '1', JSON.stringify(newAtt.count));
check('แถวใหม่: ความยาว = 1.00', newAtt.length === '1.00', JSON.stringify(newAtt.length));
check('แถวใหม่: h = 0.00', newAtt.h === '0.00', newAtt.h);
check('แถวใหม่: remark = ""', newAtt.remark === '');
switchTableTab('attachment');
check('มีคลาส editable (ไฮไลต์สีเขียว) ในตาราง', capturedHtml.includes('table-input editable'));
check('แถวที่เพิ่ม: H แก้ไขได้ / ศก. ท่อ ล็อก ตามกฎ', getAttachmentRule(newAtt.name).h === true && getAttachmentRule(newAtt.name).dia === false);
check('แถวแรก H ถูกล็อก', /id="attHInput_0"[^>]*readonly/.test(capturedHtml));
check('แถวแรก ศก. ท่อ ถูกล็อก', /id="attDiaInput_0"[^>]*readonly/.test(capturedHtml));
const countInputs = (capturedHtml.match(/data-field="count"/g) || []).length;
check('จำนวนอาคารมีทุกแถว (2 แถว = 2 ช่อง)', countInputs === 2, countInputs);
deleteAttachmentRowAt(1);
check('ลบแถวได้', attachmentRowsData.length === nBefore, attachmentRowsData.length);
deleteAttachmentRowAt(0);
check('ลบแถวแรกไม่ได้', attachmentRowsData.length === nBefore, attachmentRowsData.length);

console.log('\n=== 8.1) แท็บอาคารประกอบ: ศก. ท่อ / ความยาว เปลี่ยนสถานะตามตาราง Typeอาคาร ===');
structureRowsData[1].name = 'อาคารท่อลอดถนนลดระดับ';   // ตาราง: ศก.ท่อ แก้ได้ + ความยาว แก้ได้
switchTableTab('structure');
check('อาคารที่ตารางบอกว่าแก้ได้ -> ศก. ท่อ เป็น combobox', capturedHtml.includes('diaInput_1'));
check('อาคารที่ตารางบอกว่าแก้ได้ -> ความยาว เป็น combobox', capturedHtml.includes('countInput_1'));
structureRowsData[1].name = 'ปลายคู';                  // ตาราง: ล็อกทั้ง H / ศก.ท่อ / ความยาว
switchTableTab('structure');
check('อาคารที่ตารางบอกว่าล็อก (ปลายคู) -> ศก. ท่อ ไม่เป็น combobox',
  !capturedHtml.includes('diaInput_1'), 'ยังพบ diaInput_1');
check('อาคารที่ตารางบอกว่าล็อก (ปลายคู) -> ความยาว ไม่เป็น combobox',
  !capturedHtml.includes('countInput_1'), 'ยังพบ countInput_1');
structureRowsData[1].name = 'อาคารท่อลอดถนนลดระดับ';
switchTableTab('structure');

console.log('\n=== 8) setting: แท็บย่อย ===');
switchSettingsSubTab('setting-structure');
check('currentTab = setting-structure', currentTab === 'setting-structure', currentTab);
check('settingsSubTab = structure', settingsSubTab === 'structure', settingsSubTab);
check('ตาราง Typeอาคารประกอบมีหัวคอลัมน์ "ประเภทอาคาร"', capturedHtml.includes('>ประเภทอาคาร<'));
check('structureTypeDatabase มี 26 รายการ (ตามรูป + อาคารปลายคูส่งน้ำแบบที่ 1/2)',
  structureTypeDatabase.length === 26, structureTypeDatabase.length);
check('แทรก อาคารปลายคูส่งน้ำแบบที่ 1/2 ใต้ ปลายคู เรียงถูก และข้อมูลเหมือนกันทุกช่อง',
  (function () {
    const i = structureTypeDatabase.findIndex(t => t.type === 'ปลายคู');
    if (i < 0) return false;
    const a = structureTypeDatabase[i + 1], b = structureTypeDatabase[i + 2];
    if (!a || !b) return false;
    return a.type === 'อาคารปลายคูส่งน้ำแบบที่ 1' && b.type === 'อาคารปลายคูส่งน้ำแบบที่ 2' &&
      JSON.stringify([a.h, a.hEditable, a.pipeDia, a.diaEditable, a.length, a.lenEditable, a.remark, a.remarkEditable]) ===
      JSON.stringify([b.h, b.hEditable, b.pipeDia, b.diaEditable, b.length, b.lenEditable, b.remark, b.remarkEditable]);
  })(),
  (function () {
    const i = structureTypeDatabase.findIndex(t => t.type === 'ปลายคู');
    return structureTypeDatabase.slice(i + 1, i + 3).map(t => t.type).join(' | ');
  })());
switchSettingsSubTab('setting-type');
check('currentTab = setting-type', currentTab === 'setting-type', currentTab);
check('ตาราง Typeคูส่งน้ำมี 5 หัวคอลัมน์ (เพิ่มความหนา 2 คอลัมน์)', capturedHtml.includes('>Type<') && capturedHtml.includes('ความหนากำแพง (ม.)') && capturedHtml.includes('ความหนาพื้น (ม.)'));
check('ditchTypeDatabase เหลือเฉพาะ VU1–VU6 (6 รายการ)',
  ditchTypeDatabase.length === 6 && ditchTypeDatabase.map(d => d.type).join(',') === 'VU1,VU2,VU3,VU4,VU5,VU6',
  ditchTypeDatabase.map(d => d.type).join(','));

console.log('\n=== 9) Copy ข้อมูลทุกแท็บต้องไม่ throw ===');
['ditch', 'dimension', 'level', 'ground', 'structure', 'attachment', 'setting-type', 'setting-structure'].forEach(t => {
  try {
    currentTab = t;
    copyTableData();
    check('copy ' + t, true);
  } catch (e) {
    check('copy ' + t, false, e.message);
  }
});

console.log('\n=== 9) รอบ 8: ตาราง Typeคูส่งน้ำ มี 2 คอลัมน์ความหนา ===');
switchSettingsSubTab('setting-type');
const typeT = parseTable(capturedHtml);
console.log('  [header] ' + typeT.header.join(' | '));
check('หัวคอลัมน์มี 5 ช่อง', typeT.header.length === 5, typeT.header.length);
check('หัวคอลัมน์ ความหนากำแพง (ม.)', typeT.header.includes('ความหนากำแพง (ม.)'));
check('หัวคอลัมน์ ความหนาพื้น (ม.)', typeT.header.includes('ความหนาพื้น (ม.)'));
check('แถว VU1 ครบ 5 ช่อง', typeT.rows[0] && typeT.rows[0].length === 5, typeT.rows[0] && typeT.rows[0].length);
check('VU1 B=0.35 H=0.50 หนากำแพง=0.10 หนาพื้น=0.10',
  typeT.rows[0][1].value === '0.35' && typeT.rows[0][2].value === '0.50' &&
  typeT.rows[0][3].value === '0.10' && typeT.rows[0][4].value === '0.10',
  typeT.rows[0].map(c => c.value).join(','));
check('database มี tw/tf ครบทุกแถว', ditchTypeDatabase.every(d => !isNaN(parseFloat(d.tw)) && !isNaN(parseFloat(d.tf))));

console.log('\n=== 10) รอบ 8: แท็บใหม่ — ศก. ท่อ ล็อก + ค่าเริ่มต้นตามรายการอาคาร ===');
check('ค่าเริ่มต้น 4 รายการแรก = 0.20',
  getAttachmentPipeDia({ name: structureOptions[1] }) === '0.20' &&
  getAttachmentPipeDia({ name: structureOptions[2] }) === '0.20' &&
  getAttachmentPipeDia({ name: structureOptions[3] }) === '0.20' &&
  getAttachmentPipeDia({ name: structureOptions[4] }) === '0.20',
  [1, 2, 3, 4].map(i => getAttachmentPipeDia({ name: structureOptions[i] })).join(','));
check('ค่าเริ่มต้น 2 รายการสุดท้าย = 0.15',
  getAttachmentPipeDia({ name: structureOptions[5] }) === '0.15' &&
  getAttachmentPipeDia({ name: structureOptions[6] }) === '0.15',
  [5, 6].map(i => getAttachmentPipeDia({ name: structureOptions[i] })).join(','));
check('แถวแรก (อาคารท่อรับน้ำเข้าแปลงไร่นา) = 0.20', getAttachmentPipeDia({ name: ATTACHMENT_BASE_NAME }) === '0.20');

const nA = attachmentRowsData.length;
addAttachmentRowAt(0);
addAttachmentRowAt(1);
addAttachmentRowAt(2);
switchTableTab('attachment');
const attT = parseTable(capturedHtml);
console.log('  [header] ' + attT.header.join(' | '));
console.log('  [cols/row] ' + attT.rows.map(r => r.length).join(','));
check('ตารางมี 9 คอลัมน์ (รอบ 47 เพิ่มคอลัมน์ ช่วงคูน้ำ)', attT.header.length === 9 && attT.header[8] === 'ช่วงคูน้ำ', attT.header.join(','));
// ตรวจ DOM จริง: holder ของลิสต์ "รายการอาคาร" ต้องถูกเติม combobox หลัง render
const holder1 = mockElements['attTypeCell_1'] ? mockElements['attTypeCell_1'].innerHTML : '';
check('แถวที่เพิ่ม: holder รายการอาคาร มี combobox (ไม่มีคลาส editable แล้ว)',
  !!holder1 && holder1.includes('combobox-input') && !holder1.includes('editable') && holder1.includes('attNameInput_1'), holder1.slice(0, 140));
const holder0 = mockElements['attTypeCell_0'] ? mockElements['attTypeCell_0'].innerHTML : '';
check('แถวแรก: holder รายการอาคาร ว่าง (เป็นช่องล็อกในแถว)', holder0 === '', holder0.slice(0, 80));
check('แถวที่เพิ่ม รายการอาคาร = combobox (ตรวจจาก holder ที่ render จริง)',
  !!holder1 && holder1.includes('combobox-input') && holder1.includes('attNameInput_1'));
check('แถวแรก รายการอาคาร ถูกล็อก (ไม่มี combobox)',
  attT.rows[0][2].hasLocked && attT.rows[0][2].readonly && attT.rows[0][2].value === 'อาคารท่อรับน้ำเข้าแปลงไร่นา',
  JSON.stringify(attT.rows[0][2]));
check('ทุกแถวมี 9 ช่องเท่ากัน (จำนวนอาคารและช่วงคูน้ำมีทุกแถว)', attT.rows.every(r => r.length === 9), attT.rows.map(r => r.length).join(','));
check('ทุกแถว ศก. ท่อ ถูกล็อก', attT.rows.every(r => r[5].readonly && r[5].hasLocked), attT.rows.map(r => r[5].readonly).join(','));
check('ทุกแถว ศก. ท่อ มีค่า (0.20/0.15)', attT.rows.every(r => r[5].value === '0.20' || r[5].value === '0.15'), attT.rows.map(r => r[5].value).join(','));
check('ทุกแถว จำนวนอาคาร = 1', attT.rows.every(r => r[3].value === '1'), attT.rows.map(r => r[3].value).join(','));
check('ทุกแถว จำนวนอาคาร แก้ไขได้', attT.rows.every(r => r[3].hasEditable && !r[3].readonly));
check('แถวแรก รายการอาคาร ไม่มีสีเขียว', attT.rows[0][2].hasLocked && !attT.rows[0][2].hasEditable);
check('แถวที่เพิ่ม: holder รายการอาคาร ไม่มีคลาส editable (ตามที่สั่ง)',
  !holder1.includes('editable'));
check('แถวแรก ความยาว = 1.00', attT.rows[0][6].value === '1.00', attT.rows[0][6].value);
while (attachmentRowsData.length > nA) attachmentRowsData.pop();
switchTableTab('attachment');

console.log('\n=== 11) รอบ 8/12: โครงสร้างแถบแท็บ 2 แถว ===');
const htmlSrc = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(base, 'style.css'), 'utf8');
check('index.html มี tabs-row-scroll', htmlSrc.includes('class="tabs-row-scroll"'));
check('มี tabs-row-scroll ครั้งเดียว และครอบแท็บหลักทั้งหมด',
  (htmlSrc.match(/class="tabs-row-scroll"/g) || []).length === 1 &&
  htmlSrc.indexOf('tabs-row-scroll') < htmlSrc.indexOf('tab-btn-ditch') &&
  htmlSrc.indexOf('tab-btn-setting') < htmlSrc.indexOf('id="settingsSubTabsBar"'));
check('มี .tabs-area ครอบทั้ง 2 แถว',
  htmlSrc.includes('class="tabs-area"') &&
  htmlSrc.indexOf('class="tabs-area"') < htmlSrc.indexOf('class="table-tabs-header"'));
check('settingsSubTabsBar อยู่นอก table-tabs-header (เป็นแถวที่ 2 จริง)',
  htmlSrc.indexOf('id="settingsSubTabsBar"') > htmlSrc.indexOf('class="table-tabs-header"') &&
  htmlSrc.indexOf('id="settingsSubTabsBar"') > htmlSrc.indexOf('tab-btn-setting'));
check('CSS: .tabs-area เป็นกล่อง 2 แถว (flex column)',
  /\.tabs-area\s*\{[^}]*flex-direction:\s*column/.test(cssSrc));
check('CSS: .table-tabs-header เป็นแถวที่ 1 (มี border-bottom + พื้นเทา)',
  /\.table-tabs-header\s*\{[^}]*border-bottom:\s*1px solid #ced4da/.test(cssSrc) &&
  /\.table-tabs-header\s*\{[^}]*background:\s*#f1f3f5/.test(cssSrc) &&
  !/\.table-tabs-header\s*\{[^}]*overflow-x/.test(cssSrc));
check('CSS: .tabs-row-scroll มี overflow-x auto', /\.tabs-row-scroll\s*\{[^}]*overflow-x:\s*auto/.test(cssSrc));
check('CSS: .settings-subtabs-bar เป็นบล็อกของตัวเอง (มี border-top + padding)',
  /\.settings-subtabs-bar\s*\{[^}]*border-top:\s*1px solid #dee2e6/.test(cssSrc) &&
  /\.settings-subtabs-bar\s*\{[^}]*padding:\s*8px 10px/.test(cssSrc) &&
  !/\.settings-subtabs-bar\s*\{[^}]*margin-bottom:\s*-/.test(cssSrc));
check('CSS: subtab-btn เป็นชิปมุมมน (border-radius 13px)',
  /\.subtab-btn\s*\{[^}]*border-radius:\s*13px/.test(cssSrc));
check('CSS: subtab active เป็นสี teal #17a2b8 (ตามรูป)',
  /\.subtab-btn\.active\s*\{[^}]*#17a2b8/.test(cssSrc));

console.log('\n=== 12) รอบ 9: แท็บมิติคูส่งน้ำ — ลิสต์ Q และ SLOPE ===');
check('qOptions ตามรูป (0.03…0.18)', JSON.stringify(qOptions) === JSON.stringify(['0.03', '0.06', '0.09', '0.12', '0.15', '0.18']), JSON.stringify(qOptions));
check('slopeOptions ตามรูป (500…4000)', JSON.stringify(slopeOptions) === JSON.stringify(['500', '1000', '1500', '2000', '2500', '3000', '3500', '4000']), JSON.stringify(slopeOptions));

switchTableTab('dimension');
check('ช่อง Q เป็น combobox (มี id qInput_0)', capturedHtml.includes('id="qInput_0"'));
check('ช่อง SLOPE เป็น combobox (มี id slopeInput_0)', capturedHtml.includes('id="slopeInput_0"'));
check('Q ยังมี data-field="q" (ซิงก์ข้อมูลได้)', /data-field="q"/.test(capturedHtml));
check('SLOPE ยังมี data-field="slope" (ซิงก์ข้อมูลได้)', /data-field="slope"/.test(capturedHtml));
// อ่าน attribute ของ input จาก "แท็กของ input นั้น" โดยตรง
// (ห้ามใช้ [^>]* ข้ามแท็ก เพราะมีตัวอักษร ▼ ซึ่งเป็น > ใน span ก่อนหน้า)
function inputTagById(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i === -1) return null;
  const start = html.lastIndexOf('<', i);
  const end = html.indexOf('>', i);
  return (start === -1 || end === -1) ? null : html.slice(start, end + 1);
}
const qTag = inputTagById(capturedHtml, 'qInput_0');
const sTag = inputTagById(capturedHtml, 'slopeInput_0');
check('Q ยังแก้ไขได้ (combobox-input ไม่ readonly)',
  !!qTag && qTag.includes('combobox-input') && !/\breadonly\b/.test(qTag), qTag);
check('SLOPE ยังแก้ไขได้ (combobox-input ไม่ readonly)',
  !!sTag && sTag.includes('combobox-input') && !/\breadonly\b/.test(sTag), sTag);
check('ลิสต์ Q มี option ตามรูป', qOptions.every(q => capturedHtml.includes(`value="${q}"`)));
check('ลิสต์ SLOPE มี option ตามรูป', slopeOptions.every(s => capturedHtml.includes(`value="${s}"`)));
check('TYPE ในแท็บมิติ ดึงจาก Typeคูส่งน้ำ (ตรงกับ ditchTypeDatabase)',
  ditchTypeDatabase.every(d => capturedHtml.includes(`value="${d.type}"`)), ditchTypeDatabase.map(d => d.type).join(','));

// เก็บค่าได้จริง
const qBefore = dimensionRows[0].q, sBefore = dimensionRows[0].slope;
updateDimensionField(0, 'q', '0.12');
updateDimensionField(0, 'slope', '2500');
check('เลือก Q = 0.12 แล้วเก็บค่าได้', Number(dimensionRows[0].q) === 0.12, dimensionRows[0].q);
check('เลือก SLOPE = 2500 แล้วเก็บค่าได้', Number(dimensionRows[0].slope) === 2500, dimensionRows[0].slope);
check('เปลี่ยน TYPE ได้', (function () { updateDimensionField(0, 'type', 'VU3'); return dimensionRows[0].type === 'VU3'; })(), dimensionRows[0].type);
dimensionRows[0].q = qBefore; dimensionRows[0].slope = sBefore;

console.log('\n=== 14) รอบ 10: เอาสีเขียวออกจาก รายการอาคาร + ปุ่ม +/− ของ Type ===');
switchTableTab('attachment');
const nB10 = attachmentRowsData.length;
addAttachmentRowAt(0);
switchTableTab('attachment');
const holder10 = mockElements['attTypeCell_1'] ? mockElements['attTypeCell_1'].innerHTML : '';
check('ลิสต์ รายการอาคาร ไม่มีคลาส editable (ไม่มีสีเขียว)',
  !!holder10 && holder10.includes('combobox-input') && !holder10.includes('editable'), holder10.slice(0, 140));
check('ลิสต์ รายการอาคาร ยังเลือกได้ (มี select)', holder10.includes('combobox-select'));
check('CSS: .combobox-input.editable ยังมีสีเขียว (ไม่ต้องลบทั้งคลาส)', /combobox-input\.editable/.test(cssSrc));
deleteAttachmentRowAt(1);
check('คืนจำนวนแถวเดิมได้', attachmentRowsData.length === nB10, attachmentRowsData.length);

switchSettingsSubTab('setting-type');
const typeT10 = parseTable(capturedHtml);
console.log('  [rows] ' + typeT10.rows.length + ' แถว · [header] ' + typeT10.header.join(' | '));
check('ตาราง Typeคูส่งน้ำเหลือ 6 แถว (VU1–VU6)', typeT10.rows.length === 6, typeT10.rows.length);

// ตัดช่วง HTML ของแต่ละแถวออกมาตรวจปุ่ม (แถวสุดท้ายต้องมีแค่ +)
function typeRowSegment(typeName) {
  const i = capturedHtml.indexOf('value="' + typeName + '"');
  if (i === -1) return null;
  const end = capturedHtml.indexOf('</tr>', i);
  return capturedHtml.slice(i, end === -1 ? i + 500 : end);
}
// หมายเหตุ: กฎปุ่มของตาราง Type ตรวจละเอียดอยู่ในหัวข้อ 16 ข้างล่างแล้ว
// (VU1–VU5 ไม่มีปุ่ม · VU6 มีแค่ + · แถวที่เพิ่มมาทีหลังมี + และ -)
const segVU6 = typeRowSegment('VU6');
check('แถวสุดท้าย VU6 มีเฉพาะปุ่ม +',
  !!segVU6 && segVU6.includes('btn-row-add') && !segVU6.includes('btn-row-del'),
  segVU6 ? (segVU6.match(/btn-row-(add|del)/g) || []).join(',') : 'ไม่พบแถว VU6');

// แถวที่เพิ่มมาทีหลังตรวจละเอียดในหัวข้อ 16 — ที่นี่ตรวจแค่ว่าเพิ่ม/ลบได้และกลับมาครบ 6
addDitchTypeRow();
switchSettingsSubTab('setting-type');
check('Typeคูส่งน้ำมี 7 แถวหลังกด +', ditchTypeDatabase.length === 7, ditchTypeDatabase.length);
addDitchTypeRow();
switchSettingsSubTab('setting-type');
const segNew2 = typeRowSegment(ditchTypeDatabase[7].type);
check('แถวที่เพิ่มมาซึ่งไม่ใช่แถวสุดท้าย มีทั้ง + และ -',
  !!segNew2 && segNew2.includes('btn-row-add') && segNew2.includes('btn-row-del'),
  segNew2 ? (segNew2.match(/btn-row-(add|del)/g) || []).join(',') : 'ไม่พบแถว');
deleteDitchTypeRow(7);
deleteDitchTypeRow(6);
check('ลบแถวที่เพิ่มได้ กลับมา 6 แถว', ditchTypeDatabase.length === 6, ditchTypeDatabase.length);

console.log('\n=== 16) รอบ 11: ปุ่ม +/− ของ Typeคูส่งน้ำ (ตามรูป 9) ===');
const segType = n => typeRowSegment(n);
switchSettingsSubTab('setting-type');
['VU1', 'VU2', 'VU3', 'VU4', 'VU5'].forEach(n => {
  const seg = segType(n);
  check('แถว ' + n + ' ไม่มีปุ่ม', !!seg && !seg.includes('btn-row-add') && !seg.includes('btn-row-del'),
    seg ? (seg.match(/btn-row-\w+/g) || []).join(',') : 'ไม่พบแถว');
});
check('แถว VU6 มีเฉพาะ +',
  (function () { const s = segType('VU6'); return !!s && s.includes('btn-row-add') && !s.includes('btn-row-del'); })(),
  (function () { const s = segType('VU6'); return s ? (s.match(/btn-row-\w+/g) || []).join(',') : 'ไม่พบ'; })());

addDitchTypeRow();
switchSettingsSubTab('setting-type');
const newTypeName = ditchTypeDatabase[6].type;
const segNewT = typeRowSegment(newTypeName);
check('แถวที่เพิ่มมาทีหลัง (' + newTypeName + ') มี + และ -',
  !!segNewT && segNewT.includes('btn-row-add') && segNewT.includes('btn-row-del'),
  segNewT ? (segNewT.match(/btn-row-\w+/g) || []).join(',') : 'ไม่พบแถว');
check('ลบได้เฉพาะแถวที่เพิ่มเอง', (function () {
  const before = ditchTypeDatabase.length;
  deleteDitchTypeRow(0);                       // พยายามลบ VU1 → ต้องไม่เกิดอะไร
  const afterBuiltin = ditchTypeDatabase.length;
  deleteDitchTypeRow(6);                       // ลบแถวที่เพิ่ม → ต้องได้
  return afterBuiltin === before && ditchTypeDatabase.length === before - 1;
})(), ditchTypeDatabase.map(d => d.type).join(','));

console.log('\n=== 17) รอบ 11: ปุ่ม +/− ของ Typeอาคารประกอบ ===');
switchSettingsSubTab('setting-structure');
function structRowSegment(name) {
  const i = capturedHtml.indexOf('value="' + name + '"');
  if (i === -1) return null;
  const end = capturedHtml.indexOf('</tr>', i);
  return capturedHtml.slice(i, end === -1 ? i + 500 : end);
}
const lastStruct = structureTypeDatabase[structureTypeDatabase.length - 1].type;
check('แถวสุดท้ายของชุดเดิม (' + lastStruct + ') มีเฉพาะ +',
  (function () { const s = structRowSegment(lastStruct); return !!s && s.includes('btn-row-add') && !s.includes('btn-row-del'); })(),
  (function () { const s = structRowSegment(lastStruct); return s ? (s.match(/btn-row-\w+/g) || []).join(',') : 'ไม่พบ'; })());
check('แถวกลาง ๆ ของชุดเดิม ไม่มีปุ่ม',
  (function () { const s = structRowSegment(structureTypeDatabase[0].type); return !!s && !s.includes('btn-row-add') && !s.includes('btn-row-del'); })());

addStructureTypeRow();
switchSettingsSubTab('setting-structure');
const addedStruct = structureTypeDatabase[structureTypeDatabase.length - 1].type;
const segAdded = structRowSegment(addedStruct);
check('แถวที่เพิ่มมาทีหลัง (' + addedStruct + ') มี + และ -',
  !!segAdded && segAdded.includes('btn-row-add') && segAdded.includes('btn-row-del'),
  segAdded ? (segAdded.match(/btn-row-\w+/g) || []).join(',') : 'ไม่พบแถว');
check('ทุกแถวในตารางเป็น object ที่มี .type เป็น string',
  structureTypeDatabase.every(t => t && typeof t.type === 'string' && t.type !== ""), typeof structureTypeDatabase[0].type);
check('getStructureTypeOptions() คืนชื่อครบทุกแถว',
  getStructureTypeOptions().length === structureTypeDatabase.length &&
  getStructureTypeOptions().includes(addedStruct), getStructureTypeOptions().length + ' ตัว');
deleteStructureTypeRow(structureTypeDatabase.length - 1);
check('ลบแถวที่เพิ่มได้', structureTypeDatabase.length === 26, structureTypeDatabase.length);

console.log('\n=== 18) รอบ 11: โหลดไฟล์ JSON ที่มี Type ของ setting (บั๊กเดิม) ===');
const backupDitch = JSON.parse(JSON.stringify(ditchTypeDatabase));
const backupStruct = JSON.parse(JSON.stringify(structureTypeDatabase));
let loadErr = null;
try {
  lastFileRead = JSON.stringify({
    version: "2.0",
    ditchTypeDatabase: [{ type: "VU1", b: 0.35, h: 0.50 }, { type: "VU2", b: 0.50, h: 0.55, tw: 0.12, tf: 0.15 }],
    // จำลองไฟล์เก่าที่เก็บชื่ออาคารเป็น string ล้วน
    structureTypeDatabase: ["อาคารทดสอบ ก", "อาคารทดสอบ ข"],
    channels: [{ id: 1, canal: "คลอง", ditch: "01", totalArea: "", waterArea: "", rows: [] }]
  });
  loadProjectJSON({ target: { files: [{}], value: '' } });
} catch (e) {
  loadErr = e;
}
check('loadProjectJSON() ไม่ throw', loadErr === null, loadErr && loadErr.message);
check('โหลด ditchTypeDatabase ได้', !loadErr && ditchTypeDatabase.length === 2 && ditchTypeDatabase[1].tw === 0.12, ditchTypeDatabase.length);
check('โหลด structureTypeDatabase (ไฟล์เก่าเป็น string) แล้วแปลงเป็น object ได้',
  !loadErr && structureTypeDatabase.length === 2 &&
  structureTypeDatabase[0].type === 'อาคารทดสอบ ก' && typeof structureTypeDatabase[0] === 'object',
  JSON.stringify(structureTypeDatabase[0]));

// คืนค่ากลับเป็นชุดตั้งต้น เพื่อไม่ให้กระทบเทสต์อื่น
ditchTypeDatabase = backupDitch;
structureTypeDatabase = backupStruct;
// ===== คืนค่าสถานะกลางให้เป็น "ชุดตั้งต้น" ด้วย =====
// (ตอนนี้ loadProjectJSON() ล้างก้อนข้อมูลที่ไฟล์ไม่มีจริงแล้ว → เทสต์ต้องไม่พึ่งข้อมูลที่ "รั่ว" มาจากโปรเจกต์เดิม)
channels = [{ id: 1, canal: "คลอง", ditch: "01", totalArea: "", waterArea: "", collapsed: false, rows: [] }];
dimensionRows = [{ channelId: 1, kmStart: 0, kmEnd: 100, q: 0.030, slope: 4000, b: 0.35, d: 0.36, type: "VU1", tbl: 0.50, tbr: 0.50 }];
levelRowsData = [{ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: "", customKmEnd: "", h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" }];
groundRowsData = [
  { channelId: 1, isDynamicRow: false, isBoundary: true, km: 0, groundElevation: "" },
  { channelId: 1, isDynamicRow: false, isBoundary: true, km: 100, groundElevation: "" }
];
structureRowsData = [
  { channelId: 1, isBoundary: true, isEndBoundary: false, km: 0, name: "อาคารท่อส่งน้ำเข้านา (เดิม)", pipeDia: "0.00", pipeCount: "0.00", remark: "" },
  { channelId: 1, isBoundary: true, isEndBoundary: true, km: 100, name: "ปลายคู", pipeDia: "0.00", pipeCount: "0.00", remark: "" }
];
attachmentRowsData = [{ channelId: 1, km: 0, name: ATTACHMENT_BASE_NAME, h: "0.00", pipeDia: "0.20", length: "1.00", count: "1", remark: "" }];
levelGroupState = {}; groundGroupState = {}; structureGroupState = {}; attachmentGroupState = {};
activeChannelId = 1;
syncDimensionRowsWithChannels();
switchSettingsSubTab('setting-type');

console.log('\n=== 19) Excel export ต้องมีครบทุกชีต ===');
try {
  currentTab = 'ditch';
  exportAllToExcel({ skipPreview: true, skipValidate: true });
  setTimeout(() => {
    const names = capturedSheets.map(s => s.name);
    console.log('  ชีตที่ export: ' + names.join(' | '));
    check('มีชีต อาคารท่อรับน้ำเข้าแปลงไร่นา', names.includes('อาคารท่อรับน้ำเข้าแปลงไร่นา'));
    check('มีชีต setting', names.includes('setting'));
    check('ไม่มีชีต Typeคูส่งน้ำ แยกต่างหาก', !names.includes('Typeคูส่งน้ำ'));
    const setting = capturedSheets.find(s => s.name === 'setting');
    if (setting) {
      const ws = setting.ws;
      const cellTxt = (addr) => (ws[addr] && ws[addr].v !== undefined) ? String(ws[addr].v) : "";
      console.log('  [setting] A1=' + cellTxt('A1') + ' | G1="' + cellTxt('G1') + '" | H1=' + cellTxt('H1'));
      console.log('  [setting] A2=' + cellTxt('A2') + ' C2=' + cellTxt('C2') + ' F2=' + cellTxt('F2') + ' | H2=' + cellTxt('H2'));
      console.log('  [setting] H' + (1 + structureTypeDatabase.length) + '=' + cellTxt('H' + (1 + structureTypeDatabase.length)));

      // ตารางที่ 1: Typeคูส่งน้ำ (A–F)
      check('A1 = Typeคูส่งน้ำ', cellTxt('A1') === 'Typeคูส่งน้ำ', cellTxt('A1'));
      check('C1..F1 = B / H / ความหนากำแพง / ความหนาพื้น',
        cellTxt('C1') === 'B (ม.)' && cellTxt('D1') === 'H (ม.)' &&
        cellTxt('E1') === 'ความหนากำแพง (ม.)' && cellTxt('F1') === 'ความหนาพื้น (ม.)');
      check('A2 = VU1 และมี 6 แถว (A2..A7 = VU1..VU6)',
        cellTxt('A2') === 'VU1' && cellTxt('A7') === 'VU6', cellTxt('A2') + '..' + cellTxt('A7'));
      check('C2/F2 มีค่าตามตาราง', cellTxt('C2') === '0.35' && cellTxt('F2') === '0.1',
        cellTxt('C2') + '/' + cellTxt('F2'));

      // คอลัมน์ B และ G ต้องว่าง
      let bEmpty = true, gEmpty = true;
      for (let r = 1; r <= ws['!ref'].match(/(\d+)$/)[1]; r++) {
        if (cellTxt('B' + r) !== "") bEmpty = false;
        if (cellTxt('G' + r) !== "") gEmpty = false;
      }
      check('คอลัมน์ B ว่างทั้งคอลัมน์', bEmpty, 'B2=' + cellTxt('B2'));
      check('คอลัมน์ G ว่างทั้งคอลัมน์ (เว้น 1 คอลัมน์คั่น)', gEmpty, 'G2=' + cellTxt('G2'));

      // ตารางที่ 2: Typeอาคารประกอบ (H–L)
      check('H1..L1 = ประเภทอาคาร / H (ม.) / ศก. ท่อ (ม.) / ความยาว (ม.) / หมายเหตุ',
        cellTxt('H1') === 'ประเภทอาคาร' && cellTxt('I1') === 'H (ม.)' &&
        cellTxt('J1') === 'ศก. ท่อ (ม.)' && cellTxt('K1') === 'ความยาว (ม.)' && cellTxt('L1') === 'หมายเหตุ',
        [cellTxt('H1'), cellTxt('I1'), cellTxt('J1'), cellTxt('K1'), cellTxt('L1')].join('|'));
      check('H2 = ประเภทอาคารตัวแรก', cellTxt('H2') === structureTypeDatabase[0].type, cellTxt('H2'));
      (function () {
        const idxOf = (name) => structureTypeDatabase.findIndex(t => t.type === name) + 2;
        const r1 = idxOf('อาคารท่อลอดถนนลดระดับ');  // H=0.00(แก้ได้) ศก.ท่อ=0.30 ยาว=5.00
        check('อาคารท่อลอดถนนลดระดับ: I/J/K มีค่า (แก้ไขได้ทั้งหมด)',
          cellTxt('I' + r1) === '0.00' && cellTxt('J' + r1) === '0.30' && cellTxt('K' + r1) === '5.00',
          [cellTxt('I' + r1), cellTxt('J' + r1), cellTxt('K' + r1)].join('/'));
        const r2 = idxOf('ปลายคู');                 // ล็อกทั้ง 4 ช่อง
        check('ปลายคู: I/J/K/L ว่าง (ล็อกทั้งหมด)',
          cellTxt('I' + r2) === "" && cellTxt('J' + r2) === "" && cellTxt('K' + r2) === "" && cellTxt('L' + r2) === "",
          [cellTxt('I' + r2), cellTxt('J' + r2), cellTxt('K' + r2), cellTxt('L' + r2)].join('/'));
      })();
      check('ไม่มีชื่ออาคารประกอบปนอยู่ในคอลัมน์ A–F',
        !cellTxt('B2').includes(structureTypeDatabase[0].type) && cellTxt('A2') === 'VU1');
    }

    console.log('\n=== 20) นำเข้า Excel กลับ (รอบ 13) ===');
    if (setting) {
      const ditchBefore = ditchTypeDatabase.map(d => d.type + ':' + d.b + ':' + d.h + ':' + d.tw + ':' + d.tf).join('|');
      const structBefore = JSON.stringify(structureTypeDatabase.map(t => t.type));
      const channelsRefBefore = channels;
      const dimBefore = JSON.stringify(dimensionRows);
      currentTab = 'ditch';
      importAllFromExcel({ target: { files: [{}], value: '' } });
      // ยืนยันว่า "ทาง import ทำงานจริง" (เดิม XLSX.read ไม่มีใน mock → import ล้มเหลวเงียบ ๆ แล้วเทสต์ผ่านฟรี)
      check('importAllFromExcel() ทำงานจริง (ข้อมูลถูกแทนที่ด้วยชุดที่อ่านจากไฟล์)',
        channels !== channelsRefBefore && JSON.stringify(dimensionRows) === dimBefore,
        'channels ถูกแทนที่ = ' + (channels !== channelsRefBefore));
      check('นำเข้าชีต setting แล้วได้ Typeคูส่งน้ำเท่าเดิม (A + C..F)',
        ditchTypeDatabase.map(d => d.type + ':' + d.b + ':' + d.h + ':' + d.tw + ':' + d.tf).join('|') === ditchBefore,
        ditchTypeDatabase.map(d => d.type).join(','));
      check('นำเข้าชีต setting แล้วได้ชื่อ Typeอาคารประกอบเท่าเดิม',
        JSON.stringify(structureTypeDatabase.map(t => t.type)) === structBefore,
        structureTypeDatabase.length + ' รายการ');
      check('Typeอาคารประกอบที่โหลดกลับยังมีธงแก้ไขได้/ล็อกครบ',
        structureTypeDatabase.every(t => t && typeof t.hEditable === 'boolean' && typeof t.diaEditable === 'boolean' &&
          typeof t.lenEditable === 'boolean' && typeof t.remarkEditable === 'boolean'));
      check('อาคารท่อลอดถนนลดระดับ หลังนำเข้ายังแก้ไข H/ศก.ท่อ/ความยาว ได้',
        (function () {
          const t = getStructureTypeEntry('อาคารท่อลอดถนนลดระดับ');
          return t && t.hEditable === true && t.diaEditable === true && t.lenEditable === true &&
                 t.h === '0.00' && t.pipeDia === '0.30' && t.length === '5.00';
        })(), JSON.stringify(getStructureTypeEntry('อาคารท่อลอดถนนลดระดับ')));
      check('ปลายคู หลังนำเข้ายังล็อกทุกช่อง',
        (function () {
          const t = getStructureTypeEntry('ปลายคู');
          return t && t.hEditable === false && t.diaEditable === false && t.lenEditable === false && t.remarkEditable === false;
        })(), JSON.stringify(getStructureTypeEntry('ปลายคู')));
      check('ชื่ออาคารไม่ปนเข้าไปในลิสต์ Typeคูส่งน้ำ',
        !ditchTypeDatabase.some(d => String(d.type).startsWith('อาคาร')),
        ditchTypeDatabase.map(d => d.type).join(','));
    }
    console.log('\n=== 21) รอบ 14: สถานะสีของแท็บ (ต้องมี active ตัวเดียวเสมอ) ===');
    const MAIN_IDS = ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'setting'];
    const activeMainTabs = () => MAIN_IDS.filter(id => {
      const el = mockElements['tab-btn-' + id];
      return el && el.classList.contains('active');
    });
    const subtabBar = mockElements['settingsSubTabsBar'];
    const barShown = () => !!(subtabBar && subtabBar.classList.contains('show'));

    // 1) กดแท็บ อาคารท่อรับน้ำเข้าแปลงไร่นา
    switchTableTab('attachment');
    check('กด อาคารท่อรับ… -> active มีแค่แท็บนั้น',
      JSON.stringify(activeMainTabs()) === JSON.stringify(['attachment']), activeMainTabs().join(','));
    check('กด อาคารท่อรับ… -> แถบแท็บย่อยซ่อน', !barShown());

    // 2) กดแท็บ setting (จุดที่เคยเป็นบั๊ก) — ต้องเคลียร์แท็บเดิม
    switchSettingsSubTab('setting-type');
    check('กด setting -> active มีแค่ setting (แท็บเดิมถูกเคลียร์)',
      JSON.stringify(activeMainTabs()) === JSON.stringify(['setting']), activeMainTabs().join(','));
    check('กด setting -> แถบแท็บย่อยแสดง', barShown());
    check('กด setting -> ชิป setting-type เป็น active',
      mockElements['subtab-btn-setting-type'].classList.contains('active') &&
      !mockElements['subtab-btn-setting-structure'].classList.contains('active'));

    // 3) สลับแท็บย่อย
    switchSettingsSubTab('setting-structure');
    check('สลับแท็บย่อย -> active ยังมีแค่ setting',
      JSON.stringify(activeMainTabs()) === JSON.stringify(['setting']), activeMainTabs().join(','));
    check('สลับแท็บย่อย -> ชิปสลับตาม',
      mockElements['subtab-btn-setting-structure'].classList.contains('active') &&
      !mockElements['subtab-btn-setting-type'].classList.contains('active'));

    // 4) กด setting ซ้ำ (ผ่านปุ่มแท็บหลัก) ต้องไม่ค้างปุ่มอื่น
    switchSettingsSubTab('setting-type');
    check('กด setting ซ้ำ -> active มีแค่ setting',
      JSON.stringify(activeMainTabs()) === JSON.stringify(['setting']), activeMainTabs().join(','));

    // 5) กลับไปแท็บอื่น แถบแท็บย่อยต้องซ่อน
    switchTableTab('level');
    check('กลับไป ระดับคูส่งน้ำ -> active มีแค่แท็บนั้น และแท็บย่อยซ่อน',
      JSON.stringify(activeMainTabs()) === JSON.stringify(['level']) && !barShown(), activeMainTabs().join(','));

    // 6) ไล่ทุกแท็บหลัก ต้องมี active ตัวเดียวเสมอ
    let allOk = true;
    const badTab = [];
    ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment'].forEach(t => {
      switchTableTab(t);
      if (JSON.stringify(activeMainTabs()) !== JSON.stringify([t])) { allOk = false; badTab.push(t + '->' + activeMainTabs().join('+')); }
      switchSettingsSubTab('setting-type');
      if (JSON.stringify(activeMainTabs()) !== JSON.stringify(['setting'])) { allOk = false; badTab.push(t + '->setting:' + activeMainTabs().join('+')); }
    });
    check('ไล่ทุกแท็บแล้วมี active ตัวเดียวเสมอ', allOk, badTab.join(' | '));

    console.log('\n=== 21) รอบ 15: ตาราง Typeอาคารประกอบ 5 คอลัมน์ ตามรูป ===');
    switchSettingsSubTab('setting-structure');
    const stT = parseTable(capturedHtml);
    console.log('  [header] ' + stT.header.join(' | '));
    check('ตาราง Typeอาคาร มี 8 คอลัมน์ (รวม ชื่ออาคารประกอบ + UP + DOWN)',
      stT.header.length === 8 && stT.header[0] === 'ประเภทอาคาร' && stT.header[1] === 'H (ม.)' &&
      stT.header[2] === 'ศก. ท่อ (ม.)' && stT.header[3] === 'ความยาว (ม.)' &&
      stT.header[4] === 'หมายเหตุ' && stT.header[5] === 'ชื่ออาคารประกอบ' &&
      stT.header[6] === 'UP' && stT.header[7] === 'DOWN',
      stT.header.join('|'));
    check('มี 26 แถวตามรูป + อาคารปลายคูส่งน้ำแบบที่ 1/2', stT.rows.length === 26, stT.rows.length);
    check('ทุกแถวมี 8 ช่อง',
      stT.rows.every(r => r.length === 8), stT.rows.map(r => r.length).join(','));

    const ruleCell = (typeName, colIdx) => {
      const rowIdx = structureTypeDatabase.findIndex(t => t.type === typeName);
      return (rowIdx >= 0 && stT.rows[rowIdx]) ? stT.rows[rowIdx][colIdx] : null;
    };
    // ตรวจ 5 ตัวอย่างจากรูป (แก้ไขได้ = มีคลาส editable / ล็อก = readonly + locked)
    check('แถว 1 "-ไม่มี-" ทั้ง 4 ช่องล็อก (แสดง -)',
      ruleCell('-ไม่มี-', 1).readonly && ruleCell('-ไม่มี-', 2).readonly &&
      ruleCell('-ไม่มี-', 3).readonly && ruleCell('-ไม่มี-', 4).readonly &&
      ruleCell('-ไม่มี-', 1).value === '-', JSON.stringify(ruleCell('-ไม่มี-', 1)));
    check('อาคารท่อส่งน้ำเข้านา (ใหม่): H ล็อก / ศก.ท่อ=0.30 แก้ได้ / ยาว=5.00 แก้ได้',
      ruleCell('อาคารท่อส่งน้ำเข้านา (ใหม่)', 1).readonly &&
      !ruleCell('อาคารท่อส่งน้ำเข้านา (ใหม่)', 2).readonly && ruleCell('อาคารท่อส่งน้ำเข้านา (ใหม่)', 2).value === '0.30' &&
      !ruleCell('อาคารท่อส่งน้ำเข้านา (ใหม่)', 3).readonly && ruleCell('อาคารท่อส่งน้ำเข้านา (ใหม่)', 3).value === '5.00');
    check('อาคารท่อลอดถนนลดระดับ: H=0.00 แก้ได้ / ศก.ท่อ=0.30 / ยาว=5.00',
      !ruleCell('อาคารท่อลอดถนนลดระดับ', 1).readonly && ruleCell('อาคารท่อลอดถนนลดระดับ', 1).value === '0.00' &&
      ruleCell('อาคารท่อลอดถนนลดระดับ', 2).value === '0.30' &&
      ruleCell('อาคารท่อลอดถนนลดระดับ', 3).value === '5.00');
    check('อาคารแผ่นพื้นทางข้าม: H ล็อก / ศก.ท่อ ล็อก / ยาว=5.00 แก้ได้',
      ruleCell('อาคารแผ่นพื้นทางข้าม', 1).readonly && ruleCell('อาคารแผ่นพื้นทางข้าม', 2).readonly &&
      !ruleCell('อาคารแผ่นพื้นทางข้าม', 3).readonly && ruleCell('อาคารแผ่นพื้นทางข้าม', 3).value === '5.00');
    check('อาคารน้ำตกลดระดับ: H=0.00 แก้ได้ / ศก.ท่อ+ยาว ล็อก',
      !ruleCell('อาคารน้ำตกลดระดับ', 1).readonly && ruleCell('อาคารน้ำตกลดระดับ', 2).readonly && ruleCell('อาคารน้ำตกลดระดับ', 3).readonly);
    check('อาคารสะพานน้ำแบบที่ 1: H ล็อก / ศก.ท่อ=0.30 / ยาว=6.00',
      ruleCell('อาคารสะพานน้ำแบบที่ 1', 2).value === '0.30' && ruleCell('อาคารสะพานน้ำแบบที่ 1', 3).value === '6.00');
    check('อาคารท่อระบายน้ำแบบที่ 1 (2 แถว): ศก.ท่อ=0.50 / ยาว=6.00',
      ruleCell('อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)', 2).value === '0.50' && ruleCell('อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)', 3).value === '6.00');
    check('อาคารปากคูซอย: หมายเหตุเป็นช่องแก้ไขได้ (ช่องอื่นล็อก)',
      ruleCell('อาคารปากคูซอย', 4).hasEditable === true && !ruleCell('อาคารปากคูซอย', 4).readonly &&
      ruleCell('อาคารปากคูซอย', 1).readonly && ruleCell('อาคารปากคูซอย', 2).readonly && ruleCell('อาคารปากคูซอย', 3).readonly);
    check('อาคารอื่นที่มีหมายเหตุเป็น "-" ถูกล็อก',
      ruleCell('ปลายคู', 4).readonly && ruleCell('ปลายคู', 4).value === '-');

    console.log('\n=== 22) รอบ 15: ลิสต์แท็บอาคารประกอบดึงจากตาราง Typeอาคาร ===');
    check('getStructureTypeOptions() = ชื่อทั้ง 26 รายการ',
      getStructureTypeOptions().length === 26 && getStructureTypeOptions()[0] === '-ไม่มี-', getStructureTypeOptions().length);
    // ⚠️ การโหลดไฟล์/นำเข้า Excel จะล้างสถานะกลุ่ม → ต้องปลดล็อกก่อน ช่อง "ประเภทอาคาร" จึงจะเป็นลิสต์ให้ตรวจ
    structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
    switchTableTab('structure');
    check('ลิสต์ "ประเภทอาคาร" ในแท็บอาคารประกอบมี 26 ตัว',
      getStructureTypeOptions().every(t => capturedHtml.includes(`value="${t}"`)),
      'ตรวจไม่ครบ');
    check('ลิสต์มีชื่ออาคารที่เคยหายไป (อาคารท่อส่งน้ำเข้านา (เดิม))',
      capturedHtml.includes('value="อาคารท่อส่งน้ำเข้านา (เดิม)"'));
    check('ลิสต์มีรายการใหม่ (อาคารเปลี่ยนลาดทางเข้า)',
      capturedHtml.includes('value="อาคารเปลี่ยนลาดทางเข้า"'));

    console.log('\n=== 23) รอบ 17: คอลัมน์ "รายการอาคาร" ใช้ชื่ออาคารประกอบ ===');
    // อาคารท่อลอดถนนลดระดับ: ตารางมี H=0.00, ศก.ท่อ=0.30, ความยาว=5.00 (แก้ได้ทั้งหมด)
    (function () {
      const row = structureRowsData[1];
      const oldName = row.name, oldH = row.hOverride, oldDia = row.pipeDia, oldCount = row.pipeCount;
      row.name = 'อาคารท่อลอดถนนลดระดับ';
      row.hOverride = ""; row.pipeDia = ""; row.pipeCount = "";
      const nm = computeStructureItemName(row, row.channelId);
      check('รายการอาคาร = ชื่ออาคารประกอบจากตาราง (H=0.00,ศก. 0.30x5.00)',
        nm === 'อาคารท่อลอดถนนลดระดับ (H=0.00,ศก. 0.30x5.00)', nm);
      row.name = oldName; row.hOverride = oldH; row.pipeDia = oldDia; row.pipeCount = oldCount;
    })();
    // ปลายคู: ตารางล็อกทุกช่อง -> ชื่อไม่มีวงเล็บ
    check('ปลายคู -> รายการอาคาร = "ปลายคู" (ไม่มีวงเล็บ)',
      computeStructureItemName({ channelId: 1, name: 'ปลายคู', hOverride: "", pipeDia: "", pipeCount: "" }, 0) === 'ปลายคู',
      computeStructureItemName({ channelId: 1, name: 'ปลายคู', hOverride: "", pipeDia: "", pipeCount: "" }, 0));
    // อาคารปากคูซอย: หมายเหตุแก้ได้ -> เอาค่าที่กรอกมาใส่
    check('อาคารปากคูซอย + หมายเหตุ "คูซอย 3" -> "อาคารปากคูซอย (คูซอย 3)"',
      computeStructureItemName({ channelId: 1, name: 'อาคารปากคูซอย', hOverride: "", pipeDia: "", pipeCount: "", remark: 'คูซอย 3' }, 0) === 'อาคารปากคูซอย (คูซอย 3)',
      computeStructureItemName({ channelId: 1, name: 'อาคารปากคูซอย', hOverride: "", pipeDia: "", pipeCount: "", remark: 'คูซอย 3' }, 0));
    // อาคารที่ผู้ใช้แก้ค่าเอง (ช่องที่ตารางบอกว่าแก้ได้) ต้องใช้ค่าที่แก้
    check('ผู้ใช้แก้ ศก.ท่อ/ความยาว เอง -> ชื่อใช้ค่าที่แก้ (0.60x7.00)',
      computeStructureItemName({ channelId: 1, name: 'อาคารท่อลอดถนนลดระดับ', hOverride: '1.20', pipeDia: '0.60', pipeCount: '7.00' }, 0) === 'อาคารท่อลอดถนนลดระดับ (H=1.20,ศก. 0.60x7.00)',
      computeStructureItemName({ channelId: 1, name: 'อาคารท่อลอดถนนลดระดับ', hOverride: '1.20', pipeDia: '0.60', pipeCount: '7.00' }, 0));

    console.log('\n=== 25) รอบ 16: คอลัมน์ "ชื่ออาคารประกอบ" — 6 กฎการรวม ===');
    const nm = (h, dia, len, type) => computeStructureTypeName({ type: type || "อาคารทดสอบ", h: h, pipeDia: dia, length: len });
    check('กฎ 1: ทุกช่องเป็น "-" -> ไม่มีวงเล็บ', nm("-", "-", "-") === "อาคารทดสอบ", nm("-", "-", "-"));
    check('กฎ 1: ทุกช่องว่าง -> ไม่มีวงเล็บ', nm("", "", "") === "อาคารทดสอบ");
    check('กฎ 2: มีแต่ H -> H=<ค่า>', nm("1.50", "-", "-") === "อาคารทดสอบ (H=1.50)", nm("1.50", "-", "-"));
    check('กฎ 3: มีแต่ความยาว -> L=<ค่า>', nm("-", "-", "6.00") === "อาคารทดสอบ (L=6.00)", nm("-", "-", "6.00"));
    check('กฎ 4: มีแต่ ศก. -> ศก. <ค่า>', nm("-", "0.40", "-") === "อาคารทดสอบ (ศก. 0.40)", nm("-", "0.40", "-"));
    check('กฎ 5: ศก.+ความยาว -> ศก. <ศก.>x<ยาว>', nm("-", "0.30", "5.00") === "อาคารทดสอบ (ศก. 0.30x5.00)", nm("-", "0.30", "5.00"));
    check('กฎ 6: H+ศก.+ความยาว -> H=<H>,ศก. <ศก.>x<ยาว>',
      nm("0.00", "0.30", "5.00") === "อาคารทดสอบ (H=0.00,ศก. 0.30x5.00)", nm("0.00", "0.30", "5.00"));
    check('กฎ 7: อาคารปากคูซอย + หมายเหตุ "คูซอย 3" -> อาคารปากคูซอย (คูซอย 3)',
      computeStructureTypeName({ type: "อาคารปากคูซอย", h: "", pipeDia: "", length: "", remark: "คูซอย 3" }) === "อาคารปากคูซอย (คูซอย 3)",
      computeStructureTypeName({ type: "อาคารปากคูซอย", h: "", pipeDia: "", length: "", remark: "คูซอย 3" }));
    check('กฎ 7: อาคารปากคูซอย ไม่มีหมายเหตุ -> อาคารปากคูซอย ()',
      computeStructureTypeName({ type: "อาคารปากคูซอย", h: "", pipeDia: "", length: "", remark: "" }) === "อาคารปากคูซอย ()",
      computeStructureTypeName({ type: "อาคารปากคูซอย", h: "", pipeDia: "", length: "", remark: "" }));
    check('กฎ 8: ท่อระบายน้ำแบบที่ 1 -> (1-ศก. 0.50x)',
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 1", h: "", pipeDia: "0.50", length: "6.00", remark: "" }) === "อาคารท่อระบายน้ำแบบที่ 1 (1-ศก. 0.50x)",
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 1", h: "", pipeDia: "0.50", length: "6.00", remark: "" }));
    check('กฎ 8: ท่อระบายน้ำแบบที่ 2 -> (2-ศก. 0.50x)',
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2", h: "", pipeDia: "0.50", length: "6.00", remark: "" }) === "อาคารท่อระบายน้ำแบบที่ 2 (2-ศก. 0.50x)",
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2", h: "", pipeDia: "0.50", length: "6.00", remark: "" }));
    check('กฎ 8: ท่อระบายน้ำแบบที่ 1 (2 แถว) -> ตัด "(2 แถว)" ออก เหลือ (2-ศก. 0.50x)',
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)", h: "", pipeDia: "0.50", length: "6.00", remark: "" }) === "อาคารท่อระบายน้ำแบบที่ 1 (2-ศก. 0.50x)",
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)", h: "", pipeDia: "0.50", length: "6.00", remark: "" }));
    check('กฎ 8: ท่อระบายน้ำแบบที่ 2 (2 แถว) -> ตัด "(2 แถว)" ออก เหลือ (2-ศก. 0.50x)',
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)", h: "", pipeDia: "0.50", length: "6.00", remark: "" }) === "อาคารท่อระบายน้ำแบบที่ 2 (2-ศก. 0.50x)",
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)", h: "", pipeDia: "0.50", length: "6.00", remark: "" }));
    check('ชื่อในรายการ (dropdown) ยังคงมี "(2 แถว)" เพื่อไม่ให้ซ้ำกับตัวอื่น',
      structureTypeDatabase.some(t => t.type === 'อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)') &&
      structureTypeDatabase.filter(t => t.type === 'อาคารท่อระบายน้ำแบบที่ 1').length === 1);
    check('กฎ 8: ถ้า ศก. เป็น "-" -> กลับไปใช้กฎปกติ (L=6.00)',
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2", h: "", pipeDia: "-", length: "6.00", remark: "" }) === "อาคารท่อระบายน้ำแบบที่ 2 (L=6.00)",
      computeStructureTypeName({ type: "อาคารท่อระบายน้ำแบบที่ 2", h: "", pipeDia: "-", length: "6.00", remark: "" }));
    // เทียบกับตารางจริง
    check('แถวจริง อาคารท่อส่งน้ำเข้านา (ใหม่) -> (ศก. 0.30x5.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารท่อส่งน้ำเข้านา (ใหม่)')) === 'อาคารท่อส่งน้ำเข้านา (ใหม่) (ศก. 0.30x5.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารท่อส่งน้ำเข้านา (ใหม่)')));
    check('แถวจริง อาคารท่อลอดถนนลดระดับ -> (H=0.00,ศก. 0.30x5.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารท่อลอดถนนลดระดับ')) === 'อาคารท่อลอดถนนลดระดับ (H=0.00,ศก. 0.30x5.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารท่อลอดถนนลดระดับ')));
    check('แถวจริง อาคารสะพานน้ำแบบที่ 2 -> (L=6.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารสะพานน้ำแบบที่ 2')) === 'อาคารสะพานน้ำแบบที่ 2 (L=6.00)',
      computeStructureTypeName(getStructureTypeEntry('อาคารสะพานน้ำแบบที่ 2')));
    check('แถวจริง ปลายคู -> ไม่มีวงเล็บ',
      computeStructureTypeName(getStructureTypeEntry('ปลายคู')) === 'ปลายคู',
      computeStructureTypeName(getStructureTypeEntry('ปลายคู')));
    // ค่าที่แสดงในตารางจริง (คอลัมน์ที่ 6)
    switchSettingsSubTab('setting-structure');
    const stT2 = parseTable(capturedHtml);
    const rowOf = (t) => structureTypeDatabase.findIndex(x => x.type === t);
    check('คอลัมน์ชื่ออาคารประกอบ แสดงค่าคำนวณถูกต้องในตาราง',
      stT2.rows[rowOf('อาคารท่อลอดถนนลดระดับ')][5].value === 'อาคารท่อลอดถนนลดระดับ (H=0.00,ศก. 0.30x5.00)',
      stT2.rows[rowOf('อาคารท่อลอดถนนลดระดับ')][5].value);
    check('คอลัมน์ชื่ออาคารประกอบ เป็นช่องล็อก (readonly)',
      stT2.rows[rowOf('ปลายคู')][5].readonly === true);

    console.log('\n=== 26) รอบ 16: แถวใหม่แก้ไขได้ทุกช่อง + ใส่ "-" ได้ ===');
    const beforeCount = structureTypeDatabase.length;
    addStructureTypeRow();
    switchSettingsSubTab('setting-structure');
    const newEntry = structureTypeDatabase[structureTypeDatabase.length - 1];
    check('แถวใหม่: ทุกช่องแก้ไขได้ (H/ศก.ท่อ/ความยาว/หมายเหตุ)',
      newEntry.hEditable === true && newEntry.diaEditable === true &&
      newEntry.lenEditable === true && newEntry.remarkEditable === true,
      JSON.stringify(newEntry));
    const stT3 = parseTable(capturedHtml);
    const newRowIdx = structureTypeDatabase.length - 1;
    check('แถวใหม่: ช่อง H/ศก.ท่อ/ความยาว ในตารางไม่ readonly และมีคลาส editable',
      !stT3.rows[newRowIdx][1].readonly && stT3.rows[newRowIdx][1].hasEditable &&
      !stT3.rows[newRowIdx][2].readonly && stT3.rows[newRowIdx][2].hasEditable &&
      !stT3.rows[newRowIdx][3].readonly && stT3.rows[newRowIdx][3].hasEditable &&
      !stT3.rows[newRowIdx][4].readonly, JSON.stringify(stT3.rows[newRowIdx].map(c => c.readonly)));

    // ใส่ "-" ได้ และค่าติดลบ/ทศนิยมยังจัดรูปแบบถูก
    updateStructureTypeValue(newRowIdx, 'h', '-');
    check('ใส่ "-" ในช่อง H ได้ (เก็บเป็น "-")', structureTypeDatabase[newRowIdx].h === '-', JSON.stringify(structureTypeDatabase[newRowIdx].h));
    updateStructureTypeValue(newRowIdx, 'pipeDia', '0.5');
    check('ใส่เลข 0.5 แล้วจัดเป็น 0.50', structureTypeDatabase[newRowIdx].pipeDia === '0.50', structureTypeDatabase[newRowIdx].pipeDia);
    updateStructureTypeValue(newRowIdx, 'length', '-');
    check('ใส่ "-" ในช่องความยาวได้', structureTypeDatabase[newRowIdx].length === '-');
    switchSettingsSubTab('setting-structure');
    const nmAfter = computeStructureTypeName(structureTypeDatabase[newRowIdx]);
    check('ชื่ออาคารประกอบอัปเดตตามค่าใหม่ (H/- ยาว - -> ศก. 0.50)',
      nmAfter.indexOf('(ศก. 0.50)') !== -1, nmAfter);
    check('ช่องที่ใส่ "-" ไม่ถูกนำไปรวมในชื่อ', nmAfter.indexOf('H=') === -1 && nmAfter.indexOf('L=') === -1, nmAfter);

    deleteStructureTypeRow(structureTypeDatabase.length - 1);
    check('ลบแถวใหม่ได้ กลับมาเท่าเดิม', structureTypeDatabase.length === beforeCount, structureTypeDatabase.length);

    console.log('\n=== 27) รอบ 18: ช่อง "-" -> ล็อกบังคับ + แสดง "-" (ข้อมูลจริงไม่มี "-" จึงจำลอง) ===');
    (function () {
      const row = structureRowsData.find(r => !r.isBoundary && !r.isFromLevel) || structureRowsData[0];
      const saved = { name: row.name, pipeDia: row.pipeDia, pipeCount: row.pipeCount, hOverride: row.hOverride };
      const T = 'อาคารท่อลอดถนนลดระดับ';
      const entry = getStructureTypeEntry(T);
      const backup = JSON.parse(JSON.stringify(entry));

      // จำลอง: ตารางกำหนดค่าเป็น "-" ทั้ง H / ศก. ท่อ / ความยาว และแก้ไขได้
      entry.h = '-'; entry.hEditable = true;
      entry.pipeDia = '-'; entry.diaEditable = true;
      entry.length = '-'; entry.lenEditable = true;

      // ⚠️ ต้องสลับมาที่แท็บอาคารประกอบก่อน (เทสต์ก่อนหน้าอาจค้างอยู่ที่แท็บ setting)
      switchTableTab('structure');
      row.name = T;
      row.pipeDia = ''; row.pipeCount = ''; row.hOverride = '';
      updateTable();

      const trs = capturedHtml.split(/<tr\b/).slice(1);
      const dashRow = trs.find(tr => new RegExp('data-field="name"[^>]*value="' + T + '"').test(tr));
      check('พบแถวของอาคารที่ทดสอบ', !!dashRow, 'ไม่พบแถว');
      const hasDashReadonly = (col) => !!dashRow &&
        new RegExp('data-col="' + col + '"[^>]*value="-"').test(dashRow) &&
        new RegExp('data-col="' + col + '"[^>]*readonly').test(dashRow);
      check('ตารางเป็น "-" -> ช่อง H แสดง "-" และ readonly', hasDashReadonly(5),
        dashRow ? dashRow.slice(0, 260) : '');
      check('ตารางเป็น "-" -> ช่อง ศก. ท่อ แสดง "-" และ readonly', hasDashReadonly(6));
      check('ตารางเป็น "-" -> ช่อง ความยาว แสดง "-" และ readonly', hasDashReadonly(7));
      check('ตารางเป็น "-" -> ชื่ออาคารประกอบไม่รวมค่านั้น (ไม่มี H=/L=/ศก.)',
        computeStructureItemName(row, row.channelId) === T, computeStructureItemName(row, row.channelId));

      Object.keys(backup).forEach(k => { entry[k] = backup[k]; });
      row.name = saved.name; row.pipeDia = saved.pipeDia; row.pipeCount = saved.pipeCount; row.hOverride = saved.hOverride;
      updateTable();
    })();

    console.log('\n=== 28) รอบ 18: เซฟค่าตัวเลข (ช่อง "-" -> 0) ===');
    check('ช่อง "-" -> เซฟเป็น 0', structureNumericForFile(true, "0.30", "-") === 0, structureNumericForFile(true, "0.30", "-"));
    check('ช่องว่าง + ล็อก -> เซฟเป็น 0', structureNumericForFile(false, "", "") === 0);
    check('ช่องว่าง + แก้ได้ (ใช้ค่าตาราง) -> เซฟเป็นตัวเลข', structureNumericForFile(true, "0.30", "") === 0.3, structureNumericForFile(true, "0.30", ""));
    check('มีค่าที่กรอก -> เซฟเป็นตัวเลข', structureNumericForFile(true, "0.30", "0.60") === 0.6);
    check('ค่าจากตารางเมื่อล็อก -> เซฟเป็นตัวเลข', structureNumericForFile(false, "5.00", "") === 5);
    check('หมายเหตุ: ช่อง "-" -> เซฟเป็นข้อความว่าง', structureRemarkForFile(false, "-", "") === "");
    check('หมายเหตุ: อาคารปากคูซอย -> เซฟข้อความที่กรอก', structureRemarkForFile(true, "", "คูซอย 3") === "คูซอย 3");

    console.log('\n=== 29) รอบ 18: สีเส้นใต้บรรทัดของแท็บอาคารประกอบ ===');
    switchTableTab('structure');
    check('แถวที่คัดลอกจากระดับคูส่งน้ำได้คลาสสี (row-tint)',
      shouldStructureRowHaveTint({ channelId: 1, km: 0, isFromLevel: true }) === true);
    check('CSS มีคลาสสีเส้นบนแบบสีเดียว (tr.row-tint)',
      /tr\.row-tint td/.test(cssSrc));

    console.log('\n=== 30) รอบ 18: ปุ่มหมุนภาพ + ถอดปุ่มหน้าก่อน/หน้าถัดไป ===');
    const htmlSrc3 = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
    check('index.html มีปุ่ม btn-rotate-cw', htmlSrc3.includes('id="btn-rotate-cw"'));
    check('ปุ่มหมุนภาพอยู่ก่อนปุ่มล็อกซูม',
      htmlSrc3.indexOf('id="btn-rotate-cw"') < htmlSrc3.indexOf('id="btn-lockzoom"'));
    check('index.html ไม่มี pdfNavBar / prevPage / nextPage',
      !htmlSrc3.includes('pdfNavBar') && !htmlSrc3.includes('prevPage') && !htmlSrc3.includes('nextPage'));
    const canvasSrc = fs.readFileSync(path.join(base, 'js/canvas-viewer.js'), 'utf8');
    check('canvas-viewer.js มี rotateImageView() และ imageRotation',
      canvasSrc.includes('function rotateImageView') && canvasSrc.includes('let imageRotation'));
    check('canvas-viewer.js ไม่เหลือการอ้าง pdfNavBar/prevPage/nextPage',
      !canvasSrc.includes('pdfNavBar') && !canvasSrc.includes("'prevPage'") && !canvasSrc.includes("'nextPage'"));

    console.log('\n=== 31) รอบ 19: การหมุนภาพ (หมุน 90° วนครบ 4 ครั้ง + Reset หมุน) ===');
    (function () {
      const cv = fs.readFileSync(path.join(base, 'js/canvas-viewer.js'), 'utf8');
      check('rotateImageView() หมุนทีละ 90° แล้วหมุนพิกัด overlay + fit/redraw ตอนภาพพร้อม',
        /imageRotation = \(imageRotation \+ 90\) % 360;[\s\S]{0,420}applyRotationToImage\(90, \(\) => \{[\s\S]{0,220}rotateOverlayPixels\(90, oldLogicalW, oldLogicalH\)[\s\S]{0,220}fitImageToViewportWithPadding\(\)[\s\S]{0,120}redraw\(\)/.test(cv),
        'ไม่พบรูปแบบการหมุนทีละ 90 + หมุนพิกัด overlay');
      check('มีฟังก์ชัน applyRotationToImage(deltaDeg, onDone)',
        cv.includes('function applyRotationToImage(deltaDeg, onDone)'));
      check('มี rotateOverlayPixels() หมุนพิกัด P1/P2 + เส้นดินเดิม + เส้นระดับ',
        cv.includes('function rotateOverlayPixels(deltaDeg, w, h)') &&
        /refPixels\[k\]\.x = p\.x/.test(cv) &&
        /manualGroundLinePoints\.forEach\(pt => \{ let p = map\(pt\.x, pt\.y\)/.test(cv) &&
        /canalLevelDrawingLines\.forEach\(l => \{/.test(cv));
      check('ไม่ตั้ง img = rotImg ก่อนภาพโหลดเสร็จ (ตั้งใน onload เท่านั้น)',
        /rotImg\.onload = \(\) => \{[\s\S]{0,60}img = rotImg;/.test(cv) &&
        !/img = rotImg;\s*\/\/ ตั้งทันที/.test(cv));
      check('จุดหมุน = กึ่งกลางภาพ (translate ไป outW/2, outH/2 แล้ว rotate)',
        /translate\(outW \/ 2, outH \/ 2\)[\s\S]{0,80}rotate\(rad\)/.test(cv));
      check('Reset ซูม เรียกรีเซ็ตการหมุนด้วย (แล้วค่อย fit/วาดใหม่)',
        /function resetZoom\(\)[\s\S]{0,320}resetImageRotation\(\(\) => \{/.test(cv));
      check('มีฟังก์ชัน resetImageRotation(onDone)', cv.includes('function resetImageRotation(onDone)'));
      check('ปุ่มหมุนภาพแสดงมุมปัจจุบัน (syncRotationButtonLabel)',
        cv.includes('function syncRotationButtonLabel') && cv.includes("btn-rotate-cw"));
    })();

    console.log('\n=== 32) รอบ 19: ปุ่มล็อกทุกชุดข้อมูล (แท็บอาคารท่อรับน้ำ) ===');
    switchTableTab('attachment');
    const attSrc = fs.readFileSync(path.join(base, 'js/tab-attachment.js'), 'utf8');
    check('ไม่มีแถบเครื่องมือรวมด้านบนแล้ว (table-top-tools ถูกลบ)',
      !capturedHtml.includes('table-top-tools'));
    check('ไม่มีฟังก์ชันปุ่มรวมเดิม (toggleAttachmentAllGroupsLock)',
      !attSrc.includes('toggleAttachmentAllGroupsLock'));
    check('มีปุ่มล็อกในตาราง (btn-lock-toggle)', capturedHtml.includes('btn-lock-toggle'));

    // ปุ่มต้องอยู่ใน "แถวแรกของชุด" และอยู่ในคอลัมน์ "คลองส่งน้ำ" (คอลัมน์แรก)
    // เลือกเฉพาะแถวข้อมูล (มี <td>) ไม่ใช่แถวหัวตาราง (มี <th>)
    const attTrs = capturedHtml.split(/<tr\b/).slice(1).filter(tr => tr.includes('<td'));
    const firstTr = attTrs[0] || '';
    const firstCanalTd = (firstTr.match(/<td[^>]*>[\s\S]*?<\/td>/) || [''])[0];
    check('แถวแรกของชุดมีปุ่มล็อกอยู่ในคอลัมน์คลองส่งน้ำ (คอลัมน์แรก)',
      firstCanalTd.includes('btn-lock-toggle'), firstCanalTd.slice(0, 240));
    check('ปุ่มล็อกเรียก toggleAttachmentGroupLock()',
      /toggleAttachmentGroupLock\('attach_ch_\d+'\)/.test(firstCanalTd), firstCanalTd.slice(0, 280));
    check('แถวแรกของชุดมีปุ่มยุบ/ขยายอยู่ด้วย',
      firstCanalTd.includes('btn-collapse-rows'));

    // กดปุ่มคู่แรก: ให้สถานะกลายเป็น "ล็อก" แล้วตรวจว่าช่องถูกล็อกจริง
    if (!attachmentAllLocked()) toggleAttachmentGroupLock('attach_ch_1');
    updateTable();
    check('กดปุ่ม -> ชุดข้อมูลถูกล็อก (attachmentAllLocked = true)', attachmentAllLocked() === true);
    check('ตอนล็อก: ปุ่มแสดงสถานะ 🔒', capturedHtml.includes('state-locked'));
    check('ตอนล็อก: ช่องจำนวนอาคารเป็น readonly',
      /data-col="3"[^>]*readonly/.test(capturedHtml));
    check('ตอนล็อก: ช่องหมายเหตุเป็น readonly',
      /data-col="7"[^>]*readonly/.test(capturedHtml));
    check('ตอนล็อก: ไม่มีลิสต์รายการอาคาร', !capturedHtml.includes('attTypeCell_'));

    // กดปุ่มอีกครั้ง: ปลดล็อก
    // (ต้องมีอย่างน้อย 2 แถวในคูนี้ จึงจะมีช่อง "รายการอาคาร" แบบลิสต์ให้ตรวจ)
    addAttachmentRowAt(0);
    toggleAttachmentGroupLock('attach_ch_1');
    check('กดปุ่มอีกครั้ง -> ปลดล็อกชุดข้อมูล (attachmentAllLocked = false)', attachmentAllLocked() === false);
    check('ตอนปลดล็อก: ปุ่มแสดงสถานะ ✔ แก้ไข', capturedHtml.includes('state-edit'));
    check('ตอนปลดล็อก: ช่องจำนวนอาคารแก้ไขได้ (data-field="count")',
      /data-col="3"[^>]*data-field="count"/.test(capturedHtml));
    check('ตอนปลดล็อก: ช่องหมายเหตุแก้ไขได้',
      /data-col="7"[^>]*data-field="remark"/.test(capturedHtml));
    check('ตอนปลดล็อก: ลิสต์รายการอาคารกลับมา (attTypeCell_)',
      capturedHtml.includes('attTypeCell_'));
    // กดล็อกกลับ (คืนสภาพ)
    toggleAttachmentGroupLock('attach_ch_1');
    check('กดปุ่มอีกครั้ง -> ล็อกกลับมา', attachmentAllLocked() === true);

    console.log('\n=== 33) รอบ 19: สีเส้นตารางตามบรรทัดของแท็ประดับคูส่งน้ำ ===');
    (function () {
      // ตั้งแท็ประดับคูส่งน้ำให้มี 2 แถว: 0–50 และ 50–100
      const backupLevels = JSON.parse(JSON.stringify(levelRowsData));
      levelRowsData.length = 0;
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 0, customKmEnd: 50, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 50, customKmEnd: 100, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });

      check('กม. 10 อยู่บรรทัดที่ 1 ของแท็ประดับคูส่งน้ำ', findLevelRowIndexForStructure(1, 10) === 0, findLevelRowIndexForStructure(1, 10));
      check('กม. 75 อยู่บรรทัดที่ 2', findLevelRowIndexForStructure(1, 75) === 1, findLevelRowIndexForStructure(1, 75));
      check('กม. 50 = จุดเริ่มของบรรทัดที่ 2 (50–100)',
        findLevelRowIndexForStructure(1, 50) === 1, findLevelRowIndexForStructure(1, 50));
      check('กม. 49 ยังอยู่บรรทัดที่ 1', findLevelRowIndexForStructure(1, 49) === 0, findLevelRowIndexForStructure(1, 49));
      check('แถวคัดลอกจากระดับ -> ใส่สี', shouldStructureRowHaveTint({ channelId: 1, km: 10, isFromLevel: true }) === true);
      check('แถวคัดลอกจากระดับ กม.อื่น -> ใส่สีเหมือนกัน (สีเดียว)',
        shouldStructureRowHaveTint({ channelId: 1, km: 75, isFromLevel: true }) === true &&
        shouldStructureRowHaveTint({ channelId: 1, km: 10, isFromLevel: true }) === true);
      check('แถวที่ผู้ใช้เพิ่มเอง -> ไม่ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 99, isFromLevel: false }) === false &&
        shouldStructureRowHaveTint({ channelId: 2, km: 99, isFromLevel: false }) === false);
      check('แถว boundary -> ไม่ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 0, isBoundary: true }) === false &&
        shouldStructureRowHaveTint({ channelId: 1, km: 100, isBoundary: true }) === false);

      // คืนค่าเดิม
      levelRowsData.length = 0;
      backupLevels.forEach(l => levelRowsData.push(l));
    })();

    console.log('\n=== 34) รอบ 21: ปุ่ม + / − ของแท็บอาคารประกอบ ===');
    (function () {
      const backup = JSON.parse(JSON.stringify(structureRowsData));
      const backupLevels = JSON.parse(JSON.stringify(levelRowsData));

      // ระดับคูส่งน้ำ 3 บรรทัด -> ได้แถวคัดลอก 2 แถว (isFromLevel)
      levelRowsData.length = 0;
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 0, customKmEnd: 40, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 40, customKmEnd: 80, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 80, customKmEnd: 100, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });

      structureRowsData.length = 0;
      structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
      currentTab = 'structure';
      switchTableTab('structure');

      const rowsOfTab = () => capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
      let trs = rowsOfTab();
      const fromLevelRows = trs.filter(t => /data-field="name"[^>]*value="อาคารลดระดับ"/.test(t));
      check('มีแถวที่คัดลอกมาจากแท็ประดับคูส่งน้ำ (อาคารลดระดับ) 2 แถว',
        fromLevelRows.length === 2, fromLevelRows.length);
      check('แถวที่คัดลอกมาจากระดับคูส่งน้ำ มี "เฉพาะปุ่ม +"',
        fromLevelRows.every(t => t.includes('btn-row-add') && !t.includes('btn-row-del')),
        fromLevelRows.map(t => (t.includes('btn-row-add') ? '+' : '') + (t.includes('btn-row-del') ? '-' : '')).join(','));
      // ⚠️ ต้องระบุ data-field="name" ด้วย ไม่งั้น regex จะไปแมตช์ <option value="..."> ในลิสต์ตัวเลือก
      const nameOf = (t) => (t.match(/data-field="name"[^>]*value="([^"]*)"/) || [])[1];
      const startRows = trs.filter(t => nameOf(t) === 'อาคารท่อส่งน้ำเข้านา (เดิม)');
      const endRows = trs.filter(t => nameOf(t) === 'ปลายคู');
      check('แถวแรกของชุด (อาคารท่อส่งน้ำเข้านา (เดิม)) มีเฉพาะ +',
        startRows.length === 1 && startRows.every(t => t.includes('btn-row-add') && !t.includes('btn-row-del')),
        JSON.stringify(startRows.map(t => nameOf(t) + (t.includes('btn-row-add') ? '+' : '') + (t.includes('btn-row-del') ? '−' : ''))));
      check('แถวสุดท้ายของชุด (ปลายคู) ไม่มีปุ่มเลย',
        endRows.length === 1 && endRows.every(t => !t.includes('btn-row-add') && !t.includes('btn-row-del')),
        JSON.stringify(endRows.map(t => nameOf(t) + (t.includes('btn-row-add') ? '+' : '') + (t.includes('btn-row-del') ? '−' : ''))));

      // เพิ่มแถวผู้ใช้เอง -> ต้องมี + และ −
      addStructureRowAt(0);
      trs = rowsOfTab();
      const userTr = trs.find(t => /data-field="name"[^>]*value="-ไม่มี-"/.test(t));
      check('แถวที่ผู้ใช้เพิ่มเอง มีทั้ง + และ −',
        !!userTr && userTr.includes('btn-row-add') && userTr.includes('btn-row-del'),
        userTr ? 'hasAdd=' + userTr.includes('btn-row-add') + ' hasDel=' + userTr.includes('btn-row-del') : 'ไม่พบแถว');
      check('ปุ่ม − ผูกกับ index ของแถวผู้ใช้ในข้อมูล',
        !!userTr && new RegExp('deleteStructureRowAt\\(' + structureRowsData.findIndex(r => !r.isBoundary && !r.isFromLevel) + '\\)').test(userTr),
        userTr ? (userTr.match(/deleteStructureRowAt\(\d+\)/) || [''])[0] : '');

      // กด − ต้องลบได้จริง
      const beforeDel = structureRowsData.length;
      const delIdx = structureRowsData.findIndex(r => !r.isBoundary && !r.isFromLevel);
      deleteStructureRowAt(delIdx);
      check('กด − แล้วลบแถวออกจริง', structureRowsData.length === beforeDel - 1, structureRowsData.length);
      check('กด − แล้วแถวที่คัดลอกมายังอยู่ครบ 2 แถว',
        structureRowsData.filter(r => r.isFromLevel).length === 2);

      // คืนค่าเดิม
      levelRowsData.length = 0;
      backupLevels.forEach(l => levelRowsData.push(l));
      structureRowsData.length = 0;
      backup.forEach(r => structureRowsData.push(r));
      switchTableTab('structure');
    })();

    console.log('\n=== 35) รอบ 23: สีเส้นบนบรรทัด (สีเดียว เฉพาะแถวจากระดับคูส่งน้ำ) ===');
    (function () {
      check('แถวคัดลอกจากระดับ -> ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 10, isFromLevel: true }) === true);
      check('แถวคัดลอกจากระดับ คนละ กม. -> ใส่สีเหมือนกัน (สีเดียว ไม่เปลี่ยน)',
        shouldStructureRowHaveTint({ channelId: 1, km: 75, isFromLevel: true }) === true &&
        shouldStructureRowHaveTint({ channelId: 1, km: 10, isFromLevel: true }) === true);
      check('แถวที่ผู้ใช้เพิ่มเอง -> ไม่ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 99, isFromLevel: false }) === false &&
        shouldStructureRowHaveTint({ channelId: 2, km: 99, isFromLevel: false }) === false);
      check('แถว boundary -> ไม่ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 0, isBoundary: true }) === false &&
        shouldStructureRowHaveTint({ channelId: 1, km: 100, isBoundary: true }) === false);
      check('ไม่มี isFromLevel จริง ๆ -> ไม่ใส่สี',
        shouldStructureRowHaveTint({ channelId: 1, km: 10 }) === false);
      check('CSS ใช้เส้น "บน" (border-top) สีเดียว',
        /tr\.row-tint td\s*\{\s*border-top:/.test(cssSrc));
      check('CSS ไม่เหลือคลาสไล่สี row-tint-N', !/row-tint-\d/.test(cssSrc));
      check('สีเส้นบนใช้ !important (ชนะเส้นคั่นกลุ่ม 3px)',
        /tr\.row-tint td \{ border-top: 2\.5px solid #[0-9a-f]{6} !important; \}/i.test(cssSrc));

      // ตรวจ HTML จริง: แถวคัดลอกมีคลาสสี / แถวผู้ใช้ไม่มีคลาสสี
      (function () {
        const backup = JSON.parse(JSON.stringify(structureRowsData));
        const backupLevels = JSON.parse(JSON.stringify(levelRowsData));
        levelRowsData.length = 0;
        levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 0, customKmEnd: 40, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
        levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 40, customKmEnd: 100, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
        structureRowsData.length = 0;
        structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
        currentTab = 'structure';
        switchTableTab('structure');
        addStructureRowAt(0);   // สร้างแถวผู้ใช้ (ไม่มีสี)
        const rowTrs = capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
        const lvlTr = rowTrs.find(t => /data-field="name"[^>]*value="อาคารลดระดับ"/.test(t));
        const userTr = rowTrs.find(t => /data-field="name"[^>]*value="-ไม่มี-"/.test(t));
        check('แถวคัดลอกจากระดับมีคลาส row-tint ใน HTML',
          !!lvlTr && /class="[^"]*row-tint/.test(lvlTr), lvlTr ? (lvlTr.match(/class="[^"]*"/) || [''])[0] : 'ไม่พบ');
        check('แถวที่ผู้ใช้เพิ่มเอง "ไม่มี" คลาส row-tint ใน HTML',
          !!userTr && !/row-tint/.test(userTr), userTr ? (userTr.match(/class="[^"]*"/) || [''])[0] : 'ไม่พบ');
        // คืนค่าเดิม
        levelRowsData.length = 0;
        backupLevels.forEach(l => levelRowsData.push(l));
        structureRowsData.length = 0;
        backup.forEach(r => structureRowsData.push(r));
        switchTableTab('structure');
      })();
    })();

    console.log('\n=== 36) รอบ 26: การแสดงค่าในช่องตัวเลข (ค่าเริ่มต้นจากตาราง) ===');
    (function () {
      check('formatStructureCellValue("0.00") = "0.00" (ช่องแก้ได้โชว์ค่าเริ่มต้นจากตาราง)',
        formatStructureCellValue("0.00") === "0.00", formatStructureCellValue("0.00"));
      check('formatStructureCellValue("0") = "0"', formatStructureCellValue("0") === "0");
      check('formatStructureCellValue("") = "-"', formatStructureCellValue("") === "-");
      check('formatStructureCellValue("-") = "-"', formatStructureCellValue("-") === "-");
      check('formatStructureCellValue("1.50") = "1.50"', formatStructureCellValue("1.50") === "1.50");
      check('formatStructureCellValue("0.30") = "0.30"', formatStructureCellValue("0.30") === "0.30");

      // กด + แล้วแถวใหม่ (ยังไม่เลือกประเภทอาคาร) -> H ต้องเป็น "-"
      const backup = JSON.parse(JSON.stringify(structureRowsData));
      structureRowsData.length = 0;
      structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
      currentTab = 'structure';
      switchTableTab('structure');
      addStructureRowAt(0);
      const rows = capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
      const userTr = rows.find(t => /data-field="name"[^>]*value="-ไม่มี-"/.test(t));
      check('กด + แล้วแถวใหม่มีอยู่', !!userTr);
      const hCell = userTr ? (userTr.match(/data-col="5"[^>]*/) || [''])[0] : '';
      check('กด + แล้วช่อง H ของแถวใหม่แสดง "-"', /value="-"/.test(hCell), hCell.slice(0, 140));
      check('ค่าจริงในข้อมูลของแถวใหม่ H ว่าง (ไม่คัดลอกแถวบน)',
        String(structureRowsData.find(r => !r.isBoundary && !r.isFromLevel).hOverride) === "",
        JSON.stringify(structureRowsData.find(r => !r.isBoundary && !r.isFromLevel).hOverride));

      // sync จาก DOM ต้องไม่เขียน "-" ทับค่าจริง
      syncTableInputsToChannels();
      check('หลัง sync จาก DOM ค่า H ยังว่าง (ไม่ถูก "-" ทับ)',
        String(structureRowsData.find(r => !r.isBoundary && !r.isFromLevel).hOverride) === "",
        JSON.stringify(structureRowsData.find(r => !r.isBoundary && !r.isFromLevel).hOverride));

      // คืนค่าเดิม
      structureRowsData.length = 0;
      backup.forEach(r => structureRowsData.push(r));
      switchTableTab('structure');
    })();

    console.log('\n=== 37) รอบ 23: แถวแรก/สุดท้ายของชุด เลือกประเภทอาคารได้ ===');
    (function () {
      const backup = JSON.parse(JSON.stringify(structureRowsData));
      const backupLevels = JSON.parse(JSON.stringify(levelRowsData));
      levelRowsData.length = 0;
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 0, customKmEnd: 50, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 50, customKmEnd: 100, h: 0.00, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      structureRowsData.length = 0;
      structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
      currentTab = 'structure';
      switchTableTab('structure');

      const rowsOfTab = () => capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
      let trs = rowsOfTab();
      const startTr = trs.find(t => /value="อาคารท่อส่งน้ำเข้านา \(เดิม\)"/.test(t));
      const endTr = trs.find(t => /value="ปลายคู"/.test(t));
      const midTrs = trs.filter(t => /value="อาคารลดระดับ"/.test(t));

      check('แถวแรกของชุดมี combobox เลือกประเภทอาคารได้',
        !!startTr && startTr.includes('nameInput_') && startTr.includes('combobox-select'),
        startTr ? (startTr.match(/nameInput_\d+/) || [''])[0] : 'ไม่พบ');
      check('แถวสุดท้ายของชุดมี combobox เลือกประเภทอาคารได้',
        !!endTr && endTr.includes('nameInput_') && endTr.includes('combobox-select'),
        endTr ? (endTr.match(/nameInput_\d+/) || [''])[0] : 'ไม่พบ');
      check('แถวที่คัดลอกจากระดับ ก็เลือกประเภทอาคารได้ (ไม่ล็อกชื่อ)',
        midTrs.length > 0 && midTrs.every(t => t.includes('nameInput_') && t.includes('combobox-select')),
        midTrs.length + ' แถว');

      // เลือกประเภทอาคารในแถวแรก/สุดท้าย แล้วต้องไม่ถูกทับกลับ
      const startIdx = structureRowsData.findIndex(r => r.isBoundary && !r.isEndBoundary);
      const endIdx = structureRowsData.findIndex(r => r.isBoundary && r.isEndBoundary);
      check('ข้อมูลมีธงแยกแถวเริ่มต้น/สิ้นสุด', startIdx >= 0 && endIdx >= 0 && startIdx !== endIdx);
      updateStructureField(startIdx, 'name', 'อาคารท่อลอดถนนลดระดับ');
      updateStructureField(endIdx, 'name', 'อาคารสะพานน้ำแบบที่ 1');
      switchTableTab('structure');
      check('แถวแรกเปลี่ยนประเภทอาคารได้จริง (ไม่ถูกทับกลับ)',
        structureRowsData[startIdx].name === 'อาคารท่อลอดถนนลดระดับ', structureRowsData[startIdx].name);
      check('แถวสุดท้ายเปลี่ยนประเภทอาคารได้จริง (ไม่ถูกทับกลับ)',
        structureRowsData[endIdx].name === 'อาคารสะพานน้ำแบบที่ 1', structureRowsData[endIdx].name);

      // คืนค่าเดิม
      levelRowsData.length = 0;
      backupLevels.forEach(l => levelRowsData.push(l));
      structureRowsData.length = 0;
      backup.forEach(r => structureRowsData.push(r));
      switchTableTab('structure');
    })();

    console.log('\n=== 38) รอบ 24: 4 คอลัมน์สุดท้าย ใช้ค่าเริ่มต้นจากตาราง Typeอาคาร + สีเขียว ===');
    (function () {
      const backup = JSON.parse(JSON.stringify(structureRowsData));
      structureRowsData.length = 0;
      structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
      currentTab = 'structure';
      switchTableTab('structure');

      // ตั้งแถวแรกเป็นอาคารที่ตารางบอกว่า แก้ไขได้ทั้ง 3 ช่อง
      const startIdx = structureRowsData.findIndex(r => r.isBoundary && !r.isEndBoundary);
      structureRowsData[startIdx].name = 'อาคารท่อลอดถนนลดระดับ';
      structureRowsData[startIdx].hOverride = '';
      structureRowsData[startIdx].pipeDia = '';
      structureRowsData[startIdx].pipeCount = '';
      structureRowsData[startIdx].remark = '';
      updateTable();

      // ⚠️ หาแถวจาก "ช่องชื่ออาคาร" (id="nameInput_") ไม่ใช่ data-row
      //    และต้องไม่ไปโดน <option value="..."> ในลิสต์ตัวเลือก
      const rowByType = (typeName) => {
        const trs = capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
        const re = new RegExp('id="nameInput_\\d+"[^>]*value="' + typeName + '"');
        return trs.find(t => re.test(t)) || '';
      };
      const segOf = (typeName) => rowByType(typeName);
      const cellOf = (seg, col) => (seg.match(new RegExp('data-col="' + col + '"[^>]*')) || [''])[0];
      let seg = segOf('อาคารท่อลอดถนนลดระดับ');

      // ค่าเริ่มต้นจากตาราง Typeอาคาร: H=0.00 (แสดง -) / ศก.ท่อ=0.30 / ความยาว=5.00 / หมายเหตุ="-"
      check('ค่าเริ่มต้น ศก. ท่อ ของช่องที่แก้ได้ = 0.30 (จากตาราง Typeอาคาร)',
        /value="0\.30"/.test(cellOf(seg, 6)), cellOf(seg, 6));
      check('ค่าเริ่มต้น ความยาว ของช่องที่แก้ได้ = 5.00 (จากตาราง Typeอาคาร)',
        /value="5\.00"/.test(cellOf(seg, 7)), cellOf(seg, 7));
      check('H ของช่องที่แก้ได้ แสดงค่าเริ่มต้นจากตาราง = 0.00',
        /value="0\.00"/.test(cellOf(seg, 5)), cellOf(seg, 5));

      // สีเขียว: ช่องที่แก้ได้ต้องมีคลาส editable
      check('ช่อง H ที่แก้ได้ มีคลาส editable (เขียว)',
        /data-col="5"[^>]*class="table-input editable"|class="table-input editable"[^>]*data-col="5"/.test(seg), cellOf(seg, 5));
      check('ช่อง ศก. ท่อ ที่แก้ได้ มีคลาส editable (เขียว)',
        /combobox-input editable/.test(seg) && /data-col="6"/.test(seg));
      check('ช่อง ความยาว ที่แก้ได้ มีคลาส editable (เขียว)',
        (seg.match(/combobox-input editable/g) || []).length >= 2, (seg.match(/combobox-input editable/g) || []).length);
      check('ช่องหมายเหตุ ที่แก้ได้ ต้องเป็น locked เมื่ออาคารนี้ไม่ให้แก้หมายเหตุ',
        /data-col="8"[^>]*readonly/.test(seg), cellOf(seg, 8));

      // แถวสุดท้าย (ปลายคู) — เลือก "ประเภทอาคาร" ได้ แต่ 4 ช่องที่เหลือต้องไม่มีสีเขียว
      const endIdx = structureRowsData.findIndex(r => r.isBoundary && r.isEndBoundary);
      structureRowsData[endIdx].name = 'ปลายคู';
      structureRowsData[endIdx].hOverride = '';
      structureRowsData[endIdx].pipeDia = '';
      structureRowsData[endIdx].pipeCount = '';
      updateTable();
      const nameInputTagOf = (tr) => ((tr.match(/<input[^>]*>/g) || []).find(x => /data-field="name"/.test(x)) || '');
      const cellTagOf = (tr, col) => ((tr.match(/<input[^>]*>/g) || []).find(x => new RegExp('data-col="' + col + '"').test(x)) || '');
      const allTr = capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
      const endTr = allTr.find(tr => /value="ปลายคู"/.test(nameInputTagOf(tr))) || '';
      check('แถวสุดท้าย (ปลายคู): ช่องประเภทอาคารเลือกได้ (ไม่ readonly)',
        endTr !== '' && !/readonly/.test(nameInputTagOf(endTr)), nameInputTagOf(endTr));
      check('แถวสุดท้าย (ปลายคู): 4 ช่องท้ายไม่มีคลาส editable เลย',
        endTr !== '' && [5, 6, 7, 8].every(c => {
          const tag = cellTagOf(endTr, c);
          return tag !== '' && !/editable/.test(tag) && /readonly/.test(tag);
        }),
        [5, 6, 7, 8].map(c => c + ':' + cellTagOf(endTr, c)).join(' | '));

      // อาคารปากคูซอย: หมายเหตุแก้ได้ -> เขียว
      structureRowsData[startIdx].name = 'อาคารปากคูซอย';
      updateTable();
      const segPCS = segOf('อาคารปากคูซอย');
      check('อาคารปากคูซอย ช่องหมายเหตุมีคลาส editable (เขียว)',
        /data-col="8"[^>]*readonly/.test(segPCS) === false && /data-col="8"/.test(segPCS),
        cellOf(segPCS, 8));

      // คืนค่าเดิม
      structureRowsData.length = 0;
      backup.forEach(r => structureRowsData.push(r));
      switchTableTab('structure');
    })();

    console.log('\n=== 39) รอบ 25: แถวจากระดับเลือกชื่อได้ + ค่า H ไม่ดึงจากแท็ประดับคูส่งน้ำ + กด + ไม่คัดลอกค่า ===');
    (function () {
      const backup = JSON.parse(JSON.stringify(structureRowsData));
      const backupLevels = JSON.parse(JSON.stringify(levelRowsData));

      // ระดับคูส่งน้ำมีค่า H เป็น 0.50 / 0.30 -> ต้องไม่ถูกดึงมาแสดงในแท็บอาคารประกอบ
      levelRowsData.length = 0;
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 0, customKmEnd: 50, h: 0.50, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      levelRowsData.push({ channelId: 1, isDynamicRow: false, customType: "", customSlope: "", customKmStart: 50, customKmEnd: 100, h: 0.30, bl1: "", tbl1: "", bl2: "", tbl2: "" });
      structureRowsData.length = 0;
      structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
      currentTab = 'structure';
      switchTableTab('structure');

      const trsOf = () => capturedHtml.split(/<tr\b/).slice(1).filter(t => t.includes('<td'));
      const tagsOf = (tr) => tr.match(/<input[^>]*>/g) || [];
      const nameTag = (tr) => tagsOf(tr).find(x => /data-field="name"/.test(x)) || '';
      const cellTag = (tr, col) => tagsOf(tr).find(x => new RegExp('data-col="' + col + '"').test(x)) || '';
      const valOf = (tag) => (tag.match(/value="([^"]*)"/) || [])[1];

      let trs = trsOf();
      const lvlTr = trs.find(t => valOf(nameTag(t)) === 'อาคารลดระดับ');
      check('แถวที่คัดลอกจากระดับคูส่งน้ำ มี combobox เลือกประเภทอาคารได้',
        !!lvlTr && /id="nameInput_/.test(nameTag(lvlTr)), nameTag(lvlTr));
      check('แถวที่คัดลอกจากระดับ: ช่องชื่อไม่ readonly',
        !!lvlTr && !/readonly/.test(nameTag(lvlTr)));
      check('แถวที่คัดลอกจากระดับ: คัดลอกค่า H ของบรรทัดนั้นมาด้วย (0.30)',
        !!lvlTr && valOf(cellTag(lvlTr, 5)) === '0.30', lvlTr ? valOf(cellTag(lvlTr, 5)) : 'ไม่พบแถว');
      check('แถวสุดท้ายของคู (กม.สิ้นสุด) ไม่ใส่ค่า H -> "-"',
        (function () {
          const endTr = trs.find(t => /data-field="name"[^>]*value="ปลายคู"/.test(t));
          return !!endTr && valOf(cellTag(endTr, 5)) === '-';
        })(),
        (function () {
          const endTr = trs.find(t => /data-field="name"[^>]*value="ปลายคู"/.test(t));
          return endTr ? valOf(cellTag(endTr, 5)) : 'ไม่พบแถว';
        })());

      // กด + ต้องไม่คัดลอกค่า H จากแถวบน
      structureRowsData[0].hOverride = '1.75';
      updateTable();
      addStructureRowAt(0);
      check('กด + แล้วแถวใหม่ H ว่าง (ไม่คัดลอก 1.75 จากแถวบน)',
        structureRowsData[1].hOverride === '', JSON.stringify(structureRowsData.map(r => r.hOverride)));
      check('กด + แล้วแถวใหม่ ศก. ท่อ/ความยาว ว่าง (ไม่คัดลอกจากแถวบน)',
        structureRowsData[1].pipeDia === '' && structureRowsData[1].pipeCount === '',
        JSON.stringify([structureRowsData[1].pipeDia, structureRowsData[1].pipeCount]));

      updateTable();
      trs = trsOf();
      const newTr = trs.find(t => valOf(nameTag(t)) === '-ไม่มี-');
      check('แถวใหม่แสดง H เป็น "-" (ไม่ใช่ 1.75)',
        !!newTr && valOf(cellTag(newTr, 5)) === '-', newTr ? valOf(cellTag(newTr, 5)) : 'ไม่พบแถว');

      // คืนค่าเดิม
      levelRowsData.length = 0;
      backupLevels.forEach(l => levelRowsData.push(l));
      structureRowsData.length = 0;
      backup.forEach(r => structureRowsData.push(r));
      switchTableTab('structure');
    })();

    console.log('\n=== 40) รอบ 27: ความปลอดภัยข้อมูล (ยืนยันก่อนลบ · คัดลอก · ภาพในไฟล์โปรเจกต์ · เพดาน canvas) ===');
    (function () {
      const coreSrc = fs.readFileSync(path.join(base, 'js/table-core.js'), 'utf8');
      const ioSrc = fs.readFileSync(path.join(base, 'js/io-manager.js'), 'utf8');
      const cvSrc = fs.readFileSync(path.join(base, 'js/canvas-viewer.js'), 'utf8');
      const structSrc = fs.readFileSync(path.join(base, 'js/tab-structure.js'), 'utf8');
      const stateSrc = fs.readFileSync(path.join(base, 'js/state.js'), 'utf8');
      const htmlSrc4 = fs.readFileSync(path.join(base, 'index.html'), 'utf8');

      check('มี confirmDelete() ใช้ uiConfirm ถามก่อนลบ (และยังลบได้เมื่อไม่มีกล่องยืนยัน)',
        /function confirmDelete\(message, doIt, okText\)/.test(coreSrc) &&
        /if \(typeof uiConfirm === 'function'\)/.test(coreSrc));
      const deleteFns = ['deleteChannelAt', 'deleteDimensionRowAt', 'deleteLevelRowAt', 'deleteGroundRowAt',
        'deleteStructureRowAt', 'deleteAttachmentRowAt', 'deleteDitchTypeRow', 'deleteStructureTypeRow'];
      const filesWithDeletes = [fs.readFileSync(path.join(base, 'js/tab-ditch.js'), 'utf8'),
        fs.readFileSync(path.join(base, 'js/tab-dimension.js'), 'utf8'),
        fs.readFileSync(path.join(base, 'js/tab-level.js'), 'utf8'),
        fs.readFileSync(path.join(base, 'js/tab-ground.js'), 'utf8'),
        structSrc,
        fs.readFileSync(path.join(base, 'js/tab-attachment.js'), 'utf8'),
        fs.readFileSync(path.join(base, 'js/tab-type.js'), 'utf8')].join('\n');
      const noConfirm = deleteFns.filter(fn => !new RegExp('function ' + fn + '\\([^)]*\\)\\s*\\{[\\s\\S]{0,1200}?confirmDelete\\(').test(filesWithDeletes));
      check('ปุ่มลบทั้ง 8 ตัว ผ่าน confirmDelete() ทุกตัว', noConfirm.length === 0, 'ยังไม่ยืนยัน: ' + noConfirm.join(', '));

      check('มี writeToClipboard() ที่มี fallback + แจ้งเตือนเมื่อคัดลอกไม่สำเร็จ',
        /function writeToClipboard\(text, successMsg\)/.test(ioSrc) && /execCommand/.test(ioSrc));
      check('call-site เดิมที่ไม่มี .catch() ถูกแทนด้วย writeToClipboard() หมดแล้ว',
        !/navigator\.clipboard\.writeText\(textToCopy/.test(ioSrc) &&
        (ioSrc.match(/writeToClipboard\(/g) || []).length >= 9);

      check('เปลี่ยนชื่อ Type อาคารประกอบแล้วอัปเดตแถวที่ใช้ชื่อเดิมด้วย',
        /structureRowsData\.forEach\(r => \{ if \(r\.name === oldName\) r\.name = val; \}\)/.test(
          fs.readFileSync(path.join(base, 'js/tab-type.js'), 'utf8')));

      check('ไฟล์โปรเจกต์แนบภาพ (imageData) + พิกัดเป็นพิกัดภาพเต็ม (coordSpace)',
        /imageData: buildProjectImagePayload\(\)/.test(ioSrc) &&
        /coordSpace: 'image'/.test(ioSrc) && /function buildOverlayPayload\(\)/.test(ioSrc));
      check('โหลดโปรเจกต์แล้วกู้ภาพกลับ (restoreProjectImage) + เตือนเมื่อไฟล์ไม่มีภาพ',
        /function restoreProjectImage\(imageData, rotation, coordsInImageSpace\)/.test(ioSrc) &&
        /ไฟล์นี้ไม่ได้แนบภาพแปลนมาด้วย/.test(ioSrc));

      check('มีลิสต์ความยาวของจริง (lengthOptions) และใช้กับคอลัมน์ความยาว',
        /const lengthOptions = \[/.test(stateSrc) && /lengthOptions\.map/.test(structSrc));

      check('เพดาน bitmap ของ canvas ถูกบังคับตอนซูมลึก (MAX_CANVAS_DIM / logicalW)',
        /MAX_CANVAS_DIM \/ logicalW/.test(cvSrc));
      check('ปิดช่องโหว่ pdf.js CVE-2024-4367 (isEvalSupported: false)',
        /isEvalSupported: false/.test(cvSrc));
      check('index.html ใช้ SheetJS รุ่นที่แก้ CVE-2023-30533 + มี fallback + กัน pdfjsLib undefined',
        /cdn\.sheetjs\.com\/xlsx-0\.20\.3/.test(htmlSrc4) && /onerror=/.test(htmlSrc4) &&
        /typeof pdfjsLib !== 'undefined'/.test(htmlSrc4));
    })();

    // ===== รอบ 28: formatKmDisplayDecimal + kmHasDecimal (กม. ทศนิยมในแท็บอาคารประกอบ) =====
    console.log('\n=== 41) รอบ 28: กม. ทศนิยม 2 ตำแหน่ง (เฉพาะอาคารประกอบ เมื่อค่ามีทศนิยม) ===');
    check('formatKmDisplayDecimal(1050.4) = "1+050.40"',
      formatKmDisplayDecimal(1050.4) === '1+050.40', formatKmDisplayDecimal(1050.4));
    check('formatKmDisplayDecimal(0.5) = "0+000.50"',
      formatKmDisplayDecimal(0.5) === '0+000.50', formatKmDisplayDecimal(0.5));
    check('formatKmDisplayDecimal(50.25) = "0+050.25"',
      formatKmDisplayDecimal(50.25) === '0+050.25', formatKmDisplayDecimal(50.25));
    check('formatKmDisplayDecimal(1050) = "1+050.00" (ค่าลงตัวก็แสดง .00)',
      formatKmDisplayDecimal(1050) === '1+050.00', formatKmDisplayDecimal(1050));
    check('formatKmDisplayDecimal(-50.25) = "-0+050.25"',
      formatKmDisplayDecimal(-50.25) === '-0+050.25', formatKmDisplayDecimal(-50.25));
    check('formatKmDisplayDecimal("") = "" (ค่าว่าง)',
      formatKmDisplayDecimal('') === '', JSON.stringify(formatKmDisplayDecimal('')));
    check('kmHasDecimal(1050.4) = true', kmHasDecimal(1050.4) === true);
    check('kmHasDecimal(1050) = false', kmHasDecimal(1050) === false);
    check('kmHasDecimal(1050.01) = true (เกิน tolerance 0.005)', kmHasDecimal(1050.01) === true);
    check('kmHasDecimal(1049.99) = true (เกิน tolerance 0.005)', kmHasDecimal(1049.99) === true);
    check('kmHasDecimal(1050.001) = false (ภายใน tolerance 0.005 = ปัดเป็นจำนวนเต็ม)', kmHasDecimal(1050.001) === false);
    check('kmHasDecimal(0) = false', kmHasDecimal(0) === false);
    check('kmHasDecimal("") = false (ค่าว่าง)', kmHasDecimal('') === false);
    // ยืนยันว่า formatKmDisplay เดิมไม่ถูกแก้ (แท็บอื่นต้องไม่กระทบ)
    check('formatKmDisplay(1050.4) ยังคงปัดเป็น "1+050" (เดิม)',
      formatKmDisplay(1050.4) === '1+050', formatKmDisplay(1050.4));
    check('formatKmDisplay(1050) = "1+050" (เดิม)',
      formatKmDisplay(1050) === '1+050', formatKmDisplay(1050));

    // ===== รอบ 28: ตรวจว่า renderStructureTab ใช้ formatKmDisplayDecimal เฉพาะแถวที่มีทศนิยม =====
    const decBefore = capturedHtml;
    structureRowsData.push({ channelId: 1, isBoundary: false, isFromLevel: false, km: 50.40, name: "-ไม่มี-", hOverride: "", pipeDia: "", pipeCount: "", remark: "" });
    structureRowsData.push({ channelId: 1, isBoundary: false, isFromLevel: false, km: 75, name: "-ไม่มี-", hOverride: "", pipeDia: "", pipeCount: "", remark: "" });
    // ปลดล็อกกลุ่มก่อน เพื่อให้ kmInput เป็น input แก้ไขได้ (ไม่ใช่ readonly)
    structureGroupState['struct_ch_1'] = { locked: false, collapsed: false };
    updateTable();
    const decHtml = capturedHtml;
    capturedHtml = decBefore;  // คืนค่าเดิม
    // ค้นหา value="..." ของ input กม. ใน 2 แถวที่เพิ่ม
    const decimalMatch = (decHtml.match(/data-field="km"[^>]*value="([^"]*)"/g) || []);
    let decimalFound = false, integerFound = false;
    for (let m of decimalMatch) {
      let valM = m.match(/value="([^"]*)"/);
      if (valM) {
        if (valM[1] === '0+050.40') decimalFound = true;
        if (valM[1] === '0+075') integerFound = true;
      }
    }
    check('แถว กม.=50.40 แสดงเป็น "0+050.40" (ทศนิยม 2 ตำแหน่ง)', decimalFound, decimalMatch.join(' | '));
    check('แถว กม.=75 แสดงเป็น "0+075" (จำนวนเต็ม ไม่มี .00)', integerFound, decimalMatch.join(' | '));
    // ลบแถวที่เพิ่มออกก่อนจบ
    structureRowsData.length = structureRowsData.length - 2;

    // ===== รอบ 28: ตรวจ dead code ถูกลบจริง =====
    check('isZeroValue ถูกลบออกจาก production แล้ว (typeof === "undefined")',
      typeof isZeroValue === 'undefined');
    check('getStructureRowHForName ถูกลบออกจาก production แล้ว (typeof === "undefined")',
      typeof getStructureRowHForName === 'undefined');

    // ===== รอบ 29: ย้ายแท็บ "แผนงานโครงการ" ไปอยู่หน้าเมนูประมาณการ =====
    console.log('\n=== รอบ 29: renderEstimateSummaryTab + showEstimateSummary ===');

    // เตรียม element ให้ showEstimateSummary ทำงานได้
    mockElements['estimateSummaryPage'] = makeEl('estimateSummaryPage');

    // 1) รอบ 46: mainTabIds เพิ่ม 'project' ไว้หน้าสุดตามคำสั่งผู้ใช้ (ข้อ 6)
    check('mainTabIds มี "project" อยู่หน้าสุด',
      mainTabIds.includes('project') && mainTabIds[0] === 'project');
    check('mainTabIds มี "ditch" เป็นลำดับถัดมา',
      mainTabIds[1] === 'ditch');

    // 2) renderEstimateSummaryPage() ต้อง render ออกมาไม่ throw
    // เตรียม div target
    mockElements['estimateSummaryPage'] = makeEl('estimateSummaryPage');
    let renderThrew = false;
    try { renderEstimateSummaryPage(); } catch (e) { renderThrew = true; }
    check('renderEstimateSummaryPage() ไม่ throw', !renderThrew);

    // 3) เนื้อหาที่ render ต้องมี progress bar, checklist, stat grid
    const summaryHtml = mockElements['estimateSummaryPage'].innerHTML || '';
    check('summary มี progress bar', summaryHtml.includes('estimate-progress-bar-inner'));
    check('summary มี checklist item', summaryHtml.includes('estimate-checklist-item'));
    check('summary มี stat grid', summaryHtml.includes('estimate-stat-grid'));

    // 4) summary ต้องแสดงจำนวนแถวจาก state
    const chCount = (channels || []).filter(c => c).length;
    const dimCount = (dimensionRows || []).length;
    const strCount = (structureRowsData || []).length;
    const attCount = (attachmentRowsData || []).length;
    check('summary แสดงจำนวนคูส่งน้ำ', summaryHtml.includes(`>${chCount}</div>`));
    check('summary แสดงจำนวนช่วงมิติ', summaryHtml.includes(`${dimCount}/`));
    check('summary แสดงจำนวนอาคารประกอบ', summaryHtml.includes(`>${strCount}</div>`));
    check('summary แสดงจำนวนอาคารท่อรับน้ำ', summaryHtml.includes(`>${attCount}</div>`));

    // 5) renderProjectPlanPage() ต้อง render ฟอร์มโครงการ
    mockElements['projectPlanPage'] = makeEl('projectPlanPage');
    let projectThrew = false;
    try { renderProjectPlanPage(); } catch (e) { projectThrew = true; }
    check('renderProjectPlanPage() ไม่ throw', !projectThrew);

    const projectHtml = mockElements['projectPlanPage'].innerHTML || '';
    check('project page มี projPlanName (ฟอร์มชื่อโครงการ)', projectHtml.includes('id="projPlanName"'));
    check('project page มี projPlanLoc (ฟอร์มที่อยู่)', projectHtml.includes('id="projPlanLoc"'));
    check('project page มี projPlanDesc (ฟอร์มรายละเอียด)', projectHtml.includes('id="projPlanDesc"'));
    check('project page มี onchange=updateProjectPlanField', projectHtml.includes("updateProjectPlanField('name'"));

    // 6) summary ต้องไม่มีฟอร์มโครงการ (เพราะย้ายไป project page แล้ว)
    check('summary ไม่มีฟอร์มชื่อโครงการ (ย้ายไป project page)',
      !summaryHtml.includes('id="projPlanName"'));

    // 7) showEstimateSummary ถูกลบออกแล้ว (ใช้ renderEstimateSummaryPage แทน)
    check('showEstimateSummary ถูกลบออกจาก production แล้ว (typeof === "undefined")',
      typeof showEstimateSummary === 'undefined');

    // 8) รอบ 46: renderProjectTab ถูกนำกลับมาใช้สำหรับแท็บ "แผนงานโครงการ" หน้าสุด (ข้อ 6)
    check('renderProjectTab มีอยู่ใน production (typeof === "function")',
      typeof renderProjectTab === 'function');

    // 9) รอบ 46: switchTableTab('project') ต้อง activate แท็บ project ได้จริง
    mainTabIds.forEach(id => {
      const btn = document.getElementById('tab-btn-' + id);
      if (btn) btn.classList.remove('active');
    });
    settingsSubTabs.forEach(name => {
      const chip = document.getElementById('subtab-btn-' + name);
      if (chip) chip.classList.remove('active');
    });
    switchTableTab('project');
    const stillActive = mainTabIds.filter(id => {
      const el = document.getElementById('tab-btn-' + id);
      return el && el.classList.contains('active');
    });
    check('switchTableTab("project") ทำให้แท็บ project เป็น active', stillActive.length === 1 && stillActive[0] === 'project');
    switchTableTab('ditch');

    // 10) openTakeoffFromEstimate() ต้องซ่อนทั้ง summary และ project page
    // simulate: เปิด summary page ก่อน
    const summaryPage = document.getElementById('estimateSummaryPage');
    if (summaryPage) summaryPage.style.display = 'block';
    const projPage = document.getElementById('projectPlanPage');
    if (projPage) projPage.style.display = 'block';

    openTakeoffFromEstimate();
    check('openTakeoffFromEstimate(): ซ่อน estimateSummaryPage แล้ว',
      document.getElementById('estimateSummaryPage').style.display === 'none');
    check('openTakeoffFromEstimate(): ซ่อน projectPlanPage แล้ว',
      document.getElementById('projectPlanPage').style.display === 'none');

    // 11) returnToTakeoff() ต้องซ่อนทั้ง summary และ project page ด้วย
    if (summaryPage) summaryPage.style.display = 'block';
    if (projPage) projPage.style.display = 'block';
    returnToTakeoff();
    check('returnToTakeoff(): ซ่อน estimateSummaryPage แล้ว',
      document.getElementById('estimateSummaryPage').style.display === 'none');
    check('returnToTakeoff(): ซ่อน projectPlanPage แล้ว',
      document.getElementById('projectPlanPage').style.display === 'none');

    // 12) source code check: ไม่มี class is-summary-mode ใน CSS และ JS (เพราะเลิกใช้แล้ว)
    const cssSrc2 = fs.readFileSync(path.join(base, 'style.css'), 'utf8');
    check('CSS ไม่มี .is-summary-mode (เลิกใช้แล้ว)',
      !cssSrc2.includes('is-summary-mode'));
    const tableCoreSrc = fs.readFileSync(path.join(base, 'js/table-core.js'), 'utf8');
    check('table-core.js ไม่มี is-summary-mode (เลิกใช้แล้ว)',
      !tableCoreSrc.includes('is-summary-mode'));
    const canvasViewerSrc = fs.readFileSync(path.join(base, 'js/canvas-viewer.js'), 'utf8');
    check('canvas-viewer.js ไม่มี is-summary-mode (เลิกใช้แล้ว)',
      !canvasViewerSrc.includes('is-summary-mode'));

    // 13) source code check: switchMainMenu ต้องมี case 'project' (คืนเมนูแผนงานโครงการ)
    check('canvas-viewer.js: switchMainMenu มี case "project" (คืนเมนูแผนงานโครงการ)',
      /function switchMainMenu[\s\S]*?menuKey === 'project'/.test(canvasViewerSrc));
    check('canvas-viewer.js: switchMainMenu มี case "estimate"',
      /function switchMainMenu[\s\S]*?menuKey === 'estimate'/.test(canvasViewerSrc));
    check('canvas-viewer.js: switchMainMenu มีการเรียก renderEstimateSummaryPage',
      canvasViewerSrc.includes('renderEstimateSummaryPage'));
    check('canvas-viewer.js: switchMainMenu มีการเรียก renderProjectPlanPage',
      canvasViewerSrc.includes('renderProjectPlanPage'));

    // 14) index.html มีเมนู "แผนงานโครงการ" กลับมาแล้ว
    const indexHtml = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
    check('index.html มีเมนู "แผนงานโครงการ" กลับมาใน sidebar',
      /switchMainMenu\('project'/.test(indexHtml) && /แผนงานโครงการ/.test(indexHtml));

    // 15) index.html มี div #projectPlanPage และ #estimateSummaryPage
    check('index.html มี <div id="projectPlanPage">', indexHtml.includes('id="projectPlanPage"'));
    check('index.html มี <div id="estimateSummaryPage">', indexHtml.includes('id="estimateSummaryPage"'));

    // 16) === รอบ 31: ปุ่ม ล็อก/แก้ไข = ย่อ/ขยาย + default collapsed ===
    check('renderLockButtonHtml: state-locked = "✔ แก้ไข" (expand)',
      /state-locked[\s\S]{0,300}✔ แก้ไข/.test(tableCoreSrc));
    check('renderLockButtonHtml: state-edit = "🔒 ล็อก" (collapse)',
      /state-edit[\s\S]{0,300}🔒 ล็อก/.test(tableCoreSrc));

    // 17) ตรวจว่า default ของ groupState เป็น locked + collapsed (true, true)
    const tabGroundSrc = fs.readFileSync(path.join(base, 'js/tab-ground.js'), 'utf8');
    const tabLevelSrc = fs.readFileSync(path.join(base, 'js/tab-level.js'), 'utf8');
    const tabStructureSrc = fs.readFileSync(path.join(base, 'js/tab-structure.js'), 'utf8');
    const tabAttachmentSrc = fs.readFileSync(path.join(base, 'js/tab-attachment.js'), 'utf8');

    check('tab-ground.js: default groupState = locked + collapsed',
      /\{ locked: true, collapsed: true \}/.test(tabGroundSrc));
    check('tab-level.js: default groupState = locked + collapsed',
      /\{ locked: true, collapsed: true \}/.test(tabLevelSrc));
    check('tab-structure.js: default groupState = locked + collapsed',
      /\{ locked: true, collapsed: true \}/.test(tabStructureSrc));
    check('tab-attachment.js: default groupState = locked + collapsed',
      /\{ collapsed: true, locked: true \}/.test(tabAttachmentSrc));

    // 18) === แยกอิสระ: ปุ่ม Lock/Edit toggle แค่ locked · ปุ่ม + / - toggle แค่ collapsed ===
    check('tab-ground.js: toggleGroundGroupLock toggle แค่ locked (ไม่แตะ collapsed)',
      /function\s+toggleGroundGroupLock[\s\S]{0,500}\.locked\s*=\s*![\s\S]{0,80}\.collapsed/.test(tabGroundSrc) === false
      && /function\s+toggleGroundGroupLock[\s\S]{0,500}\.locked\s*=\s*!/.test(tabGroundSrc));
    check('tab-ground.js: toggleGroundGroupCollapse toggle แค่ collapsed (ไม่แตะ locked)',
      /function\s+toggleGroundGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*![\s\S]{0,80}\.locked\s*=/.test(tabGroundSrc) === false
      && /function\s+toggleGroundGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*!/.test(tabGroundSrc));

    check('tab-level.js: toggleGroupLock toggle แค่ locked (ไม่แตะ collapsed)',
      /function\s+toggleGroupLock[\s\S]{0,500}\.locked\s*=\s*![\s\S]{0,80}\.collapsed/.test(tabLevelSrc) === false
      && /function\s+toggleGroupLock[\s\S]{0,500}\.locked\s*=\s*!/.test(tabLevelSrc));
    check('tab-level.js: toggleGroupCollapse toggle แค่ collapsed (ไม่แตะ locked)',
      /function\s+toggleGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*![\s\S]{0,80}\.locked\s*=/.test(tabLevelSrc) === false
      && /function\s+toggleGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*!/.test(tabLevelSrc));

    check('tab-structure.js: toggleStructureGroupLock toggle แค่ locked (ไม่แตะ collapsed)',
      /function\s+toggleStructureGroupLock[\s\S]{0,500}\.locked\s*=\s*![\s\S]{0,80}\.collapsed/.test(tabStructureSrc) === false
      && /function\s+toggleStructureGroupLock[\s\S]{0,500}\.locked\s*=\s*!/.test(tabStructureSrc));
    check('tab-structure.js: toggleStructureGroupCollapse toggle แค่ collapsed (ไม่แตะ locked)',
      /function\s+toggleStructureGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*![\s\S]{0,80}\.locked\s*=/.test(tabStructureSrc) === false
      && /function\s+toggleStructureGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*!/.test(tabStructureSrc));

    check('tab-attachment.js: toggleAttachmentGroupLock toggle แค่ locked (ไม่แตะ collapsed)',
      /function\s+toggleAttachmentGroupLock[\s\S]{0,800}\.locked\s*=\s*![\s\S]{0,80}\.collapsed/.test(tabAttachmentSrc) === false
      && /function\s+toggleAttachmentGroupLock[\s\S]{0,800}\.locked\s*=\s*!/.test(tabAttachmentSrc));
    check('tab-attachment.js: toggleAttachmentGroupCollapse toggle แค่ collapsed (ไม่แตะ locked)',
      /function\s+toggleAttachmentGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*![\s\S]{0,80}\.locked\s*=/.test(tabAttachmentSrc) === false
      && /function\s+toggleAttachmentGroupCollapse[\s\S]{0,500}\.collapsed\s*=\s*!/.test(tabAttachmentSrc));

    // 19) === รอบ 31: P1/P2 ต่อ channel (เก็บใน groupState) ===
    check('canvas-viewer.js: บันทึก P1/P2 ลง groundGroupState เมื่อคลิก canvas',
      /refPixels\[currentMode\][\s\S]{0,500}groundGroupState[\s\S]{0,200}p1Ref|p2Ref/.test(canvasViewerSrc));
    check('tab-ground.js: drawGroundFromTable ใช้ P1/P2 จาก groupState',
      /drawGroundFromTable[\s\S]{0,1500}getChannelRef/.test(tabGroundSrc) ||
      /drawGroundFromTable[\s\S]{0,1500}groundGroupState/.test(tabGroundSrc));
    check('tab-ground.js: มีฟังก์ชัน getChannelRef / getChannelP1P2',
      /function getChannelRef/.test(tabGroundSrc) && /function getChannelP1P2/.test(tabGroundSrc));
    check('tab-ground.js: มีปุ่ม/UI ให้ clear P1/P2 ต่อ channel',
      /function clearGroundP1P2/.test(tabGroundSrc));
    check('tab-ground.js: drawGroundFromTable tag channelId ใน tableGroundLinePoints',
      /tableGroundLinePoints[\s\S]{0,1000}channelId: cIdx/.test(tabGroundSrc));
    check('tab-level.js: drawCanalLevelLines tag channelId ใน canalLevelDrawingLines',
      /canalLevelDrawingLines\.push[\s\S]{0,500}channelId: cIdx/.test(tabLevelSrc));

    // 20) === รอบ 31: คอลัมน์ "แสดงวาด" (toggle showDrawing) ===
    check('tab-ground.js: มีฟังก์ชัน toggleGroundShowDrawing',
      /function toggleGroundShowDrawing/.test(tabGroundSrc));
    check('tab-ground.js: renderGroundTab มี checkbox toggle showDrawing',
      /toggleGroundShowDrawing\([\s\S]{0,50}this\.checked/.test(tabGroundSrc));
    check('canvas-viewer.js: redraw() กรองตาม showDrawing (helper _isChannelHidden)',
      /function _isChannelHidden|_isChannelHidden/.test(canvasViewerSrc));
    check('canvas-viewer.js: redraw() ใช้ _visibleTable (กรอง tableGroundLinePoints)',
      /_visibleTable/.test(canvasViewerSrc));
    check('canvas-viewer.js: redraw() ใช้ _visibleCanal (กรอง canalLevelDrawingLines)',
      /_visibleCanal/.test(canvasViewerSrc));

    // 21) === รอบ 31: Auto load PDF — ลบออกแล้ว (ตามคำสั่งผู้ใช้) ===
    //    - ลบฟังก์ชัน autoLoadDataAfterUpload
    //    - ลบฟังก์ชัน resetProjectStateForNewFile
    //    - ลบปุ่ม "เชฟตามชื่อไฟล์"
    //    - ลบ auto-save ใน saveProjectJSON
    check('canvas-viewer.js: ไม่มีฟังก์ชัน autoLoadDataAfterUpload แล้ว',
      !/function autoLoadDataAfterUpload/.test(canvasViewerSrc));
    check('canvas-viewer.js: ไม่มีฟังก์ชัน resetProjectStateForNewFile แล้ว',
      !/function resetProjectStateForNewFile/.test(canvasViewerSrc));
    check('canvas-viewer.js: ไม่เรียก autoLoadDataAfterUpload แล้ว',
      !/autoLoadDataAfterUpload\(\)/.test(canvasViewerSrc));
    check('io-manager.js: ลบฟังก์ชัน autosaveProjectToLocal แล้ว',
      !/function autosaveProjectToLocal/.test(fs.readFileSync(path.join(base, 'js/io-manager.js'), 'utf8')));
    check('io-manager.js: ลบ project_autosave_ key แล้ว',
      !/project_autosave_/.test(fs.readFileSync(path.join(base, 'js/io-manager.js'), 'utf8')));
    check('table-core.js: ลบปุ่ม "เชฟตามชื่อไฟล์" แล้ว',
      !/เชฟตามชื่อไฟล์/.test(tableCoreSrc));
    // 22) === รอบก่อนหน้า: Autosave เฟส 1 (bclc_fast_autosave_v1) — ลบออกแล้ว ===
    const ioManagerSrc = fs.readFileSync(path.join(base, 'js/io-manager.js'), 'utf8');
    check('io-manager.js: ลบ AUTOSAVE_KEY (bclc_fast_autosave_v1) แล้ว',
      !/AUTOSAVE_KEY/.test(ioManagerSrc) && !/bclc_fast_autosave_v1/.test(ioManagerSrc));
    check('io-manager.js: ลบฟังก์ชัน initAutosave แล้ว',
      !/function initAutosave/.test(ioManagerSrc));
    check('io-manager.js: ลบฟังก์ชัน scheduleAutosave แล้ว',
      !/function scheduleAutosave/.test(ioManagerSrc));
    check('io-manager.js: ลบฟังก์ชัน persistAutosave แล้ว',
      !/function persistAutosave/.test(ioManagerSrc));
    check('io-manager.js: ลบฟังก์ชัน getAutosaveStorage แล้ว',
      !/function getAutosaveStorage/.test(ioManagerSrc));
    check('io-manager.js: ลบตัวแปร autosaveTimer แล้ว',
      !/let autosaveTimer/.test(ioManagerSrc));
    check('index.html: ลบ initAutosave() ใน init script แล้ว',
      !/initAutosave\(\)/.test(fs.readFileSync(path.join(base, 'index.html'), 'utf8')));
    check('index.html: ลบ alert "กู้คืนงานล่าสุดจาก autosave" แล้ว',
      !/กู้คืนงานล่าสุดจาก autosave/.test(fs.readFileSync(path.join(base, 'index.html'), 'utf8')));
    check('table-core.js: ลบการเรียก scheduleAutosave() แล้ว',
      !/scheduleAutosave\(\)/.test(tableCoreSrc));
    // 23) === รอบปัจจุบัน: แก้บั๊ก render PDF page — render เก่าทับ render ใหม่ ===
    check('canvas-viewer.js: มี currentRenderToken ป้องกัน race',
      /let currentRenderToken\s*=/.test(canvasViewerSrc));
    check('canvas-viewer.js: renderPDFPage ใช้ token ตรวจก่อน getPage',
      /getPage\(num\)[\s\S]{0,200}myToken\s*!==\s*currentRenderToken/.test(canvasViewerSrc));
    check('canvas-viewer.js: renderPDFPage ใช้ token ตรวจหลัง render',
      /page\.render[\s\S]{0,400}myToken\s*!==\s*currentRenderToken[\s\S]{0,300}return/.test(canvasViewerSrc));
    check('canvas-viewer.js: renderPDFPage ใช้ token ใน img.onload',
      /img\.onload\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,200}myToken\s*!==\s*currentRenderToken/.test(canvasViewerSrc));
    check('canvas-viewer.js: thumbnail.onclick เป็น async + await renderPDFPage',
      /card\.onclick\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]{0,200}await\s+renderPDFPage/.test(canvasViewerSrc));
    // 24) === รอบปัจจุบัน: เก็บ PDF ฉบับเต็มใน JSON เพื่อให้โหลดกลับมาได้ทุกหน้า ===
    const stateSrc = fs.readFileSync(path.join(base, 'js/state.js'), 'utf8');
    check('state.js: ประกาศตัวแปร pdfFileDataUrl แล้ว',
      /let\s+pdfFileDataUrl\s*=/.test(stateSrc));
    check('canvas-viewer.js: ตอนอัปโหลด PDF เก็บ base64 ลง pdfFileDataUrl',
      /pdfFileDataUrl\s*=\s*'data:application\/pdf;base64,/.test(canvasViewerSrc));
    check('io-manager.js: buildProjectImagePayload แนบ pdfFileDataUrl + currentPage + totalPages',
      /pdfFileDataUrl:.*pdfFileDataUrl/.test(ioManagerSrc) &&
      /currentPage:/.test(ioManagerSrc) &&
      /totalPages:/.test(ioManagerSrc));
    check('io-manager.js: restoreProjectImage กู้ PDF กลับด้วย pdf.js (ไม่ใช่ image ธรรมดา)',
      /async\s+function\s+restoreProjectImage/.test(ioManagerSrc) &&
      /imageData\.pdfFileDataUrl\s*&&/.test(ioManagerSrc) &&
      /pdfjsLib\.getDocument\(\s*\{\s*data:\s*bytes/.test(ioManagerSrc) &&
      /isEvalSupported:\s*false/.test(ioManagerSrc));
    check('io-manager.js: loadProjectDataObject เป็น async + await restoreProjectImage',
      /async\s+function\s+loadProjectDataObject/.test(ioManagerSrc) &&
      /await\s+restoreProjectImage/.test(ioManagerSrc));
    check('io-manager.js: loadProjectJSON เรียก await loadProjectDataObject',
      /onload\s*=\s*async\s+function[\s\S]{0,200}await\s+loadProjectDataObject/.test(ioManagerSrc));

    console.log(fails === 0 ? '\n*** ALL CHECKS PASSED ***' : '\n*** ' + fails + ' CHECK(S) FAILED ***');
  }, 50);
} catch (e) {
  check('exportAllToExcel', false, e.message);
  console.log(fails === 0 ? '\n*** ALL CHECKS PASSED ***' : '\n*** ' + fails + ' CHECK(S) FAILED ***');
}
