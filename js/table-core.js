// ===== js/table-core.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — ส่วนกลาง: ตัวจ่ายตาราง (updateTable) + ฟังก์ชันช่วยเหลือที่ใช้ร่วมทุกแท็บ + Excel navigation
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

// ความหนากำแพง/พื้นของ Type คูส่งน้ำ — ค่าเริ่มต้น 0.10 สำหรับข้อมูลเดิมที่ยังไม่มีฟิลด์นี้
function getDitchTypeThickness(item, field) {
  let num = parseFloat(item[field]);
  return isNaN(num) ? 0.10 : num;
}

function formatKmDisplay(val) {
  if (val === "" || val === null || val === undefined || isNaN(val)) return "";
  let num = parseFloat(val);
  if (isNaN(num)) return "";
  let sign = num < 0 ? "-" : "";
  num = Math.abs(num);
  let km = Math.floor(num / 1000);
  let m = num % 1000;
  let mStr = m.toFixed(0).padStart(3, '0');
  return `${sign}${km}+${mStr}`;
}

// กม. แสดงทศนิยม 2 ตำแหน่งเสมอ (สำหรับแท็บอาคารประกอบ เมื่อผู้ใช้กรอกค่าทศนิยม)
//   ตัวอย่าง: 1050.4 -> "1+050.40" · 1050 -> "1+050.00" · 0.5 -> "0+000.50" · -50.25 -> "-0+050.25"
function formatKmDisplayDecimal(val) {
  if (val === "" || val === null || val === undefined || isNaN(val)) return "";
  let num = parseFloat(val);
  if (isNaN(num)) return "";
  let sign = num < 0 ? "-" : "";
  num = Math.abs(num);
  let km = Math.floor(num / 1000);
  let m = num - km * 1000;
  return `${sign}${km}+${m.toFixed(2).padStart(6, '0')}`;
}

// ตรวจว่าค่า กม. มีทศนิยมหรือไม่ — ใช้เลือก formatKmDisplay (จำนวนเต็ม) vs formatKmDisplayDecimal (ทศนิยม 2 ตำแหน่ง)
function kmHasDecimal(val) {
  if (val === "" || val === null || val === undefined) return false;
  let num = parseFloat(val);
  if (isNaN(num)) return false;
  return Math.abs(num - Math.round(num)) >= 0.005;
}

// กม. สำหรับ "ส่งออก Excel" — ต่างจาก formatKmDisplay() ตรงที่ "ไม่ปัดทศนิยมของเมตรทิ้ง"
//   เดิม: 1+050.40 ถูกเขียนเป็น "1+050" แล้วนำเข้ากลับได้ 1050 (คลาดเคลื่อนถึง ±0.5 ม. ทุกครั้งที่ไป-กลับ)
//   ตอนนี้: เก็บทศนิยม 2 ตำแหน่งเฉพาะเมื่อ "ไม่ลงตัว" (parseKmInput ยังอ่านได้ทั้ง "1+050" และ "1+050.40")
function formatKmForExport(val) {
  if (val === "" || val === null || val === undefined || isNaN(val)) return "";
  let num = parseFloat(val);
  if (isNaN(num)) return "";
  let sign = num < 0 ? "-" : "";
  num = Math.abs(num);
  let km = Math.floor(num / 1000);
  let m = num % 1000;
  let mStr = (Math.abs(m - Math.round(m)) < 0.005)
    ? m.toFixed(0).padStart(3, '0')
    : m.toFixed(2).padStart(6, '0');
  return `${sign}${km}+${mStr}`;
}

function parseKmInput(inputVal) {
  if (inputVal === "" || inputVal === null || inputVal === undefined) return "";
  let str = String(inputVal).trim();
  if (str === "") return "";
  
  if (str.includes('+')) {
    let parts = str.split('+');
    let km = parseFloat(parts[0]) || 0;
    let m = parseFloat(parts[1]) || 0;
    let sign = str.startsWith('-') ? -1 : 1;
    return sign * (Math.abs(km) * 1000 + m);
  }
  let num = parseFloat(str);
  return isNaN(num) ? "" : num;
}

// ===== หา "กม.สิ้นสุด" ของคูส่งน้ำ = ค่ามากที่สุดของ กม.สิ้นสุด จากทุกช่วงมิติของคูนั้น =====
// R3: คูหนึ่งมีได้หลาย "ช่วงมิติ" (dimensionRows หลายแถวต่อ 1 คู)
//     เดิมใช้ dimensionRows.find(...) → หยิบแถวแรก → ใช้ กม.สิ้นสุดของช่วงแรกไปเป็นปลายคู
//     ทำให้ ดินเดิม / แถวปลายคู (อาคารประกอบ) / เส้นระดับ ตัดผิดที่เมื่อคูมีหลายช่วง
// คืนค่า "" เมื่อยังไม่มีช่วงไหนกรอก กม.สิ้นสุด มิฉะนั้นคืนค่า กม.สิ้นสุดของช่วงที่ยาวที่สุด
function getChannelKmEnd(channelId) {
  let maxNum = -Infinity;
  let endVal = "";
  dimensionRows.forEach(r => {
    if (r.channelId !== channelId) return;
    let v = (r.kmEnd !== undefined && r.kmEnd !== "") ? parseFloat(r.kmEnd) : NaN;
    if (!isNaN(v) && v > maxNum) {
      maxNum = v;
      endVal = r.kmEnd;
    }
  });
  return endVal;
}

// แท็บย่อยของแท็บ "setting" (Typeคูส่งน้ำ / Typeอาคารประกอบ)
const settingsSubTabs = ['setting-type', 'setting-structure'];

// ===== ยืนยันก่อนลบข้อมูลออกจากตาราง =====
// ทุกปุ่ม "−" ต้องถามก่อน เพราะลบแล้วกู้คืนไม่ได้ (ยังไม่มี undo) — "ลบคู" = ลบข้อมูล 5 แท็บของคูนั้นพร้อมกัน
// ถ้าหน้านี้ไม่มีกล่องยืนยัน (เช่นตอนรันเทสต์) ให้ทำงานต่อทันที เพื่อไม่ให้ปุ่มตาย
function confirmDelete(message, doIt, okText) {
  if (typeof uiConfirm === 'function') {
    uiConfirm(message, doIt, { danger: true, okText: okText || 'ลบ' });
  } else {
    doIt();
  }
}

function switchSettingsSubTab(subName) {
  if (!settingsSubTabs.includes(subName)) return;
  if (bottomTableCollapsed) toggleBottomTableCollapse(null, false);
  currentTab = subName;
  settingsSubTab = (subName === 'setting-structure') ? 'structure' : 'type';
  if (typeof structureCalcActiveTab !== 'undefined') structureCalcActiveTab = subName;
  const btnType = document.getElementById('struct-calc-tab-type');
  const btnStruct = document.getElementById('struct-calc-tab-structure');
  if (btnType) btnType.classList.toggle('active', subName === 'setting-type');
  if (btnStruct) btnStruct.classList.toggle('active', subName === 'setting-structure');
  const titleEl = document.getElementById('structureCalcActiveTabTitle');
  if (titleEl) {
    titleEl.textContent = (subName === 'setting-structure') ? '🏗️ Typeอาคารประกอบ' : '🧱 Typeคูส่งน้ำ';
  }
  syncSettingsSubTabUI();
  updateTable();
}

// รายชื่อ id ของแท็บหลักทั้งหมด (รอบ 46: เพิ่ม 'project' ไว้หน้าสุด)
const mainTabIds = ['project', 'ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'ai-result', 'setting'];

// สถานะย่อ/ขยายส่วนตารางด้านล่าง (ข้อ 5) และส่วนแสดงรูปภาพด้านบน (รอบ 47 ข้อ 3)
let bottomTableCollapsed = false;
let savedBottomTableHeight = '';
let viewportCollapsed = false;
let savedBottomTableHeightForViewport = '';

function toggleViewportCollapse(ev, forceCollapsed) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const vpOuter = document.querySelector('.viewport-outer-container');
  const panel = document.getElementById('bottomTablePanel');
  const btn = document.getElementById('btnToggleViewportCollapse');
  const nextState = (typeof forceCollapsed === 'boolean') ? forceCollapsed : !viewportCollapsed;

  if (nextState && bottomTableCollapsed) {
    toggleBottomTableCollapse(null, false);
  }
  viewportCollapsed = nextState;
  if (vpOuter) {
    vpOuter.classList.toggle('collapsed', viewportCollapsed);
    vpOuter.style.display = viewportCollapsed ? 'none' : 'flex';
  }
  if (panel) {
    if (viewportCollapsed) {
      savedBottomTableHeightForViewport = panel.style.height || '';
      panel.classList.add('expanded-full');
      panel.style.flex = '1 1 auto';
      panel.style.height = 'auto';
      panel.style.maxHeight = 'none';
    } else {
      panel.classList.remove('expanded-full');
      panel.style.flex = '';
      panel.style.maxHeight = '';
      panel.style.height = savedBottomTableHeightForViewport || '';
    }
  }
  if (btn) {
    btn.textContent = viewportCollapsed ? '▼ ขยายส่วนแสดงรูปภาพ' : '▲ ย่อส่วนแสดงรูปภาพ';
    btn.title = viewportCollapsed ? 'ขยายส่วนแสดงรูปภาพกลับมา' : 'ย่อส่วนแสดงรูปภาพให้เหลือแถบเล็กๆ';
  }
  if (!viewportCollapsed) {
    if (typeof fitImageToViewportWithPadding === 'function') {
      try { fitImageToViewportWithPadding(); } catch (_) {}
    }
    if (typeof redraw === 'function') {
      try { redraw(); } catch (_) {}
    }
  }
}

function toggleBottomTableCollapse(ev, forceCollapsed) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const panel = document.getElementById('bottomTablePanel');
  const tabsArea = document.getElementById('bottomTabsArea') || document.querySelector('.tabs-area');
  const btn = document.getElementById('btnToggleBottomTable');
  const nextState = (typeof forceCollapsed === 'boolean') ? forceCollapsed : !bottomTableCollapsed;
  if (nextState && viewportCollapsed) {
    toggleViewportCollapse(null, false);
  }
  bottomTableCollapsed = nextState;
  if (panel) {
    if (bottomTableCollapsed) {
      savedBottomTableHeight = panel.style.height || '';
      panel.classList.add('collapsed');
      panel.style.display = 'none';
    } else {
      panel.classList.remove('collapsed');
      panel.style.display = 'flex';
      if (savedBottomTableHeight) panel.style.height = savedBottomTableHeight;
    }
  }
  if (tabsArea) tabsArea.classList.toggle('collapsed', bottomTableCollapsed);
  if (btn) {
    btn.textContent = bottomTableCollapsed ? '▲ ขยายตาราง' : '▼ ย่อตาราง';
    btn.title = bottomTableCollapsed ? 'ขยายส่วนตารางด้านล่างกลับมา' : 'ย่อส่วนตารางด้านล่างให้เหลือแถบเล็กๆ';
  }
  if (typeof fitImageToViewportWithPadding === 'function') {
    try { fitImageToViewportWithPadding(); } catch (_) {}
  }
  if (typeof redraw === 'function') {
    try { redraw(); } catch (_) {}
  }
}

function syncSettingsSubTabUI() {
  const isSetting = settingsSubTabs.includes(currentTab);
  const bar = document.getElementById('settingsSubTabsBar');
  if (bar) bar.classList.toggle('show', isSetting);

  // ⚠️ ต้องเคลียร์ active ของแท็บหลัก "ทุกปุ่ม" ก่อน แล้วค่อยเปิดปุ่มที่ตรงกับ currentTab
  //    ไม่งั้นเวลากด setting (ซึ่งไม่ได้ผ่าน switchTableTab) แท็บเดิมจะค้างสีน้ำเงินไว้
  const activeId = isSetting ? 'setting' : currentTab;
  mainTabIds.forEach(id => {
    const btn = document.getElementById(`tab-btn-${id}`);
    if (btn) btn.classList.toggle('active', id === activeId);
  });

  const mainChip = document.getElementById('tab-btn-setting');
  if (mainChip) mainChip.classList.toggle('with-subtabs', isSetting);

  settingsSubTabs.forEach(name => {
    const chip = document.getElementById(`subtab-btn-${name}`);
    if (chip) chip.classList.toggle('active', currentTab === name);
  });
}

function switchTableTab(tabName) {
  syncTableInputsToChannels();
  if (bottomTableCollapsed) toggleBottomTableCollapse(null, false);
  currentTab = tabName;

  // ให้ syncSettingsSubTabUI() เป็นตัวจัดการ active ของแท็บหลักทั้งหมด (ที่เดียว)
  syncSettingsSubTabUI();

  if (['dimension', 'level', 'ground', 'structure', 'attachment'].includes(tabName)) {
    syncDimensionRowsWithChannels();
  }
  updateTable();
}

function createDefaultRow(customX = "", customY = "") {
  return {
    data: { x: customX, y: customY }
  };
}

function syncTableInputsToChannels() {
  if (currentTab === 'project') {
    const inputs = document.querySelectorAll('#projectTableBody input.table-input');
    inputs.forEach(input => {
      const field = input.getAttribute('data-field');
      if (field && typeof projectPlanData !== 'undefined' && projectPlanData) {
        projectPlanData[field] = input.value;
      }
    });
    if (typeof updateTopHeaderBanner === 'function') updateTopHeaderBanner();
  } else if (currentTab === 'ditch') {
    const inputs = document.querySelectorAll('#dataTable input.table-input');
    inputs.forEach(input => {
      let chIdx = parseInt(input.getAttribute('data-ch'));
      let c = parseInt(input.getAttribute('data-col'));
      if (isNaN(chIdx) || !channels[chIdx]) return;
      let ch = channels[chIdx];
      let val = input.value;
      if (c === 0) ch.canal = val;
      if (c === 1) ch.ditch = val;
      if (c === 2) ch.totalArea = val;
      if (c === 3) ch.waterArea = val;
    });
  } else if (currentTab === 'dimension') {
    const inputs = document.querySelectorAll('#dimensionTableBody input.table-input:not([readonly]), #dimensionTableBody input.combobox-input:not([readonly]), #dimensionTableBody select.table-select:not([disabled])');
    inputs.forEach(input => {
      let rIdx = parseInt(input.getAttribute('data-row'));
      let field = input.getAttribute('data-field');
      if (isNaN(rIdx) || !dimensionRows[rIdx] || !field) return;
      
      let val = input.value;
      if (field === 'kmStart' || field === 'kmEnd') {
        dimensionRows[rIdx][field] = parseKmInput(val);
      } else if (['q', 'slope', 'b', 'd', 'tbl', 'tbr'].includes(field)) {
        let num = parseFloat(val);
        dimensionRows[rIdx][field] = isNaN(num) ? "" : num;
      } else {
        dimensionRows[rIdx][field] = val;
        if (field === 'type' && typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) {
          let firstLvl = levelRowsData.find(l => l && l.channelId === dimensionRows[rIdx].channelId && !l.isDynamicRow);
          if (firstLvl) firstLvl.customType = val;
        }
      }
    });
    enforceLevelLastKmEnd();
    syncGroundRowsWithDimensions();
    syncStructureRowsWithLevel();
  } else if (currentTab === 'level') {
    const inputs = document.querySelectorAll('#levelTableBody input.table-input:not([readonly]), #levelTableBody select.table-select:not([disabled])');
    inputs.forEach(input => {
      let rIdx = parseInt(input.getAttribute('data-row'));
      let field = input.getAttribute('data-field');
      if (isNaN(rIdx) || !levelRowsData[rIdx] || !field) return;

      let val = input.value;
      if (field === 'customKmStart' || field === 'customKmEnd') {
        levelRowsData[rIdx][field] = parseKmInput(val);
      } else if (field === 'h') {
        let num = parseFloat(val);
        levelRowsData[rIdx].h = isNaN(num) ? 0.00 : num;
      } else {
        levelRowsData[rIdx][field] = val;
      }
    });
    syncStructureRowsWithLevel();
  } else if (currentTab === 'ground') {
    const calibInputs = document.querySelectorAll('#groundTableBody input[data-calib-ch]:not([readonly])');
    calibInputs.forEach(input => {
      let cIdx = parseInt(input.getAttribute('data-calib-ch'), 10);
      let cField = input.getAttribute('data-calib-field');
      if (!isNaN(cIdx) && cField && typeof updateChannelCalibCoord === 'function') {
        updateChannelCalibCoord(cIdx, cField, input.value);
      }
    });
    const inputs = document.querySelectorAll('#groundTableBody input.table-input:not([readonly])');
    inputs.forEach(input => {
      let gIdx = parseInt(input.getAttribute('data-row'));
      let field = input.getAttribute('data-field');
      if (isNaN(gIdx) || !groundRowsData[gIdx] || !field) return;
      updateGroundField(gIdx, field, input.value);
    });
  } else if (currentTab === 'structure') {
    const inputs = document.querySelectorAll('#structureTableBody input.table-input:not([readonly]), #structureTableBody input.combobox-input:not([readonly]), #structureTableBody select.table-select:not([disabled])');
    inputs.forEach(input => {
      let sIdx = parseInt(input.getAttribute('data-row'));
      let field = input.getAttribute('data-field');
      if (isNaN(sIdx) || !structureRowsData[sIdx] || !field) return;
      if (field === 'km') {
        structureRowsData[sIdx].km = parseKmInput(input.value);
      } else if (field === 'hOverride') {
        // ช่องที่แสดง "-" แทนค่า 0 (แสดงผลอย่างเดียว) ห้ามเขียนทับค่าจริง
        if (String(input.value).trim() === "-") return;
        // ค่าที่ "ดึงมาจากแท็ประดับคูส่งน้ำ" (ไม่ใช่ค่าที่ผู้ใช้กรอก) -> ห้ามเขียนกลับเป็นค่าผู้ใช้
        if (input.hasAttribute && input.hasAttribute('data-h-from-level')) return;
        let num = parseFloat(input.value);
        structureRowsData[sIdx].hOverride = isNaN(num) ? "0.00" : Number(num).toFixed(2);
      } else if (field === 'pipeDia' || field === 'pipeCount') {
        // ช่องที่แสดง "-" แทนค่า 0 (แสดงผลอย่างเดียว) ห้ามเขียน "-" ทับค่าจริง
        if (String(input.value).trim() === "-") return;
        structureRowsData[sIdx][field] = input.value;
      } else {
        structureRowsData[sIdx][field] = input.value;
      }
    });
  } else if (currentTab === 'attachment') {
    const inputs = document.querySelectorAll('#attachmentTableBody input.table-input:not([readonly]):not(.locked), #attachmentTableBody input.combobox-input:not([readonly]):not(.locked), #attachmentTableBody select.table-select:not([disabled])');
    inputs.forEach(input => {
      let aIdx = parseInt(input.getAttribute('data-row'));
      let field = input.getAttribute('data-field');
      if (isNaN(aIdx) || !attachmentRowsData[aIdx] || !field) return;
      if (field === 'count') {
        attachmentRowsData[aIdx].count = input.value;
      } else if (['h', 'pipeDia', 'length'].includes(field)) {
        let num = parseFloat(input.value);
        attachmentRowsData[aIdx][field] = isNaN(num) ? "" : Number(num).toFixed(2);
      } else {
        attachmentRowsData[aIdx][field] = input.value;
      }
    });
  }
}

// ปุ่ม "ย่อ/ขยาย" แทนปุ่ม "ล็อก/แก้ไข" เดิม (รอบ 31)
// - isLocked = true (เริ่มต้น) = collapsed = แสดงแถวเดียว → ปุ่ม "แก้ไข" (หมายถึงให้แก้/ขยาย)
// - isLocked = false = expanded = แสดงทั้งหมด → ปุ่ม "ล็อก" (หมายถึงให้ย่อ)
function renderLockButtonHtml(isLocked, onclickFn) {
  if (isLocked) {
    return `<button class="btn-lock-toggle state-locked" onclick="${onclickFn}" title="คลิกเพื่อแสดงข้อมูลทั้งหมด" tabindex="-1">✔ แก้ไข</button>`;
  } else {
    return `<button class="btn-lock-toggle state-edit" onclick="${onclickFn}" title="คลิกเพื่อย่อเหลือแถวเดียว" tabindex="-1">🔒 ล็อก</button>`;
  }
}

// แถวแสดงค่า P1 P2 (คัดลอกจากแท็บระดับดินเดิม สถานะล็อก ไม่มีปุ่ม P1/P2 และไม่มีปุ่มอื่น)
//   รอบ 29: เปลี่ยนจาก "กล่องกรอกตัวเลข" เป็น "ข้อความสรุป" เช่น
//   "จุด P1 กม. 0+000 , ระดับ +250.00 / จุด P2 กม. 0+300 , ระดับ +254.00"
//   พร้อมข้อความ "(แก้ไขค่า จุด P1,P2 ได้ที่แท็ประดับดินเดิม)" เป็นสีแดง
//   extraHtml: ปุ่มเพิ่มเติมที่แสดงต่อท้ายในแถวเดียวกัน (เช่น ปุ่ม "วาดเส้นระดับ")
function renderReadonlyP1P2ToolbarRowHtml(cIdx, colSpan, sepClass, extraHtml) {
  let gKey = 'ground_ch_' + cIdx;
  let gGrp = (typeof groundGroupState !== 'undefined' && groundGroupState && groundGroupState[gKey]) ? groundGroupState[gKey] : {};

  // อ่านค่าจาก getChannelP1P2() ก่อน (มัน fallback ไปอ่านช่องใน toolbar ของแท็บระดับดินเดิม)
  // เพื่อให้ค่าที่แสดงตรงกับค่าที่ใช้วาดเส้นจริงเสมอ
  const gval = (key, dflt) => {
    let v = (typeof getChannelP1P2 === 'function') ? getChannelP1P2(gKey, key) : undefined;
    if (v === undefined || v === null || v === '') v = (gGrp[key] !== undefined) ? gGrp[key] : dflt;
    return v;
  };

  let p1Km = gval('p1Km', 0);
  let p1Elev = gval('p1Elev', 0);
  let p2Km = gval('p2Km', 100);
  let p2Elev = gval('p2Elev', 50);

  const fmtKm = (v) => {
    if (typeof formatKmDisplay === 'function') {
      let s = formatKmDisplay(v);
      return s !== "" ? s : "0+000";
    }
    return String(v);
  };
  const fmtElev = (v) => {
    let num = parseFloat(v);
    if (isNaN(num)) return "+0.00";
    return (num >= 0 ? "+" : "") + num.toFixed(2);
  };

  return `
    <tr class="ground-toolbar-row readonly-p1p2-row ${sepClass || ''}">
      <td colspan="${colSpan}" style="padding: 6px 10px; text-align: left; background: #fdfdfd; border-bottom: 2px solid #b8daff;">
        <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; flex-wrap: wrap;">
          <span class="calib-p1p2-summary">
            จุด P1 กม. <b>${escapeHtml(fmtKm(p1Km))}</b> , ระดับ <b>${escapeHtml(fmtElev(p1Elev))}</b>
            <span class="calib-p1p2-sep">/</span>
            จุด P2 กม. <b>${escapeHtml(fmtKm(p2Km))}</b> , ระดับ <b>${escapeHtml(fmtElev(p2Elev))}</b>
          </span>

          <span class="calib-p-hint-note red-note">(แก้ไขค่า จุด P1,P2 ได้ที่แท็ประดับดินเดิม)</span>
          ${extraHtml || ''}
        </div>
      </td>
    </tr>
  `;
}

// ตัวจ่ายงานไปยังฟังก์ชันวาดตารางของแต่ละแท็บ (แทน updateTable() เดิมที่เป็น if/else ยาว 779 บรรทัด)
function updateTable() {
  try {
    if (currentTab === 'project' && typeof renderProjectTab === 'function') renderProjectTab();
    else if (currentTab === 'ditch') renderDitchTab();
    else if (currentTab === 'dimension') renderDimensionTab();
    else if (currentTab === 'level') renderLevelTab();
    else if (currentTab === 'structure') renderStructureTab();
    else if (currentTab === 'attachment') renderAttachmentTab();
    else if (currentTab === 'ground') renderGroundTab();
    else if (currentTab === 'ai-result') renderAiResultTab(aiLastResults);
    else if (currentTab === 'setting-type') renderTypeTab();
    else if (currentTab === 'setting-structure') renderSettingsStructureTab();
    bindExcelNavigation();
    if (typeof updateTopHeaderBanner === "function") updateTopHeaderBanner();
    if (typeof updateSideControlStatus === "function") updateSideControlStatus();
    // รอบ 41: ไฮไลต์ช่องที่ผิด (ช่องสีแดงอ่อน) หลัง render ตารางใหม่
    if (typeof applyValidationHighlights === "function") {
      try { applyValidationHighlights(); } catch (e) { console.warn('applyValidationHighlights:', e); }
    }
    if (typeof activeMediaViewTab !== "undefined" && activeMediaViewTab === "draw" && typeof redraw === "function") {
      redraw();
    }
  } catch (err) {
    console.error("[updateTable error]", err);
  }
}

function bindExcelNavigation() {
  const container = document.getElementById('tableContainer');
  if (!container) return;

  // R4: เดิมผูก addEventListener('keydown') ให้ทุก input ทุกครั้งที่ render
  //     ตารางถูกสร้างใหม่ (innerHTML) บ่อยมาก → keydown ถูกผูกซ้ำ/ทับถม ยิ่งใช้ ยิ่งรวน
  //     เปลี่ยนเป็น "event delegation" ผูก keydown ครั้งเดียวบน container ที่อยู่คงที่
  //     แล้วอ่าน data-row/data-col จาก e.target (องค์ประกอบที่กดจริง)
  if (container.getAttribute('data-keynav') === '1') return;
  container.setAttribute('data-keynav', '1');

  const handleRowSelectForCrossSection = (e) => {
    if (typeof onTableRowInteractionForCrossSection === 'function') {
      onTableRowInteractionForCrossSection(e.target);
    }
  };
  container.addEventListener('focusin', handleRowSelectForCrossSection);
  container.addEventListener('click', handleRowSelectForCrossSection);
  container.addEventListener('input', handleRowSelectForCrossSection);

  container.addEventListener('keydown', (e) => {
    const input = e.target;
    if (!input || (input.tagName !== 'INPUT' && input.tagName !== 'SELECT')) return;
    if (input.readOnly || input.disabled) return;

    const r = parseInt(input.getAttribute('data-row'));
    const c = parseInt(input.getAttribute('data-col'));
    if (isNaN(r) || isNaN(c)) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      input.dispatchEvent(new Event('change'));
      const nextTarget = container.querySelector(`[data-row="${r + 1}"][data-col="${c}"]:not([readonly]):not([disabled])`);
      if (nextTarget) {
        nextTarget.focus();
        if (nextTarget.select) nextTarget.select();
      }
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number')) {
        if (e.key === 'ArrowLeft' && input.selectionStart > 0) return;
        if (e.key === 'ArrowRight' && input.selectionEnd < input.value.length) return;
      }

      let targetRow = r;
      let targetCol = c;

      if (e.key === 'ArrowUp') targetRow = r - 1;
      if (e.key === 'ArrowDown') targetRow = r + 1;
      if (e.key === 'ArrowLeft') targetCol = c - 1;
      if (e.key === 'ArrowRight') targetCol = c + 1;

      const nextTarget = container.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]:not([readonly]):not([disabled])`);
      if (nextTarget) {
        e.preventDefault();
        nextTarget.focus();
        if (nextTarget.select) nextTarget.select();
      }
    }
  });
}

// ===== หน้าเมนู "ประมาณการ" (เมนูหลักซ้าย — รอบ 46) =====
// เรียงตามลำดับที่ผู้ใช้กำหนด:
//   1. แสดงชื่อโครงการ ที่อยู่ และรายละเอียด
//   2. ปุ่มเมนูย่อยทั้งหมดเรียงกันแนวนอน
//   3. สร้างเป็นส่วนๆ ตามเมนู เพื่อแยกตรวจสอบขั้นตอน / มีปุ่มย่อขยาย
let estimateSectionCollapsed = {
  takeoff: false,
  quantity: false,
  'structure-calc': false,
  pricing: false,
  report: false
};

function toggleEstimateSectionCollapse(secKey) {
  if (!secKey) return;
  estimateSectionCollapsed[secKey] = !estimateSectionCollapsed[secKey];
  renderEstimateSummaryPage();
}

function openEstimateSubMenuFromSummary(subKey) {
  if (subKey === 'takeoff') {
    openTakeoffFromEstimate();
    return;
  }
  const subMenu = document.getElementById('subEstimateMenu');
  if (subMenu) subMenu.style.display = 'flex';
  const items = document.querySelectorAll('#subEstimateMenu .sub-nav-item');
  let targetEl = null;
  items.forEach(item => {
    const oc = item.getAttribute && item.getAttribute('onclick');
    if (oc && oc.indexOf("'" + subKey + "'") >= 0) targetEl = item;
  });
  if (typeof switchSubMenu === 'function' && targetEl) {
    switchSubMenu(subKey, targetEl);
  }
}

function renderEstimateSummaryPage() {
  const page = document.getElementById('estimateSummaryPage');
  if (!page) return;

  const p = (typeof projectPlanData !== 'undefined' && projectPlanData) ? projectPlanData : { name: '', location: '', description: '' };
  const chCount = (channels || []).filter(c => c).length;
  const dimCount = (dimensionRows || []).length;
  const lvlCount = (levelRowsData || []).length;
  const gndCount = (groundRowsData || []).length;
  const strCount = (structureRowsData || []).length;
  const attCount = (attachmentRowsData || []).length;
  const linesCount = (canalLevelDrawingLines || []).length
                   + (manualGroundLinePoints || []).length
                   + (tableGroundLinePoints || []).length;
  const hasImage = !!(typeof img !== 'undefined' && img && img.src && img.complete && img.naturalWidth > 0);
  const hasP1 = !!(refPixels && refPixels.p1);
  const hasP2 = !!(refPixels && refPixels.p2);
  const hasFile = !!currentFileName;

  const dimFilled = (dimensionRows || []).filter(r => r && r.kmStart !== "" && r.kmEnd !== "").length;
  const lvlFilled = (levelRowsData || []).filter(r => r && (r.isDynamicRow || r.customType || r.bl1 !== "")).length;
  const gndFilled = (groundRowsData || []).filter(r => r && r.groundElevation !== "" && r.groundElevation !== null && r.groundElevation !== undefined).length;

  const takeoffItems = [
    { ok: hasFile, label: "อัปโหลดแปลน (รูป/PDF)", detail: hasFile ? `ไฟล์: ${escapeHtml(currentFileName)}` : "ยังไม่ได้อัปโหลด" },
    { ok: hasImage, label: "โหลดภาพเข้า canvas", detail: hasImage ? "โหลดสำเร็จ" : "ยังไม่พร้อม" },
    { ok: hasP1 && hasP2, label: "ตั้งจุดอ้างอิง P1/P2 (กม. ↔ ระดับ)", detail: (hasP1 && hasP2) ? "ตั้งค่าแล้ว" : "ยังไม่ครบ" },
    { ok: chCount > 0, label: "กรอกระบบคูส่งน้ำ", detail: `${chCount} คู` },
    { ok: dimCount > 0, label: "กรอกมิติคูส่งน้ำ", detail: `${dimCount} ช่วง` },
    { ok: gndCount > 0, label: "กรอกระดับดินเดิม", detail: `${gndCount} แถว` },
    { ok: lvlCount > 0, label: "กรอกระดับคูส่งน้ำ", detail: `${lvlCount} แถว` },
    { ok: linesCount > 0, label: "วาดเส้น/จุดบน canvas", detail: `${linesCount} รายการ` }
  ];
  const quantityItems = [
    { ok: dimFilled > 0, label: "ข้อมูลช่วงกม. และมิติรูปตัด (B, D, TBL, TBR)", detail: `${dimFilled}/${dimCount} ช่วง` },
    { ok: gndFilled > 0, label: "ข้อมูลค่าระดับดินเดิม (NGL) สำหรับคำนวณงานดิน", detail: `${gndFilled}/${gndCount} แถว` },
    { ok: lvlFilled > 0, label: "ข้อมูลระดับท้องคลอง (BL) และหลังคลอง (TBL)", detail: `${lvlFilled}/${lvlCount} แถว` }
  ];
  const structureItems = [
    { ok: strCount > 0, label: "รายการอาคารประกอบในระบบคูส่งน้ำ", detail: `${strCount} แถว` },
    { ok: attCount > 0, label: "รายการอาคารท่อรับน้ำเข้าแปลงไร่นา", detail: `${attCount} แถว` }
  ];
  const pricingItems = [
    { ok: (ditchTypeDatabase || []).length > 0, label: "ฐานข้อมูลขนาดและมิติ Type คูส่งน้ำ", detail: `${(ditchTypeDatabase || []).length} รายการ` },
    { ok: (structureTypeDatabase || []).length > 0, label: "ฐานข้อมูล Type อาคารประกอบ", detail: `${(structureTypeDatabase || []).length} รายการ` }
  ];
  const reportItems = [
    { ok: !!(p.name && p.location), label: "ข้อมูลชื่อโครงการและสถานที่ดำเนินโครงการ", detail: p.name ? "ครบถ้วน" : "ยังไม่ครบ" },
    { ok: chCount > 0 && dimFilled > 0, label: "ความพร้อมของตารางข้อมูลสำหรับส่งออก Excel / พิมพ์รายงาน", detail: `${chCount} คู · ${dimFilled} ช่วงมิติ` }
  ];

  const allItems = takeoffItems.concat(quantityItems, structureItems, pricingItems, reportItems);
  const doneCount = allItems.filter(i => i.ok).length;
  const totalCount = allItems.length;
  const progressPct = Math.round((doneCount / Math.max(1, totalCount)) * 100);

  const renderSecCard = (secKey, icon, title, secItems, extraHtml) => {
    const isCol = !!estimateSectionCollapsed[secKey];
    const sDone = secItems.filter(i => i.ok).length;
    const sTotal = secItems.length;
    const sPct = Math.round((sDone / Math.max(1, sTotal)) * 100);
    return `
      <div class="estimate-section estimate-collapsible-section" data-section="${secKey}">
        <div class="estimate-sec-header">
          <div class="estimate-sec-header-left">
            <span class="estimate-sec-title">${icon} ${title}</span>
            <span class="estimate-sec-badge">${sDone}/${sTotal} ขั้นตอน (${sPct}%)</span>
          </div>
          <div class="estimate-sec-header-actions">
            <button type="button" class="btn-estimate-open-sub" onclick="openEstimateSubMenuFromSummary('${secKey}')">เปิดหน้านี้ ›</button>
            <button type="button" class="btn-estimate-collapse" onclick="toggleEstimateSectionCollapse('${secKey}')" title="${isCol ? 'ขยายส่วนนี้' : 'ย่อส่วนนี้'}">${isCol ? '➕ ขยาย' : '➖ ย่อ'}</button>
          </div>
        </div>
        <div class="estimate-sec-body" style="display: ${isCol ? 'none' : 'block'};">
          <ul class="estimate-checklist">
            ${secItems.map(i => `
              <li class="estimate-checklist-item ${i.ok ? 'is-done' : 'is-pending'}">
                <span class="estimate-check-icon">${i.ok ? '✅' : '⬜'}</span>
                <span class="estimate-check-label">${i.label}</span>
                <span class="estimate-check-detail">${i.detail}</span>
              </li>
            `).join('')}
          </ul>
          ${extraHtml || ''}
        </div>
      </div>
    `;
  };

  const takeoffStatsHtml = `
    <div class="estimate-progress-bar-outer" style="margin-top: 10px;">
      <div class="estimate-progress-bar-inner" style="width: ${progressPct}%; background-color: ${progressPct === 100 ? '#28a745' : (progressPct >= 50 ? '#007bff' : '#ffc107')};">
        ${progressPct}%
      </div>
    </div>
    <div class="estimate-stat-grid" style="margin-top: 10px;">
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${chCount}</div>
        <div class="estimate-stat-label">คูส่งน้ำ</div>
      </div>
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${dimFilled}/${dimCount}</div>
        <div class="estimate-stat-label">ช่วงมิติ (กรอก/ทั้งหมด)</div>
      </div>
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${lvlFilled}/${lvlCount}</div>
        <div class="estimate-stat-label">แถวระดับ (กรอก/ทั้งหมด)</div>
      </div>
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${gndFilled}/${gndCount}</div>
        <div class="estimate-stat-label">แถวดินเดิม (กรอก/ทั้งหมด)</div>
      </div>
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${strCount}</div>
        <div class="estimate-stat-label">อาคารประกอบ</div>
      </div>
      <div class="estimate-stat-card">
        <div class="estimate-stat-num">${attCount}</div>
        <div class="estimate-stat-label">อาคารท่อรับน้ำ</div>
      </div>
    </div>
  `;

  page.innerHTML = `
    <div class="estimate-summary-container">
      <!-- ====== ส่วนที่ 1: แสดงชื่อโครงการ ที่อยู่ และรายละเอียด ====== -->
      <div class="estimate-section estimate-project-banner">
        <h3 class="estimate-section-title">📋 ข้อมูลแผนงานโครงการ</h3>
        <div class="estimate-project-info-grid">
          <div class="estimate-proj-item">
            <span class="estimate-proj-label">ชื่อโครงการ:</span>
            <strong class="estimate-proj-value">${escapeHtml(p.name || 'ไม่ได้ระบุชื่อโครงการ')}</strong>
          </div>
          <div class="estimate-proj-item">
            <span class="estimate-proj-label">ที่อยู่ / สถานที่:</span>
            <span class="estimate-proj-value">📍 ${escapeHtml(p.location || 'ไม่ได้ระบุสถานที่')}</span>
          </div>
          <div class="estimate-proj-item estimate-proj-item-full">
            <span class="estimate-proj-label">รายละเอียด:</span>
            <span class="estimate-proj-value">${escapeHtml(p.description || '-')}</span>
          </div>
        </div>
      </div>

      <!-- ====== ส่วนที่ 2: ปุ่มเมนูย่อยทั้งหมดเรียงกันแนวนอน ====== -->
      <div class="estimate-section estimate-horiz-menu-section">
        <div class="estimate-horiz-submenus" id="estimateHorizSubmenus">
          <button type="button" class="estimate-horiz-btn" onclick="openEstimateSubMenuFromSummary('takeoff')">✏️ ส่วนถอดแบบ</button>
          <button type="button" class="estimate-horiz-btn" onclick="openEstimateSubMenuFromSummary('quantity')">📐 ส่วนคำนวณปริมาณ</button>
          <button type="button" class="estimate-horiz-btn" onclick="openEstimateSubMenuFromSummary('structure-calc')">🏛️ ส่วนอาคารประกอบ</button>
          <button type="button" class="estimate-horiz-btn" onclick="openEstimateSubMenuFromSummary('pricing')">🏷️ ส่วนราคาวัสดุ</button>
          <button type="button" class="estimate-horiz-btn" onclick="openEstimateSubMenuFromSummary('report')">🖨️ พิมพ์รายงาน</button>
        </div>
      </div>

      <!-- ====== ส่วนที่ 3: สร้างเป็นส่วนๆ ตามเมนูย่อย เพื่อแยกตรวจสอบขั้นตอน (พร้อมปุ่มย่อ/ขยาย) ====== -->
      ${renderSecCard('takeoff', '✏️', 'ส่วนที่ 1: ส่วนถอดแบบ', takeoffItems, takeoffStatsHtml)}
      ${renderSecCard('quantity', '📐', 'ส่วนที่ 2: ส่วนคำนวณปริมาณ', quantityItems, '')}
      ${renderSecCard('structure-calc', '🏛️', 'ส่วนที่ 3: ส่วนอาคารประกอบ', structureItems, '')}
      ${renderSecCard('pricing', '🏷️', 'ส่วนที่ 4: ส่วนราคาวัสดุ', pricingItems, '')}
      ${renderSecCard('report', '🖨️', 'ส่วนที่ 5: พิมพ์รายงาน', reportItems, '')}
    </div>
  `;
}

// เปิด "ส่วนถอดแบบ" จากหน้าสรุปประมาณการ (เรียก canvas + tab) — ใช้ในปุ่ม "เปิดส่วนถอดแบบ" ใน summary
function openTakeoffFromEstimate() {
  document.querySelectorAll('.sub-nav-item').forEach(i => i.classList.remove('active'));
  const takeoffSub = document.querySelector('.sub-nav-item:first-child');
  if (takeoffSub) takeoffSub.classList.add('active');

  const center = document.getElementById('centerContent');
  const blank = document.getElementById('blankPageView');
  if (center) {
    center.style.display = 'flex';
  }
  if (blank) blank.style.display = 'none';
  // ซ่อนหน้า summary, project page และ structureCalcPage (ถ้ามีค้าง)
  const summaryPage = document.getElementById('estimateSummaryPage');
  if (summaryPage) summaryPage.style.display = 'none';
  const projectPage = document.getElementById('projectPlanPage');
  if (projectPage) projectPage.style.display = 'none';
  const structCalcPage = document.getElementById('structureCalcPage');
  if (structCalcPage) structCalcPage.style.display = 'none';
  const qtyCalcPage = document.getElementById('quantityCalcPage');
  if (qtyCalcPage) qtyCalcPage.style.display = 'none';
  if (typeof currentTab !== 'undefined' && (currentTab === 'setting-type' || currentTab === 'setting-structure')) {
    switchTableTab('ditch');
  }
  const subMenu = document.getElementById('subEstimateMenu');
  if (subMenu) subMenu.style.display = 'flex';
  if (typeof updateTopHeaderBanner === "function") updateTopHeaderBanner("📊 ประมาณการ", "✏️ ส่วนถอดแบบ");
}

// กลับสู่ "ส่วนถอดแบบ" — เรียกจากเมนูย่อย "ส่วนถอดแบบ" ใน sidebar
function returnToTakeoff() {
  const center = document.getElementById('centerContent');
  const blank = document.getElementById('blankPageView');
  center.style.display = 'flex';
  blank.style.display = 'none';
  // ซ่อนหน้า summary, project page และ structureCalcPage (ถ้ามีค้าง)
  const summaryPage = document.getElementById('estimateSummaryPage');
  if (summaryPage) summaryPage.style.display = 'none';
  const projectPage = document.getElementById('projectPlanPage');
  if (projectPage) projectPage.style.display = 'none';
  const structCalcPage = document.getElementById('structureCalcPage');
  if (structCalcPage) structCalcPage.style.display = 'none';
  const qtyCalcPage = document.getElementById('quantityCalcPage');
  if (qtyCalcPage) qtyCalcPage.style.display = 'none';
  if (typeof currentTab !== 'undefined' && (currentTab === 'setting-type' || currentTab === 'setting-structure')) {
    switchTableTab('ditch');
  }

  document.querySelectorAll('.sub-nav-item').forEach(i => i.classList.remove('active'));
  const takeoffSub = document.querySelector('.sub-nav-item:first-child');
  if (takeoffSub) takeoffSub.classList.add('active');
  if (typeof updateTopHeaderBanner === "function") updateTopHeaderBanner("📊 ประมาณการ", "✏️ ส่วนถอดแบบ");
}

// ===== หน้า "แผนงานโครงการ" (เมนูหลักซ้าย) =====
// แสดงฟอร์มข้อมูลโครงการ (ชื่อ/ที่อยู่/รายละเอียด) — render ลงใน #projectPlanPage แบบเต็มหน้า
function renderProjectPlanPage() {
  const page = document.getElementById('projectPlanPage');
  if (!page) return;

  page.innerHTML = `
    <div class="estimate-summary-container">
      <div class="estimate-section">
        <h3 class="estimate-section-title">📋 ข้อมูลโครงการ</h3>
        <div class="project-plan-container">
          <div class="project-plan-row">
            <label for="projPlanName">ชื่อแผนงาน / โครงการ:</label>
            <input type="text" id="projPlanName" value="${escapeHtml(projectPlanData.name)}" placeholder="ระบุชื่อโครงการ" onchange="updateProjectPlanField('name', this.value)">
          </div>
          <div class="project-plan-row">
            <label for="projPlanLoc">ที่อยู่ / สถานที่ดำเนินโครงการ:</label>
            <input type="text" id="projPlanLoc" value="${escapeHtml(projectPlanData.location)}" placeholder="ระบุตำบล อำเภอ จังหวัด" onchange="updateProjectPlanField('location', this.value)">
          </div>
          <div class="project-plan-row">
            <label for="projPlanDesc">รายละเอียดโครงการ:</label>
            <textarea id="projPlanDesc" placeholder="ระบุวัตถุประสงค์และรายละเอียด..." onchange="updateProjectPlanField('description', this.value)">${escapeHtml(projectPlanData.description)}</textarea>
          </div>
        </div>
      </div>

      <div class="estimate-section estimate-action-row">
        <button class="btn-action" style="background-color: #007bff;" onclick="returnToTakeoff()">🛠 เปิดส่วนถอดแบบ</button>
        <button class="btn-action" style="background-color: #17a2b8;" onclick="saveProjectJSON()">💾 บันทึกไฟล์</button>
      </div>
    </div>
  `;
}
