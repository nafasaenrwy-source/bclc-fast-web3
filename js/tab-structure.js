// ===== js/tab-structure.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บ "อาคารประกอบ"
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function addStructureRowAt(sIdx) {
  // อ่านค่าล่าสุดจากช่องก่อน (แถวเดิมเท่านั้น — ไม่กระทบแถวใหม่ที่กำลังจะสร้าง)
  syncTableInputsToChannels();
  let curRow = structureRowsData[sIdx];
  let cIdx = curRow.channelId;
  let dimItem = dimensionRows.find(d => d.channelId === cIdx);

  let kMin = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
  let initialKm = (curRow.km !== "" && curRow.km !== undefined) ? curRow.km : kMin;

  // ⚠️ ช่องตัวเลขของแถวใหม่ "ห้ามคัดลอกค่าจากแถวบน" — ตั้งเป็นค่าว่างเสมอ
  //    ค่าเริ่มต้นจะถูกดึงจากตาราง Typeอาคารประกอบ ตอน render (ถ้าตารางมีค่า)
  let newSRow = {
    channelId: cIdx,
    isBoundary: false,
    km: initialKm,
    name: "-ไม่มี-",
    hOverride: "",      // ไม่คัดลอกค่า H จากแถวบน
    pipeDia: "",        // ไม่คัดลอกค่า ศก. ท่อ จากแถวบน
    pipeCount: "",      // ไม่คัดลอกค่าความยาว จากแถวบน
    remark: "",
    ditchSection: curRow.ditchSection
  };

  structureRowsData.splice(sIdx + 1, 0, newSRow);
  updateTable();
}

function deleteStructureRowAt(sIdx) {
  confirmDelete('ต้องการลบแถวอาคารประกอบนี้ใช่หรือไม่?', function () { doDeleteStructureRowAt(sIdx); });
}

function doDeleteStructureRowAt(sIdx) {
  syncTableInputsToChannels();
  let curRow = structureRowsData[sIdx];
  if (curRow && !curRow.isBoundary) {
    structureRowsData.splice(sIdx, 1);
    updateTable();
  }
}

function updateStructureField(sIdx, field, val) {
  if (structureRowsData[sIdx]) {
    if (field === 'hOverride') {
      let num = parseFloat(val);
      structureRowsData[sIdx].hOverride = isNaN(num) ? 0.00 : num;
    } else if (field === 'km') {
      let parsed = parseKmInput(val);
      let cIdx = structureRowsData[sIdx].channelId;
      let dimItem = dimensionRows.find(d => d.channelId === cIdx);

      let kMin = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
      let kEnd = getChannelKmEnd(cIdx);
      let kMax = (kEnd !== "" && kEnd !== undefined && kEnd !== null) ? parseFloat(kEnd) : null;

      if (parsed !== "") {
        let num = parseFloat(parsed);
        if (num < kMin) {
          alert(`กม. ห้ามน้อยกว่า กม.เริ่มต้นของสาย (${formatKmDisplay(kMin)})`);
          num = kMin;
        } else if (kMax !== null && num > kMax) {
          alert(`กม. ห้ามมากกว่า กม.สิ้นสุดของสาย (${formatKmDisplay(kMax)})`);
          num = kMax;
        }
        structureRowsData[sIdx].km = num;
      } else {
        structureRowsData[sIdx].km = "";
      }
    } else {
      structureRowsData[sIdx][field] = val;
    }
    updateTable();
  }
}

function toggleStructureGroupLock(grpKey) {
  // แยกอิสระจาก toggleStructureGroupCollapse: ปุ่ม "แก้ไข/ล็อก" เปลี่ยนแค่สถานะล็อกเท่านั้น
  // ไม่ย่อ/ขยายแถว (เดิมผูกกับ collapsed → กด "แก้ไข" แล้วไปกระทบ ปุ่ม + / - ด้วย)
  if (structureGroupState[grpKey] === undefined) {
    structureGroupState[grpKey] = { locked: true, collapsed: true };
  }
  structureGroupState[grpKey].locked = !structureGroupState[grpKey].locked;
            if (!structureGroupState[grpKey].locked) {
                structureGroupState[grpKey].collapsed = false;
            }
  // ⚠️ ห้ามแตะ collapsed — ปุ่ม + / - เป็นอิสระ
  updateTable();
}

function toggleStructureGroupCollapse(grpKey) {
  // แยกอิสระจาก toggleStructureGroupLock: ปุ่ม + / - ย่อ/ขยายแถวเท่านั้น ไม่เปลี่ยนสถานะล็อก
  // (เดิมบังคับ locked = collapsed → กด + แล้วไปเปลี่ยนปุ่ม "แก้ไข/ล็อก" ด้วย)
  if (structureGroupState[grpKey] === undefined) {
    structureGroupState[grpKey] = { locked: true, collapsed: true };
  }
  structureGroupState[grpKey].collapsed = !structureGroupState[grpKey].collapsed;
  // ⚠️ ห้ามแตะ locked — ปุ่ม "แก้ไข/ล็อก" เป็นอิสระ
  updateTable();
}

// รอบ 29 / รอบ 50: ปุ่ม "แสดงป้ายอาคารประกอบ" สำหรับชุดข้อมูล (คูส่งน้ำ) นี้บนภาพแปลน
//   เก็บสถานะไว้ใน structureGroupState[grpKey].showLabels (ค่าเริ่มต้น = false = ยังไม่แสดงจนกว่าผู้ใช้จะกดเปิด เพื่อไม่ให้เด้งขึ้นมาเองตอนกำหนดจุด P1,P2 ในแท็บระดับดินเดิม)
function isStructureLabelsVisible(grpKey) {
  if (typeof structureGroupState === 'undefined' || !structureGroupState) return false;
  let grp = structureGroupState[grpKey];
  if (!grp) return false;
  return grp.showLabels === true;
}

function toggleStructureShowLabels(grpKey, forcedVal) {
  if (structureGroupState[grpKey] === undefined) {
    structureGroupState[grpKey] = { locked: true, collapsed: true };
  }
  if (typeof forcedVal === 'boolean') {
    structureGroupState[grpKey].showLabels = forcedVal;
  } else {
    structureGroupState[grpKey].showLabels = !isStructureLabelsVisible(grpKey);
  }
  updateTable();
  if (typeof redraw === "function") redraw();
}

// ===== ฟังก์ชันที่แตกออกมาจาก updateTable() เดิม (เขียนหัวฟังก์ชันใหม่ ส่วน body ย้ายมาตรง ๆ) =====
function renderStructureTab() {
  const container = document.getElementById('tableContainer');

  syncDimensionRowsWithChannels();
  let rowsHtml = '';
  let lastChannelIdx = -1;

  structureRowsData.forEach((srow, sIdx) => {
    let cIdx = srow.channelId;
    let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
    let canalName = chObj.canal;
    let ditchName = chObj.ditch;
    let groupKey = `struct_ch_${cIdx}`;

    let isFirstOfGroup = (cIdx !== lastChannelIdx);
    lastChannelIdx = cIdx;

    let isLastRowOfChan = (sIdx === structureRowsData.length - 1) || (structureRowsData[sIdx + 1].channelId !== cIdx);

    if (structureGroupState[groupKey] === undefined) {
      // รอบ 31 / รอบ 50: default = locked + collapsed + showLabels: false (ยังไม่แสดงป้ายอาคารจนกว่าจะกดปุ่ม)
      structureGroupState[groupKey] = { locked: true, collapsed: true, showLabels: false };
    }
    let isLocked = structureGroupState[groupKey].locked !== false;
    let isCollapsed = structureGroupState[groupKey].collapsed === true;

    let sepClass = (isFirstOfGroup && sIdx > 0) ? 'group-separator-row' : '';
    let rowStyle = (isCollapsed && !isFirstOfGroup) ? 'style="display: none;"' : '';
    // ใส่ "เส้นบนบรรทัด" สีเดียว เฉพาะแถวที่คัดลอกมาจากแท็ประดับคูส่งน้ำ
    // (แถวที่ผู้ใช้เพิ่มเอง + แถว boundary ไม่ต้องใส่สี)
    let groupTintClass = shouldStructureRowHaveTint(srow) ? 'row-tint' : '';

    let canalCellContent = '';
    if (isFirstOfGroup) {
      let collapseText = isCollapsed ? "+" : "-";
      canalCellContent = `
        <div class="cell-flex-row">
          <button class="btn-collapse-rows" onclick="toggleStructureGroupCollapse('${groupKey}')" tabindex="-1">${collapseText}</button>
          ${renderLockButtonHtml(isLocked, `toggleStructureGroupLock('${groupKey}')`)}
          <span style="font-weight: bold; margin-left: 2px;">${escapeHtml(canalName)}</span>
        </div>
      `;
    } else {
      canalCellContent = `<span style="color: #6c757d;">${escapeHtml(canalName)}</span>`;
    }

    // ===== ปุ่ม + / − =====
    // แถวแรกของชุด (ปุ่มคุมการยุบ/ขยาย) -> ใส่เฉพาะ +
    // แถวสุดท้ายของชุด -> ไม่มีปุ่มเลย
    // แถวคัดลอกจากแท็ประดับคูส่งน้ำ (isFromLevel) -> ใส่เฉพาะ +
    // แถวที่ผู้ใช้เพิ่มเอง -> ใส่ + และ − (ลบได้จริง)
    let kmButtonGroup = '';
    if (!isLocked) {
      let canDelete = !srow.isBoundary && !srow.isFromLevel;
      if (canDelete) {
        // แถวสุดท้ายของคู (ปลายคู) ไม่ต้องมีปุ่ม
        if (!isLastRowOfChan) {
          kmButtonGroup = `
            <div class="km-btn-group">
              <button class="btn-row-add" title="แทรกแถวด้านล่าง" onclick="addStructureRowAt(${sIdx})" tabindex="-1">+</button>
              <button class="btn-row-del" title="ลบแถวนี้" onclick="deleteStructureRowAt(${sIdx})" tabindex="-1">−</button>
            </div>
          `;
        }
      } else if (!isLastRowOfChan) {
        kmButtonGroup = `
          <div class="km-btn-group">
            <button class="btn-row-add" title="แทรกแถวด้านล่าง" onclick="addStructureRowAt(${sIdx})" tabindex="-1">+</button>
          </div>
        `;
      }
    }

    let kmInputHtml = '';
    // แท็บอาคารประกอบ: ถ้า กม. มีทศนิยม (เช่น 0+050.40) → แสดงทศนิยม 2 ตำแหน่งเฉพาะแถวนั้น
    //   ถ้าค่าลงตัว (เช่น 0+050) → แสดงจำนวนเต็มเหมือนเดิม ไม่เปลี่ยนรูปแบบ
    let kmFmt = kmHasDecimal(srow.km) ? formatKmDisplayDecimal(srow.km) : formatKmDisplay(srow.km);
    if (srow.isBoundary || srow.isFromLevel || isLocked) {
      kmInputHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="2" data-field="km" value="${escapeHtml(kmFmt)}" readonly title="${srow.isBoundary ? 'ล็อกค่าตามแท็บมิติคูส่งน้ำ' : (srow.isFromLevel ? 'ดึงจุด กม. ย่อยจากแท็ประดับคูส่งน้ำ' : '')}">`;
    } else {
      kmInputHtml = `<input type="text" class="table-input" data-row="${sIdx}" data-col="2" data-field="km" value="${escapeHtml(kmFmt)}" placeholder="0+000" onchange="updateStructureField(${sIdx}, 'km', this.value); updateTable();">`;
    }

    // ===== กฎจากตาราง "Typeอาคารประกอบ" (setting แท็บย่อย Typeอาคารประกอบ) =====
    // ใช้ "ล็อกช่องไม่ให้กรอกข้อมูล" กับช่อง H / ศก. ท่อ / ความยาว / หมายเหตุ
    // นอกเหนือจากปุ่ม 🔒 ล็อกกลุ่มของคูส่งน้ำ (กลุ่มล็อกก็ล็อกทั้งหมดอยู่แล้ว)
    let sEntry = getStructureTypeEntry(srow.name);

    // คอลัมน์ "รายการอาคาร" ใช้ "ชื่ออาคารประกอบ" ที่รวมข้อมูลแล้ว
    let computedItemName = computeStructureTypeName({
      type: srow.name || "",
      h: structureNameValue(srow.hOverride, sEntry ? sEntry.h : "", !!(sEntry && sEntry.hEditable)),
      pipeDia: structureNameValue(srow.pipeDia, sEntry ? sEntry.pipeDia : "", !!(sEntry && sEntry.diaEditable)),
      length: structureNameValue(srow.pipeCount, sEntry ? sEntry.length : "", !!(sEntry && sEntry.lenEditable)),
      remark: structureNameValue(srow.remark, sEntry ? sEntry.remark : "", !!(sEntry && sEntry.remarkEditable))
    });
    let computedItemHtml = `<input type="text" class="table-input locked" value="${escapeHtml(computedItemName)}" readonly title="ชื่ออาคารประกอบ — รวมจากตาราง Typeอาคารประกอบ + ค่าที่กรอก">`;

    // ===== ช่อง "ประเภทอาคาร" (คอลัมน์ที่ 5) =====
    // ปลดล็อกกลุ่มแล้ว -> เลือกประเภทอาคารได้ทุกแถว (รวมแถวที่คัดลอกจากแท็ประดับคูส่งน้ำ)
    // กลุ่มถูกล็อก (🔒) -> ล็อกทั้งหมด
    let isStartBoundaryRow = !!(srow.isBoundary && !srow.isEndBoundary);
    let isEndBoundaryRow = !!(srow.isBoundary && srow.isEndBoundary);
    let nameEditable = !isLocked;

    let nameSelectHtml = '';
    if (nameEditable) {
      nameSelectHtml = `
        <div class="combobox-container">
          <input type="text" class="combobox-input editable" id="nameInput_${sIdx}" data-row="${sIdx}" data-col="4" data-field="name" value="${escapeHtml(srow.name || '-ไม่มี-')}" placeholder="-ไม่มี-" onchange="updateStructureField(${sIdx}, 'name', this.value)">
          <span class="combobox-arrow">▼</span>
          <select class="combobox-select" tabindex="-1" onchange="document.getElementById('nameInput_${sIdx}').value = this.value; updateStructureField(${sIdx}, 'name', this.value);">
            <option value="" selected></option>
            ${getStructureTypeOptions().map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
          </select>
        </div>
      `;
    } else {
      let lockTitle = isLocked ? 'ล็อกตามกลุ่มคูส่งน้ำ' : 'แถวนี้ดึงค่ามาจากแท็ประดับคูส่งน้ำ (แก้ชื่อไม่ได้)';
      nameSelectHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="4" data-field="name" value="${escapeHtml(srow.name || '-ไม่มี-')}" readonly title="${lockTitle}">`;
    }

    // ค่าเริ่มต้นของช่องต่าง ๆ ดึงจากตาราง Typeอาคารประกอบ (ใช้เฉพาะเมื่อช่องยังว่าง)
    // ถ้าตารางเป็น "-" → แสดง "-" และล็อกบังคับ (บังคับแก้ไขค่าเลย)
    let tableH = (sEntry && sEntry.h !== undefined) ? String(sEntry.h) : "";
    let tableDia = (sEntry && sEntry.pipeDia !== undefined) ? String(sEntry.pipeDia) : "";
    let tableLen = (sEntry && sEntry.length !== undefined) ? String(sEntry.length) : "";
    let hIsDash = (tableH.trim() === "-");
    let diaIsDash = (tableDia.trim() === "-");
    let lenIsDash = (tableLen.trim() === "-");

    // H (ม.) — ล็อกถ้าตารางบอกว่าแก้ไม่ได้ หรือตารางเป็น "-" (บังคับ)
    // ลำดับความสำคัญของค่า H:
    //   1) ค่าที่ผู้ใช้กรอกในช่อง (srow.hOverride)
    //   2) แถวที่คัดลอกจากแท็ประดับคูส่งน้ำ -> ค่า H ของบรรทัดนั้น (ยกเว้น กม.สิ้นสุด = "-")
    //   3) ค่าเริ่มต้นในตาราง Typeอาคารประกอบ
    let hLockedByType = isLocked || !(sEntry && sEntry.hEditable) || hIsDash;
    let hLvlVal = srow.isFromLevel ? getStructureLevelH(srow) : "";
    let hUserVal = (srow.hOverride === undefined || srow.hOverride === null) ? "" : String(srow.hOverride).trim();
    let hResolved;
    if (hUserVal !== "") {
      hResolved = hUserVal;
    } else if (srow.isFromLevel && hLvlVal !== "") {
      hResolved = hLvlVal;
    } else {
      hResolved = hIsDash ? "-" : (tableH !== "" ? tableH : "-");
    }
    let hDisplayVal = formatStructureCellValue(hResolved);
    let hInputHtml = '';
    // ธงบอกว่าค่าที่แสดง "มาจากแท็ประดับคูส่งน้ำ" (ไม่ใช่ค่าที่ผู้ใช้กรอก) -> ห้าม sync ทับข้อมูล
    let hFromLevelAttr = (hUserVal === "" && srow.isFromLevel && hLvlVal !== "") ? ' data-h-from-level="1"' : '';
    if (hLockedByType) {
      hInputHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="5" value="${escapeHtml(hDisplayVal)}" readonly title="${isLocked ? 'ล็อกตามกลุ่มคูส่งน้ำ' : (hIsDash ? 'ตาราง Typeอาคารประกอบกำหนดเป็น - (ล็อกบังคับ)' : 'อาคารนี้ถูกล็อกค่า H ตามตาราง Typeอาคารประกอบ')}">`;
    } else {
      hInputHtml = `<input type="text" class="table-input editable" data-row="${sIdx}" data-col="5" data-field="hOverride"${hFromLevelAttr} value="${escapeHtml(hDisplayVal)}" placeholder="0.00" onchange="updateStructureField(${sIdx}, 'hOverride', this.value); updateTable();">`;
    }

    // ศก. ท่อ (ม.) — ล็อกถ้าตารางบอกว่าแก้ไม่ได้ หรือตารางเป็น "-"
    // ค่าเริ่มต้นของช่องที่แก้ไขได้ มาจากตาราง Typeอาคารประกอบ
    // แสดง "-" เมื่อค่าเป็น 0 (ค่าจริงยังคงเป็น 0 ไม่หายไปเวลาเซฟ)
    let diaLockedByType = isLocked || !(sEntry && sEntry.diaEditable) || diaIsDash;
    let diaTableVal = diaIsDash ? "-" : (tableDia !== "" ? tableDia : "");
    let diaEditableVal = structureNameValue(srow.pipeDia, tableDia, true);
    let diaShown = formatStructureCellValue(diaLockedByType ? diaTableVal : diaEditableVal);
    let diaInputClass = diaLockedByType ? 'combobox-input locked' : 'combobox-input editable';
    let pipeDiaHtml = '';
    if (diaLockedByType) {
      pipeDiaHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="6" value="${escapeHtml(diaShown)}" readonly title="${isLocked ? 'ล็อกตามกลุ่มคูส่งน้ำ' : (diaIsDash ? 'ตาราง Typeอาคารประกอบกำหนดเป็น - (ล็อกบังคับ)' : 'อาคารนี้ถูกล็อกค่า ศก. ท่อ ตามตาราง Typeอาคารประกอบ')}">`;
    } else {
      pipeDiaHtml = `
        <div class="combobox-container">
          <input type="text" class="${diaInputClass}" id="diaInput_${sIdx}" data-row="${sIdx}" data-col="6" data-field="pipeDia" value="${escapeHtml(diaShown)}" placeholder="0.00" onchange="updateStructureField(${sIdx}, 'pipeDia', this.value)">
          <span class="combobox-arrow">▼</span>
          <select class="combobox-select" tabindex="-1" onchange="document.getElementById('diaInput_${sIdx}').value = this.value; updateStructureField(${sIdx}, 'pipeDia', this.value);">
            <option value="" selected></option>
            ${pipeDiameterOptions.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    // ความยาว (ม.) — ล็อกถ้าตารางบอกว่าแก้ไม่ได้ หรือตารางเป็น "-"
    // ค่าเริ่มต้นของช่องที่แก้ไขได้ มาจากตาราง Typeอาคารประกอบ
    // แสดง "-" เมื่อค่าเป็น 0 (ค่าจริงยังคงเป็น 0)
    let lenLockedByType = isLocked || !(sEntry && sEntry.lenEditable) || lenIsDash;
    let lenTableVal = lenIsDash ? "-" : (tableLen !== "" ? tableLen : "");
    let lenEditableVal = structureNameValue(srow.pipeCount, tableLen, true);
    let lenShown = formatStructureCellValue(lenLockedByType ? lenTableVal : lenEditableVal);
    let lenInputClass = lenLockedByType ? 'combobox-input locked' : 'combobox-input editable';
    let pipeCountHtml = '';
    if (lenLockedByType) {
      pipeCountHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="7" value="${escapeHtml(lenShown)}" readonly title="${isLocked ? 'ล็อกตามกลุ่มคูส่งน้ำ' : (lenIsDash ? 'ตาราง Typeอาคารประกอบกำหนดเป็น - (ล็อกบังคับ)' : 'อาคารนี้ถูกล็อกค่าความยาว ตามตาราง Typeอาคารประกอบ')}">`;
    } else {
      pipeCountHtml = `
        <div class="combobox-container">
          <input type="text" class="${lenInputClass}" id="countInput_${sIdx}" data-row="${sIdx}" data-col="7" data-field="pipeCount" value="${escapeHtml(lenShown)}" placeholder="0.00" onchange="updateStructureField(${sIdx}, 'pipeCount', this.value)">
          <span class="combobox-arrow">▼</span>
          <select class="combobox-select" tabindex="-1" onchange="document.getElementById('countInput_${sIdx}').value = this.value; updateStructureField(${sIdx}, 'pipeCount', this.value);">
            <option value="" selected></option>
            ${lengthOptions.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    // หมายเหตุ — ช่องที่แก้ไขได้: ใช้ค่าเริ่มต้นจากตาราง Typeอาคารประกอบ + ไฮไลต์เขียว
    // "อาคารปากคูซอย" เป็นช่องที่กรอกได้เสมอ ที่เหลือล็อกแสดงค่าจากตาราง
    let remarkEditableByType = !!(sEntry && sEntry.remarkEditable);
    let remarkTableVal = (sEntry && sEntry.remark) ? sEntry.remark : "";
    let remarkSystemVal = remarkTableVal !== "" ? remarkTableVal : "-";
    let remarkLocked = !remarkEditableByType;
    let remarkShown = remarkEditableByType
      ? structureNameValue(srow.remark, remarkTableVal, true)
      : remarkSystemVal;
    let remarkHtml = remarkEditableByType
      ? `<input type="text" class="table-input editable" data-row="${sIdx}" data-col="8" data-field="remark" value="${escapeHtml(remarkShown)}" placeholder="ใส่ชื่อคูซอย" onchange="updateStructureField(${sIdx}, 'remark', this.value)">`
      : `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="8" data-field="remark" value="${escapeHtml(remarkShown)}" readonly title="อาคารนี้ล็อกช่องหมายเหตุไว้">`;

    // รอบ 39: คอลัมน์ UP และ DOWN (ล็อกอัตโนมัติ ดึงค่า TYPE จากแท็บระดับคูส่งน้ำตามเงื่อนไขของประเภทอาคารใน Typeอาคารประกอบ)
    let upDownTypes = (typeof computeStructureUpDownTypes === 'function')
      ? computeStructureUpDownTypes(srow)
      : { up: '-', down: '-', upRule: '-', downRule: '-' };
    let upTypeHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="9" data-field="up" value="${escapeHtml(upDownTypes.up)}" readonly title="UP (${escapeHtml(upDownTypes.upRule)}) — ล็อกอัตโนมัติตามตาราง Typeอาคารประกอบ">`;
    let downTypeHtml = `<input type="text" class="table-input locked" data-row="${sIdx}" data-col="10" data-field="down" value="${escapeHtml(upDownTypes.down)}" readonly title="DOWN (${escapeHtml(upDownTypes.downRule)}) — ล็อกอัตโนมัติตามตาราง Typeอาคารประกอบ">`;

    // รอบ 29: เพิ่มปุ่ม "แสดงป้ายอาคารประกอบ" ในแถว "จุด P1/P2"
    let structureLabelsBtnHtml = '';
    if (isFirstOfGroup) {
      let showLabels = isStructureLabelsVisible(groupKey);
      let btnClass = showLabels ? 'state-show' : 'state-hide';
      let btnText = showLabels ? 'แสดงป้ายอาคารประกอบ' : 'ซ่อนป้ายอาคารประกอบ';
      structureLabelsBtnHtml = `<button type="button" class="btn-toggle-line ${btnClass}" onclick="toggleStructureShowLabels('${groupKey}')" title="คลิกเพื่อสลับแสดง/ซ่อนป้ายอาคารประกอบของชุดข้อมูลนี้บนภาพแปลน" tabindex="-1">${btnText}</button>`;
    }

    if (isFirstOfGroup && !isCollapsed && typeof renderReadonlyP1P2ToolbarRowHtml === 'function') {
      rowsHtml += renderReadonlyP1P2ToolbarRowHtml(cIdx, 12, sepClass, structureLabelsBtnHtml);
    }
    let dataRowSepClass = (isFirstOfGroup && isCollapsed && sIdx > 0) ? 'group-separator-row' : '';
    // รอบ 41: คอลัมน์สุดท้าย "ช่วงคูน้ำ" (ลำดับ 1, 2, 3 ... ตามคูส่งน้ำที่แยกไว้)
    let ditchSectionHtml = (typeof getDitchSectionHtml === 'function') ? getDitchSectionHtml(cIdx, srow) : '';
    rowsHtml += `
      <tr class="${dataRowSepClass} ${groupTintClass}" ${rowStyle}>
        <td>${canalCellContent}</td>        <td>
          <div class="cell-flex-row">
            <span style="font-weight: ${isFirstOfGroup ? 'bold' : 'normal'};">${escapeHtml(ditchName)}</span>
            ${kmButtonGroup}
          </div>
        </td>
        <td>${kmInputHtml}</td>
        <td>${computedItemHtml}</td>
        <td>${nameSelectHtml}</td>
        <td>${hInputHtml}</td>
        <td>${pipeDiaHtml}</td>
        <td>${pipeCountHtml}</td>
        <td>${remarkHtml}</td>
        <td>${upTypeHtml}</td>
        <td>${downTypeHtml}</td>
        <td class="ditch-section-cell">${ditchSectionHtml}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="structure-table">
      <thead>
        <tr>
          <th style="min-width: 170px;">คลองส่งน้ำ</th>
          <th style="min-width: 140px;">คูส่งน้ำ</th>
          <th style="min-width: 120px;">กม.</th>
          <th style="min-width: 210px;">รายการอาคาร</th>
          <th style="min-width: 190px;">ประเภทอาคาร</th>
          <th style="min-width: 100px;">H (ม.)</th>
          <th style="min-width: 120px;">ศก. ท่อ (ม.)</th>
          <th style="min-width: 110px;">ความยาว (ม.)</th>
          <th style="min-width: 150px;">หมายเหตุ</th>
          <th style="min-width: 90px;">UP</th>
          <th style="min-width: 90px;">DOWN</th>
          <th style="min-width: 90px;">ช่วงคูน้ำ</th>
        </tr>
      </thead>
      <tbody id="structureTableBody">
        ${rowsHtml}
      </tbody>
    </table>
  `;
}
