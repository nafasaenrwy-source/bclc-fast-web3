// ===== js/tab-ditch.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บ "ระบบคูส่งน้ำ"
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function copyDownToNextRow(chIdx) {
  syncTableInputsToChannels();
  if (chIdx < channels.length - 1) {
    channels[chIdx + 1].canal = channels[chIdx].canal;
    updateTable();
  }
}

function addChannelAt(index) {
  syncTableInputsToChannels();
  // เฟส 1: id ใหม่เป็นเลขคงที่ (ไม่ใช่ length+1 ที่อาจชนกันหลังลบ-เพิ่ม) → แถวผูกกับ id นี้ ไม่ต้องเลื่อน index
  let newId = generateChannelId();
  let prevCanal = channels[index] ? channels[index].canal : "คลอง";

  let newChan = {
    id: newId,
    canal: prevCanal,
    ditch: "-", 
    totalArea: "",
    waterArea: "",
    collapsed: false,
    rows: [createDefaultRow("", "")]
  };

  channels.splice(index + 1, 0, newChan);
  // ไม่ต้องเลื่อน channelIdx ของทุกแท็บอีกต่อไป (ข้อมูลผูกด้วย channelId คงที่)
  syncDimensionRowsWithChannels();
  updateTable();
}

function deleteChannelAt(index) {
  // ลบคู = ลบข้อมูลของคูนั้นในทุกแท็บ (มิติ · ระดับ · ดินเดิม · อาคารประกอบ · อาคารท่อรับน้ำ) → ต้องยืนยันก่อน
  let ditchName = channels[index] ? (channels[index].ditch || '-') : '-';
  let message = (channels.length > 1)
    ? `ต้องการลบคูส่งน้ำ "${ditchName}" ใช่หรือไม่?\n(ข้อมูลของคูนี้ในทุกแท็บจะถูกลบไปด้วย และกู้คืนไม่ได้)`
    : `ต้องการล้างข้อมูลคูส่งน้ำนี้ใช่หรือไม่?\n(เหลือคูเดียวในระบบ — ข้อมูลในทุกแท็บของคูนี้จะถูกล้าง)`;
  confirmDelete(message, function () { doDeleteChannelAt(index); }, 'ลบ');
}

function doDeleteChannelAt(index) {
  syncTableInputsToChannels();
  if (channels.length > 1) {
    let deletedId = channels[index] ? channels[index].id : null;
    channels.splice(index, 1);
    if (getChannelIndexById(activeChannelId) === -1) {
      activeChannelId = channels[0] ? channels[0].id : 0;
    }
    if (deletedId !== null) {
      dimensionRows = dimensionRows.filter(d => d.channelId !== deletedId);
      levelRowsData = levelRowsData.filter(l => l.channelId !== deletedId);
      groundRowsData = groundRowsData.filter(g => g.channelId !== deletedId);
      structureRowsData = structureRowsData.filter(s => s.channelId !== deletedId);
      attachmentRowsData = attachmentRowsData.filter(a => a.channelId !== deletedId);
    }
  } else {
    // ลบคูสุดท้าย (เหลือคูเดียว) → ข้อความยืนยันบอกว่า "ล้างข้อมูลทุกแท็บ" ต้องล้างจริง
    // เดิมล้างแค่ตัวคู แต่ทิ้งข้อมูลมิติ/ระดับ/ดินเดิม/อาคาร/ท่อรับน้ำค้างไว้ (ขัดกับที่แจ้งผู้ใช้)
    channels[0] = {
      id: channels[0].id, canal: "คลอง", ditch: "-", totalArea: "", waterArea: "",
      collapsed: false, rows: [createDefaultRow("", "")]
    };
    dimensionRows = [];
    levelRowsData = [];
    groundRowsData = [];
    structureRowsData = [];
    attachmentRowsData = [];
    levelGroupState = {};
    groundGroupState = {};
    structureGroupState = {};
    attachmentGroupState = {};
  }
  syncDimensionRowsWithChannels();
  updateTable();
}

// เปรียบเทียบชื่อคูส่งน้ำตามลำดับชั้น: 01 < 02 < 03 < 03-1 < 03-1-1 < 03-2 < 04
function compareDitchCodeHierarchical(a, b) {
  const strA = String(a === undefined || a === null ? "" : a).trim();
  const strB = String(b === undefined || b === null ? "" : b).trim();
  if (strA === strB) return 0;
  const emptyA = (strA === "" || strA === "-");
  const emptyB = (strB === "" || strB === "-");
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const partsA = strA.split(/[-/.]+/).filter(Boolean);
  const partsB = strB.split(/[-/.]+/).filter(Boolean);
  const len = Math.min(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const segA = partsA[i];
    const segB = partsB[i];
    const numA = /^-?\d+(\.\d+)?$/.test(segA) ? parseFloat(segA) : NaN;
    const numB = /^-?\d+(\.\d+)?$/.test(segB) ? parseFloat(segB) : NaN;
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = segA.localeCompare(segB, 'th');
      if (cmp !== 0) return cmp;
    }
  }
  return partsA.length - partsB.length;
}

// รอบ 41: คำนวณ "ช่วงคูน้ำ" (ลำดับช่วง 1, 2, 3 ... ของคูส่งน้ำที่แยกไว้)
//   ใช้ในแท็บระดับดินเดิม / ระดับคูส่งน้ำ / อาคารประกอบ
//   คืนค่าเป็นเลขลำดับช่วงของ "คูส่งน้ำ" ที่แยกไว้ในแท็บระบบคูส่งน้ำ
//   (ถ้าไม่พบชื่อคู → คืนค่า "" ให้ช่องว่าง)
function getDitchSectionIndex(channelId, rowObj) {
  // รอบ 48: หากแถวมีค่า "ช่วงคูน้ำ" (ditchSection) จากไฟล์นำเข้า ให้แสดงค่าตามไฟล์นำเข้าตรงกันทุกแถว
  if (rowObj && typeof rowObj === 'object') {
    if (rowObj.ditchSection !== undefined && rowObj.ditchSection !== null && String(rowObj.ditchSection).trim() !== '') {
      const rawSec = String(rowObj.ditchSection).trim();
      return /^-?\d+$/.test(rawSec) ? Number(rawSec) : rawSec;
    }
    // ถ้าคูส่งน้ำนี้ถูกแบ่งเป็นหลายช่วงในแท็บระดับคูส่งน้ำ ให้คำนวณช่วงย่อย (1, 2, 3...) ภายในคูส่งน้ำ
    if (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) {
      const chanLvls = levelRowsData.filter(l => l && Number(l.channelId) === Number(channelId));
      if (chanLvls.length > 1) {
        const lvlPos = chanLvls.indexOf(rowObj);
        if (lvlPos >= 0) return lvlPos + 1;
        if (rowObj.km !== undefined && rowObj.km !== null && String(rowObj.km).trim() !== '' && !isNaN(parseFloat(rowObj.km))) {
          const kmNum = parseFloat(rowObj.km);
          if (rowObj.isFromLevel) {
            for (let i = 1; i < chanLvls.length; i++) {
              const kStart = parseFloat(chanLvls[i].customKmStart);
              if (!isNaN(kStart) && Math.abs(kmNum - kStart) < 0.001) return i + 1;
            }
          }
          for (let i = 0; i < chanLvls.length; i++) {
            const k1 = (chanLvls[i].customKmStart !== undefined && chanLvls[i].customKmStart !== '') ? parseFloat(chanLvls[i].customKmStart) : 0;
            const k2 = (chanLvls[i].customKmEnd !== undefined && chanLvls[i].customKmEnd !== '') ? parseFloat(chanLvls[i].customKmEnd) : Infinity;
            if (kmNum >= (isNaN(k1) ? 0 : k1) - 0.001 && kmNum <= (isNaN(k2) ? Infinity : k2) + 0.001) {
              return i + 1;
            }
          }
          return chanLvls.length;
        }
        if (typeof attachmentRowsData !== 'undefined' && Array.isArray(attachmentRowsData)) {
          const chanAtts = attachmentRowsData.filter(a => a && Number(a.channelId) === Number(channelId));
          const attPos = chanAtts.indexOf(rowObj);
          if (attPos >= 0 && chanAtts.length > 1) {
            return Math.min(attPos + 1, chanLvls.length);
          }
        }
      }
    }
  }

  const list = (typeof channels !== 'undefined' && Array.isArray(channels)) ? channels : [];
  // หาชื่อคูส่งน้ำของ channelId
  const target = list.find(ch => ch && Number(ch.id) === Number(channelId));
  if (!target) return '';
  const canal = String(target.canal || '').trim();
  const ditch = String(target.ditch || '').trim();
  if (!ditch || ditch === '-') return '';

  // นับลำดับช่วงของคูส่งน้ำที่แยกไว้ (ตามลำดับในแท็บระบบคูส่งน้ำ)
  //   - นับเฉพาะคูที่ "แยกไว้" (มีชื่อคูจริง) และเรียงตามลำดับช่อง
  const named = list.filter(ch => {
    const d = String(ch && ch.ditch !== undefined ? ch.ditch : '').trim();
    return d !== '' && d !== '-';
  });
  // จัดกลุ่มตามคลองส่งน้ำ → นับลำดับภายในคลองเดียวกัน
  const seqByCanal = {};
  let seq = 0;
  let lastCanal = null;
  named.forEach(ch => {
    const c = String(ch.canal || '').trim();
    if (c !== lastCanal) { seq = 0; lastCanal = c; }
    seq += 1;
    if (!seqByCanal[c]) seqByCanal[c] = [];
    seqByCanal[c].push({ id: Number(ch.id), ditch: String(ch.ditch || '').trim(), idx: seq });
  });
  const group = seqByCanal[canal] || [];
  const found = group.find(g => g.id === Number(channelId)) || group.find(g => g.ditch === ditch);
  return found ? found.idx : '';
}

// รอบ 41 / รอบ 48: ค่า "ช่วงคูน้ำ" สำหรับแสดงในตาราง (รองรับทั้งค่าจากไฟล์นำเข้าและคำนวณอัตโนมัติ)
function getDitchSectionHtml(channelId, rowObj) {
  const idx = getDitchSectionIndex(channelId, rowObj);
  if (idx === '' || idx === null || idx === undefined) {
    return `<span style="color:#adb5bd;">-</span>`;
  }
  return `<span class="ditch-section-index" title="ช่วงคูน้ำลำดับที่ ${idx}">${idx}</span>`;
}

// จัดเรียงแถวของทุกแท็บให้เรียงตามลำดับของ channels ปัจจุบันเสมอ
function reorderAllTabsByChannelOrder() {
  const orderMap = {};
  channels.forEach((ch, idx) => {
    if (ch && ch.id !== undefined) orderMap[ch.id] = idx;
  });
  const sortByChOrder = (arr) => {
    const grouped = [];
    channels.forEach(ch => {
      arr.forEach(r => {
        if (r && r.channelId === ch.id) grouped.push(r);
      });
    });
    // เผื่อมีแถวที่ไม่อยู่ใน channels
    arr.forEach(r => {
      if (r && orderMap[r.channelId] === undefined) grouped.push(r);
    });
    return grouped;
  };
  dimensionRows = sortByChOrder(dimensionRows);
  levelRowsData = sortByChOrder(levelRowsData);
  groundRowsData = sortByChOrder(groundRowsData);
  structureRowsData = sortByChOrder(structureRowsData);
  attachmentRowsData = sortByChOrder(attachmentRowsData);
}

// เลื่อนแถวคูส่งน้ำขึ้น (-1) หรือลง (+1) ตามลูกศรในรูปที่ 3
function moveChannelRow(chIdx, dir) {
  syncTableInputsToChannels();
  const targetIdx = chIdx + dir;
  if (chIdx < 0 || chIdx >= channels.length || targetIdx < 0 || targetIdx >= channels.length) return;
  const tmp = channels[chIdx];
  channels[chIdx] = channels[targetIdx];
  channels[targetIdx] = tmp;
  reorderAllTabsByChannelOrder();
  updateTable();
}

// จัดเรียงคูส่งน้ำตามรหัสคูน้ำ (01 / 02 / 03 / 03-1 / 03-1-1 / 03-2 / 04) เฉพาะแถวที่ระบุชื่อคูแล้ว
function sortChannelsByDitchOrder() {
  if (channels.length <= 1) return;
  // แยกการเรียงเฉพาะแถวที่มีชื่อคูจริง (ไม่ใช่ "-") เพื่อไม่ให้แถวว่างที่เพิ่งกด + กระโดดผิดที่
  const validIndices = [];
  const validChans = [];
  channels.forEach((ch, idx) => {
    const d = String(ch && ch.ditch !== undefined ? ch.ditch : "").trim();
    if (d !== "" && d !== "-") {
      validIndices.push(idx);
      validChans.push(ch);
    }
  });
  if (validChans.length <= 1) return;
  const canalOrder = new Map();
  validChans.forEach((ch, idx) => {
    const c = String(ch.canal || "").trim();
    if (!canalOrder.has(c)) canalOrder.set(c, idx);
  });
  validChans.sort((a, b) => {
    const canalA = String(a.canal || "").trim();
    const canalB = String(b.canal || "").trim();
    if (canalA !== canalB) return (canalOrder.get(canalA) || 0) - (canalOrder.get(canalB) || 0);
    return compareDitchCodeHierarchical(a.ditch, b.ditch);
  });
  validIndices.forEach((origIdx, i) => {
    channels[origIdx] = validChans[i];
  });
  reorderAllTabsByChannelOrder();
}

function updateChannelField(chIdx, field, val) {
  if (channels[chIdx]) {
    channels[chIdx][field] = val;
    if (field === 'ditch' && val && String(val).trim() !== '-') {
      sortChannelsByDitchOrder();
    }
    updateTable();
  }
}

// ===== ฟังก์ชันที่แตกออกมาจาก updateTable() เดิม (เขียนหัวฟังก์ชันใหม่ ส่วน body ย้ายมาตรง ๆ) =====
function renderDitchTab() {
  const container = document.getElementById('tableContainer');

  let sumTotalArea = 0;
  let sumWaterArea = 0;
  let canalSet = new Set();

  let rowsHtml = '';
  channels.forEach((ch, chIdx) => {
    let valCanal = ch.canal !== undefined ? ch.canal : "คลอง";
    let valDitch = ch.ditch !== undefined ? ch.ditch : "-";
    let valTotalArea = ch.totalArea !== undefined ? ch.totalArea : "";
    let valWaterArea = ch.waterArea !== undefined ? ch.waterArea : "";

    if (valCanal && valCanal.trim() !== "") canalSet.add(valCanal.trim());
    let numTotal = parseFloat(valTotalArea);
    if (!isNaN(numTotal)) sumTotalArea += numTotal;
    let numWater = parseFloat(valWaterArea);
    if (!isNaN(numWater)) sumWaterArea += numWater;

    let isFirstRow = (chIdx === 0);
    let isLastRow = (chIdx === channels.length - 1);
    let moveBtnsHtml = `
      <div class="ditch-move-btn-group">
        <button type="button" class="btn-move-row" onclick="moveChannelRow(${chIdx}, -1)" ${isFirstRow ? 'disabled' : ''} title="เลื่อนแถวขึ้น" tabindex="-1">↑</button>
        <button type="button" class="btn-move-row" onclick="moveChannelRow(${chIdx}, 1)" ${isLastRow ? 'disabled' : ''} title="เลื่อนแถวลง" tabindex="-1">↓</button>
      </div>
    `;
    let copyBtnHtml = !isLastRow 
      ? `<button class="btn-down-arrow" onclick="copyDownToNextRow(${chIdx})" title="คัดลอกลงแถวล่าง" tabindex="-1">↓</button>` 
      : '';

    rowsHtml += `
      <tr>
        <td>
          <div class="cell-flex-row">
            ${moveBtnsHtml}
            <input type="text" class="table-input" data-ch="${chIdx}" data-row="${chIdx}" data-col="0" value="${escapeHtml(valCanal)}" placeholder="คลอง" onchange="updateChannelField(${chIdx}, 'canal', this.value);">
            ${copyBtnHtml}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="text" class="table-input" data-ch="${chIdx}" data-row="${chIdx}" data-col="1" value="${escapeHtml(valDitch)}" placeholder="-" onchange="updateChannelField(${chIdx}, 'ditch', this.value);">
            <div class="km-btn-group">
              <button class="btn-row-add" title="แทรกแถวด้านล่าง" onclick="addChannelAt(${chIdx})" tabindex="-1">+</button>
              ${channels.length > 1 ? `<button class="btn-row-del" title="ลบแถวนี้" onclick="deleteChannelAt(${chIdx})" tabindex="-1">-</button>` : ''}
            </div>
          </div>
        </td>
        <td>
          <input type="number" class="table-input" data-ch="${chIdx}" data-row="${chIdx}" data-col="2" value="${escapeHtml(valTotalArea)}" placeholder="0.00" step="0.01" onchange="updateChannelField(${chIdx}, 'totalArea', this.value);">
        </td>
        <td>
          <input type="number" class="table-input" data-ch="${chIdx}" data-row="${chIdx}" data-col="3" value="${escapeHtml(valWaterArea)}" placeholder="0.00" step="0.01" onchange="updateChannelField(${chIdx}, 'waterArea', this.value);">
        </td>
      </tr>
    `;
  });

  let countCanals = canalSet.size;
  let countDitches = channels.length;

  container.innerHTML = `
    <table class="ditch-system-table">
      <thead>
        <tr>
          <th style="min-width: 170px;">คลองส่งน้ำ</th>
          <th style="min-width: 170px;">คูส่งน้ำ</th>
          <th style="min-width: 150px;">พื้นที่ทั้งหมด (ไร่)</th>
          <th style="min-width: 150px;">พื้นที่ส่งน้ำ (ไร่)</th>
        </tr>
      </thead>
      <tbody id="dataTable">
        ${rowsHtml}
        <tr class="summary-row">
          <td>จำนวน ${countCanals} สาย</td>
          <td>จำนวน ${countDitches} คู</td>
          <td>รวม ${sumTotalArea.toFixed(2)} ไร่</td>
          <td>รวม ${sumWaterArea.toFixed(2)} ไร่</td>
        </tr>
      </tbody>
    </table>
  `;
}
