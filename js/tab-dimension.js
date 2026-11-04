// ===== js/tab-dimension.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บ "มิติคูส่งน้ำ"
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function copyDownDimensionField(rIdx, field) {
  syncTableInputsToChannels();
  if (rIdx < dimensionRows.length - 1) {
    dimensionRows[rIdx + 1][field] = dimensionRows[rIdx][field];
    updateTable();
  }
}

function addDimensionRowAt(index) {
  syncTableInputsToChannels();
  let prev = dimensionRows[index] || {};
  let copiedKmStart = (prev.kmEnd !== "" && prev.kmEnd !== undefined) ? prev.kmEnd : 0;

  let newRow = {
    channelId: prev.channelId !== undefined ? prev.channelId : (channels[0] ? channels[0].id : 1),
    kmStart: copiedKmStart,
    kmEnd: "",
    q: prev.q !== undefined ? prev.q : 0.030,
    slope: prev.slope !== undefined ? prev.slope : 4000,
    b: prev.b !== undefined ? prev.b : 0.35,
    d: prev.d !== undefined ? prev.d : 0.36,
    type: prev.type || "VU1",
    tbl: prev.tbl !== undefined ? prev.tbl : 0.50,
    tbr: prev.tbr !== undefined ? prev.tbr : 0.50
  };
  dimensionRows.splice(index + 1, 0, newRow);
  enforceLevelLastKmEnd();
  syncGroundRowsWithDimensions();
  syncStructureRowsWithLevel();
  updateTable();
}

function deleteDimensionRowAt(index) {
  confirmDelete('ต้องการลบแถวช่วง กม. นี้ใช่หรือไม่?', function () { doDeleteDimensionRowAt(index); });
}

function doDeleteDimensionRowAt(index) {
  syncTableInputsToChannels();
  if (dimensionRows.length > 1) {
    dimensionRows.splice(index, 1);
  }
  enforceLevelLastKmEnd();
  syncGroundRowsWithDimensions();
  syncStructureRowsWithLevel();
  updateTable();
}

// ===== รอบ 43: ขอบเขตพารามิเตอร์คูส่งน้ำ (แก้บั๊ก #3 ของเวบแนบ) =====
//   เวบแนบประกาศ min/max ในช่องกรอก แต่ JS ไม่เคยตรวจ → ผู้ใช้พิมพ์ค่าเกินได้แล้วคำนวณจริง
//   ในเวบ2 พารามิเตอร์มาจาก "แท็บมิติคูส่งน้ำ" (ผู้ใช้กรอกเอง) → ต้องบังคังขอบเขตที่นี่
const DIM_PARAM_LIMITS = {
  b:   { min: 0.10, max: 10.00, label: 'ความกว้างก้นคลอง (B)' },
  d:   { min: 0.10, max: 10.00, label: 'ความลึกคลอง (H)' },
  tbl: { min: 0.10, max: 10.00, label: 'คันคลองฝั่งซ้าย (TBL)' },
  tbr: { min: 0.10, max: 10.00, label: 'คันคลองฝั่งขวา (TBR)' }
};

// คืนค่าที่อยู่ในขอบเขต หรือ null ถ้าเกินขอบเขต
function checkDimensionParamRange(field, val) {
  const lim = DIM_PARAM_LIMITS[field];
  if (!lim) return { ok: true, value: val };
  const num = parseFloat(val);
  if (isNaN(num)) return { ok: false, value: val, msg: `${lim.label} ต้องเป็นตัวเลข` };
  if (num < lim.min || num > lim.max) {
    return {
      ok: false, value: num,
      msg: `${lim.label} ต้องอยู่ระหว่าง ${lim.min.toFixed(2)} ถึง ${lim.max.toFixed(2)} เมตร (ค่าที่กรอก: ${num})`
    };
  }
  return { ok: true, value: num };
}

function updateDimensionField(rIdx, field, val) {
  if (dimensionRows[rIdx]) {
    if (field === 'kmStart' || field === 'kmEnd') {
      dimensionRows[rIdx][field] = parseKmInput(val);
    } else if (['q', 'slope', 'b', 'd', 'tbl', 'tbr'].includes(field)) {
      let num = parseFloat(val);
      // รอบ 43: บังคับขอบเขตพารามิเตอร์ (แก้บั๊ก #3) — ปฏิเสธค่าที่เกินขอบเขตและแจ้งผู้ใช้
      if (!isNaN(num)) {
        const chk = checkDimensionParamRange(field, num);
        if (!chk.ok) {
          alert('ข้อผิดพลาด: ' + chk.msg);
          updateTable();
          return;
        }
      }
      dimensionRows[rIdx][field] = isNaN(num) ? "" : num;
    } else {
      dimensionRows[rIdx][field] = val;
      if (field === 'type' && typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) {
        let firstLvl = levelRowsData.find(l => l && l.channelId === dimensionRows[rIdx].channelId && !l.isDynamicRow);
        if (firstLvl) firstLvl.customType = val;
      }
    }
    enforceLevelLastKmEnd();
    syncGroundRowsWithDimensions();
    syncStructureRowsWithLevel();
    updateTable();
  }
}

// ===== ฟังก์ชันที่แตกออกมาจาก updateTable() เดิม (เขียนหัวฟังก์ชันใหม่ ส่วน body ย้ายมาตรง ๆ) =====
function renderDimensionTab() {
  const container = document.getElementById('tableContainer');

  syncDimensionRowsWithChannels();
  let rowsHtml = '';
  let opts = getDitchTypeOptions();
  let lastChannelId = -1;

  dimensionRows.forEach((r, rIdx) => {
    let chObj = getChannelById(r.channelId) || { canal: "คลอง", ditch: "-" };
    let canalName = chObj.canal;
    let ditchName = chObj.ditch;

    let isFirstOfGroup = (r.channelId !== lastChannelId);
    lastChannelId = r.channelId;

    let isLastRow = (rIdx === dimensionRows.length - 1);
    const makeDownBtn = (field) => {
      return !isLastRow ? `<button class="btn-down-arrow" onclick="copyDownDimensionField(${rIdx}, '${field}')" title="คัดลอกลงแถวล่าง" tabindex="-1">↓</button>` : '';
    };

    // R5: TYPE ต้องใช้ data-col="8" (เดิมเป็น "6" ชนกับช่อง B) ไม่งั้นลูกศรซ้าย-ขวาข้ามช่องผิด
    let typeSelectHtml = `<select class="table-select" data-row="${rIdx}" data-col="8" data-field="type" onchange="updateDimensionField(${rIdx}, 'type', this.value)">`;
    opts.forEach(tp => {
      typeSelectHtml += `<option value="${escapeHtml(tp)}" ${tp === r.type ? 'selected' : ''}>${escapeHtml(tp)}</option>`;
    });
    typeSelectHtml += `</select>`;

    let qFormatted = (r.q !== "" && r.q !== undefined && !isNaN(r.q)) ? Number(r.q).toFixed(3) : "";
    let bFormatted = (r.b !== "" && r.b !== undefined && !isNaN(r.b)) ? Number(r.b).toFixed(2) : "0.35";
    let dFormatted = (r.d !== "" && r.d !== undefined && !isNaN(r.d)) ? Number(r.d).toFixed(2) : "0.36";
    let tblFormatted = (r.tbl !== "" && r.tbl !== undefined && !isNaN(r.tbl)) ? Number(r.tbl).toFixed(2) : "0.50";
    let tbrFormatted = (r.tbr !== "" && r.tbr !== undefined && !isNaN(r.tbr)) ? Number(r.tbr).toFixed(2) : "0.50";

    let sepClass = (isFirstOfGroup && rIdx > 0) ? 'group-separator-row' : '';
    let canalCellContent = `<span style="font-weight: bold;">${escapeHtml(canalName)}</span>`;

    let kmButtonGroup = `
      <div class="km-btn-group">
        <button class="btn-row-add" title="แทรกช่วงด้านล่าง" onclick="addDimensionRowAt(${rIdx})" tabindex="-1">+</button>
        ${!isFirstOfGroup ? `<button class="btn-row-del" title="ลบแถวนี้" onclick="deleteDimensionRowAt(${rIdx})" tabindex="-1">-</button>` : ''}
      </div>
    `;

    let kmStartInputHtml = '';
    if (isFirstOfGroup) {
      if (r.kmStart === "" || r.kmStart === undefined || r.kmStart === null || isNaN(Number(r.kmStart))) {
        r.kmStart = 0;
      }
      kmStartInputHtml = `<input type="text" class="table-input locked" data-row="${rIdx}" data-col="2" data-field="kmStart" value="${escapeHtml(formatKmDisplay(r.kmStart))}" readonly title="ล็อกค่าเริ่มต้นของสาย">`;
    } else {
      kmStartInputHtml = `<input type="text" class="table-input" data-row="${rIdx}" data-col="2" data-field="kmStart" value="${escapeHtml(formatKmDisplay(r.kmStart))}" placeholder="0+000" onchange="updateDimensionField(${rIdx}, 'kmStart', this.value)">`;
    }

    rowsHtml += `
      <tr class="${sepClass}">
        <td>${canalCellContent}</td>
        <td>
          <div class="cell-flex-row" style="position: relative;">
            <span style="flex: 1; text-align: center; font-weight: ${isFirstOfGroup ? 'bold' : 'normal'};">${escapeHtml(ditchName)}</span>
            ${kmButtonGroup}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            ${kmStartInputHtml}
            ${makeDownBtn('kmStart')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="text" class="table-input" data-row="${rIdx}" data-col="3" data-field="kmEnd" value="${escapeHtml(formatKmDisplay(r.kmEnd))}" placeholder="0+000" onchange="updateDimensionField(${rIdx}, 'kmEnd', this.value)">
            ${makeDownBtn('kmEnd')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <div class="combobox-container">
              <input type="text" class="combobox-input" id="qInput_${rIdx}" data-row="${rIdx}" data-col="4" data-field="q" value="${escapeHtml(qFormatted)}" placeholder="0.030" onchange="updateDimensionField(${rIdx}, 'q', this.value)">
              <span class="combobox-arrow">▼</span>
              <select class="combobox-select" tabindex="-1" onchange="updateDimensionField(${rIdx}, 'q', this.value)">
                <option value="" disabled ${qFormatted === "" ? 'selected' : ''}></option>
                ${qOptions.map(q => `<option value="${escapeHtml(q)}" ${Number(q) === Number(r.q) ? 'selected' : ''}>${escapeHtml(q)}</option>`).join('')}
              </select>
            </div>
            ${makeDownBtn('q')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <div class="combobox-container">
              <input type="text" class="combobox-input" id="slopeInput_${rIdx}" data-row="${rIdx}" data-col="5" data-field="slope" value="${escapeHtml(r.slope !== undefined ? r.slope : 4000)}" placeholder="4000" onchange="updateDimensionField(${rIdx}, 'slope', this.value)">
              <span class="combobox-arrow">▼</span>
              <select class="combobox-select" tabindex="-1" onchange="updateDimensionField(${rIdx}, 'slope', this.value)">
                <option value="" disabled ${(r.slope === "" || r.slope === undefined) ? 'selected' : ''}></option>
                ${slopeOptions.map(sl => `<option value="${escapeHtml(sl)}" ${Number(sl) === Number(r.slope) ? 'selected' : ''}>${escapeHtml(sl)}</option>`).join('')}
              </select>
            </div>
            ${makeDownBtn('slope')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" min="${DIM_PARAM_LIMITS.b.min}" max="${DIM_PARAM_LIMITS.b.max}" class="table-input" data-row="${rIdx}" data-col="6" data-field="b" value="${escapeHtml(bFormatted)}" placeholder="0.35" onchange="updateDimensionField(${rIdx}, 'b', this.value)">
            ${makeDownBtn('b')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" min="${DIM_PARAM_LIMITS.d.min}" max="${DIM_PARAM_LIMITS.d.max}" class="table-input" data-row="${rIdx}" data-col="7" data-field="d" value="${escapeHtml(dFormatted)}" placeholder="0.36" onchange="updateDimensionField(${rIdx}, 'd', this.value)">
            ${makeDownBtn('d')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            ${typeSelectHtml}
            ${makeDownBtn('type')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" min="${DIM_PARAM_LIMITS.tbl.min}" max="${DIM_PARAM_LIMITS.tbl.max}" class="table-input" data-row="${rIdx}" data-col="9" data-field="tbl" value="${escapeHtml(tblFormatted)}" placeholder="0.50" onchange="updateDimensionField(${rIdx}, 'tbl', this.value)">
            ${makeDownBtn('tbl')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" min="${DIM_PARAM_LIMITS.tbr.min}" max="${DIM_PARAM_LIMITS.tbr.max}" class="table-input" data-row="${rIdx}" data-col="10" data-field="tbr" value="${escapeHtml(tbrFormatted)}" placeholder="0.50" onchange="updateDimensionField(${rIdx}, 'tbr', this.value)">
            ${makeDownBtn('tbr')}
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="dimension-table">
      <thead>
        <tr>
          <th rowspan="2" style="min-width: 140px;">คลองส่งน้ำ</th>
          <th rowspan="2" style="min-width: 130px;">คูส่งน้ำ</th>
          <th colspan="2" style="min-width: 180px;">ระยะทางเป็น-กม.</th>
          <th rowspan="2" style="min-width: 95px;">Q<br>(ม.³/วินาที)</th>
          <th rowspan="2" style="min-width: 85px;">SLOPE</th>
          <th rowspan="2" style="min-width: 75px;">B<br>(ม.)</th>
          <th rowspan="2" style="min-width: 75px;">D<br>(ม.)</th>
          <th rowspan="2" style="min-width: 85px;">TYPE</th>
          <th rowspan="2" style="min-width: 75px;">TBL<br>(ม.)</th>
          <th rowspan="2" style="min-width: 75px;">TBR<br>(ม.)</th>
        </tr>
        <tr>
          <th style="min-width: 90px;">จาก (กม.เริ่มต้น)</th>
          <th style="min-width: 90px;">ถึง (กม.สิ้นสุด)</th>
        </tr>
      </thead>
      <tbody id="dimensionTableBody">
        ${rowsHtml}
      </tbody>
    </table>
  `;
}
