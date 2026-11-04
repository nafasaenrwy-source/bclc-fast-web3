// ===== js/tab-type.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บย่อยใต้เมนู "setting"
//   setting-type      = แท็บย่อย "Typeคูส่งน้ำ" (เดิมชื่อแท็บ "Typeคูส่งน้ำ")
//   setting-structure = แท็บย่อย "Typeอาคารประกอบ" (แท็บย่อยใหม่)
// โค้ดส่วนเดิมถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function addDitchTypeRow() {
  // _userAdded = แถวที่ผู้ใช้เพิ่มเอง (มีปุ่ม + และ -) ต่างจาก VU1–VU6 ที่เป็นชุดตั้งต้น
  ditchTypeDatabase.push({ type: "NEW", b: 0.30, h: 0.50, tw: 0.10, tf: 0.10, _userAdded: true });
  updateTable();
}

function deleteDitchTypeRow(idx) {
  if (!(ditchTypeDatabase.length > 1 && ditchTypeDatabase[idx] && ditchTypeDatabase[idx]._userAdded === true)) return;
  let name = ditchTypeDatabase[idx].type;
  confirmDelete(`ต้องการลบ Type คูส่งน้ำ "${name}" ใช่หรือไม่?`, function () { doDeleteDitchTypeRow(idx); });
}

function doDeleteDitchTypeRow(idx) {
  if (ditchTypeDatabase.length > 1 && ditchTypeDatabase[idx] && ditchTypeDatabase[idx]._userAdded === true) {
    ditchTypeDatabase.splice(idx, 1);
    updateTable();
  }
}

function updateDitchTypeField(idx, field, val) {
  if (ditchTypeDatabase[idx]) {
    if (field === 'type') ditchTypeDatabase[idx].type = val;
    else ditchTypeDatabase[idx][field] = parseFloat(val) || 0;
  }
  updateTable();
}

// ===== ฟังก์ชันที่แตกออกมาจาก updateTable() เดิม (เขียนหัวฟังก์ชันใหม่ ส่วน body ย้ายมาตรง ๆ) =====
function renderTypeTab() {
  const container = document.getElementById('tableContainer');
  syncSettingsSubTabUI();

  let rowsHtml = '';
  ditchTypeDatabase.forEach((item, idx) => {
    // VU1–VU5: ไม่มีปุ่ม · VU6 (แถวสุดท้ายของ VU): มีแค่ + · แถวที่เพิ่มมาทีหลัง: มี + และ -
    let isUserAdded = item._userAdded === true;
    let isLast = (idx === ditchTypeDatabase.length - 1);
    let actionBtn = '';
    if (isUserAdded) {
      actionBtn = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="เพิ่ม Type ใหม่" onclick="addDitchTypeRow()" tabindex="-1">+</button>
          <button class="btn-row-del" title="ลบแถวนี้" onclick="deleteDitchTypeRow(${idx})" tabindex="-1">-</button>
        </div>
      `;
    } else if (isLast) {
      actionBtn = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="เพิ่ม Type ใหม่" onclick="addDitchTypeRow()" tabindex="-1">+</button>
        </div>
      `;
    }

    rowsHtml += `
      <tr>
        <td>
          <div class="cell-flex-row">
            <input type="text" class="table-input" value="${escapeHtml(item.type)}" onchange="updateDitchTypeField(${idx}, 'type', this.value)">
            ${actionBtn}
          </div>
        </td>
        <td><input type="number" step="0.01" class="table-input" value="${escapeHtml(item.b.toFixed(2))}" onchange="updateDitchTypeField(${idx}, 'b', this.value)"></td>
        <td><input type="number" step="0.01" class="table-input" value="${escapeHtml(item.h.toFixed(2))}" onchange="updateDitchTypeField(${idx}, 'h', this.value)"></td>
        <td><input type="number" step="0.01" class="table-input" value="${escapeHtml(getDitchTypeThickness(item, 'tw').toFixed(2))}" onchange="updateDitchTypeField(${idx}, 'tw', this.value)"></td>
        <td><input type="number" step="0.01" class="table-input" value="${escapeHtml(getDitchTypeThickness(item, 'tf').toFixed(2))}" onchange="updateDitchTypeField(${idx}, 'tf', this.value)"></td>
      </tr>
    `;
  });

  const tableHtml = `
    <table class="type-table">
      <thead>
        <tr>
          <th style="min-width: 120px;">Type</th>
          <th style="min-width: 100px;">B (ม.)</th>
          <th style="min-width: 100px;">H (ม.)</th>
          <th style="min-width: 150px;">ความหนากำแพง (ม.)</th>
          <th style="min-width: 140px;">ความหนาพื้น (ม.)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
  if (container) container.innerHTML = tableHtml;
  const structCalcContainer = document.getElementById('structureCalcTableContainer');
  if (structCalcContainer && (typeof structureCalcActiveTab === 'undefined' || structureCalcActiveTab === 'setting-type')) {
    structCalcContainer.innerHTML = tableHtml;
  }
}

// ===== แท็บย่อย "Typeอาคารประกอบ" =====
// แต่ละแถวเก็บ 5 ฟิลด์ (type / h / pipeDia / length / remark) + ธงว่า "ช่องไหนแก้ไขได้"
// structureTypeDBMeta: จำว่า "ชื่อไหนผู้ใช้เพิ่มเอง" เพื่อให้แสดงปุ่ม + - เฉพาะแถวที่เพิ่ม
let structureTypeDBMeta = {};
let structureTypeAddedCounter = 0;

function isStructureTypeUserAdded(name) {
  return !!(structureTypeDBMeta[name] && structureTypeDBMeta[name].userAdded);
}

function isStructureTypeDuplicate(name) {
  return structureTypeDatabase.filter(t => t && t.type === name).length > 1;
}

function addStructureTypeRow() {
  structureTypeAddedCounter++;
  let newName = "อาคารใหม่" + (structureTypeAddedCounter > 1 ? structureTypeAddedCounter : "");
  while (structureTypeDatabase.some(t => t && t.type === newName)) {
    structureTypeAddedCounter++;
    newName = "อาคารใหม่" + structureTypeAddedCounter;
  }
  // แถวที่ผู้ใช้เพิ่มใหม่: ทุกช่องแก้ไขได้ และใส่ "-" ได้
  structureTypeDatabase.push({
    type: newName,
    h: "0.00", hEditable: true,
    pipeDia: "0.30", diaEditable: true,
    length: "5.00", lenEditable: true,
    remark: "", remarkEditable: true,
    up: "TypeNow", down: "TypeNow"
  });
  structureTypeDBMeta[newName] = { userAdded: true };
  updateTable();
}

function deleteStructureTypeRow(idx) {
  let entry = structureTypeDatabase[idx];
  if (!(structureTypeDatabase.length > 1 && entry && isStructureTypeUserAdded(entry.type))) return;
  confirmDelete(`ต้องการลบ Type อาคารประกอบ "${entry.type}" ใช่หรือไม่?`, function () { doDeleteStructureTypeRow(idx); });
}

function doDeleteStructureTypeRow(idx) {
  let entry = structureTypeDatabase[idx];
  if (structureTypeDatabase.length > 1 && entry && isStructureTypeUserAdded(entry.type)) {
    delete structureTypeDBMeta[entry.type];
    structureTypeDatabase.splice(idx, 1);
    updateTable();
  }
}

// แก้ชื่อ Type อาคาร (ย้ายธง meta ตามชื่อใหม่) — ฟิลด์อื่นแก้จาก renderSettingsStructureTab()
function updateStructureTypeField(idx, val) {
  let entry = structureTypeDatabase[idx];
  if (entry) {
    let oldName = entry.type;
    if (isStructureTypeUserAdded(entry.type)) {
      delete structureTypeDBMeta[entry.type];
      if (!isStructureTypeDuplicate(val)) structureTypeDBMeta[val] = { userAdded: true };
    }
    entry.type = val;
    // ⚠️ แถวในแท็บอาคารประกอบอ้างประเภทอาคาร "ด้วยชื่อ" → เปลี่ยนชื่อ Type แล้วต้องเปลี่ยนตาม
    //    ไม่งั้นแถวเดิมจะหาประเภทไม่เจอ → ช่อง H/ศก. ท่อ/ความยาว กลายเป็นว่างและชื่ออาคารเพี้ยน
    if (oldName && oldName !== val) {
      structureRowsData.forEach(r => { if (r.name === oldName) r.name = val; });
    }
  }
  updateTable();
}

// แก้ค่าในช่อง H / ศก. ท่อ / ความยาว / หมายเหตุ ของตาราง Typeอาคารประกอบ
// รับได้ทั้งตัวเลขและ "-" (ใส่ "-" = ไม่มีค่า / ไม่ต้องเอาไปรวมในชื่ออาคารประกอบ)
function updateStructureTypeValue(idx, field, val) {
  let entry = structureTypeDatabase[idx];
  if (!entry) return;
  let raw = String(val === undefined || val === null ? "" : val).trim();

  if (field === "up" || field === "down") {
    entry[field] = raw === "" ? "-" : raw;
  } else if (raw === "" || raw === "-") {
    entry[field] = raw;                       // เก็บ "-" ไว้ตามที่ผู้ใช้พิมพ์
  } else {
    let num = parseFloat(raw);
    entry[field] = isNaN(num) ? raw : Number(num).toFixed(2);
  }
  updateTable();
}

function renderSettingsStructureTab() {
  const container = document.getElementById('tableContainer');
  syncSettingsSubTabUI();

  // สร้างช่องกรอก 1 ช่อง: แก้ไขได้ = ไฮเดลาส editable (เขียว) / ล็อก = พื้นเทา readonly
  const makeCell = (idx, field, editable, val, extraAttrs) => {
    if (editable) {
      return `<input type="text" class="table-input editable" data-row="${idx}" data-col="${extraAttrs.col}" data-field="${field}" value="${escapeHtml(val)}" placeholder="0.00" onchange="updateStructureTypeValue(${idx}, '${field}', this.value)">`;
    }
    return `<input type="text" class="table-input locked" data-row="${idx}" data-col="${extraAttrs.col}" value="${val === "" ? "-" : escapeHtml(val)}" readonly>`;
  };

  let rowsHtml = '';
  structureTypeDatabase.forEach((entry, idx) => {
    let entryName = (entry && entry.type) ? entry.type : "";
    // แถวสุดท้ายของชุดเดิม: มีแค่ + · แถวอื่น ๆ: ไม่มีปุ่ม · แถวที่เพิ่มมาทีหลัง: มี + และ -
    let isUserAdded = isStructureTypeUserAdded(entryName);
    let isLast = (idx === structureTypeDatabase.length - 1);
    let actionBtn = '';
    if (isUserAdded) {
      actionBtn = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="เพิ่ม Type ใหม่" onclick="addStructureTypeRow()" tabindex="-1">+</button>
          <button class="btn-row-del" title="ลบแถวนี้" onclick="deleteStructureTypeRow(${idx})" tabindex="-1">-</button>
        </div>
      `;
    } else if (isLast) {
      actionBtn = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="เพิ่ม Type ใหม่" onclick="addStructureTypeRow()" tabindex="-1">+</button>
        </div>
      `;
    }

    let hCell = makeCell(idx, 'h', entry.hEditable === true, entry.h || "", { col: 1 });
    let diaCell = makeCell(idx, 'pipeDia', entry.diaEditable === true, entry.pipeDia || "", { col: 2 });
    let lenCell = makeCell(idx, 'length', entry.lenEditable === true, entry.length || "", { col: 3 });
    let remarkCell = entry.remarkEditable === true
      ? `<input type="text" class="table-input editable" data-row="${idx}" data-col="4" data-field="remark" value="${escapeHtml(entry.remark || "")}" placeholder="ใส่ชื่อคูซอย" onchange="updateStructureTypeValue(${idx}, 'remark', this.value)">`
      : `<input type="text" class="table-input locked" data-row="${idx}" data-col="4" value="-" readonly>`;

    // คอลัมน์ที่ 6: ชื่ออาคารประกอบ (คำนวณอัตโนมัติจาก ประเภทอาคาร + H + ศก. ท่อ + ความยาว)
    let composedName = computeStructureTypeName(entry);
    let composedCell = `<input type="text" class="table-input locked" id="structTypeName_${idx}" data-row="${idx}" data-col="5" value="${escapeHtml(composedName)}" readonly title="คำนวณอัตโนมัติจาก ประเภทอาคาร + H + ศก. ท่อ + ความยาว">`;

    // คอลัมน์ที่ 7–8 (UP / DOWN): กฎการดึง Type คูส่งน้ำของอาคารแต่ละประเภท
    let upVal = (entry.up !== undefined && entry.up !== null && String(entry.up).trim() !== "") ? String(entry.up).trim() : "-";
    let downVal = (entry.down !== undefined && entry.down !== null && String(entry.down).trim() !== "") ? String(entry.down).trim() : "-";
    let upCell = `<input type="text" class="table-input locked" data-row="${idx}" data-col="6" data-field="up" value="${escapeHtml(upVal)}" readonly title="กฎค่า Type คูส่งน้ำด้านเหนือน้ำ (UP)">`;
    let downCell = `<input type="text" class="table-input locked" data-row="${idx}" data-col="7" data-field="down" value="${escapeHtml(downVal)}" readonly title="กฎค่า Type คูส่งน้ำด้านท้ายน้ำ (DOWN)">`;

    rowsHtml += `
      <tr>
        <td>
          <div class="cell-flex-row">
            <input type="text" class="table-input" data-row="${idx}" data-col="0" data-field="type" value="${escapeHtml(entryName)}" onchange="updateStructureTypeField(${idx}, this.value)">
            ${actionBtn}
          </div>
        </td>
        <td>${hCell}</td>
        <td>${diaCell}</td>
        <td>${lenCell}</td>
        <td>${remarkCell}</td>
        <td>${composedCell}</td>
        <td>${upCell}</td>
        <td>${downCell}</td>
      </tr>
    `;
  });

  const tableHtml = `
    <table class="type-table">
      <thead>
        <tr>
          <th style="min-width: 240px;">ประเภทอาคาร</th>
          <th style="min-width: 90px;">H (ม.)</th>
          <th style="min-width: 110px;">ศก. ท่อ (ม.)</th>
          <th style="min-width: 120px;">ความยาว (ม.)</th>
          <th style="min-width: 140px;">หมายเหตุ</th>
          <th style="min-width: 320px;">ชื่ออาคารประกอบ</th>
          <th style="min-width: 100px;">UP</th>
          <th style="min-width: 100px;">DOWN</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
  if (container) container.innerHTML = tableHtml;
  const structCalcContainer = document.getElementById('structureCalcTableContainer');
  if (structCalcContainer && typeof structureCalcActiveTab !== 'undefined' && structureCalcActiveTab === 'setting-structure') {
    structCalcContainer.innerHTML = tableHtml;
  }
}

// ===== รอบ 52: หน้าเมนูย่อย "ส่วนอาคารประกอบ" (ย้ายแท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ มาไว้ที่เมนูแท็บซ้ายมือ ย่อ-ขยายได้) =====
let structureCalcActiveTab = 'setting-type';
let structureCalcSidebarCollapsed = false;

function toggleStructureCalcSidebar(ev, forceCollapsed) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const sidebar = document.getElementById('structureCalcSidebar');
  const btn = document.getElementById('btnToggleStructureCalcSidebar');
  const nextState = (typeof forceCollapsed === 'boolean') ? forceCollapsed : !structureCalcSidebarCollapsed;
  structureCalcSidebarCollapsed = nextState;
  if (sidebar) sidebar.classList.toggle('collapsed', structureCalcSidebarCollapsed);
  if (btn) {
    btn.textContent = structureCalcSidebarCollapsed ? '▶' : '◀';
    btn.title = structureCalcSidebarCollapsed ? 'ขยายเมนูแท็บซ้ายมือ' : 'ย่อเมนูแท็บซ้ายมือ';
  }
}

function switchStructureCalcTab(subName) {
  if (subName !== 'setting-type' && subName !== 'setting-structure') subName = 'setting-type';
  structureCalcActiveTab = subName;
  currentTab = subName;
  settingsSubTab = (subName === 'setting-structure') ? 'structure' : 'type';

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

