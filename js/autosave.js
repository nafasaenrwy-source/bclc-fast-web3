// ===== js/autosave.js =====
// รอบ 37: "ระบบเชฟอัตโนมัติ" — เชฟอัตโนมัติทุก 5 นาที (เก็บสำรองในเบราว์เซอร์อย่างเดียว)
//
// สิ่งที่ระบบนี้ทำ:
//   1) ทุก 5 นาที ตรวจว่ามีข้อมูลเปลี่ยนแปลงหรือไม่ (เทียบ "ลายนิ้วมือ" ของข้อมูลกับครั้งที่เชฟล่าสุด)
//      → ถ้าไม่มีอะไรเปลี่ยน ก็ไม่เชฟ (ไม่กินพื้นที่)
//   2) ถ้ามีการเปลี่ยนแปลง → เก็บสำรองลงเบราว์เซอร์ (IndexedDB) อัตโนมัติเสมอ ไม่ต้องขอสิทธิ์
//      รอบ 37: ตัด "เขียนทับไฟล์จริง" (File System Access API) ออก เหลือเก็บสำรองในเบราว์เซอร์ทางเดียว
//   3) เมื่อเปิดหน้าเว็บ ถ้ามีสำรองค้างอยู่ → ถามผู้ใช้ก่อนว่าจะกู้คืนหรือไม่ (ไม่กู้คืนเงียบ ๆ)
//
// ข้อมูลที่เชฟได้ = ข้อมูลชุดเดียวกับที่ปุ่ม "💾 บันทึก" ใช้ (buildProjectBackup())
//   → รวมไฟล์ PDF ฉบับเต็ม (pdfFileDataUrl) และผลอ่าน AI ของแท็บ 🤖 ผลอ่าน AI แล้ว

// ===== ค่าคงที่ =====
const AUTOSAVE_INTERVAL_MS = 10 * 60 * 1000;  // รอบ 46: เชฟทุกๆ 10 นาที (ใช้เวลาในเครื่องตรวจสอบ)
const AUTOSAVE_DB_NAME = 'bclc_autosave_db';   // ชื่อ IndexedDB
const AUTOSAVE_DB_STORE = 'autosave';          // ชื่อ store
const AUTOSAVE_ID = 'current';                 // id ของระเบียนสำรองปัจจุบัน

// สถานะระบบ
let autosaveTimer = null;          // handle ของ setInterval
let autosaveDb = null;             // ตัวเชื่อม IndexedDB
let autosaveLastHash = null;       // ลายนิ้วมือของข้อมูลครั้งที่เชฟล่าสุด
let autosaveRunning = false;       // กันเชฟซ้อน (รอบก่อนหน้ายังไม่เสร็จ)
let autosaveStatusBox = null;      // กล่องแสดงสถานะในหน้าเว็บ
let autosaveLastSavedText = '';    // วันเวลาเชฟล่าสุด
let autosaveRestorePending = false; // กันเชฟทับระหว่างที่กำลังถามกู้คืนข้อมูลสำรอง
let autosaveLastCheckMs = 0;       // เวลาในเครื่อง (Date.now()) ที่ตรวจสอบ/เชฟรอบล่าสุด

// ===== 1) ตรวจว่ามีการแก้ไขอะไรไหมหรือไม่ =====
//   คืน "ลายนิ้วมือ" (hash) ของข้อมูลทั้งหมดที่จะบันทึก
//   ถ้า hash เดิม == hash ใหม่ → ไม่มีอะไรเปลี่ยน → ไม่ต้องเชฟ
function computeAutosaveHash(backup) {
  if (!backup) return '';
  try {
    // ไม่เอา field ที่เปลี่ยนทุกครั้ง (savedAt) มาคิด — ไม่งั้นจะเข้าใจว่าเปลี่ยนเสมอ
    const core = {
      projectPlanData: backup.projectPlanData,
      channels: backup.channels,
      dimensionRows: backup.dimensionRows,
      levelRowsData: backup.levelRowsData,
      structureRowsData: backup.structureRowsData,
      attachmentRowsData: backup.attachmentRowsData,
      groundRowsData: backup.groundRowsData,
      ditchTypeDatabase: backup.ditchTypeDatabase,
      structureTypeDatabase: backup.structureTypeDatabase,
      imageData: backup.imageData ? {
        name: backup.imageData.name,
        fullWidth: backup.imageData.fullWidth,
        fullHeight: backup.imageData.fullHeight,
        dataUrl: backup.imageData.dataUrl,
        pdfFileDataUrl: backup.imageData.pdfFileDataUrl,
        currentPage: backup.imageData.currentPage,
        totalPages: backup.imageData.totalPages
      } : null,
      imageRotation: backup.imageRotation,
      cropFrames: backup.cropFrames,
      mediaState: backup.mediaState,
      groupState: backup.groupState,
      aiData: backup.aiData,
      canvasLabels: backup.canvasLabels,
      drawingData: backup.drawingData,
      mediaDrawingStateByTab: backup.mediaDrawingStateByTab
    };
    const str = JSON.stringify(core);
    // hash แบบเร็ว ๆ (FNV-1a 32 bit) — ไม่ต้องใช้ crypto (ทำงานได้ในทุกบริาว์เซอร์)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return str.length.toString(36) + '-' + h.toString(36);
  } catch (e) {
    console.warn('คำนวณ hash ของข้อมูลอัตโนมัติไม่สำเร็จ:', e);
    return '';
  }
}

// ===== 2) IndexedDB: เก็บสำรองในเบราว์เซอร์ =====
function openAutosaveDb() {
  return new Promise((resolve) => {
    if (autosaveDb) return resolve(autosaveDb);
    if (typeof indexedDB === 'undefined') {
      console.warn('เบราว์เซอร์นี้ไม่รองรับ IndexedDB — จะเชฟอัตโนมัติลงไฟล์จริงเท่านั้น');
      return resolve(null);
    }
    let req;
    try {
      req = indexedDB.open(AUTOSAVE_DB_NAME, 1);
    } catch (e) {
      console.warn('เปิด IndexedDB ไม่สำเร็จ:', e);
      return resolve(null);
    }
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_DB_STORE)) {
        db.createObjectStore(AUTOSAVE_DB_STORE);
      }
    };
    req.onsuccess = function () {
      autosaveDb = req.result;
      resolve(autosaveDb);
    };
    req.onerror = function () {
      console.warn('เปิด IndexedDB ไม่สำเร็จ:', req.error);
      resolve(null);
    };
  });
}

async function writeAutosaveToDb(payload) {
  const db = await openAutosaveDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUTOSAVE_DB_STORE, 'readwrite');
      tx.objectStore(AUTOSAVE_DB_STORE).put(payload, AUTOSAVE_ID);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { console.warn('เขียนสำรองลง IndexedDB ไม่สำเร็จ:', tx.error); resolve(false); };
      tx.onabort = () => resolve(false);
    } catch (e) {
      console.warn('เขียนสำรองลง IndexedDB ไม่สำเร็จ:', e);
      resolve(false);
    }
  });
}

async function readAutosaveFromDb() {
  const db = await openAutosaveDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUTOSAVE_DB_STORE, 'readonly');
      const req = tx.objectStore(AUTOSAVE_DB_STORE).get(AUTOSAVE_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function clearAutosaveFromDb() {
  const db = await openAutosaveDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(AUTOSAVE_DB_STORE, 'readwrite');
      tx.objectStore(AUTOSAVE_DB_STORE).delete(AUTOSAVE_ID);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

// ===== 3) แสดงสถานะระบบเชฟอัตโนมัติในหน้าเว็บ =====
//   รอบ 44: ย้ายกล่องสถานะไปอยู่ใน "แถบหัว" ด้านบน และย่อเหลือ 2 บรรทัด —
//     บรรทัดที่ 1: "⏱️ ระบบเชฟอัตโนมัติ  ทุกๆ 5 นาที"   (คำว่า "ทุกๆ 5 นาที" รวมกับหัวแล้ว)
//     บรรทัดที่ 2: "เชฟล่าสุด : <เวลา>"
function updateAutosaveStatusUI() {
  const box = document.getElementById('autosaveStatusBox');
  if (!box) return;
  if (typeof box.setAttribute === 'function') {
    box.setAttribute('title', 'เชฟทุกๆ ' + Math.round(AUTOSAVE_INTERVAL_MS / 60000) + ' นาที');
  }
  box.title = 'เชฟทุกๆ ' + Math.round(AUTOSAVE_INTERVAL_MS / 60000) + ' นาที';

  // แสดงเฉพาะวันเวลาเชฟล่าสุด (ไม่แสดงตัวนับเวลาถอยหลัง)
  const lastEl = document.getElementById('autosaveLastTimeText');
  if (lastEl) lastEl.textContent = autosaveLastSavedText || '-';

  // รอบ 60: ซิงก์เวลาเชฟล่าสุดไปยังแถบหัวของแท็บ "ส่วนคำนวณปริมาณ" ด้วย
  const qtyBox = document.getElementById('qtyAutosaveStatusBox');
  if (qtyBox) {
    qtyBox.title = 'เชฟทุกๆ ' + Math.round(AUTOSAVE_INTERVAL_MS / 60000) + ' นาที';
  }
  const qtyLastEl = document.getElementById('qtyAutosaveLastTimeText');
  if (qtyLastEl) qtyLastEl.textContent = autosaveLastSavedText || '-';
}

// ===== รอบ 44: หน้าต่างเล็ก ๆ มุมบนขวา แจ้งเตือนตอนบันทึก =====
//   ใช้เมื่อเชฟอัตโนมัติสำเร็จ และเมื่อผู้ใช้กดปุ่ม "บันทึก" เอง
function showSaveToast(message, type) {
  const stack = document.getElementById('saveToastStack');
  if (!stack) {
    if (typeof uiToast === 'function') uiToast(message, type || 'success');
    return;
  }
  const text = (message === null || message === undefined) ? '' : String(message);
  let kind = type || 'success';
  if (kind === 'auto') {
    if (/ไม่สำเร็จ|ไม่สามารถ|ล้มเหลว|ข้อผิดพลาด/.test(text)) kind = 'error';
    else if (/เรียบร้อย|สำเร็จ/.test(text)) kind = 'success';
    else kind = 'info';
  }
  const box = document.createElement('div');
  box.className = 'save-toast save-toast-' + kind;
  box.textContent = text;
  box.title = 'คลิกเพื่อปิด';
  box.addEventListener('click', () => {
    box.classList.add('save-toast-hide');
    setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
  });
  stack.appendChild(box);
  setTimeout(() => {
    box.classList.add('save-toast-hide');
    setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
  }, kind === 'error' ? 6000 : 3000);
}

// ===== 4) ตัวจับเวลา: เชฟอัตโนมัติทุก 5 นาที =====
async function runAutosaveTick(force) {
  // กันเชฟซ้อน + กันเชฟระหว่าง AI กำลังอ่านอยู่ (ข้อมูลกำลังเปลี่ยน)
  if (autosaveRunning) return false;
  if (autosaveRestorePending && !force) {
    console.log('[autosave] ข้ามรอบนี้: กำลังรอผู้ใช้ยืนยันการกู้คืนข้อมูลสำรอง');
    return false;
  }
  if (typeof isAiReading !== 'undefined' && isAiReading && !force) {
    console.log('[autosave] ข้ามรอบนี้: AI กำลังอ่านข้อมูลอยู่');
    return false;
  }
  if (typeof buildProjectBackup !== 'function') return false;

  autosaveRunning = true;
  updateAutosaveStatusUI();
  try {
    const backup = await buildProjectBackup();
    if (!backup) return false;

    // ===== ตรวจว่ามีการแก้ไขอะไรไหมก่อนเชฟ =====
    const hash = computeAutosaveHash(backup);
    if (!force && autosaveLastHash !== null && hash === autosaveLastHash) {
      console.log('[autosave] ไม่มีการเปลี่ยนแปลง → ไม่เชฟ');
      updateAutosaveStatusUI();
      return false;
    }

    // ===== เชฟอัตโนมัติ (รอบ 37: เก็บสำรองในเบราว์เซอร์ทางเดียว) =====
    const payload = {
      savedAt: new Date().toISOString(),
      hash: hash,
      data: backup
    };
    if (!await writeAutosaveToDb(payload)) {
      updateAutosaveStatusUI();
      return false;
    }

    autosaveLastHash = hash;
    autosaveLastCheckMs = Date.now();
    autosaveLastSavedText = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    console.log('[autosave] เชฟอัตโนมัติสำเร็จเมื่อ', autosaveLastSavedText);
    updateAutosaveStatusUI();
    // รอบ 60: เชฟสำเร็จแล้ว → ล้างเครื่องหมาย "ยังมีการแก้ไขที่ไม่ได้เชฟ"
    if (typeof clearWorkspaceDirtyFlag === 'function') clearWorkspaceDirtyFlag();
    // รอบ 44: แสดงหน้าต่างเล็ก ๆ มุมบนขวาเมื่อบันทึกสำเร็จ
    if (typeof showSaveToast === 'function') {
      showSaveToast('บันทึกอัตโนมัติเรียบร้อยแล้ว (' + autosaveLastSavedText + ')', 'success');
    }
    return true;
  } catch (e) {
    console.warn('เชฟอัตโนมัติล้มเหลว:', e);
    return false;
  } finally {
    autosaveRunning = false;
    updateAutosaveStatusUI();
  }
}

// เริ่มระบบเชฟอัตโนมัติ (ใช้เวลาในเครื่อง Date.now() ตรวจสอบเมื่อครบทุกๆ 10 นาที โดยไม่แสดงเวลานับถอยหลัง)
function initAutosave() {
  if (autosaveTimer) return;
  autosaveLastCheckMs = Date.now();
  autosaveTimer = setInterval(() => {
    const now = Date.now();
    if (now - autosaveLastCheckMs >= AUTOSAVE_INTERVAL_MS) {
      autosaveLastCheckMs = now;
      runAutosaveTick(false);
    }
  }, 15 * 1000);
  updateAutosaveStatusUI();
  console.log('[autosave] เริ่มระบบเชฟอัตโนมัติทุก', Math.round(AUTOSAVE_INTERVAL_MS / 60000), 'นาที (ตรวจสอบจากเวลาเครื่อง)');
}

// ล้างสำรองในเบราว์เซอร์ (เก็บไว้เป็นคำสั่งภายใน ไม่มีปุ่มบนหน้าเว็บ)
async function clearAutosaveBackup() {
  await clearAutosaveFromDb();
  autosaveLastHash = null;
  autosaveLastSavedText = '';
  updateAutosaveStatusUI();
  uiToast('ล้างข้อมูลสำรองเรียบร้อยแล้ว', 'success');
}

// ===== 5) กู้คืนสำรอง (ถามผู้ใช้ก่อน) =====
async function offerAutosaveRestore() {
  const payload = await readAutosaveFromDb();
  if (!payload || !payload.data) return false;
  autosaveRestorePending = true;
  try {

  const savedAtText = payload.savedAt
    ? new Date(payload.savedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : 'ไม่ทราบเวลา';

  const projName = (payload.data.projectPlanData && payload.data.projectPlanData.name) || 'ไม่ระบุชื่อ';
  const msg =
    `พบข้อมูลสำรองจากการเชฟอัตโนมัติ\n\n` +
    `โครงการ: ${projName}\n` +
    `บันทึกเมื่อ: ${savedAtText}\n\n` +
    `ต้องการกู้คืนข้อมูลนี้กลับมาหรือไม่?`;

  if (typeof uiConfirm !== 'function') {
    // ไม่มีกล่องยืนยันในหน้าเว็บ → ถามด้วย alert ธรรมดา
    const ok = window.confirm(msg + '\n\nกด "ตกลง" = กู้คืน / กด "ยกเลิก" = ไม่กู้คืน');
    if (!ok) {
      if (autosaveLastHash === null && typeof buildProjectBackup === 'function') {
        try { const b = await buildProjectBackup(); if (b) autosaveLastHash = computeAutosaveHash(b); } catch (_) {}
      }
      return false;
    }
  } else {
    const ok = await new Promise((resolve) => {
      uiConfirm(msg, () => resolve(true), {
        okText: 'กู้คืนข้อมูล',
        cancelText: 'ไม่กู้คืน',
        onCancel: () => resolve(false)
      });
    });
    if (!ok) {
      if (autosaveLastHash === null && typeof buildProjectBackup === 'function') {
        try { const b = await buildProjectBackup(); if (b) autosaveLastHash = computeAutosaveHash(b); } catch (_) {}
      }
      return false;
    }
  }

  // รอบ 36: อ่านสำรองใหม่ตอนผู้ใช้กดยืนยัน (ไม่ใช้ payload ที่อ่านไว้ตอนเปิดหน้าเว็บ)
  //   เพราะระหว่างที่ผู้ใช้กำลังตัดสินใจ อาจมีการเชฟอัตโนมัติรอบใหม่เขียนทับข้อมูล
  //   → ถ้าใช้ค่าเก่า จะกู้คืนข้อมูลผิดรุ่น
  const latest = await readAutosaveFromDb();
  const restorePayload = (latest && latest.data) ? latest : payload;

  try {
    const success = await loadProjectDataObject(restorePayload.data);
    if (success) {
      autosaveLastHash = restorePayload.hash || null;
      autosaveLastSavedText = savedAtText;
      updateAutosaveStatusUI();
      uiToast('กู้คืนข้อมูลสำรองเรียบร้อยแล้ว', 'success');
    }
    return success;
  } catch (e) {
    console.warn('กู้คืนข้อมูลสำรองไม่สำเร็จ:', e);
    uiToast('กู้คืนข้อมูลสำรองไม่สำเร็จ', 'error');
    return false;
  }
  } finally {
    autosaveRestorePending = false;
  }
}

// เรียกตอนหน้าเว็บโหลดเสร็จ: เริ่มตัวจับเวลา + ถามกู้คืนสำรอง
async function startAutosaveSystem() {
  if (autosaveLastHash === null && typeof buildProjectBackup === 'function') {
    try {
      const initBackup = await buildProjectBackup();
      if (initBackup) autosaveLastHash = computeAutosaveHash(initBackup);
    } catch (_) {}
  }
  initAutosave();
  updateAutosaveStatusUI();
  // รอบ 60 (ข้อเสนอแนะข้อ 2): เตือนผู้ใช้ก่อนปิดหน้าเว็บเมื่อยังมีการแก้ไขที่ยังไม่ได้เชฟ
  initUnsavedChangesWarning();
  try {
    await offerAutosaveRestore();
  } catch (e) {
    console.warn('ตรวจสอบข้อมูลสำรองไม่สำเร็จ:', e);
  }
}

// ===== รอบ 60 (ข้อเสนอแนะข้อ 2): เตือนเมื่อมีการแก้ไขที่ยังไม่ได้เชฟ =====
//   - ทำเครื่องหมาย "ยังมีการแก้ไข" เมื่อผู้ใช้แก้ข้อมูลในหน้างาน (รวมหน้างานดิน)
//   - ล้างเครื่องหมายเมื่อเชฟสำเร็จ (อัตโนมัติ/เชฟเอง)
//   - เมื่อพยายามปิดหน้าเว็บ → เบราว์เซอร์จะแสดงคำเตือน "Leave site?"
let workspaceDirtyState = false;

/** ทำเครื่องหมายว่ามีการแก้ไขที่ยังไม่ได้เชฟ */
function markWorkspaceDirty() {
  workspaceDirtyState = true;
  try {
    sessionStorage.setItem('ew_workspace_dirty', '1');
  } catch (_) {}
}

/** ล้างเครื่องหมาย (เรียกหลังเชฟสำเร็จ) */
function clearWorkspaceDirtyFlag() {
  workspaceDirtyState = false;
  try {
    sessionStorage.removeItem('ew_workspace_dirty');
  } catch (_) {}
}

function isWorkspaceDirty() {
  return workspaceDirtyState;
}

let unsavedWarningBound = false;
function initUnsavedChangesWarning() {
  if (unsavedWarningBound) return;
  unsavedWarningBound = true;

  // กู้สถานะจาก sessionStorage (กรณีรีโหลดหน้าในเซสชันเดิม)
  try {
    if (sessionStorage.getItem('ew_workspace_dirty') === '1') workspaceDirtyState = true;
  } catch (_) {}

  window.addEventListener('beforeunload', (e) => {
    if (!workspaceDirtyState) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  // เครื่องหมายว่ามีการแก้ไข: จับจากการกรอกข้อมูลในตาราง/ช่องกรอกทั่วไป
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (t.type === 'file') return;
      markWorkspaceDirty();
    }
  }, true);
}

