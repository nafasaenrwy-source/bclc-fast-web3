// ===== js/ai-credit.js =====
// รอบ 42: ระบบเครดิต AI + คิวงานอ่านรูปที่ค้างไว้
//
// ข้อกำหนดจากเจ้าของงาน:
//   "ให้ตรวจสอบเครดิตด้วย เมื่อมีเครดิตเพิ่มมา ถามทำค้างให้ดำเนินการต่อ"
//
// การทำงาน:
//   1) เก็บยอดเครดิตที่ผู้ใช้กรอกเอง (เช่น ตามใบเสร็จของผู้ให้บริการ AI) ไว้ใน localStorage
//      พร้อมประวัติว่า "ตรวจสอบล่าสุดเมื่อไร" และ "เพิ่มเครดิตครั้งล่าสุดเท่าไร"
//   2) เก็บคิวงานอ่านรูปที่ "ยังไม่ได้อ่าน" / "อ่านไม่สำเร็จ" ไว้ → ตอนผู้ใช้เพิ่มเครดิต
//      ระบบจะถามว่า "ทำงานที่ค้างไว้ต่อไหม?"
//   3) หน้าต่าง "💳 เครดิต AI" แสดงยอดเครดิต · ประวัติ · งานที่ค้าง และปุ่มต่าง ๆ

// ---------- ค่าคงที่ ----------
const AI_CREDIT_STORAGE_KEY = 'bclc_ai_credit_v1';
const AI_CREDIT_QUEUE_KEY = 'bclc_ai_queue_v1';
const AI_CREDIT_LOW_THRESHOLD = 5;   // ต่ำกว่านี้ถือว่า "เครดิตน้อย"

// ---------- สถานะในหน้าเว็บ ----------
let aiCreditState = {
  balance: 0,          // ยอดเครดิตที่ผู้ใช้กรอก (หน่วยเดียวกับที่ผู้ใช้ใช้)
  unit: 'เครดิต',
  checkedAt: 0,        // timestamp ที่ตรวจสอบล่าสุด
  lastAddedAt: 0,      // timestamp ที่เพิ่มเครดิตครั้งล่าสุด
  lastAddedAmount: 0,  // จำนวนที่เพิ่มครั้งล่าสุด
  history: [],         // [{ at, amount, note }]
  provider: ''         // ชื่อผู้ให้บริการที่ผู้ใช้ระบุ
};

// คิวงานอ่านรูปที่ค้างไว้
//   [{ id, frameId, name, addedAt, status: 'pending'|'failed'|'done', error }]
let aiCreditQueue = [];

// ---------- จัดการ localStorage (กัน error เวลาเปิดแบบ file:// หรือโหมดส่วนตัว) ----------
function aiCreditSafeStorageGet(key) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage.getItem(key);
  } catch (_) { return null; }
}

function aiCreditSafeStorageSet(key, value) {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return false;
    localStorage.setItem(key, value);
    return true;
  } catch (_) { return false; }
}

// ---------- โหลด / บันทึกสถานะ ----------
function loadAiCreditState() {
  const raw = aiCreditSafeStorageGet(AI_CREDIT_STORAGE_KEY);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        aiCreditState.balance = (typeof obj.balance === 'number' && isFinite(obj.balance)) ? obj.balance : 0;
        aiCreditState.unit = obj.unit || 'เครดิต';
        aiCreditState.checkedAt = obj.checkedAt || 0;
        aiCreditState.lastAddedAt = obj.lastAddedAt || 0;
        aiCreditState.lastAddedAmount = obj.lastAddedAmount || 0;
        aiCreditState.history = Array.isArray(obj.history) ? obj.history : [];
        aiCreditState.provider = obj.provider || '';
      }
    } catch (_) { /* ข้อมูลเสีย → ใช้ค่าเริ่มต้น */ }
  }

  const rawQ = aiCreditSafeStorageGet(AI_CREDIT_QUEUE_KEY);
  if (rawQ) {
    try {
      const arr = JSON.parse(rawQ);
      if (Array.isArray(arr)) aiCreditQueue = arr;
    } catch (_) { aiCreditQueue = []; }
  }
  return aiCreditState;
}

function saveAiCreditState() {
  aiCreditSafeStorageSet(AI_CREDIT_STORAGE_KEY, JSON.stringify(aiCreditState));
  return true;
}

function saveAiCreditQueue() {
  aiCreditSafeStorageSet(AI_CREDIT_QUEUE_KEY, JSON.stringify(aiCreditQueue));
  return true;
}

// ---------- ตัวช่วยจัดการคิว ----------
function aiCreditQueueKey(frameId, name) {
  return String(frameId || name || 'frame');
}

// อัปเดตป้ายตัวเลขบนปุ่ม "เครดิต AI" (แถบข้าง) ให้ตรงกับจำนวนงานที่ค้าง
function updateAiCreditBadge() {
  const badge = document.getElementById('aiCreditBadge');
  if (!badge) return;
  const n = getAiCreditPendingCount();
  badge.textContent = String(n);
  badge.style.display = (n > 0) ? 'inline-block' : 'none';
  const btn = document.getElementById('btn-side-ai-credit');
  if (btn) btn.title = 'ตรวจสอบเครดิต AI และงานที่ค้างไว้' + (n > 0 ? ' (ค้าง ' + n + ' งาน)' : '');
}

function getAiCreditQueue() {
  if (!Array.isArray(aiCreditQueue)) aiCreditQueue = [];
  return aiCreditQueue;
}

function getAiCreditPendingCount() {
  return getAiCreditQueue().filter(q => q && (q.status === 'pending' || q.status === 'failed')).length;
}

// เพิ่มงานเข้าคิว (ใช้เมื่อสั่ง AI อ่านรูป แต่ยังไม่ได้ทำ หรือทำแล้วไม่สำเร็จ)
function addAiCreditQueueItem(frameId, name, status, errorMsg) {
  const list = getAiCreditQueue();
  const key = aiCreditQueueKey(frameId, name);
  const found = list.find(q => q && aiCreditQueueKey(q.frameId, q.name) === key);
  if (found) {
    found.status = status || 'pending';
    if (errorMsg !== undefined) found.error = errorMsg;
    found.updatedAt = Date.now();
  } else {
    list.push({
      id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      frameId: frameId || '',
      name: name || 'รูปภาพ',
      addedAt: Date.now(),
      updatedAt: Date.now(),
      status: status || 'pending',
      error: errorMsg || ''
    });
  }
  saveAiCreditQueue();
  renderAiCreditPanel();
  return list;
}

// อัปเดตสถานะของงานในคิว
function updateAiCreditQueueItem(frameId, name, status, errorMsg) {
  const list = getAiCreditQueue();
  const key = aiCreditQueueKey(frameId, name);
  const found = list.find(q => q && aiCreditQueueKey(q.frameId, q.name) === key);
  if (found) {
    found.status = status;
    found.updatedAt = Date.now();
    if (errorMsg !== undefined) found.error = errorMsg;
    saveAiCreditQueue();
    renderAiCreditPanel();
  }
  return found || null;
}

// ลบงานออกจากคิว (ทำเสร็จแล้ว)
function removeAiCreditQueueItem(frameId, name) {
  const key = aiCreditQueueKey(frameId, name);
  aiCreditQueue = getAiCreditQueue().filter(q => !(q && aiCreditQueueKey(q.frameId, q.name) === key));
  saveAiCreditQueue();
  renderAiCreditPanel();
}

// ---------- จัดการยอดเครดิต ----------
function setAiCreditBalance(amount, note) {
  const n = parseFloat(amount);
  if (isNaN(n) || n < 0) return false;
  const before = aiCreditState.balance;
  aiCreditState.balance = n;
  aiCreditState.checkedAt = Date.now();
  const delta = n - before;
  if (note && String(note).trim()) {
    aiCreditState.history.unshift({ at: Date.now(), amount: delta, note: String(note).trim() });
    if (aiCreditState.history.length > 40) aiCreditState.history = aiCreditState.history.slice(0, 40);
  }
  saveAiCreditState();
  renderAiCreditPanel();
  // รอบ 42: ถ้ายอดเครดิตเพิ่มขึ้นและมีงานค้าง → ถามว่าจะทำต่อไหม
  if (n > before) checkAiCreditForPendingWork();
  return true;
}

// เพิ่มเครดิต (ใช้เมื่อผู้ใช้เติมเครดิต)
function addAiCreditBalance(amount, note) {
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return false;
  aiCreditState.balance = (aiCreditState.balance || 0) + n;
  aiCreditState.lastAddedAt = Date.now();
  aiCreditState.lastAddedAmount = n;
  aiCreditState.checkedAt = Date.now();
  aiCreditState.history.unshift({ at: Date.now(), amount: n, note: String(note || 'เติมเครดิต').trim() });
  if (aiCreditState.history.length > 40) aiCreditState.history = aiCreditState.history.slice(0, 40);
  saveAiCreditState();
  renderAiCreditPanel();
  // รอบ 42: "เมื่อมีเครดิตเพิ่มมา → ถามทำงานที่ค้างต่อไหม"
  checkAiCreditForPendingWork();
  return true;
}

// ตรวจสอบเครดิตล่าสุด (ปรับเวลาที่ตรวจ + แจ้งผู้ใช้)
function refreshAiCreditBalance() {
  aiCreditState.checkedAt = Date.now();
  saveAiCreditState();
  renderAiCreditPanel();
  if (typeof uiToast === 'function') {
    uiToast('ตรวจสอบเครดิตแล้ว · ยอดปัจจุบัน ' + aiCreditState.balance + ' ' + aiCreditState.unit, 'success');
  }
  return aiCreditState.balance;
}

// ---------- รูปแบบเวลา ----------
function aiCreditFormatTime(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return String(ts); }
}

// ---------- หน้าต่างเครดิต ----------
function renderAiCreditPanel() {
  updateAiCreditBadge();
  const body = document.getElementById('aiCreditBody');
  if (!body) return;

  const bal = aiCreditState.balance;
  const isLow = bal < AI_CREDIT_LOW_THRESHOLD;
  const balClass = (bal <= 0) ? 'unknown' : (isLow ? 'low' : 'ok');
  const pending = getAiCreditPendingCount();
  const queue = getAiCreditQueue();

  let html = '';

  // การ์ดยอดเครดิต
  html += `
    <div class="ai-credit-balance-card">
      <div>
        <div class="ai-credit-balance-label">ยอดเครดิตคงเหลือ</div>
        <div class="ai-credit-balance-value ${balClass}">${bal} ${epEsc(aiCreditState.unit)}</div>
      </div>
      <div style="text-align:right;">
        <button type="button" class="ep-km-step-apply" onclick="openAiCreditAddDialog()" title="เพิ่มเครดิต">➕ เพิ่มเครดิต</button>
        <button type="button" class="ep-km-step-btn" onclick="setAiCreditBalanceFromPrompt()" title="ตั้งยอดเครดิต">✏️ ตั้งยอด</button>
      </div>
    </div>`;

  // ข้อมูลเพิ่มเติม
  html += `<div class="ai-credit-info-row"><span class="ai-credit-info-label">ผู้ให้บริการ AI</span><span class="ai-credit-info-value">${epEsc(aiCreditState.provider || '-')}</span></div>`;
  html += `<div class="ai-credit-info-row"><span class="ai-credit-info-label">ตรวจสอบล่าสุด</span><span class="ai-credit-info-value">${epEsc(aiCreditFormatTime(aiCreditState.checkedAt))}</span></div>`;
  html += `<div class="ai-credit-info-row"><span class="ai-credit-info-label">เพิ่มเครดิตล่าสุด</span><span class="ai-credit-info-value">${aiCreditState.lastAddedAt ? epEsc(aiCreditFormatTime(aiCreditState.lastAddedAt)) + ' (+' + aiCreditState.lastAddedAmount + ')' : '-'}</span></div>`;
  html += `<div class="ai-credit-info-row"><span class="ai-credit-info-label">งานที่ค้างรอ</span><span class="ai-credit-info-value">${pending} งาน</span></div>`;

  // ประวัติการเติมเครดิต
  html += `<div class="ai-credit-section-title">📜 ประวัติการเติมเครดิต</div>`;
  if (aiCreditState.history && aiCreditState.history.length) {
    html += `<div class="ai-credit-queue-list">`;
    aiCreditState.history.slice(0, 10).forEach(h => {
      html += `<div class="ai-credit-queue-item">
        <span class="ai-credit-queue-name">+${epEsc(h.amount)} ${epEsc(aiCreditState.unit)}</span>
        <span class="ai-credit-queue-status">${epEsc(aiCreditFormatTime(h.at))}${h.note ? ' · ' + epEsc(h.note) : ''}</span>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="ai-credit-note">ยังไม่มีประวัติการเติมเครดิต</div>`;
  }

  // งานที่ค้างไว้
  html += `<div class="ai-credit-section-title">📋 งานอ่านรูปที่ค้างไว้ (${queue.length})</div>`;
  if (queue.length) {
    html += `<div class="ai-credit-queue-list">`;
    queue.forEach((q, i) => {
      const st = q.status || 'pending';
      const cls = st === 'running' ? 'running' : (st === 'failed' ? 'failed' : '');
      const stText = st === 'running' ? 'กำลังอ่าน' : (st === 'failed' ? 'อ่านไม่สำเร็จ' : 'รออ่าน');
      html += `<div class="ai-credit-queue-item ${cls}">
        <span class="ai-credit-queue-name">${epEsc(q.name || 'รูปภาพ')}</span>
        <span class="ai-credit-queue-status">${epEsc(stText)} · ${epEsc(aiCreditFormatTime(q.addedAt))}</span>
        <button type="button" class="ai-credit-btn ai-credit-btn-run" onclick="runAiCreditQueueItem(${i})" title="อ่านรูปนี้ตอนนี้">อ่าน</button>
      </div>`;
    });
    html += `</div>`;
    html += `<button type="button" class="ai-credit-btn ai-credit-btn-run" style="margin-top:8px;" onclick="resumeAiCreditQueue()" title="อ่านรูปที่ค้างไว้ทั้งหมดตามลำดับ">▶ ทำงานที่ค้างทั้งหมด</button>`;
  } else {
    html += `<div class="ai-credit-note">ไม่มีงานค้างไว้ 🎉</div>`;
  }

  html += `<div class="ai-credit-note" style="margin-top:12px;">
    💡 ยอดเครดิตนี้เป็นยอดที่ <b>คุณกรอกเอง</b> ตามใบเสร็จของผู้ให้บริการ AI (แอปไม่ดึงจากผู้ให้บริการโดยตรง)<br>
    เมื่อมีเครดิตเพิ่มมาและมีงานค้างไว้ ระบบจะถามว่า “ทำงานที่ค้างให้ดำเนินการต่อไหม?”
  </div>`;

  body.innerHTML = html;
}

function openAiCreditPanel() {
  const overlay = document.getElementById('aiCreditOverlay');
  if (!overlay) return;
  renderAiCreditPanel();
  overlay.classList.add('show');
}

function closeAiCreditPanel() {
  const overlay = document.getElementById('aiCreditOverlay');
  if (overlay) overlay.classList.remove('show');
}

// ---------- ตั้ง / เพิ่มยอดเครดิต ----------
function setAiCreditBalanceFromPrompt() {
  const done = (value) => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0) {
      if (typeof uiToast === 'function') uiToast('กรุณากรอกยอดเครดิตเป็นตัวเลขที่ไม่ติดลบ', 'error');
      return;
    }
    setAiCreditBalance(n, 'ตั้งยอดเครดิต');
    if (typeof uiToast === 'function') uiToast('ตั้งยอดเครดิตเป็น ' + n + ' ' + aiCreditState.unit + ' แล้ว', 'success');
    // หมายเหตุ: setAiCreditBalance() เรียก checkAiCreditForPendingWork() ให้อัตโนมัติแล้วเมื่อยอดเพิ่มขึ้น
  };

  if (typeof uiPrompt === 'function') {
    uiPrompt('กรอกยอดเครดิตคงเหลือ (' + aiCreditState.unit + '):', String(aiCreditState.balance), {
      okText: 'บันทึก'
    }).then(v => { if (v !== null && v !== undefined) done(v); });
  } else {
    done(aiCreditState.balance);
  }
}

function openAiCreditAddDialog() {
  const done = (value) => {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0) {
      if (typeof uiToast === 'function') uiToast('กรุณากรอกจำนวนเครดิตที่เพิ่มเป็นตัวเลขที่มากกว่า 0', 'error');
      return;
    }
    addAiCreditBalance(n, 'เติมเครดิต');
    if (typeof uiToast === 'function') uiToast('เพิ่มเครดิต +' + n + ' ' + aiCreditState.unit + ' แล้ว', 'success');
    // หมายเหตุ: addAiCreditBalance() เรียก checkAiCreditForPendingWork() ให้อัตโนมัติแล้ว
  };

  if (typeof uiPrompt === 'function') {
    uiPrompt('เพิ่มเครดิตจำนวนเท่าไร (' + aiCreditState.unit + ')?', '10', {
      okText: 'เพิ่ม'
    }).then(v => { if (v !== null && v !== undefined) done(v); });
  } else {
    done(10);
  }
}

// ---------- ตรวจสอบว่ามีเครดิตเพิ่มมาและมีงานค้าง → ถามทำต่อ ----------
function checkAiCreditForPendingWork() {
  const pending = getAiCreditPendingCount();
  if (pending <= 0) return false;
  if ((aiCreditState.balance || 0) <= 0) return false;

  const msg = 'ตรวจพบว่ามีเครดิตเพิ่มมา (ยอด ' + aiCreditState.balance + ' ' + aiCreditState.unit + ')'
    + '\nและมีงานอ่านรูปที่ค้างไว้อยู่ ' + pending + ' งาน'
    + '\n\nต้องการทำงานที่ค้างให้ดำเนินการต่อไหม?';

  const doResume = () => { resumeAiCreditQueue(); };

  if (typeof uiConfirm === 'function') {
    uiConfirm(msg, doResume, { okText: '▶ ทำต่อ', cancelText: 'ไม่ตอนนี้' });
    return true;
  } else if (typeof confirm === 'function') {
    if (confirm(msg)) doResume();
    return true;
  }
  return false;
}

// ---------- ทำงานที่ค้างต่อ ----------
async function runAiCreditQueueItem(index) {
  const queue = getAiCreditQueue();
  const item = queue[index];
  if (!item) return;

  if (typeof isAiReading !== 'undefined' && isAiReading) {
    if (typeof uiToast === 'function') uiToast('AI กำลังทำงานอยู่ กรุณารอสักครู่', 'error');
    return;
  }

  // หากรูปยังอยู่ในรายการกรอบรูป → สั่งอ่านกรอบนั้น
  const frames = (typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames)) ? pdfCropFrames : [];
  const frameIdx = frames.findIndex(f => f && String(f.id) === String(item.frameId));

  updateAiCreditQueueItem(item.frameId, item.name, 'running', '');

  try {
    if (frameIdx >= 0) {
      if (typeof activeCropFrameIndex !== 'undefined') activeCropFrameIndex = frameIdx;
      if (typeof loadCropFrameIntoViewer === 'function') {
        try { await loadCropFrameIntoViewer(frameIdx); } catch (_) {}
      }
      let readOk = true;
      if (typeof aiReadCurrentFrame === 'function') {
        readOk = (await aiReadCurrentFrame()) !== false;
      }
      if (readOk) {
        updateAiCreditQueueItem(item.frameId, item.name, 'done', '');
        removeAiCreditQueueItem(item.frameId, item.name);
      }
    } else {
      // ไม่พบรูปในรายการแล้ว (เช่น เปลี่ยนโปรเจกต์) → เตือนผู้ใช้
      updateAiCreditQueueItem(item.frameId, item.name, 'failed', 'ไม่พบรูปนี้ในรายการกรอบรูป');
      if (typeof uiToast === 'function') {
        uiToast('ไม่พบรูป "' + (item.name || '') + '" ในรายการกรอบรูป — กรุณาอัปโหลดรูปหรือตีกรอบใน PDF ก่อน', 'error');
      }
    }
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    updateAiCreditQueueItem(item.frameId, item.name, 'failed', msg);
    if (typeof uiToast === 'function') uiToast('อ่านรูปไม่สำเร็จ: ' + msg, 'error');
  }
}

async function resumeAiCreditQueue() {
  const queue = getAiCreditQueue().filter(q => q && (q.status === 'pending' || q.status === 'failed'));
  if (!queue.length) {
    if (typeof uiToast === 'function') uiToast('ไม่มีงานค้างไว้', 'info');
    return false;
  }
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    // หา index ปัจจุบันของงานนี้ในคิว (อาจเปลี่ยนไปเมื่อรายการถูกลบ)
    const curIdx = getAiCreditQueue().findIndex(q => q && aiCreditQueueKey(q.frameId, q.name) === aiCreditQueueKey(item.frameId, item.name));
    if (curIdx < 0) continue;
    await runAiCreditQueueItem(curIdx);
  }
  return true;
}

// ---------- ปุ่มในแถบข้าง (แท็บรูปตัดตามยาว) ----------
function showAiCreditButton() {
  const btn = document.getElementById('btn-side-ai-credit');
  if (btn) btn.style.display = '';
}

function hideAiCreditButton() {
  const btn = document.getElementById('btn-side-ai-credit');
  if (btn) btn.style.display = 'none';
}
