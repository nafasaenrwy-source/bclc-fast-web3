// ===== js/tab-ground.js =====
var selectedGroundPoint = (typeof window !== "undefined" && window.selectedGroundPoint) ? window.selectedGroundPoint : null;
var draggingGroundPoint = (typeof window !== "undefined" && window.draggingGroundPoint) ? window.draggingGroundPoint : null;
// แยกมาจาก js/table-render.js (เดิม 1894 บรรทัด) — แท็บ "ระดับดินเดิม" (รวมการคำนวณและวาดเส้นดินเดิม)

function addGroundRowAt(gIdx) {
  syncTableInputsToChannels();
  let curRow = groundRowsData[gIdx];
  if (!curRow) return;
  let cIdx = curRow.channelId;
  let dimItem = dimensionRows.find(d => d.channelId === cIdx);

  let kMin = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
  let initialKm = (curRow.km !== "" && curRow.km !== undefined) ? curRow.km : kMin;

  let newGRow = {
    channelId: cIdx,
    isDynamicRow: true,
    isBoundary: false,
    km: initialKm,
    groundElevation: "",
    ditchSection: curRow.ditchSection
  };

  groundRowsData.splice(gIdx + 1, 0, newGRow);
  updateTable();
  autoUpdateGroundDrawingLine(cIdx);
}

function deleteGroundRowAt(gIdx) {
  confirmDelete('ต้องการลบแถวระดับดินเดิมนี้ใช่หรือไม่?', function () { doDeleteGroundRowAt(gIdx); });
}

function doDeleteGroundRowAt(gIdx) {
  syncTableInputsToChannels();
  let curRow = groundRowsData[gIdx];
  if (curRow && !curRow.isBoundary) {
    let cIdx = curRow.channelId;
    groundRowsData.splice(gIdx, 1);
    updateTable();
    if (typeof syncCrossSectionSelectorsUI === "function") syncCrossSectionSelectorsUI();
    autoUpdateGroundDrawingLine(cIdx);
  }
}

function autoUpdateGroundDrawingLine(cIdx) {
  if (cIdx === undefined) {
    cIdx = groundRowsData[0] ? groundRowsData[0].channelId : 0;
  }
  drawGroundFromTable(cIdx, true);
}

function stepGroundElevation(gIdx, delta) {
  syncTableInputsToChannels();
  let grow = groundRowsData[gIdx];
  if (!grow) return;
  let curVal = parseFloat(grow.groundElevation) || 0;
  curVal = curVal + delta;
  grow.groundElevation = curVal.toFixed(2);
  autoUpdateGroundDrawingLine(grow.channelId);
  updateTable();
}

function updateGroundField(gIdx, field, val) {
  if (groundRowsData[gIdx]) {
    let cIdx = groundRowsData[gIdx].channelId;
    if (field === 'km') {
      let parsed = parseKmInput(val);
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
        groundRowsData[gIdx].km = num;
      } else {
        groundRowsData[gIdx].km = "";
      }
    } else if (field === 'groundElevation') {
      let num = parseFloat(val);
      groundRowsData[gIdx].groundElevation = isNaN(num) ? "" : num.toFixed(2);
    } else {
      groundRowsData[gIdx][field] = val;
    }
    autoUpdateGroundDrawingLine(cIdx);
  }
}

function calculateGroundForChannel(cIdx) {
  syncTableInputsToChannels();
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] && groundGroupState[grpKey].locked !== false) {
    return;
  }

  let defaultChId = channels[0] ? channels[0].id : 1;
  let chanDraft = (manualGroundLinePoints || []).filter(p =>
    p.channelId === cIdx || (p.channelId === undefined && cIdx === defaultChId)
  );

  if (chanDraft.length < 2) {
    alert("ไม่พบเส้นดินเดิมของชุดข้อมูลนี้ที่ลากไว้ในภาพ กรุณาคลิกปุ่ม 'ลากเส้นดินเดิม' เพื่อลากเส้นบนภาพอย่างน้อย 2 จุดก่อน");
    return;
  }

  let dimItem = dimensionRows.find(d => d.channelId === cIdx);
  let kStart = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
  let kEndRaw = getChannelKmEnd(cIdx);
  let kEnd = (kEndRaw !== "" && kEndRaw !== undefined && kEndRaw !== null) ? parseFloat(kEndRaw) : null;

  if (kEnd === null || isNaN(kEnd)) {
    alert("กรุณากรอก กม.สิ้นสุด ในแท็บมิติคูส่งน้ำก่อนคำนวณ");
    return;
  }

  let kMin = Math.min(kStart, kEnd);
  let kMax = Math.max(kStart, kEnd);

  let sortedDraft = [...chanDraft].sort((a, b) => a.xData - b.xData);

  function interpolateGroundY(targetKm) {
    if (targetKm <= sortedDraft[0].xData) return sortedDraft[0].yData;
    if (targetKm >= sortedDraft[sortedDraft.length - 1].xData) return sortedDraft[sortedDraft.length - 1].yData;
    for (let i = 0; i < sortedDraft.length - 1; i++) {
      let pA = sortedDraft[i];
      let pB = sortedDraft[i + 1];
      if (targetKm >= pA.xData && targetKm <= pB.xData) {
        if (pB.xData === pA.xData) return pA.yData;
        let ratio = (targetKm - pA.xData) / (pB.xData - pA.xData);
        return pA.yData + ratio * (pB.yData - pA.yData);
      }
    }
    return sortedDraft[0].yData;
  }

  let interiorPoints = sortedDraft.filter(dp => dp.xData > kMin && dp.xData < kMax);

  let newChanRows = [];
  newChanRows.push({
    channelId: cIdx,
    isDynamicRow: false,
    isBoundary: true,
    km: kStart,
    groundElevation: Number(interpolateGroundY(kStart)).toFixed(2)
  });

  interiorPoints.forEach(pt => {
    newChanRows.push({
      channelId: cIdx,
      isDynamicRow: true,
      isBoundary: false,
      km: pt.xData,
      groundElevation: Number(pt.yData).toFixed(2)
    });
  });

  newChanRows.push({
    channelId: cIdx,
    isDynamicRow: false,
    isBoundary: true,
    km: kEnd,
    groundElevation: Number(interpolateGroundY(kEnd)).toFixed(2)
  });

  let firstIdx = groundRowsData.findIndex(g => g.channelId === cIdx);
  if (firstIdx !== -1) {
    let count = groundRowsData.filter(g => g.channelId === cIdx).length;
    groundRowsData.splice(firstIdx, count, ...newChanRows);
  } else {
    groundRowsData.push(...newChanRows);
  }

  // เมื่อกดคำนวณให้ลบเส้นที่ลากจากปุ่มลากดินเดิม (manualGroundLinePoints) ของชุดข้อมูลนี้ทิ้งทันที
  manualGroundLinePoints = (manualGroundLinePoints || []).filter(p =>
    !(p.channelId === cIdx || (p.channelId === undefined && cIdx === defaultChId))
  );
  if (typeof currentMode !== 'undefined' && ['data', 'p1', 'p2'].includes(currentMode)) {
    if (typeof setMode === 'function') setMode('pan');
  }

  updateTable();
  autoUpdateGroundDrawingLine(cIdx);
}

function drawGroundFromTable(cIdx, isAuto = false) {
  let grpKey = 'ground_ch_' + cIdx;
  // รอบ 40: ใช้ตัวช่วยเดียวกับทุกจุด (จุดของชุดข้อมูลมาก่อน refPixels)
  let { p1Ref, p2Ref } = getChannelRefPoints(cIdx);

  if (!p1Ref || !p2Ref) {
    if (!isAuto) alert("กรุณากำหนดจุด P1 และ P2 (ต่อชุดข้อมูล) ก่อนวาดเส้น");
    redraw();
    return;
  }

  let validRowsWithIdx = [];
  groundRowsData.forEach((r, gIdx) => {
    if (!r || Number(r.channelId) !== Number(cIdx)) return;
    let kmParsed = (typeof parseKmInput === 'function' && String(r.km).includes('+')) ? parseKmInput(r.km) : parseFloat(r.km);
    let elevParsed = parseFloat(r.groundElevation);
    if (r.km !== "" && !isNaN(kmParsed) && r.groundElevation !== "" && !isNaN(elevParsed)) {
      validRowsWithIdx.push({ r, gIdx, kmNum: kmParsed, elevNum: elevParsed });
    }
  });

  if (validRowsWithIdx.length < 2) {
    if (!isAuto) alert("ข้อมูลในตารางต้องมีค่า กม. และ ระดับดินเดิม อย่างน้อย 2 จุดขึ้นไปเพื่อวาดเส้น");
    tableGroundLinePoints = (tableGroundLinePoints || []).filter(p => p.channelId !== cIdx);
    redraw();
    return;
  }

  let x1Val = parseFloat(getChannelP1P2(grpKey, 'p1Km'));
  let y1Val = parseFloat(getChannelP1P2(grpKey, 'p1Elev'));
  let x2Val = parseFloat(getChannelP1P2(grpKey, 'p2Km'));
  let y2Val = parseFloat(getChannelP1P2(grpKey, 'p2Elev'));

  if (isNaN(x1Val)) x1Val = parseFloat(document.getElementById('p1XVal').value);
  if (isNaN(y1Val)) y1Val = parseFloat(document.getElementById('p1YVal').value);
  if (isNaN(x2Val)) x2Val = parseFloat(document.getElementById('p2XVal').value);
  if (isNaN(y2Val)) y2Val = parseFloat(document.getElementById('p2YVal').value);

  if (x2Val === x1Val || y2Val === y1Val) {
    if (!isAuto) alert("ค่าพิกัดอ้างอิง P1 และ P2 ต้องไม่เท่ากัน");
    redraw();
    return;
  }

  let otherChannelPoints = (tableGroundLinePoints || []).filter(p => Number(p.channelId) !== Number(cIdx));
  tableGroundLinePoints = validRowsWithIdx.map(({ r, gIdx, kmNum, elevNum }) => {
    let xData = (typeof kmNum === 'number' && !isNaN(kmNum)) ? kmNum : parseFloat(r.km);
    let yData = (typeof elevNum === 'number' && !isNaN(elevNum)) ? elevNum : parseFloat(r.groundElevation);
    let px = p1Ref.x + ((xData - x1Val) / (x2Val - x1Val)) * (p2Ref.x - p1Ref.x);
    let py = p1Ref.y + ((yData - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
    return {
      x: px,
      y: py,
      xData: xData,
      yData: yData,
      channelId: cIdx,
      gIdx: gIdx,
      isBoundary: !!r.isBoundary
    };
  });

  tableGroundLinePoints.sort((a, b) => a.xData - b.xData);
  tableGroundLinePoints = otherChannelPoints.concat(tableGroundLinePoints);
  // รอบ 41: บันทึกภาพวาดลงช่องของแท็บที่กำลังดูอยู่ (แยกแท็บ PDF / รูปตัดตามยาว)
  if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
  redraw();
}

function selectChannelCalibPoint(cIdx, mode) {
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: false };
  }
  if (groundGroupState[grpKey].locked !== false) return;

  activeChannelId = cIdx;
  let p1Km = (groundGroupState[grpKey].p1Km !== undefined) ? groundGroupState[grpKey].p1Km : 0;
  let p1Elev = (groundGroupState[grpKey].p1Elev !== undefined) ? groundGroupState[grpKey].p1Elev : 0;
  let p2Km = (groundGroupState[grpKey].p2Km !== undefined) ? groundGroupState[grpKey].p2Km : 100;
  let p2Elev = (groundGroupState[grpKey].p2Elev !== undefined) ? groundGroupState[grpKey].p2Elev : 50;

  let elP1X = document.getElementById('p1XVal');
  let elP1Y = document.getElementById('p1YVal');
  let elP2X = document.getElementById('p2XVal');
  let elP2Y = document.getElementById('p2YVal');
  if (elP1X) elP1X.value = p1Km;
  if (elP1Y) elP1Y.value = p1Elev;
  if (elP2X) elP2X.value = p2Km;
  if (elP2Y) elP2Y.value = p2Elev;

  if (groundGroupState[grpKey].p1Ref) refPixels.p1 = groundGroupState[grpKey].p1Ref;
  if (groundGroupState[grpKey].p2Ref) refPixels.p2 = groundGroupState[grpKey].p2Ref;

  setMode(mode);
  renderGroundTab();
  redraw();
}

function updateChannelCalibCoord(cIdx, field, val) {
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: false };
  }
  if (groundGroupState[grpKey].locked !== false) return;
  groundGroupState[grpKey][field] = val;

  let toolbarMap = { p1Km: 'p1XVal', p1Elev: 'p1YVal', p2Km: 'p2XVal', p2Elev: 'p2YVal' };
  let tbId = toolbarMap[field];
  if (tbId && activeChannelId === cIdx) {
    let el = document.getElementById(tbId);
    if (el) el.value = val;
  }
  autoUpdateGroundDrawingLine(cIdx);
}

function startChannelDataMode(cIdx) {
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: false };
  }
  if (groundGroupState[grpKey].locked !== false) return;

  let isSwitchingChannel = (activeChannelId !== cIdx);
  activeChannelId = cIdx;

  let p1Km = (groundGroupState[grpKey].p1Km !== undefined) ? groundGroupState[grpKey].p1Km : 0;
  let p1Elev = (groundGroupState[grpKey].p1Elev !== undefined) ? groundGroupState[grpKey].p1Elev : 0;
  let p2Km = (groundGroupState[grpKey].p2Km !== undefined) ? groundGroupState[grpKey].p2Km : 100;
  let p2Elev = (groundGroupState[grpKey].p2Elev !== undefined) ? groundGroupState[grpKey].p2Elev : 50;

  let elP1X = document.getElementById('p1XVal');
  let elP1Y = document.getElementById('p1YVal');
  let elP2X = document.getElementById('p2XVal');
  let elP2Y = document.getElementById('p2YVal');
  if (elP1X) elP1X.value = p1Km;
  if (elP1Y) elP1Y.value = p1Elev;
  if (elP2X) elP2X.value = p2Km;
  if (elP2Y) elP2Y.value = p2Elev;

  if (groundGroupState[grpKey].p1Ref) refPixels.p1 = groundGroupState[grpKey].p1Ref;
  if (groundGroupState[grpKey].p2Ref) refPixels.p2 = groundGroupState[grpKey].p2Ref;

  // เมื่อเปลี่ยนชุดข้อมูลและกดปุ่มลากเส้นดินเดิม ให้เริ่มลากเส้นใหม่ของชุดข้อมูลนี้ทันที
  if (isSwitchingChannel) {
    manualGroundLinePoints = (manualGroundLinePoints || []).filter(p => p.channelId !== cIdx);
  }

  startDataMode();
  renderGroundTab();
}


function toggleGroundGroupLock(grpKey) {
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: true };
  }
  groundGroupState[grpKey].locked = !groundGroupState[grpKey].locked;
  let cIdx = parseInt(String(grpKey).replace('ground_ch_', ''), 10);
  if (!groundGroupState[grpKey].locked) {
    // เมื่อกดปุ่ม "แก้ไข" (ปลดล็อก) ให้ขยายชุดข้อมูลนั้นด้วย และตั้งเป็นชุดข้อมูลที่กำลังแก้ไข
    groundGroupState[grpKey].collapsed = false;
    if (!isNaN(cIdx)) {
      activeChannelId = cIdx;
      let p1Km = (groundGroupState[grpKey].p1Km !== undefined) ? groundGroupState[grpKey].p1Km : 0;
      let p1Elev = (groundGroupState[grpKey].p1Elev !== undefined) ? groundGroupState[grpKey].p1Elev : 0;
      let p2Km = (groundGroupState[grpKey].p2Km !== undefined) ? groundGroupState[grpKey].p2Km : 100;
      let p2Elev = (groundGroupState[grpKey].p2Elev !== undefined) ? groundGroupState[grpKey].p2Elev : 50;
      let elP1X = document.getElementById('p1XVal');
      let elP1Y = document.getElementById('p1YVal');
      let elP2X = document.getElementById('p2XVal');
      let elP2Y = document.getElementById('p2YVal');
      if (elP1X) elP1X.value = p1Km;
      if (elP1Y) elP1Y.value = p1Elev;
      if (elP2X) elP2X.value = p2Km;
      if (elP2Y) elP2Y.value = p2Elev;
      if (groundGroupState[grpKey].p1Ref) refPixels.p1 = groundGroupState[grpKey].p1Ref;
      if (groundGroupState[grpKey].p2Ref) refPixels.p2 = groundGroupState[grpKey].p2Ref;
    }
  } else {
    if (typeof selectedGroundPoint !== 'undefined' && selectedGroundPoint && selectedGroundPoint.channelId === cIdx) {
      selectedGroundPoint = null;
    }
    if (activeChannelId === cIdx && ['p1', 'p2', 'data', 'add_ground_pt'].includes(currentMode)) {
      if (typeof setMode === 'function') setMode('pan');
    }
  }
  updateTable();
  if (typeof redraw === 'function') redraw();
}

function toggleGroundGroupCollapse(grpKey) {
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: true };
  }
  groundGroupState[grpKey].collapsed = !groundGroupState[grpKey].collapsed;
  updateTable();
}

// ตัวช่วยจัดการ P1/P2 และปุ่มสลับแสดง/ซ่อนเส้นต่อชุดข้อมูล
function toggleGroundShowDrawing(grpKey, forcedVal) {
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: true };
  }
  let cIdx = parseInt(String(grpKey).replace('ground_ch_', ''), 10);
  const hasGroundPts = !isNaN(cIdx) && (
    (typeof tableGroundLinePoints !== 'undefined' && Array.isArray(tableGroundLinePoints) && tableGroundLinePoints.some(p => p && Number(p.channelId) === Number(cIdx))) ||
    (typeof manualGroundLinePoints !== 'undefined' && Array.isArray(manualGroundLinePoints) && manualGroundLinePoints.some(p => p && Number(p.channelId) === Number(cIdx)))
  );
  if (typeof forcedVal === 'boolean') {
    groundGroupState[grpKey].showDrawing = forcedVal;
  } else if (!hasGroundPts && groundGroupState[grpKey].showDrawing !== false) {
    // รอบ 50: ถ้ายังไม่มีเส้นดินเดิมบนภาพ กดปุ่ม "แสดงเส้นดินเดิม" ให้คำนวณและแสดงเส้นของสายนี้ทันที
    groundGroupState[grpKey].showDrawing = true;
    if (!isNaN(cIdx) && typeof drawGroundFromTable === 'function') {
      drawGroundFromTable(cIdx, false);
    }
    updateTable();
    redraw();
    return;
  } else {
    let cur = groundGroupState[grpKey].showDrawing !== false;
    groundGroupState[grpKey].showDrawing = !cur;
  }
  if (groundGroupState[grpKey].showDrawing !== false && !isNaN(cIdx) && typeof drawGroundFromTable === 'function') {
    drawGroundFromTable(cIdx, true);
  }
  updateTable();
  redraw();
}

function updateGroundP1P2(grpKey, key, val) {
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: true };
  }
  groundGroupState[grpKey][key] = val;
}

function clearGroundP1P2(grpKey) {
  if (groundGroupState[grpKey] === undefined) return;
  delete groundGroupState[grpKey].p1Ref;
  delete groundGroupState[grpKey].p2Ref;
  delete groundGroupState[grpKey].p1Km;
  delete groundGroupState[grpKey].p1Elev;
  delete groundGroupState[grpKey].p2Km;
  delete groundGroupState[grpKey].p2Elev;
  updateTable();
  redraw();
}

function getChannelRef(grpKey, refName) {
  let grp = groundGroupState[grpKey];
  if (grp && grp[refName]) return grp[refName];
  return null;
}

// รอบ 40: ดึงจุดอ้างอิง P1/P2 ของชุดข้อมูล — "แหล่งเดียว" ที่ทุกส่วนของโค้ดใช้ร่วมกัน
//   ลำดับความสำคัญ: จุดของชุดข้อมูล (p1Ref/p2Ref) → refPixels (จุดกลางที่เพิ่งคลิก)
//   เดิมแต่ละฟังก์ชันเลือกลำดับต่างกัน → เวลาสลับชุดข้อมูล/สลับแท็บ จุดที่วาดกับจุดที่แสดงไม่ตรงกัน
//   (อาการ: จุด P1/P2 ไม่ตรงจุดในรูป · วาดเส้นผิด · จุด P1/P2 หาย)
function getChannelRefPoints(cIdx) {
  const grpKey = 'ground_ch_' + cIdx;
  const grp = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState[grpKey] : null;
  if (grp && (grp.p1Ref || grp.p2Ref)) {
    return { p1Ref: grp.p1Ref || null, p2Ref: grp.p2Ref || null };
  }
  // รอบ 51: ห้ามนำ refPixels ของสายหนึ่งไปใช้เป็นค่าสำรองของสายอื่นที่ยังไม่ได้กำหนดจุด P1/P2
  // อนุญาตให้ fallback ไปใช้ refPixels ได้เฉพาะกรณีเป็นสายที่กำลังเลือกอยู่ (activeChannelId) และยังไม่มีสายอื่นผูกจุด p1Ref/p2Ref ไว้ใน groundGroupState เท่านั้น
  const isAct = (typeof activeChannelId === 'undefined' || activeChannelId === null || Number(cIdx) === Number(activeChannelId));
  const anyOtherHasRef = (typeof groundGroupState !== 'undefined' && groundGroupState) &&
    Object.keys(groundGroupState).some(k => k !== grpKey && groundGroupState[k] && (groundGroupState[k].p1Ref || groundGroupState[k].p2Ref));
  if (isAct && !anyOtherHasRef) {
    const p1 = (typeof refPixels !== 'undefined' && refPixels) ? refPixels.p1 : null;
    const p2 = (typeof refPixels !== 'undefined' && refPixels) ? refPixels.p2 : null;
    return { p1Ref: p1, p2Ref: p2 };
  }
  return { p1Ref: null, p2Ref: null };
}

function getChannelP1P2(grpKey, key) {
  let grp = groundGroupState[grpKey];
  let val = (grp && grp[key] !== undefined) ? grp[key] : undefined;
  if (val === undefined || val === null || val === '') {
    let toolbarId = { p1Km: 'p1XVal', p1Elev: 'p1YVal', p2Km: 'p2XVal', p2Elev: 'p2YVal' }[key];
    if (toolbarId) {
      let el = document.getElementById(toolbarId);
      if (el) val = el.value;
    }
  }
  if ((key === 'p1Km' || key === 'p2Km') && typeof val === 'string' && val.includes('+') && typeof parseKmInput === 'function') {
    return parseKmInput(val);
  }
  return val !== undefined ? val : '';
}

function renderGroundTab() {
  const container = document.getElementById('tableContainer');

  syncDimensionRowsWithChannels();
  let rowsHtml = '';
  let lastChannelIdx = -1;

  groundRowsData.forEach((grow, gIdx) => {
    let cIdx = grow.channelId;
    let chObj = getChannelById(cIdx) || { canal: "คลอง", ditch: "-" };
    let canalName = chObj.canal;
    let ditchName = chObj.ditch;
    let groupKey = `ground_ch_${cIdx}`;

    let isFirstOfGroup = (cIdx !== lastChannelIdx);
    if (isFirstOfGroup) {
      lastChannelIdx = cIdx;
    }

    let isLastRowOfChan = (gIdx === groundRowsData.length - 1) || (groundRowsData[gIdx + 1].channelId !== cIdx);

    if (groundGroupState[groupKey] === undefined) {
      groundGroupState[groupKey] = { locked: true, collapsed: true };
    }
    let isLocked = groundGroupState[groupKey].locked !== false;
    let isCollapsed = groundGroupState[groupKey].collapsed === true;

    let sepClass = (isFirstOfGroup && gIdx > 0) ? 'group-separator-row' : '';
    let rowStyle = (isCollapsed && !isFirstOfGroup) ? 'style="display: none;"' : '';

    let canalCellContent = '';
    if (isFirstOfGroup) {
      let collapseText = isCollapsed ? "+" : "-";
      canalCellContent = `
        <div class="cell-flex-row">
          <button class="btn-collapse-rows" onclick="toggleGroundGroupCollapse('${groupKey}')" tabindex="-1">${collapseText}</button>
          ${renderLockButtonHtml(isLocked, `toggleGroundGroupLock('${groupKey}')`)}
          <span style="font-weight: bold; margin-left: 2px;">${escapeHtml(canalName)}</span>
        </div>
      `;
    } else {
      canalCellContent = `<span style="color: #6c757d;">${escapeHtml(canalName)}</span>`;
    }

    let kmButtonGroup = '';
    if (!isLocked) {
      if (isFirstOfGroup) {
        kmButtonGroup = `
          <div class="km-btn-group">
            <button class="btn-row-add" title="แทรกแถวด้านล่าง" onclick="addGroundRowAt(${gIdx})" tabindex="-1">+</button>
          </div>
        `;
      } else if (!isLastRowOfChan) {
        kmButtonGroup = `
          <div class="km-btn-group">
            <button class="btn-row-add" title="แทรกแถวด้านล่าง" onclick="addGroundRowAt(${gIdx})" tabindex="-1">+</button>
            <button class="btn-row-del" title="ลบแถวนี้" onclick="deleteGroundRowAt(${gIdx})" tabindex="-1">-</button>
          </div>
        `;
      }
    }

    let ditchCellContent = `
      <div class="cell-flex-row">
        <span style="font-weight: ${isFirstOfGroup ? 'bold' : 'normal'};">${escapeHtml(ditchName)}</span>
        ${kmButtonGroup}
      </div>
    `;

    let kmInputHtml = '';
    if (grow.isBoundary || isLocked) {
      kmInputHtml = `<input type="text" class="table-input locked" data-row="${gIdx}" data-col="2" data-field="km" value="${escapeHtml(formatKmDisplay(grow.km))}" readonly title="${grow.isBoundary ? 'ล็อกค่าตามแท็บมิติคูส่งน้ำ' : ''}">`;
    } else {
      kmInputHtml = `<input type="text" class="table-input" data-row="${gIdx}" data-col="2" data-field="km" value="${escapeHtml(formatKmDisplay(grow.km))}" placeholder="0+000" onchange="updateGroundField(${gIdx}, 'km', this.value); updateTable();">`;
    }

    let elevationStepperHtml = !isLocked ? `
      <div class="btn-step-delta">
        <button onclick="stepGroundElevation(${gIdx}, 0.01)" title="+0.01" tabindex="-1">▲</button>
        <button onclick="stepGroundElevation(${gIdx}, -0.01)" title="-0.01" tabindex="-1">▼</button>
      </div>
    ` : '';

    let groundElevationHtml = `
      <div class="cell-flex-row">
        <input type="number" step="0.01" class="table-input${isLocked ? ' locked' : ''}" data-row="${gIdx}" data-col="3" data-field="groundElevation" value="${escapeHtml(keepNumValue(grow.groundElevation))}" placeholder="0.00" ${isLocked ? 'readonly' : ''} onchange="updateGroundField(${gIdx}, 'groundElevation', this.value); updateTable();">
        ${elevationStepperHtml}
      </div>
    `;

    // แถบเครื่องมือ P1/P2 / ลากเส้นดินเดิม / คำนวณ / แสดง-ซ่อนเส้น บนแถวแรกของแต่ละชุดข้อมูล (เมื่อขยาย)
    // ล็อก/แก้ไขตามสถานะ isLocked ของชุดข้อมูลนั้น
    if (isFirstOfGroup && !isCollapsed) {
      let p1Km = (groundGroupState[groupKey].p1Km !== undefined) ? groundGroupState[groupKey].p1Km : 0;
      let p1Elev = (groundGroupState[groupKey].p1Elev !== undefined) ? groundGroupState[groupKey].p1Elev : 0;
      let p2Km = (groundGroupState[groupKey].p2Km !== undefined) ? groundGroupState[groupKey].p2Km : 100;
      let p2Elev = (groundGroupState[groupKey].p2Elev !== undefined) ? groundGroupState[groupKey].p2Elev : 50;

      let isCalibActive = !isLocked && ((currentMode === 'p1' || currentMode === 'p2') && activeChannelId === cIdx);
      let isDataActive = !isLocked && (currentMode === 'data' && activeChannelId === cIdx);
      let isAddPtActive = !isLocked && (currentMode === 'add_ground_pt' && activeChannelId === cIdx);

      let disabledAttr = isLocked ? 'disabled' : '';
      let readonlyAttr = isLocked ? 'readonly' : '';
      let lockedBoxClass = isLocked ? ' locked-box' : '';

      let showDrawing = groundGroupState[groupKey].showDrawing !== false;
      let showBtnClass = showDrawing ? 'state-show' : 'state-hide';
      let showBtnText = showDrawing ? 'แสดงเส้นดินเดิม' : 'ซ่อนเส้นดินเดิม';

      let pointEditBtnsHtml = !isLocked ? `
              <button type="button" class="btn-ground-pt-add${isAddPtActive ? ' active' : ''}" onclick="startAddGroundPointMode(${cIdx})" title="คลิกเพื่อเพิ่มจุดบนเส้นดินเดิมที่คำนวณของชุดข้อมูลนี้" tabindex="-1">➕ เพิ่มจุด</button>
              <button type="button" class="btn-ground-pt-del" onclick="deleteSelectedGroundPoint(${cIdx})" title="ลบจุดที่เลือกบนเส้นดินเดิมที่คำนวณของชุดข้อมูลนี้" tabindex="-1">➖ ลบจุด</button>
      ` : '';

      rowsHtml += `
        <tr class="ground-toolbar-row ${sepClass}">
          <td colspan="5" style="padding: 6px 10px; text-align: left; background: #fdfdfd; border-bottom: 2px solid #b8daff;">
            <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; flex-wrap: wrap;">
              <button type="button" class="btn-calib-p${isCalibActive ? ' active' : ''}" ${disabledAttr} onclick="selectChannelCalibPoint(${cIdx}, 'p1')" title="คลิกเพื่อกำหนดจุด P1 และ P2 บนภาพต่อเนื่องในคราวเดียว" tabindex="-1">กำหนด P1,P2</button>
              <div class="calib-input-inline${lockedBoxClass}">
                <strong class="calib-pt-tag">P1</strong>
                <span>กม.:</span><input type="number" data-calib-ch="${cIdx}" data-calib-field="p1Km" value="${escapeHtml(p1Km)}" ${readonlyAttr} oninput="updateChannelCalibCoord(${cIdx}, 'p1Km', this.value)" onchange="updateChannelCalibCoord(${cIdx}, 'p1Km', this.value)">
                <span>ระดับ:</span><input type="number" data-calib-ch="${cIdx}" data-calib-field="p1Elev" value="${escapeHtml(p1Elev)}" ${readonlyAttr} oninput="updateChannelCalibCoord(${cIdx}, 'p1Elev', this.value)" onchange="updateChannelCalibCoord(${cIdx}, 'p1Elev', this.value)">
              </div>

              <div class="calib-input-inline${lockedBoxClass}">
                <strong class="calib-pt-tag">P2</strong>
                <span>กม.:</span><input type="number" data-calib-ch="${cIdx}" data-calib-field="p2Km" value="${escapeHtml(p2Km)}" ${readonlyAttr} oninput="updateChannelCalibCoord(${cIdx}, 'p2Km', this.value)" onchange="updateChannelCalibCoord(${cIdx}, 'p2Km', this.value)">
                <span>ระดับ:</span><input type="number" data-calib-ch="${cIdx}" data-calib-field="p2Elev" value="${escapeHtml(p2Elev)}" ${readonlyAttr} oninput="updateChannelCalibCoord(${cIdx}, 'p2Elev', this.value)" onchange="updateChannelCalibCoord(${cIdx}, 'p2Elev', this.value)">
              </div>

              <button type="button" class="btn-step3-inline${isDataActive ? ' active' : ''}" ${disabledAttr} onclick="startChannelDataMode(${cIdx})" title="คลิกเพื่อลากเส้นดินเดิมของชุดข้อมูลนี้" tabindex="-1">ลากเส้นดินเดิม</button>
              <button type="button" class="btn-calc-cell btn-table-action-cell" style="padding: 4px 10px; font-size: 0.78em;" ${disabledAttr} onclick="calculateGroundForChannel(${cIdx})" title="คำนวณระดับดินเดิมจากเส้นที่ลากในภาพ" tabindex="-1">🧮 คำนวณ</button>
              ${pointEditBtnsHtml}
              <button type="button" class="btn-toggle-line ${showBtnClass}" onclick="toggleGroundShowDrawing('${groupKey}')" data-legacy-check="toggleGroundShowDrawing('${groupKey}', this.checked)" title="คลิกเพื่อสลับแสดง/ซ่อนเส้นดินเดิมและจุด P1, P2 ของชุดข้อมูลนี้บนภาพ" tabindex="-1">${showBtnText}</button>
            </div>
          </td>
        </tr>
      `;
    }

    let dataRowSepClass = (isFirstOfGroup && isCollapsed && gIdx > 0) ? 'group-separator-row' : '';
    // รอบ 41: คอลัมน์สุดท้าย "ช่วงคูน้ำ" (ลำดับ 1, 2, 3 ... ตามคูส่งน้ำที่แยกไว้)
    let ditchSectionHtml = (typeof getDitchSectionHtml === 'function') ? getDitchSectionHtml(cIdx, grow) : '';
    rowsHtml += `
      <tr class="${dataRowSepClass}" ${rowStyle}>
        <td>${canalCellContent}</td>
        <td>${ditchCellContent}</td>
        <td>${kmInputHtml}</td>
        <td>${groundElevationHtml}</td>
        <td class="ditch-section-cell">${ditchSectionHtml}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="ground-table">
      <thead>
        <tr>
          <th style="min-width: 170px;">คลองส่งน้ำ</th>
          <th style="min-width: 130px;">คูส่งน้ำ</th>
          <th style="min-width: 120px;">กม.</th>
          <th style="min-width: 135px;">ระดับดินเดิม (ม.)</th>
          <th style="min-width: 90px;">ช่วงคูน้ำ</th>
        </tr>
      </thead>
      <tbody id="groundTableBody">
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function startAddGroundPointMode(cIdx) {
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] === undefined) {
    groundGroupState[grpKey] = { locked: true, collapsed: false };
  }
  if (groundGroupState[grpKey].locked !== false) {
    alert('ชุดข้อมูลนี้ล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ก่อนเพิ่มจุด');
    return;
  }

  let hasCalculatedLine = (tableGroundLinePoints || []).some(p => p.channelId === cIdx);
  if (!hasCalculatedLine) {
    alert('ยังไม่มีเส้นที่เขียนจากการคำนวณของชุดข้อมูลนี้ กรุณากดปุ่ม "🧮 คำนวณ" หรือกรอกข้อมูลในตารางก่อน');
    return;
  }

  if (currentMode === 'add_ground_pt' && activeChannelId === cIdx) {
    setMode('pan');
    renderGroundTab();
    return;
  }

  activeChannelId = cIdx;
  let p1Km = (groundGroupState[grpKey].p1Km !== undefined) ? groundGroupState[grpKey].p1Km : 0;
  let p1Elev = (groundGroupState[grpKey].p1Elev !== undefined) ? groundGroupState[grpKey].p1Elev : 0;
  let p2Km = (groundGroupState[grpKey].p2Km !== undefined) ? groundGroupState[grpKey].p2Km : 100;
  let p2Elev = (groundGroupState[grpKey].p2Elev !== undefined) ? groundGroupState[grpKey].p2Elev : 50;

  let elP1X = document.getElementById('p1XVal');
  let elP1Y = document.getElementById('p1YVal');
  let elP2X = document.getElementById('p2XVal');
  let elP2Y = document.getElementById('p2YVal');
  if (elP1X) elP1X.value = p1Km;
  if (elP1Y) elP1Y.value = p1Elev;
  if (elP2X) elP2X.value = p2Km;
  if (elP2Y) elP2Y.value = p2Elev;

  if (groundGroupState[grpKey].p1Ref) refPixels.p1 = groundGroupState[grpKey].p1Ref;
  if (groundGroupState[grpKey].p2Ref) refPixels.p2 = groundGroupState[grpKey].p2Ref;

  setMode('add_ground_pt');
  renderGroundTab();
  redraw();
}

function deleteSelectedGroundPoint(cIdx) {
  let grpKey = 'ground_ch_' + cIdx;
  if (groundGroupState[grpKey] && groundGroupState[grpKey].locked !== false) {
    alert('ชุดข้อมูลนี้ล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ก่อนลบจุด');
    return;
  }
  if (!selectedGroundPoint) {
    alert('กรุณาคลิกเลือกจุดบนเส้นที่คำนวณของชุดข้อมูลนี้ที่ต้องการลบก่อน');
    return;
  }
  if (selectedGroundPoint.channelId !== cIdx) {
    alert('จุดที่เลือกไม่ตรงกับชุดข้อมูลนี้ กรุณาเลือกจุดบนเส้นของชุดข้อมูลที่กำลังแก้ไข');
    return;
  }
  let row = groundRowsData[selectedGroundPoint.gIdx];
  if (!row || row.channelId !== cIdx) {
    alert('ไม่พบข้อมูลจุดที่เลือกในชุดข้อมูลนี้');
    selectedGroundPoint = null;
    redraw();
    return;
  }
  if (row.isBoundary) {
    alert('ไม่สามารถลบจุดเริ่มต้นหรือจุดสิ้นสุดของสายได้ (สามารถลากจุดเพื่อปรับระดับขึ้น-ลงได้)');
    return;
  }
  groundRowsData.splice(selectedGroundPoint.gIdx, 1);
  selectedGroundPoint = null;
  updateTable();
  autoUpdateGroundDrawingLine(cIdx);
}
