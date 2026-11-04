// ===== ค่าที่จะเขียนลงไฟล์ของแท็บ "อาคารประกอบ" =====
// กฎ: ช่องตัวเลข (H / ศก. ท่อ / ความยาว) ให้เซฟเป็น "ตัวเลข" เสมอ
//      - ช่องที่เป็น "-" หรือว่าง → เซฟเป็น 0
//      - ช่องหมายเหตุ เป็นข้อความ (ไม่แปลงเป็นตัวเลข)
function structureNumericForFile(editable, tableVal, userVal) {
  let table = (tableVal === undefined || tableVal === null) ? "" : String(tableVal).trim();
  let user = (userVal === undefined || userVal === null) ? "" : String(userVal).trim();

  let useVal;
  if (editable) {
    // ช่องที่แก้ได้: ถ้าผู้ใช้กรอกไว้ (รวมถึง "-") ให้ใช้ค่านั้น · ว่างจึงใช้ค่าเริ่มต้นจากตาราง
    useVal = (user !== "") ? user : table;
  } else {
    // ช่องที่ล็อก: ใช้ค่าจากตาราง
    useVal = table;
  }

  if (useVal === "" || useVal === "-") return 0;
  let num = parseFloat(useVal);
  return isNaN(num) ? 0 : num;
}

function structureRemarkForFile(editable, tableVal, userVal) {
  if (editable) return (userVal === undefined || userVal === null) ? "" : String(userVal);
  let t = (tableVal === undefined || tableVal === null) ? "" : String(tableVal);
  return (t === "-") ? "" : t;
}

// ===== ค่าที่อ่านจาก Excel =====
//   ว่าง/ไม่มีช่อง -> ค่าเริ่มต้น · เป็นตัวเลข -> ทศนิยม 2 ตำแหน่ง (กัน "0.30" กลายเป็น "0.3" แล้วชื่ออาคารเพี้ยน)
function excelCellText2(v, dflt) {
  if (v === undefined || v === null || v === "") return dflt === undefined ? "" : dflt;
  let num = parseFloat(v);
  if (isNaN(num)) return String(v);
  return Number(num).toFixed(2);
}

// ===== ตัวช่วยจับคู่ "แถวในชีต" กับ "คูส่งน้ำ" =====
//   1) ใช้คอลัมน์ "ลำดับคู" ที่ส่งออกไป (แม่นที่สุด แม้ชื่อคูซ้ำกัน)
//   2) ไฟล์เก่าที่ไม่มีคอลัมน์นี้ → จับคู่จากชื่อ คลองส่งน้ำ + คูส่งน้ำ (ชื่อซ้ำกันจะได้คูตัวถัดไปตามลำดับ)
function makeChannelResolver(channelList) {
  let fallbackGroupCount = {};
  let fallbackLastKey = null;
  return function (row, canal, ditch) {
    let ordRaw = row["ลำดับคู"];
    if (ordRaw !== undefined && ordRaw !== null && String(ordRaw).trim() !== "") {
      let i = parseInt(ordRaw, 10) - 1;
      if (!isNaN(i) && i >= 0 && i < channelList.length) return i;
    }
    let key = String(canal) + '\u0000' + String(ditch);
    if (key !== fallbackLastKey) {
      fallbackGroupCount[key] = (fallbackGroupCount[key] || 0) + 1;   // กลุ่มใหม่ของชื่อคูนี้
      fallbackLastKey = key;
    }
    let n = fallbackGroupCount[key];
    let matches = [];
    channelList.forEach((c, i) => {
      if (c.canal === canal && String(c.ditch) === ditch) matches.push(i);
    });
    if (matches.length === 0) return 0;
    return matches[Math.min(n - 1, matches.length - 1)];
  };
}

// ===== คัดลอกข้อมูลตารางลงคลิปบอร์ด (แบบไม่พังเงียบ) =====
// เดิมใช้ navigator.clipboard API แบบ .then(...) ที่ไม่มี .catch()
// → ถ้าเบราว์เซอร์ไม่อนุญาตให้ใช้คลิปบอร์ด (เช่นเปิดเว็บผ่าน file:// หรือยังไม่ให้สิทธิ์)
//   จะไม่มีอะไรเกิดขึ้นเลย ผู้ใช้เข้าใจว่าคัดลอกแล้ว ทั้งที่ไม่ได้คัดลอก
function writeToClipboard(text, successMsg) {
  const ok = () => { if (successMsg) alert(successMsg); };
  const legacyCopy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const done = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!done;
    } catch (e) { return false; }
  };
  const failed = () => {
    if (legacyCopy()) { alert('คัดลอกข้อมูลเรียบร้อยแล้ว! (ใช้วิธีสำรองของเบราว์เซอร์)'); return; }
    alert('คัดลอกไม่สำเร็จ: เบราว์เซอร์ไม่อนุญาตให้ใช้คลิปบอร์ดในบริบทนี้\nกรุณาเลือกข้อความในตารางแล้วกด Ctrl+C แทน');
  };
  if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      navigator.clipboard.writeText(text).then(ok, failed);
      return;
    } catch (e) { /* ตกไปใช้วิธีสำรองด้านล่าง */ }
  }
  failed();
}

function copyTableData() {
  const qtyPage = typeof document !== 'undefined' && document.getElementById ? document.getElementById('quantityCalcPage') : null;
  if (qtyPage && qtyPage.style && qtyPage.style.display === 'flex' && typeof copyEarthworkBoqTableData === 'function') {
    copyEarthworkBoqTableData();
    return;
  }
  syncTableInputsToChannels();
  if (currentTab === 'project') {
    const p = (typeof projectPlanData !== 'undefined' && projectPlanData) ? projectPlanData : {};
    const textToCopy = `หัวข้อ	รายละเอียด
ชื่อแผนงาน/โครงการ	${p.name || ''}
ที่อยู่/สถานที่ดำเนินโครงการ	${p.location || ''}
รายละเอียดโครงการ	${p.description || ''}`;
    writeToClipboard(textToCopy, 'คัดลอกข้อมูลแผนงานโครงการเรียบร้อยแล้ว!');
    return;
  }
  if (currentTab === 'dimension') {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tจาก (กม.เริ่มต้น)\tถึง (กม.สิ้นสุด)\tQ (ม.³/วินาที)\tSLOPE\tB (ม.)\tD (ม.)\tTYPE\tTBL (ม.)\tTBR (ม.)\n";
    dimensionRows.forEach(r => {
      let chObj = getChannelById(r.channelId) || { canal: "คลอง", ditch: "-" };
      let qFormatted = (r.q !== "" && r.q !== undefined && !isNaN(r.q)) ? Number(r.q).toFixed(3) : "";
      let bFormatted = (r.b !== "" && r.b !== undefined && !isNaN(r.b)) ? Number(r.b).toFixed(2) : "0.35";
      let dFormatted = (r.d !== "" && r.d !== undefined && !isNaN(r.d)) ? Number(r.d).toFixed(2) : "0.36";
      let tblFormatted = (r.tbl !== "" && r.tbl !== undefined && !isNaN(r.tbl)) ? Number(r.tbl).toFixed(2) : "0.50";
      let tbrFormatted = (r.tbr !== "" && r.tbr !== undefined && !isNaN(r.tbr)) ? Number(r.tbr).toFixed(2) : "0.50";
      textToCopy += `${chObj.canal}\t${chObj.ditch}\t${formatKmDisplay(r.kmStart)}\t${formatKmDisplay(r.kmEnd)}\t${qFormatted}\t${r.slope || ''}\t${bFormatted}\t${dFormatted}\t${r.type || ''}\t${tblFormatted}\t${tbrFormatted}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางมิติคูส่งน้ำเรียบร้อยแล้ว!');
  } else if (currentTab === 'level') {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tTYPE\tH TBL (ม.)\tSLOPE\tกม.เริ่มต้น\tH (ม.)\tระดับ BL. เริ่มต้น\tระดับ TBL เริ่มต้น\tกม.สิ้นสุด\tระดับ BL. สิ้นสุด\tระดับ TBL สิ้นสุด\n";
    levelRowsData.forEach((lvl, idx) => {
      let cIdx = lvl.channelId;
      let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
      let dimItem = dimensionRows.find(d => d.channelId === cIdx);

      let curType = lvl.isDynamicRow ? (lvl.customType || (dimItem ? dimItem.type : "VU1")) : (dimItem ? dimItem.type : "VU1");
      let hTbl = getHFromType(curType).toFixed(2);
      let curSlope = lvl.isDynamicRow ? lvl.customSlope : (dimItem ? dimItem.slope : 4000);
      let hVal = lvl.h !== undefined ? Number(lvl.h).toFixed(2) : "0.00";
      let curKmStart = lvl.isDynamicRow ? lvl.customKmStart : (dimItem ? dimItem.kmStart : 0);
      let curKmEnd = lvl.customKmEnd !== "" ? lvl.customKmEnd : getChannelKmEnd(cIdx);

      textToCopy += `${chObj.canal}\t${chObj.ditch}\t${curType}\t${hTbl}\t${curSlope}\t${formatKmDisplay(curKmStart)}\t${hVal}\t${lvl.bl1 || ''}\t${lvl.tbl1 || ''}\t${formatKmDisplay(curKmEnd)}\t${lvl.bl2 || ''}\t${lvl.tbl2 || ''}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางระดับคูส่งน้ำเรียบร้อยแล้ว!');
  } else if (currentTab === 'structure') {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tกม.\tรายการอาคาร\tประเภทอาคาร\tH (ม.)\tศก. ท่อ (ม.)\tความยาว (ม.)\tหมายเหตุ\tUP\tDOWN\n";
    structureRowsData.forEach(srow => {
      let chObj = getChannelById(srow.channelId) || { canal: "คลอง", ditch: "-" };
      let itemName = computeStructureItemName(srow, srow.channelId);
      let sEntry = getStructureTypeEntry(srow.name);
      let tableH = (sEntry && sEntry.h !== undefined) ? String(sEntry.h) : "";
      let tableDia = (sEntry && sEntry.pipeDia !== undefined) ? String(sEntry.pipeDia) : "";
      let tableLen = (sEntry && sEntry.length !== undefined) ? String(sEntry.length) : "";
      let hIsDash = (tableH.trim() === "-");
      let diaIsDash = (tableDia.trim() === "-");
      let lenIsDash = (tableLen.trim() === "-");
      let hLvlVal = srow.isFromLevel ? getStructureLevelH(srow) : "";
      let hUserVal = (srow.hOverride === undefined || srow.hOverride === null) ? "" : String(srow.hOverride).trim();
      let hResolved = (hUserVal !== "") ? hUserVal : ((srow.isFromLevel && hLvlVal !== "") ? hLvlVal : (hIsDash ? "-" : (tableH !== "" ? tableH : "-")));
      let hShown = formatStructureCellValue(hResolved);
      let diaLockedByType = !(sEntry && sEntry.diaEditable) || diaIsDash;
      let diaShown = formatStructureCellValue(diaLockedByType ? (diaIsDash ? "-" : tableDia) : structureNameValue(srow.pipeDia, tableDia, true));
      let lenLockedByType = !(sEntry && sEntry.lenEditable) || lenIsDash;
      let lenShown = formatStructureCellValue(lenLockedByType ? (lenIsDash ? "-" : tableLen) : structureNameValue(srow.pipeCount, tableLen, true));
      let remarkEditableByType = !!(sEntry && sEntry.remarkEditable);
      let remarkTableVal = (sEntry && sEntry.remark) ? sEntry.remark : "";
      let remarkShown = remarkEditableByType ? structureNameValue(srow.remark, remarkTableVal, true) : (remarkTableVal !== "" ? remarkTableVal : "-");
      let kmFmt = (typeof kmHasDecimal === 'function' && kmHasDecimal(srow.km)) ? formatKmDisplayDecimal(srow.km) : formatKmDisplay(srow.km);
      let upDown = (typeof computeStructureUpDownTypes === 'function') ? computeStructureUpDownTypes(srow) : { up: '-', down: '-' };
      textToCopy += `${chObj.canal}\t${chObj.ditch}\t${kmFmt}\t${itemName}\t${srow.name || '-ไม่มี-'}\t${hShown}\t${diaShown}\t${lenShown}\t${remarkShown}\t${upDown.up}\t${upDown.down}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางอาคารประกอบเรียบร้อยแล้ว!');
  } else if (currentTab === 'attachment') {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tรายการอาคาร\tจำนวนอาคาร\tH (ม.)\tศก. ท่อ (ม.)\tความยาว (ม.)\tหมายเหตุ\tช่วงคูน้ำ\n";
    attachmentRowsData.forEach(row => {
      let chObj = getChannelById(row.channelId) || { canal: "คลอง", ditch: "-" };
      let countVal = (row.count === "" || row.count === undefined) ? "1" : row.count;
      let secIdx = (typeof getDitchSectionIndex === 'function') ? getDitchSectionIndex(row.channelId, row) : '';
      textToCopy += `${chObj.canal}\t${chObj.ditch}\t${row.name || ATTACHMENT_BASE_NAME}\t${countVal}\t${row.h || '0.00'}\t${row.pipeDia || '0.00'}\t${row.length || '1.00'}\t${row.remark || ''}\t${secIdx}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางอาคารท่อรับน้ำเข้าแปลงไร่นาเรียบร้อยแล้ว!');
  } else if (currentTab === 'ground') {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tกม.\tระดับดินเดิม (ม.)\n";
    groundRowsData.forEach(grow => {
      let chObj = getChannelById(grow.channelId) || { canal: "คลอง", ditch: "-" };
      textToCopy += `${chObj.canal}\t${chObj.ditch}\t${formatKmDisplay(grow.km)}\t${grow.groundElevation || ''}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางระดับดินเดิมเรียบร้อยแล้ว!');
  } else if (currentTab === 'setting-type') {
    let textToCopy = "Type\tB (ม.)\tH (ม.)\tความหนากำแพง (ม.)\tความหนาพื้น (ม.)\n";
    ditchTypeDatabase.forEach(item => {
      let tw = getDitchTypeThickness(item, 'tw').toFixed(2);
      let tf = getDitchTypeThickness(item, 'tf').toFixed(2);
      textToCopy += `${item.type}\t${item.b.toFixed(2)}\t${item.h.toFixed(2)}\t${tw}\t${tf}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตาราง Typeคูส่งน้ำ เรียบร้อยแล้ว!');
  } else if (currentTab === 'setting-structure') {
    let textToCopy = "ประเภทอาคาร\tH (ม.)\tศก. ท่อ (ม.)\tความยาว (ม.)\tหมายเหตุ\tชื่ออาคารประกอบ\tUP\tDOWN\n";
    structureTypeDatabase.forEach(entry => {
      if (!entry) return;
      let hVal = entry.hEditable ? (entry.h || "") : "-";
      let diaVal = entry.diaEditable ? (entry.pipeDia || "") : "-";
      let lenVal = entry.lenEditable ? (entry.length || "") : "-";
      let remVal = entry.remarkEditable ? (entry.remark || "") : "-";
      let composed = computeStructureTypeName(entry);
      let upVal = (entry.up !== undefined && entry.up !== null && String(entry.up).trim() !== "") ? String(entry.up).trim() : "-";
      let downVal = (entry.down !== undefined && entry.down !== null && String(entry.down).trim() !== "") ? String(entry.down).trim() : "-";
      textToCopy += `${entry.type || ""}\t${hVal === "" ? "-" : hVal}\t${diaVal === "" ? "-" : diaVal}\t${lenVal === "" ? "-" : lenVal}\t${remVal}\t${composed}\t${upVal}\t${downVal}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตาราง Typeอาคารประกอบ เรียบร้อยแล้ว!');
  } else if (currentTab === 'ai-result') {
    // รอบ 30: คัดลอกผลอ่าน AI เป็น TSV (ค่าไปหน้าแท็บอื่นได้)
    let textToCopy = "กรอบ\tคลองส่งน้ำ\tคูส่งน้ำ\tกม.เริ่มต้น\tกม.สิ้นสุด\tQ\tSLOPE\tB\tD\tTYPE\tTBL\tTBR\n";
    (typeof aiLastResults !== 'undefined' && Array.isArray(aiLastResults) ? aiLastResults : []).forEach(res => {
      (res.channels || []).forEach(ch => {
        const d = ch.dimension || {};
        textToCopy += `${res.frameName || ''}\t${ch.canal || ''}\t${ch.ditch || ''}\t${d.kmStart ?? ''}\t${d.kmEnd ?? ''}\t${d.q ?? ''}\t${d.slope ?? ''}\t${d.b ?? ''}\t${d.d ?? ''}\t${d.type || ''}\t${d.tbl ?? ''}\t${d.tbr ?? ''}\n`;
      });
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกผลการอ่าน AI เรียบร้อยแล้ว!');
  } else {
    let textToCopy = "คลองส่งน้ำ\tคูส่งน้ำ\tพื้นที่ทั้งหมด (ไร่)\tพื้นที่ส่งน้ำ (ไร่)\n";
    channels.forEach(ch => {
      textToCopy += `${ch.canal || '-'}\t${ch.ditch || '-'}\t${ch.totalArea || '0.00'}\t${ch.waterArea || '0.00'}\n`;
    });
    writeToClipboard(textToCopy.trim(), 'คัดลอกข้อมูลตารางระบบคูส่งน้ำเรียบร้อยแล้ว!');
  }
}

async function saveFileWithDialog(blob, defaultFileName, fileTypeDesc, fileExtensions) {
  if ('showSaveFilePicker' in window) {
    try {
      const pickerOptions = {
        suggestedName: defaultFileName,
        types: [{
          description: fileTypeDesc,
          accept: { [blob.type || 'application/octet-stream']: fileExtensions }
        }]
      };
      if (lastDirectoryHandle) {
        pickerOptions.startIn = lastDirectoryHandle;
      }
      const fileHandle = await window.showSaveFilePicker(pickerOptions);
      if (fileHandle && fileHandle.getParent) {
        try { lastDirectoryHandle = await fileHandle.getParent(); } catch(e) {}
      } else {
        lastDirectoryHandle = fileHandle;
      }
      const writableStream = await fileHandle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      console.warn('showSaveFilePicker failed, fallback to classic download:', err);
    }
  }

  // ใช้กล่องกรอกข้อความที่สร้างในหน้าเว็บแทน prompt() ของเบราว์เซอร์
  // เพราะ prompt() ถูกบล็อกเงียบ ๆ เมื่อเปิดเว็บในพรีวิวแบบ sandbox (ไม่มี allow-modals)
  let userFileName = await uiPrompt("กรุณาระบุชื่อไฟล์ที่ต้องการบันทึก:", defaultFileName);
  if (userFileName === null) return false;
  userFileName = String(userFileName).trim() || defaultFileName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", userFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// ===== ภาพประกอบโปรเจกต์: กรอบรูปที่ตีไว้ + รูปที่อัปโหลด =====
// รอบ 30: เดิมกรอบรูป (pdfCropFrames) ไม่ถูกบันทึกลงไฟล์ JSON เลย → เปิดไฟล์ใหม่กรอบหาย
//   แก้โดยย่อภาพเป็น JPEG (ด้านยาวไม่เกิน PROJECT_FRAME_MAX_SIDE) แล้วแนบกลับไปในไฟล์
//   เก็บ imgWidth/imgHeight = ขนาด pixel จริงของ dataUrl เดิม (ก่อนย่อ) เพื่อให้พิกัดสัดส่วน 0..1
//   ของ AI แปลงกลับได้ตรงหลัง restore
const PROJECT_FRAME_MAX_SIDE = 1800;
const PROJECT_FRAME_JPEG_Q = 0.85;
// แจ้งเตือนเมื่อไฟล์บันทึกใหญ่เกิน 20 MB
const PROJECT_FILE_SIZE_WARN = 20 * 1024 * 1024;

function compressFrameImage(dataUrl, maxSide, quality) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const im = new Image();
    im.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        const w = Math.max(1, Math.round(im.width * k));
        const h = Math.max(1, Math.round(im.height * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.fillStyle = '#ffffff';       // JPEG ไม่มี alpha → รองพื้นขาวให้ภาพโปร่งใส
        cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        resolve({
          dataUrl: c.toDataURL('image/jpeg', quality),
          width: im.width,
          height: im.height
        });
      } catch (_) { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}

async function buildCropFramesPayload() {
  if (typeof pdfCropFrames === 'undefined' || !Array.isArray(pdfCropFrames) || pdfCropFrames.length === 0) return [];
  const out = [];
  for (const f of pdfCropFrames) {
    if (!f) continue;
    let comp = await compressFrameImage(f.dataUrl, PROJECT_FRAME_MAX_SIDE, PROJECT_FRAME_JPEG_Q);
    if (!comp) continue;
    out.push({
      id: f.id,
      index: f.index,
      source: f.source,
      name: f.name,
      pageNum: f.pageNum,
      // พิกัดกรอบในหน้า PDF (ทั้งแบบพิกเซลหน้าจอ และแบบสัดส่วน 0..1)
      x: f.x, y: f.y, w: f.w, h: f.h,
      normX: f.normX, normY: f.normY, normW: f.normW, normH: f.normH,
      // พิกัดอ้างอิงสำหรับย้อนกลับไปเขียนบนแท็บ PDF
      imgWidth: f.imgWidth || comp.width,
      imgHeight: f.imgHeight || comp.height,
      _cropImgScale: f._cropImgScale,
      aiElapsedSec: f.aiElapsedSec,
      dataUrl: comp.dataUrl
    });
  }
  return out;
}

async function restoreCropFrames(frames) {
  if (typeof pdfCropFrames === 'undefined') return;
  if (!Array.isArray(frames) || frames.length === 0) {
    pdfCropFrames = [];
    activeCropFrameIndex = -1;
    return;
  }
  pdfCropFrames = frames.filter(f => f && f.dataUrl).map((f, i) => ({
    id: f.id || ("frame_restore_" + i),
    index: (typeof f.index === 'number') ? f.index : (i + 1),
    source: f.source || 'pdf_crop',
    name: f.name || (`รูปภาพ ${i + 1}`),
    pageNum: f.pageNum || 1,
    x: f.x, y: f.y, w: f.w, h: f.h,
    normX: f.normX, normY: f.normY, normW: f.normW, normH: f.normH,
    imgWidth: f.imgWidth,
    imgHeight: f.imgHeight,
    _cropImgScale: f._cropImgScale,
    aiElapsedSec: f.aiElapsedSec,
    dataUrl: f.dataUrl
  }));
  activeCropFrameIndex = (pdfCropFrames.length > 0) ? 0 : -1;
}

// ===== ภาพแผนที่แนบลงไฟล์โปรเจกต์ =====
// ปัญหาเดิม: JSON เก็บแค่พิกัด (refPixels/เส้น) ไม่เก็บภาพ → เปิดโปรเจกต์เก่าจึงเห็นจุด/เส้นลอยบนจอว่าง
// วิธีแก้: ย่อภาพเก็บเป็น JPEG (ด้านยาวสุดไม่เกิน PROJECT_IMAGE_MAX_SIDE) + จำ "ขนาดภาพเต็ม" ไว้
//          ตอนโหลดจะขยายพิกัด overlay กลับตามอัตราส่วน เพื่อให้จุด/เส้นตรงตำแหน่งเดิม
const PROJECT_IMAGE_MAX_SIDE = 2200;

function buildProjectImagePayload() {
  // รอบ 36: ถ้ายังไม่มีภาพใน canvas แต่มี PDF อยู่แล้ว → ยังต้องแนบ PDF กลับไปได้
  //   (เดิม return null ตรง ๆ → ตอนเชฟอัตโนมัติที่ภาพยังไม่พร้อม ข้อมูล PDF จะหายทั้งก้อน)
  const hasPdf = (typeof pdfFileDataUrl !== 'undefined' && pdfFileDataUrl);
  const hasImg = (typeof img !== 'undefined' && img && img.src && img.width && img.height);
  if (!hasImg && !hasPdf) return null;

  // เตรียมส่วนที่เกี่ยวกับ PDF ไว้ก่อน (ใช้ได้แม้ไม่มีภาพ)
  const pdfPart = {
    // รอบ 36: ถ้าเคยอัปโหลด PDF ให้แนบ PDF ฉบับเต็มไปด้วย เพื่อตอนโหลดกลับมาจะได้หน้าอื่น ๆ กลับมาด้วย
    //   ⚠️ ต้องเช็ค "pdfFileDataUrl มีค่าอยู่จริง" ไม่ใช่แค่ isPDF
    //   เพราะตอนผู้ใช้สลับไปแท็บรูปภาพ ตัวแปร isPDF จะกลายเป็น false ทันที
    //   ถ้าเช็คแค่ isPDF → ตอนเชฟอัตโนมัติจะทำไฟล์ PDF หาย (แนบแค่ dataUrl ของหน้าที่แสดง)
    pdfFileDataUrl: hasPdf ? pdfFileDataUrl : null,
    // รอบ 36: เก็บชื่อไฟล์ PDF แยกไว้ (currentFileName จะเปลี่ยนตามรูปที่แสดงอยู่ จึงใช้ไม่ได้)
    pdfFileName: (typeof savedPdfFileName !== 'undefined' && savedPdfFileName) ? savedPdfFileName : null,
    currentPage: (typeof isPDF !== 'undefined' && isPDF && typeof pageNum !== 'undefined') ? pageNum : 1,
    totalPages: (typeof isPDF !== 'undefined' && isPDF && typeof totalPages !== 'undefined') ? totalPages : 1
  };

  // ยังไม่มีภาพใน canvas → ส่งแค่ข้อมูล PDF (ภาพหน้าปัจจุบันจะได้จากการ render PDF ใหม่ตอนโหลด)
  if (!hasImg) {
    return Object.assign({
      name: currentFileName || '',
      fullWidth: 0,
      fullHeight: 0,
      dataUrl: ''
    }, pdfPart);
  }

  try {
    let srcW = img.width, srcH = img.height;
    let k = Math.min(1, PROJECT_IMAGE_MAX_SIDE / Math.max(srcW, srcH));
    let tw = Math.max(1, Math.round(srcW * k));
    let th = Math.max(1, Math.round(srcH * k));
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';          // JPEG ไม่มีช่อง alpha → รองพื้นขาวให้ภาพโปร่งใส
    cx.fillRect(0, 0, tw, th);
    cx.drawImage(img, 0, 0, tw, th);
    return Object.assign({
      name: currentFileName || '',
      fullWidth: srcW,
      fullHeight: srcH,
      dataUrl: c.toDataURL('image/jpeg', 0.8)
    }, pdfPart);
  } catch (e) {
    console.warn('แนบภาพลงไฟล์โปรเจกต์ไม่สำเร็จ:', e);
    // รอบ 36: ย่อภาพไม่สำเร็จ → ยังคืนข้อมูล PDF กลับไปได้ (ดีกว่าทิ้งทั้งก้อน)
    return Object.assign({
      name: currentFileName || '',
      fullWidth: 0,
      fullHeight: 0,
      dataUrl: ''
    }, pdfPart);
  }
}

// แปลงพิกัด overlay จาก "พิกัดหน้าจอ" (ขึ้นกับซูมและขนาดหน้าต่าง) → "พิกัดพิกเซลของภาพเต็ม"
// ทำให้ไฟล์โปรเจกต์ย้ายเครื่อง/เปลี่ยนขนาดหน้าต่างแล้วจุดและเส้นยังตรงตำแหน่งเดิม
function buildOverlayPayload() {
  const s = (typeof imgScale === 'number' && isFinite(imgScale) && imgScale > 0) ? imgScale : 1;
  const toImg = (x, y) => ({ x: x / s, y: y / s });
  let rp = {};
  ['p1', 'p2'].forEach(k => {
    if (refPixels[k]) rp[k] = toImg(refPixels[k].x, refPixels[k].y);
  });
  const imgTabState = (typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab && mediaDrawingStateByTab.image) ? mediaDrawingStateByTab.image : null;
  const srcManual = (Array.isArray(manualGroundLinePoints) && manualGroundLinePoints.length > 0) ? manualGroundLinePoints : (imgTabState && Array.isArray(imgTabState.manualGroundLinePoints) ? imgTabState.manualGroundLinePoints : []);
  const srcTable = (Array.isArray(tableGroundLinePoints) && tableGroundLinePoints.length > 0) ? tableGroundLinePoints : (imgTabState && Array.isArray(imgTabState.tableGroundLinePoints) ? imgTabState.tableGroundLinePoints : []);
  const srcCanal = (Array.isArray(canalLevelDrawingLines) && canalLevelDrawingLines.length > 0) ? canalLevelDrawingLines : (imgTabState && Array.isArray(imgTabState.canalLevelDrawingLines) ? imgTabState.canalLevelDrawingLines : []);
  return {
    refPixels: rp,
    manualGroundLinePoints: srcManual.map(p => Object.assign({}, p, toImg(p.x, p.y))),
    tableGroundLinePoints: srcTable.map(p => Object.assign({}, p, toImg(p.x, p.y))),
    canalLevelDrawingLines: srcCanal.map(l => {
      let a = toImg(l.x1, l.y1), b = toImg(l.x2, l.y2);
      return Object.assign({}, l, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    })
  };
}

// รอบ 30: เตรียม groupState ของชุดข้อมูลระดับดินเดิมเพื่อบันทึกลงไฟล์
//   p1Ref/p2Ref ในหน่วยความจำเป็น "พิกัดหน้าจอ" (เปลี่ยนตามขนาดหน้าต่าง/ซูม)
//   → แปลงเป็น "สัดส่วน 0..1 ของภาพ" ก่อนบันทึก เพื่อให้เปิดไฟล์บนจอคนละขนาดแล้วจุดยังตรง
//   ใส่ _coordSpace: 'normalized' ไว้บอกว่าไฟล์นี้ใช้สัดส่วน (ไฟล์เก่าไม่มี → คงพิกัดหน้าจอไว้)
function buildGroundGroupStateForSave() {
  const src = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState : {};
  const imgW = (typeof img !== 'undefined' && img && img.width) ? (img.width * (typeof imgScale === 'number' ? imgScale : 1)) : 0;
  const imgH = (typeof img !== 'undefined' && img && img.height) ? (img.height * (typeof imgScale === 'number' ? imgScale : 1)) : 0;

  const out = {};
  Object.keys(src).forEach(grpKey => {
    const grp = src[grpKey];
    if (!grp) { out[grpKey] = grp; return; }
    const copy = Object.assign({}, grp);
    if (imgW > 0 && imgH > 0) {
      ['p1Ref', 'p2Ref'].forEach(rk => {
        const r = copy[rk];
        if (r && typeof r.x === 'number' && typeof r.y === 'number') {
          copy[rk] = { x: r.x / imgW, y: r.y / imgH };
        }
      });
      copy._coordSpace = 'normalized';
    }
    out[grpKey] = copy;
  });
  return out;
}

// กู้ภาพจากไฟล์โปรเจกต์ + ขยายพิกัด overlay กลับให้ตรงภาพที่กู้มา
//   coordsInImageSpace = true → พิกัดในไฟล์เป็น "พิกัดภาพเต็ม" (ไฟล์รุ่นใหม่) ต้องย่อ/ขยายกลับ
//   ถ้า imageData.pdfFileDataUrl มีค่า → ไฟล์นี้เคยเป็น PDF หลายหน้า ให้ restore กลับเป็น PDF
//     (เปิดด้วย pdf.js, render หน้าเดิม, สร้าง thumbnail ใหม่) แทนการแสดงเป็นภาพเดียว
async function restoreProjectImage(imageData, rotation, coordsInImageSpace) {
  if (!imageData) return;
  // รอบ 36: ไฟล์ PDF ต้องกู้ได้แม้ไม่มี dataUrl (เผื่อภาพย่อสร้างไม่สำเร็จตอนเชฟ)
  if (!imageData.dataUrl && !imageData.pdfFileDataUrl) return;

  // ===== กรณีเคยเป็น PDF: เปิด PDF ใหม่จาก base64 =====
  if (imageData.pdfFileDataUrl && typeof pdfjsLib !== 'undefined') {
    try {
      // แปลง base64 data URL → Uint8Array เพื่อส่งให้ pdf.js
      const base64 = imageData.pdfFileDataUrl.split(',')[1] || '';
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      pdfDoc = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      isPDF = true;
      totalPages = pdfDoc.numPages;
      pageNum = (typeof imageData.currentPage === 'number' && imageData.currentPage >= 1 && imageData.currentPage <= totalPages)
        ? imageData.currentPage : 1;
      // เก็บไว้ใน global เพื่อให้บันทึก JSON รอบหน้าแนบกลับได้
      pdfFileDataUrl = imageData.pdfFileDataUrl;
      currentFileName = imageData.name || currentFileName;
      // รอบ 36: เก็บชื่อไฟล์ PDF + ภาพหน้าปัจจุบันไว้ด้วย
      //   (switchMediaViewTab() ใช้ savedPdfFileName/savedPdfPageImageSrc → ไม่งั้นสลับแท็บแล้ว PDF หาย)
      //   ใช้ pdfFileName ที่บันทึกมา (ชื่อไฟล์ PDF จริง) ไม่ใช่ currentFileName (อาจเป็นชื่อรูปที่แสดงอยู่)
      const restoredPdfName = imageData.pdfFileName || imageData.name || '';
      if (typeof savedPdfFileName !== 'undefined') savedPdfFileName = restoredPdfName || savedPdfFileName;

      // สำรองพิกัด overlay ที่อ่านจาก JSON ไว้ก่อน เพราะ renderPDFPage() จะรีเซ็ตตัวแปรเหล่านี้ใน img.onload
      const savedRefPixels = {
        p1: (refPixels && refPixels.p1) ? Object.assign({}, refPixels.p1) : null,
        p2: (refPixels && refPixels.p2) ? Object.assign({}, refPixels.p2) : null
      };
      const savedManualPts = Array.isArray(manualGroundLinePoints) ? manualGroundLinePoints.map(p => Object.assign({}, p)) : [];
      const savedTablePts = Array.isArray(tableGroundLinePoints) ? tableGroundLinePoints.map(p => Object.assign({}, p)) : [];
      const savedCanalLines = Array.isArray(canalLevelDrawingLines) ? canalLevelDrawingLines.map(l => Object.assign({}, l)) : [];
      imageRotation = (typeof rotation === 'number' && isFinite(rotation)) ? (((rotation % 360) + 360) % 360) : 0;
      if (typeof syncRotationButtonLabel === 'function') syncRotationButtonLabel();

      // แสดง thumbnail sidebar
      if (typeof thumbnailsSidebar !== 'undefined' && thumbnailsSidebar) {
        thumbnailsSidebar.style.display = 'flex';
      }
      if (typeof updateFileStatusDisplay === 'function') updateFileStatusDisplay();
      if (typeof renderPDFPage === 'function') await renderPDFPage(pageNum);
      if (typeof generateThumbnails === 'function') generateThumbnails();

      // คืนค่า overlay หลัง renderPDFPage เสร็จสิ้น พร้อมขยายพิกัดจากพิกัดภาพเต็มเป็นพิกัดหน้าจอปัจจุบัน
      refPixels = savedRefPixels;
      manualGroundLinePoints = savedManualPts;
      tableGroundLinePoints = savedTablePts;
      canalLevelDrawingLines = savedCanalLines;
      if (coordsInImageSpace && typeof img !== 'undefined' && img && img.width > 0) {
        const imgK = (imageData.fullWidth && img.width) ? (img.width / imageData.fullWidth) : 1;
        const s = (typeof imgScale === 'number' && isFinite(imgScale) && imgScale > 0) ? imgScale : 1;
        const totalRatio = imgK * s;
        if (totalRatio !== 1 && isFinite(totalRatio) && totalRatio > 0) {
          ['p1', 'p2'].forEach(k => {
            if (refPixels[k]) { refPixels[k].x *= totalRatio; refPixels[k].y *= totalRatio; }
          });
          manualGroundLinePoints.forEach(p => { p.x *= totalRatio; p.y *= totalRatio; });
          tableGroundLinePoints.forEach(p => { p.x *= totalRatio; p.y *= totalRatio; });
          canalLevelDrawingLines.forEach(l => {
            l.x1 *= totalRatio; l.y1 *= totalRatio; l.x2 *= totalRatio; l.y2 *= totalRatio;
          });
        }
      }
      if (typeof redraw === 'function') redraw();
      return; // จบแล้ว ไม่ต้อง restore แบบ image ต่อ
    } catch (e) {
      console.warn('restoreProjectImage: เปิด PDF จาก base64 ล้มเหลว, fallback เป็นภาพ:', e);
      // ตกไปทำ image restoration ด้านล่าง
    }
  }

  // ===== กรณีเป็นภาพธรรมดา =====
  // รอบ 36: ถ้าไม่มี dataUrl (เช่นไฟล์ที่มีแต่ PDF) และกู้ PDF ไม่สำเร็จ → ไม่ต้องทำอะไรต่อ
  if (!imageData.dataUrl) return;

  const restored = new Image();
  // รอบ 30: คืน Promise ให้ผู้เรียกรอจนกว่าภาพโหลดเสร็จ
  //   (เดิมใช้ onload แล้ว return ทันที → restoreMediaState คำนวณพิกัด P1/P2 จาก img ที่ยังไม่พร้อม)
  await new Promise((resolve) => {
    restored.onload = () => {
      // ไฟล์แนบภาพอาจถูกย่อไว้ (PROJECT_IMAGE_MAX_SIDE) → หาอัตราส่วน "ภาพเต็ม → ภาพที่แนบมา"
      let imgK = (imageData.fullWidth && restored.width) ? (restored.width / imageData.fullWidth) : 1;
      if (coordsInImageSpace && isFinite(imgK) && imgK > 0) {
        if (imgK !== 1 && typeof scaleOverlayPixels === 'function') scaleOverlayPixels(imgK);
        imgScale = 1;      // ให้ fitImageToViewportWithPadding() เป็นตัวขยายเป็นพิกัดหน้าจอ (ratio = สเกลใหม่)
      }
      img = restored;
      isPDF = false;
      totalPages = 1;
      pageNum = 1;
      pdfDoc = null;
      pdfFileDataUrl = null; // ภาพธรรมดา ไม่มี PDF
      imageRotation = (typeof rotation === 'number' && isFinite(rotation)) ? (((rotation % 360) + 360) % 360) : 0;
      if (typeof syncRotationButtonLabel === 'function') syncRotationButtonLabel();
      if (typeof updateFileStatusDisplay === 'function') updateFileStatusDisplay();
      if (typeof generateImageThumbnail === 'function') generateImageThumbnail();
      if (typeof fitImageToViewportWithPadding === 'function') fitImageToViewportWithPadding();
      if (typeof redraw === 'function') redraw();
      if (typeof centerImageInViewport === 'function') centerImageInViewport();
      if (typeof updateTable === 'function') updateTable();
      resolve();
    };
    restored.onerror = () => {
      console.warn('restoreProjectImage: โหลดภาพที่แนบมาไม่สำเร็จ');
      resolve();
    };
    if (imageData.name) currentFileName = imageData.name;
    restored.src = imageData.dataUrl;
  });
}

// รอบ 36: แยก "สร้างข้อมูลโปรเจกต์" ออกจาก "บันทึกลงไฟล์" เพื่อให้ระบบเชฟอัตโนมัติ (autosave) ใช้ข้อมูลชุดเดียวกันได้
//   buildProjectBackup() → คืน object ของโปรเจกต์ (ไม่เปิดกล่องบันทึก)
//   saveProjectJSON()    → เรียก buildProjectBackup() แล้วบันทึกลงไฟล์ตามปกติ
async function buildProjectBackup() {
  syncTableInputsToChannels();
  if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();

  // รอบ 35: ใช้ "ชื่อโครงการ" เป็นชื่อไฟล์ที่บันทึก (ไม่ใช้ชื่อไฟล์ภาพที่อัปโหลด)
  let baseName = (typeof projectPlanData !== 'undefined' && projectPlanData && projectPlanData.name)
    ? String(projectPlanData.name).replace(/\.[^/.]+$/, "").trim()
    : "";
  if (!baseName) {
    baseName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, "") : "BCLC_Project";
  }

  // รอบ 30: แนบกรอบรูปที่ตีไว้ + รูปที่อัปโหลดลงไฟล์ (ย่อเป็น JPEG 1800px)
  const cropFramesPayload = await buildCropFramesPayload();

  const projectBackup = {
    version: "2.0",
    savedAt: new Date().toISOString(),
    projectPlanData: projectPlanData,
    channels: channels,
    dimensionRows: dimensionRows,
    levelRowsData: levelRowsData,
    structureRowsData: structureRowsData,
    attachmentRowsData: attachmentRowsData,
    groundRowsData: groundRowsData,
    ditchTypeDatabase: ditchTypeDatabase,
    structureTypeDatabase: structureTypeDatabase,
    imageData: buildProjectImagePayload(),   // ภาพแปลนที่แนบไปกับโปรเจกต์ (เดิมไม่ถูกบันทึก)
    imageRotation: (typeof imageRotation === 'number') ? imageRotation : 0,
    // รอบ 30: กรอบรูปที่ตีไว้ใน PDF + รูปที่อัปโหลด (ให้โหลดไฟล์แล้วกลับมาอัตโนมัติ)
    cropFrames: cropFramesPayload,
    // รอบ 30: จำสถานะแท็บ/กรอบที่ผู้ใช้ทิ้งไว้ เพื่อเปิดไฟล์แล้วกลับมาที่เดิม
    mediaState: {
      activeMediaViewTab: (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'pdf',
      activeCropFrameIndex: (typeof activeCropFrameIndex !== 'undefined') ? activeCropFrameIndex : -1,
      currentPage: (typeof pageNum !== 'undefined') ? pageNum : 1
    },
    // รอบ 30: บันทึก groupState (ค่า P1/P2 รายคู, สถานะล็อก/พับ) — เดิมอ่านได้แต่ไม่เคยเขียน
    groupState: {
      levelGroupState: (typeof levelGroupState !== 'undefined') ? levelGroupState : {},
      groundGroupState: buildGroundGroupStateForSave(),
      structureGroupState: (typeof structureGroupState !== 'undefined') ? structureGroupState : {},
      attachmentGroupState: (typeof attachmentGroupState !== 'undefined') ? attachmentGroupState : {}
    },
    // รอบ 30: ผลการอ่านของ AI + ป้ายที่ผู้ใช้จับย้ายบนภาพ
    aiData: {
      refPoints: (typeof aiRefPoints !== 'undefined') ? aiRefPoints : {},
      labels: (typeof aiLabels !== 'undefined') ? aiLabels : {},
      // รอบ 36: บันทึก "ผลอ่าน AI" ของแท็บ 🤖 ผลอ่าน AI แบบเต็ม (แยกตามกรอบรูป)
      //   เดิมบันทึกแค่ refPoints/labels (ข้อมูลดิบของ AI) → เปิดไฟล์ใหม่แล้วแท็บผลอ่าน AI ว่างเปล่า
      results: buildAiResultsPayload()
    },
    canvasLabels: (typeof canvasLabels !== 'undefined') ? ((Array.isArray(canvasLabels) && canvasLabels.length > 0 ? canvasLabels : ((typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab && mediaDrawingStateByTab.image && Array.isArray(mediaDrawingStateByTab.image.canvasLabels)) ? mediaDrawingStateByTab.image.canvasLabels : [])).map(l => {
      if (!l) return l;
      const copy = Object.assign({}, l);
      const curFrameId = (typeof getCurrentDisplayedFrameId === 'function') ? getCurrentDisplayedFrameId() : null;
      const lw = (typeof img !== 'undefined' && img && img.width && typeof imgScale === 'number' && imgScale > 0) ? (img.width * imgScale) : 0;
      const lh = (typeof img !== 'undefined' && img && img.height && typeof imgScale === 'number' && imgScale > 0) ? (img.height * imgScale) : 0;
      if (lw > 0 && lh > 0 && (!copy.frameId || copy.frameId === curFrameId)) {
        if (typeof copy.x === 'number') copy.normX = copy.x / lw;
        if (typeof copy.y === 'number') copy.normY = copy.y / lh;
        if (typeof copy.x2 === 'number') copy.normX2 = copy.x2 / lw;
        if (typeof copy.y2 === 'number') copy.normY2 = copy.y2 / lh;
      }
      return copy;
    })) : [],
    mediaDrawingStateByTab: (typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab) ? JSON.parse(JSON.stringify(mediaDrawingStateByTab)) : undefined,
    // coordSpace: 'image' = พิกัด overlay ในไฟล์เป็นพิกัดพิกเซลของภาพเต็ม (ไม่ขึ้นกับซูม/ขนาดหน้าต่าง)
    drawingData: Object.assign({
      coordSpace: 'image',
      p1XVal: document.getElementById('p1XVal').value,
      p1YVal: document.getElementById('p1YVal').value,
      p2XVal: document.getElementById('p2XVal').value,
      p2YVal: document.getElementById('p2YVal').value
    }, buildOverlayPayload())
  };

  return projectBackup;
}

// รอบ 36: สร้าง "ผลอ่าน AI" ที่จะบันทึกลงไฟล์ (แยกตามกรอบรูป)
//   เก็บเฉพาะข้อมูลที่แท็บ 🤖 ผลอ่าน AI ใช้แสดงผล (ไม่เก็บ field ภายในอย่าง raw ที่ใหญ่โดยไม่จำเป็น)
function buildAiResultsPayload() {
  const list = (typeof aiLastResults !== 'undefined' && Array.isArray(aiLastResults)) ? aiLastResults : [];
  return list.map((res) => {
    if (!res || typeof res !== 'object') return null;
    const copy = {
      frameId: res.frameId || null,
      frameName: res.frameName || '',
      channels: Array.isArray(res.channels) ? res.channels : [],
      refPoints: res.refPoints || null,
      labels: Array.isArray(res.labels) ? res.labels : [],
      levelLines: Array.isArray(res.levelLines) ? res.levelLines : [],
      groundLine: Array.isArray(res.groundLine) ? res.groundLine : []
    };
    if (typeof res.elapsedSec === 'number') copy.elapsedSec = res.elapsedSec;
    return copy;
  }).filter(Boolean);
}

// รอบ 36: คืนผลอ่าน AI จากไฟล์ → กลับไปเป็น aiLastResults (ใช้ render แท็บผลอ่าน AI ต่อได้)
function restoreAiResultsPayload(results) {
  if (!Array.isArray(results)) return [];
  return results.filter(r => r && typeof r === 'object').map((r) => ({
    frameId: r.frameId || null,
    frameName: r.frameName || '',
    channels: Array.isArray(r.channels) ? r.channels : [],
    refPoints: r.refPoints || null,
    labels: Array.isArray(r.labels) ? r.labels : [],
    levelLines: Array.isArray(r.levelLines) ? r.levelLines : [],
    groundLine: Array.isArray(r.groundLine) ? r.groundLine : [],
    elapsedSec: (typeof r.elapsedSec === 'number') ? r.elapsedSec : undefined
  }));
}

async function saveProjectJSON() {
  // รอบ 41: ถามว่าจะตรวจสอบข้อมูลก่อนบันทึกไหม
  if (typeof confirmValidateBeforeSave === 'function') {
    const proceed = await confirmValidateBeforeSave('บันทึก');
    if (proceed === false) return;
  }

  const projectBackup = await buildProjectBackup();

  // รอบ 35: ใช้ "ชื่อโครงการ" เป็นชื่อไฟล์ที่บันทึก
  let baseName = (typeof projectPlanData !== 'undefined' && projectPlanData && projectPlanData.name)
    ? String(projectPlanData.name).replace(/\.[^/.]+$/, "").trim()
    : "";
  if (!baseName) {
    baseName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, "") : "BCLC_Project";
  }
  const defaultFileName = `${baseName}_Project.json`;

  const jsonStr = JSON.stringify(projectBackup, null, 2);
  const blobSize = new Blob([jsonStr]).size;

  // รอบ 30: กันไฟล์บันทึกใหญ่เกินไป — เสนอให้บันทึกโดยไม่แนบรูป
  let finalBlob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  if (blobSize > PROJECT_FILE_SIZE_WARN && Array.isArray(projectBackup.cropFrames) && projectBackup.cropFrames.length > 0) {
    const sizeMB = (blobSize / 1024 / 1024).toFixed(1);
    const warnMsg =
      `ไฟล์บันทึกมีขนาด ${sizeMB} MB (ใหญ่เกิน 20 MB)\n\n` +
      `กด "บันทึกครบ" = บันทึกตามปกติ (แนบรูปครบ)\n` +
      `กด "ไม่แนบรูป" = บันทึกโดยไม่แนบรูป (ไฟล์เล็ก)`;
    const choice = (typeof uiConfirm === 'function' && typeof uiConfirmOverlay !== 'undefined' && uiConfirmOverlay)
      ? await new Promise((resolve) => {
          uiConfirm(warnMsg, () => resolve(true), {
            okText: 'บันทึกครบ',
            cancelText: 'ไม่แนบรูป',
            onCancel: () => resolve(false)
          });
        })
      : true;
    if (!choice) {
      projectBackup.cropFrames = [];
      projectBackup.imageData = null;
      const leanStr = JSON.stringify(projectBackup, null, 2);
      finalBlob = new Blob([leanStr], { type: 'application/json;charset=utf-8;' });
    }
  }

  let saved = await saveFileWithDialog(finalBlob, defaultFileName, 'JSON Files', ['.json']);
  if (saved) {
    // รอบ 44: แจ้งเตือนแบบหน้าต่างเล็ก ๆ มุมบนขวา (แทน alert กลางจอ)
    if (typeof showSaveToast === 'function') {
      showSaveToast('บันทึกข้อมูลโปรเจกต์ JSON เรียบร้อยแล้ว!', 'success');
    } else {
      alert('บันทึกข้อมูลโปรเจกต์ JSON เรียบร้อยแล้ว!');
    }
  }
}

function loadProjectJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const data = JSON.parse(event.target.result);
      const success = await loadProjectDataObject(data);
      if (success) {
        alert('โหลดข้อมูลโครงการ JSON สำเร็จเรียบร้อยแล้ว!');
      }
    } catch (err) {
      alert('ไม่สามารถอ่านไฟล์ JSON ได้: ' + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = '';
}

// แยก logic ออกมาให้ reuse ได้ (ใช้กับ loadProjectJSON)
async function loadProjectDataObject(data) {
  if (!data) return false;
  try {
    // ⚠️ ทุกก้อนต้อง "ตั้งค่าใหม่" ไม่ใช่เขียนทับเฉพาะเมื่อมีคีย์
    //    ไม่งั้นไฟล์ที่ไม่มีคีย์นั้น (เช่นไฟล์ที่บันทึกก่อนมีแท็บอาคารท่อรับน้ำ) จะเหลือข้อมูลโปรเจกต์เดิมค้างอยู่
    projectPlanData = data.projectPlanData || { name: "", location: "", description: "" };
    channels = data.channels || [{ id: 1, canal: "คลอง", ditch: "01", totalArea: "", waterArea: "", collapsed: false, rows: [] }];
    ensureChannelIds();
    dimensionRows = migrateRowsToChannelId(data.dimensionRows);
    levelRowsData = migrateRowsToChannelId(data.levelRowsData);
    structureRowsData = migrateRowsToChannelId(data.structureRowsData).map(s => {
      let row = Object.assign({}, s);
      if (row.remark === "-") row.remark = "";
      return row;
    });
    attachmentRowsData = migrateRowsToChannelId(data.attachmentRowsData);
    groundRowsData = migrateRowsToChannelId(data.groundRowsData);
    const _defaultDitchTypes = ["VU1", "VU2", "VU3", "VU4", "VU5", "VU6"];
    ditchTypeDatabase = data.ditchTypeDatabase
      ? data.ditchTypeDatabase.map((d, idx) => {
          const item = {
            type: String(d.type),
            b: parseFloat(d.b),
            h: parseFloat(d.h),
            tw: getDitchTypeThickness(d, 'tw'),
            tf: getDitchTypeThickness(d, 'tf')
          };
          if (d._userAdded || (idx >= _defaultDitchTypes.length && !_defaultDitchTypes.includes(item.type))) {
            item._userAdded = true;
          }
          return item;
        })
      : JSON.parse(JSON.stringify(ditchTypeDefaultsSnapshot));
    structureTypeDatabase = data.structureTypeDatabase
      ? data.structureTypeDatabase.map(normalizeStructureTypeEntry)
      : JSON.parse(JSON.stringify(structureTypeDefaultsSnapshot));
    structureTypeDBMeta = {};
    structureTypeDatabase.forEach(t => {
      if (!t || !t.type) return;
      let isBuiltin = structureTypeDefaultsSnapshot.some(b => b && b.type === t.type);
      if (!isBuiltin) structureTypeDBMeta[t.type] = { userAdded: true };
    });

    // รีเซ็ตข้อมูล overlay ทั้งหมดก่อนอ่านไฟล์
    refPixels = { p1: null, p2: null };
    manualGroundLinePoints = [];
    tableGroundLinePoints = [];
    canalLevelDrawingLines = [];
    if (typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab) {
      mediaDrawingStateByTab.pdf = { manualGroundLinePoints: [], tableGroundLinePoints: [], canalLevelDrawingLines: [], canvasLabels: [] };
      mediaDrawingStateByTab.image = { manualGroundLinePoints: [], tableGroundLinePoints: [], canalLevelDrawingLines: [], canvasLabels: [] };
    }

    if (data.drawingData) {
      if (data.drawingData.refPixels) refPixels = data.drawingData.refPixels;
      if (data.drawingData.manualGroundLinePoints) manualGroundLinePoints = data.drawingData.manualGroundLinePoints;
      if (data.drawingData.tableGroundLinePoints) tableGroundLinePoints = data.drawingData.tableGroundLinePoints;
      if (data.drawingData.canalLevelDrawingLines) canalLevelDrawingLines = data.drawingData.canalLevelDrawingLines;
      if (data.drawingData.p1XVal !== undefined) document.getElementById('p1XVal').value = data.drawingData.p1XVal;
      if (data.drawingData.p1YVal !== undefined) document.getElementById('p1YVal').value = data.drawingData.p1YVal;
      if (data.drawingData.p2XVal !== undefined) document.getElementById('p2XVal').value = data.drawingData.p2XVal;
      if (data.drawingData.p2YVal !== undefined) document.getElementById('p2YVal').value = data.drawingData.p2YVal;
    }

    // รอบ 31: เก็บ groupState จากข้อมูล (ถ้ามี) — มิเช่นนั้นล้างใหม่
    levelGroupState = data.groupState ? data.groupState.levelGroupState || {} : {};
    groundGroupState = data.groupState ? data.groupState.groundGroupState || {} : {};
    structureGroupState = data.groupState ? data.groupState.structureGroupState || {} : {};
    attachmentGroupState = data.groupState ? data.groupState.attachmentGroupState || {} : {};
    activeChannelId = channels[0] ? channels[0].id : 0;

    // รอบ 30: กู้กรอบรูปที่ตีไว้ใน PDF + รูปที่อัปโหลดก่อนกู้ภาพหลัก
    //   (ต้องกู้ก่อน เพื่อให้ mediaState.activeCropFrameIndex อ้างถึงกรอบที่มีอยู่จริง)
    if (typeof restoreCropFrames === 'function') {
      try {
        await restoreCropFrames(data.cropFrames);
      } catch (e) {
        console.warn('restoreCropFrames ล้มเหลว:', e);
      }
    }

    // รอบ 30: กู้ผลการอ่านของ AI + ป้ายที่ผู้ใช้จับย้ายไว้
    aiRefPoints = (data.aiData && data.aiData.refPoints) ? data.aiData.refPoints : {};
    aiLabels = (data.aiData && data.aiData.labels) ? data.aiData.labels : {};
    canvasLabels = Array.isArray(data.canvasLabels) ? data.canvasLabels : [];

    // รอบ 36: กู้ "ผลอ่าน AI" ของแท็บ 🤖 ผลอ่าน AI (ไฟล์เก่าที่ไม่มี field นี้ → ใช้ array ว่าง)
    aiLastResults = restoreAiResultsPayload(data.aiData && data.aiData.results);
    if (typeof currentTab !== 'undefined' && currentTab === 'ai-result' && typeof renderAiResultTab === 'function') {
      renderAiResultTab(aiLastResults);
    }

    // กู้ภาพแปลนที่แนบมากับไฟล์ (ถ้ามี) — ถ้าเคยเป็น PDF จะ restore กลับเป็น PDF หลายหน้า
    if (typeof restoreProjectImage === 'function') {
      try {
        await restoreProjectImage(data.imageData, data.imageRotation,
          !!(data.drawingData && data.drawingData.coordSpace === 'image'));
      } catch (e) {
        console.warn('restoreProjectImage ล้มเหลว:', e);
      }
    }
    let hasOverlay = !!(refPixels.p1 || refPixels.p2) ||
      manualGroundLinePoints.length > 0 || tableGroundLinePoints.length > 0 || canalLevelDrawingLines.length > 0;
    if (!data.imageData && hasOverlay) {
      alert('ไฟล์นี้ไม่ได้แนบภาพแปลนมาด้วย\nกรุณาอัปโหลดไฟล์ภาพเดิมอีกครั้ง แล้วจุด/เส้นจะกลับมาตรงตำแหน่ง');
    }

    // รอบ 30: คืนสถานะแท็บ/กรอบที่ผู้ใช้ทิ้งไว้ + โหลดกรอบเข้า canvas อัตโนมัติ
    await restoreMediaState(data.mediaState);

    if (typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab) {
      mediaDrawingStateByTab.image = {
        manualGroundLinePoints: Array.isArray(manualGroundLinePoints) ? manualGroundLinePoints.slice() : [],
        tableGroundLinePoints: Array.isArray(tableGroundLinePoints) ? tableGroundLinePoints.slice() : [],
        canalLevelDrawingLines: Array.isArray(canalLevelDrawingLines) ? canalLevelDrawingLines.slice() : [],
        canvasLabels: Array.isArray(canvasLabels) ? canvasLabels.slice() : []
      };
      if (data.mediaDrawingStateByTab && data.mediaDrawingStateByTab.pdf) {
        mediaDrawingStateByTab.pdf = {
          manualGroundLinePoints: Array.isArray(data.mediaDrawingStateByTab.pdf.manualGroundLinePoints) ? data.mediaDrawingStateByTab.pdf.manualGroundLinePoints.slice() : [],
          tableGroundLinePoints: Array.isArray(data.mediaDrawingStateByTab.pdf.tableGroundLinePoints) ? data.mediaDrawingStateByTab.pdf.tableGroundLinePoints.slice() : [],
          canalLevelDrawingLines: Array.isArray(data.mediaDrawingStateByTab.pdf.canalLevelDrawingLines) ? data.mediaDrawingStateByTab.pdf.canalLevelDrawingLines.slice() : [],
          canvasLabels: Array.isArray(data.mediaDrawingStateByTab.pdf.canvasLabels) ? data.mediaDrawingStateByTab.pdf.canvasLabels.slice() : []
        };
      }
      if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'pdf' && typeof restoreDrawingStateForTab === 'function') {
        restoreDrawingStateForTab('pdf');
      }
    }

    if (typeof syncDimensionRowsWithChannels === 'function') syncDimensionRowsWithChannels();
    if (typeof updateTable === 'function') updateTable();
    if (typeof redraw === 'function') redraw();
    return true;
  } catch (err) {
    console.error('loadProjectDataObject:', err);
    return false;
  }
}

// รอบ 30: คืนสถานะส่วนแสดงรูปหลังโหลดไฟล์ —
//   1) สลับแท็บที่ผู้ใช้ทิ้งไว้ (pdf / image / draw)
//   2) โหลดกรอบรูปที่ active กลับเข้า canvas (auto upload)
//   3) ขยายพิกัด P1/P2 ที่บันทึกเป็นสัดส่วน 0..1 กลับเป็นพิกัดหน้าจอ
async function restoreMediaState(mediaState) {
  const ms = mediaState || {};

  // ── ขยายพิกัด P1/P2 ของแต่ละชุดกลับเป็นพิกัดหน้าจอ ──
  const imgW = (typeof img !== 'undefined' && img && img.width) ? (img.width * (typeof imgScale === 'number' ? imgScale : 1)) : 0;
  const imgH = (typeof img !== 'undefined' && img && img.height) ? (img.height * (typeof imgScale === 'number' ? imgScale : 1)) : 0;
  if (imgW > 0 && imgH > 0 && typeof groundGroupState !== 'undefined' && groundGroupState) {
    Object.keys(groundGroupState).forEach(grpKey => {
      const grp = groundGroupState[grpKey];
      if (!grp || grp._coordSpace !== 'normalized') return;
      ['p1Ref', 'p2Ref'].forEach(rk => {
        const r = grp[rk];
        if (r && typeof r.x === 'number' && typeof r.y === 'number') {
          grp[rk] = { x: r.x * imgW, y: r.y * imgH };
        }
      });
      grp._coordSpace = 'screen';
    });
  }

  // ── สลับแท็บส่วนแสดงรูป ──
  const targetTab = ms.activeMediaViewTab || 'pdf';
  if (typeof activeMediaViewTab !== 'undefined') {
    activeMediaViewTab = targetTab;
    // อัปเดตปุ่มแท็บที่ active ให้ตรงกับ (ไม่เรียก switchMediaViewTab เพราะจะรีเซ็ตภาพทิ้ง)
    ["pdf", "image", "draw"].forEach(k => {
      const btn = document.getElementById("media-tab-" + k);
      if (btn) btn.classList.toggle("active", k === targetTab);
    });
    if (typeof syncSideControlPanelByMediaTab === 'function') syncSideControlPanelByMediaTab();
  }

  // ── คืนหน้า PDF ──
  if (targetTab === 'pdf' && typeof pageNum !== 'undefined' && typeof ms.currentPage === 'number') {
    pageNum = ms.currentPage;
  }

  // ── โหลดกรอบรูปที่ active กลับเข้า canvas ──
  if (typeof pdfCropFrames !== 'undefined' && pdfCropFrames.length > 0) {
    let wantIdx = (typeof ms.activeCropFrameIndex === 'number') ? ms.activeCropFrameIndex : 0;
    if (wantIdx < 0 || wantIdx >= pdfCropFrames.length) wantIdx = 0;
    activeCropFrameIndex = wantIdx;
    if (targetTab === 'image' && typeof loadCropFrameIntoViewer === 'function') {
      try {
        await loadCropFrameIntoViewer(wantIdx);
      } catch (e) {
        console.warn('restoreMediaState: โหลดกรอบรูปกลับไม่สำเร็จ:', e);
      }
    }
  }
  if (typeof resyncCanvasLabelsForActiveFrame === 'function') {
    resyncCanvasLabelsForActiveFrame();
  }
}

// รอบ 42: แยก "การเตรียมข้อมูลทุกชีต" ออกจาก "การบันทึกไฟล์จริง"
//   → หน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก" (js/tab-export-preview.js) เรียกใช้ข้อมูลชุดเดียวกันนี้ได้
//   คืนค่าเป็นอาร์เรย์ [{ name: 'ชื่อชีต', rows: [[...],[...]] }, ...]
function buildExportSheetsData() {
  syncTableInputsToChannels();
  const sheets = [];

  const wsProjectData = [
    ["หัวข้อ", "รายละเอียด"],
    ["ชื่อแผนงาน/โครงการ", projectPlanData.name || ""],
    ["ที่อยู่/สถานที่ดำเนินโครงการ", projectPlanData.location || ""],
    ["รายละเอียดโครงการ", projectPlanData.description || ""]
  ];
  sheets.push({ name: "แผนงานโครงการ", rows: wsProjectData });

  const wsDitchData = [["คลองส่งน้ำ", "คูส่งน้ำ", "พื้นที่ทั้งหมด (ไร่)", "พื้นที่ส่งน้ำ (ไร่)"]];
  channels.forEach(ch => {
    // ช่องว่างต้องคงเป็นช่องว่าง (เดิมเขียน 0 → นำเข้ากลับได้ "0" แทนที่จะว่าง)
    let ta = parseFloat(ch.totalArea), wa = parseFloat(ch.waterArea);
    wsDitchData.push([
      ch.canal || "คลอง", ch.ditch || "-",
      (ch.totalArea === "" || ch.totalArea === undefined || isNaN(ta)) ? "" : ta,
      (ch.waterArea === "" || ch.waterArea === undefined || isNaN(wa)) ? "" : wa
    ]);
  });
  sheets.push({ name: "ระบบคูส่งน้ำ", rows: wsDitchData });

  // คอลัมน์สุดท้าย "ลำดับคู" (1,2,3,...) = index ของคูในชีต "ระบบคูส่งน้ำ"
  // ใช้จับคู่แถวกลับเข้าคูให้ถูกตัวตอนนำเข้า แม้ผู้ใช้ตั้งชื่อ คลอง/คู ซ้ำกัน
  const wsDimData = [["คลองส่งน้ำ", "คูส่งน้ำ", "กม.เริ่มต้น", "กม.สิ้นสุด", "Q", "SLOPE", "B", "D", "TYPE", "TBL", "TBR", "ลำดับคู"]];
  dimensionRows.forEach(r => {
    let chObj = getChannelById(r.channelId) || { canal: "คลอง", ditch: "-" };
    wsDimData.push([
      chObj.canal, chObj.ditch,
      formatKmForExport(r.kmStart),
      formatKmForExport(r.kmEnd),
      r.q !== "" ? Number(r.q) : "",
      r.slope !== "" ? Number(r.slope) : "",
      r.b !== "" ? Number(r.b) : "",
      r.d !== "" ? Number(r.d) : "",
      r.type || "",
      r.tbl !== "" ? Number(r.tbl) : "",
      r.tbr !== "" ? Number(r.tbr) : "",
      getChannelIndexById(r.channelId) + 1
    ]);
  });
  sheets.push({ name: "มิติคูส่งน้ำ", rows: wsDimData });

  // รอบ 41 / รอบ 48: เพิ่มคอลัมน์ "ช่วงคูน้ำ" และคอลัมน์ "กม. P1", "ระดับ P1", "กม. P2", "ระดับ P2" (ที่แถวแรกของแต่ละคู)
  const wsGroundData = [["คลองส่งน้ำ", "คูส่งน้ำ", "กม.", "ระดับดินเดิม (ม.)", "ลำดับคู", "ช่วงคูน้ำ", "กม. P1", "ระดับ P1", "กม. P2", "ระดับ P2"]];
  let lastExportGroundChId = -1;
  groundRowsData.forEach(grow => {
    let chObj = getChannelById(grow.channelId) || { canal: "คลอง", ditch: "-" };
    let isFirstOfChan = (grow.channelId !== lastExportGroundChId);
    lastExportGroundChId = grow.channelId;
    let gGrp = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState["ground_ch_" + grow.channelId] : null;
    let p1KmOut = (isFirstOfChan && gGrp && gGrp.p1Km !== undefined && gGrp.p1Km !== "") ? formatKmForExport(gGrp.p1Km) : "";
    let p1ElevOut = (isFirstOfChan && gGrp && gGrp.p1Elev !== undefined && gGrp.p1Elev !== "" && !isNaN(Number(gGrp.p1Elev))) ? Number(gGrp.p1Elev) : "";
    let p2KmOut = (isFirstOfChan && gGrp && gGrp.p2Km !== undefined && gGrp.p2Km !== "") ? formatKmForExport(gGrp.p2Km) : "";
    let p2ElevOut = (isFirstOfChan && gGrp && gGrp.p2Elev !== undefined && gGrp.p2Elev !== "" && !isNaN(Number(gGrp.p2Elev))) ? Number(gGrp.p2Elev) : "";
    wsGroundData.push([
      chObj.canal, chObj.ditch,
      formatKmForExport(grow.km),
      grow.groundElevation !== "" ? Number(grow.groundElevation) : "",
      getChannelIndexById(grow.channelId) + 1,
      (typeof getDitchSectionIndex === 'function' ? getDitchSectionIndex(grow.channelId, grow) : ""),
      p1KmOut, p1ElevOut, p2KmOut, p2ElevOut
    ]);
  });
  sheets.push({ name: "ระดับดินเดิม", rows: wsGroundData });

  const wsLevelData = [["คลองส่งน้ำ", "คูส่งน้ำ", "TYPE", "H TBL (ม.)", "SLOPE", "กม.เริ่มต้น", "H (ม.)", "ระดับ BL. เริ่มต้น", "ระดับ TBL เริ่มต้น", "กม.สิ้นสุด", "ระดับ BL. สิ้นสุด", "ระดับ TBL สิ้นสุด", "ลำดับคู", "ช่วงคูน้ำ"]];
  levelRowsData.forEach(lvl => {
    let cIdx = lvl.channelId;
    let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
    let dimItem = dimensionRows.find(d => d.channelId === cIdx);
    let curType = lvl.isDynamicRow ? (lvl.customType || (dimItem ? dimItem.type : "VU1")) : (dimItem ? dimItem.type : "VU1");
    let hTbl = getHFromType(curType);
    let curSlope = lvl.isDynamicRow ? lvl.customSlope : (dimItem ? dimItem.slope : 4000);
    // ใช้ค่า กม. ของแถวระดับเองก่อน (ถ้าว่างจึงใช้ของแท็บมิติ) — เดิมใช้ของแท็บมิติเสมอ ทำให้ค่าที่ส่งออกไม่ตรงกับที่เห็นในตาราง
    let curKmStart = (lvl.customKmStart !== "" && lvl.customKmStart !== undefined)
      ? lvl.customKmStart
      : (dimItem ? dimItem.kmStart : "");
    let curKmEnd = lvl.customKmEnd !== "" ? lvl.customKmEnd : getChannelKmEnd(cIdx);
    wsLevelData.push([
      chObj.canal, chObj.ditch, curType, Number(hTbl), Number(curSlope),
      formatKmForExport(curKmStart), parseFloat(lvl.h) || 0,
      lvl.bl1 !== "" ? Number(lvl.bl1) : "",
      lvl.tbl1 !== "" ? Number(lvl.tbl1) : "",
      formatKmForExport(curKmEnd),
      lvl.bl2 !== "" ? Number(lvl.bl2) : "",
      lvl.tbl2 !== "" ? Number(lvl.tbl2) : "",
      getChannelIndexById(cIdx) + 1,
      (typeof getDitchSectionIndex === 'function' ? getDitchSectionIndex(cIdx, lvl) : "")
    ]);
  });
  sheets.push({ name: "ระดับคูส่งน้ำ", rows: wsLevelData });

  const wsStructureData = [["คลองส่งน้ำ", "คูส่งน้ำ", "กม.", "รายการอาคาร", "ประเภทอาคาร", "H (ม.)", "ศก. ท่อ (ม.)", "ความยาว (ม.)", "หมายเหตุ", "UP", "DOWN", "ลำดับคู", "จากระดับ", "ช่วงคูน้ำ"]];
  structureRowsData.forEach(srow => {
    let chObj = getChannelById(srow.channelId) || { canal: "คลอง", ditch: "-" };
    let itemName = computeStructureItemName(srow, srow.channelId);
    // คอลัมน์ที่ล็อกตามตาราง Typeอาคารประกอบ ให้เขียนค่าจากตาราง · ช่องที่เป็น "-" ให้เซฟเป็น 0
    // (ยกเว้น "หมายเหตุ" ที่เป็นข้อความ)
    let entry = getStructureTypeEntry(srow.name);
    wsStructureData.push([
      chObj.canal, chObj.ditch,
      formatKmForExport(srow.km),
      itemName, srow.name || "-ไม่มี-",
      structureNumericForFile(entry ? entry.hEditable : false, entry ? entry.h : "", srow.hOverride),
      structureNumericForFile(entry ? entry.diaEditable : false, entry ? entry.pipeDia : "", srow.pipeDia),
      structureNumericForFile(entry ? entry.lenEditable : false, entry ? entry.length : "", srow.pipeCount),
      structureRemarkForFile(entry ? entry.remarkEditable : false, entry ? entry.remark : "", srow.remark),
      (typeof computeStructureUpDownTypes === 'function' ? computeStructureUpDownTypes(srow).up : '-'),
      (typeof computeStructureUpDownTypes === 'function' ? computeStructureUpDownTypes(srow).down : '-'),
      getChannelIndexById(srow.channelId) + 1,
      srow.isFromLevel ? 1 : "",
      (typeof getDitchSectionIndex === 'function' ? getDitchSectionIndex(srow.channelId, srow) : "")
    ]);
  });
  sheets.push({ name: "อาคารประกอบ", rows: wsStructureData });

  const wsAttachmentData = [["คลองส่งน้ำ", "คูส่งน้ำ", "รายการอาคาร", "จำนวนอาคาร", "H (ม.)", "ศก. ท่อ (ม.)", "ความยาว (ม.)", "หมายเหตุ", "ลำดับคู", "ช่วงคูน้ำ"]];
  attachmentRowsData.forEach(row => {
    let chObj = getChannelById(row.channelId) || { canal: "คลอง", ditch: "-" };
    wsAttachmentData.push([
      chObj.canal, chObj.ditch,
      row.name || ATTACHMENT_BASE_NAME,
      row.count !== "" && row.count !== undefined ? row.count : "1",
      row.h !== "" && row.h !== undefined ? Number(row.h) : "",
      row.pipeDia !== "" && row.pipeDia !== undefined ? Number(row.pipeDia) : "",
      row.length !== "" && row.length !== undefined ? Number(row.length) : "",
      row.remark || "",
      getChannelIndexById(row.channelId) + 1,
      (typeof getDitchSectionIndex === 'function' ? getDitchSectionIndex(row.channelId, row) : "")
    ]);
  });
  sheets.push({ name: "อาคารท่อรับน้ำเข้าแปลงไร่นา", rows: wsAttachmentData });

  // ===== ชีต "setting" (จัดเรียงตามที่เจ้าของงานกำหนด) =====
  //   A–F = ตาราง "Typeคูส่งน้ำ"  (A=Type, C=B, D=H, E=ความหนากำแพง, F=ความหนาพื้น)
  //   G   = เว้นว่างไว้ 1 คอลัมน์ คั่นระหว่างสองตาราง
  //   H–M = ตาราง "Typeอาคารประกอบ" (H=ประเภทอาคาร, I=H (ม.), J=ศก. ท่อ (ม.), K=ความยาว (ม.), L=หมายเหตุ, M=ชื่ออาคารประกอบ)
  //         ช่องที่ล็อกจะเขียนเป็นค่าว่าง และตอนนำเข้ากลับจะเติมกฎล็อก/แก้ไขจากค่าตั้งต้นให้
  //         คอลัมน์ M เป็นค่าคำนวณ (ไม่ต้องอ่านกลับ)
  const wsTypeData = [["Typeคูส่งน้ำ", "", "B (ม.)", "H (ม.)", "ความหนากำแพง (ม.)", "ความหนาพื้น (ม.)", "", "ประเภทอาคาร", "H (ม.)", "ศก. ท่อ (ม.)", "ความยาว (ม.)", "หมายเหตุ", "ชื่ออาคารประกอบ", "UP", "DOWN"]];
  const typeRowCount = Math.max(ditchTypeDatabase.length, structureTypeDatabase.length);
  for (let i = 0; i < typeRowCount; i++) {
    let d = ditchTypeDatabase[i];
    let row = d
      // ไม่ต้องเขียนธง _userAdded ลงไฟล์ (เป็นข้อมูลภายในของหน้าเว็บ)
      ? [d.type, "", Number(d.b), Number(d.h), getDitchTypeThickness(d, 'tw'), getDitchTypeThickness(d, 'tf'), "", "", "", "", "", "", "", "", ""]
      : ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    let sEntry = structureTypeDatabase[i];
    if (sEntry) {
      row[7] = sEntry.type || "";
      row[8] = sEntry.hEditable ? (sEntry.h || "") : "";
      row[9] = sEntry.diaEditable ? (sEntry.pipeDia || "") : "";
      row[10] = sEntry.lenEditable ? (sEntry.length || "") : "";
      row[11] = sEntry.remarkEditable ? (sEntry.remark || "") : "";
      row[12] = computeStructureTypeName(sEntry);
      row[13] = sEntry.up || "-";
      row[14] = sEntry.down || "-";
    }
    wsTypeData.push(row);
  }
  sheets.push({ name: "setting", rows: wsTypeData });

  return sheets;
}

// รอบ 42: สร้าง workbook จากข้อมูลที่เตรียมไว้ (ใช้ร่วมกันระหว่างหน้าต่างตรวจสอบกับการบันทึกจริง)
function buildExportWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  (sheets || []).forEach(sh => {
    if (!sh || !sh.name) return;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows || []), sh.name);
  });
  return wb;
}

// รอบ 42: ชื่อไฟล์เริ่มต้นของไฟล์ Excel (ใช้ชื่อโครงการ)
// รอบ 46 / รอบ 52: สร้างและดาวน์โหลดไฟล์ "ตัวอย่างไฟล์นำเข้า" (สร้างเฉพาะแท็บ 1–7 และเฉพาะคอลัมน์ที่อยู่ในตารางเท่านั้น)
async function downloadSampleImportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('โหลดไลบรารี Excel (SheetJS) ไม่สำเร็จ — กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต');
    return false;
  }
  const sampleSheets = [
    {
      name: "แผนงานโครงการ",
      rows: [
        ["หัวข้อ", "รายละเอียด"],
        ["ชื่อแผนงาน/โครงการ", "โครงการจัดรูปที่ดินระบบคูส่งน้ำสายหลัก (ตัวอย่าง)"],
        ["ที่อยู่/สถานที่ดำเนินโครงการ", "ตำบลบ้านใหม่ อำเภอเมือง จังหวัดเชียงใหม่"],
        ["รายละเอียดโครงการ", "ตัวอย่างไฟล์นำเข้าสำหรับระบบ BCLC FAST"]
      ]
    },
    {
      name: "ระบบคูส่งน้ำ",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "พื้นที่ทั้งหมด (ไร่)", "พื้นที่ส่งน้ำ (ไร่)"],
        ["คลองสายใหญ่", "01", 120.50, 95.00],
        ["คลองสายใหญ่", "02", 85.00, 70.00]
      ]
    },
    {
      name: "มิติคูส่งน้ำ",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "กม.เริ่มต้น", "กม.สิ้นสุด", "Q", "SLOPE", "B", "D", "TYPE", "TBL", "TBR"],
        ["คลองสายใหญ่", "01", "0+000", "0+200", 0.030, 4000, 0.35, 0.36, "VU1", 0.50, 0.50],
        ["คลองสายใหญ่", "02", "0+000", "0+150", 0.060, 3000, 0.50, 0.40, "VU2", 0.50, 0.50]
      ]
    },
    {
      name: "ระดับดินเดิม",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "กม.", "ระดับดินเดิม (ม.)", "ช่วงคูน้ำ", "กม. P1", "ระดับ P1", "กม. P2", "ระดับ P2"],
        ["คลองสายใหญ่", "01", "0+000", 100.30, 1, "0+000", 98.00, "0+200", 102.00],
        ["คลองสายใหญ่", "01", "0+100", 100.25, 1, "", "", "", ""],
        ["คลองสายใหญ่", "01", "0+200", 100.20, 1, "", "", "", ""],
        ["คลองสายใหญ่", "02", "0+000", 100.10, 1, "0+000", 98.00, "0+150", 102.00],
        ["คลองสายใหญ่", "02", "0+150", 100.00, 1, "", "", "", ""]
      ]
    },
    {
      name: "ระดับคูส่งน้ำ",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "TYPE", "H TBL (ม.)", "SLOPE", "กม.เริ่มต้น", "H (ม.)", "ระดับ BL. เริ่มต้น", "ระดับ TBL เริ่มต้น", "กม.สิ้นสุด", "ระดับ BL. สิ้นสุด", "ระดับ TBL สิ้นสุด", "ช่วงคูน้ำ"],
        ["คลองสายใหญ่", "01", "VU1", 0.50, 4000, "0+000", 0.00, 100.00, 100.50, "0+200", 99.95, 100.45, 1],
        ["คลองสายใหญ่", "02", "VU2", 0.55, 3000, "0+000", 0.00, 99.80, 100.35, "0+150", 99.75, 100.30, 1]
      ]
    },
    {
      name: "อาคารประกอบ",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "กม.", "รายการอาคาร", "ประเภทอาคาร", "H (ม.)", "ศก. ท่อ (ม.)", "ความยาว (ม.)", "หมายเหตุ", "UP", "DOWN", "ช่วงคูน้ำ"],
        ["คลองสายใหญ่", "01", "0+000", "อาคารท่อส่งน้ำเข้านา (เดิม)", "อาคารท่อส่งน้ำเข้านา (เดิม)", 0, 0.20, 0, "", "-", "VU1", 1],
        ["คลองสายใหญ่", "01", "0+200", "ปลายคู", "ปลายคู", 0, 0, 0, "", "VU1", "-", 1],
        ["คลองสายใหญ่", "02", "0+000", "อาคารท่อส่งน้ำเข้านา (เดิม)", "อาคารท่อส่งน้ำเข้านา (เดิม)", 0, 0.20, 0, "", "-", "VU2", 1],
        ["คลองสายใหญ่", "02", "0+150", "ปลายคู", "ปลายคู", 0, 0, 0, "", "VU2", "-", 1]
      ]
    },
    {
      name: "อาคารท่อรับน้ำเข้าแปลงไร่นา",
      rows: [
        ["คลองส่งน้ำ", "คูส่งน้ำ", "รายการอาคาร", "จำนวนอาคาร", "H (ม.)", "ศก. ท่อ (ม.)", "ความยาว (ม.)", "หมายเหตุ", "ช่วงคูน้ำ"],
        ["คลองสายใหญ่", "01", "อาคารท่อรับน้ำเข้าแปลงไร่นา", "2", 0.00, 0.20, 1.00, "", 1],
        ["คลองสายใหญ่", "02", "อาคารท่อรับน้ำเข้าแปลงไร่นา", "1", 0.00, 0.20, 1.00, "", 1]
      ]
    }
  ];
  const wb = buildExportWorkbook(sampleSheets);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const saved = await saveFileWithDialog(blob, 'ตัวอย่างไฟล์นำเข้า_BCLC.xlsx', 'Excel Workbook', ['.xlsx']);
  if (saved && typeof showSaveToast === 'function') {
    showSaveToast('ดาวน์โหลดตัวอย่างไฟล์นำเข้า Excel เรียบร้อยแล้ว!', 'success');
  }
  return saved;
}

function getExportDefaultFileName() {
  let baseName = (typeof projectPlanData !== 'undefined' && projectPlanData && projectPlanData.name)
    ? String(projectPlanData.name).replace(/\.[^/.]+$/, "").trim()
    : "";
  if (!baseName) {
    baseName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, "") : "BCLC_Project";
  }
  return `${baseName}_AllData.xlsx`;
}

async function exportAllToExcel(options) {
  const opts = options || {};
  // รอบ 41: ถามว่าจะตรวจสอบข้อมูลก่อนส่งออกไหม
  // รอบ 42: เปิดหน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก" (แสดงตารางตามแท็บ) แทนการถามยืนยันเฉย ๆ
  if (!opts.skipPreview && typeof openExportPreviewDialog === 'function') {
    const confirmed = await openExportPreviewDialog('ส่งออก');
    if (confirmed === false) return;
  } else if (!opts.skipValidate && typeof confirmValidateBeforeSave === 'function') {
    const proceed = await confirmValidateBeforeSave('ส่งออก');
    if (proceed === false) return;
  }

  if (typeof XLSX === 'undefined') {
    alert('โหลดไลบรารี Excel (SheetJS) ไม่สำเร็จ — กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วรีเฟรชหน้าเว็บ (Ctrl+F5)');
    return;
  }

  const defaultFileName = getExportDefaultFileName();
  let sheets = buildExportSheetsData();
  if (!opts.skipPreview) {
    sheets = sheets.filter(s => s && s.name !== 'setting');
  }
  // รอบ 55 ข้อ 3: ให้รวมแท็บ "รวมข้อมูล" ไว้ท้ายสุดในไฟล์ส่งออกด้วยเสมอ
  if (typeof epBuildMergedExportSheet === 'function') {
    const stepVal = (typeof exportPreviewState !== 'undefined' && exportPreviewState && typeof exportPreviewState.kmStep === 'number')
      ? exportPreviewState.kmStep
      : 0;
    const mergedSheet = epBuildMergedExportSheet(sheets, stepVal);
    if (mergedSheet && Array.isArray(mergedSheet.rows)) {
      sheets.push(mergedSheet);
    }
  }
  const wb = buildExportWorkbook(sheets);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  let saved = await saveFileWithDialog(blob, defaultFileName, 'Excel Workbook', ['.xlsx']);
  if (saved) {
    alert('ส่งออกไฟล์ Excel สำเร็จเรียบร้อยแล้ว!');
  }
}

function importAllFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    alert('โหลดไลบรารี Excel (SheetJS) ไม่สำเร็จ — กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วรีเฟรชหน้าเว็บ (Ctrl+F5)');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // R2: ตั้งต้นด้วยข้อมูลปัจจุบัน (spread copy) ไม่ใช่อาร์เรย์ว่าง
      //      เดิมใช้ [] แล้วเขียนทับทุกตารางตอนท้าย → ถ้าไฟล์ไม่มีชีตนั้น ข้อมูลเดิมหายทั้งแท็บ
      //      ตอนนี้ชีตไหนไม่มีในไฟล์ (หรือว่าง) จะคงข้อมูลเดิมไว้
      let newChannels = [...channels];
      let newDimensionRows = [...dimensionRows];
      let newLevelRowsData = [...levelRowsData];
      let newStructureRowsData = [...structureRowsData];
      let newAttachmentRowsData = [...attachmentRowsData];
      let newStructureTypeDatabase = [...structureTypeDatabase];
      let newGroundRowsData = [...groundRowsData];
      let newDitchTypeDatabase = [...ditchTypeDatabase];
      let newProjectPlanData = { ...projectPlanData };

      if (workbook.Sheets["แผนงานโครงการ"]) {
        const jsonProj = XLSX.utils.sheet_to_json(workbook.Sheets["แผนงานโครงการ"], { header: 1 });
        jsonProj.forEach(row => {
          if (row[0] === "ชื่อแผนงาน/โครงการ" && row[1]) newProjectPlanData.name = String(row[1]);
          if (row[0] === "ที่อยู่/สถานที่ดำเนินโครงการ" && row[1]) newProjectPlanData.location = String(row[1]);
          if (row[0] === "รายละเอียดโครงการ" && row[1]) newProjectPlanData.description = String(row[1]);
        });
      }

      if (workbook.Sheets["ระบบคูส่งน้ำ"]) {
        const jsonDitch = XLSX.utils.sheet_to_json(workbook.Sheets["ระบบคูส่งน้ำ"]);
        if (jsonDitch.length > 0) {
          newChannels = jsonDitch.map((row, idx) => ({
            id: idx + 1,
            canal: row["คลองส่งน้ำ"] || "คลอง",
            ditch: String(row["คูส่งน้ำ"] || "-"),
            totalArea: excelCellText2(row["พื้นที่ทั้งหมด (ไร่)"], ""),
            waterArea: excelCellText2(row["พื้นที่ส่งน้ำ (ไร่)"], ""),
            collapsed: false,
            rows: [createDefaultRow("", "")]
          }));
        }
      }

      if (newChannels.length === 0) {
        newChannels = [...channels];
      }

      // ตัวจับคู่ "แถวในชีต → คูส่งน้ำ" (ใช้คอลัมน์ "ลำดับคู" ถ้ามี · ไฟล์เก่าจับคู่จากชื่อ คลอง+คู)
      const resolveChannelIdx = makeChannelResolver(newChannels);
      const resolveChannelId = (row, canal, ditch) => {
        let i = resolveChannelIdx(row, canal, ditch);
        return (newChannels[i] && newChannels[i].id !== undefined) ? newChannels[i].id : (newChannels[0] ? newChannels[0].id : 1);
      };

      if (workbook.Sheets["มิติคูส่งน้ำ"]) {
        const jsonDim = XLSX.utils.sheet_to_json(workbook.Sheets["มิติคูส่งน้ำ"]);
        if (jsonDim.length > 0) {
          newDimensionRows = jsonDim.map(row => {
            let canal = row["คลองส่งน้ำ"];
            let ditch = String(row["คูส่งน้ำ"]);
            return {
              channelId: resolveChannelId(row, canal, ditch),
              kmStart: parseKmInput(row["กม.เริ่มต้น"]),
              kmEnd: parseKmInput(row["กม.สิ้นสุด"]),
              q: row["Q"] !== undefined && row["Q"] !== "" ? parseFloat(row["Q"]) : parseFloat(qOptions[0]),
              slope: row["SLOPE"] !== undefined && row["SLOPE"] !== "" ? parseFloat(row["SLOPE"]) : parseFloat(slopeOptions[slopeOptions.length - 1]),
              b: row["B"] !== undefined ? parseFloat(row["B"]) : 0.35,
              d: row["D"] !== undefined ? parseFloat(row["D"]) : 0.36,
              type: row["TYPE"] || "VU1",
              tbl: row["TBL"] !== undefined ? parseFloat(row["TBL"]) : 0.50,
              tbr: row["TBR"] !== undefined ? parseFloat(row["TBR"]) : 0.50
            };
          });
        }
      }

      const readImportedDitchSection = (row) => {
        if (!row || typeof row !== "object") return undefined;
        let raw = row["ช่วงคูน้ำ"];
        if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;
        return String(raw).trim();
      };
      let importedGroundP1P2 = {};

      if (workbook.Sheets["ระดับคูส่งน้ำ"]) {
        const jsonLvl = XLSX.utils.sheet_to_json(workbook.Sheets["ระดับคูส่งน้ำ"]);
        if (jsonLvl.length > 0) {
          let lastChan = -1;
          newLevelRowsData = jsonLvl.map(row => {
            let canal = row["คลองส่งน้ำ"];
            let ditch = String(row["คูส่งน้ำ"]);
            let cIdx = resolveChannelId(row, canal, ditch);
            let isDyn = (cIdx === lastChan);
            lastChan = cIdx;
            let secVal = readImportedDitchSection(row);
            let lvlObj = {
              channelId: cIdx,
              isDynamicRow: isDyn,
              customType: row["TYPE"] || "",
              customSlope: row["SLOPE"] !== undefined ? String(row["SLOPE"]) : "",
              customKmStart: parseKmInput(row["กม.เริ่มต้น"]),
              customKmEnd: parseKmInput(row["กม.สิ้นสุด"]),
              h: row["H (ม.)"] !== undefined ? parseFloat(row["H (ม.)"]) : 0.00,
              bl1: excelCellText2(row["ระดับ BL. เริ่มต้น"], ""),
              tbl1: excelCellText2(row["ระดับ TBL เริ่มต้น"], ""),
              bl2: excelCellText2(row["ระดับ BL. สิ้นสุด"], ""),
              tbl2: excelCellText2(row["ระดับ TBL สิ้นสุด"], "")
            };
            if (secVal !== undefined) lvlObj.ditchSection = secVal;
            return lvlObj;
          });
        }
      }

      if (workbook.Sheets["อาคารประกอบ"]) {
        const jsonStruct = XLSX.utils.sheet_to_json(workbook.Sheets["อาคารประกอบ"]);
        if (jsonStruct.length > 0) {
          const hasFromLevelCol = jsonStruct.some(r => r && Object.prototype.hasOwnProperty.call(r, "จากระดับ"));
          const resolvedStructChIds = jsonStruct.map(r => resolveChannelId(r, r["คลองส่งน้ำ"], String(r["คูส่งน้ำ"])));
          newStructureRowsData = jsonStruct.map((row, idx, arr) => {
            let cIdx = resolvedStructChIds[idx];

            let isFirstOfChan = (idx === 0 || resolvedStructChIds[idx - 1] !== cIdx);
            let isLastOfChan = (idx === arr.length - 1 || resolvedStructChIds[idx + 1] !== cIdx);
            let isBound = isFirstOfChan || isLastOfChan;
            // ธง "แถวนี้ดึงมาจากแท็ประดับคูส่งน้ำ" (คอลัมน์ "จากระดับ") — ไฟล์เก่าที่ไม่มีคอลัมน์นี้ = false
            let fromLevelRaw = row["จากระดับ"];
            let isFromLevel = fromLevelRaw !== undefined && String(fromLevelRaw).trim() !== "" && String(fromLevelRaw).trim() !== "0";

            // ค่าในไฟล์ของช่องที่ "ล็อกตามตาราง" เป็นค่าที่คำนวณมาจากตาราง ไม่ใช่ค่าที่ผู้ใช้กรอก
            // และค่าที่เท่ากับค่าเริ่มต้นของตารางก็ถือว่า "ยังไม่ได้กรอก" → เก็บเป็นค่าว่าง (ให้ตรงกับก่อนส่งออก)
            let name = row["ประเภทอาคาร"] || "-ไม่มี-";
            let typeEntry = getStructureTypeEntry(name);
            let hCell = excelCellText2(row["H (ม.)"], "");
            let diaCell = excelCellText2(row["ศก. ท่อ (ม.)"], "");
            let lenCell = excelCellText2(row["ความยาว (ม.)"] !== undefined ? row["ความยาว (ม.)"] : row["จำนวนท่อ"], "");
            const pickUserVal = (cell, tableVal, editable) => {
              if (cell === "") return "0.00";
              if (!editable) return cell;      // ช่องล็อก: ค่าที่คำนวณจากตาราง (เก็บตามไฟล์)
              let table = (tableVal === "" || tableVal === undefined || tableVal === null) ? "" : Number(tableVal).toFixed(2);
              return (cell === table) ? "" : cell;
            };
            let hVal, diaVal, lenVal;
            if (typeEntry) {
              hVal = pickUserVal(hCell, typeEntry.h, typeEntry.hEditable === true);
              diaVal = pickUserVal(diaCell, typeEntry.pipeDia, typeEntry.diaEditable === true);
              lenVal = pickUserVal(lenCell, typeEntry.length, typeEntry.lenEditable === true);
            } else {
              // ไม่รู้จักชื่ออาคารนี้ → ทุกช่องถือว่าเป็นค่าที่ผู้ใช้กรอก
              hVal = hCell; diaVal = diaCell; lenVal = lenCell;
            }

            let secVal = readImportedDitchSection(row);
            let sObj = {
              channelId: cIdx,
              isBoundary: isBound,
              isEndBoundary: isLastOfChan && !isFirstOfChan,
              isFromLevel: isFromLevel && !isBound,
              km: parseKmInput(row["กม."]),
              name: name,
              pipeDia: diaVal,
              pipeCount: lenVal,
              hOverride: hVal,
              remark: row["หมายเหตุ"] !== undefined ? String(row["หมายเหตุ"]) : "",
              _importedFromExcel: !hasFromLevelCol,
              _seqOrder: idx
            };
            if (secVal !== undefined) sObj.ditchSection = secVal;
            return sObj;
          });
        }
      }

      if (workbook.Sheets["อาคารท่อรับน้ำเข้าแปลงไร่นา"]) {
        const jsonAttach = XLSX.utils.sheet_to_json(workbook.Sheets["อาคารท่อรับน้ำเข้าแปลงไร่นา"]);
        if (jsonAttach.length > 0) {
          newAttachmentRowsData = jsonAttach.map(row => {
            let canal = row["คลองส่งน้ำ"];
            let ditch = String(row["คูส่งน้ำ"]);
            let secVal = readImportedDitchSection(row);

            let attachRow = {
              channelId: resolveChannelId(row, canal, ditch),
              km: "",
              name: row["รายการอาคาร"] || ATTACHMENT_BASE_NAME,
              h: excelCellText2(row["H (ม.)"], "0.00"),
              pipeDia: excelCellText2(row["ศก. ท่อ (ม.)"], ""),
              length: excelCellText2(row["ความยาว (ม.)"], "1.00"),
              count: row["จำนวนอาคาร"] !== undefined && row["จำนวนอาคาร"] !== "" ? String(row["จำนวนอาคาร"]) : "1",
              remark: row["หมายเหตุ"] !== undefined ? String(row["หมายเหตุ"]) : ""
            };
            if (secVal !== undefined) attachRow.ditchSection = secVal;
            if (attachRow.pipeDia === "") attachRow.pipeDia = getAttachmentPipeDia(attachRow);
            return attachRow;
          });
        }
      }

      if (workbook.Sheets["ระดับดินเดิม"]) {
        const jsonGround = XLSX.utils.sheet_to_json(workbook.Sheets["ระดับดินเดิม"]);
        if (jsonGround.length > 0) {
          const resolvedGroundChIds = jsonGround.map(r => resolveChannelId(r, r["คลองส่งน้ำ"], String(r["คูส่งน้ำ"])));
          newGroundRowsData = jsonGround.map((row, idx, arr) => {
            let cIdx = resolvedGroundChIds[idx];

            let isFirstOfChan = (idx === 0 || resolvedGroundChIds[idx - 1] !== cIdx);
            let isLastOfChan = (idx === arr.length - 1 || resolvedGroundChIds[idx + 1] !== cIdx);
            let secVal = readImportedDitchSection(row);

            // รอบ 48: อ่านคอลัมน์ P1 / P2 จากแท็ประดับดินเดิมในไฟล์นำเข้า
            let rawP1Km = row["กม. P1"] !== undefined ? row["กม. P1"] : (row["P1 กม."] !== undefined ? row["P1 กม."] : row["P1_KM"]);
            let rawP1Elev = row["ระดับ P1"] !== undefined ? row["ระดับ P1"] : (row["P1 ระดับ"] !== undefined ? row["P1 ระดับ"] : row["P1_ELEV"]);
            let rawP2Km = row["กม. P2"] !== undefined ? row["กม. P2"] : (row["P2 กม."] !== undefined ? row["P2 กม."] : row["P2_KM"]);
            let rawP2Elev = row["ระดับ P2"] !== undefined ? row["ระดับ P2"] : (row["P2 ระดับ"] !== undefined ? row["P2 ระดับ"] : row["P2_ELEV"]);

            const hasP1Km = rawP1Km !== undefined && rawP1Km !== null && String(rawP1Km).trim() !== "";
            const hasP1Elev = rawP1Elev !== undefined && rawP1Elev !== null && String(rawP1Elev).trim() !== "";
            const hasP2Km = rawP2Km !== undefined && rawP2Km !== null && String(rawP2Km).trim() !== "";
            const hasP2Elev = rawP2Elev !== undefined && rawP2Elev !== null && String(rawP2Elev).trim() !== "";

            if (hasP1Km || hasP1Elev || hasP2Km || hasP2Elev) {
              let gKey = "ground_ch_" + cIdx;
              if (!importedGroundP1P2[gKey]) importedGroundP1P2[gKey] = {};
              if (hasP1Km) {
                let parsedP1Km = parseKmInput(rawP1Km);
                if (parsedP1Km !== "" && !isNaN(Number(parsedP1Km))) importedGroundP1P2[gKey].p1Km = Number(parsedP1Km);
              }
              if (hasP1Elev) {
                let parsedP1Elev = parseFloat(rawP1Elev);
                if (!isNaN(parsedP1Elev)) importedGroundP1P2[gKey].p1Elev = parsedP1Elev;
              }
              if (hasP2Km) {
                let parsedP2Km = parseKmInput(rawP2Km);
                if (parsedP2Km !== "" && !isNaN(Number(parsedP2Km))) importedGroundP1P2[gKey].p2Km = Number(parsedP2Km);
              }
              if (hasP2Elev) {
                let parsedP2Elev = parseFloat(rawP2Elev);
                if (!isNaN(parsedP2Elev)) importedGroundP1P2[gKey].p2Elev = parsedP2Elev;
              }
            }

            let gObj = {
              channelId: cIdx,
              isDynamicRow: !isFirstOfChan && !isLastOfChan,
              isBoundary: isFirstOfChan || isLastOfChan,
              km: parseKmInput(row["กม."]),
              groundElevation: excelCellText2(row["ระดับดินเดิม (ม.)"], "")
            };
            if (secVal !== undefined) gObj.ditchSection = secVal;
            return gObj;
          });
        }
      }

      const settingSheet = workbook.Sheets["setting"] || workbook.Sheets["Typeคูส่งน้ำ"];
      if (settingSheet) {
        // รูปแบบปัจจุบัน: A=Typeคูส่งน้ำ (C..F = B/H/ความหนา) · G ว่าง · H=Typeอาคารประกอบ
        // ยังรองรับไฟล์เก่าที่เคยวาง Typeอาคารประกอบไว้คอลัมน์ B ด้วย
        const DEFAULT_DITCH_TYPES = ["VU1", "VU2", "VU3", "VU4", "VU5", "VU6"];
        const range = XLSX.utils.decode_range(settingSheet["!ref"] || "A1:H1");
        const cellText = (rowIdx, colIdx) => {
          if (rowIdx < range.s.r || rowIdx > range.e.r || colIdx < range.s.c || colIdx > range.e.c) return "";
          const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          const cell = settingSheet[addr];
          return (cell && cell.v !== undefined && cell.v !== null) ? String(cell.v).trim() : "";
        };
        const cellNum = (rowIdx, colIdx) => {
          const raw = cellText(rowIdx, colIdx);
          let n = parseFloat(raw);
          return isNaN(n) ? null : n;
        };

        let newDitchTypes = [];
        for (let r = 1; r <= range.e.r; r++) {
          let t = cellText(r, 0) || cellText(r, 2); // เผื่อไฟล์เก่าที่ Type อยู่คอลัมน์ C
          if (t === "") continue;
          newDitchTypes.push({
            type: t,
            b: (cellNum(r, 2) !== null ? cellNum(r, 2) : 0.35),
            h: (cellNum(r, 3) !== null ? cellNum(r, 3) : 0.50),
            tw: getDitchTypeThickness({ tw: cellNum(r, 4) }, 'tw'),
            tf: getDitchTypeThickness({ tf: cellNum(r, 5) }, 'tf')
          });
        }
        if (newDitchTypes.length > 0) {
          newDitchTypes.forEach((d, i) => {
            if (i >= DEFAULT_DITCH_TYPES.length && !DEFAULT_DITCH_TYPES.includes(d.type)) d._userAdded = true;
          });
          newDitchTypeDatabase = newDitchTypes;
        }

        // Typeอาคารประกอบ — คอลัมน์ H (ประเภทอาคาร) + I=H (ม.), J=ศก. ท่อ (ม.), K=ความยาว (ม.), L=หมายเหตุ
        // (ยังรองรับไฟล์เก่าที่มีแต่ชื่อในคอลัมน์ H)
        let structTypes = [];
        for (let r = 1; r <= range.e.r; r++) {
          let name = cellText(r, 7);
          if (name === "" || name === "Typeอาคารประกอบ" || name === "ประเภทอาคาร") {
            name = cellText(r, 1); // ไฟล์เก่า (ชื่ออาคารอยู่คอลัมน์ B)
          }
          if (name === "" || name === "Typeอาคารประกอบ") continue;
          // ถ้าเป็นชื่อที่มีในตารางตั้งต้น ใช้ค่าตั้งต้น + ค่าที่ผู้ใช้แก้ในไฟล์
          let builtin = getStructureTypeEntry(name);
          let base = builtin
            ? JSON.parse(JSON.stringify(builtin))
            : { type: name, h: "", hEditable: true, pipeDia: "", diaEditable: true, length: "", lenEditable: true, remark: "", remarkEditable: true };
          base.type = name;
          let hRaw = cellText(r, 8), diaRaw = cellText(r, 9), lenRaw = cellText(r, 10), remRaw = cellText(r, 11), upRaw = cellText(r, 13), downRaw = cellText(r, 14);
          if (!builtin) {
            // ไม่รู้จักชื่อนี้: ช่องที่มีค่า = แก้ไขได้ / ช่องว่าง = ล็อก
            base.hEditable = hRaw !== ""; base.h = base.hEditable ? hRaw : "";
            base.diaEditable = diaRaw !== ""; base.pipeDia = base.diaEditable ? diaRaw : "";
            base.lenEditable = lenRaw !== ""; base.length = base.lenEditable ? lenRaw : "";
            base.remarkEditable = remRaw !== ""; base.remark = remRaw;
          } else {
            if (base.hEditable && hRaw !== "") base.h = hRaw;
            if (base.diaEditable && diaRaw !== "") base.pipeDia = diaRaw;
            if (base.lenEditable && lenRaw !== "") base.length = lenRaw;
            if (base.remarkEditable && remRaw !== "") base.remark = remRaw;
          }
          if (upRaw !== "") base.up = upRaw;
          else if (!base.up) base.up = "-";
          if (downRaw !== "") base.down = downRaw;
          else if (!base.down) base.down = "-";
          structTypes.push(base);
        }
        if (structTypes.length > 0) {
          newStructureTypeDatabase = structTypes;
        }
      }

      channels = newChannels;
      ensureChannelIds();
      dimensionRows = newDimensionRows;
      levelRowsData = newLevelRowsData;
      structureRowsData = newStructureRowsData;
      attachmentRowsData = newAttachmentRowsData;
      groundRowsData = newGroundRowsData;
      // รอบ 48: หากในแท็บมิติคูส่งน้ำหรือระดับคูส่งน้ำมี TYPE พิเศษ (เช่น S.VU1) ที่ยังไม่อยู่ใน ditchTypeDatabase ให้เพิ่มเข้าฐานข้อมูลอัตโนมัติ
      const ensureImportedDitchType = (tName, bHint, hHint) => {
        const clean = String(tName || "").trim();
        if (!clean) return;
        if (newDitchTypeDatabase.some(d => d && d.type === clean)) return;
        const baseMatch = clean.replace(/^S\./i, "");
        const refType = newDitchTypeDatabase.find(d => d && d.type === baseMatch);
        const bVal = (bHint !== undefined && !isNaN(parseFloat(bHint))) ? parseFloat(bHint) : (refType ? refType.b : 0.35);
        const hVal = (hHint !== undefined && !isNaN(parseFloat(hHint))) ? parseFloat(hHint) : (refType ? refType.h : 0.50);
        newDitchTypeDatabase.push({
          type: clean,
          b: bVal,
          h: hVal,
          tw: refType ? getDitchTypeThickness(refType, "tw") : 0.10,
          tf: refType ? getDitchTypeThickness(refType, "tf") : 0.10,
          _userAdded: true
        });
      };
      newDimensionRows.forEach(r => { if (r && r.type) ensureImportedDitchType(r.type, r.b, undefined); });
      newLevelRowsData.forEach(r => { if (r && r.customType) ensureImportedDitchType(r.customType, undefined, undefined); });
      ditchTypeDatabase = newDitchTypeDatabase;
      structureTypeDatabase = newStructureTypeDatabase;
      // ธง "แถวที่ผู้ใช้เพิ่มเอง" ของ Typeอาคารประกอบ ต้องตั้งใหม่ตามชื่อที่โหลดมา
      // (เดิมไม่ถูกล้าง → ชื่อเก่าค้างและปุ่ม + / − ไปโผล่ผิดแถว)
      structureTypeDBMeta = {};
      structureTypeDatabase.forEach(t => {
        if (!t || !t.type) return;
        let isBuiltin = structureTypeDefaultsSnapshot.some(b => b && b.type === t.type);
        if (!isBuiltin) structureTypeDBMeta[t.type] = { userAdded: true };
      });
      projectPlanData = newProjectPlanData;
      levelGroupState = {};
      groundGroupState = {};
      Object.keys(importedGroundP1P2).forEach(gKey => {
        groundGroupState[gKey] = Object.assign({ locked: true, collapsed: true }, importedGroundP1P2[gKey]);
      });
      structureGroupState = {};
      attachmentGroupState = {};
      if (typeof tableGroundLinePoints !== 'undefined') tableGroundLinePoints = [];
      if (typeof manualGroundLinePoints !== 'undefined') manualGroundLinePoints = [];
      if (typeof canalLevelDrawingLines !== 'undefined') canalLevelDrawingLines = [];
      if (typeof canvasLabels !== 'undefined') canvasLabels = [];
      activeChannelId = channels[0] ? channels[0].id : 0;
      const firstGroundGrp = groundGroupState["ground_ch_" + activeChannelId];
      if (firstGroundGrp) {
        const elP1X = document.getElementById("p1XVal");
        const elP1Y = document.getElementById("p1YVal");
        const elP2X = document.getElementById("p2XVal");
        const elP2Y = document.getElementById("p2YVal");
        if (elP1X && firstGroundGrp.p1Km !== undefined) elP1X.value = firstGroundGrp.p1Km;
        if (elP1Y && firstGroundGrp.p1Elev !== undefined) elP1Y.value = firstGroundGrp.p1Elev;
        if (elP2X && firstGroundGrp.p2Km !== undefined) elP2X.value = firstGroundGrp.p2Km;
        if (elP2Y && firstGroundGrp.p2Elev !== undefined) elP2Y.value = firstGroundGrp.p2Elev;
      }

      syncDimensionRowsWithChannels();
      updateTable();
      alert('นำเข้าข้อมูลโครงการจากไฟล์ Excel สำเร็จเรียบร้อยแล้ว!');
    } catch (err) {
      alert('ไม่สามารถอ่านไฟล์ Excel ได้: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
}

