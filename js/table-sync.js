// ===== js/table-sync.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — ชั้นข้อมูล: ซิงก์ข้อมูลข้ามแท็บ (มิติคูส่งน้ำ -> ระดับดินเดิม / อาคารประกอบ)
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function syncDimensionRowsWithChannels() {
  channels.forEach(ch => {
    let existsDim = dimensionRows.some(d => d.channelId === ch.id);
    if (!existsDim) {
      dimensionRows.push({
        channelId: ch.id,
        kmStart: 0,
        kmEnd: "",
        q: 0.030,
        slope: 4000,
        b: 0.35,
        d: 0.36,
        type: "VU1",
        tbl: 0.50,
        tbr: 0.50
      });
    }

    let existsLvl = levelRowsData.some(l => l.channelId === ch.id);
    if (!existsLvl) {
      levelRowsData.push({
        channelId: ch.id,
        isDynamicRow: false,
        customType: "",
        customSlope: "",
        customKmStart: "",
        customKmEnd: "",
        h: 0.00,
        bl1: "",
        tbl1: "",
        bl2: "",
        tbl2: ""
      });
    }
  });
  enforceLevelLastKmEnd();
  syncGroundRowsWithDimensions();
  syncStructureRowsWithLevel();
  syncAttachmentRowsWithLevel();
}

// ซิงก์แถวของแท็บ "อาคารท่อรับน้ำเข้าแปลงไร่นา"
// แถวแรกของแต่ละคูส่งน้ำต้องเป็น "อาคารท่อรับน้ำเข้าแปลงไร่นา" และล็อก กม. ตามแท็บมิติคูส่งน้ำ
function syncAttachmentRowsWithLevel() {
  channels.forEach(ch => {
    let dimItem = dimensionRows.find(d => d.channelId === ch.id);
    let kStart = (dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0;

    let aRows = attachmentRowsData.filter(a => a.channelId === ch.id);

    if (aRows.length === 0) {
      attachmentRowsData.push({
        channelId: ch.id, km: kStart, name: ATTACHMENT_BASE_NAME,
        h: "0.00", pipeDia: getAttachmentPipeDia({ name: ATTACHMENT_BASE_NAME }), length: "1.00", count: "1", remark: ""
      });
      return;
    }
    // ไฟล์เก่าที่ไม่มีค่า ศก. ท่อ ให้เติมค่าเริ่มต้นตามรายการอาคาร
    aRows.forEach(a => {
      if (a.pipeDia === "" || a.pipeDia === undefined || a.pipeDia === null) {
        a.pipeDia = getAttachmentPipeDia(a);
      }
    });

    if (!aRows[0].name) aRows[0].name = ATTACHMENT_BASE_NAME;
    aRows[0].km = kStart;
  });
}

function syncGroundRowsWithDimensions() {
  channels.forEach(ch => {
    let dimItem = dimensionRows.find(d => d.channelId === ch.id);
    let kStart = (dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0;
    let kEnd = getChannelKmEnd(ch.id);

    let gRows = groundRowsData.filter(g => g.channelId === ch.id);
    if (gRows.length === 0) {
      groundRowsData.push({ channelId: ch.id, isBoundary: true, km: kStart, groundElevation: "" });
      groundRowsData.push({ channelId: ch.id, isBoundary: true, km: kEnd, groundElevation: "" });
    } else {
      gRows[0].km = kStart;
      gRows[gRows.length - 1].km = kEnd;
    }
  });
}

// เปรียบเทียบ "กม." ให้ทนรูปแบบ (ค่าว่างเทียบกันเอง · ตัวเลขกับสตริงปนกันได้ · เผื่อทศนิยม)
// ใช้ตัดสินว่าแถวอาคารประกอบแถวไหน "คือแถวเดียวกับ" บรรทัดในแท็ประดับคูส่งน้ำ
function sameStructureKm(a, b) {
  let aEmpty = (a === "" || a === null || a === undefined);
  let bEmpty = (b === "" || b === null || b === undefined);
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  let na = parseFloat(a), nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb)) return String(a) === String(b);
  return Math.abs(na - nb) < 0.001;
}

function syncStructureRowsWithLevel() {
  channels.forEach(ch => {
    let dimItem = dimensionRows.find(d => d.channelId === ch.id);
    let lvlRows = levelRowsData.filter(l => l.channelId === ch.id);

    let kStart = (lvlRows.length > 0 && lvlRows[0].customKmStart !== undefined && lvlRows[0].customKmStart !== "")
      ? lvlRows[0].customKmStart
      : ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0);

    let kEnd = getChannelKmEnd(ch.id);

    let existingSRows = structureRowsData.filter(s => s.channelId === ch.id);
    existingSRows.forEach((s, idx) => {
      if (s && typeof s._seqOrder !== "number") s._seqOrder = idx;
    });
    let customUserRows = existingSRows.filter(s => !s.isBoundary && !s.isFromLevel);

    let newSRows = [];

    // 1. แถวเริ่มต้น (ชื่อตั้งต้น = อาคารท่อส่งน้ำเข้านา (เดิม) แต่เปลี่ยนประเภทอาคารได้)
    let startRow = existingSRows.find(s => s.isBoundary && !s.isEndBoundary) || {
      channelId: ch.id,
      isBoundary: true,
      isEndBoundary: false,
      km: kStart,
      name: "อาคารท่อส่งน้ำเข้านา (เดิม)",
      pipeDia: "0.00",
      pipeCount: "0.00",
      remark: ""
    };
    if (!startRow.name) startRow.name = "อาคารท่อส่งน้ำเข้านา (เดิม)";
    startRow.isEndBoundary = false;
    startRow.km = kStart;
    newSRows.push(startRow);

    // 2. ดึงช่วงย่อยทั้งหมดจากแท็ประดับคูส่งน้ำอัตโนมัติ
    const hasExcelImportedRows = existingSRows.some(s => s && s._importedFromExcel);
    if (lvlRows.length > 1) {
      for (let i = 1; i < lvlRows.length; i++) {
        let l = lvlRows[i];
        let subKm = l.customKmStart !== undefined && l.customKmStart !== "" ? l.customKmStart : "";
        let existingMatch = existingSRows.find(s => s.isFromLevel && sameStructureKm(s.km, subKm) && !newSRows.includes(s));

        if (!existingMatch) {
          // ไฟล์ที่นำเข้าจาก Excel ที่ไม่มีคอลัมน์ "จากระดับ" แถวจะไม่ถูกทำธงไว้
          // จับคู่กับแถวอาคารลดระดับ/น้ำตกลดระดับ/ท่อลอดลดระดับ/เปลี่ยนลาดที่ กม. ตรงกับบรรทัดระดับ เพื่อไม่ให้สร้างแถวซ้ำซ้อน
          let legacyMatch = customUserRows.find(u => !u.isBoundary && sameStructureKm(u.km, subKm) && (
            u.name === "อาคารลดระดับ" || u.name === "" ||
            (u._importedFromExcel && typeof getStructureTypeEntry === "function" && getStructureTypeEntry(u.name) && getStructureTypeEntry(u.name).hEditable)
          ));
          if (legacyMatch) {
            legacyMatch.isFromLevel = true;
            customUserRows.splice(customUserRows.indexOf(legacyMatch), 1);
            existingMatch = legacyMatch;
          }
        }

        if (existingMatch) {
          newSRows.push(existingMatch);
        } else if (!(hasExcelImportedRows && customUserRows.some(u => !u.isBoundary && sameStructureKm(u.km, subKm)))) {
          newSRows.push({
            channelId: ch.id,
            isBoundary: false,
            isFromLevel: true,
            km: subKm,
            name: "อาคารลดระดับ",
            pipeDia: "0.00",
            pipeCount: "0.00",
            remark: "",
            ditchSection: l.ditchSection
          });
        }
      }
    }

    // 3. รวมแถวที่ผู้ใช้เพิ่มเอง
    customUserRows.forEach(uRow => {
      newSRows.push(uRow);
    });

    // 4. แถวสิ้นสุด (ปลายคู) — ชื่อตั้งต้น "ปลายคู" แต่เปลี่ยนประเภทอาคารได้
    let endRow = existingSRows.find(s => s.isBoundary && s !== startRow && s.isEndBoundary) ||
      existingSRows.find(s => s.isBoundary && s !== startRow) || {
      channelId: ch.id,
      isBoundary: true,
      isEndBoundary: true,
      km: kEnd,
      name: "ปลายคู",
      pipeDia: "0.00",
      pipeCount: "0.00",
      remark: ""
    };
    if (!endRow.name) endRow.name = "ปลายคู";
    endRow.isEndBoundary = true;
    endRow.km = kEnd;
    newSRows.push(endRow);

    newSRows.sort((a, b) => {
      if (a.isBoundary && !a.isEndBoundary && !(b.isBoundary && !b.isEndBoundary)) return -1;
      if (b.isBoundary && !b.isEndBoundary && !(a.isBoundary && !a.isEndBoundary)) return 1;
      if (a.isBoundary && a.isEndBoundary && !(b.isBoundary && b.isEndBoundary)) return 1;
      if (b.isBoundary && b.isEndBoundary && !(a.isBoundary && a.isEndBoundary)) return -1;
      let kmA = a.km !== "" && a.km !== undefined ? parseFloat(a.km) : 0;
      let kmB = b.km !== "" && b.km !== undefined ? parseFloat(b.km) : 0;
      if (Math.abs(kmA - kmB) > 0.001) return kmA - kmB;
      let ordA = (typeof a._seqOrder === "number") ? a._seqOrder : 9999;
      let ordB = (typeof b._seqOrder === "number") ? b._seqOrder : 9999;
      return ordA - ordB;
    });

    let firstIdx = structureRowsData.findIndex(s => s.channelId === ch.id);
    if (firstIdx !== -1) {
      let count = structureRowsData.filter(s => s.channelId === ch.id).length;
      structureRowsData.splice(firstIdx, count, ...newSRows);
    } else {
      structureRowsData.push(...newSRows);
    }
  });
}

function getHFromLevelTab(channelId, srowKm) {
  let lvlRows = levelRowsData.filter(l => l.channelId === channelId);
  if (lvlRows.length === 0) return "0.00";
  
  if (srowKm !== undefined && srowKm !== "") {
    let kmNum = parseFloat(srowKm);
    
    let directMatch = lvlRows.find(l => {
      let kStart = parseFloat(l.customKmStart) || 0;
      return Math.abs(kStart - kmNum) < 0.001;
    });
    if (directMatch && directMatch.h !== undefined && directMatch.h !== "") {
      return Number(directMatch.h).toFixed(2);
    }

    let matched = lvlRows.find(l => {
      let kStart = parseFloat(l.customKmStart) || 0;
      let kEnd = (l.customKmEnd !== "" && l.customKmEnd !== undefined) ? parseFloat(l.customKmEnd) : Infinity;
      return kmNum >= kStart && kmNum <= kEnd;
    });
    if (matched && matched.h !== undefined && matched.h !== "") {
      return Number(matched.h).toFixed(2);
    }
  }

  let lvlItem = lvlRows[0];
  if (lvlItem && lvlItem.h !== undefined && lvlItem.h !== "") {
    return Number(lvlItem.h).toFixed(2);
  }
  return "0.00";
}

// ค่าที่จะใช้คิดชื่อ: ช่องที่แก้ได้ แต่ยังว่าง -> ใช้ค่าเริ่มต้นจากตาราง Typeอาคารประกอบ
function structureNameValue(userVal, tableVal, editable) {
  if (!editable) return tableVal || "";
  let v = (userVal === undefined || userVal === null) ? "" : String(userVal).trim();
  if (v === "") return tableVal || "";
  return v;
}

// ชื่ออาคาร (คอลัมน์ "รายการอาคาร") = "ชื่ออาคารประกอบ" ที่รวมข้อมูลจากตาราง Typeอาคารประกอบ
// ช่องที่ล็อกตามตาราง → ใช้ค่าจากตาราง · ช่องที่แก้ได้ → ใช้ค่าที่กรอก ถ้าว่างใช้ค่าเริ่มต้นจากตาราง
// แถวที่คัดลอกจากแท็ประดับคูส่งน้ำ → ใช้ค่า H ของบรรทัดนั้น (ยกเว้น กม.สิ้นสุด = ไม่ใส่)
function computeStructureItemName(srow, cIdx) {
  let typeName = srow.name || "";
  if (!typeName || typeName === "-ไม่มี-") {
    return "-ไม่มี-";
  }

  let entry = getStructureTypeEntry(typeName);
  let hVal = structureNameValue(srow.hOverride, entry ? entry.h : "", !!(entry && entry.hEditable));
  // แถวคัดลอกจากระดับ: ใช้ H จากแท็ประดับคูส่งน้ำ (ถ้ามี)
  if (srow.isFromLevel) {
    let lvlH = getStructureLevelH(srow);
    if (lvlH !== "" && lvlH !== "-") hVal = lvlH;
  }
  return computeStructureTypeName({
    type: typeName,
    h: hVal,
    pipeDia: structureNameValue(srow.pipeDia, entry ? entry.pipeDia : "", !!(entry && entry.diaEditable)),
    length: structureNameValue(srow.pipeCount, entry ? entry.length : "", !!(entry && entry.lenEditable)),
    remark: structureNameValue(srow.remark, entry ? entry.remark : "", !!(entry && entry.remarkEditable))
  });
}

// หา "บรรทัด" ในแท็ประดับคูส่งน้ำ ที่แถวอาคารนี้ตกอยู่
// ใช้ขอบเขต กม.เริ่มต้น – กม.สิ้นสุด ของแต่ละแถวในแท็ประดับคูส่งน้ำ
function findLevelRowIndexForStructure(channelId, kmVal) {
  let lvlRows = levelRowsData.filter(l => l.channelId === channelId);
  if (lvlRows.length === 0) return -1;

  let kmNum = parseFloat(kmVal);
  if (isNaN(kmNum)) return -1;

  // ตรงกับ กม.เริ่มต้นของแถวไหนพอดี
  let exact = lvlRows.find(l => Math.abs((parseFloat(l.customKmStart) || 0) - kmNum) < 0.001);
  if (exact) return levelRowsData.indexOf(exact);

  // ตกอยู่ในช่วง กม.เริ่มต้น – กม.สิ้นสุด
  let inside = lvlRows.find(l => {
    let kStart = parseFloat(l.customKmStart) || 0;
    let kEnd = (l.customKmEnd !== "" && l.customKmEnd !== undefined) ? parseFloat(l.customKmEnd) : Infinity;
    return kmNum >= kStart && kmNum <= kEnd;
  });
  if (inside) return levelRowsData.indexOf(inside);

  // แถวสุดท้ายที่ กม.เริ่มต้นยังไม่เกินจุดนี้ = บรรทัดที่ใกล้ที่สุดก่อนหน้า
  let prev = null;
  lvlRows.forEach(l => {
    let kStart = parseFloat(l.customKmStart) || 0;
    if (kStart <= kmNum) prev = l;
  });
  return prev ? levelRowsData.indexOf(prev) : -1;
}

// ===== ค่า H ของแถวที่ "คัดลอกมาจากแท็ประดับคูส่งน้ำ" =====
// ดึงค่า H มาจากบรรทัดในแท็ประดับคูส่งน้ำ
// ยกเว้น "กม.สิ้นสุด" (จุดสิ้นสุดของคู) ให้เป็น "-" — เฉพาะแถวที่ กม. เท่ากับ กม.สิ้นสุดเท่านั้น
function getStructureLevelH(srow) {
  if (srow && srow.name && typeof getStructureTypeEntry === "function") {
    let sEntry = getStructureTypeEntry(srow.name);
    if (sEntry && !sEntry.hEditable) return "-";
  }
  let lvlRows = levelRowsData.filter(l => l.channelId === srow.channelId);
  if (lvlRows.length === 0) return "-";

  let kmNum = parseFloat(srow.km);

  // ถึง กม.สิ้นสุดของคูแล้ว -> ไม่ใส่ค่า H
  let lastLvl = lvlRows[lvlRows.length - 1];
  let chanEnd = parseFloat(lastLvl.customKmEnd);
  if (!isNaN(kmNum) && !isNaN(chanEnd) && Math.abs(kmNum - chanEnd) < 0.001) {
    return "-";
  }

  let idx = findLevelRowIndexForStructure(srow.channelId, srow.km);
  if (idx < 0) return "-";

  let lvl = levelRowsData[idx];
  if (lvl.h === undefined || lvl.h === "") return "-";
  let num = parseFloat(lvl.h);
  // จัดรูปทศนิยม 2 ตำแหน่งให้ตรงกับช่องอื่น ๆ (0.3 -> 0.30)
  return isNaN(num) ? String(lvl.h) : num.toFixed(2);
}

// ใส่ "เส้นบนบรรทัด" หรือไม่ ในแท็บอาคารประกอบ
// ใส่เฉพาะแถวที่สร้างจากค่าที่คัดลอกมาจากแท็ประดับคูส่งน้ำ (isFromLevel = true)
//   -> ใช้สีเดียวกับทุกแถว (ตามที่กำหนด)
// แถวที่ผู้ใช้เพิ่มเอง / แถว boundary -> false = "ไม่ต้องใส่สี"
function shouldStructureRowHaveTint(srow) {
  return !!(srow && srow.isFromLevel);
}

function enforceLevelLastKmEnd() {
  channels.forEach(ch => {
    let targetKmEnd = getChannelKmEnd(ch.id);

    let lvlRows = levelRowsData.filter(l => l.channelId === ch.id);
    if (lvlRows.length > 0) {
      let lastRow = lvlRows[lvlRows.length - 1];
      lastRow.customKmEnd = targetKmEnd;
    }
  });
}

// ===== รอบ 39: คำนวณค่า TYPE สำหรับคอลัมน์ UP และ DOWN ในแท็บอาคารประกอบ =====
// ดึงค่า TYPE จากแท็บระดับคูส่งน้ำ (levelRowsData) ตามเงื่อนไขในตาราง Typeอาคารประกอบ:
//   - "-"       -> "-"
//   - "TypeNow" -> TYPE ของแท็บระดับคูส่งน้ำ ณ กม. ของอาคาร (ช่วงปัจจุบัน/ท้ายน้ำ)
//   - "TypeUp"  -> TYPE ของแท็บระดับคูส่งน้ำ ช่วงก่อนหน้า/เหนือน้ำ ณ กม. ของอาคาร
//   - "xxx"     -> ดึง TYPE จากคูส่งน้ำสายหลักอัตโนมัติ ตรงตำแหน่ง (กม.) ที่อาคารปากคูซอยออก

function getLevelRowEffectiveType(lvl, dimItem, localIdx) {
  let dimType = (dimItem && dimItem.type) ? String(dimItem.type).trim() : "";
  if (!lvl) return dimType || "VU1";
  let cType = (lvl.customType !== undefined && lvl.customType !== null) ? String(lvl.customType).trim() : "";
  // ดึงค่า TYPE จากแท็บระดับคูส่งน้ำ (customType) เป็นหลัก ถ้ายังว่างจึง fallback ไปที่แท็บมิติคูส่งน้ำ
  return cType || dimType || "VU1";
}

function getStructureLevelTypeAtKm(channelId, kmVal, mode, srow) {
  let dimItem = (typeof dimensionRows !== "undefined" && Array.isArray(dimensionRows))
    ? dimensionRows.find(d => d && d.channelId === channelId)
    : null;
  let lvlRows = (typeof levelRowsData !== "undefined" && Array.isArray(levelRowsData))
    ? levelRowsData.filter(l => l && l.channelId === channelId)
    : [];
  if (lvlRows.length === 0) {
    return (dimItem && dimItem.type) ? String(dimItem.type).trim() : "VU1";
  }

  const getRowKmStart = (idx) => {
    let r = lvlRows[idx];
    if (r && r.customKmStart !== "" && r.customKmStart !== undefined && r.customKmStart !== null) {
      let n = parseFloat(r.customKmStart);
      if (!isNaN(n)) return n;
    }
    if (idx === 0 && dimItem && dimItem.kmStart !== "" && dimItem.kmStart !== undefined && dimItem.kmStart !== null) {
      let n = parseFloat(dimItem.kmStart);
      if (!isNaN(n)) return n;
    }
    return idx === 0 ? 0 : NaN;
  };

  const getRowKmEnd = (idx) => {
    let r = lvlRows[idx];
    if (r && r.customKmEnd !== "" && r.customKmEnd !== undefined && r.customKmEnd !== null) {
      let n = parseFloat(r.customKmEnd);
      if (!isNaN(n)) return n;
    }
    if (idx + 1 < lvlRows.length) {
      let nextStart = getRowKmStart(idx + 1);
      if (!isNaN(nextStart)) return nextStart;
    }
    let chEnd = (typeof getChannelKmEnd === "function") ? parseFloat(getChannelKmEnd(channelId)) : NaN;
    return !isNaN(chEnd) ? chEnd : Infinity;
  };

  let localIdx = -1;
  let kmNum = (kmVal !== "" && kmVal !== undefined && kmVal !== null) ? parseFloat(kmVal) : NaN;

  if (!isNaN(kmNum)) {
    // 1) ตรงกับ กม.เริ่มต้นของช่วงไหนพอดี (เช็คจากช่วงท้ายสุดย้อนกลับ เพื่อให้จุดตัดช่วงได้ช่วงใหม่เป็น TypeNow และช่วงก่อนหน้าเป็น TypeUp)
    for (let i = lvlRows.length - 1; i >= 0; i--) {
      let kStart = getRowKmStart(i);
      if (!isNaN(kStart) && Math.abs(kStart - kmNum) < 0.001) {
        localIdx = i;
        break;
      }
    }
    // 2) ตกอยู่ในช่วง กม.เริ่มต้น – กม.สิ้นสุด
    if (localIdx === -1) {
      for (let i = 0; i < lvlRows.length; i++) {
        let kStart = getRowKmStart(i);
        let kEnd = getRowKmEnd(i);
        if (!isNaN(kStart) && kmNum >= kStart - 0.001 && kmNum <= kEnd + 0.001) {
          localIdx = i;
          break;
        }
      }
    }
    // 3) ช่วงสุดท้ายที่ กม.เริ่มต้นไม่เกินจุดนี้
    if (localIdx === -1) {
      for (let i = 0; i < lvlRows.length; i++) {
        let kStart = getRowKmStart(i);
        if (!isNaN(kStart) && kStart <= kmNum + 0.001) {
          localIdx = i;
        }
      }
    }
  }

  if (localIdx === -1) {
    if (srow && srow.isEndBoundary) {
      localIdx = lvlRows.length - 1;
    } else if (srow && srow.isFromLevel && typeof structureRowsData !== "undefined" && Array.isArray(structureRowsData)) {
      let fromLvlList = structureRowsData.filter(r => r && r.channelId === channelId && r.isFromLevel);
      let pos = fromLvlList.indexOf(srow);
      localIdx = (pos >= 0 && pos + 1 < lvlRows.length) ? (pos + 1) : (lvlRows.length > 1 ? 1 : 0);
    } else {
      localIdx = 0;
    }
  }

  if (mode === "TypeUp") {
    let upIdx = localIdx > 0 ? localIdx - 1 : 0;
    return getLevelRowEffectiveType(lvlRows[upIdx], dimItem, upIdx);
  }
  return getLevelRowEffectiveType(lvlRows[localIdx], dimItem, localIdx);
}

function normalizeDitchKeyForMatch(raw) {
  if (raw === undefined || raw === null) return "";
  let s = String(raw).trim();
  if (!s || s === "-") return "";
  if (typeof cleanDitchNumber === "function") {
    let cleaned = cleanDitchNumber(s);
    if (cleaned) return String(cleaned).trim().toLowerCase();
  }
  return s
    .replace(/^(?:คูส่งน้ำสายซอยที่|คูส่งน้ำสายที่|คูส่งน้ำซอย|คูส่งน้ำ|คูซอยที่|คูซอย|สายซอยที่|สายที่|สาย)\s*/i, "")
    .replace(/[()]/g, "")
    .trim()
    .toLowerCase();
}

function isSameDitchKey(a, b) {
  let ka = normalizeDitchKeyForMatch(a);
  let kb = normalizeDitchKeyForMatch(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // เทียบตัวเลขล้วน เช่น "01" กับ "1" หรือ "01-1" กับ "1-1"
  const normNumParts = (k) => k.split(/[-/]/).map(p => (/^\d+$/.test(p) ? String(parseInt(p, 10)) : p)).join("-");
  return normNumParts(ka) === normNumParts(kb);
}

function resolveMainDitchTypeForSubDitchTurnout(srow) {
  if (!srow) return "VU1";
  let curCh = (typeof getChannelById === "function") ? getChannelById(srow.channelId) : null;
  let curDitch = curCh ? String(curCh.ditch || "").trim() : "";
  let curCanal = curCh ? String(curCh.canal || "").trim() : "";
  let allStructs = (typeof structureRowsData !== "undefined" && Array.isArray(structureRowsData)) ? structureRowsData : [];
  let allChans = (typeof channels !== "undefined" && Array.isArray(channels)) ? channels : [];

  // 1) ค้นหาแถว "อาคารปากคูซอย" ในคูส่งน้ำสายอื่นที่ช่องหมายเหตุ (remark) ระบุชื่อคูซอยตรงกับคูส่งน้ำปัจจุบัน
  if (curDitch && curDitch !== "-") {
    let turnoutCandidates = allStructs.filter(r =>
      r && r.channelId !== srow.channelId &&
      String(r.name || "").trim() === "อาคารปากคูซอย" &&
      isSameDitchKey(r.remark, curDitch)
    );
    if (turnoutCandidates.length > 0) {
      let sameCanalHit = turnoutCandidates.find(r => {
        let ch = (typeof getChannelById === "function") ? getChannelById(r.channelId) : null;
        return ch && String(ch.canal || "").trim() === curCanal;
      });
      let hit = sameCanalHit || turnoutCandidates[0];
      return getStructureLevelTypeAtKm(hit.channelId, hit.km, "TypeNow", hit);
    }
  }

  // 2) ค้นหาคูส่งน้ำสายหลักจากรหัสคูซอย เช่น "01-1" -> สายหลัก "01" (หรือ "03-1-1" -> "03-1")
  let cleanedDitch = normalizeDitchKeyForMatch(curDitch);
  let parentMatch = cleanedDitch.match(/^(.+?)[-/](\d+|[a-z0-9]+)$/i);
  if (parentMatch) {
    let parentKey = parentMatch[1];
    let subOrdinal = parseInt(parentMatch[2], 10);
    let parentCandidates = allChans.filter(c => c && c.id !== srow.channelId && isSameDitchKey(c.ditch, parentKey));
    let parentCh = parentCandidates.find(c => String(c.canal || "").trim() === curCanal) || parentCandidates[0];
    if (parentCh) {
      let turnoutsOnParent = allStructs.filter(r =>
        r && r.channelId === parentCh.id &&
        String(r.name || "").trim().indexOf("อาคารปากคูซอย") === 0
      );
      if (turnoutsOnParent.length > 0) {
        let exactRem = turnoutsOnParent.find(r => isSameDitchKey(r.remark, curDitch));
        // กรองเอาเฉพาะอาคารปากคูซอยที่ไม่ได้ระบุชื่อคูซอยอื่นไว้ในหมายเหตุ
        let availableTurnouts = turnoutsOnParent.filter(r => {
          let rem = String(r.remark || "").trim();
          return !rem || rem === "-" || isSameDitchKey(rem, curDitch);
        });
        let pool = availableTurnouts.length > 0 ? availableTurnouts : turnoutsOnParent;
        let picked = exactRem ||
          ((!isNaN(subOrdinal) && subOrdinal >= 1 && subOrdinal <= pool.length)
            ? pool[subOrdinal - 1]
            : pool[0]);
        return getStructureLevelTypeAtKm(parentCh.id, picked.km, "TypeNow", picked);
      }
      return getStructureLevelTypeAtKm(parentCh.id, srow.km, "TypeNow", null);
    }
  }

  // 3) ค้นหาแถว "อาคารปากคูซอย" ในคูส่งน้ำสายหลัก (คูส่งน้ำอื่นในคลองเดียวกัน หรือคูส่งน้ำก่อนหน้าที่มี อาคารปากคูซอย)
  let otherTurnouts = allStructs.filter(r =>
    r && r.channelId !== srow.channelId &&
    String(r.name || "").trim() === "อาคารปากคูซอย"
  );
  if (otherTurnouts.length > 0) {
    let sameCanalTurnouts = otherTurnouts.filter(r => {
      let ch = (typeof getChannelById === "function") ? getChannelById(r.channelId) : null;
      return ch && String(ch.canal || "").trim() === curCanal;
    });
    let pool = sameCanalTurnouts.length > 0 ? sameCanalTurnouts : otherTurnouts;
    // ถ้ามีหลายคูซอยที่ใช้ อาคารปากคูซอยแบบที่ 1/2 ให้จับคู่ตามลำดับคูซอย
    let subTurnoutRows = allStructs.filter(r =>
      r && /^อาคารปากคูซอยแบบที่\s*[12]$/.test(String(r.name || "").trim())
    );
    let subIdx = subTurnoutRows.indexOf(srow);
    let picked = (subIdx >= 0 && subIdx < pool.length) ? pool[subIdx] : pool[0];
    return getStructureLevelTypeAtKm(picked.channelId, picked.km, "TypeNow", picked);
  }

  // 4) ถ้ามีคูส่งน้ำสายหลักในคลองเดียวกัน (คูแรกของคลอง) ให้ดึง TYPE จากสายหลัก
  if (allChans.length > 1) {
    let mainCh = allChans.find(c => c && c.id !== srow.channelId && String(c.canal || "").trim() === curCanal) ||
                 allChans.find(c => c && c.id !== srow.channelId);
    if (mainCh) {
      return getStructureLevelTypeAtKm(mainCh.id, srow.km, "TypeNow", null);
    }
  }

  // 5) Fallback: ถ้ามีแต่คูเดียวแต่มีแถว อาคารปากคูซอย ในคูเดียวกัน ให้ใช้ กม. นั้น มิฉะนั้นใช้ กม. ปัจจุบัน
  let sameChanTurnout = allStructs.find(r =>
    r && r.channelId === srow.channelId && r !== srow &&
    String(r.name || "").trim() === "อาคารปากคูซอย"
  );
  if (sameChanTurnout) {
    return getStructureLevelTypeAtKm(srow.channelId, sameChanTurnout.km, "TypeNow", sameChanTurnout);
  }
  return getStructureLevelTypeAtKm(srow.channelId, srow.km, "TypeNow", srow);
}

function resolveStructureSideTypeByRule(srow, ruleStr) {
  let rule = (ruleStr === undefined || ruleStr === null) ? "-" : String(ruleStr).trim();
  if (rule === "" || rule === "-" || rule === "—") return "-";
  let ruleLower = rule.toLowerCase();
  if (ruleLower === "typenow") {
    return getStructureLevelTypeAtKm(srow.channelId, srow.km, "TypeNow", srow);
  }
  if (ruleLower === "typeup") {
    return getStructureLevelTypeAtKm(srow.channelId, srow.km, "TypeUp", srow);
  }
  if (ruleLower === "xxx") {
    return resolveMainDitchTypeForSubDitchTurnout(srow);
  }
  return rule;
}

function computeStructureUpDownTypes(srow) {
  if (!srow) return { up: "-", down: "-", upRule: "-", downRule: "-" };
  let sEntry = (typeof getStructureTypeEntry === "function") ? getStructureTypeEntry(srow.name) : null;
  let upRule = (sEntry && sEntry.up !== undefined && sEntry.up !== null && String(sEntry.up).trim() !== "")
    ? String(sEntry.up).trim()
    : "-";
  let downRule = (sEntry && sEntry.down !== undefined && sEntry.down !== null && String(sEntry.down).trim() !== "")
    ? String(sEntry.down).trim()
    : "-";
  return {
    up: resolveStructureSideTypeByRule(srow, upRule),
    down: resolveStructureSideTypeByRule(srow, downRule),
    upRule: upRule,
    downRule: downRule
  };
}

