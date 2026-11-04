// ===== js/tab-ai-result.js =====
// แท็บ "🤖 ผลอ่าน AI" — รอบ 35:
//   - แสดงผลเหมือนตารางจริงในแต่ละแท็บ (ระบบคูส่งน้ำ / มิติคูส่งน้ำ / ระดับดินเดิม + P1,P2 / ระดับคูส่งน้ำ / อาคารประกอบ / ท่อรับน้ำ)
//   - แยกเป็นชุดข้อมูลตามภาพ พร้อมปุ่มย่อ/ขยาย (Collapse/Expand) ของแต่ละชุดข้อมูลที่อ่าน
//   - ไม่แสดงข้อมูลส่วน "ป้ายข้อความในรูปภาพ" ในตาราง
//   - ข้อมูลอาคารที่แยกจาก "และ" หรือ "," แสดงคนละแถว กม. เดียวกัน เรียงตามลำดับในแบบ และใส่ค่า H เฉพาะอาคารที่มีค่า H ตาม Typeอาคารประกอบ

// สถานะการเลือกของแท็บ (เก็บไว้ระหว่างการ render ใหม่)
let aiResultSelection = {
  channels: true,      // นำเข้าชุดข้อมูลคูส่งน้ำ (สร้าง/อัปเดตคู)
  dimension: true,
  ground: true,
  level: true,
  structures: true,
  attachments: true,
  refPoints: true     // นำเข้าจุดอ้างอิง P1/P2
};

// สถานะย่อ/ขยายของแต่ละชุดข้อมูลที่อ่านในแท็บผลอ่าน AI
let aiDatasetCollapsedState = {};

function toggleAiDatasetCardCollapse(cardKey, ev) {
  if (ev && typeof ev.stopPropagation === 'function') {
    ev.stopPropagation();
  }
  if (!cardKey) return;
  aiDatasetCollapsedState[cardKey] = !aiDatasetCollapsedState[cardKey];
  if (typeof renderAiResultTab === 'function') {
    renderAiResultTab(getAiResultsForDisplay());
  }
}

function setAllAiDatasetCardsCollapsed(collapsed) {
  const list = getAiResultsForDisplay();
  list.forEach((res, ri) => {
    const fKey = (res && res.frameId) ? String(res.frameId) : ('frame_' + ri);
    aiDatasetCollapsedState[fKey] = !!collapsed;
    (res && Array.isArray(res.channels) ? res.channels : []).forEach((_, ci) => {
      aiDatasetCollapsedState[fKey + '_ch_' + ci] = !!collapsed;
    });
  });
  if (typeof renderAiResultTab === 'function') {
    renderAiResultTab(list);
  }
}

// รอบ 41: ลบชุดข้อมูลที่ AI อ่านได้ (ชุดนั้น ๆ) — ไม่ลบกรอบรูป ไม่แตะตารางจริง
//   (ยังไม่ได้กด "บันทึก/อัปเดตลงตาราง" → ข้อมูลในตารางจริงไม่เปลี่ยน)
function deleteAiResultDataset(cardKey, frameIdx, ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const list = getAiResultsForDisplay();
  if (!list.length) return;

  // หา index ของชุดข้อมูลที่จะลบ
  let targetIdx = -1;
  if (typeof frameIdx === 'number' && frameIdx >= 0 && frameIdx < list.length) {
    targetIdx = frameIdx;
  } else if (cardKey) {
    targetIdx = list.findIndex((r, i) => {
      const fKey = (r && r.frameId) ? String(r.frameId) : ('frame_' + i);
      return fKey === String(cardKey);
    });
  }
  if (targetIdx < 0) return;

  const res = list[targetIdx];
  const fName = (res && res.frameName) ? res.frameName : ('รูปภาพ ' + (targetIdx + 1));

  const doDelete = () => {
    const cur = getAiResultsForDisplay();
    cur.splice(targetIdx, 1);
    aiLastResults = cur;
    // ล้างสถานะย่อ/ขยายของชุดที่ลบ
    const fKey = (res && res.frameId) ? String(res.frameId) : ('frame_' + targetIdx);
    delete aiDatasetCollapsedState[fKey];
    delete aiDatasetCollapsedState['frame_' + targetIdx];
    // ลบจุดอ้างอิงและป้ายของรูปนั้นออกด้วย (เฉพาะข้อมูลผลล่าสุดที่ยังไม่บันทึกลงตาราง)
    if (typeof aiRefPoints !== 'undefined' && aiRefPoints && res && res.frameId) {
      delete aiRefPoints[res.frameId];
    }
    if (typeof aiLabels !== 'undefined' && aiLabels && res && res.frameId) {
      delete aiLabels[res.frameId];
    }
    if (typeof renderAiResultTab === 'function') renderAiResultTab(getAiResultsForDisplay());
    if (typeof uiToast === 'function') uiToast('ลบชุดข้อมูล "' + fName + '" แล้ว', 'success');
  };

  const msg = 'ต้องการลบชุดข้อมูลที่ AI อ่านได้จาก "' + fName + '" ใช่หรือไม่?\n(ลบเฉพาะผลการอ่านในแท็บนี้ — ข้อมูลที่บันทึกลงตารางแล้วจะไม่ถูกลบ)';
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg, doDelete, { okText: '🗑 ลบข้อมูล', cancelText: 'ยกเลิก', danger: true });
  } else if (typeof confirm === 'function') {
    if (confirm(msg)) doDelete();
  } else {
    doDelete();
  }
}

// ผลลัพธ์ที่กำลังแสดงอยู่ (อ้างอิง aiLastResults)
function getAiResultsForDisplay() {
  return (typeof aiLastResults !== 'undefined' && Array.isArray(aiLastResults)) ? aiLastResults : [];
}

// เทียบค่าเดิมกับค่าใหม่ → 'new' | 'same' | 'changed'
function aiDiffKind(oldVal, newVal) {
  const o = (oldVal === null || oldVal === undefined) ? '' : String(oldVal).trim();
  const n = (newVal === null || newVal === undefined) ? '' : String(newVal).trim();
  if (o === '') return (n === '') ? 'same' : 'new';
  if (n === '') return 'same';
  const on = parseFloat(o), nn = parseFloat(n);
  if (!isNaN(on) && !isNaN(nn)) {
    return Math.abs(on - nn) < 1e-9 ? 'same' : 'changed';
  }
  return (o === n) ? 'same' : 'changed';
}

function aiDiffBadge(kind) {
  if (kind === 'new') return '<span class="ai-diff-badge ai-diff-new">ใหม่</span>';
  if (kind === 'changed') return '<span class="ai-diff-badge ai-diff-changed">ต่าง</span>';
  return '<span class="ai-diff-badge ai-diff-same">บันทึกแล้ว</span>';
}

function aiRow(label, oldVal, newVal, fmt) {
  const kind = aiDiffKind(oldVal, newVal);
  const f = (typeof fmt === 'function') ? fmt : (v => (v === null || v === undefined || v === '') ? '—' : String(v));
  return `<tr class="ai-diff-row ai-diff-${kind}">
    <td class="ai-diff-label">${escapeHtml(label)}</td>
    <td class="ai-diff-old">${escapeHtml(f(oldVal))}</td>
    <td class="ai-diff-new">${escapeHtml(f(newVal))} ${aiDiffBadge(kind)}</td>
  </tr>`;
}

// หาคูเดิมที่ตรงกับผล AI (คลองส่งน้ำ + คูส่งน้ำ)
function aiFindExistingChannel(canal, ditch) {
  if (typeof channels === 'undefined') return null;
  const cleanD = (typeof cleanDitchNumber === 'function') ? cleanDitchNumber(ditch) : String(ditch || '');
  return channels.find(c => c && c.canal === canal && ((typeof cleanDitchNumber === 'function' ? cleanDitchNumber(c.ditch) : String(c.ditch)) === cleanD)) || null;
}

function aiFmtKm(v) {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return '—';
  return (typeof formatKmDisplay === 'function') ? formatKmDisplay(Number(v)) : String(v);
}

function aiFmtNum(v, dec) {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return '—';
  return Number(v).toFixed(dec !== undefined ? dec : 2);
}

// เมื่อคลิกเลือกชุดข้อมูลภาพในแท็บผลอ่าน AI ให้สลับรูปภาพและชุดข้อมูลตามกันทันที
function selectAiResultFrameDataset(frameId, frameIdx, canal, ditch) {
  if (typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames) && pdfCropFrames.length > 0) {
    let targetIdx = pdfCropFrames.findIndex(f => f && frameId && f.id === frameId);
    if (targetIdx < 0 && typeof frameIdx === 'number' && frameIdx >= 0 && frameIdx < pdfCropFrames.length) {
      targetIdx = frameIdx;
    }
    if (targetIdx >= 0 && typeof selectCroppedFrameThumbnail === 'function') {
      selectCroppedFrameThumbnail(targetIdx);
    }
  }
  const matchedCh = aiFindExistingChannel(canal, ditch);
  if (matchedCh && typeof activeChannelId !== 'undefined') {
    activeChannelId = matchedCh.id;
    if (typeof activeCrossSectionState !== 'undefined' && activeCrossSectionState) {
      activeCrossSectionState.channelId = matchedCh.id;
    }
    if (typeof updateSideControlStatus === 'function') updateSideControlStatus();
  }
  if (typeof renderAiResultTab === 'function') {
    renderAiResultTab(getAiResultsForDisplay());
  }
}

// ===== แสดงผล (แยกเป็นชุดข้อมูลภาพ พร้อมปุ่มย่อ/ขยาย และไม่แสดงป้ายข้อความในตาราง) =====
function renderAiResultTab(results) {
  const container = document.getElementById('tableContainer');
  if (!container) return;
  const list = Array.isArray(results) ? results : (results ? [results] : []);
  aiLastResults = list;

  if (!list.length) {
    container.innerHTML = `
      <div class="ai-result-empty">
        <div class="ai-result-empty-icon">🤖</div>
        <h3>ยังไม่มีผลการอ่านของ AI</h3>
        <p>กดปุ่ม <b>🤖 AI อ่านกรอบนี้</b> หรือ <b>🤖 AI อ่านทุกกรอบ</b> ในแถบด้านขวา<br>
           (แท็บ "🖼️ ส่วนแสดงรูปตัดตามยาว") เพื่อให้ AI อ่านข้อมูลจากภาพแปลนและบันทึกลงตารางอัตโนมัติ</p>
        <p class="ai-result-empty-hint">ต้องตั้งค่า API key ของ AI ก่อน (ปุ่ม ⚙️ ตั้งค่า AI)</p>
      </div>`;
    return;
  }

  // รวมช่องคูส่งน้ำจากทุกกรอบ
  const allChans = [];
  list.forEach((res, ri) => {
    (res.channels || []).forEach(ch => {
      allChans.push({ ch: ch, frameName: res.frameName || ('รูปภาพ ' + (ri + 1)), frameId: res.frameId, frameIdx: ri });
    });
  });

  const curFrameId = (typeof getCurrentDisplayedFrameId === 'function') ? getCurrentDisplayedFrameId() : null;

  let html = `
    <div class="ai-result-wrap">
      <div class="ai-result-toolbar">
        <div class="ai-result-summary">
          ชุดข้อมูลภาพทั้งหมด <b>${list.length}</b> รูปภาพ · พบ <b>${allChans.length}</b> ชุดข้อมูลคูส่งน้ำ <span class="ai-diff-badge ai-diff-same">บันทึกอัตโนมัติแล้ว</span>
          <button type="button" class="ai-dataset-collapse-btn" style="margin-left:6px;" onclick="setAllAiDatasetCardsCollapsed(false)">➕ ขยายทั้งหมด</button>
          <button type="button" class="ai-dataset-collapse-btn" onclick="setAllAiDatasetCardsCollapsed(true)">➖ ย่อทั้งหมด</button>
        </div>
        <div class="ai-result-actions">
          <label class="ai-check"><input type="checkbox" id="aiSelChannels" ${aiResultSelection.channels ? 'checked' : ''} onchange="aiToggleSelection('channels', this.checked)"> คูส่งน้ำ</label>
          <label class="ai-check"><input type="checkbox" id="aiSelDimension" ${aiResultSelection.dimension ? 'checked' : ''} onchange="aiToggleSelection('dimension', this.checked)"> มิติ</label>
          <label class="ai-check"><input type="checkbox" id="aiSelGround" ${aiResultSelection.ground ? 'checked' : ''} onchange="aiToggleSelection('ground', this.checked)"> ระดับดิน</label>
          <label class="ai-check"><input type="checkbox" id="aiSelLevel" ${aiResultSelection.level ? 'checked' : ''} onchange="aiToggleSelection('level', this.checked)"> ระดับคู</label>
          <label class="ai-check"><input type="checkbox" id="aiSelStructures" ${aiResultSelection.structures ? 'checked' : ''} onchange="aiToggleSelection('structures', this.checked)"> อาคาร</label>
          <label class="ai-check"><input type="checkbox" id="aiSelAttachments" ${aiResultSelection.attachments ? 'checked' : ''} onchange="aiToggleSelection('attachments', this.checked)"> ท่อรับน้ำ</label>
          <label class="ai-check"><input type="checkbox" id="aiSelRefPoints" ${aiResultSelection.refPoints ? 'checked' : ''} onchange="aiToggleSelection('refPoints', this.checked)"> P1/P2</label>
          <button type="button" class="btn-action" style="background-color:#0d6efd;" onclick="applyAiResultsFromTab()">✅ บันทึก/อัปเดตลงตาราง</button>
        </div>
      </div>`;

  if (!allChans.length) {
    html += `<div class="ai-result-note">AI อ่านกรอบแล้ว แต่ไม่พบชุดข้อมูลคูส่งน้ำในภาพ (ลองเพิ่มคุณภาพภาพใน ⚙️ ตั้งค่า AI)</div>`;
  }

  // แสดงแยกตามชุดข้อมูลภาพ (แต่ละชุดข้อมูลมีปุ่มย่อ/ขยาย และไม่แสดงป้ายข้อความในตาราง)
  list.forEach((res, ri) => {
    const fName = res.frameName || ('รูปภาพ ' + (ri + 1));
    const fId = res.frameId || '';
    const cardKey = fId ? String(fId) : ('frame_' + ri);
    const isCardCollapsed = !!aiDatasetCollapsedState[cardKey];
    const rp = res.refPoints || {};
    const chans = Array.isArray(res.channels) ? res.channels : [];
    const firstCh = chans[0] || { canal: 'คลอง', ditch: '-' };
    const firstDitchClean = (typeof cleanDitchNumber === 'function') ? cleanDitchNumber(firstCh.ditch) : (firstCh.ditch || '-');
    const isActiveFrame = (curFrameId && fId && curFrameId === fId) || (!curFrameId && ri === 0);

    // ดึงเวลาที่ใช้ไปของกรอบนี้ (ถ้ามี)
    let elapsedVal = res.elapsedSec;
    if ((elapsedVal === undefined || elapsedVal === null) && typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames)) {
      const matchedFr = pdfCropFrames.find(f => f && f.id === fId) || pdfCropFrames[ri];
      if (matchedFr && matchedFr.aiElapsedSec !== undefined) elapsedVal = matchedFr.aiElapsedSec;
    }
    const elapsedBadge = (elapsedVal !== undefined && elapsedVal !== null && !isNaN(Number(elapsedVal)))
      ? `<span class="ai-diff-badge ai-diff-same" title="เวลาที่ใช้ในการอ่านกรอบนี้">⏱ ${Number(elapsedVal).toFixed(1)}s</span> `
      : '';

    html += `<div class="ai-frame-dataset-card${isActiveFrame ? ' active-frame-card' : ''}" onclick="selectAiResultFrameDataset('${escapeHtml(fId)}', ${ri}, '${escapeHtml(firstCh.canal || '')}', '${escapeHtml(firstCh.ditch || '')}')">
      <div class="ai-frame-dataset-header">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-collapse-rows" onclick="toggleAiDatasetCardCollapse('${escapeHtml(cardKey)}', event)" title="${isCardCollapsed ? 'ขยายชุดข้อมูลนี้' : 'ย่อชุดข้อมูลนี้'}">${isCardCollapsed ? '+' : '-'}</button>
          <span class="ai-result-canal">🖼️ ชุดข้อมูลภาพที่ ${ri + 1}: ${escapeHtml(fName)} (${escapeHtml(firstCh.canal || 'คลอง')} / คูส่งน้ำ ${escapeHtml(firstDitchClean)})</span>
          ${elapsedBadge}
          <!-- รอบ 41: เปลี่ยนปุ่มขยาย/ย่อ เป็นปุ่ม "ลบข้อมูล" (ลบชุดข้อมูลนี้ที่ไม่ต้องการ) -->
          <button type="button" class="ai-dataset-delete-btn" onclick="deleteAiResultDataset('${escapeHtml(cardKey)}', ${ri}, event)" title="ลบชุดข้อมูลนี้">🗑 ลบข้อมูล</button>
        </div>
        <div>
          ${rp.p1 ? `<span class="ai-diff-badge ai-diff-new">P1: กม.${escapeHtml(aiFmtKm(rp.p1.km))} / ระดับ +${escapeHtml(aiFmtNum(rp.p1.elev, 2))}</span> ` : ''}
          ${rp.p2 ? `<span class="ai-diff-badge ai-diff-new">P2: กม.${escapeHtml(aiFmtKm(rp.p2.km))} / ระดับ +${escapeHtml(aiFmtNum(rp.p2.elev, 2))}</span>` : ''}
        </div>
      </div>
      <div class="ai-frame-dataset-body${isCardCollapsed ? ' collapsed' : ''}">`;

    chans.forEach((ch, ci) => {
      const ditchClean = (typeof cleanDitchNumber === 'function') ? cleanDitchNumber(ch.ditch) : (ch.ditch || '-');
      const d = ch.dimension || {};
      const gList = Array.isArray(ch.ground) ? ch.ground : [];
      const lList = Array.isArray(ch.level) ? ch.level : [];
      const rawSList = Array.isArray(ch.structures) ? ch.structures : [];
      // กรอง/แยกอาคารที่มี "และ" หรือ "," และจับคู่ชื่อตาม Typeอาคารประกอบ พร้อมใส่ H เฉพาะตัวที่มีค่า H
      const sList = (typeof aiSplitAndNormalizeStructures === 'function')
        ? aiSplitAndNormalizeStructures(rawSList, res.labels || [], lList)
        : rawSList;
      const aList = Array.isArray(ch.attachments) ? ch.attachments : [];

      // 1) ตารางระบบคูส่งน้ำ + มิติคูส่งน้ำ
      html += `
        <div class="ai-frame-section-title">1. ระบบคูส่งน้ำ และ มิติคูส่งน้ำ — ${escapeHtml(ch.canal || 'คลอง')} / คูส่งน้ำ ${escapeHtml(ditchClean)}</div>
        <table class="ai-mirror-table">
          <thead>
            <tr>
              <th>คลองส่งน้ำ</th>
              <th>คูส่งน้ำ (ตัวเลข)</th>
              <th>พื้นที่รวม (ไร่)</th>
              <th>พื้นที่ส่งน้ำ (ไร่)</th>
              <th>กม.เริ่มต้น</th>
              <th>กม.สิ้นสุด</th>
              <th>Q (ม.³/วินาที)</th>
              <th>SLOPE (1:)</th>
              <th>B (ม.)</th>
              <th>D (ม.)</th>
              <th>TYPE</th>
              <th>TBL (ม.)</th>
              <th>TBR (ม.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>${escapeHtml(ch.canal || 'คลอง')}</b></td>
              <td><b>${escapeHtml(ditchClean)}</b></td>
              <td>${escapeHtml(ch.totalArea || '—')}</td>
              <td>${escapeHtml(ch.waterArea || '—')}</td>
              <td>${escapeHtml(aiFmtKm(d.kmStart))}</td>
              <td>${escapeHtml(aiFmtKm(d.kmEnd))}</td>
              <td>${escapeHtml(aiFmtNum(d.q, 2))}</td>
              <td>${escapeHtml(d.slope ? String(d.slope) : '—')}</td>
              <td>${escapeHtml(aiFmtNum(d.b, 2))}</td>
              <td>${escapeHtml(aiFmtNum(d.d, 2))}</td>
              <td><b>${escapeHtml(d.type || 'VU1')}</b></td>
              <td>${escapeHtml(aiFmtNum(d.tbl, 2))}</td>
              <td>${escapeHtml(aiFmtNum(d.tbr, 2))}</td>
            </tr>
          </tbody>
        </table>`;

      // 2) ตารางระดับดินเดิม + P1/P2
      html += `
        <div class="ai-frame-section-title">2. ระดับดินเดิม และ จุดอ้างอิง P1 / P2 (${gList.length} จุด)</div>
        <table class="ai-mirror-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>กม.</th>
              <th>ระดับดินเดิม (ม.รทก.)</th>
              <th>จุดอ้างอิงสเกลกราฟ (ช่องละ 1 ม. / 100 ม.)</th>
            </tr>
          </thead>
          <tbody>`;
      if (gList.length === 0) {
        html += `<tr><td colspan="4" style="color:#64748b;">ไม่มีข้อมูลระดับดินเดิม</td></tr>`;
      } else {
        gList.forEach((g, gi) => {
          let refNote = '—';
          if (gi === 0 && rp.p1) refNote = `P1: กม. ${aiFmtKm(rp.p1.km)}, ระดับ +${aiFmtNum(rp.p1.elev, 2)}`;
          else if (gi === gList.length - 1 && rp.p2) refNote = `P2: กม. ${aiFmtKm(rp.p2.km)}, ระดับ +${aiFmtNum(rp.p2.elev, 2)}`;
          html += `<tr>
            <td>${gi + 1}</td>
            <td>${escapeHtml(aiFmtKm(g.km))}</td>
            <td><b>${escapeHtml(aiFmtNum(g.groundElevation, 2))}</b></td>
            <td>${escapeHtml(refNote)}</td>
          </tr>`;
        });
      }
      html += `</tbody></table>`;

      // 3) ตารางระดับคูส่งน้ำ (บันทึกเป็นช่วงตาม กม. ที่มีค่า H)
      html += `
        <div class="ai-frame-section-title">3. ระดับคูส่งน้ำ — บันทึกเป็นช่วงตาม กม. ที่มีค่า H (${lList.length} ช่วง)</div>
        <table class="ai-mirror-table">
          <thead>
            <tr>
              <th>ช่วงที่</th>
              <th>กม.เริ่มต้น</th>
              <th>กม.สิ้นสุด</th>
              <th>H ลดระดับ (ม.)</th>
              <th>ระดับก้นคูเริ่มต้น (BL1)</th>
              <th>ระดับหลังคันคูเริ่มต้น (TBL1)</th>
              <th>ระดับก้นคูสิ้นสุด (BL2)</th>
              <th>ระดับหลังคันคูสิ้นสุด (TBL2)</th>
              <th>SLOPE (1:)</th>
            </tr>
          </thead>
          <tbody>`;
      if (lList.length === 0) {
        html += `<tr><td colspan="9" style="color:#64748b;">ไม่มีข้อมูลระดับคูส่งน้ำ</td></tr>`;
      } else {
        lList.forEach((l, li) => {
          html += `<tr>
            <td>${li + 1}</td>
            <td>${escapeHtml(aiFmtKm(l.kmStart))}</td>
            <td>${escapeHtml(aiFmtKm(l.kmEnd))}</td>
            <td><b>${escapeHtml(aiFmtNum(l.h || 0, 2))}</b></td>
            <td>${escapeHtml(aiFmtNum(l.bl1, 2))}</td>
            <td>${escapeHtml(aiFmtNum(l.tbl1, 2))}</td>
            <td>${escapeHtml(aiFmtNum(l.bl2, 2))}</td>
            <td>${escapeHtml(aiFmtNum(l.tbl2, 2))}</td>
            <td>${escapeHtml(l.slope ? String(l.slope) : String(d.slope || '—'))}</td>
          </tr>`;
        });
      }
      html += `</tbody></table>`;

      // 4) ตารางอาคารประกอบ
      html += `
        <div class="ai-frame-section-title">4. อาคารประกอบ (${sList.length} แห่ง)</div>
        <table class="ai-mirror-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>กม.</th>
              <th>ชื่ออาคาร (ตาม Typeอาคารประกอบ)</th>
              <th>ค่า H (ม.)</th>
              <th>ศก. ท่อ (ม.)</th>
              <th>ความยาว (ม.)</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>`;
      if (sList.length === 0) {
        html += `<tr><td colspan="7" style="color:#64748b;">ไม่มีข้อมูลอาคารประกอบ</td></tr>`;
      } else {
        sList.forEach((s, si) => {
          const sEntry = (typeof getStructureTypeEntry === 'function') ? getStructureTypeEntry(s.name) : null;
          const allowH = !sEntry || sEntry.hEditable === true;
          const hShown = (allowH && s.h !== '' && s.h !== undefined && s.h !== null && Number(s.h) > 0)
            ? aiFmtNum(s.h, 2)
            : '—';
          html += `<tr>
            <td>${si + 1}</td>
            <td>${escapeHtml(aiFmtKm(s.km))}</td>
            <td style="text-align:left;"><b>${escapeHtml(s.name || '-')}</b></td>
            <td>${escapeHtml(hShown)}</td>
            <td>${escapeHtml(s.pipeDia ? aiFmtNum(s.pipeDia, 2) : '—')}</td>
            <td>${escapeHtml(s.pipeCount ? aiFmtNum(s.pipeCount, 2) : '—')}</td>
            <td>${escapeHtml(s.remark || '—')}</td>
          </tr>`;
        });
      }
      html += `</tbody></table>`;

      // 5) ตารางอาคารท่อรับน้ำเข้าแปลงไร่นา
      if (aList.length > 0) {
        html += `
          <div class="ai-frame-section-title">5. อาคารท่อรับน้ำเข้าแปลงไร่นา (${aList.length} แห่ง)</div>
          <table class="ai-mirror-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>กม.</th>
                <th>ชื่ออาคาร</th>
                <th>H (ม.)</th>
                <th>ศก. ท่อ (ม.)</th>
                <th>ความยาว (ม.)</th>
                <th>จำนวน (แห่ง)</th>
              </tr>
            </thead>
            <tbody>`;
        aList.forEach((a, ai) => {
          html += `<tr>
            <td>${ai + 1}</td>
            <td>${escapeHtml(aiFmtKm(a.km))}</td>
            <td style="text-align:left;">${escapeHtml(a.name || '-')}</td>
            <td>${escapeHtml(aiFmtNum(a.h || 0, 2))}</td>
            <td>${escapeHtml(aiFmtNum(a.pipeDia || 0.2, 2))}</td>
            <td>${escapeHtml(a.length ? String(a.length) : '—')}</td>
            <td>${escapeHtml(a.count ? String(a.count) : '—')}</td>
          </tr>`;
        });
        html += `</tbody></table>`;
      }
    });

    // หมายเหตุ: ไม่แสดงส่วน "ป้ายข้อความในรูปภาพ" ในตารางตามคำสั่งผู้ใช้
    html += `</div></div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function aiToggleSelection(key, checked) {
  if (!aiResultSelection) return;
  aiResultSelection[key] = !!checked;
}

// ===== นำเข้าข้อมูลจากแท็บ =====
function applyAiResultsFromTab() {
  const list = getAiResultsForDisplay();
  if (!list.length) {
    alert('ยังไม่มีผลการอ่านของ AI ให้นำเข้า');
    return;
  }

  // กรองเฉพาะส่วนที่เลือกไว้
  const filtered = list.map(res => {
    const r = Object.assign({}, res);
    r.channels = (res.channels || []).map(ch => {
      const c = Object.assign({}, ch);
      if (!aiResultSelection.dimension) c.dimension = null;
      if (!aiResultSelection.ground) c.ground = [];
      if (!aiResultSelection.level) c.level = [];
      if (!aiResultSelection.structures) c.structures = [];
      if (!aiResultSelection.attachments) c.attachments = [];
      return c;
    });
    if (!aiResultSelection.channels) r.channels = [];
    if (!aiResultSelection.refPoints) r.refPoints = null;
    return r;
  });

  const stat = applyAiResultsToTables(filtered, { matchExisting: true });

  // นำเข้าจุดอ้างอิง P1/P2 (จับคู่กรอบด้วย frameId และผูกเข้ากับ channelId ของกรอบนั้น)
  let refCount = 0;
  if (aiResultSelection.refPoints) {
    list.forEach((res, ri) => {
      const frame = (typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames))
        ? (pdfCropFrames.find(f => f && f.id === res.frameId) || pdfCropFrames[ri] || null)
        : null;
      const meta = {
        frameId: res.frameId,
        frameWidth: frame ? frame.imgWidth : 0,
        frameHeight: frame ? frame.imgHeight : 0
      };
      let targetChId = undefined;
      if (res && Array.isArray(res.channels) && res.channels.length > 0 && typeof channels !== 'undefined') {
        const matchedCh = aiFindExistingChannel(res.channels[0].canal, res.channels[0].ditch);
        if (matchedCh) targetChId = matchedCh.id;
      }
      if (applyAiRefPointsToGroupState(meta, targetChId)) refCount++;
    });
  }

  const msg = `บันทึก/อัปเดตข้อมูลจาก AI เรียบร้อยแล้ว\n\n` +
    `- คูส่งน้ำใหม่: ${stat.channelsAdded} คู\n` +
    `- คูส่งน้ำที่อัปเดต: ${stat.channelsUpdated} คู\n` +
    `- แถวข้อมูลที่เพิ่ม: ${stat.rowsAdded} แถว\n` +
    `- จุดอ้างอิง P1/P2: ${refCount} ชุด`;
  alert(msg);
}
