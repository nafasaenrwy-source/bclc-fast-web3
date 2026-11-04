// ===== js/tab-validate.js =====
// รอบ 41: "ตรวจสอบข้อมูล" — ตรวจความถูกต้องของข้อมูลข้ามแท็บ
//   1) ตรวจด้วยกฎ (rule) ภายในเว็บ: ข้อมูลข้ามแท็บตรงกันไหม · กม. ชื่ออาคาร ระดับ ผิดปกติไหม · กรอกครบไหม
//   2) ให้ AI เสนอแนวทางแก้ไข (ถ้าตั้งค่า AI ไว้แล้ว) — ไม่บังคับ ถ้าไม่มี API key จะข้ามไป
//   3) แสดงผลเป็น "แท็บสีแดง" ต่อจากปุ่มตรวจสอบข้อมูล แจ้งจำนวน error แล้วคลิกเปิดดูรายละเอียด
//   4) ช่องสีแดงอ่อนตรงตำแหน่งที่ผิด ในตารางของทุกแท็บ (ยกเว้นแท็บ AI ตามคำสั่ง)
//   ⚠️ ไม่ตรวจแท็บ AI
//
// รูปแบบข้อมูลที่เก็บไว้:
//   validationIssues = [{ id, tab, channelId, field, km, message, severity, aiAdvice }]
//   ใช้ field เป็นตัวระบุช่องในตาราง (เช่น 'km', 'groundElevation', 'h', 'kmStart') เพื่อไปไฮไลต์ช่องได้

// ---------- สถานะผลการตรวจ ----------
let validationIssues = [];
let validationAiAdvice = '';
let validationCheckedAt = null;
let validationAiRunning = false;
let validationLastRequestId = 0;
let validationIssueSeq = 0;

// ---------- เครื่องมือช่วย ----------
function vEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function vNum(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? NaN : n;
}
function vIsBlank(v) {
  return v === '' || v === null || v === undefined || String(v).trim() === '';
}

// ---------- ตัวช่วยเพิ่มปัญหา ----------
//   rowIdx = ดัชนีแถวในอาร์เรย์ของแท็บนั้น (ใช้ระบุตำแหน่งที่ผิดให้ช่องสีแดงอ่อนตรงจุด)
function vAdd(tab, channelId, field, km, message, severity, aiAdvice, rowIdx) {
  validationIssues.push({
    id: 'vi_' + (++validationIssueSeq) + '_' + validationIssues.length,
    tab: tab,
    channelId: (channelId === undefined || channelId === null) ? null : channelId,
    field: field || '',
    km: (km === undefined || km === null) ? '' : km,
    message: message,
    severity: severity || 'error',      // 'error' | 'warn'
    aiAdvice: aiAdvice || '',
    rowIdx: (rowIdx === undefined || rowIdx === null) ? null : rowIdx
  });
}

// ---------- ดึงชื่อคู่ส่งน้ำ/คลองส่งน้ำ ----------
function vChannelLabel(chId) {
  const ch = (typeof getChannelById === 'function') ? getChannelById(chId) : null;
  if (!ch) return 'คู #' + chId;
  const cn = String(ch.canal || '').trim();
  const dn = String(ch.ditch || '').trim();
  const dnClean = (dn && dn !== '-') ? dn : '-';
  return (cn ? cn + ' / ' : '') + 'คู ' + dnClean;
}

// ---------- ตรวจทีละแท็บ ----------
// แท็บระบบคูส่งน้ำ: ชื่อคูซ้ำ · พื้นที่ส่งน้ำมากกว่าพื้นที่ทั้งหมด · พื้นที่ติดลบ
function vCheckDitchTab() {
  const tab = 'ditch';
  const seen = {};
  (typeof channels !== 'undefined' && Array.isArray(channels) ? channels : []).forEach((ch, idx) => {
    const chId = (ch && ch.id !== undefined) ? ch.id : (idx + 1);
    const dn = String((ch && ch.ditch) || '').trim();
    const cn = String((ch && ch.canal) || '').trim();

    if (!dn || dn === '-') {
      vAdd(tab, chId, 'ditch', '', 'ยังไม่ได้กรอก "ชื่อคูส่งน้ำ"', 'warn', 'กรอกชื่อคูส่งน้ำ เช่น 01, 02 หรือ กม.0+000~0+500', idx);
    } else {
      const key = cn + '|' + dn;
      if (seen[key]) {
        vAdd(tab, chId, 'ditch', '', 'ชื่อคูส่งน้ำ "' + dn + '" ซ้ำกับคู่ก่อนหน้า (คลอง ' + (cn || '-') + ')', 'error', 'ตั้งชื่อคูส่งน้ำให้ไม่ซ้ำกันภายในคลองเดียวกัน', idx);
      }
      seen[key] = true;
    }

    const total = vNum(ch && ch.totalArea);
    const water = vNum(ch && ch.waterArea);
    if (!isNaN(water) && !isNaN(total)) {
      if (water > total) {
        vAdd(tab, chId, 'waterArea', '', 'พื้นที่ส่งน้ำ (' + water + ') มากกว่าพื้นที่ทั้งหมด (' + total + ')', 'error', 'แก้ค่าพื้นที่ส่งน้ำให้ไม่เกินพื้นที่ทั้งหมด', idx);
      }
      if (total < 0 || water < 0) {
        vAdd(tab, chId, total < 0 ? 'totalArea' : 'waterArea', '', 'พื้นที่ติดลบ (ค่าต้องไม่น้อยกว่า 0)', 'error', 'ตรวจสอบตัวเลขพื้นที่ใหม่', idx);
      }
    }
  });
}

// แท็บมิติคูส่งน้ำ: ช่วงกม. ต่อเนื่อง/ซ้อนทับ · kmEnd ต้องมากกว่า kmStart · type ว่าง
function vCheckDimensionTab() {
  const tab = 'dimension';
  const rows = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows)) ? dimensionRows : [];
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const ks = vNum(r && r.kmStart);
    const ke = vNum(r && r.kmEnd);
    const label = 'แถว ' + (idx + 1);

    if (vIsBlank(r && r.kmStart) || vIsBlank(r && r.kmEnd)) {
      vAdd(tab, chId, 'kmEnd', label, 'ช่วงกม. เริ่มต้น/สิ้นสุดยังไม่ครบ', 'error', 'กรอก กม.เริ่มต้น และ กม.สิ้นสุด ให้ครบ', idx);
    } else if (!isNaN(ks) && !isNaN(ke)) {
      if (ke <= ks) {
        vAdd(tab, chId, 'kmEnd', label, 'กม.สิ้นสุด (' + ke + ') ต้องมากกว่า กม.เริ่มต้น (' + ks + ')', 'error', 'แก้ กม.สิ้นสุด ให้มากกว่า กม.เริ่มต้น', idx);
      }
    }
    if (vIsBlank(r && r.type)) {
      vAdd(tab, chId, 'type', label, 'ยังไม่ได้เลือก TYPE ของช่วงกม.นี้', 'warn', 'เลือก TYPE (เช่น VU1, VU6) ให้ตรงกับชนิดคูส่งน้ำ', idx);
    }
  });

  // ช่วงกม. ซ้อนทับกันในคู่เดียวกัน
  const byCh = {};
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const ks = vNum(r && r.kmStart);
    const ke = vNum(r && r.kmEnd);
    if (isNaN(ks) || isNaN(ke) || ke <= ks) return;
    if (!byCh[chId]) byCh[chId] = [];
    byCh[chId].push({ ks: ks, ke: ke, idx: idx, type: r.type });
  });
  Object.keys(byCh).forEach(chId => {
    const list = byCh[chId].slice().sort((a, b) => a.ks - b.ks);
    for (let i = 1; i < list.length; i++) {
      if (list[i].ks < list[i - 1].ke) {
        vAdd(tab, Number(chId), 'kmEnd', 'แถว ' + (list[i].idx + 1),
          'ช่วงกม. ซ้อนทับกับแถวก่อนหน้า (แถว ' + (list[i - 1].idx + 1) + ' ถึง ' + list[i - 1].ke + ' แต่แถวนี้เริ่ม ' + list[i].ks + ')',
          'error', 'ปรับ กม.เริ่มต้น/สิ้นสุด ให้ช่วงต่อเนื่องกัน ไม่ซ้อนทับ', list[i].idx);
      }
    }
  });
}

// แท็บระดับดินเดิม: กม. ไม่เรียง · กม. ซ้ำ · ระดับว่าง
function vCheckGroundTab() {
  const tab = 'ground';
  const rows = (typeof groundRowsData !== 'undefined' && Array.isArray(groundRowsData)) ? groundRowsData : [];
  const seen = {};
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const km = vNum(r && r.km);
    const elev = vNum(r && r.groundElevation);
    const label = 'แถว ' + (idx + 1);

    if (vIsBlank(r && r.km)) {
      vAdd(tab, chId, 'km', label, 'ยังไม่ได้กรอก กม.', 'error', 'กรอก กม. ของจุดนี้', idx);
    } else if (!isNaN(km)) {
      const key = chId + '|' + km;
      if (seen[key]) {
        vAdd(tab, chId, 'km', label, 'มี กม. ' + km + ' ซ้ำกับแถวก่อนหน้า', 'error', 'ตรวจสอบ กม. ของจุดนี้ว่าซ้ำกับจุดอื่นหรือไม่', idx);
      }
      seen[key] = true;
    }

    if (vIsBlank(r && r.groundElevation)) {
      vAdd(tab, chId, 'groundElevation', label, 'ยังไม่ได้กรอกระดับดินเดิม', 'error', 'กรอกระดับดินเดิม (ม.)', idx);
    } else if (!isNaN(elev) && elev < -50) {
      vAdd(tab, chId, 'groundElevation', label, 'ระดับดินเดิม ' + elev + ' ม. ผิดปกติ (ต่ำกว่า -50 ม.)', 'warn', 'ตรวจสอบระดับดินเดิมอีกครั้ง', idx);
    }
  });

  // กม. เรียงลำดับไม่เพิ่ม
  const byCh = {};
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const km = vNum(r && r.km);
    if (isNaN(km)) return;
    if (!byCh[chId]) byCh[chId] = [];
    byCh[chId].push({ km: km, idx: idx });
  });
  Object.keys(byCh).forEach(chId => {
    const list = byCh[chId];
    for (let i = 1; i < list.length; i++) {
      if (list[i].km <= list[i - 1].km) {
        vAdd(tab, Number(chId), 'km', 'แถว ' + (list[i].idx + 1),
          'กม. ไม่เรียงลำดับ (แถวก่อนหน้า = ' + list[i - 1].km + ' แต่แถวนี้ = ' + list[i].km + ')',
          'error', 'เรียง กม. จากน้อยไปมาก', list[i].idx);
      }
    }
  });
}

// แท็บระดับคูส่งน้ำ: kmStart<kmEnd · ช่วงซ้อนทับ · ระดับ BL/TBL ต้องมี · H ติดลบ
function vCheckLevelTab() {
  const tab = 'level';
  const rows = (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) ? levelRowsData : [];
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    // ⚠️ แถวแรกของแต่ละคูเก็บ customKmStart = "" ในข้อมูล แต่ "หน้าจอ" ดึงค่าจากแท็บมิติแทน
    //    → ต้องคำนวณค่าที่ "แสดงจริง" เหมือน renderLevelTab() ไม่งั้นจะขึ้น error ปลอม
    const dimItem = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.find(d => d && d.channelId === chId) : null;
    const isFirstOfCh = rows.findIndex(x => x && x.channelId === chId) === idx;
    const ks = vNum(isFirstOfCh && vIsBlank(r && r.customKmStart)
      ? ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0)
      : (r && r.customKmStart));
    const ke = vNum((r && r.customKmEnd !== "" && r && r.customKmEnd !== undefined)
      ? r.customKmEnd
      : (typeof getChannelKmEnd === 'function' ? getChannelKmEnd(chId) : ''));
    const label = 'แถว ' + (idx + 1);

    if (isNaN(ks) || isNaN(ke)) {
      vAdd(tab, chId, 'customKmStart', label, 'ช่วง กม. เริ่มต้น/สิ้นสุดยังไม่ครบ', 'error', 'กรอก กม.เริ่มต้น และ กม.สิ้นสุด ให้ครบ', idx);
    } else if (ke <= ks) {
      vAdd(tab, chId, 'customKmEnd', label, 'กม.สิ้นสุด (' + ke + ') ต้องมากกว่า กม.เริ่มต้น (' + ks + ')', 'error', 'แก้ กม.สิ้นสุด ให้มากกว่า กม.เริ่มต้น', idx);
    }
    if (vIsBlank(r && r.customType)) {
      // ⚠️ TYPE ของแถวปกติ (ไม่ใช่แถว dynamic) ถูก "แสดง" โดยดึงจากแท็บมิติ → ตรวจจากค่าที่แสดงจริง
      const shownType = (r && r.isDynamicRow) ? '' : ((dimItem && dimItem.type) ? dimItem.type : 'VU1');
      if (!shownType) {
        vAdd(tab, chId, 'customType', label, 'ยังไม่ได้เลือก TYPE', 'warn', 'เลือก TYPE ให้ตรงกับชนิดคูส่งน้ำ', idx);
      }
    }
    if (vIsBlank(r && r.h) && r && r.isDynamicRow !== true) {
      vAdd(tab, chId, 'h', label, 'ยังไม่ได้กรอก H (ม.)', 'warn', 'กรอก H (ความลึกของคูส่งน้ำ)', idx);
    }
    const bl1 = vNum(r && r.bl1);
    const bl2 = vNum(r && r.bl2);
    if (!isNaN(bl1) && !isNaN(bl2) && bl2 > bl1) {
      vAdd(tab, chId, 'bl2', label, 'ระดับ BL. สิ้นสุด (' + bl2 + ') สูงกว่า BL. เริ่มต้น (' + bl1 + ')', 'warn', 'ตรวจสอบระดับ BL. ทั้งสองปลายของช่วง', idx);
    }
  });

  const byCh = {};
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    // ใช้ค่าที่ "แสดงจริง" เหมือน renderLevelTab() (แถวแรกดึง กม.เริ่มต้นจากแท็บมิติ)
    const dimItem = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.find(d => d && d.channelId === chId) : null;
    const isFirstOfCh = rows.findIndex(x => x && x.channelId === chId) === idx;
    const ks = vNum(isFirstOfCh && vIsBlank(r && r.customKmStart)
      ? ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0)
      : (r && r.customKmStart));
    const ke = vNum((r && r.customKmEnd !== "" && r && r.customKmEnd !== undefined)
      ? r.customKmEnd
      : (typeof getChannelKmEnd === 'function' ? getChannelKmEnd(chId) : ''));
    if (isNaN(ks) || isNaN(ke) || ke <= ks) return;
    if (!byCh[chId]) byCh[chId] = [];
    byCh[chId].push({ ks: ks, ke: ke, idx: idx });
  });
  Object.keys(byCh).forEach(chId => {
    const list = byCh[chId].slice().sort((a, b) => a.ks - b.ks);
    for (let i = 1; i < list.length; i++) {
      if (list[i].ks < list[i - 1].ke) {
        vAdd(tab, Number(chId), 'customKmStart', 'แถว ' + (list[i].idx + 1),
          'ช่วง กม. ซ้อนทับกับแถวก่อนหน้า (แถว ' + (list[i - 1].idx + 1) + ' ถึง ' + list[i - 1].ke + ' แต่แถวนี้เริ่ม ' + list[i].ks + ')',
          'error', 'ปรับช่วง กม. ให้ต่อเนื่องกัน ไม่ซ้อนทับ', list[i].idx);
      }
    }
  });
}

// แท็บอาคารประกอบ: ชื่ออาคารว่าง · ประเภทอาคารไม่มีในฐานข้อมูล · กม. นอกช่วงของคู่ · H ติดลบ
function vCheckStructureTab() {
  const tab = 'structure';
  const rows = (typeof structureRowsData !== 'undefined' && Array.isArray(structureRowsData)) ? structureRowsData : [];
  const knownTypes = [];
  if (typeof structureTypeDatabase !== 'undefined' && Array.isArray(structureTypeDatabase)) {
    structureTypeDatabase.forEach(t => { if (t && t.type) knownTypes.push(String(t.type).trim()); });
  }
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const km = vNum(r && r.km);
    const label = 'แถว ' + (idx + 1);

    // ⚠️ ชื่อ/ประเภทอาคารเก็บในฟิลด์ "name" (ข้อมูลจริงของแท็บนี้ไม่มีฟิลด์ "type")
    const typeName = String((r && r.name !== undefined && r.name !== null) ? r.name : '').trim();
    if (!typeName) {
      vAdd(tab, chId, 'name', label, 'ยังไม่ได้กรอกชื่ออาคาร', 'error', 'กรอกชื่ออาคาร', idx);
    } else if (knownTypes.length && knownTypes.indexOf(typeName) < 0) {
      vAdd(tab, chId, 'name', label, 'ประเภทอาคาร "' + typeName + '" ไม่มีในฐานข้อมูล', 'error', 'เลือกประเภทอาคารที่มีอยู่ใน ⚙️ setting', idx);
    }
    if (vIsBlank(r && r.km)) {
      vAdd(tab, chId, 'km', label, 'ยังไม่ได้กรอก กม. ของอาคาร', 'error', 'กรอก กม. ที่ตั้งค่าอาคาร', idx);
    } else if (!isNaN(km)) {
      // เทียบกับช่วง กม. ของคู่ในแท็บมิติ
      const dim = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
        ? dimensionRows.filter(d => d && d.channelId === chId) : [];
      if (dim.length) {
        const inRange = dim.some(d => {
          const ks = vNum(d.kmStart), ke = vNum(d.kmEnd);
          if (isNaN(ks) || isNaN(ke)) return true;
          return km >= ks && km <= ke;
        });
        if (!inRange) {
          vAdd(tab, chId, 'km', label, 'กม. ' + km + ' อยู่นอกช่วง กม. ของคู่นี้ในแท็บมิติ', 'error', 'ตรวจสอบ กม. ของอาคารให้อยู่ในช่วงของคูส่งน้ำ', idx);
        }
      }
    }
    // H ของแท็บนี้เก็บใน hOverride (ไม่ใช่ h)
    const h = vNum((r && r.hOverride !== undefined) ? r.hOverride : (r && r.h));
    if (!isNaN(h) && h < 0) {
      vAdd(tab, chId, 'hOverride', label, 'ค่า H (ม.) ติดลบ', 'error', 'ตรวจสอบค่า H (ความสูงอาคาร)', idx);
    }
    // ความยาวของแท็บนี้เก็บใน pipeCount (ไม่ใช่ length)
    const len = vNum((r && r.pipeCount !== undefined) ? r.pipeCount : (r && r.length));
    if (!isNaN(len) && len < 0) {
      vAdd(tab, chId, 'pipeCount', label, 'ความยาว (ม.) ติดลบ', 'error', 'ตรวจสอบความยาว', idx);
    }
  });
}

// แท็บอาคารท่อรับน้ำ: ชื่อว่าง · กม. ว่าง · จำนวน/ขนาดท่อผิดปกติ
function vCheckAttachmentTab() {
  const tab = 'attachment';
  const rows = (typeof attachmentRowsData !== 'undefined' && Array.isArray(attachmentRowsData)) ? attachmentRowsData : [];
  rows.forEach((r, idx) => {
    const chId = (r && r.channelId !== undefined) ? r.channelId : null;
    const km = vNum(r && r.km);
    const label = 'แถว ' + (idx + 1);
    if (vIsBlank(r && r.name)) {
      vAdd(tab, chId, 'name', label, 'ยังไม่ได้กรอกชื่ออาคารท่อรับน้ำ', 'warn', 'กรอกชื่ออาคารท่อรับน้ำ', idx);
    }
    // หมายเหตุ: ตารางอาคารท่อรับน้ำเข้าแปลงไร่นาไม่มีคอลัมน์ กม. ให้กรอก จึงไม่บังคับตรวจ r.km
    const dia = vNum(r && r.pipeDia);
    if (!isNaN(dia) && dia <= 0) {
      vAdd(tab, chId, 'pipeDia', label, 'ศก. ท่อ (ม.) ต้องมากกว่า 0', 'error', 'ตรวจสอบศก. ท่อ', idx);
    }
    const len = vNum(r && r.length);
    if (!isNaN(len) && len <= 0) {
      vAdd(tab, chId, 'length', label, 'ความยาว (ม.) ต้องมากกว่า 0', 'error', 'ตรวจสอบความยาวท่อ', idx);
    }
    const cnt = vNum(r && r.count);
    if (!isNaN(cnt) && cnt <= 0) {
      vAdd(tab, chId, 'count', label, 'จำนวนท่อ ต้องมากกว่า 0', 'warn', 'ตรวจสอบจำนวนท่อ', idx);
    }
  });
}

// ---------- ตรวจความสอดคล้องข้ามแท็บ ----------
// 1) ช่วง กม. ของแต่ละแท็บต้องตรงกัน
// 2) ความยาวช่วง กม. รวมของแท็บมิติ ต้องเท่ากับช่วงของแท็บระดับคูส่งน้ำ
// 3) คูส่งน้ำที่มีข้อมูลในแท็บอื่น แต่ไม่มีในแท็บระบบคูส่งน้ำ
function vCheckCrossTabConsistency() {
  const tab = 'cross';

  // 3) คูที่มีข้อมูลข้ามแท็บ แต่ไม่มีในแท็บระบบคูส่งน้ำ
  const allChIds = {};
  const collect = (arr, key) => {
    (Array.isArray(arr) ? arr : []).forEach(r => { if (r && r[key] !== undefined && r[key] !== null) allChIds[r[key]] = true; });
  };
  collect(dimensionRows, 'channelId');
  collect(levelRowsData, 'channelId');
  collect(groundRowsData, 'channelId');
  collect(structureRowsData, 'channelId');
  collect(attachmentRowsData, 'channelId');
  const chList = (typeof channels !== 'undefined' && Array.isArray(channels)) ? channels : [];
  chList.forEach(ch => { if (ch && ch.id !== undefined) allChIds[ch.id] = true; });

  Object.keys(allChIds).forEach(idStr => {
    const chId = Number(idStr);
    const inDitch = chList.some(ch => ch && Number(ch.id) === chId);
    if (!inDitch) {
      vAdd(tab, chId, '', '', 'คู #' + chId + ' มีข้อมูลในแท็บอื่น แต่ไม่มีในแท็บระบบคูส่งน้ำ', 'error', 'เพิ่มคูนี้ในแท็บระบบคูส่งน้ำ หรือลบข้อมูลที่ค้างอยู่');
    }
  });

  // 1) + 2) ช่วง กม. แต่ละแท็บต้องตรงกัน
  const dimByCh = {};
  (Array.isArray(dimensionRows) ? dimensionRows : []).forEach(r => {
    if (!r) return;
    const chId = r.channelId;
    if (!dimByCh[chId]) dimByCh[chId] = [];
    dimByCh[chId].push({ ks: vNum(r.kmStart), ke: vNum(r.kmEnd) });
  });
  const lvlByCh = {};
  (Array.isArray(levelRowsData) ? levelRowsData : []).forEach((r, idx) => {
    if (!r) return;
    const chId = r.channelId;
    // ใช้ค่าที่ "แสดงจริง" เหมือน renderLevelTab() (แถวแรกดึง กม.เริ่มต้นจากแท็บมิติ)
    const dimItem = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.find(d => d && d.channelId === chId) : null;
    const isFirstOfCh = (Array.isArray(levelRowsData) ? levelRowsData : [])
      .findIndex(x => x && x.channelId === chId) === idx;
    const ks = vNum(isFirstOfCh && vIsBlank(r.customKmStart)
      ? ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0)
      : r.customKmStart);
    const ke = vNum((r.customKmEnd !== "" && r.customKmEnd !== undefined)
      ? r.customKmEnd
      : (typeof getChannelKmEnd === 'function' ? getChannelKmEnd(chId) : ''));
    if (!lvlByCh[chId]) lvlByCh[chId] = [];
    lvlByCh[chId].push({ ks: ks, ke: ke, idx: idx });
  });
  const gndByCh = {};
  (Array.isArray(groundRowsData) ? groundRowsData : []).forEach((r, idx) => {
    if (!r) return;
    const chId = r.channelId;
    if (!gndByCh[chId]) gndByCh[chId] = [];
    gndByCh[chId].push({ km: vNum(r.km), idx: idx });
  });

  Object.keys(dimByCh).forEach(chId => {
    const dims = dimByCh[chId].filter(d => !isNaN(d.ks) && !isNaN(d.ke)).sort((a, b) => a.ks - b.ks);
    if (!dims.length) return;
    const dimStart = dims[0].ks;
    const dimEnd = dims[dims.length - 1].ke;

    // เส้นดินเดิมต้องอยู่ในช่วง กม. ของแท็บมิติ
    (gndByCh[chId] || []).forEach(g => {
      const km = g.km;
      if (isNaN(km)) return;
      if (km < dimStart || km > dimEnd) {
        vAdd(tab, Number(chId), 'km', 'กม. ' + km,
          'จุดระดับดินเดิม กม. ' + km + ' อยู่นอกช่วง กม. ของแท็บมิติ (' + dimStart + ' - ' + dimEnd + ')',
          'error', 'ปรับ กม. ของจุดระดับดินเดิมให้อยู่ในช่วงของคูส่งน้ำ', g.idx);
      }
    });

    // ช่วง กม. แท็บระดับคูส่งน้ำ ต้องตรงกับแท็บมิติ
    const lvls = lvlByCh[chId] || [];
    if (lvls.length) {
      const lvlStart = Math.min.apply(null, lvls.map(l => isNaN(l.ks) ? Infinity : l.ks));
      const lvlEnd = Math.max.apply(null, lvls.map(l => isNaN(l.ke) ? -Infinity : l.ke));
      if (isFinite(lvlStart) && isFinite(lvlEnd)) {
        if (Math.abs(lvlStart - dimStart) > 0.001 || Math.abs(lvlEnd - dimEnd) > 0.001) {
          vAdd(tab, Number(chId), 'customKmStart', 'ช่วง ' + lvlStart + ' - ' + lvlEnd,
            'ช่วง กม. ของแท็บระดับคูส่งน้ำ (' + lvlStart + ' - ' + lvlEnd + ') ไม่ตรงกับแท็บมิติ (' + dimStart + ' - ' + dimEnd + ')',
            'error', 'ทำให้ช่วง กม. ของแท็บระดับคูส่งน้ำ ตรงกับแท็บมิติ', lvls[0] ? lvls[0].idx : 0);
        }
      }
    }
  });
}

// ---------- จุดอ้างอิง P1/P2 ----------
function vCheckRefPoints() {
  const tab = 'ref';
  const grp = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState : {};
  const chList = (typeof channels !== 'undefined' && Array.isArray(channels)) ? channels : [];
  chList.forEach((ch, idx) => {
    const chId = (ch && ch.id !== undefined) ? ch.id : (idx + 1);
    const key = 'ground_ch_' + chId;
    const g = grp[key];
    if (!g) return;
    const hasAny = (g.p1Ref || g.p2Ref || g.p1Km !== undefined || g.p2Km !== undefined);
    if (!hasAny) return;
    if (!g.p1Ref || !g.p2Ref) {
      vAdd(tab, chId, '', '', vChannelLabel(chId) + ': กำหนดจุดอ้างอิงไม่ครบ (ต้องมีทั้ง P1 และ P2)', 'error', 'กดเลือกจุด P1 และ P2 ให้ครบทั้งสองจุด');
      return;
    }
    const dx = g.p2Ref.x - g.p1Ref.x;
    const dy = g.p2Ref.y - g.p1Ref.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      vAdd(tab, chId, '', '', vChannelLabel(chId) + ': จุด P1 และ P2 อยู่ที่ตำแหน่งเดียวกัน', 'error', 'เลือกจุด P2 ให้อยู่คนละตำแหน่งกับ P1');
    }
    const p1Km = vNum(g.p1Km), p2Km = vNum(g.p2Km);
    if (!isNaN(p1Km) && !isNaN(p2Km) && p1Km === p2Km) {
      vAdd(tab, chId, '', '', vChannelLabel(chId) + ': กม. ของ P1 และ P2 เท่ากัน (' + p1Km + ')', 'error', 'กรอก กม. ให้ต่างกันระหว่าง P1 และ P2');
    }
  });
}

// ---------- จุดอ้างอิง AI (ไม่ตรวจแท็บ AI แต่จุด P1/P2 ที่ AI อ่านมากระทบความถูกต้อง) ----------
function vCheckAiRefPoints() {
  const tab = 'ref';
  const rp = (typeof aiRefPoints !== 'undefined' && aiRefPoints) ? aiRefPoints : {};
  Object.keys(rp).forEach(frameId => {
    const p = rp[frameId];
    if (!p) return;
    if ((!p.p1 || !p.p2) && (p.p1 || p.p2)) {
      vAdd(tab, null, '', 'รูป ' + frameId, 'จุดอ้างอิง P1/P2 ที่ AI อ่านจากรูปนี้ยังไม่ครบ', 'warn', 'ให้ AI อ่านรูปนี้ใหม่ หรือกำหนดจุด P1/P2 เอง');
    }
  });
}

// ---------- รวมผลการตรวจ ----------
function runValidationRules() {
  validationIssues = [];
  vCheckDitchTab();
  vCheckDimensionTab();
  vCheckGroundTab();
  vCheckLevelTab();
  vCheckStructureTab();
  vCheckAttachmentTab();
  vCheckCrossTabConsistency();
  vCheckRefPoints();
  vCheckAiRefPoints();
  return validationIssues;
}

// ---------- สร้างข้อความสรุปให้ AI ----------
function buildValidationSummaryForAi() {
  const lines = [];
  lines.push('ข้อมูลตรวจสอบความถูกต้องที่พบปัญหา (ระบบคลองส่งน้ำ/คูส่งน้ำ โครงการระบบชลประทาน):');
  lines.push('');
  const tabName = {
    ditch: 'ระบบคูส่งน้ำ', dimension: 'มิติคูส่งน้ำ', ground: 'ระดับดินเดิม',
    level: 'ระดับคูส่งน้ำ', structure: 'อาคารประกอบ', attachment: 'อาคารท่อรับน้ำ',
    cross: 'ความสอดคล้องข้ามแท็บ', ref: 'จุดอ้างอิง P1/P2'
  };
  const byTab = {};
  validationIssues.forEach(it => {
    if (!byTab[it.tab]) byTab[it.tab] = [];
    byTab[it.tab].push(it);
  });
  Object.keys(byTab).forEach(t => {
    lines.push('### แท็บ: ' + (tabName[t] || t));
    byTab[t].forEach((it, i) => {
      const chTxt = (it.channelId !== null && it.channelId !== undefined) ? vChannelLabel(it.channelId) : '-';
      lines.push((i + 1) + '. [' + (it.severity === 'warn' ? 'เตือน' : 'ผิดพลาด') + '] ' + chTxt + (it.km ? ' · ' + it.km : '') + ' → ' + it.message);
    });
    lines.push('');
  });
  lines.push('โปรดเสนอแนวทางแก้ไขสั้น ๆ เป็นรายข้อ (ภาษาไทย) ว่าควรแก้ค่าใดเป็นเท่าไร และอธิบายเหตุผลทางวิศวกรรมสั้น ๆ');
  lines.push('ตอบกลับเป็น JSON: {"advice":[{"tab":"...","channel":"...","km":"...","problem":"...","suggestion":"..."}],"summary":"..."}');
  return lines.join('\n');
}

// ---------- เรียก AI เสนอแนวทางแก้ไข ----------
async function askAiForValidationAdvice() {
  const settings = (typeof aiCurrentSettings !== 'undefined' && aiCurrentSettings) ? aiCurrentSettings : {};
  if (!settings.apiKey) {
    validationAiAdvice = 'ยังไม่ได้ตั้งค่า API key ของ AI — ข้ามการเสนอแนวทางแก้ไข (เปิด ⚙️ ตั้งค่า AI เพื่อให้ AI ช่วยวิเคราะห์)';
    return null;
  }
  const myReq = ++validationLastRequestId;
  validationAiRunning = true;
  renderValidationTab();
  try {
    const prompt = buildValidationSummaryForAi();
    const endpoint = (typeof buildAiChatEndpoint === 'function')
      ? buildAiChatEndpoint(settings.baseUrl) : 'https://api.openai.com/v1/chat/completions';
    const model = settings.model || 'gpt-4o';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'คุณเป็นผู้ตรวจสอบข้อมูลโครงการระบบชลประทาน (คลองส่งน้ำ/คูส่งน้ำ) ตอบเป็น JSON เท่านั้นตามรูปแบบที่กำหนด' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      const friendly = (typeof describeAiApiError === 'function')
        ? describeAiApiError(res.status, detail, model, settings.baseUrl)
        : ('เรียก AI ไม่สำเร็จ (HTTP ' + res.status + ')');
      throw new Error(friendly);
    }
    const json = await res.json();
    let content = '';
    try {
      const ch = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      content = String(ch || '');
    } catch (_) { content = ''; }
    if (myReq !== validationLastRequestId) return null;      // มีคำขอใหม่กว่า → ยกเลิก
    const parsed = parseAiValidationAdvice(content);
    validationAiAdvice = parsed.summary || '';
    validationAiAdviceItems = parsed.advice || [];
    return parsed;
  } catch (e) {
    if (myReq !== validationLastRequestId) return null;
    validationAiAdvice = 'เรียก AI ไม่สำเร็จ: ' + (e && e.message ? e.message : String(e));
    validationAiAdviceItems = [];
    return null;
  } finally {
    if (myReq === validationLastRequestId) {
      validationAiRunning = false;
      renderValidationTab();
    }
  }
}

// ---------- แยกคำตอบ AI ----------
let validationAiAdviceItems = [];
function parseAiValidationAdvice(content) {
  const fallback = { advice: [], summary: String(content || '').trim() };
  if (!content) return fallback;
  let txt = String(content).trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  try {
    const obj = JSON.parse(txt);
    if (obj && (obj.advice || obj.summary)) {
      return { advice: Array.isArray(obj.advice) ? obj.advice : [], summary: String(obj.summary || '') };
    }
  } catch (_) {}
  return fallback;
}

// ---------- แสดงผลในแท็บสีแดง ----------
function renderValidationTab() {
  const host = document.getElementById('validationTabHost');
  if (!host) return;
  const errCount = validationIssues.filter(i => i.severity === 'error').length;
  const warnCount = validationIssues.length - errCount;

  if (!validationCheckedAt) {
    host.innerHTML = `
      <div class="validation-empty">
        <div class="validation-empty-icon">🔍</div>
        <div>ยังไม่ได้ตรวจสอบข้อมูล</div>
        <div class="validation-empty-hint">กดปุ่ม <b>🔍 ตรวจสอบข้อมูล</b> เพื่อให้ระบบตรวจความถูกต้องของข้อมูลในทุกแท็บ</div>
      </div>`;
    return;
  }

  const tabName = {
    ditch: 'ระบบคูส่งน้ำ', dimension: 'มิติคูส่งน้ำ', ground: 'ระดับดินเดิม',
    level: 'ระดับคูส่งน้ำ', structure: 'อาคารประกอบ', attachment: 'อาคารท่อรับน้ำ',
    cross: 'ความสอดคล้องข้ามแท็บ', ref: 'จุดอ้างอิง P1/P2'
  };
  const tabOrder = ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'cross', 'ref'];

  const byTab = {};
  validationIssues.forEach(it => { if (!byTab[it.tab]) byTab[it.tab] = []; byTab[it.tab].push(it); });

  let html = `
    <div class="validation-wrap">
      <div class="validation-header">
        <div class="validation-summary-box">
          <span class="validation-count-badge err">พบ error ${errCount} จุด</span>
          <span class="validation-count-badge warn">เตือน ${warnCount} จุด</span>
          <span class="validation-time">ตรวจเมื่อ ${new Date(validationCheckedAt).toLocaleString('th-TH')}</span>
        </div>
        <div class="validation-actions">
          <button type="button" class="btn-action" style="background-color:#6c757d;" onclick="runDataValidation()">🔄 ตรวจสอบใหม่</button>
          <button type="button" class="btn-action" style="background-color:#0d6efd;" onclick="closeValidationTab()">✖ ปิด</button>
        </div>
      </div>`;

  if (validationAiRunning) {
    html += `<div class="validation-ai-box running">🤖 AI กำลังวิเคราะห์ปัญหาและเสนอแนวทางแก้ไข...</div>`;
  } else if (validationAiAdvice) {
    html += `<div class="validation-ai-box">
      <div class="validation-ai-title">🤖 คำแนะนำจาก AI</div>
      <div class="validation-ai-text">${vEsc(validationAiAdvice).replace(/\n/g, '<br>')}</div>
    </div>`;
  }

  if (validationAiAdviceItems && validationAiAdviceItems.length) {
    html += `<div class="validation-ai-list">
      <div class="validation-ai-title">📋 รายละเอียดการแก้ไขที่แนะนำ</div>
      <table class="validation-ai-table">
        <thead><tr><th style="min-width:110px;">แท็บ</th><th style="min-width:110px;">คู</th><th style="min-width:90px;">กม.</th><th>ปัญหา</th><th>แนวทางแก้ไข</th></tr></thead>
        <tbody>
        ${validationAiAdviceItems.map(a => `<tr>
          <td>${vEsc(a.tab || '-')}</td>
          <td>${vEsc(a.channel || '-')}</td>
          <td>${vEsc(a.km || '-')}</td>
          <td>${vEsc(a.problem || '-')}</td>
          <td>${vEsc(a.suggestion || '-')}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  if (!validationIssues.length) {
    html += `<div class="validation-all-clear">✅ ไม่พบปัญหาในข้อมูล — ข้อมูลในทุกแท็บสอดคล้องกันและกรอกครบแล้ว</div>`;
  } else {
    html += `<div class="validation-issue-list">`;
    tabOrder.forEach(t => {
      const list = byTab[t];
      if (!list || !list.length) return;
      html += `<div class="validation-tab-group">
        <div class="validation-tab-title">📌 ${vEsc(tabName[t] || t)} <span class="validation-tab-count">(${list.length})</span></div>
        <table class="validation-table">
          <thead><tr><th style="min-width:40px;">#</th><th style="min-width:150px;">คูส่งน้ำ</th><th style="min-width:110px;">กม./ตำแหน่ง</th><th style="min-width:70px;">ระดับ</th><th>ปัญหาที่พบ</th><th style="min-width:110px; text-align:center;">ไปยังจุดที่ผิด</th><th style="min-width:44px; text-align:center;">ลบ</th></tr></thead>
          <tbody>
          ${list.map((it, i) => `<tr class="sev-${vEsc(it.severity)}" data-issue-id="${vEsc(it.id)}">
            <td>${i + 1}</td>
            <td>${it.channelId !== null && it.channelId !== undefined ? vEsc(vChannelLabel(it.channelId)) : '-'}</td>
            <td><a href="javascript:void(0)" class="validation-jump-link" onclick="goToValidationIssue('${vEsc(it.id)}', event)" title="กดเพื่อไปยังตำแหน่งที่แจ้ง Error">${vEsc(it.km || 'ดูตำแหน่ง')}</a></td>
            <td><span class="sev-badge sev-${vEsc(it.severity)}">${it.severity === 'warn' ? 'เตือน' : 'ผิดพลาด'}</span></td>
            <td>
              <div class="validation-msg"><a href="javascript:void(0)" class="validation-msg-link" onclick="goToValidationIssue('${vEsc(it.id)}', event)" title="กดเพื่อไปยังตำแหน่งที่แจ้ง Error">${vEsc(it.message)}</a></div>
              ${it.aiAdvice ? `<div class="validation-hint">💡 ${vEsc(it.aiAdvice)}</div>` : ''}
            </td>
            <td style="text-align:center; white-space:nowrap;">
              <a href="javascript:void(0)" class="validation-goto-btn" onclick="goToValidationIssue('${vEsc(it.id)}', event)" title="ไปยังตำแหน่งที่แจ้ง Error">📍 ไปที่ตำแหน่ง</a>
            </td>
            <td style="text-align:center;">
              <button type="button" class="validation-dismiss-btn" onclick="dismissValidationIssue('${vEsc(it.id)}', event)" title="ลบข้อนี้และยกเลิกไฮไลต์ที่ช่องนั้น">✖</button>
            </td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  host.innerHTML = html;
}

// ---------- เปิด/ปิดแท็บตรวจสอบ ----------
function openValidationTab() {
  const btn = document.getElementById('btn-validate-data');
  const host = document.getElementById('validationTabHost');
  if (!host) return;
  const isOpen = host.style.display !== 'none' && host.innerHTML.trim() !== '';
  if (isOpen) { closeValidationTab(); return; }
  host.style.display = 'block';
  const panel = document.getElementById('bottomTablePanel');
  if (panel && panel.classList) panel.classList.add('has-validation-open');
  if (btn) btn.classList.add('active');
  renderValidationTab();
  if (host.scrollIntoView) { try { host.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {} }
}
function closeValidationTab() {
  const host = document.getElementById('validationTabHost');
  const btn = document.getElementById('btn-validate-data');
  const panel = document.getElementById('bottomTablePanel');
  if (host) { host.style.display = 'none'; host.innerHTML = ''; }
  if (panel && panel.classList) panel.classList.remove('has-validation-open');
  if (btn) btn.classList.remove('active');
}

// ---------- ปุ่มหลัก: ตรวจสอบข้อมูล ----------
async function runDataValidation() {
  const btn = document.getElementById('btn-validate-data');
  const host = document.getElementById('validationTabHost');
  if (host) { host.style.display = 'block'; }
  const panel = document.getElementById('bottomTablePanel');
  if (panel && panel.classList) panel.classList.add('has-validation-open');
  if (btn) btn.classList.add('active');

  runValidationRules();
  clearValidationHighlights();
  applyValidationHighlights();
  validationCheckedAt = new Date();
  validationAiAdvice = '';
  validationAiAdviceItems = [];
  renderValidationTab();

  const errCount = validationIssues.filter(i => i.severity === 'error').length;
  const warnCount = validationIssues.length - errCount;
  if (typeof uiToast === 'function') {
    uiToast('ตรวจสอบข้อมูลเสร็จแล้ว: พบ error ' + errCount + ' จุด · เตือน ' + warnCount + ' จุด', errCount ? 'error' : 'success');
  }
  if (host && host.scrollIntoView) { try { host.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {} }

  // ให้ AI ช่วยเสนอแนวทางแก้ไข (ไม่บังคับ — ถ้าไม่มี API key จะข้าม)
  try { await askAiForValidationAdvice(); } catch (e) { /* ไม่กระทบผลการตรวจ */ }
  renderValidationTab();
  return validationIssues;
}

// ---------- ถามก่อนบันทึก/ส่งออก ----------
function confirmValidateBeforeSave(actionLabel) {
  // คืน Promise<boolean> — true = ตรวจสอบแล้ว (หรือข้าม), false = ยกเลิก
  return new Promise((resolve) => {
    const doSave = () => {
      runValidationRules();
      validationCheckedAt = new Date();
      validationAiAdvice = '';
      validationAiAdviceItems = [];
      renderValidationTab();
      const errCount = validationIssues.filter(i => i.severity === 'error').length;
      const warnCount = validationIssues.length - errCount;
      const host = document.getElementById('validationTabHost');
      clearValidationHighlights();
      applyValidationHighlights();
      if (host) {
        host.style.display = 'block';
        const panel = document.getElementById('bottomTablePanel');
        if (panel && panel.classList) panel.classList.add('has-validation-open');
        const btn = document.getElementById('btn-validate-data');
        if (btn) btn.classList.add('active');
      }
      if (typeof uiToast === 'function') {
        uiToast('ตรวจสอบข้อมูลก่อน' + actionLabel + 'แล้ว: พบ error ' + errCount + ' จุด · เตือน ' + warnCount + ' จุด', errCount ? 'error' : 'success');
      }
      // เรียก AI แบบไม่รอ (ผู้ใช้ยังทำงานต่อได้)
      setTimeout(() => { try { askAiForValidationAdvice(); } catch (_) {} }, 200);
      resolve(true);
    };

    if (typeof uiConfirm === 'function') {
      uiConfirm('ต้องการตรวจสอบข้อมูลก่อน' + actionLabel + 'หรือไม่?\n(ตรวจแล้วจะแสดงรายการปัญหาในแท็บสีแดง และไฮไลต์ช่องที่ผิดในตาราง)',
        doSave, { okText: '🔍 ตรวจสอบก่อน', cancelText: 'ไม่ตรวจ · ทำต่อ', onCancel: () => resolve(true) });
    } else if (typeof confirm === 'function') {
      if (confirm('ต้องการตรวจสอบข้อมูลก่อน' + actionLabel + 'หรือไม่?')) { doSave(); }
      else resolve(true);
    } else {
      doSave();
    }
  });
}

// ---------- ไฮไลต์ช่องที่ผิดในตาราง ----------
//   เรียกหลัง render ตารางทุกครั้ง เพื่อให้ช่องสีแดงอ่อนปรากฏตรงตำแหน่งที่ผิด
//   ⚠️ จับคู่แถวด้วย data-row ของ "ช่องในตาราง" (ไม่ใช่ <tr> เพราะ <tr> ไม่มี data-row)
//      และใช้ data-field ของช่องนั้นเป็นหลัก (ถ้าไม่มี data-field → ใช้ data-col ตามแมปของแท็บ)
function vFieldColMap(tab) {
  const maps = {
    ditch: { canal: '0', ditch: '1', totalArea: '2', waterArea: '3' },
    dimension: { kmStart: '2', kmEnd: '3', q: '4', slope: '5', b: '6', d: '7', type: '8', tbl: '9', tbr: '10' },
    ground: { km: '2', groundElevation: '3' },
    level: { customType: '2', customSlope: '4', customKmStart: '5', h: '6', bl1: '7', tbl1: '8', customKmEnd: '9', bl2: '10', tbl2: '11' },
    structure: { km: '2', name: '4', hOverride: '5', pipeDia: '6', pipeCount: '7' },
    attachment: { name: '2', count: '3', h: '4', pipeDia: '5', length: '6' }
  };
  return maps[tab] || {};
}

// ช่องที่ไฮไลต์ได้ (ลำดับความสำคัญ): data-field → data-col
function vIsTargetCell(inp, field, colMap) {
  if (!field) return false;
  const f = inp.getAttribute('data-field');
  if (f) return f === field;
  const c = inp.getAttribute('data-col');
  if (c !== null && c !== undefined && colMap[field] !== undefined && String(colMap[field]) === String(c)) return true;
  return false;
}

function applyValidationHighlights() {
  clearValidationHighlights();
  if (!validationIssues || !validationIssues.length) return;
  const current = (typeof currentTab !== 'undefined') ? currentTab : '';
  if (current === 'ai-result') return;             // ไม่ตรวจแท็บ AI
  const validTabs = ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment'];
  if (validTabs.indexOf(current) < 0) return;

  const container = document.getElementById('tableContainer');
  if (!container) return;

  const list = validationIssues.filter(it => it.tab === current || it.tab === 'cross');
  if (!list.length) return;

  const colMap = vFieldColMap(current);
  // ดึงข้อมูลอ้างอิงของแท็บ เพื่อจับคู่แถว → channelId
  const dataArr = (current === 'ditch') ? null
    : (current === 'dimension') ? dimensionRows
      : (current === 'ground') ? groundRowsData
        : (current === 'level') ? levelRowsData
          : (current === 'structure') ? structureRowsData
            : (current === 'attachment') ? attachmentRowsData : null;

  // รวบรวมทุกช่องในตาราง (ไม่ต้องไล่ <tr> — ใช้ data-row ของช่องเอง · รวม combobox-input ด้วย)
  const baseInputs = Array.from(container.querySelectorAll('input.table-input, select.table-select, textarea') || []);
  const comboInputs = Array.from(container.querySelectorAll('input.combobox-input') || []);
  const inputs = baseInputs.concat(comboInputs.filter(el => baseInputs.indexOf(el) < 0));
  if (!inputs || !inputs.length) return;

  for (let j = 0; j < inputs.length; j++) {
    const inp = inputs[j];
    const rowIdxAttr = inp.getAttribute('data-row');
    const chAttr = inp.getAttribute('data-ch');
    const rowIdx = (rowIdxAttr !== null && rowIdxAttr !== undefined) ? parseInt(rowIdxAttr, 10)
      : ((current === 'ditch' && chAttr !== null && chAttr !== undefined) ? parseInt(chAttr, 10) : NaN);

    // หา channelId ของแถวนี้
    let rowChId = null;
    if (current === 'ditch') {
      const chIdx = (chAttr !== null && chAttr !== undefined) ? parseInt(chAttr, 10) : NaN;
      if (!isNaN(chIdx) && Array.isArray(channels) && channels[chIdx]) rowChId = Number(channels[chIdx].id);
    } else if (dataArr && !isNaN(rowIdx) && dataArr[rowIdx]) {
      rowChId = Number(dataArr[rowIdx].channelId);
    }

    // หาปัญหาที่ตรงกับแถว + ช่องนี้
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it.field) continue;
      // ต้องเป็นคูส่งน้ำเดียวกัน (ถ้ารู้จัก)
      if (it.channelId !== null && it.channelId !== undefined && rowChId !== null && rowChId !== Number(it.channelId)) continue;
      // ต้องเป็นแถวเดียวกัน (ถ้าระบุไว้)
      if (it.rowIdx !== null && it.rowIdx !== undefined && !isNaN(rowIdx) && it.rowIdx !== rowIdx) continue;
      if (!vIsTargetCell(inp, it.field, colMap)) continue;
      inp.classList.add('validation-error-cell');
      inp.setAttribute('title', (it.severity === 'warn' ? '⚠ ' : '⛔ ') + it.message);
      break;
    }
  }
}

// ---------- ล้างไฮไลต์ (ใช้ตอน render ตารางใหม่ หรือตอนกดลบข้อที่แจ้งเตือน) ----------
function clearValidationHighlights() {
  const container = document.getElementById('tableContainer');
  if (!container) return;
  const cells = Array.from(container.querySelectorAll('.validation-error-cell') || []);
  const baseInputs = Array.from(container.querySelectorAll('input.table-input, select.table-select, textarea') || []);
  const comboInputs = Array.from(container.querySelectorAll('input.combobox-input') || []);
  const all = cells.concat(baseInputs, comboInputs);
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el && el.classList && el.classList.contains('validation-error-cell')) {
      el.classList.remove('validation-error-cell');
      if (typeof el.removeAttribute === 'function') el.removeAttribute('title');
    }
  }
}

// ---------- รอบ 54 ข้อ 2: กดกากบาท (✖) เพื่อลบรายการแจ้งเตือนข้อนั้น และยกเลิกไฮไลต์ที่ช่องนั้นทันที ----------
function dismissValidationIssue(issueId, ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
  if (!issueId) return false;
  const beforeLen = validationIssues.length;
  validationIssues = validationIssues.filter(it => it && it.id !== issueId);
  clearValidationHighlights();
  applyValidationHighlights();
  renderValidationTab();
  return validationIssues.length < beforeLen;
}

// ---------- รอบ 54 ข้อ 3: กดลิงก์เพื่อไปยังแท็บ แถว และช่องที่แจ้ง Error ----------
function resolveValidationTargetTab(it) {
  if (!it) return 'ditch';
  if (it.targetTab) return it.targetTab;
  const directTabs = ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment'];
  if (directTabs.indexOf(it.tab) >= 0) return it.tab;
  if (it.tab === 'cross') {
    if (it.field === 'km') return 'ground';
    if (it.field === 'customKmStart' || it.field === 'customKmEnd') return 'level';
    return 'ditch';
  }
  if (it.tab === 'ref') return 'ground';
  return 'ditch';
}

function expandValidationChannelGroup(targetTab, chId) {
  if (chId === null || chId === undefined || isNaN(Number(chId))) return;
  const cid = Number(chId);
  if (typeof activeChannelId !== 'undefined') activeChannelId = cid;
  if (targetTab === 'ground' && typeof groundGroupState !== 'undefined' && groundGroupState) {
    const gKey = 'ground_ch_' + cid;
    if (!groundGroupState[gKey]) groundGroupState[gKey] = { locked: true, collapsed: false };
    else groundGroupState[gKey].collapsed = false;
  } else if (targetTab === 'level' && typeof levelGroupState !== 'undefined' && levelGroupState) {
    const lKey = 'ch_' + cid;
    if (!levelGroupState[lKey]) levelGroupState[lKey] = { locked: true, collapsed: false };
    else levelGroupState[lKey].collapsed = false;
  } else if (targetTab === 'structure' && typeof structureGroupState !== 'undefined' && structureGroupState) {
    const sKey = 'struct_ch_' + cid;
    if (!structureGroupState[sKey]) structureGroupState[sKey] = { locked: true, collapsed: false, showLabels: false };
    else structureGroupState[sKey].collapsed = false;
  } else if (targetTab === 'attachment' && typeof attachmentGroupState !== 'undefined' && attachmentGroupState) {
    const aKey = 'attach_ch_' + cid;
    if (!attachmentGroupState[aKey]) attachmentGroupState[aKey] = { locked: true, collapsed: false };
    else attachmentGroupState[aKey].collapsed = false;
  }
}

function findValidationTargetCell(it, targetTab) {
  const container = document.getElementById('tableContainer');
  if (!container || !it) return null;

  if (it.tab === 'ref' && it.channelId !== null && it.channelId !== undefined) {
    const calibInp = container.querySelector(`input[data-calib-ch="${it.channelId}"]`);
    if (calibInp && calibInp.id !== 'q') return calibInp;
  }

  const colMap = vFieldColMap(targetTab);
  const dataArr = (targetTab === 'ditch') ? null
    : (targetTab === 'dimension') ? dimensionRows
      : (targetTab === 'ground') ? groundRowsData
        : (targetTab === 'level') ? levelRowsData
          : (targetTab === 'structure') ? structureRowsData
            : (targetTab === 'attachment') ? attachmentRowsData : null;

  const baseInputs = Array.from(container.querySelectorAll('input.table-input, select.table-select, textarea') || []);
  const comboInputs = Array.from(container.querySelectorAll('input.combobox-input') || []);
  const inputs = baseInputs.concat(comboInputs.filter(el => baseInputs.indexOf(el) < 0));
  if (!inputs.length) return null;

  let rowFallback = null;
  let chFallback = null;

  for (let j = 0; j < inputs.length; j++) {
    const inp = inputs[j];
    const rowIdxAttr = inp.getAttribute('data-row');
    const chAttr = inp.getAttribute('data-ch');
    const rowIdx = (rowIdxAttr !== null && rowIdxAttr !== undefined) ? parseInt(rowIdxAttr, 10)
      : ((targetTab === 'ditch' && chAttr !== null && chAttr !== undefined) ? parseInt(chAttr, 10) : NaN);

    let rowChId = null;
    if (targetTab === 'ditch') {
      const chIdx = (chAttr !== null && chAttr !== undefined) ? parseInt(chAttr, 10) : NaN;
      if (!isNaN(chIdx) && Array.isArray(channels) && channels[chIdx]) rowChId = Number(channels[chIdx].id);
    } else if (dataArr && !isNaN(rowIdx) && dataArr[rowIdx]) {
      rowChId = Number(dataArr[rowIdx].channelId);
    }

    const chMatches = (it.channelId === null || it.channelId === undefined || rowChId === null || rowChId === Number(it.channelId));
    const rowMatches = (it.rowIdx === null || it.rowIdx === undefined || (!isNaN(rowIdx) && it.rowIdx === rowIdx));

    if (chMatches && !chFallback) chFallback = inp;
    if (chMatches && rowMatches && !rowFallback) rowFallback = inp;

    if (chMatches && rowMatches && it.field && vIsTargetCell(inp, it.field, colMap)) {
      return inp;
    }
  }
  return rowFallback || chFallback || null;
}

function goToValidationIssue(issueId, ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
  const it = validationIssues.find(x => x && x.id === issueId);
  if (!it) return null;

  const center = document.getElementById('centerContent');
  if (center && center.style && center.style.display === 'none' && typeof returnToTakeoff === 'function') {
    returnToTakeoff();
  }
  if (typeof bottomTableCollapsed !== 'undefined' && bottomTableCollapsed && typeof toggleBottomTableCollapse === 'function') {
    toggleBottomTableCollapse(null, false);
  }

  const targetTab = resolveValidationTargetTab(it);
  expandValidationChannelGroup(targetTab, it.channelId);

  if (typeof switchTableTab === 'function') {
    switchTableTab(targetTab);
  } else {
    currentTab = targetTab;
    if (typeof updateTable === 'function') updateTable();
  }

  const targetEl = findValidationTargetCell(it, targetTab);
  if (targetEl) {
    if (typeof targetEl.scrollIntoView === 'function') {
      try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch (_) {}
    }
    if (typeof targetEl.focus === 'function') {
      try { targetEl.focus(); } catch (_) {}
    }
    if (targetEl.classList) {
      targetEl.classList.add('validation-focus-pulse');
      setTimeout(() => {
        try { targetEl.classList.remove('validation-focus-pulse'); } catch (_) {}
      }, 1800);
    }
  }
  return targetEl;
}
