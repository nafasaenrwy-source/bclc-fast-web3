// ===== js/tab-level.js =====
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บ "ระดับคูส่งน้ำ" (รวมการคำนวณ BL/TBL และวาดเส้นระดับ)
// โค้ดถูกย้ายมาแบบบรรทัดต่อบรรทัด ไม่แก้ไขตรรกะ

function addLevelRowAt(lIdx) {
  syncTableInputsToChannels();
  let prevLvl = levelRowsData[lIdx];
  let chId = prevLvl.channelId;
  let dimItem = dimensionRows.find(d => d.channelId === chId);

  let prevKmEnd = (prevLvl.customKmEnd !== "" && prevLvl.customKmEnd !== undefined)
    ? prevLvl.customKmEnd
    : getChannelKmEnd(chId);

  let newLvlRow = {
    channelId: chId,
    isDynamicRow: true,
    customType: prevLvl.customType || (dimItem ? dimItem.type : "VU1"),
    customSlope: prevLvl.customSlope || (dimItem ? dimItem.slope : 4000),
    customKmStart: prevKmEnd,
    customKmEnd: "",
    h: 0.00,
    bl1: "",
    tbl1: "",
    bl2: "",
    tbl2: ""
  };

  // ⚠️ กด + ที่ "แถวสุดท้ายของคู": ช่อง กม.สิ้นสุดของแถวสุดท้ายถูกล็อก (ดึงจากแท็บมิติ)
  //    ถ้าปล่อยให้แถวใหม่เริ่มที่ กม.สิ้นสุดเดิม จะได้ช่วงยาว 0 (0+100 → 0+100) และแก้ไม่ได้
  //    → แบ่งครึ่งช่วงให้ก่อน แล้วผู้ใช้ปรับ กม.สิ้นสุดของแถวบนต่อได้ทันที (เพราะแถวบนไม่ใช่แถวสุดท้ายแล้ว)
  let sameChanRows = levelRowsData.filter(l => l.channelId === chId);
  let isLastRowOfChan = (sameChanRows.length > 0 && sameChanRows[sameChanRows.length - 1] === prevLvl);
  let prevKmEndNum = parseFloat(prevKmEnd);
  let prevKmStartNum = parseFloat(prevLvl.customKmStart);
  if (isNaN(prevKmStartNum)) {
    prevKmStartNum = (dimItem && dimItem.kmStart !== undefined) ? (parseFloat(dimItem.kmStart) || 0) : 0;
  }
  if (isLastRowOfChan && !isNaN(prevKmEndNum) && prevKmEndNum > prevKmStartNum) {
    let splitKm = Math.round((prevKmStartNum + prevKmEndNum) / 2);
    if (splitKm > prevKmStartNum && splitKm < prevKmEndNum) {
      newLvlRow.customKmStart = splitKm;
      prevLvl.customKmEnd = splitKm;
    }
  }

  levelRowsData.splice(lIdx + 1, 0, newLvlRow);
  enforceLevelLastKmEnd();
  syncStructureRowsWithLevel();
  updateTable();
}

function deleteLevelRowAt(lIdx) {
  confirmDelete('ต้องการลบแถวระดับคูส่งน้ำนี้ใช่หรือไม่?', function () { doDeleteLevelRowAt(lIdx); });
}

function doDeleteLevelRowAt(lIdx) {
  syncTableInputsToChannels();
  let cur = levelRowsData[lIdx];
  let cIdx = cur.channelId;
  let sameChanRows = levelRowsData.filter(l => l.channelId === cIdx);
  if (sameChanRows.length > 1) {
    levelRowsData.splice(lIdx, 1);
  }
  enforceLevelLastKmEnd();
  syncStructureRowsWithLevel();
  updateTable();
}

function updateLevelField(rIdx, field, val) {
  if (levelRowsData[rIdx]) {
    let cIdx = levelRowsData[rIdx].channelId;
    let dimItem = dimensionRows.find(d => d.channelId === cIdx);

    if (field === 'customKmEnd') {
      let parsedVal = parseKmInput(val);
      if (parsedVal !== "") {
        let numVal = parseFloat(parsedVal);
        let curKmStart = parseFloat(levelRowsData[rIdx].customKmStart !== "" ? levelRowsData[rIdx].customKmStart : (dimItem ? dimItem.kmStart : 0)) || 0;
        
        let sameChanRows = levelRowsData.filter(l => l.channelId === cIdx);
        let lastRowInChan = sameChanRows[sameChanRows.length - 1];
        let chanEnd = getChannelKmEnd(cIdx);
        let maxBoundaryKm = (lastRowInChan && lastRowInChan.customKmEnd !== "" && lastRowInChan.customKmEnd !== undefined)
          ? parseFloat(lastRowInChan.customKmEnd)
          : (chanEnd !== "" && chanEnd !== undefined && chanEnd !== null ? parseFloat(chanEnd) : null);

        if (numVal <= curKmStart) {
          alert(`ข้อผิดพลาด: กม.สิ้นสุด (${formatKmDisplay(numVal)}) ต้องมากกว่า กม.เริ่มต้น (${formatKmDisplay(curKmStart)})`);
          updateTable();
          return;
        }

        if (maxBoundaryKm !== null && !isNaN(maxBoundaryKm) && numVal >= maxBoundaryKm) {
          alert(`ข้อผิดพลาด: กม.สิ้นสุด (${formatKmDisplay(numVal)}) ต้องน้อยกว่า กม.สิ้นสุดแถวสุดท้าย (${formatKmDisplay(maxBoundaryKm)})`);
          updateTable();
          return;
        }

        levelRowsData[rIdx].customKmEnd = numVal;

        let isLastRowOfChan = (rIdx === levelRowsData.length - 1) || (levelRowsData[rIdx + 1].channelId !== cIdx);
        if (!isLastRowOfChan && levelRowsData[rIdx + 1]) {
          levelRowsData[rIdx + 1].customKmStart = numVal;
        }
      } else {
        levelRowsData[rIdx].customKmEnd = "";
      }
      syncStructureRowsWithLevel();
      updateTable();
      return;
    } else if (field === 'customKmStart') {
      levelRowsData[rIdx][field] = parseKmInput(val);
    } else if (field === 'h') {
      let num = parseFloat(val);
      levelRowsData[rIdx].h = isNaN(num) ? 0.00 : num;
    } else {
      levelRowsData[rIdx][field] = val;
    }
    syncStructureRowsWithLevel();
    if (typeof syncCrossSectionSelectorsUI === "function") syncCrossSectionSelectorsUI();
    if (typeof activeMediaViewTab !== "undefined" && activeMediaViewTab === "draw" && typeof redraw === "function") {
      redraw();
    }
  }
}

function stepLevelVal(rIdx, field, delta) {
  syncTableInputsToChannels();
  let rLvl = levelRowsData[rIdx];
  if (!rLvl) return;

  let cIdx = rLvl.channelId;
  let dimItem = dimensionRows.find(d => d.channelId === cIdx);
  let curType = rLvl.isDynamicRow 
    ? (rLvl.customType || (dimItem ? dimItem.type : "VU1"))
    : (dimItem ? dimItem.type : "VU1");
  let hTbl = getHFromType(curType);

  let curVal = parseFloat(rLvl[field]) || 0;
  curVal = curVal + delta;
  rLvl[field] = curVal.toFixed(2);

  if (field === 'bl1') {
    rLvl.tbl1 = (curVal + hTbl).toFixed(2);
  } else if (field === 'bl2') {
    rLvl.tbl2 = (curVal + hTbl).toFixed(2);
  }
  syncStructureRowsWithLevel();
  updateTable();
}

function calculateLevelSingleRow(rIdx) {
  syncTableInputsToChannels();
  let rLvl = levelRowsData[rIdx];
  if (!rLvl) return;

  let cIdx = rLvl.channelId;
  let dimItem = dimensionRows.find(d => d.channelId === cIdx);

  let isFirstOfChan = (rIdx === 0) || (levelRowsData[rIdx - 1].channelId !== cIdx);
  if (!isFirstOfChan) {
    let prevRow = levelRowsData[rIdx - 1];
    let prevBl2 = parseFloat(prevRow && prevRow.bl2);
    if (!isNaN(prevBl2)) {
      let curH = parseFloat(rLvl.h) || 0;
      rLvl.bl1 = (prevBl2 - curH).toFixed(2);
    }
  }

  let bl1 = parseFloat(rLvl.bl1);
  if (isNaN(bl1)) {
    alert(isFirstOfChan ? "กรุณากรอกระดับ BL. เริ่มต้นก่อนคำนวณ" : "กรุณาคำนวณระดับของแถวก่อนหน้าก่อน");
    return;
  }

  let curType = rLvl.isDynamicRow 
    ? (rLvl.customType || (dimItem ? dimItem.type : "VU1"))
    : (dimItem ? dimItem.type : "VU1");
  let hTbl = getHFromType(curType);

  let fallbackKmStart = (!isFirstOfChan && levelRowsData[rIdx - 1].customKmEnd !== "" && levelRowsData[rIdx - 1].customKmEnd !== undefined)
    ? levelRowsData[rIdx - 1].customKmEnd
    : (dimItem && dimItem.kmStart !== "" && dimItem.kmStart !== undefined ? dimItem.kmStart : 0);
  if (rLvl.customKmStart === "" || rLvl.customKmStart === undefined) {
    rLvl.customKmStart = fallbackKmStart;
  }
  let km1 = parseFloat(rLvl.customKmStart);
  let km2 = parseFloat(rLvl.customKmEnd !== "" ? rLvl.customKmEnd : getChannelKmEnd(cIdx));
  if (isNaN(km2)) {
    alert("กรุณากรอก กม.สิ้นสุด ก่อนคำนวณ");
    return;
  }

  let dist = Math.abs(km2 - km1);
  let slope = parseFloat(rLvl.isDynamicRow ? rLvl.customSlope : (dimItem ? dimItem.slope : 4000)) || 4000;

  let bl2 = bl1 - (dist / slope);
  rLvl.bl2 = bl2.toFixed(2);
  rLvl.tbl1 = (bl1 + hTbl).toFixed(2);
  rLvl.tbl2 = (bl2 + hTbl).toFixed(2);

  let isLastRowOfChan = (rIdx === levelRowsData.length - 1) || (levelRowsData[rIdx + 1].channelId !== cIdx);

  if (!isLastRowOfChan) {
    let nextRow = levelRowsData[rIdx + 1];
    nextRow.customKmStart = rLvl.customKmEnd;
    
    let nextH = parseFloat(nextRow.h) || 0;
    let nextBl1 = bl2 - nextH;
    nextRow.bl1 = nextBl1.toFixed(2);

    let nextType = nextRow.isDynamicRow 
      ? (nextRow.customType || (dimItem ? dimItem.type : "VU1"))
      : (dimItem ? dimItem.type : "VU1");
    let nextHTbl = getHFromType(nextType);
    nextRow.tbl1 = (nextBl1 + nextHTbl).toFixed(2);
  }

  syncStructureRowsWithLevel();
  updateTable();
}

function isLevelLinesVisible(grpKey) {
  if (typeof levelGroupState === 'undefined' || !levelGroupState || !levelGroupState[grpKey]) return true;
  return levelGroupState[grpKey].showLevelLines !== false;
}

function toggleLevelShowLines(grpKey, cIdx, forcedVal) {
  if (typeof levelGroupState === 'undefined') return;
  if (levelGroupState[grpKey] === undefined) {
    levelGroupState[grpKey] = { locked: true, collapsed: true, showLevelLines: true };
  }
  if (cIdx === undefined || cIdx === null || isNaN(Number(cIdx))) {
    cIdx = parseInt(String(grpKey).replace('ch_', ''), 10);
  }
  const hasLinesForChan = (typeof canalLevelDrawingLines !== 'undefined' && Array.isArray(canalLevelDrawingLines)) &&
    canalLevelDrawingLines.some(l => l && l.channelId === cIdx);

  if (typeof forcedVal === 'boolean') {
    levelGroupState[grpKey].showLevelLines = forcedVal;
  } else if (!hasLinesForChan && levelGroupState[grpKey].showLevelLines !== false) {
    levelGroupState[grpKey].showLevelLines = true;
    drawCanalLevelLines(cIdx);
    updateTable();
    return;
  } else {
    let cur = levelGroupState[grpKey].showLevelLines !== false;
    levelGroupState[grpKey].showLevelLines = !cur;
  }
  if (levelGroupState[grpKey].showLevelLines !== false) {
    drawCanalLevelLines(cIdx, true);
  }
  updateTable();
  if (typeof redraw === 'function') redraw();
}

function drawCanalLevelLines(cIdx, isSilent) {
  syncTableInputsToChannels();
  let grpKey = 'ground_ch_' + cIdx;
  // รอบ 40: ใช้ตัวช่วยเดียวกับทุกจุด (จุดของชุดข้อมูลมาก่อน refPixels)
  let { p1Ref, p2Ref } = (typeof getChannelRefPoints === 'function')
    ? getChannelRefPoints(cIdx)
    : { p1Ref: (typeof getChannelRef === 'function') ? getChannelRef(grpKey, 'p1Ref') : null,
        p2Ref: (typeof getChannelRef === 'function') ? getChannelRef(grpKey, 'p2Ref') : null };
  if (!p1Ref || !p2Ref) {
    p1Ref = (refPixels && refPixels.p1) ? refPixels.p1 : null;
    p2Ref = (refPixels && refPixels.p2) ? refPixels.p2 : null;
  }
  if (!p1Ref || !p2Ref) {
    if (!isSilent) alert("กรุณากำหนดจุด P1 และ P2 ที่แท็บระดับดินเดิมก่อนวาดเส้นระดับ");
    return;
  }

  let x1Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p1Km') : NaN);
  let y1Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p1Elev') : NaN);
  let x2Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p2Km') : NaN);
  let y2Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p2Elev') : NaN);
  if (isNaN(x1Val) && document.getElementById('p1XVal')) x1Val = parseFloat(document.getElementById('p1XVal').value);
  if (isNaN(y1Val) && document.getElementById('p1YVal')) y1Val = parseFloat(document.getElementById('p1YVal').value);
  if (isNaN(x2Val) && document.getElementById('p2XVal')) x2Val = parseFloat(document.getElementById('p2XVal').value);
  if (isNaN(y2Val) && document.getElementById('p2YVal')) y2Val = parseFloat(document.getElementById('p2YVal').value);

  if (x2Val === x1Val || y2Val === y1Val) {
    if (!isSilent) alert("ค่าพิกัดอ้างอิง P1 และ P2 ต้องไม่เท่ากัน");
    return;
  }

  let dimItem = dimensionRows.find(d => d.channelId === cIdx);
  let chanRows = levelRowsData.filter(l => l.channelId === cIdx);

  canalLevelDrawingLines = (Array.isArray(canalLevelDrawingLines) ? canalLevelDrawingLines : []).filter(l => l && l.channelId !== cIdx);

  // รอบ 49: เตรียมป้ายค่า Slope และป้ายค่าระดับ (S1 E1 / S2 E2 ... รวม S/E + TBL + BL คนละบรรทัดในป้ายเดียวกัน และลากย้ายได้)
  const existingLvlLabels = {};
  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
    canvasLabels.forEach(l => {
      if (l && l.fromLevelTable && l.channelId === cIdx && l.id) {
        existingLvlLabels[l.id] = l;
      }
    });
    canvasLabels = canvasLabels.filter(l => !(l && l.fromLevelTable && l.channelId === cIdx));
  }
  const lw = (typeof img !== 'undefined' && img && img.width && typeof imgScale === 'number' && imgScale > 0) ? (img.width * imgScale) : 0;
  const lh = (typeof img !== 'undefined' && img && img.height && typeof imgScale === 'number' && imgScale > 0) ? (img.height * imgScale) : 0;
  const curFrameId = (typeof getCurrentDisplayedFrameId === 'function') ? getCurrentDisplayedFrameId() : null;
  const newLvlLabels = [];

  chanRows.forEach((r, reachIdx) => {
    let secNum = reachIdx + 1;
    let km1 = parseFloat(r.customKmStart !== "" && r.customKmStart !== undefined ? r.customKmStart : (reachIdx === 0 && dimItem && dimItem.kmStart !== undefined ? dimItem.kmStart : 0));
    let km2 = parseFloat(r.customKmEnd !== "" && r.customKmEnd !== undefined ? r.customKmEnd : getChannelKmEnd(cIdx));
    let bl1 = parseFloat(r.bl1);
    let bl2 = parseFloat(r.bl2);
    let tbl1 = parseFloat(r.tbl1);
    let tbl2 = parseFloat(r.tbl2);

    if (!isNaN(km1) && !isNaN(km2)) {
      let px1 = p1Ref.x + ((km1 - x1Val) / (x2Val - x1Val)) * (p2Ref.x - p1Ref.x);
      let px2 = p1Ref.x + ((km2 - x1Val) / (x2Val - x1Val)) * (p2Ref.x - p1Ref.x);

      let rowSlope = (r.isDynamicRow && r.customSlope !== "" && r.customSlope !== undefined)
        ? r.customSlope
        : (dimItem ? dimItem.slope : 4000);
      let pyBl1 = NaN, pyBl2 = NaN, pyTbl1 = NaN, pyTbl2 = NaN;

      if (!isNaN(bl1) && !isNaN(bl2)) {
        pyBl1 = p1Ref.y + ((bl1 - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
        pyBl2 = p1Ref.y + ((bl2 - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
        canalLevelDrawingLines.push({
          type: 'BL',
          color: '#0056b3',
          x1: px1, y1: pyBl1,
          x2: px2, y2: pyBl2,
          km1: km1, km2: km2,
          v1: bl1, v2: bl2,
          y1Val: bl1, y2Val: bl2,
          slope: rowSlope,
          reachIdx: secNum,
          channelId: cIdx
        });
      }

      if (!isNaN(tbl1) && !isNaN(tbl2)) {
        pyTbl1 = p1Ref.y + ((tbl1 - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
        pyTbl2 = p1Ref.y + ((tbl2 - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
        canalLevelDrawingLines.push({
          type: 'TBL',
          color: '#28a745',
          x1: px1, y1: pyTbl1,
          x2: px2, y2: pyTbl2,
          km1: km1, km2: km2,
          v1: tbl1, v2: tbl2,
          y1Val: tbl1, y2Val: tbl2,
          slope: rowSlope,
          reachIdx: secNum,
          channelId: cIdx
        });
      }

      // ป้ายค่าระดับจุดเริ่มต้นช่วง S1, S2, ... (รวม S + TBL + BL คนละบรรทัดในป้ายเดียวกัน)
      if (!isNaN(bl1) || !isNaN(tbl1)) {
        const sId = `lvl_elev_S_${cIdx}_${secNum}`;
        const prevS = existingLvlLabels[sId];
        const sLines = [`S${secNum}`];
        if (!isNaN(tbl1)) sLines.push(`TBL ${Number(tbl1).toFixed(2)}`);
        if (!isNaN(bl1)) sLines.push(`BL ${Number(bl1).toFixed(2)}`);
        const baseY = !isNaN(pyTbl1) ? pyTbl1 : pyBl1;
        const sx = (prevS && prevS._userMoved && typeof prevS.x === 'number') ? prevS.x : (px1 + 4);
        const sy = (prevS && prevS._userMoved && typeof prevS.y === 'number') ? prevS.y : (baseY - 26);
        newLvlLabels.push({
          id: sId,
          frameId: curFrameId || '',
          kind: 'elev',
          fromLevelTable: true,
          channelId: cIdx,
          reachIdx: secNum,
          sectionTag: `S${secNum}`,
          text: sLines.join('\n'),
          x: sx,
          y: sy,
          normX: lw > 0 ? (sx / lw) : undefined,
          normY: lh > 0 ? (sy / lh) : undefined,
          angle: 0,
          align: 'left',
          color: '#0056b3',
          bgColor: 'rgba(255,255,255,0.92)',
          _userMoved: !!(prevS && prevS._userMoved)
        });
      }

      // ป้ายค่าระดับจุดสิ้นสุดช่วง E1, E2, ... (รวม E + TBL + BL คนละบรรทัดในป้ายเดียวกัน)
      if (!isNaN(bl2) || !isNaN(tbl2)) {
        const eId = `lvl_elev_E_${cIdx}_${secNum}`;
        const prevE = existingLvlLabels[eId];
        const eLines = [`E${secNum}`];
        if (!isNaN(tbl2)) eLines.push(`TBL ${Number(tbl2).toFixed(2)}`);
        if (!isNaN(bl2)) eLines.push(`BL ${Number(bl2).toFixed(2)}`);
        const baseY2 = !isNaN(pyBl2) ? pyBl2 : pyTbl2;
        const ex = (prevE && prevE._userMoved && typeof prevE.x === 'number') ? prevE.x : Math.max(4, px2 - 64);
        const ey = (prevE && prevE._userMoved && typeof prevE.y === 'number') ? prevE.y : (baseY2 + 8);
        newLvlLabels.push({
          id: eId,
          frameId: curFrameId || '',
          kind: 'elev',
          fromLevelTable: true,
          channelId: cIdx,
          reachIdx: secNum,
          sectionTag: `E${secNum}`,
          text: eLines.join('\n'),
          x: ex,
          y: ey,
          normX: lw > 0 ? (ex / lw) : undefined,
          normY: lh > 0 ? (ey / lh) : undefined,
          angle: 0,
          align: 'left',
          color: '#0056b3',
          bgColor: 'rgba(255,255,255,0.92)',
          _userMoved: !!(prevE && prevE._userMoved)
        });
      }

      // ป้ายค่า Slope ของช่วงนั้น (ลากย้ายได้)
      if (rowSlope && (!isNaN(pyBl1) || !isNaN(pyTbl1))) {
        const slpId = `lvl_slope_${cIdx}_${secNum}`;
        const prevSlp = existingLvlLabels[slpId];
        const midX = (px1 + px2) / 2;
        const midY = (!isNaN(pyTbl1) && !isNaN(pyTbl2)) ? ((pyTbl1 + pyTbl2) / 2 - 14) : ((pyBl1 + pyBl2) / 2 - 14);
        const slx = (prevSlp && prevSlp._userMoved && typeof prevSlp.x === 'number') ? prevSlp.x : midX;
        const sly = (prevSlp && prevSlp._userMoved && typeof prevSlp.y === 'number') ? prevSlp.y : midY;
        newLvlLabels.push({
          id: slpId,
          frameId: curFrameId || '',
          kind: 'slope',
          fromLevelTable: true,
          channelId: cIdx,
          reachIdx: secNum,
          text: `S 1:${rowSlope}`,
          x: slx,
          y: sly,
          normX: lw > 0 ? (slx / lw) : undefined,
          normY: lh > 0 ? (sly / lh) : undefined,
          angle: 0,
          align: 'center',
          color: '#0d6efd',
          bgColor: 'rgba(255,255,255,0.90)',
          _userMoved: !!(prevSlp && prevSlp._userMoved)
        });
      }
    }
  });

  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels) && newLvlLabels.length > 0) {
    canvasLabels.push(...newLvlLabels);
  }

  const chanLines = canalLevelDrawingLines.filter(l => l && l.channelId === cIdx);
  if (chanLines.length === 0) {
    if (!isSilent) alert("กรุณากรอกระดับและคำนวณระดับคูส่งน้ำให้เรียบร้อยก่อนวาดเส้นระดับ");
    redraw(); // ล้างเส้นระดับที่ค้างอยู่บนจอ (ข้อมูลถูกล้างไปก่อนหน้านี้แล้ว)
    return;
  }

  if (typeof levelGroupState !== 'undefined' && levelGroupState) {
    const lGrpKey = 'ch_' + cIdx;
    if (!levelGroupState[lGrpKey]) levelGroupState[lGrpKey] = { locked: true, collapsed: true };
    if (levelGroupState[lGrpKey].showLevelLines === undefined) levelGroupState[lGrpKey].showLevelLines = true;
  }

  // รอบ 41: บันทึกภาพวาดลงช่องของแท็บที่กำลังดูอยู่ (แยกแท็บ PDF / รูปตัดตามยาว)
  if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
  redraw();
}

// รอบ 31: ปุ่ม "ล็อก/แก้ไข" ทำหน้าที่ "ย่อ/ขยาย" — แทนที่ toggleGroupLock เดิม
//   locked (เดิม) = true  →  collapsed (ใหม่) = true   = แสดงแถวเดียว
//   locked (เดิม) = false →  collapsed (ใหม่) = false  = แสดงทั้งหมด
// ใช้ทั้ง `locked` และ `collapsed` เพื่อความเข้ากันได้กับโค้ดเดิม (toggleGroupCollapse ฯลฯ)
function toggleGroupLock(grpKey) {
  // แยกอิสระจาก toggleGroupCollapse: ปุ่ม "แก้ไข/ล็อก" เปลี่ยนแค่สถานะล็อกเท่านั้น
  // ไม่ย่อ/ขยายแถว (เดิมผูกกับ collapsed → กด "แก้ไข" แล้วไปกระทบ ปุ่ม + / - ด้วย)
  if (levelGroupState[grpKey] === undefined) {
    levelGroupState[grpKey] = { locked: true, collapsed: true };
  }
  levelGroupState[grpKey].locked = !levelGroupState[grpKey].locked;
            if (!levelGroupState[grpKey].locked) {
                levelGroupState[grpKey].collapsed = false;
            }
  // ⚠️ ห้ามแตะ collapsed — ปุ่ม + / - เป็นอิสระ
  updateTable();
}

function toggleGroupCollapse(grpKey) {
  // แยกอิสระจาก toggleGroupLock: ปุ่ม + / - ย่อ/ขยายแถวเท่านั้น ไม่เปลี่ยนสถานะล็อก
  // (เดิมบังคับ locked = collapsed → กด + แล้วไปเปลี่ยนปุ่ม "แก้ไข/ล็อก" ด้วย)
  if (levelGroupState[grpKey] === undefined) {
    levelGroupState[grpKey] = { locked: true, collapsed: true };
  }
  levelGroupState[grpKey].collapsed = !levelGroupState[grpKey].collapsed;
  // ⚠️ ห้ามแตะ locked — ปุ่ม "แก้ไข/ล็อก" เป็นอิสระ
  updateTable();
}

// ===== ฟังก์ชันที่แตกออกมาจาก updateTable() เดิม (เขียนหัวฟังก์ชันใหม่ ส่วน body ย้ายมาตรง ๆ) =====
function renderLevelTab() {
  const container = document.getElementById('tableContainer');

  syncDimensionRowsWithChannels();
  let rowsHtml = '';
  let lastChannelIdx = -1;
  let typeOpts = getDitchTypeOptions();

  levelRowsData.forEach((lvl, lIdx) => {
    let cIdx = lvl.channelId;
    let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
    let canalName = chObj.canal;
    let ditchName = chObj.ditch;
    let groupKey = `ch_${cIdx}`;
    let dimItem = dimensionRows.find(d => d.channelId === cIdx);

    let isFirstOfGroup = (cIdx !== lastChannelIdx);
    lastChannelIdx = cIdx;

    let isLastRowOfChan = (lIdx === levelRowsData.length - 1) || (levelRowsData[lIdx + 1].channelId !== cIdx);

    if (levelGroupState[groupKey] === undefined) {
      // รอบ 31: default = locked + collapsed (แสดงเฉพาะแถวแรก)
      levelGroupState[groupKey] = { locked: true, collapsed: true };
    }
    let isLocked = levelGroupState[groupKey].locked !== false;
    let isCollapsed = levelGroupState[groupKey].collapsed === true;

    let sepClass = (isFirstOfGroup && lIdx > 0) ? 'group-separator-row' : '';
    let rowStyle = (isCollapsed && !isFirstOfGroup) ? 'style="display: none;"' : '';

    let canalCellContent = '';
    if (isFirstOfGroup) {
      let collapseText = isCollapsed ? "+" : "-";
      canalCellContent = `
        <div class="cell-flex-row">
          <button class="btn-collapse-rows" onclick="toggleGroupCollapse('${groupKey}')" tabindex="-1">${collapseText}</button>
          ${renderLockButtonHtml(isLocked, `toggleGroupLock('${groupKey}')`)}
          <span style="font-weight: bold; margin-left: 2px;">${escapeHtml(canalName)}</span>
        </div>
      `;
    } else {
      canalCellContent = `<span style="color: #6c757d;">${escapeHtml(canalName)}</span>`;
    }

    let kmButtonGroup = '';
    if (!isLocked) {
      kmButtonGroup = `
        <div class="km-btn-group">
          <button class="btn-row-add" title="แทรกช่วงด้านล่าง" onclick="addLevelRowAt(${lIdx})" tabindex="-1">+</button>
          ${!isFirstOfGroup ? `<button class="btn-row-del" title="ลบแถวนี้" onclick="deleteLevelRowAt(${lIdx})" tabindex="-1">-</button>` : ''}
        </div>
      `;
    }

    let curType = lvl.isDynamicRow 
      ? (lvl.customType || (dimItem ? dimItem.type : "VU1"))
      : (dimItem ? dimItem.type : "VU1");
    lvl.customType = curType;

    let typeCellHtml = '';
    if (lvl.isDynamicRow && !isLocked) {
      typeCellHtml = `<select class="table-select" data-row="${lIdx}" data-col="2" data-field="customType" onchange="updateLevelField(${lIdx}, 'customType', this.value); updateTable();">`;
      typeOpts.forEach(tp => {
        typeCellHtml += `<option value="${escapeHtml(tp)}" ${tp === curType ? 'selected' : ''}>${escapeHtml(tp)}</option>`;
      });
      typeCellHtml += `</select>`;
    } else {
      typeCellHtml = `<input type="text" class="table-input locked" data-row="${lIdx}" data-col="2" value="${escapeHtml(curType)}" readonly>`;
    }

    let hTblVal = getHFromType(curType).toFixed(2);

    let curSlope = lvl.isDynamicRow 
      ? (lvl.customSlope !== "" && lvl.customSlope !== undefined ? lvl.customSlope : (dimItem ? dimItem.slope : 4000))
      : (dimItem ? dimItem.slope : 4000);
    lvl.customSlope = curSlope;

    let slopeCellHtml = (lvl.isDynamicRow && !isLocked)
      ? `<input type="number" class="table-input" data-row="${lIdx}" data-col="4" data-field="customSlope" value="${escapeHtml(curSlope)}" onchange="updateLevelField(${lIdx}, 'customSlope', this.value)">`
      : `<input type="text" class="table-input locked" data-row="${lIdx}" data-col="4" value="${escapeHtml(curSlope)}" readonly>`;

    let curKmStart = isFirstOfGroup 
      ? ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0)
      : (lvl.customKmStart !== undefined ? lvl.customKmStart : "");
    lvl.customKmStart = curKmStart;
    let kmStartCellHtml = `<input type="text" class="table-input locked" data-row="${lIdx}" data-col="5" value="${escapeHtml(formatKmDisplay(curKmStart))}" readonly title="ล็อกห้ามแก้ไข (รับค่าอัตโนมัติจากแถวบน)">`;

    let hVal = (lvl.h !== undefined && lvl.h !== "") ? Number(lvl.h).toFixed(2) : "0.00";
    let hStepperHtml = !isLocked ? `
      <div class="btn-step-delta">
        <button onclick="stepLevelVal(${lIdx}, 'h', 0.01)" title="+0.01" tabindex="-1">▲</button>
        <button onclick="stepLevelVal(${lIdx}, 'h', -0.01)" title="-0.01" tabindex="-1">▼</button>
      </div>
    ` : '';

    let curKmEnd = lvl.customKmEnd !== "" && lvl.customKmEnd !== undefined 
      ? lvl.customKmEnd 
      : getChannelKmEnd(cIdx);
    lvl.customKmEnd = curKmEnd;

    let kmEndCellHtml = '';
    if (isLastRowOfChan || isLocked) {
      kmEndCellHtml = `<input type="text" class="table-input locked" data-row="${lIdx}" data-col="9" value="${escapeHtml(formatKmDisplay(curKmEnd))}" readonly title="แถวสุดท้ายล็อกค่าตามแท็บมิติคูส่งน้ำ">`;
    } else {
      kmEndCellHtml = `<input type="text" class="table-input" data-row="${lIdx}" data-col="9" data-field="customKmEnd" value="${escapeHtml(formatKmDisplay(curKmEnd))}" placeholder="0+000" onchange="updateLevelField(${lIdx}, 'customKmEnd', this.value)">`;
    }

    const makeStepper = (field) => {
      if (isLocked) return '';
      return `
        <div class="btn-step-delta">
          <button onclick="stepLevelVal(${lIdx}, '${field}', 0.01)" title="+0.01" tabindex="-1">▲</button>
          <button onclick="stepLevelVal(${lIdx}, '${field}', -0.01)" title="-0.01" tabindex="-1">▼</button>
        </div>
      `;
    };

    let bl1CellHtml = '';
    if (isFirstOfGroup) {
      let bl1Class = isLocked ? "table-input locked" : "table-input first-bl-input";
      bl1CellHtml = `
        <div class="cell-flex-row">
          <input type="number" step="0.01" class="${bl1Class}" data-row="${lIdx}" data-col="7" data-field="bl1" value="${escapeHtml(keepNumValue(lvl.bl1))}" placeholder="0.00" ${isLocked ? 'readonly' : ''} onchange="updateLevelField(${lIdx}, 'bl1', this.value)">
          ${!isLocked ? `<button class="btn-calc-cell" title="คำนวณระดับ BL และ TBL" onclick="calculateLevelSingleRow(${lIdx})" tabindex="-1">🧮</button>` : ''}
        </div>
      `;
    } else {
      bl1CellHtml = `
        <div class="cell-flex-row">
          <input type="number" step="0.01" class="table-input locked" data-row="${lIdx}" data-col="7" data-field="bl1" value="${escapeHtml(keepNumValue(lvl.bl1))}" placeholder="0.00" readonly title="ล็อกห้ามกรอกเอง (รับค่าส่งต่อจากแถวบน)">
          ${!isLocked ? `<button class="btn-calc-cell" title="คำนวณระดับ BL และ TBL" onclick="calculateLevelSingleRow(${lIdx})" tabindex="-1">🧮</button>` : ''}
          ${makeStepper('bl1')}
        </div>
      `;
    }

    // รอบ 29 / รอบ 49: เปลี่ยนปุ่ม "วาดเส้นระดับ" เป็นปุ่มสลับ "แสดงเส้นระดับ / ซ่อนเส้นระดับ" ในแถว "จุด P1/P2"
    let levelDrawBtnHtml = '';
    if (isFirstOfGroup) {
      let showLvl = isLevelLinesVisible(groupKey);
      let btnClass = showLvl ? 'state-show' : 'state-hide';
      let btnText = showLvl ? 'แสดงเส้นระดับ' : 'ซ่อนเส้นระดับ';
      levelDrawBtnHtml = `<button type="button" class="btn-toggle-line btn-draw-level ${btnClass}" onclick="toggleLevelShowLines('${groupKey}', ${cIdx})" data-draw-fn="drawCanalLevelLines(${cIdx})" title="คลิกเพื่อวาดและสลับแสดง/ซ่อนเส้นระดับ ค่า Slope และค่าระดับของชุดข้อมูลนี้" tabindex="-1">${btnText}</button>`;
    }

    if (isFirstOfGroup && !isCollapsed && typeof renderReadonlyP1P2ToolbarRowHtml === 'function') {
      rowsHtml += renderReadonlyP1P2ToolbarRowHtml(cIdx, 13, sepClass, levelDrawBtnHtml);
    }
    let dataRowSepClass = (isFirstOfGroup && isCollapsed && lIdx > 0) ? 'group-separator-row' : '';
    // รอบ 41: คอลัมน์สุดท้าย "ช่วงคูน้ำ" (ลำดับ 1, 2, 3 ... ตามคูส่งน้ำที่แยกไว้)
    let ditchSectionHtml = (typeof getDitchSectionHtml === 'function') ? getDitchSectionHtml(cIdx, lvl) : '';
    rowsHtml += `
      <tr class="${dataRowSepClass}" ${rowStyle}>
        <td>${canalCellContent}</td>
        <td>
          <div class="cell-flex-row">
            <span style="font-weight: ${isFirstOfGroup ? 'bold' : 'normal'};">${escapeHtml(ditchName)}</span>
            ${kmButtonGroup}
          </div>
        </td>
        <td>${typeCellHtml}</td>
        <td><input type="text" class="table-input locked" data-row="${lIdx}" data-col="3" value="${escapeHtml(hTblVal)}" readonly title="ดึงสดจากแท็ป Typeคูส่งน้ำ"></td>
        <td>${slopeCellHtml}</td>
        <td>${kmStartCellHtml}</td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" class="table-input${isLocked ? ' locked' : ''}" data-row="${lIdx}" data-col="6" data-field="h" value="${escapeHtml(hVal)}" placeholder="0.00" ${isLocked ? 'readonly' : ''} onchange="updateLevelField(${lIdx}, 'h', this.value); updateTable();">
            ${hStepperHtml}
          </div>
        </td>
        <td>${bl1CellHtml}</td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" class="table-input locked" data-row="${lIdx}" data-col="8" data-field="tbl1" value="${escapeHtml(keepNumValue(lvl.tbl1))}" placeholder="0.00" readonly title="ล็อกห้ามกรอกเอง">
          </div>
        </td>
        <td>${kmEndCellHtml}</td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" class="table-input locked" data-row="${lIdx}" data-col="10" data-field="bl2" value="${escapeHtml(keepNumValue(lvl.bl2))}" placeholder="0.00" readonly title="ล็อกห้ามกรอกเอง">
            ${makeStepper('bl2')}
          </div>
        </td>
        <td>
          <div class="cell-flex-row">
            <input type="number" step="0.01" class="table-input locked" data-row="${lIdx}" data-col="11" data-field="tbl2" value="${escapeHtml(keepNumValue(lvl.tbl2))}" placeholder="0.00" readonly title="ล็อกห้ามกรอกเอง">
          </div>
        </td>
        <td class="ditch-section-cell">${ditchSectionHtml}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="level-table">
      <thead>
        <tr>
          <th style="min-width: 170px;">คลองส่งน้ำ</th>
          <th style="min-width: 110px;">คูส่งน้ำ</th>
          <th style="min-width: 75px;">TYPE</th>
          <th style="min-width: 85px;">H TBL (ม.)</th>
          <th style="min-width: 75px;">SLOPE</th>
          <th style="min-width: 95px;">กม.เริ่มต้น</th>
          <th style="min-width: 90px;">H (ม.)</th>
          <th style="min-width: 125px;">ระดับ BL. เริ่มต้น</th>
          <th style="min-width: 120px;">ระดับ TBL เริ่มต้น</th>
          <th style="min-width: 95px;">กม.สิ้นสุด</th>
          <th style="min-width: 125px;">ระดับ BL. สิ้นสุด</th>
          <th style="min-width: 120px;">ระดับ TBL สิ้นสุด</th>
          <th style="min-width: 90px;">ช่วงคูน้ำ</th>
        </tr>
      </thead>
      <tbody id="levelTableBody">
        ${rowsHtml}
      </tbody>
    </table>
  `;
}
