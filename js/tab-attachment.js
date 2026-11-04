// ===== js/tab-attachment.js =====
// แท็บใหม่ "อาคารท่อรับน้ำเข้าแปลงไร่นา"
// กฎการล็อก/แก้ไขช่องต่าง ๆ เป็นไปตามรูปภาพที่แนบ:
//   ประเภทอาคาร (ลิสต์)   คอลัมน์ จำนวนอาคาร / ความยาว (ม.) / หมายเหตุ  -> แก้ไขได้เสมอ
//   คอลัมน์ H (ม.) / ศก. ท่อ (ม.) -> แก้ไขได้เฉพาะประเภทอาคารที่มีค่า y ในรูป
//   ช่องที่แก้ไขได้จะไฮไลต์สีเหลืองอ่อน (.table-input.editable)
// แถวแรกของคูส่งน้ำไม่สามารถลบ และประเภทอาคารถูกล็อกเป็น "อาคารท่อรับน้ำเข้าแปลงไร่นา"

function attachmentIsBaseRow(aIdx) {
  let row = attachmentRowsData[aIdx];
  if (!row) return false;
  let sameChan = attachmentRowsData.filter(a => a.channelId === row.channelId);
  return sameChan.length > 0 && sameChan[0] === row;
}

function addAttachmentRowAt(aIdx) {
  syncTableInputsToChannels();
  let cur = attachmentRowsData[aIdx];
  if (!cur) return;
  let newRow = {
    channelId: cur.channelId,
    km: "",
    name: getAttachmentTypeOptions()[0],
    h: "0.00",
    pipeDia: "",
    length: "1.00",
    count: "1",
    remark: "",
    ditchSection: cur.ditchSection
  };
  newRow.pipeDia = getAttachmentPipeDia(newRow);
  attachmentRowsData.splice(aIdx + 1, 0, newRow);
  updateTable();
}

function deleteAttachmentRowAt(aIdx) {
  confirmDelete('ต้องการลบแถวอาคารนี้ใช่หรือไม่?', function () { doDeleteAttachmentRowAt(aIdx); });
}

function doDeleteAttachmentRowAt(aIdx) {
  syncTableInputsToChannels();
  if (attachmentIsBaseRow(aIdx)) return;
  attachmentRowsData.splice(aIdx, 1);
  updateTable();
}

function updateAttachmentField(aIdx, field, val) {
  let row = attachmentRowsData[aIdx];
  if (!row) return;

  if (field === 'name') {
    // แถวแรกของแต่ละคูส่งน้ำถูกล็อกเป็นอาคารท่อรับน้ำเข้าแปลงไร่นาเสมอ
    row.name = attachmentIsBaseRow(aIdx) ? ATTACHMENT_BASE_NAME : val;
    // ศก. ท่อ ล็อกและเปลี่ยนค่าเริ่มต้นตามรายการอาคารที่เลือก
    row.pipeDia = getAttachmentPipeDia(row);
  } else if (['h', 'length'].includes(field)) {
    let num = parseFloat(val);
    row[field] = isNaN(num) ? "" : Number(num).toFixed(2);
  } else {
    row[field] = val;
  }

  let rule = getAttachmentRule(row.name);
  if (field === 'name') {
    refreshAttachmentTypeCell(aIdx, row);
  }
  if (field === 'name' || field === 'h' || field === 'length') {
    refreshAttachmentHCell(aIdx, row, rule);
    refreshAttachmentDiaCell(aIdx, row, rule);
    refreshAttachmentLengthCell(aIdx, row, rule);
  }
}

// ===== อัปเดตเฉพาะช่องที่ได้รับผลกระทบ (ไม่ render ตารางใหม่ทั้งอัน เพื่อไม่ให้โฟกัสหลุด) =====
function refreshAttachmentNumericCell(elId, editable, val, fallback) {
  let el = document.getElementById(elId);
  if (!el) return;
  if (editable) {
    el.classList.remove('locked');
    el.classList.add('editable');
    el.readOnly = false;
    el.removeAttribute('readonly');
    el.value = (val !== "" && val !== undefined) ? val : fallback;
  } else {
    el.classList.remove('editable');
    el.classList.add('locked');
    el.readOnly = true;
    el.setAttribute('readonly', 'readonly');
    el.value = (val !== "" && val !== undefined) ? val : "-";
  }
}

function refreshAttachmentHCell(aIdx, row, rule) {
  refreshAttachmentNumericCell(`attHInput_${aIdx}`, rule.h, row.h, "0.00");
}

function refreshAttachmentDiaCell(aIdx, row, rule) {
  refreshAttachmentNumericCell(`attDiaInput_${aIdx}`, false, getAttachmentPipeDia(row), "0.20");
}

function refreshAttachmentLengthCell(aIdx, row, rule) {
  refreshAttachmentNumericCell(`attLenInput_${aIdx}`, rule.len, row.length, "1.00");
}

// เปลี่ยนลิสต์ "รายการอาคาร" ของแถวนั้นให้ตรงกับรายการอาคารที่เลือก
function refreshAttachmentTypeCell(aIdx, row) {
  let holder = document.getElementById(`attTypeCell_${aIdx}`);
  if (!holder) return;
  let opts = getAttachmentTypeOptions();
  let isBase = attachmentIsBaseRow(aIdx);
  if (isBase) {
    holder.innerHTML = `<input type="text" class="table-input locked" data-row="${aIdx}" data-col="2" value="${escapeHtml(row.name || ATTACHMENT_BASE_NAME)}" readonly title="แถวแรกของคูส่งน้ำถูกล็อกเป็นอาคารท่อรับน้ำเข้าแปลงไร่นา">`;
  } else {
    let curVal = row.name || "";
    holder.innerHTML = `
      <div class="combobox-container">
        <input type="text" class="combobox-input" id="attNameInput_${aIdx}" data-row="${aIdx}" data-col="2" data-field="name" value="${escapeHtml(curVal)}" placeholder="เลือกอาคาร" onchange="updateAttachmentField(${aIdx}, 'name', this.value)">
        <span class="combobox-arrow">▼</span>
        <select class="combobox-select" tabindex="-1" onchange="updateAttachmentField(${aIdx}, 'name', this.value)">
          <option value="" disabled ${curVal === "" ? 'selected' : ''}></option>
          ${opts.map(opt => `<option value="${escapeHtml(opt)}" ${opt === curVal ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
        </select>
      </div>
    `;
  }
}

// ===== ตาราง =====
function renderAttachmentTab() {
  const container = document.getElementById('tableContainer');

  syncDimensionRowsWithChannels();
  let rowsHtml = '';
  let lastChannelIdx = -1;

  attachmentRowsData.forEach((row, aIdx) => {
    let cIdx = row.channelId;
    let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
    let groupKey = `attach_ch_${cIdx}`;

    let isFirstOfGroup = (cIdx !== lastChannelIdx);
    lastChannelIdx = cIdx;

    if (attachmentGroupState[groupKey] === undefined) {
      // รอบ 31: default = locked + collapsed
      attachmentGroupState[groupKey] = { collapsed: true, locked: true };
    }
    let isCollapsed = attachmentGroupState[groupKey].collapsed === true;
    // ล็อก/ปลดล็อกทั้ง "ชุดข้อมูล" ของคูส่งน้ำนี้ (ปุ่มรวมด้านบนคุมทุกกลุ่มพร้อมกัน)
    // ตั้งต้นเป็น true เมื่อยังไม่เคยตั้งค่า เพื่อให้ตรงกับ attachmentAllLocked()
    let isLocked = attachmentGroupState[groupKey].locked !== false;
    // ช่องที่แก้ไขได้จริง = ต้องไม่ถูกล็อกกลุ่ม และต้องผ่านกฎของประเภทอาคาร
    let canEdit = !isLocked;

    let sepClass = (isFirstOfGroup && aIdx > 0) ? 'group-separator-row' : '';
    let rowStyle = (isCollapsed && !isFirstOfGroup) ? 'style="display: none;"' : '';

    // --- คลองส่งน้ำ + ปุ่มยุบ/ขยาย + ปุ่มล็อกชุดข้อมูล (แถวแรกของกลุ่ม) ---
    let canalCellContent = '';
    if (isFirstOfGroup) {
      let collapseText = isCollapsed ? "+" : "-";
      canalCellContent = `
        <div class="cell-flex-row">
          <button class="btn-collapse-rows" onclick="toggleAttachmentGroupCollapse('${groupKey}')" tabindex="-1">${collapseText}</button>
          ${renderLockButtonHtml(isLocked, `toggleAttachmentGroupLock('${groupKey}')`)}
          <span style="font-weight: bold; margin-left: 2px;">${escapeHtml(chObj.canal)}</span>
        </div>
      `;
    } else {
      canalCellContent = `<span style="color: #6c757d;">${escapeHtml(chObj.canal)}</span>`;
    }

    // --- คูส่งน้ำ + ปุ่ม + / - (แถวแรกของกลุ่มมี + อย่างเดียว ที่เหลือมีทั้ง + และ -) ---
    let cBtnGroup = '';
    if (isFirstOfGroup) {
      cBtnGroup = `<button class="btn-row-add" title="เพิ่มแถวอาคารด้านล่าง" onclick="addAttachmentRowAt(${aIdx})" tabindex="-1">+</button>`;
    } else {
      cBtnGroup = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="เพิ่มแถวอาคารด้านล่าง" onclick="addAttachmentRowAt(${aIdx})" tabindex="-1">+</button>
          <button class="btn-row-del" title="ลบแถวนี้" onclick="deleteAttachmentRowAt(${aIdx})" tabindex="-1">-</button>
        </div>
      `;
    }

    // --- จำนวนอาคาร (ค่าเริ่มต้น 1 · แก้ไขได้ตามสถานะล็อกของกลุ่ม) ---
    let countVal = (row.count === "" || row.count === undefined || row.count === null) ? "1" : row.count;
    let countCellContent = canEdit
      ? `<input type="text" class="table-input editable" data-row="${aIdx}" data-col="3" data-field="count" value="${escapeHtml(countVal)}" placeholder="1" onchange="updateAttachmentField(${aIdx}, 'count', this.value)">`
      : `<input type="text" class="table-input locked" data-row="${aIdx}" data-col="3" value="${escapeHtml(countVal)}" readonly title="ล็อกชุดข้อมูลนี้อยู่">`;

    // --- รายการอาคาร (แถวแรกของคูส่งน้ำ = ล็อก / แถวถัดไป = ลิสต์ให้เลือก) ---
    let typeCellContent = isFirstOfGroup
      ? `<input type="text" class="table-input locked" data-row="${aIdx}" data-col="2" value="${escapeHtml(row.name || ATTACHMENT_BASE_NAME)}" readonly title="แถวแรกของคูส่งน้ำถูกล็อกเป็นอาคารท่อรับน้ำเข้าแปลงไร่นา">`
      : (canEdit
        ? `<div class="combobox-container" id="attTypeCell_${aIdx}"></div>`
        : `<input type="text" class="table-input locked" data-row="${aIdx}" data-col="2" value="${escapeHtml(row.name || '')}" readonly title="ล็อกชุดข้อมูลนี้อยู่">`);

    // --- H / ศก. ท่อ / ความยาว (ล็อกหรือแก้ไขตามประเภทอาคาร + สถานะล็อกของกลุ่ม) ---
    let rule = getAttachmentRule(row.name);

    let hVal = (row.h !== "" && row.h !== undefined) ? row.h : "0.00";
    let hCellContent = (rule.h && canEdit)
      ? `<input type="text" class="table-input editable" id="attHInput_${aIdx}" data-row="${aIdx}" data-col="4" data-field="h" value="${escapeHtml(hVal)}" placeholder="0.00" onchange="updateAttachmentField(${aIdx}, 'h', this.value)">`
      : `<input type="text" class="table-input locked" id="attHInput_${aIdx}" data-row="${aIdx}" data-col="4" value="${escapeHtml(hVal)}" readonly title="${canEdit ? 'ประเภทอาคารนี้ล็อกค่า H' : 'ล็อกชุดข้อมูลนี้อยู่'}">`;

    // --- ศก. ท่อ (ม.) — ล็อกทั้งหมด ใส่ค่าเริ่มต้นตามรายการอาคาร ---
    let diaVal = getAttachmentPipeDia(row);
    let diaCellContent = `<input type="text" class="table-input locked" id="attDiaInput_${aIdx}" data-row="${aIdx}" data-col="5" value="${escapeHtml(diaVal)}" readonly title="ล็อกค่าเริ่มต้นตามรายการอาคาร">`;

    let lenVal = (row.length !== "" && row.length !== undefined) ? row.length : "1.00";
    let lenCellContent = (rule.len && canEdit)
      ? `<input type="text" class="table-input editable" id="attLenInput_${aIdx}" data-row="${aIdx}" data-col="6" data-field="length" value="${escapeHtml(lenVal)}" placeholder="1.00" onchange="updateAttachmentField(${aIdx}, 'length', this.value)">`
      : `<input type="text" class="table-input locked" id="attLenInput_${aIdx}" data-row="${aIdx}" data-col="6" value="${escapeHtml(lenVal)}" readonly title="${canEdit ? 'ประเภทอาคารนี้ล็อกค่าความยาว' : 'ล็อกชุดข้อมูลนี้อยู่'}">`;

    let remarkHtml = canEdit
      ? `<input type="text" class="table-input editable" data-row="${aIdx}" data-col="7" data-field="remark" value="${escapeHtml(row.remark || '')}" placeholder="" onchange="updateAttachmentField(${aIdx}, 'remark', this.value)">`
      : `<input type="text" class="table-input locked" data-row="${aIdx}" data-col="7" value="${escapeHtml(row.remark || '')}" readonly title="ล็อกชุดข้อมูลนี้อยู่">`;
    let ditchSectionHtml = (typeof getDitchSectionHtml === 'function') ? getDitchSectionHtml(cIdx, row) : '';

    rowsHtml += `
      <tr class="${sepClass}" ${rowStyle}>
        <td>${canalCellContent}</td>
        <td>
          <div class="cell-flex-row">
            <span style="font-weight: ${isFirstOfGroup ? 'bold' : 'normal'};">${escapeHtml(chObj.ditch)}</span>
            ${cBtnGroup}
          </div>
        </td>
        <td>${typeCellContent}</td>
        <td>${countCellContent}</td>
        <td>${hCellContent}</td>
        <td>${diaCellContent}</td>
        <td>${lenCellContent}</td>
        <td>${remarkHtml}</td>
        <td class="ditch-section-cell">${ditchSectionHtml}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="attachment-table">
      <thead>
        <tr>
          <th style="min-width: 210px;">คลองส่งน้ำ</th>
          <th style="min-width: 120px;">คูส่งน้ำ</th>
          <th style="min-width: 280px;">รายการอาคาร</th>
          <th style="min-width: 100px;">จำนวนอาคาร</th>
          <th style="min-width: 90px;">H (ม.)</th>
          <th style="min-width: 120px;">ศก. ท่อ (ม.)</th>
          <th style="min-width: 120px;">ความยาว (ม.)</th>
          <th style="min-width: 150px;">หมายเหตุ</th>
          <th style="min-width: 90px;">ช่วงคูน้ำ</th>
        </tr>
      </thead>
      <tbody id="attachmentTableBody">
        ${rowsHtml}
      </tbody>
    </table>
  `;

  // สร้างลิสต์ "รายการอาคาร" ของแถวถัดจากแถวแรก (ต้องทำหลังใส่ innerHTML แล้ว)
  attachmentRowsData.forEach((row, aIdx) => {
    if (!attachmentIsBaseRow(aIdx)) {
      refreshAttachmentTypeCell(aIdx, row);
    }
  });
}

function toggleAttachmentGroupCollapse(grpKey) {
  // แยกอิสระจาก toggleAttachmentGroupLock: ปุ่ม + / - ย่อ/ขยายแถวเท่านั้น ไม่เปลี่ยนสถานะล็อก
  // (เดิมบังคับ locked = collapsed → กด + แล้วไปเปลี่ยนปุ่ม "แก้ไข/ล็อก" ด้วย)
  if (attachmentGroupState[grpKey] === undefined) {
    attachmentGroupState[grpKey] = { collapsed: true, locked: true };
  }
  attachmentGroupState[grpKey].collapsed = !attachmentGroupState[grpKey].collapsed;
  // ⚠️ ห้ามแตะ locked — ปุ่ม "แก้ไข/ล็อก" เป็นอิสระ
  updateTable();
}

// ===== ปุ่ม "ล็อก/แก้ไข" — แยกอิสระจาก toggleAttachmentGroupCollapse =====
// เปลี่ยนแค่สถานะล็อก ไม่ย่อ/ขยายแถว (ปุ่ม + / - ทำหน้าที่ย่อ/ขยายอย่างเดียว)
function toggleAttachmentGroupLock(grpKey) {
  if (attachmentGroupState[grpKey] === undefined) {
    attachmentGroupState[grpKey] = { collapsed: true, locked: true };
  }
  // อ่านช่องที่แสดงอยู่จริง เพื่อให้แน่ใจว่าค่าล่าสุดถูกบันทึกก่อนสลับสถานะ
  syncTableInputsToChannels();
  // toggle แค่ locked — ห้ามแตะ collapsed (ปุ่ม + / - เป็นอิสระ)
  attachmentGroupState[grpKey].locked = !attachmentGroupState[grpKey].locked;
            if (!attachmentGroupState[grpKey].locked) {
                attachmentGroupState[grpKey].collapsed = false;
            }
  updateTable();
}

// สถานะรวมของทุกชุด (ใช้ตรวจสอบ/ทดสอบ)
function attachmentAllLocked() {
  let groups = channels.map(ch => `attach_ch_${ch.id}`);
  if (groups.length === 0) return true;
  return groups.every(k => {
    let st = attachmentGroupState[k];
    return !st || st.locked !== false;
  });
}
