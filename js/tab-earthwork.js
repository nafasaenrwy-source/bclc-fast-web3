// ===== js/tab-earthwork.js =====
// ส่วนคำนวณปริมาณ — แท็บงานดิน (แยกเป็น 1 ไฟล์ต่อ 1 แท็บย่อย)
// ============================================================================
// รอบ 59: ส่วนคำนวณปริมาณ -> แท็บ "งานดิน"
//   - นำหลักการส่วนที่ 3 ("ตาราง BoQ & เปรียบเทียบรูปตัด") จากไฟล์ canal_cross_section_V3.html มาใส่ครบทุกฟังก์ชัน
//   - เชื่อมโยงข้อมูลจาก "ส่วนถอดแบบ" (ระบบคูส่งน้ำ, มิติคูส่งน้ำ, ระดับดินเดิม, ระดับคูส่งน้ำ, Typeคูส่งน้ำ) มาใส่ตารางอัตโนมัติ
// ============================================================================
var quantityCalcActiveTab = 'earthwork';
var quantityCalcSidebarCollapsed = false;
var earthworkHasSyncedInitial = false;
var lastTakeoffSyncSignature = '';

// ตัวแปรสำรองสำหรับความเข้ากันได้กับฟังก์ชันของ canal_cross_section_V3.html
var digPoints = [];
var digPageStates = {};
var digIsMultiPage = false;
var digRefPixels = { p1: null, p2: null };
var paramInvert = 100.00;
var paramB = 0.35;
var paramH = 0.50;
var paramTBL = 0.50;
var paramTBR = 0.50;
var paramWallT = 0.10;
var paramBaseT = 0.10;
var paramSubbaseT = 0.05;
var paramTopsoil = 0.30;
var ngl = 99.66;

function saveCurrentDigPageState() {}
function updateDigTable() {}
function redrawDigitizer() {}
function markWorkspaceDirty() {}

function formatThaiDateTime(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} น.`;
}

function formatTimeOnly(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} น.`;
}

function buildWorkspaceSavePayload() {
  return {
    version: 1,
    savedAtISO: new Date().toISOString(),
    savedAtFormatted: formatThaiDateTime(new Date()),
    savedTimeShort: formatTimeOnly(new Date()),
    boqRows: cloneBoqRows(boqRows),
    masterBoqRows: cloneBoqRows(masterBoqRows),
    hiddenStationCategories: Array.from(hiddenStationCategories),
    lastSubdivideStepLabel: lastSubdivideStepLabel,
    savedNglProfilesByLine: savedNglProfilesByLine,
    originalGroundTab: buildOriginalGroundSheetAoA(),
    selectedRowIndex: selectedRowIndex,
    selectedCategoryFilter: selectedCategoryFilter,
    cmpDisplayState: {
      cmpShowStripping: cmpShowStripping,
      cmpShowCompacted: cmpShowCompacted,
      cmpShowExcavation: cmpShowExcavation,
      cmpShowManualFill: cmpShowManualFill,
      cmpShowDims: cmpShowDims,
      cmpShowWidths: cmpShowWidths
    }
  };
}

function applyRestoredWorkspace(savedData) {
  if (!savedData) return;
  if (savedData.cmpDisplayState) {
    const cs = savedData.cmpDisplayState;
    cmpShowStripping = cs.cmpShowStripping !== undefined ? Boolean(cs.cmpShowStripping) : true;
    cmpShowCompacted = cs.cmpShowCompacted !== undefined ? Boolean(cs.cmpShowCompacted) : true;
    cmpShowExcavation = cs.cmpShowExcavation !== undefined ? Boolean(cs.cmpShowExcavation) : true;
    cmpShowManualFill = cs.cmpShowManualFill !== undefined ? Boolean(cs.cmpShowManualFill) : true;
    cmpShowDims = cs.cmpShowDims !== undefined ? Boolean(cs.cmpShowDims) : true;
    cmpShowWidths = cs.cmpShowWidths !== undefined ? Boolean(cs.cmpShowWidths) : true;
    syncCmpToggleButtonsUI();
  }
  if (Array.isArray(savedData.savedNglProfilesByLine)) {
    savedNglProfilesByLine = savedData.savedNglProfilesByLine;
    updateSavedNglLinesBadgeUI();
  }
  if (savedData.lastSubdivideStepLabel) {
    lastSubdivideStepLabel = savedData.lastSubdivideStepLabel;
    const inpStep = document.getElementById("inputSubdivideStep");
    if (inpStep) inpStep.value = String(lastSubdivideStepLabel);
  }
  if (Array.isArray(savedData.boqRows) && savedData.boqRows.length > 0) {
    boqRows = ensureAllRowsHaveParsedTags(cloneBoqRows(savedData.boqRows));
    if (Array.isArray(savedData.masterBoqRows) && savedData.masterBoqRows.length > 0) {
      masterBoqRows = ensureAllRowsHaveParsedTags(cloneBoqRows(savedData.masterBoqRows));
    } else {
      masterBoqRows = cloneBoqRows(boqRows);
    }
    hiddenStationCategories = new Set(Array.isArray(savedData.hiddenStationCategories) ? savedData.hiddenStationCategories : []);
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, Number(savedData.selectedRowIndex || 0)), boqRows.length - 1);
  }
  if (savedData.selectedCategoryFilter) {
    selectedCategoryFilter = savedData.selectedCategoryFilter;
    const selCatEl = document.getElementById("selectCategoryView");
    if (selCatEl) selCatEl.value = selectedCategoryFilter;
  }
  renderBoqTable();
  resetCompareStartView();
  resetCompareEndView();
  drawLongitudinalProfile();
}


function showToast(msg, tone) {
  if (typeof uiToast === 'function') {
    uiToast(msg, (tone === 'rose' || tone === 'amber') ? 'warn' : 'info');
  }
}

function openColumnVisibilityModal() {
  if (typeof renderColumnVisibilityCheckboxes === 'function') renderColumnVisibilityCheckboxes();
  const modal = document.getElementById('columnVisibilityModal');
  if (modal && modal.classList) modal.classList.remove('hidden');
}

function toggleQuantityCalcSidebar(ev, forceCollapsed) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const sidebar = document.getElementById('quantityCalcSidebar');
  const btn = document.getElementById('btnToggleQuantityCalcSidebar');
  const nextState = (typeof forceCollapsed === 'boolean') ? forceCollapsed : !quantityCalcSidebarCollapsed;
  quantityCalcSidebarCollapsed = nextState;
  if (sidebar && sidebar.classList) sidebar.classList.toggle('collapsed', quantityCalcSidebarCollapsed);
  if (btn) {
    btn.textContent = quantityCalcSidebarCollapsed ? '▶' : '◀';
    btn.title = quantityCalcSidebarCollapsed ? 'ขยายเมนูแท็บซ้ายมือ' : 'ย่อเมนูแท็บซ้ายมือ';
  }
  setTimeout(() => {
    if (typeof resizeComparisonCanvases === 'function') resizeComparisonCanvases(false);
    if (typeof drawLongitudinalProfile === 'function') drawLongitudinalProfile();
  }, 220);
}

function switchQuantityCalcTab(subName) {
  if (!subName) subName = 'earthwork';
  quantityCalcActiveTab = subName;

  const btnEarth = document.getElementById('qty-calc-tab-earthwork');
  if (btnEarth && btnEarth.classList) btnEarth.classList.toggle('active', subName === 'earthwork');

  const titleEl = document.getElementById('quantityCalcActiveTabTitle');
  if (titleEl) {
    titleEl.textContent = '⛰️ งานดิน';
  }

  // ดึงข้อมูลจากส่วนถอดแบบมาซิงก์อัตโนมัติเมื่อเปิดหน้าส่วนคำนวณปริมาณ หรือเมื่อข้อมูลในส่วนถอดแบบมีการเปลี่ยนแปลง
  const curSig = computeTakeoffSignatureForEarthwork();
  if (!earthworkHasSyncedInitial || !boqRows || boqRows.length === 0 || curSig !== lastTakeoffSyncSignature) {
    syncEarthworkFromTakeoff(false);
  } else {
    renderBoqTable();
    resizeComparisonCanvases(true);
    updateComparisonView(true);
    drawLongitudinalProfile();
  }

  setTimeout(() => {
    if (typeof resizeComparisonCanvases === 'function') resizeComparisonCanvases(true);
    if (typeof drawLongitudinalProfile === 'function') drawLongitudinalProfile();
  }, 40);
}

function computeTakeoffSignatureForEarthwork() {
  try {
    if (typeof syncTableInputsToChannels === 'function') syncTableInputsToChannels();
    if (typeof readLiveTableInputsForCrossSection === 'function') readLiveTableInputsForCrossSection();
    return JSON.stringify({
      ch: (typeof channels !== 'undefined' && Array.isArray(channels)) ? channels.map(c => c ? [c.id, c.canal, c.ditch] : null) : [],
      dim: (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows)) ? dimensionRows : [],
      lvl: (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) ? levelRowsData : [],
      gnd: (typeof groundRowsData !== 'undefined' && Array.isArray(groundRowsData)) ? groundRowsData : [],
      types: (typeof ditchTypeDatabase !== 'undefined' && Array.isArray(ditchTypeDatabase)) ? ditchTypeDatabase : []
    });
  } catch (_) {
    return '';
  }
}

// สร้างรายการข้อมูล BoQ และโปรไฟล์ระดับดินเดิม (NGL) จากข้อมูลใน "ส่วนถอดแบบ"
function buildEarthworkDataFromTakeoff() {
  if (typeof syncTableInputsToChannels === 'function') syncTableInputsToChannels();
  if (typeof readLiveTableInputsForCrossSection === 'function') readLiveTableInputsForCrossSection();

  // 1) ซิงก์ตารางมิติ U-SHAPE (uShapeTypeTable) และความหนาเริ่มต้น (tw, tb) จาก ditchTypeDatabase
  if (typeof ditchTypeDatabase !== 'undefined' && Array.isArray(ditchTypeDatabase) && ditchTypeDatabase.length > 0) {
    uShapeTypeTable = ditchTypeDatabase.map(d => ({
      type: String(d.type || 'VU1').trim(),
      B: roundLen(d.b !== undefined && !isNaN(parseFloat(d.b)) ? parseFloat(d.b) : 0.35),
      H: roundLen(d.h !== undefined && !isNaN(parseFloat(d.h)) ? parseFloat(d.h) : 0.50),
      tw: roundLen(d.tw !== undefined && !isNaN(parseFloat(d.tw)) ? parseFloat(d.tw) : 0.10),
      tb: roundLen(d.tf !== undefined && !isNaN(parseFloat(d.tf)) ? parseFloat(d.tf) : (d.tb !== undefined && !isNaN(parseFloat(d.tb)) ? parseFloat(d.tb) : 0.10))
    }));
    const firstT = ditchTypeDatabase[0];
    if (firstT) {
      if (firstT.tw !== undefined && !isNaN(parseFloat(firstT.tw))) canalDefaultParams.tw = roundLen(firstT.tw);
      if (firstT.tf !== undefined && !isNaN(parseFloat(firstT.tf))) canalDefaultParams.tb = roundLen(firstT.tf);
    }
  }

  const chList = (typeof channels !== 'undefined' && Array.isArray(channels) && channels.length > 0)
    ? channels.filter(c => c)
    : [{ id: 1, canal: 'คลอง', ditch: '01' }];

  const parseKmVal = (v) => {
    if (v === '' || v === null || v === undefined) return NaN;
    if (typeof parseKmNumeric === 'function') {
      const n = parseKmNumeric(v);
      if (!isNaN(n)) return n;
    }
    if (typeof parseKmInput === 'function') {
      const r = parseKmInput(v);
      if (r !== '' && !isNaN(parseFloat(r))) return parseFloat(r);
    }
    const num = parseFloat(String(v).replace('+', ''));
    return isNaN(num) ? NaN : num;
  };

  // 2) รวบรวมจุดระดับดินเดิม (NGL) แยกตามสายคูส่งน้ำจากแท็บ "ระดับดินเดิม" (groundRowsData) และเส้นดินเดิมที่ลากบนภาพ
  const newSavedNglProfiles = [];
  const channelNglPtsMap = new Map();

  chList.forEach(ch => {
    const canalName = String(ch.canal ?? 'คลอง').trim() || 'คลอง';
    const subCanalName = String(ch.ditch ?? '01').trim() || '01';
    const lKey = makeCanalLineKey(canalName, subCanalName);

    const gMap = new Map();
    if (typeof groundRowsData !== 'undefined' && Array.isArray(groundRowsData)) {
      groundRowsData.forEach(g => {
        if (!g || g.channelId !== ch.id) return;
        const k = parseKmVal(g.km);
        const gElevField = (g.groundElevation !== undefined && g.groundElevation !== '') ? g.groundElevation : g.gl;
        const eRaw = (typeof keepNumValue === 'function') ? keepNumValue(gElevField) : gElevField;
        const e = (eRaw !== '' && eRaw !== null && eRaw !== undefined) ? parseFloat(eRaw) : NaN;
        if (isNaN(k) || isNaN(e)) return;
        const kStation = roundStation(k);
        if (!gMap.has(kStation) || !g.isBoundary) {
          gMap.set(kStation, { km: kStation, elev: roundElev(e) });
        }
      });
    }

    // สำรองจากจุดเส้นดินเดิมที่วาดบนภาพ หากตารางระดับดินเดิมของสายนี้ยังไม่มีตัวเลข
    if (gMap.size === 0) {
      const fallbackLinePts = ((typeof tableGroundLinePoints !== 'undefined' && Array.isArray(tableGroundLinePoints) && tableGroundLinePoints.length > 0)
        ? tableGroundLinePoints
        : ((typeof manualGroundLinePoints !== 'undefined' && Array.isArray(manualGroundLinePoints)) ? manualGroundLinePoints : []))
        .filter(pt => pt && pt.channelId === ch.id && typeof pt.xData === 'number' && typeof pt.yData === 'number' && isFinite(pt.xData) && isFinite(pt.yData));
      fallbackLinePts.forEach(pt => {
        const kStation = roundStation(pt.xData);
        gMap.set(kStation, { km: kStation, elev: roundElev(pt.yData) });
      });
    }

    const sortedPts = Array.from(gMap.values()).sort((a, b) => a.km - b.km);
    const digFormatPts = sortedPts.map((p, idx) => ({
      index: idx + 1,
      pixel: { x: 0, y: 0 },
      data: {
        x: roundStation(p.km),
        y: roundElev(p.elev),
        staFormatted: formatMetersToStation(p.km),
        nglFormatted: roundElev(p.elev).toFixed(2)
      }
    }));

    channelNglPtsMap.set(ch.id, digFormatPts);
    if (digFormatPts.length > 0) {
      newSavedNglProfiles.push({
        type: 'RID_XY_DIGITIZER_DATA',
        version: 3,
        savedAt: new Date().toISOString(),
        lineKey: lKey,
        canalName: canalName,
        subCanalName: subCanalName,
        isBlankLine: false,
        points: digFormatPts
      });
    }
  });

  // ตรวจว่าในส่วนถอดแบบมีการกรอกข้อมูลจริงแล้วหรือยัง (หรือยังเป็นหน้าเริ่มต้นว่างๆ)
  const hasAnyDimEnd = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows)) &&
    dimensionRows.some(d => d && !isNaN(parseKmVal(d.kmEnd)) && parseKmVal(d.kmEnd) > 0);
  const hasAnyLevelVal = (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData)) &&
    levelRowsData.some(l => l && (
      (typeof keepNumValue === 'function' ? keepNumValue(l.bl1) !== '' : l.bl1 !== '') ||
      (typeof keepNumValue === 'function' ? keepNumValue(l.bl2) !== '' : l.bl2 !== '') ||
      !isNaN(parseKmVal(l.customKmEnd))
    ));
  const hasAnyGroundVal = newSavedNglProfiles.length > 0;
  const hasTakeoffUserData = hasAnyDimEnd || hasAnyLevelVal || hasAnyGroundVal || chList.length > 1;

  // 3) สร้างแถวตาราง BoQ ของแต่ละคูส่งน้ำจากแท็บ "ระบบคูส่งน้ำ" + "มิติคูส่งน้ำ" + "ระดับคูส่งน้ำ" + "ระดับดินเดิม"
  const allBoqRows = [];

  chList.forEach(ch => {
    const canalName = String(ch.canal ?? 'คลอง').trim() || 'คลอง';
    const subCanalName = String(ch.ditch ?? '01').trim() || '01';
    const chanDims = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.filter(d => d && d.channelId === ch.id)
      : [];
    const fallbackDim = chanDims[0] || { kmStart: 0, kmEnd: 100, q: 0.03, slope: 4000, b: 0.35, d: 0.36, type: 'VU1', tbl: 0.50, tbr: 0.50 };

    const chanLvls = (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData))
      ? levelRowsData.filter(l => l && l.channelId === ch.id)
      : [];
    const effectiveLvls = chanLvls.length > 0 ? chanLvls : [{
      channelId: ch.id,
      isDynamicRow: false,
      customType: fallbackDim.type || 'VU1',
      customSlope: fallbackDim.slope || 4000,
      customKmStart: fallbackDim.kmStart || 0,
      customKmEnd: fallbackDim.kmEnd || '',
      h: 0,
      bl1: '',
      tbl1: '',
      bl2: '',
      tbl2: ''
    }];

    const chanNglPts = channelNglPtsMap.get(ch.id) || [];

    const evalNglAtSta = (staM) => {
      if (chanNglPts.length > 0) {
        for (let i = 0; i < chanNglPts.length; i++) {
          if (Math.abs(staM - chanNglPts[i].data.x) <= STATION_DUP_EPS) {
            return roundElev(chanNglPts[i].data.y);
          }
        }
        if (chanNglPts.length === 1) return roundElev(chanNglPts[0].data.y);
        if (staM <= chanNglPts[0].data.x) return roundElev(chanNglPts[0].data.y);
        if (staM >= chanNglPts[chanNglPts.length - 1].data.x) return roundElev(chanNglPts[chanNglPts.length - 1].data.y);
        for (let i = 0; i < chanNglPts.length - 1; i++) {
          const p1 = chanNglPts[i].data;
          const p2 = chanNglPts[i + 1].data;
          if (staM >= p1.x - STATION_DUP_EPS && staM <= p2.x + STATION_DUP_EPS) {
            if (Math.abs(p2.x - p1.x) < 1e-6) return roundElev(p1.y);
            const t = (staM - p1.x) / (p2.x - p1.x);
            return roundElev(p1.y + t * (p2.y - p1.y));
          }
        }
      }
      return null;
    };

    const findDimRowAtSta = (staVal) => {
      if (!chanDims.length) return fallbackDim;
      const found = chanDims.find((d, idx) => {
        const ks = !isNaN(parseKmVal(d.kmStart)) ? parseKmVal(d.kmStart) : 0;
        const keParsed = parseKmVal(d.kmEnd);
        const ke = !isNaN(keParsed) ? keParsed : Infinity;
        if (idx < chanDims.length - 1) return staVal >= ks - 1e-4 && staVal < ke - 1e-4;
        return staVal >= ks - 1e-4 && staVal <= ke + 1e-4;
      });
      return found || chanDims[0];
    };

    const chanBaseRows = [];
    let prevKe = !isNaN(parseKmVal(fallbackDim.kmStart)) ? parseKmVal(fallbackDim.kmStart) : 0;
    let prevBl2 = NaN;

    effectiveLvls.forEach((l, idx) => {
      const lKmStart = (l.customKmStart !== '' && l.customKmStart !== undefined) ? l.customKmStart : l.kmStart;
      const ksRaw = (idx === 0 && (lKmStart === '' || lKmStart === undefined))
        ? (fallbackDim.kmStart !== undefined ? fallbackDim.kmStart : 0)
        : lKmStart;
      const ksParsed = parseKmVal(ksRaw);
      const ks = !isNaN(ksParsed) ? ksParsed : prevKe;

      const lKmEnd = (l.customKmEnd !== '' && l.customKmEnd !== undefined) ? l.customKmEnd : l.kmEnd;
      const keRaw = (lKmEnd !== '' && lKmEnd !== undefined)
        ? lKmEnd
        : (typeof getChannelKmEnd === 'function' ? getChannelKmEnd(ch.id) : fallbackDim.kmEnd);
      const keParsed = parseKmVal(keRaw);
      const dimKeParsed = parseKmVal(fallbackDim.kmEnd);
      let ke = !isNaN(keParsed) ? keParsed : (!isNaN(dimKeParsed) ? dimKeParsed : NaN);
      if (isNaN(ke) || ke <= ks) {
        if (chanNglPts.length > 0 && chanNglPts[chanNglPts.length - 1].data.x > ks) {
          ke = chanNglPts[chanNglPts.length - 1].data.x;
        } else {
          ke = ks + 100;
        }
      }

      const dimRow = findDimRowAtSta((ks + ke) * 0.5);
      const rType = String((l.isDynamicRow && l.customType) ? l.customType : (dimRow.type || l.customType || 'VU1')).trim() || 'VU1';
      const spec = findUShapeTypeSpec(rType) || { type: rType, B: 0.35, H: 0.50, tw: canalDefaultParams.tw, tb: canalDefaultParams.tb };

      const B = (l.isDynamicRow && l.customType && l.customType !== dimRow.type && !isNaN(parseFloat(spec.B)))
        ? roundLen(spec.B)
        : ((!isNaN(parseFloat(dimRow.b)) && parseFloat(dimRow.b) > 0) ? roundLen(dimRow.b) : roundLen(spec.B || 0.35));
      const H = (!isNaN(parseFloat(spec.H)) && parseFloat(spec.H) > 0) ? roundLen(spec.H) : 0.50;
      const TBL = (!isNaN(parseFloat(dimRow.tbl)) && parseFloat(dimRow.tbl) >= 0) ? roundLen(dimRow.tbl) : 0.50;
      const TBR = (!isNaN(parseFloat(dimRow.tbr)) && parseFloat(dimRow.tbr) >= 0) ? roundLen(dimRow.tbr) : 0.50;
      const tw = (!isNaN(parseFloat(spec.tw)) && parseFloat(spec.tw) > 0) ? roundLen(spec.tw) : roundLen(canalDefaultParams.tw);
      const tb = (!isNaN(parseFloat(spec.tb)) && parseFloat(spec.tb) > 0) ? roundLen(spec.tb) : roundLen(canalDefaultParams.tb);
      const ts = roundLen(canalDefaultParams.ts);
      const dt = roundLen(canalDefaultParams.dt);

      const rSlope = parseFloat((l.isDynamicRow && l.customSlope !== '' && l.customSlope !== undefined) ? l.customSlope : (dimRow.slope || l.customSlope)) || 4000;
      const hDrop = parseFloat(l.h) || 0;

      const bl1Raw = typeof keepNumValue === 'function' ? keepNumValue(l.bl1) : l.bl1;
      const bl2Raw = typeof keepNumValue === 'function' ? keepNumValue(l.bl2) : l.bl2;
      const tbl1Raw = typeof keepNumValue === 'function' ? keepNumValue(l.tbl1) : l.tbl1;
      const tbl2Raw = typeof keepNumValue === 'function' ? keepNumValue(l.tbl2) : l.tbl2;

      let bl1 = (bl1Raw !== '' && bl1Raw !== null && bl1Raw !== undefined && !isNaN(parseFloat(bl1Raw))) ? parseFloat(bl1Raw) : NaN;
      if (isNaN(bl1) && idx > 0 && !isNaN(prevBl2)) {
        bl1 = prevBl2 - hDrop;
      }

      let bl2 = (bl2Raw !== '' && bl2Raw !== null && bl2Raw !== undefined && !isNaN(parseFloat(bl2Raw))) ? parseFloat(bl2Raw) : NaN;
      if (isNaN(bl1) && !isNaN(bl2)) {
        bl1 = bl2 + Math.abs(ke - ks) / rSlope;
      }
      if (isNaN(bl1)) {
        const refStartBl = chanNglPts.length > 0 ? (chanNglPts[0].data.y + 0.34) : 100.00;
        const refStartKm = chanNglPts.length > 0 ? chanNglPts[0].data.x : ks;
        bl1 = refStartBl - ((ks - refStartKm) / rSlope);
      }
      if (isNaN(bl2)) {
        bl2 = bl1 - Math.abs(ke - ks) / rSlope;
      }

      const tbl1 = (tbl1Raw !== '' && tbl1Raw !== null && tbl1Raw !== undefined && !isNaN(parseFloat(tbl1Raw)))
        ? parseFloat(tbl1Raw)
        : (bl1 + H);
      const tbl2 = (tbl2Raw !== '' && tbl2Raw !== null && tbl2Raw !== undefined && !isNaN(parseFloat(tbl2Raw)))
        ? parseFloat(tbl2Raw)
        : (bl2 + H);

      prevKe = ke;
      prevBl2 = bl2;

      const ngl1Eval = evalNglAtSta(ks);
      const ngl2Eval = evalNglAtSta(ke);
      const nglStartVal = ngl1Eval !== null
        ? ngl1Eval
        : (!hasTakeoffUserData ? roundElev(bl1 - 0.34) : '-');
      const nglEndVal = ngl2Eval !== null
        ? ngl2Eval
        : (!hasTakeoffUserData ? roundElev(bl2 - 0.34 - (ke - ks) * 0.0015) : '-');

      const secNo = (l.ditchSection !== undefined && l.ditchSection !== null && String(l.ditchSection).trim() !== '')
        ? String(l.ditchSection).trim()
        : String(idx + 1);

      chanBaseRows.push({
        canalName: canalName,
        subCanalName: subCanalName,
        type: rType,
        staStart: roundStation(ks),
        nglStart: nglStartVal,
        blStart: roundElev(bl1),
        tblStart: roundElev(tbl1),
        staEnd: roundStation(ke),
        nglEnd: nglEndVal,
        blEnd: roundElev(bl2),
        tblEnd: roundElev(tbl2),
        B: B,
        H: H,
        TBL: TBL,
        TBR: TBR,
        tw: tw,
        tb: tb,
        ts: ts,
        dt: dt,
        staStartTags: ['baseStart'],
        staEndTags: ['baseEnd'],
        remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
        sectionNo: secNo
      });
    });

    // หากในแท็บ "ระดับดินเดิม" มีจุด กม. ระหว่างช่วง (มากกว่าแค่หัว-ท้าย) ให้แทรกจุดหักดินเดิมเข้าตารางทันที
    if (chanNglPts.length >= 2 && chanBaseRows.length > 0) {
      const baseEndpoints = new Set();
      chanBaseRows.forEach(r => {
        baseEndpoints.add(Math.round(r.staStart * 100));
        baseEndpoints.add(Math.round(r.staEnd * 100));
      });
      const hasIntermediateNgl = chanNglPts.some(pt => !baseEndpoints.has(Math.round(pt.data.x * 100)));
      if (hasIntermediateNgl) {
        const merged = deduplicateAndNormalizeSingleLineRows(chanBaseRows, true, 0, null, chanNglPts);
        if (merged && Array.isArray(merged.rows) && merged.rows.length > 0) {
          allBoqRows.push(...merged.rows);
          return;
        }
      }
    }

    allBoqRows.push(...chanBaseRows);
  });

  return {
    rows: cloneBoqRows(allBoqRows),
    savedNglProfiles: newSavedNglProfiles
  };
}

function syncEarthworkFromTakeoff(showFeedback) {
  const built = buildEarthworkDataFromTakeoff();
  savedNglProfilesByLine = built.savedNglProfiles;
  updateSavedNglLinesBadgeUI();

  if (showFeedback && boqRows && boqRows.length > 0) {
    pushUndoSnapshot('ดึงค่าจากส่วนถอดแบบ');
  }

  hiddenStationCategories.clear();
  boqRows = cloneBoqRows(built.rows);
  masterBoqRows = cloneBoqRows(boqRows);
  selectedRowIndex = 0;
  earthworkHasSyncedInitial = true;
  lastTakeoffSyncSignature = computeTakeoffSignatureForEarthwork();

  renderBoqTable();
  syncSplitButtonsStatusUI();
  resizeComparisonCanvases(true);
  updateComparisonView(true);
  drawLongitudinalProfile();

  if (showFeedback) {
    const lineCount = getUniqueCanalLinesFromBoqTable().length;
    const nglLineCount = savedNglProfilesByLine.length;
    showBanner(`🔄 ดึงค่าจากส่วนถอดแบบสำเร็จ: ${lineCount} สายคูส่งน้ำ • รวม ${boqRows.length} ช่วง กม. (ข้อมูลระดับดินเดิม NGL ${nglLineCount} สาย)`, 'emerald');
    showToast(`🔄 ดึงค่าจากส่วนถอดแบบสำเร็จ (${lineCount} สาย • ${boqRows.length} ช่วง กม.)`, 'emerald');
  }
  return boqRows;
}

function copyEarthworkBoqTableData() {
  if (!Array.isArray(boqRows) || boqRows.length === 0) {
    if (typeof writeToClipboard === 'function') {
      writeToClipboard('', 'ยังไม่มีข้อมูลในตารางงานดินให้คัดลอก');
    }
    return;
  }
  const visibleCats = getVisibleCategories();
  const headers = INPUT_COLUMNS.filter(c => !hiddenColumnKeys.has(c.key)).map(c => c.label);
  visibleCats.forEach(cat => {
    headers.push(`A1 (${cat.shortLabel})`, `A2 (${cat.shortLabel})`, `L (${cat.shortLabel})`, `ปริมาณ (${cat.shortLabel})`);
  });
  const lines = [headers.join('\\t')];
  boqRows.forEach(row => {
    const ev = evaluateBoqRow(row);
    const cols = [];
    INPUT_COLUMNS.forEach(col => {
      if (hiddenColumnKeys.has(col.key)) return;
      if (col.type === 'station') cols.push(formatMetersToStation(parseStationToMeters(row[col.key])));
      else if (col.key === 'nglStart' || col.key === 'nglEnd') cols.push(formatNglCellValue(row[col.key]));
      else if (col.type === 'number' && row[col.key] !== undefined && row[col.key] !== '') cols.push(Number(row[col.key]).toFixed(col.decimals));
      else cols.push(row[col.key] ?? '');
    });
    visibleCats.forEach(cat => {
      const c = ev.calcByCat[cat.key];
      cols.push(c.a1.toFixed(3), c.a2.toFixed(3), c.L.toFixed(2), c.vol.toFixed(3));
    });
    lines.push(cols.join('\\t'));
  });
  if (typeof writeToClipboard === 'function') {
    writeToClipboard(lines.join('\\n'), `คัดลอกข้อมูลตารางงานดิน (${boqRows.length} แถว) เรียบร้อยแล้ว!`);
  }
}

const ROUND_STATION = 0;   // กม. -> ทศนิยม 0
const ROUND_ELEV = 2;      // ระดับ -> ทศนิยม 2
const ROUND_LEN = 2;       // ระยะ -> ทศนิยม 2
const ROUND_AREA = 3;      // พื้นที่ -> ทศนิยม 3
const ROUND_VOL = 3;       // ปริมาณ -> ทศนิยม 3

/**
 * ปัดเศษแบบ "คิดเลขบนกระดาษ" (Half-up เหมือนเครื่องคิดเลขกดมือ)
 * ต่างจาก toFixed() ตรงที่:
 *   - ใช้ Half-Up (0.5 ปัดขึ้นเสมอ) แทน Half-Even ของ toFixed()
 *   - คืนค่าเป็น Number ที่ถูกปัดแล้ว ไม่ใช่ String
 *   - ป้องกัน floating point error (เช่น 1.005 -> 1.01 ไม่ใช่ 1.00)
 */
function roundCalc(val, digits) {
    const num = Number(val);
    if (!isFinite(num)) return 0;
    const d = (typeof digits === 'number') ? digits : ROUND_AREA;
    const factor = Math.pow(10, d);
    const scaled = num * factor;
    // เติม epsilon เล็กน้อยเพื่อแก้ปัญหา 1.005 * 100 = 100.49999999999999
    const adjusted = (scaled >= 0)
        ? Math.floor(scaled + 0.5 + 1e-9)
        : Math.ceil(scaled - 0.5 - 1e-9);
    return adjusted / factor;
}

/** ปัดเศษระดับ (2 ตำแหน่ง) */
function roundElev(val) { return roundCalc(val, ROUND_ELEV); }
/** ปัดเศษระยะ (2 ตำแหน่ง) */
function roundLen(val) { return roundCalc(val, ROUND_LEN); }
/** ปัดเศษพื้นที่ (3 ตำแหน่ง) */
function roundArea(val) { return roundCalc(val, ROUND_AREA); }
/** ปัดเศษปริมาณ (3 ตำแหน่ง) */
function roundVol(val) { return roundCalc(val, ROUND_VOL); }
/** ปัดเศษค่า กม. (0 ตำแหน่ง) */
function roundStation(val) { return roundCalc(val, ROUND_STATION); }

/**
 * คำนวณพื้นที่เฉลี่ยแบบเครื่องคิดเลขกดมือ
 *   (A1 + A2)  -> ปัด 3 ตำแหน่ง -> x 0.5 -> ปัด 3 ตำแหน่ง
 * ลำดับการปัดเศษสำคัญ: ต้องปัดผลบวกก่อนคูณ 0.5
 * มิฉะนั้นผลจะต่างจากที่ผู้ใช้กดเครื่องคิดเลขได้
 */
function roundAvgArea(a1, a2) {
    const sum = roundArea(roundArea(a1) + roundArea(a2));
    return roundArea(sum * 0.5);
}

/** ตรวจสอบว่าค่า NGL ยังไม่มีข้อมูล (เป็น '-', ว่างเปล่า, หรือไม่ใช่ตัวเลข) */
function isMissingNglValue(val) {
    if (val === null || val === undefined) return true;
    const s = String(val).trim();
    if (s === '' || s === '-') return true;
    return isNaN(Number(s));
}

/** จัดรูปแบบค่า NGL สำหรับแสดงผล: ถ้าไม่มีค่าให้แสดง '-' ถ้ามีค่าให้แสดงทศนิยม 2 ตำแหน่ง */
function formatNglCellValue(val) {
    if (isMissingNglValue(val)) return '-';
    return roundElev(Number(val)).toFixed(2);
}



// ============================================================================
let savedNglProfilesByLine = []; // Array of { lineKey, canalName, subCanalName, isBlankLine, points, p1, p2, calibration, fileInfo, savedAt }

function makeCanalLineKey(canalName, subCanalName) {
    const c = String(canalName ?? '').trim();
    const s = String(subCanalName ?? '').trim();
    if ((!c || c === '-') && (!s || s === '-')) {
        return '__BLANK__';
    }
    return `${c || '-'}|||${s || '-'}`;
}

function formatCanalLineLabel(canalName, subCanalName) {
    const c = String(canalName ?? '').trim();
    const s = String(subCanalName ?? '').trim();
    if ((!c || c === '-') && (!s || s === '-')) {
        return 'สายว่างๆ (ไม่ระบุคลองส่งน้ำ / คูส่งน้ำ)';
    }
    return `คลองส่งน้ำ: ${c || '-'} • คูส่งน้ำ: ${s || '-'}`;
}

function getUniqueCanalLinesFromBoqTable() {
    const rowsRef = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : (Array.isArray(boqRows) ? boqRows : []);
    const map = new Map();
    rowsRef.forEach((r, idx) => {
        const c = String(r.canalName ?? '-').trim() || '-';
        const s = String(r.subCanalName ?? '-').trim() || '-';
        const key = makeCanalLineKey(c, s);
        const s1 = parseStationToMeters(r.staStart);
        const s2 = parseStationToMeters(r.staEnd);
        if (!map.has(key)) {
            map.set(key, {
                lineKey: key,
                canalName: c,
                subCanalName: s,
                isBlankLine: key === '__BLANK__',
                label: formatCanalLineLabel(c, s),
                rowCount: 0,
                minSta: Math.min(s1, s2),
                maxSta: Math.max(s1, s2),
                firstRowIndex: idx
            });
        }
        const entry = map.get(key);
        entry.rowCount++;
        entry.minSta = Math.min(entry.minSta, s1, s2);
        entry.maxSta = Math.max(entry.maxSta, s1, s2);
    });
    return Array.from(map.values());
}

// ============================================================================
// รอบ 60: ตัวกรองสายคูส่งน้ำ + ย่อ/ขยายข้อมูลรายสายในตาราง BoQ
// ============================================================================
let activeCanalLineFilter = 'all';                 // 'all' หรือ lineKey ของสายคูส่งน้ำที่เลือก
const collapsedCanalLines = new Set();             // lineKey ของสายที่ถูกย่อไว้

function getCanalLineFilterOptions() {
    return getUniqueCanalLinesFromBoqTable();
}

/** เติมตัวเลือกลงในดรอปลิด #selectCanalLineFilter (ใต้ปุ่มซ่อน/แสดงคอลัมน์) */
function updateCanalLineFilterOptions() {
    const sel = document.getElementById('selectCanalLineFilter');
    if (!sel) return;
    const options = getCanalLineFilterOptions();
    const prevValue = activeCanalLineFilter;

    const buildLabel = (o) => {
        const order = options.indexOf(o) + 1;
        return `สายที่ ${order}: คลอง ${o.canalName} • คูส่งน้ำ ${o.subCanalName} (${o.rowCount} แถว)`;
    };

    sel.innerHTML = `<option value="all">แสดงทั้งหมด (ทุกสาย • ${options.length} สาย)</option>`
        + options.map(o => `<option value="${ewEscapeAttr(o.lineKey)}">${ewEscapeHtml(buildLabel(o))}</option>`).join('');

    // ถ้าสายที่เคยเลือกหายไป ให้กลับไปแสดงทั้งหมด
    const exists = prevValue === 'all' || options.some(o => o.lineKey === prevValue);
    activeCanalLineFilter = exists ? prevValue : 'all';
    sel.value = activeCanalLineFilter;
}

function ewEscapeAttr(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ewEscapeHtml(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** เรียกจาก onchange ของดรอปลิด */
function applyCanalLineFilter(lineKey) {
    activeCanalLineFilter = (lineKey === 'all' || !lineKey) ? 'all' : String(lineKey);
    const sel = document.getElementById('selectCanalLineFilter');
    if (sel) sel.value = activeCanalLineFilter;
    // ตัดสายที่ถูกย่อไว้ออกจากรายการย่อ เพื่อไม่ให้ค้างกับสายที่ไม่ได้แสดง
    if (activeCanalLineFilter !== 'all') {
        collapsedCanalLines.delete(activeCanalLineFilter);
    }
    renderBoqTable();
}

/** สลับสถานะย่อ/ขยายของสายคูส่งน้ำที่ระบุ */
function toggleCanalLineCollapse(lineKey) {
    const key = String(lineKey ?? '');
    if (!key) return;
    if (collapsedCanalLines.has(key)) {
        collapsedCanalLines.delete(key);
    } else {
        collapsedCanalLines.add(key);
    }
    renderBoqTable();
}

function isCanalLineCollapsed(lineKey) {
    return collapsedCanalLines.has(String(lineKey ?? ''));
}

function updateSavedNglLinesBadgeUI() {
    const badge = document.getElementById('badgeSavedNglLinesCount');
    if (badge) {
        badge.innerText = `${savedNglProfilesByLine.length} สาย`;
    }
    if (typeof updateOriginalGroundTabBadgeUI === 'function') {
        updateOriginalGroundTabBadgeUI();
    }
}


// ============================================================================
// 2. CORE ENGINEERING GEOMETRY & AREA ENGINE (Shared by Main & Comparison Views)
// ============================================================================
const BOTTOM_STEP = 0.30;
const EXTEND_NGL = 1.00;



function calcPolygonArea(pts) {
    if (!pts || pts.length < 3) return 0;
    // สูตรพิกัดจุดยอด (Surveyor's Area Formula)
    // คำนวณด้วยตัวเลขที่ปัดเศษแล้วทุกขั้นตอน (แบบเครื่องคิดเลขกดมือ)
    //   X = ระยะ -> ทศนิยม 2 ตำแหน่ง, Elev = ระดับ -> ทศนิยม 2 ตำแหน่ง
    //   ผลคูณ/ผลรวม/พื้นที่ -> ทศนิยม 3 ตำแหน่ง
    let sumForward = 0;
    let sumBackward = 0;
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        if (!p1 || !p2) return 0;
        const x1 = roundLen(p1.x), y1 = roundElev(p1.elev);
        const x2 = roundLen(p2.x), y2 = roundElev(p2.elev);
        const fwd = roundArea(x1 * y2);
        const bwd = roundArea(x2 * y1);
        sumForward = roundArea(sumForward + fwd);
        sumBackward = roundArea(sumBackward + bwd);
    }
    const diff = roundArea(Math.abs(sumForward - sumBackward));
    return roundArea(diff / 2);
}

function computeSectionData(params) {
    // ปัดเศษข้อมูลนำเข้าตามหลักเครื่องคิดเลขกดมือ (ระดับ 2 ตำแหน่ง / ระยะ 2 ตำแหน่ง)
    const paramInvert = roundElev(Number(params.invert ?? 100.000));
    const hasValidNgl = !isMissingNglValue(params.ngl);
    const ngl = hasValidNgl ? roundElev(Number(params.ngl)) : paramInvert;
    const paramB = roundLen(Math.max(0.05, Number(params.B ?? 0.35)));
    const paramH = roundLen(Math.max(0.05, Number(params.H ?? 0.50)));
    const paramTBL = roundLen(Math.max(0, Number(params.TBL ?? 0.50)));
    const paramTBR = roundLen(Math.max(0, Number(params.TBR ?? 0.50)));
    const paramWallT = roundLen(Math.max(0.01, Number(params.tw ?? 0.10)));
    const paramBaseT = roundLen(Math.max(0.01, Number(params.tb ?? 0.10)));
    const paramSubbaseT = roundLen(Math.max(0, Number(params.ts ?? 0.05)));
    const paramTopsoil = roundLen(Math.max(0, Number(params.dt ?? 0.30)));

    const ELEV_CANAL_INVERT = paramInvert;
    const ELEV_SUBBASE_TOP = roundElev(ELEV_CANAL_INVERT - paramBaseT);
    const ELEV_SUBBASE_BOT = roundElev(ELEV_SUBBASE_TOP - paramSubbaseT);
    const ELEV_TOP_RIM = (params.tblElev !== undefined && params.tblElev !== '' && !isNaN(Number(params.tblElev)))
        ? roundElev(Number(params.tblElev))
        : roundElev(ELEV_CANAL_INVERT + paramH);
    const ELEV_BOTTOM_OUTLINE = roundElev(Math.min(ELEV_SUBBASE_BOT, ngl - paramTopsoil) - 0.55);

    const X_INNER_WALL = roundLen(paramB / 2);
    const X_OUTER_WALL = roundLen(X_INNER_WALL + paramWallT);
    const X_SUBBASE_OUTER = X_OUTER_WALL;
    const X_BOTTOM_STEP = roundLen(X_SUBBASE_OUTER + BOTTOM_STEP);
    const X_BERM_LEFT = roundLen(X_OUTER_WALL + paramTBL);
    const X_BERM_RIGHT = roundLen(X_OUTER_WALL + paramTBR);

    const isHighNGL = ngl >= ELEV_TOP_RIM;
    const xOuterFillLeft = roundLen(X_BERM_LEFT + Math.max(0, ELEV_TOP_RIM - ngl));
    const xOuterFillRight = roundLen(X_BERM_RIGHT + Math.max(0, ELEV_TOP_RIM - ngl));
    const xInnerCut = roundLen(X_BOTTOM_STEP + Math.abs(ngl - ELEV_SUBBASE_BOT));

    const topsoilElev = roundElev(ngl - paramTopsoil);
    const xTopsoilInner = roundLen(Math.max(0, xInnerCut - paramTopsoil));

    let statusText = 'งานกึ่งขุดกึ่งถม (Partial)';
    let statusType = 'partial';
    if (ngl > ELEV_TOP_RIM) {
        statusText = 'งานขุดดินลึก (Cut)';
        statusType = 'cut';
    } else if (ngl < ELEV_SUBBASE_BOT) {
        statusText = 'งานถมดินสูง (Fill)';
        statusType = 'fill';
    }

    const xIntersectYellowAtRim = roundLen(X_BOTTOM_STEP + (ELEV_TOP_RIM - ELEV_SUBBASE_BOT));

    let p1, p14, p2, p13, p6, p9, p7, p8;
    const p3 = { x: -X_OUTER_WALL, elev: ELEV_TOP_RIM };
    const p12 = { x: X_OUTER_WALL, elev: ELEV_TOP_RIM };

    const dist63AtRim = Math.abs(xIntersectYellowAtRim - X_OUTER_WALL);
    const dist23Left = paramTBL;
    const dist23Right = paramTBR;

    const isLeftSpecial = isHighNGL && (dist23Left > dist63AtRim);
    const isRightSpecial = isHighNGL && (dist23Right > dist63AtRim);

    if (isHighNGL) {
        if (isLeftSpecial) {
            p2 = { x: -X_BERM_LEFT, elev: ELEV_TOP_RIM };
            p6 = { x: -xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
            const dxLeft = roundElev(ngl - ELEV_TOP_RIM);
            p1 = { x: roundLen(-(X_BERM_LEFT + dxLeft)), elev: ngl };
            if (topsoilElev <= ELEV_TOP_RIM) {
                p7 = { x: roundLen(-xTopsoilInner), elev: topsoilElev };
            } else {
                const x7Left = roundLen(X_BERM_LEFT + (topsoilElev - ELEV_TOP_RIM));
                p7 = { x: roundLen(-x7Left), elev: topsoilElev };
            }
        } else {
            p2 = { x: -xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
            p6 = { x: -xInnerCut, elev: ngl };
            p1 = null;
            p7 = { x: -xTopsoilInner, elev: topsoilElev };
        }

        if (isRightSpecial) {
            p13 = { x: X_BERM_RIGHT, elev: ELEV_TOP_RIM };
            p9 = { x: xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
            const dxRight = roundElev(ngl - ELEV_TOP_RIM);
            p14 = { x: roundLen(X_BERM_RIGHT + dxRight), elev: ngl };
            if (topsoilElev <= ELEV_TOP_RIM) {
                p8 = { x: roundLen(xTopsoilInner), elev: topsoilElev };
            } else {
                const x8Right = roundLen(X_BERM_RIGHT + (topsoilElev - ELEV_TOP_RIM));
                p8 = { x: roundLen(x8Right), elev: topsoilElev };
            }
        } else {
            p13 = { x: xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
            p9 = { x: xInnerCut, elev: ngl };
            p14 = null;
            p8 = { x: xTopsoilInner, elev: topsoilElev };
        }
    } else {
        p2 = { x: -X_BERM_LEFT, elev: ELEV_TOP_RIM };
        p13 = { x: X_BERM_RIGHT, elev: ELEV_TOP_RIM };
        p6 = { x: -xInnerCut, elev: ngl };
        p9 = { x: xInnerCut, elev: ngl };
        p1 = { x: -xOuterFillLeft, elev: ngl };
        p14 = { x: xOuterFillRight, elev: ngl };
        p7 = { x: -xTopsoilInner, elev: topsoilElev };
        p8 = { x: xTopsoilInner, elev: topsoilElev };
    }

    const p4 = { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT };
    const p5 = { x: -X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT };
    const p10 = { x: X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT };
    const p11 = { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT };

    const activeOuterXLeft = (ngl < ELEV_TOP_RIM)
        ? Math.max(xOuterFillLeft, xInnerCut)
        : (isLeftSpecial && p1 ? Math.max(Math.abs(p1.x), xInnerCut) : xInnerCut);
    const activeOuterXRight = (ngl < ELEV_TOP_RIM)
        ? Math.max(xOuterFillRight, xInnerCut)
        : (isRightSpecial && p14 ? Math.max(Math.abs(p14.x), xInnerCut) : xInnerCut);
    const outerGroundXLeft = activeOuterXLeft + EXTEND_NGL;
    const outerGroundXRight = activeOuterXRight + EXTEND_NGL;

    let rightEarthPoly, leftEarthPoly;
    if (topsoilElev > ELEV_SUBBASE_BOT) {
        if (isRightSpecial && p14) {
            rightEarthPoly = [
                { x: 0, elev: ELEV_SUBBASE_BOT },
                { x: X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT },
                { x: p9.x, elev: p9.elev },
                { x: p13.x, elev: p13.elev },
                { x: p14.x, elev: p14.elev },
                { x: outerGroundXRight, elev: ngl },
                { x: outerGroundXRight, elev: ELEV_BOTTOM_OUTLINE },
                { x: 0, elev: ELEV_BOTTOM_OUTLINE }
            ];
        } else {
            rightEarthPoly = [
                { x: 0, elev: ELEV_SUBBASE_BOT },
                { x: X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT },
                { x: xInnerCut, elev: ngl },
                { x: outerGroundXRight, elev: ngl },
                { x: outerGroundXRight, elev: ELEV_BOTTOM_OUTLINE },
                { x: 0, elev: ELEV_BOTTOM_OUTLINE }
            ];
        }

        if (isLeftSpecial && p1) {
            leftEarthPoly = [
                { x: 0, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ngl },
                { x: p1.x, elev: p1.elev },
                { x: p2.x, elev: p2.elev },
                { x: p6.x, elev: p6.elev },
                { x: -X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT },
                { x: 0, elev: ELEV_SUBBASE_BOT }
            ];
        } else {
            leftEarthPoly = [
                { x: 0, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ngl },
                { x: -xInnerCut, elev: ngl },
                { x: -X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT },
                { x: 0, elev: ELEV_SUBBASE_BOT }
            ];
        }
    } else {
        if (isRightSpecial && p14) {
            rightEarthPoly = [
                { x: 0, elev: topsoilElev },
                { x: p8.x, elev: topsoilElev },
                { x: p9.x, elev: p9.elev },
                { x: p13.x, elev: p13.elev },
                { x: p14.x, elev: p14.elev },
                { x: outerGroundXRight, elev: ngl },
                { x: outerGroundXRight, elev: ELEV_BOTTOM_OUTLINE },
                { x: 0, elev: ELEV_BOTTOM_OUTLINE }
            ];
        } else {
            rightEarthPoly = [
                { x: 0, elev: topsoilElev },
                { x: p8.x, elev: topsoilElev },
                { x: xInnerCut, elev: ngl },
                { x: outerGroundXRight, elev: ngl },
                { x: outerGroundXRight, elev: ELEV_BOTTOM_OUTLINE },
                { x: 0, elev: ELEV_BOTTOM_OUTLINE }
            ];
        }

        if (isLeftSpecial && p1) {
            leftEarthPoly = [
                { x: 0, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ngl },
                { x: p1.x, elev: p1.elev },
                { x: p2.x, elev: p2.elev },
                { x: p6.x, elev: p6.elev },
                { x: p7.x, elev: topsoilElev },
                { x: 0, elev: topsoilElev }
            ];
        } else {
            leftEarthPoly = [
                { x: 0, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ELEV_BOTTOM_OUTLINE },
                { x: -outerGroundXLeft, elev: ngl },
                { x: -xInnerCut, elev: ngl },
                { x: p7.x, elev: topsoilElev },
                { x: 0, elev: topsoilElev }
            ];
        }
    }
    const fullEarthPoly = [...rightEarthPoly, ...leftEarthPoly];

    // A. Area Stripping
    let polyStripping = [];
    let stripNodesLeftStr = '';
    let stripNodesRightStr = '';
    if (isLeftSpecial && p1) {
        if (topsoilElev <= ELEV_TOP_RIM) {
            polyStripping.push(p1, p2, p6, p7);
            stripNodesLeftStr = '1-2-6-7';
        } else {
            polyStripping.push(p1, p7);
            stripNodesLeftStr = '1-7';
        }
    } else {
        polyStripping.push(p6, p7);
        stripNodesLeftStr = '6-7';
    }

    if (isRightSpecial && p14) {
        if (topsoilElev <= ELEV_TOP_RIM) {
            polyStripping.push(p8, p9, p13, p14);
            stripNodesRightStr = '8-9-13-14';
        } else {
            polyStripping.push(p8, p14);
            stripNodesRightStr = '8-14';
        }
    } else {
        polyStripping.push(p8, p9);
        stripNodesRightStr = '8-9';
    }
    const nodesStrippingStr = `${stripNodesLeftStr}-${stripNodesRightStr}`;
    const areaStripping = (paramTopsoil > 0) ? calcPolygonArea(polyStripping) : 0;

    // B. Area Compacted Fill 85%
    let polyCompacted = [];
    let nodesCompactedStr = '-';
    if (topsoilElev <= ELEV_SUBBASE_BOT) {
        if (isLeftSpecial) {
            polyCompacted.push(p5, p7);
        } else {
            polyCompacted.push(p5, p6, p7);
        }
        if (isRightSpecial) {
            polyCompacted.push(p8, p10);
        } else {
            polyCompacted.push(p8, p9, p10);
        }
        nodesCompactedStr = (isLeftSpecial || isRightSpecial) ? '5-7-8-10' : '5-6-7-8-9-10';
    }
    const areaCompacted = (topsoilElev <= ELEV_SUBBASE_BOT) ? calcPolygonArea(polyCompacted) : 0;

    // C. Area Excavation
    let polyExcavation = [];
    let nodesExcavationStr = '-';
    if (topsoilElev > ELEV_SUBBASE_BOT) {
        let excLeftStr = '5-7';
        let excRightStr = '8-10';
        if (isLeftSpecial && topsoilElev > ELEV_TOP_RIM) {
            polyExcavation.push(p5, p6, p2, p7);
            excLeftStr = '5-6-2-7';
        } else {
            polyExcavation.push(p5, p7);
        }

        if (isRightSpecial && topsoilElev > ELEV_TOP_RIM) {
            polyExcavation.push(p8, p13, p9, p10);
            excRightStr = '8-13-9-10';
        } else {
            polyExcavation.push(p8, p10);
        }
        nodesExcavationStr = `${excLeftStr}-${excRightStr}`;
    }
    const areaExcavation = (topsoilElev > ELEV_SUBBASE_BOT) ? calcPolygonArea(polyExcavation) : 0;

    // D. Area Manual Fill
    let polyManualLeft, polyManualRight;
    let nodesManualLeftStr, nodesManualRightStr;
    if (!isHighNGL) {
        polyManualLeft = [p1, p2, p3, p4, p5, p6];
        polyManualRight = [p9, p10, p11, p12, p13, p14];
        nodesManualLeftStr = '1-2-3-4-5-6';
        nodesManualRightStr = '9-10-11-12-13-14';
    } else {
        polyManualLeft = isLeftSpecial ? [p6, p3, p4, p5] : [p2, p3, p4, p5];
        polyManualRight = isRightSpecial ? [p10, p11, p12, p9] : [p10, p11, p12, p13];
        nodesManualLeftStr = isLeftSpecial ? '3-4-5-6' : '2-3-4-5';
        nodesManualRightStr = isRightSpecial ? '9-10-11-12' : '10-11-12-13';
    }
    const areaManualLeft = calcPolygonArea(polyManualLeft);
    const areaManualRight = calcPolygonArea(polyManualRight);
    const areaManualTotal = roundArea(areaManualLeft + areaManualRight);

    // Subbase & Concrete U-Shape (คำนวณจากมิติที่ปัดทศนิยม 2 ตำแหน่งแล้วตรงตามสูตรกดเครื่องคิดเลขมือ)
    const subbasePts = [
        { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT },
        { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT },
        { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_TOP },
        { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_TOP }
    ];
    const outerWidthRect = roundLen(paramB + roundLen(2 * paramWallT));
    const outerHeightRect = roundLen(paramH + paramBaseT);
    const grossConcreteArea = roundArea(outerWidthRect * outerHeightRect);
    const innerWaterwayArea = roundArea(paramB * paramH);
    const areaConcrete = roundArea(grossConcreteArea - innerWaterwayArea);
    const areaSubbase = (paramSubbaseT > 0) ? roundArea(outerWidthRect * paramSubbaseT) : 0;

    const concretePts = [
        { x: -X_OUTER_WALL, elev: ELEV_TOP_RIM },
        { x: -X_INNER_WALL, elev: ELEV_TOP_RIM },
        { x: -X_INNER_WALL, elev: ELEV_CANAL_INVERT },
        { x: X_INNER_WALL, elev: ELEV_CANAL_INVERT },
        { x: X_INNER_WALL, elev: ELEV_TOP_RIM },
        { x: X_OUTER_WALL, elev: ELEV_TOP_RIM },
        { x: X_OUTER_WALL, elev: ELEV_SUBBASE_TOP },
        { x: -X_OUTER_WALL, elev: ELEV_SUBBASE_TOP }
    ];

    const width69 = hasValidNgl ? roundLen(Math.abs(roundLen(p9.x) - roundLen(p6.x))) : 0;
    const leftOuterTopPt = p1 ? p1 : p2;
    const rightOuterTopPt = p14 ? p14 : p13;
    const width114 = hasValidNgl ? roundLen(Math.abs(roundLen(rightOuterTopPt.x) - roundLen(leftOuterTopPt.x))) : 0;

    return {
        params: {
            invert: paramInvert,
            ngl,
            B: paramB,
            H: paramH,
            TBL: paramTBL,
            TBR: paramTBR,
            tw: paramWallT,
            tb: paramBaseT,
            ts: paramSubbaseT,
            dt: paramTopsoil
        },
        elevs: {
            ELEV_CANAL_INVERT,
            ELEV_SUBBASE_TOP,
            ELEV_SUBBASE_BOT,
            ELEV_TOP_RIM,
            ELEV_BOTTOM_OUTLINE,
            topsoilElev
        },
        xs: {
            X_INNER_WALL,
            X_OUTER_WALL,
            X_SUBBASE_OUTER,
            X_BOTTOM_STEP,
            X_BERM_LEFT,
            X_BERM_RIGHT,
            outerGroundXLeft,
            outerGroundXRight
        },
        flags: {
            hasNgl: hasValidNgl,
            isHighNGL,
            isLeftSpecial,
            isRightSpecial,
            statusText: hasValidNgl ? statusText : 'รอค่าระดับ NGL (-)',
            statusType: hasValidNgl ? statusType : 'missing_ngl'
        },
        nodes: { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14 },
        polys: {
            fullEarthPoly: hasValidNgl ? fullEarthPoly : [],
            polyStripping: hasValidNgl ? polyStripping : [],
            polyCompacted: hasValidNgl ? polyCompacted : [],
            polyExcavation: hasValidNgl ? polyExcavation : [],
            polyManualLeft: hasValidNgl ? polyManualLeft : [],
            polyManualRight: hasValidNgl ? polyManualRight : [],
            subbasePts,
            concretePts
        },
        nodeLabels: {
            nodesStrippingStr: hasValidNgl ? nodesStrippingStr : '-',
            nodesCompactedStr: hasValidNgl ? nodesCompactedStr : '-',
            nodesExcavationStr: hasValidNgl ? nodesExcavationStr : '-',
            nodesManualLeftStr: hasValidNgl ? nodesManualLeftStr : '-',
            nodesManualRightStr: hasValidNgl ? nodesManualRightStr : '-'
        },
        areas: {
            stripping: hasValidNgl ? areaStripping : 0,
            compacted: hasValidNgl ? areaCompacted : 0,
            excavation: hasValidNgl ? areaExcavation : 0,
            manualLeft: hasValidNgl ? areaManualLeft : 0,
            manualRight: hasValidNgl ? areaManualRight : 0,
            manualTotal: hasValidNgl ? areaManualTotal : 0,
            concrete: areaConcrete,
            subbase: areaSubbase
        },
        widths: {
            width69,
            width114,
            leftOuterTopPt,
            rightOuterTopPt
        }
    };
}

// ============================================================================
// 3. REUSABLE CROSS-SECTION CANVAS RENDERER
// ============================================================================
function renderSectionToCanvas(targetCtx, cssW, cssH, deviceRatio, viewState, sec, opts) {
    targetCtx?.setTransform?.(deviceRatio, 0, 0, deviceRatio, 0, 0);
    targetCtx.clearRect(0, 0, cssW, cssH);

    const toScr = (x, elev) => ({
        x: viewState.panX + x * viewState.scale,
        y: viewState.panY - elev * viewState.scale
    });

    const drawLineLocal = (p1, p2, color = '#cbd5e1', width = 1, strokeStyle = []) => {
        const s1 = toScr(p1.x, p1.elev);
        const s2 = toScr(p2.x, p2.elev);
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.setLineDash(strokeStyle);
        targetCtx.moveTo(s1.x, s1.y);
        targetCtx.lineTo(s2.x, s2.y);
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = width;
        targetCtx.stroke();
        targetCtx.restore();
    };

    const fillPolyLocal = (points, fillColor, strokeColor = '') => {
        if (!points || points.length < 3) return;
        targetCtx.save();
        targetCtx.beginPath();
        const s0 = toScr(points[0].x, points[0].elev);
        targetCtx.moveTo(s0.x, s0.y);
        for (let i = 1; i < points.length; i++) {
            const s = toScr(points[i].x, points[i].elev);
            targetCtx.lineTo(s.x, s.y);
        }
        targetCtx.closePath();
        targetCtx.fillStyle = fillColor;
        targetCtx.fill();
        if (strokeColor) {
            targetCtx.strokeStyle = strokeColor;
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
        }
        targetCtx.restore();
    };

    const drawAreaLabelLocal = (pts, areaVal, color) => {
        if (!pts || pts.length < 3 || areaVal <= 0.0001) return;
        let cx = 0, cy = 0;
        for (const p of pts) {
            cx += p.x;
            cy += p.elev;
        }
        cx /= pts.length;
        cy /= pts.length;
        const s = toScr(cx, cy);
        targetCtx.save();
        targetCtx.font = opts.compact ? '700 10.5px "Sarabun", sans-serif' : '700 12px "Sarabun", sans-serif';
        targetCtx.fillStyle = color;
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        targetCtx.fillText(`${areaVal.toFixed(3)} m²`, Math.round(s.x), Math.round(s.y));
        targetCtx.restore();
    };

    const drawNodeLocal = (x, elev, fillColor = '#f59e0b', label = '') => {
        const pt = toScr(x, elev);
        const rx = Math.round(pt.x);
        const ry = Math.round(pt.y);
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.arc(rx, ry, opts.compact ? 4 : 5, 0, Math.PI * 2);
        targetCtx.fillStyle = fillColor;
        targetCtx.fill();
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 1.5;
        targetCtx.stroke();

        if (label) {
            targetCtx.font = opts.compact ? '700 11px "Sarabun", sans-serif' : '700 13px "Sarabun", sans-serif';
            targetCtx.fillStyle = '#4ade80';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(label, rx, ry - (opts.compact ? 13 : 16));
        }
        targetCtx.restore();
    };

    const drawArrowHeadLocal = (x, y, angle, size = 6, color = '#38bdf8') => {
        targetCtx.save();
        targetCtx.translate(Math.round(x), Math.round(y));
        targetCtx.rotate(angle);
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(-size, -size * 0.55);
        targetCtx.lineTo(-size, size * 0.55);
        targetCtx.closePath();
        targetCtx.fillStyle = color;
        targetCtx.fill();
        targetCtx.restore();
    };

    const drawPillTextLocal = (text, sx, sy, textColor = '#ffffff', bgColor = '#0f172a', borderColor = '#38bdf8') => {
        targetCtx.save();
        targetCtx.font = opts.compact ? '600 10.5px "Sarabun", sans-serif' : '600 12.5px "Sarabun", sans-serif';
        const metrics = targetCtx.measureText(text);
        const padX = opts.compact ? 6 : 8;
        const w = Math.ceil(metrics.width) + padX * 2;
        const h = opts.compact ? 19 : 22;
        const rx = Math.round(sx);
        const ry = Math.round(sy);
        const x0 = Math.round(rx - w / 2) + 0.5;
        const y0 = Math.round(ry - h / 2) + 0.5;

        targetCtx.fillStyle = bgColor;
        targetCtx.strokeStyle = borderColor;
        targetCtx.lineWidth = 1.2;
        targetCtx.beginPath();
        targetCtx?.roundRect?.(x0, y0, w, h, 5);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.fillStyle = textColor;
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        targetCtx.fillText(text, rx, ry + 0.5);
        targetCtx.restore();
    };

    const drawHorizDimLocal = (x1, x2, elevOrigin1, elevOrigin2, offsetPx, labelText, color = '#38bdf8') => {
        const p1 = toScr(x1, elevOrigin1);
        const p2 = toScr(x2, elevOrigin2);
        const x1r = Math.round(p1.x) + 0.5;
        const x2r = Math.round(p2.x) + 0.5;
        const yDim = Math.round(Math.min(p1.y, p2.y) + offsetPx) + 0.5;
        targetCtx.save();
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 1.2;
        targetCtx.setLineDash([3, 3]);
        targetCtx.beginPath();
        targetCtx.moveTo(x1r, Math.round(p1.y));
        targetCtx.lineTo(x1r, yDim);
        targetCtx.moveTo(x2r, Math.round(p2.y));
        targetCtx.lineTo(x2r, yDim);
        targetCtx.stroke();

        targetCtx.setLineDash([]);
        targetCtx.beginPath();
        targetCtx.moveTo(x1r, yDim);
        targetCtx.lineTo(x2r, yDim);
        targetCtx.stroke();
        targetCtx.restore();

        if (Math.abs(x2r - x1r) > 14) {
            const dir = x2r >= x1r ? 0 : Math.PI;
            drawArrowHeadLocal(x2r, yDim, dir, 5, color);
            drawArrowHeadLocal(x1r, yDim, dir + Math.PI, 5, color);
        }
        drawPillTextLocal(labelText, (x1r + x2r) / 2, yDim, '#ffffff', '#0f172a', color);
    };

    const drawVertDimLocal = (xOrigin, elev1, elev2, offsetPx, labelText, color = '#38bdf8') => {
        const p1 = toScr(xOrigin, elev1);
        const p2 = toScr(xOrigin, elev2);
        const y1r = Math.round(p1.y) + 0.5;
        const y2r = Math.round(p2.y) + 0.5;
        const xDim = Math.round(p1.x + offsetPx) + 0.5;
        targetCtx.save();
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 1.2;
        targetCtx.setLineDash([3, 3]);
        targetCtx.beginPath();
        targetCtx.moveTo(Math.round(p1.x), y1r);
        targetCtx.lineTo(xDim, y1r);
        targetCtx.moveTo(Math.round(p2.x), y2r);
        targetCtx.lineTo(xDim, y2r);
        targetCtx.stroke();

        targetCtx.setLineDash([]);
        targetCtx.beginPath();
        targetCtx.moveTo(xDim, y1r);
        targetCtx.lineTo(xDim, y2r);
        targetCtx.stroke();
        targetCtx.restore();

        if (Math.abs(y2r - y1r) > 14) {
            const dir = y2r >= y1r ? Math.PI / 2 : -Math.PI / 2;
            drawArrowHeadLocal(xDim, y2r, dir, 5, color);
            drawArrowHeadLocal(xDim, y1r, dir + Math.PI, 5, color);
        }
        drawPillTextLocal(labelText, xDim, (y1r + y2r) / 2, '#ffffff', '#0f172a', color);
    };

    const { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14 } = sec.nodes;
    const { ELEV_CANAL_INVERT, ELEV_SUBBASE_TOP, ELEV_SUBBASE_BOT, ELEV_TOP_RIM, ELEV_BOTTOM_OUTLINE, topsoilElev } = sec.elevs;
    const { X_INNER_WALL, X_OUTER_WALL, X_BERM_LEFT, X_BERM_RIGHT, outerGroundXLeft, outerGroundXRight } = sec.xs;
    const { isHighNGL, isLeftSpecial, isRightSpecial } = sec.flags;
    const { ngl, B, H, TBL, TBR, tw, tb, ts, dt } = sec.params;

    fillPolyLocal(sec.polys.fullEarthPoly, '#1e293b', '#475569');

    if (opts.showStripping && sec.areas.stripping > 0) {
        fillPolyLocal(sec.polys.polyStripping, 'rgba(245, 158, 11, 0.35)', 'rgba(245, 158, 11, 0.8)');
        drawAreaLabelLocal(sec.polys.polyStripping, sec.areas.stripping, '#fbbf24');
    }
    if (opts.showCompacted && topsoilElev <= ELEV_SUBBASE_BOT && sec.areas.compacted > 0) {
        fillPolyLocal(sec.polys.polyCompacted, 'rgba(20, 184, 166, 0.35)', 'rgba(20, 184, 166, 0.8)');
        drawAreaLabelLocal(sec.polys.polyCompacted, sec.areas.compacted, '#2dd4bf');
    }
    if (opts.showExcavation && topsoilElev > ELEV_SUBBASE_BOT && sec.areas.excavation > 0) {
        fillPolyLocal(sec.polys.polyExcavation, 'rgba(249, 115, 22, 0.4)', 'rgba(249, 115, 22, 0.8)');
        drawAreaLabelLocal(sec.polys.polyExcavation, sec.areas.excavation, '#fb923c');
    }
    if (opts.showManualFill) {
        fillPolyLocal(sec.polys.polyManualLeft, 'rgba(168, 85, 247, 0.35)', 'rgba(168, 85, 247, 0.8)');
        fillPolyLocal(sec.polys.polyManualRight, 'rgba(168, 85, 247, 0.35)', 'rgba(168, 85, 247, 0.8)');
        drawAreaLabelLocal(sec.polys.polyManualLeft, sec.areas.manualLeft, '#d8b4fe');
        drawAreaLabelLocal(sec.polys.polyManualRight, sec.areas.manualRight, '#d8b4fe');
    }

    if (ts > 0) {
        fillPolyLocal(sec.polys.subbasePts, 'rgba(125, 211, 252, 0.55)', '#7dd3fc');
    }
    fillPolyLocal(sec.polys.concretePts, '#334155', '#38bdf8');

    drawLineLocal(p4, p5, '#eab308', 2.5);
    drawLineLocal(p11, p10, '#eab308', 2.5);
    drawLineLocal(p5, p6, '#eab308', 2.5);
    drawLineLocal(p10, p9, '#eab308', 2.5);

    if (isHighNGL) {
        drawLineLocal(p3, p2, '#ef4444', 2.5);
        drawLineLocal(p12, p13, '#ef4444', 2.5);
        if (isLeftSpecial && p1) drawLineLocal(p2, p1, '#ef4444', 2.5);
        if (isRightSpecial && p14) drawLineLocal(p13, p14, '#ef4444', 2.5);
    } else {
        drawLineLocal(p3, p2, '#ef4444', 2.5);
        drawLineLocal(p12, p13, '#ef4444', 2.5);
        drawLineLocal(p2, p1, '#ef4444', 2.5);
        drawLineLocal(p13, p14, '#ef4444', 2.5);
    }

    const nglSpanLeft = p1 ? p1 : p6;
    const nglSpanRight = p14 ? p14 : p9;
    drawLineLocal(nglSpanLeft, nglSpanRight, '#10b981', 2.2, [6, 4]);
    drawLineLocal({ x: -outerGroundXLeft, elev: ngl }, { x: nglSpanLeft.x, elev: ngl }, '#10b981', 2.5);
    drawLineLocal({ x: nglSpanRight.x, elev: ngl }, { x: outerGroundXRight, elev: ngl }, '#10b981', 2.5);

    const sNglRight = toScr(outerGroundXRight, ngl);
    targetCtx.save();
    targetCtx.font = opts.compact ? '700 11px "Sarabun", sans-serif' : '700 13px "Sarabun", sans-serif';
    targetCtx.fillStyle = '#34d399';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'bottom';
    targetCtx.fillText(`NGL (+${roundElev(ngl).toFixed(2)} m)`, Math.round(sNglRight.x) - (opts.compact ? 25 : 0), Math.round(sNglRight.y) - 6);
    targetCtx.restore();

    const topsoilDashPattern = (topsoilElev > ELEV_SUBBASE_BOT) ? [6, 4] : [];
    if (!isLeftSpecial) {
        drawLineLocal(p6, p7, '#d97706', 2, topsoilDashPattern);
    } else if (topsoilElev > ELEV_TOP_RIM) {
        drawLineLocal(p1, p7, '#d97706', 2, topsoilDashPattern);
    } else {
        drawLineLocal(p6, p7, '#d97706', 2, topsoilDashPattern);
    }

    if (!isRightSpecial) {
        drawLineLocal(p9, p8, '#d97706', 2, topsoilDashPattern);
    } else if (topsoilElev > ELEV_TOP_RIM) {
        drawLineLocal(p14, p8, '#d97706', 2, topsoilDashPattern);
    } else {
        drawLineLocal(p9, p8, '#d97706', 2, topsoilDashPattern);
    }
    drawLineLocal(p7, p8, '#d97706', 2, topsoilDashPattern);

    if (p1) drawNodeLocal(p1.x, p1.elev, '#f59e0b', '1');
    drawNodeLocal(p2.x, p2.elev, isHighNGL && !isLeftSpecial ? '#ef4444' : '#22c55e', '2');
    drawNodeLocal(p3.x, p3.elev, '#22c55e', '3');
    drawNodeLocal(p4.x, p4.elev, '#22c55e', '4');
    drawNodeLocal(p5.x, p5.elev, '#22c55e', '5');
    drawNodeLocal(p6.x, p6.elev, '#22c55e', '6');
    drawNodeLocal(p7.x, p7.elev, '#f59e0b', '7');
    drawNodeLocal(p8.x, p8.elev, '#f59e0b', '8');
    drawNodeLocal(p9.x, p9.elev, '#22c55e', '9');
    drawNodeLocal(p10.x, p10.elev, '#22c55e', '10');
    drawNodeLocal(p11.x, p11.elev, '#22c55e', '11');
    drawNodeLocal(p12.x, p12.elev, '#22c55e', '12');
    drawNodeLocal(p13.x, p13.elev, isHighNGL && !isRightSpecial ? '#ef4444' : '#22c55e', '13');
    if (p14) drawNodeLocal(p14.x, p14.elev, '#f59e0b', '14');

    const maxElevInSection = Math.max(ngl, ELEV_TOP_RIM);
    const clTopElev = maxElevInSection + 0.45;
    drawLineLocal({ x: 0, elev: ELEV_SUBBASE_BOT - 0.5 }, { x: 0, elev: clTopElev }, '#ef4444', 1.5, [6, 4]);

    const topCL = toScr(0, clTopElev);
    targetCtx.save();
    targetCtx.fillStyle = '#f87171';
    targetCtx.font = opts.compact ? '700 11px "Sarabun", sans-serif' : '700 13px "Sarabun", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('CL คูส่งน้ำ', Math.round(topCL.x), Math.round(topCL.y) - 8);
    targetCtx.restore();

    if (opts.showDims) {
        drawHorizDimLocal(-X_INNER_WALL, X_INNER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -32, `B = ${B.toFixed(2)} m`, '#38bdf8');
        if (!opts.compact) {
            drawHorizDimLocal(-X_OUTER_WALL, -X_INNER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -58, `หนา ${tw.toFixed(2)}`, '#93c5fd');
            drawHorizDimLocal(X_INNER_WALL, X_OUTER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -58, `หนา ${tw.toFixed(2)}`, '#93c5fd');
        }
        if (!isHighNGL || isLeftSpecial) {
            drawHorizDimLocal(-X_BERM_LEFT, -X_OUTER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -32, `TBL = ${TBL.toFixed(2)} m`, '#f87171');
        }
        if (!isHighNGL || isRightSpecial) {
            drawHorizDimLocal(X_OUTER_WALL, X_BERM_RIGHT, ELEV_TOP_RIM, ELEV_TOP_RIM, -32, `TBR = ${TBR.toFixed(2)} m`, '#f87171');
        }
        drawVertDimLocal(X_INNER_WALL, ELEV_CANAL_INVERT, ELEV_TOP_RIM, -36, `H = ${H.toFixed(2)} m`, '#38bdf8');
        if (!opts.compact) {
            drawVertDimLocal(X_OUTER_WALL, ELEV_SUBBASE_TOP, ELEV_CANAL_INVERT, 50, `พื้น ${tb.toFixed(2)} m`, '#60a5fa');
            if (ts > 0) {
                drawVertDimLocal(X_OUTER_WALL, ELEV_SUBBASE_BOT, ELEV_SUBBASE_TOP, 120, `หยาบ ${ts.toFixed(2)} m`, '#7dd3fc');
            }
            drawHorizDimLocal(p4.x, p5.x, ELEV_SUBBASE_BOT, ELEV_SUBBASE_BOT, 25, `ชานพัก ${BOTTOM_STEP.toFixed(2)} m`, '#eab308');
            drawHorizDimLocal(p11.x, p10.x, ELEV_SUBBASE_BOT, ELEV_SUBBASE_BOT, 25, `ชานพัก ${BOTTOM_STEP.toFixed(2)} m`, '#eab308');
        }
        if (dt > 0 && !opts.compact) {
            drawVertDimLocal(p8.x, topsoilElev, ngl, 52, `ลอกดิน ${dt.toFixed(2)} m`, '#f59e0b');
        }
        const sInvert = toScr(0, ELEV_CANAL_INVERT);
        drawPillTextLocal(`ท้องคู (BL.) +${roundElev(ELEV_CANAL_INVERT).toFixed(2)} m`, sInvert.x, sInvert.y - 12, '#bae6fd', '#0f172a', '#0284c7');
        const sRim = toScr(0, ELEV_TOP_RIM);
        drawPillTextLocal(`หลังคลอง +${roundElev(ELEV_TOP_RIM).toFixed(2)} m`, sRim.x, sRim.y - (opts.compact ? 60 : 84), '#1e293b', '#0f172a', '#64748b');
    }

    if (opts.showWidths) {
        const sBottomOutline = toScr(0, ELEV_BOTTOM_OUTLINE);
        const sLowestActive = toScr(0, Math.min(ELEV_SUBBASE_BOT, topsoilElev, ngl));
        const baseBottomY = Math.max(sBottomOutline.y, sLowestActive.y + (opts.compact ? 30 : 45));

        const yDim69 = Math.round(baseBottomY + (opts.compact ? 20 : 28)) + 0.5;
        const yDim114 = Math.round(baseBottomY + (opts.compact ? 46 : 62)) + 0.5;

        const drawBottomWidthDim = (ptLeft, ptRight, yDimScreen, labelText, color) => {
            const s1 = toScr(ptLeft.x, ptLeft.elev);
            const s2 = toScr(ptRight.x, ptRight.elev);
            const x1r = Math.round(s1.x) + 0.5;
            const x2r = Math.round(s2.x) + 0.5;
            targetCtx.save();
            targetCtx.strokeStyle = color;
            targetCtx.lineWidth = 1.25;
            targetCtx.setLineDash([4, 3]);
            targetCtx.beginPath();
            targetCtx.moveTo(x1r, Math.round(s1.y));
            targetCtx.lineTo(x1r, yDimScreen);
            targetCtx.moveTo(x2r, Math.round(s2.y));
            targetCtx.lineTo(x2r, yDimScreen);
            targetCtx.stroke();

            targetCtx.setLineDash([]);
            targetCtx.beginPath();
            targetCtx.moveTo(x1r, yDimScreen);
            targetCtx.lineTo(x2r, yDimScreen);
            targetCtx.stroke();
            targetCtx.restore();

            if (Math.abs(x2r - x1r) > 14) {
                const dir = x2r >= x1r ? 0 : Math.PI;
                drawArrowHeadLocal(x2r, yDimScreen, dir, 5, color);
                drawArrowHeadLocal(x1r, yDimScreen, dir + Math.PI, 5, color);
            }
            drawPillTextLocal(labelText, (x1r + x2r) / 2, yDimScreen, '#ffffff', '#0f172a', color);
        };

        drawBottomWidthDim(
            p6,
            p9,
            yDim69,
            `กว้างขุดลอก (6-9) = ${roundLen(sec.widths.width69).toFixed(2)} m`,
            '#f472b6'
        );

        if (p1 || p14) {
            const lblLeft = p1 ? '1' : '2';
            const lblRight = p14 ? '14' : '13';
            drawBottomWidthDim(
                sec.widths.leftOuterTopPt,
                sec.widths.rightOuterTopPt,
                yDim114,
                `กว้างคันดินล่าง (${lblLeft}-${lblRight}) = ${roundLen(sec.widths.width114).toFixed(2)} m`,
                '#fb7185'
            );
        } else {
            const width213 = Math.abs(p13.x - p2.x);
            drawBottomWidthDim(
                p2,
                p13,
                yDim114,
                `กว้างคันดินล่าง (2-13) = ${roundLen(width213).toFixed(2)} m`,
                '#fb7185'
            );
        }
    }
}

        // ============================================================================
// 3.5 DETAILED CALCULATION REPORT GENERATOR & EXPORTERS (PDF & WORD)
// ============================================================================
function renderCalcDiagramWhiteBg(sec, categoryKey, cssW = 760, cssH = 340) {
    const off = document.createElement('canvas');
    const ratio = 2; // High-DPI 2x resolution for print & Word
    off.width = Math.round(cssW * ratio);
    off.height = Math.round(cssH * ratio);
    const c = off.getContext('2d');
    c?.setTransform?.(ratio, 0, 0, ratio, 0, 0);

    // 1. Fill clean white background
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, cssW, cssH);

    // Subtle border around drawing
    c.strokeStyle = '#1e293b';
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);

    // Coordinate extents - extended margin on right and below bottom outline so labels never touch
    const groundExtraRight = Math.max(sec.xs.outerGroundXRight + 1.80, 3.40);
    const groundExtraLeft = Math.max(sec.xs.outerGroundXLeft + 0.60, 2.60);
    const minX = -groundExtraLeft;
    const maxX = groundExtraRight;
    const minY = sec.elevs.ELEV_BOTTOM_OUTLINE - 0.45;
    const maxY = Math.max(sec.params.ngl, sec.elevs.ELEV_TOP_RIM) + 0.55;

    const padX = 50;
    const padY = 32;
    const availW = Math.max(100, cssW - padX * 2);
    const availH = Math.max(100, cssH - padY * 2);
    const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
    const panX = cssW / 2 - ((minX + maxX) / 2) * scale;
    const panY = cssH / 2 + ((minY + maxY) / 2) * scale;

    const toScr = (x, elev) => ({
        x: panX + x * scale,
        y: panY - elev * scale
    });

    const drawLine = (p1, p2, color = '#64748b', width = 1.2, dash = []) => {
        const s1 = toScr(p1.x, p1.elev);
        const s2 = toScr(p2.x, p2.elev);
        c.save();
        c.beginPath();
        c.setLineDash(dash);
        c.moveTo(s1.x, s1.y);
        c.lineTo(s2.x, s2.y);
        c.strokeStyle = color;
        c.lineWidth = width;
        c.stroke();
        c.restore();
    };

    const fillPoly = (pts, fillColor, strokeColor = '', strokeW = 1) => {
        if (!pts || pts.length < 3) return;
        c.save();
        c.beginPath();
        const s0 = toScr(pts[0].x, pts[0].elev);
        c.moveTo(s0.x, s0.y);
        for (let i = 1; i < pts.length; i++) {
            const s = toScr(pts[i].x, pts[i].elev);
            c.lineTo(s.x, s.y);
        }
        c.closePath();
        c.fillStyle = fillColor;
        c.fill();
        if (strokeColor) {
            c.strokeStyle = strokeColor;
            c.lineWidth = strokeW;
            c.stroke();
        }
        c.restore();
    };

    // Enhanced Area Pill positioned below trench with leader line
    const drawAreaPill = (pts, text, textColor = '#ffffff', bgColor = '#0f172a', borderColor = '#38bdf8', customX = null, customY = null, drawLeaderFrom = null) => {
        if (!pts || pts.length < 3) return;
        let cx = 0, cy = 0;
        if (customX !== null && customY !== null) {
            cx = customX;
            cy = customY;
        } else {
            for (const p of pts) { cx += p.x; cy += p.elev; }
            cx /= pts.length; cy /= pts.length;
        }
        const s = toScr(cx, cy);

        // Optional leader line from feature to badge
        if (drawLeaderFrom) {
            const sLeader = toScr(drawLeaderFrom.x, drawLeaderFrom.elev);
            c.save();
            c.strokeStyle = borderColor;
            c.lineWidth = 1.2;
            c.setLineDash([3, 2]);
            c.beginPath();
            c.moveTo(sLeader.x, sLeader.y);
            c.lineTo(s.x, s.y - 12);
            c.stroke();
            c.restore();
        }

        c.save();
        c.font = 'bold 11px "Sarabun", sans-serif';
        const metrics = c.measureText(text);
        const w = Math.ceil(metrics.width) + 16;
        const h = 22;
        const rx = Math.round(s.x);
        const ry = Math.round(s.y);

        c.fillStyle = bgColor;
        c.strokeStyle = borderColor;
        c.lineWidth = 1.5;
        c.beginPath();
        c?.roundRect?.(rx - w / 2, ry - h / 2, w, h, 6);
        c.fill();
        c.stroke();

        c.fillStyle = textColor;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, rx, ry + 0.5);
        c.restore();
    };

    // Smart Node Labeling with directional placement to prevent any collisions
    const drawNode = (p, label, color = '#15803d', pos = 'top') => {
        if (!p) return;
        const s = toScr(p.x, p.elev);
        c.save();
        c.beginPath();
        c.arc(s.x, s.y, 4, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
        c.strokeStyle = '#0f172a';
        c.lineWidth = 1.4;
        c.stroke();

        c.font = 'bold 11px "Sarabun", sans-serif';
        c.fillStyle = color;

        let tx = s.x;
        let ty = s.y;
        if (pos === 'top-left') {
            c.textAlign = 'right';
            c.textBaseline = 'bottom';
            tx -= 6; ty -= 4;
        } else if (pos === 'bottom-left') {
            c.textAlign = 'right';
            c.textBaseline = 'top';
            tx -= 6; ty += 4;
        } else if (pos === 'top-right') {
            c.textAlign = 'left';
            c.textBaseline = 'bottom';
            tx += 6; ty -= 4;
        } else if (pos === 'bottom-right') {
            c.textAlign = 'left';
            c.textBaseline = 'top';
            tx += 6; ty += 4;
        } else if (pos === 'bottom') {
            c.textAlign = 'center';
            c.textBaseline = 'top';
            ty += 6;
        } else { // 'top'
            c.textAlign = 'center';
            c.textBaseline = 'bottom';
            ty -= 6;
        }
        c.fillText(label, tx, ty);
        c.restore();
    };

    // 2. Base Earth & Base Ditch on White Background
    fillPoly(sec.polys.fullEarthPoly, '#0f172a', '#cbd5e1', 1);

    // Subbase & Concrete default
    if (sec.params.ts > 0) {
        fillPoly(sec.polys.subbasePts, '#f1f5f9', '#94a3b8', 1);
    }
    fillPoly(sec.polys.concretePts, '#1e293b', '#64748b', 1.2);

    // 3. Highlight requested category & place Area Badges DOWN below trench (per User Request 4)
    const pillBottomY = sec.elevs.ELEV_BOTTOM_OUTLINE + 0.10;

    if (categoryKey === 'overview') {
        if (sec.areas.stripping > 0) fillPoly(sec.polys.polyStripping, 'rgba(245, 158, 11, 0.4)', '#d97706', 1.5);
        if (sec.areas.compacted > 0) fillPoly(sec.polys.polyCompacted, 'rgba(20, 184, 166, 0.4)', '#0d9488', 1.5);
        if (sec.areas.excavation > 0) fillPoly(sec.polys.polyExcavation, 'rgba(249, 115, 22, 0.4)', '#ea580c', 1.5);
        fillPoly(sec.polys.polyManualLeft, 'rgba(168, 85, 247, 0.4)', '#9333ea', 1.5);
        fillPoly(sec.polys.polyManualRight, 'rgba(168, 85, 247, 0.4)', '#9333ea', 1.5);
        if (sec.params.ts > 0) fillPoly(sec.polys.subbasePts, 'rgba(125, 211, 252, 0.55)', '#0284c7', 1.2);
        fillPoly(sec.polys.concretePts, 'rgba(56, 189, 248, 0.45)', '#0284c7', 1.8);
    } else if (categoryKey === 'stripping') {
        if (sec.areas.stripping > 0) {
            fillPoly(sec.polys.polyStripping, 'rgba(245, 158, 11, 0.55)', '#d97706', 2.5);
            const leaderY = (sec.params.ngl + sec.elevs.topsoilElev) / 2;
            drawAreaPill(sec.polys.polyStripping, `ขุดลอกหน้าดิน ${sec.areas.stripping.toFixed(3)} m²`, '#ffffff', '#78350f', '#f59e0b', 0, pillBottomY, { x: 0, elev: leaderY });
        }
    } else if (categoryKey === 'compacted') {
        if (sec.areas.compacted > 0) {
            fillPoly(sec.polys.polyCompacted, 'rgba(20, 184, 166, 0.55)', '#0d9488', 2.5);
            const leaderY = (sec.elevs.ELEV_SUBBASE_BOT + sec.elevs.topsoilElev) / 2;
            drawAreaPill(sec.polys.polyCompacted, `ดินถมบดอัดแน่น 85% ${sec.areas.compacted.toFixed(3)} m²`, '#ffffff', '#134e4a', '#14b8a6', 0, pillBottomY, { x: 0, elev: leaderY });
        }
    } else if (categoryKey === 'excavation') {
        if (sec.areas.excavation > 0) {
            fillPoly(sec.polys.polyExcavation, 'rgba(249, 115, 22, 0.55)', '#ea580c', 2.5);
            const leaderY = (sec.elevs.topsoilElev + sec.elevs.ELEV_SUBBASE_BOT) / 2;
            drawAreaPill(sec.polys.polyExcavation, `ดินขุด ${sec.areas.excavation.toFixed(3)} m²`, '#ffffff', '#7c2d12', '#f97316', 0, pillBottomY, { x: 0, elev: leaderY });
        }
    } else if (categoryKey === 'manual') {
        fillPoly(sec.polys.polyManualLeft, 'rgba(168, 85, 247, 0.55)', '#9333ea', 2);
        fillPoly(sec.polys.polyManualRight, 'rgba(168, 85, 247, 0.55)', '#9333ea', 2);
        // Move both left and right berm badges down below trench with leader lines (per Screenshot 230203.png)
        const leftBermX = -Math.max(sec.xs.X_BERM_LEFT * 0.95, 0.95);
        const rightBermX = Math.max(sec.xs.X_BERM_RIGHT * 0.95, 0.95);
        const bermLeaderY = (sec.elevs.ELEV_TOP_RIM + sec.elevs.ELEV_SUBBASE_BOT) / 2;
        drawAreaPill(sec.polys.polyManualLeft, `ถมแรงคน(ซ้าย) ${sec.areas.manualLeft.toFixed(3)} m²`, '#ffffff', '#581c87', '#a855f7', leftBermX, pillBottomY, { x: -sec.xs.X_BERM_LEFT * 0.65, elev: bermLeaderY });
        drawAreaPill(sec.polys.polyManualRight, `ถมแรงคน(ขวา) ${sec.areas.manualRight.toFixed(3)} m²`, '#ffffff', '#581c87', '#a855f7', rightBermX, pillBottomY, { x: sec.xs.X_BERM_RIGHT * 0.65, elev: bermLeaderY });
    } else if (categoryKey === 'concrete') {
        fillPoly(sec.polys.concretePts, 'rgba(56, 189, 248, 0.6)', '#0284c7', 2.5);
        // Move concrete badge down below trench with leader line (per Screenshot 230059.png)
        drawAreaPill(sec.polys.concretePts, `คอนกรีต U-Shape ${sec.areas.concrete.toFixed(3)} m²`, '#ffffff', '#0c4a6e', '#38bdf8', 0, pillBottomY, { x: 0, elev: sec.elevs.ELEV_CANAL_INVERT - sec.params.tb / 2 });
    } else if (categoryKey === 'subbase') {
        if (sec.params.ts > 0) {
            fillPoly(sec.polys.subbasePts, 'rgba(125, 211, 252, 0.75)', '#0369a1', 2.5);
            drawAreaPill(sec.polys.subbasePts, `คอนกรีตหยาบ ${sec.areas.subbase.toFixed(3)} m²`, '#ffffff', '#075985', '#7dd3fc', 0, pillBottomY, { x: 0, elev: sec.elevs.ELEV_SUBBASE_BOT + sec.params.ts / 2 });
        }
    }

    // 4. Engineering Construction Lines (High-contrast for white paper)
    const { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14 } = sec.nodes;
    const { ELEV_CANAL_INVERT, ELEV_SUBBASE_BOT, ELEV_TOP_RIM } = sec.elevs;
    const ngl = sec.params.ngl;

    // Design slope lines
    drawLine(p4, p5, '#a16207', 2);
    drawLine(p11, p10, '#a16207', 2);
    drawLine(p5, p6, '#a16207', 2);
    drawLine(p10, p9, '#a16207', 2);

    drawLine(p3, p2, '#dc2626', 2);
    drawLine(p12, p13, '#dc2626', 2);
    if (p1) drawLine(p2, p1, '#dc2626', 2);
    if (p14) drawLine(p13, p14, '#dc2626', 2);

    // NGL Line in Green - extended cleanly to the sides
    const nglLeft = p1 ? p1 : p6;
    const nglRight = p14 ? p14 : p9;
    drawLine({ x: -groundExtraLeft, elev: ngl }, { x: nglLeft.x, elev: ngl }, '#15803d', 2.5);
    drawLine(nglLeft, nglRight, '#15803d', 2, [5, 4]);
    drawLine({ x: nglRight.x, elev: ngl }, { x: groundExtraRight, elev: ngl }, '#15803d', 2.5);

    // NGL & BL Labels positioned together on the right with identical vertical start alignment (per user request)
    const sNglRight = toScr(groundExtraRight, ngl);
    const labelStartX = Math.round(toScr(sec.xs.outerGroundXRight + 0.35, ngl).x);
    const sNglY = Math.round(sNglRight.y);

    // NGL Label (sitting directly on green ground line, left-aligned at labelStartX)
    c.save();
    c.font = 'bold 11px "Sarabun", sans-serif';
    c.fillStyle = '#15803d';
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillText(`NGL (+${roundElev(ngl).toFixed(2)} m)`, labelStartX, sNglY - 5);
    c.restore();

    // Stripping Line (NGL - dt)
    const topDash = [6, 4];
    drawLine({ x: p6.x, elev: ngl }, p7, '#b45309', 1.8, topDash);
    drawLine({ x: p9.x, elev: ngl }, p8, '#b45309', 1.8, topDash);
    drawLine(p7, p8, '#b45309', 1.8, topDash);

    // Centerline CL
    const clMaxY = Math.max(ngl, ELEV_TOP_RIM) + 0.35;
    drawLine({ x: 0, elev: ELEV_SUBBASE_BOT - 0.4 }, { x: 0, elev: clMaxY }, '#dc2626', 1.5, [6, 4]);
    const sCL = toScr(0, clMaxY);
    c.save();
    c.font = 'bold 11px "Sarabun", sans-serif';
    c.fillStyle = '#dc2626';
    c.textAlign = 'center';
    c.fillText('CL คูส่งน้ำ', sCL.x, sCL.y - 5);
    c.restore();

    // 5. Draw ONLY Relevant Nodes according to category with distinct directional offsets
    const nodePosMap = {
        p1: 'top-left', p2: 'top', p3: 'top-left', p4: 'bottom-left',
        p5: 'top-left', p6: 'bottom-left', p7: 'bottom-left',
        p8: 'bottom-right', p9: 'bottom-right', p10: 'top-right',
        p11: 'bottom-right', p12: 'top-right', p13: 'top', p14: 'top-right'
    };
    const parseNodeNumsFromStr = (s) => {
        if (!s || s === '-') return [];
        return String(s).split('-').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 14);
    };
    let activeNodeNums = [];
    if (categoryKey === 'overview') {
        activeNodeNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    } else if (categoryKey === 'stripping') {
        activeNodeNums = sec.areas.stripping > 0 ? parseNodeNumsFromStr(sec.nodeLabels.nodesStrippingStr) : [];
    } else if (categoryKey === 'compacted') {
        activeNodeNums = sec.areas.compacted > 0 ? parseNodeNumsFromStr(sec.nodeLabels.nodesCompactedStr) : [];
    } else if (categoryKey === 'excavation') {
        activeNodeNums = sec.areas.excavation > 0 ? parseNodeNumsFromStr(sec.nodeLabels.nodesExcavationStr) : [];
    } else if (categoryKey === 'manual') {
        const lNums = sec.areas.manualLeft > 0 ? parseNodeNumsFromStr(sec.nodeLabels.nodesManualLeftStr) : [];
        const rNums = sec.areas.manualRight > 0 ? parseNodeNumsFromStr(sec.nodeLabels.nodesManualRightStr) : [];
        activeNodeNums = Array.from(new Set([...lNums, ...rNums]));
    } else if (categoryKey === 'concrete') {
        activeNodeNums = [3, 4, 11, 12];
    } else if (categoryKey === 'subbase') {
        activeNodeNums = sec.areas.subbase > 0 ? [4, 11] : [];
    }

    activeNodeNums.forEach(num => {
        const k = `p${num}`;
        if (sec.nodes[k]) {
            const col = (num === 7 || num === 8) ? '#b45309' : '#15803d';
            drawNode(sec.nodes[k], String(num), col, nodePosMap[k] || 'top');
        }
    });

    // 6. BL. Label - placed cleanly ABOVE NGL on the right with identical vertical start alignment (per user request & Screenshot 232341.png)
    const blY = sNglY - 32; // vertically above NGL
    const blText = `BL. +${roundElev(ELEV_CANAL_INVERT).toFixed(2)} m`;
    c.save();
    c.font = 'bold 11px "Sarabun", sans-serif';
    const blMetrics = c.measureText(blText);
    const blW = Math.ceil(blMetrics.width) + 14;
    const blH = 20;

    // Leader line from canal bed (BL) sloping up to the left of the BL pill badge
    const blPt = toScr(sec.xs.X_INNER_WALL * 0.45, ELEV_CANAL_INVERT);
    c.strokeStyle = '#0284c7';
    c.lineWidth = 1.2;
    c.setLineDash([3, 2]);
    c.beginPath();
    c.moveTo(blPt.x, blPt.y);
    c.lineTo(labelStartX - 4, blY);
    c.stroke();
    c.setLineDash([]);

    // BL Pill badge starting at labelStartX (identical vertical X alignment as NGL)
    c.fillStyle = '#f0f9ff';
    c.strokeStyle = '#0284c7';
    c.lineWidth = 1.2;
    c.beginPath();
    c?.roundRect?.(labelStartX, blY - blH / 2, blW, blH, 4);
    c.fill();
    c.stroke();

    c.fillStyle = '#0369a1';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(blText, labelStartX + 7, blY + 0.5);
    c.restore();

    return off.toDataURL('image/png');
}

function formatPolygonCalculationSteps(pts, nodeLabels) {
    if (!pts || pts.length < 3) {
        return {
            tableRows: [],
            forwardTerms: [],
            backwardTerms: [],
            sumForward: 0,
            sumBackward: 0,
            diff: 0,
            area: 0
        };
    }
    const n = pts.length;
    let sumForward = 0;
    let sumBackward = 0;
    const tableRows = [];
    const forwardTerms = [];
    const backwardTerms = [];

    for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        // ใช้ตัวเลขที่ปัดเศษแล้วเหมือนกับ calcPolygonArea() เพื่อให้ตารางพิกัด
        // ที่ผู้ใช้เห็น นำไปกดเครื่องคิดเลขแล้วได้ผลตรงกับพื้นที่ที่รายงาน
        const x1 = roundLen(p1.x), y1 = roundElev(p1.elev);
        const x2 = roundLen(p2.x), y2 = roundElev(p2.elev);
        const fwd = roundArea(x1 * y2);
        const bwd = roundArea(x2 * y1);
        sumForward = roundArea(sumForward + fwd);
        sumBackward = roundArea(sumBackward + bwd);
        const name = (nodeLabels && nodeLabels[i]) ? nodeLabels[i] : `Node ${i + 1}`;
        tableRows.push({
            node: name,
            x: x1,
            y: y1,
            fwd,
            bwd
        });
        forwardTerms.push(`${x1.toFixed(2)} × ${y2.toFixed(2)}`);
        backwardTerms.push(`${x2.toFixed(2)} × ${y1.toFixed(2)}`);
    }
    const diff = roundArea(Math.abs(sumForward - sumBackward));
    const area = roundArea(diff / 2);
    return {
        tableRows,
        forwardTerms,
        backwardTerms,
        sumForward,
        sumBackward,
        diff,
        area
    };
}

function generateCalculationReport(sec) {
    const container = document.getElementById('calcReportDocument');
    if (!container) return;

    // Render high-res diagrams on white backgrounds
    const imgOverview = renderCalcDiagramWhiteBg(sec, 'overview', 760, 320);
    const imgStripping = renderCalcDiagramWhiteBg(sec, 'stripping', 760, 310);
    const imgCompacted = renderCalcDiagramWhiteBg(sec, 'compacted', 760, 310);
    const imgExcavation = renderCalcDiagramWhiteBg(sec, 'excavation', 760, 310);
    const imgManual = renderCalcDiagramWhiteBg(sec, 'manual', 760, 310);
    const imgConcrete = renderCalcDiagramWhiteBg(sec, 'concrete', 760, 310);
    const imgSubbase = renderCalcDiagramWhiteBg(sec, 'subbase', 760, 310);

    // Compute step-by-step polygon coordinates
    const stripLabels = (sec.nodeLabels.nodesStrippingStr || '6-7-8-9').split('-').filter(Boolean);
    const calcStrip = formatPolygonCalculationSteps(sec.polys.polyStripping, stripLabels);

    const compLabels = (sec.nodeLabels.nodesCompactedStr || '5-6-7-8-9-10').split('-').filter(Boolean);
    const calcComp = formatPolygonCalculationSteps(sec.polys.polyCompacted, compLabels);

    const excLabels = (sec.nodeLabels.nodesExcavationStr || '5-7-8-10').split('-').filter(Boolean);
    const calcExc = formatPolygonCalculationSteps(sec.polys.polyExcavation, excLabels);

    const manLeftLabels = (sec.nodeLabels.nodesManualLeftStr || '1-2-3-4-5-6').split('-').filter(Boolean);
    const calcManLeft = formatPolygonCalculationSteps(sec.polys.polyManualLeft, manLeftLabels);

    const manRightLabels = (sec.nodeLabels.nodesManualRightStr || '9-10-11-12-13-14').split('-').filter(Boolean);
    const calcManRight = formatPolygonCalculationSteps(sec.polys.polyManualRight, manRightLabels);

    // Concrete geometric math
    const b = sec.params.B;
    const h = sec.params.H;
    const tw = sec.params.tw;
    const tb = sec.params.tb;
    const ts = sec.params.ts;
    const outerW = roundLen(b + 2 * tw);
    const outerH = roundLen(h + tb);
    const grossArea = roundArea(outerW * outerH);
    const innerArea = roundArea(b * h);
    const netConcrete = roundArea(grossArea - innerArea);
    const subbaseArea = roundArea(outerW * ts);

    const canalName = (sec.canalName && sec.canalName !== '1L-RMC') ? sec.canalName : (sec.canalName || '-');
    const subCanalName = (sec.subCanalName && sec.subCanalName !== 'คูส่งน้ำสาย 1') ? sec.subCanalName : (sec.subCanalName || '-');
    const stationStr = (sec.stationFormatted && sec.stationFormatted !== '0+000' && sec.stationFormatted !== 'กม. 0+000') ? sec.stationFormatted : (sec.stationFormatted || '-');

    let html = `
        <!-- 1. Document Header -->
        <div class="text-center border-b-2 border-slate-900 pb-4 space-y-1 bg-white" style="background-color: #ffffff;">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900 text-center" style="line-height: 1.5; margin: 0 0 6px 0; padding: 0;">
                รายการคำนวณพื้นที่และปริมาณงาน<br>
                รูปตัดคูส่งน้ำคอนกรีตกรณี U-SHAPE
            </h1>
            <div class="text-xs sm:text-sm text-slate-700 font-semibold text-center">
                แบบจำลองรูปตัดคูส่งน้ำพร้อมถอดแบบและคำนวณปริมาณ
            </div>

            <!-- ข้อมูลชื่อคลองส่งน้ำ ชื่อคูส่งน้ำ และ กม. ที่รายงาน (ตามรูป 1 ข้อ 3) -->
            <div style="margin: 8px auto; text-align: center;">
                <div style="display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; background-color: #f1f5f9; border: 1.5px solid #0284c7; border-radius: 8px; padding: 6px 14px; font-size: 12px;">
                    <span>คลองส่งน้ำ: <strong style="color: #0369a1; font-weight: bold;">${canalName}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>คูส่งน้ำ: <strong style="color: #0369a1; font-weight: bold;">${subCanalName}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>ตำแหน่ง: <strong style="color: #0d9488; font-family: monospace; font-size: 13px; font-weight: bold;">${stationStr === '-' ? '-' : `กม. ${stationStr}`}</strong></span>
                </div>
            </div>

            <div class="text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-200 pt-2 mt-2">
                <span>วันที่จัดทำ: ${formatThaiDateTime(new Date())}</span>
                <span>สภาพงานดิน: <strong class="text-blue-700 font-bold">${sec.flags.statusText}</strong></span>
                <span>วิธีคำนวณ: พิกัดจุดยอดรูปหลายเหลี่ยม (Surveyor's Area Formula)</span>
            </div>
        </div>

        <!-- 2. Section 1: Design Parameters & Dimensions (Table format for universal Word/PDF fidelity) -->
        <div class="calc-print-avoid space-y-2 pt-2 bg-white" style="background-color: #ffffff;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                1. สรุปข้อมูลระดับ มิติโครงสร้าง และสมมติฐานการออกแบบ (Design Criteria)
            </h2>
            <table class="w-full text-xs border border-slate-300 rounded-lg" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #f8fafc; margin-top: 8px;">
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ระดับท้องคู (BL.):</span>
                        <strong style="color: #0369a1; font-family: monospace; font-size: 13px;">+${roundElev(sec.params.invert).toFixed(2)} ม.รทก.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ระดับดินเดิม (NGL.):</span>
                        <strong style="color: #15803d; font-family: monospace; font-size: 13px;">+${roundElev(sec.params.ngl).toFixed(2)} ม.รทก.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ระดับหลังคลอง (TBL.):</span>
                        <strong style="color: #be123c; font-family: monospace; font-size: 13px;">+${roundElev(sec.elevs.ELEV_TOP_RIM).toFixed(2)} ม.รทก.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ระดับท้องคอนกรีตหยาบ:</span>
                        <strong style="color: #4338ca; font-family: monospace; font-size: 13px;">+${roundElev(sec.elevs.ELEV_SUBBASE_BOT).toFixed(2)} ม.รทก.</strong>
                    </td>
                </tr>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ก้นคลองใน (B):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">${b.toFixed(2)} ม.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ความลึกใน (H):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">${h.toFixed(2)} ม.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">คันคลองซ้าย/ขวา (TBL/TBR):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">${sec.params.TBL.toFixed(2)} / ${sec.params.TBR.toFixed(2)} ม.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">หนากำแพง / พื้น (tw / tb):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">${tw.toFixed(2)} / ${tb.toFixed(2)} ม.</strong>
                    </td>
                </tr>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">หนาคอนกรีตหยาบ (ts):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">${ts.toFixed(2)} ม.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">หนาลอกหน้าดิน (dt):</span>
                        <strong style="color: #b45309; font-family: monospace; font-size: 13px;">${sec.params.dt.toFixed(2)} ม.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ระดับลอกหน้าดิน:</span>
                        <strong style="color: #b45309; font-family: monospace; font-size: 13px;">+${roundElev(sec.elevs.topsoilElev).toFixed(2)} ม.รทก.</strong>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 25%; background-color: #f8fafc;">
                        <span style="color: #64748b; font-size: 11px; display: block;">ชานพักข้างคู (Bottom Step):</span>
                        <strong style="color: #1e293b; font-family: monospace; font-size: 13px;">0.30 ม. (ความลาด 1:1)</strong>
                    </td>
                </tr>
            </table>

            <!-- Overview Diagram -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background-color: #ffffff; margin: 12px auto;">
                <img src="${imgOverview}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #e2e8f0;" alt="รูปตัดขวางรวมคูส่งน้ำคอนกรีต">
                <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 600;">
                    รูปที่ 1: แผนภาพรวมรูปตัดขวางคูส่งน้ำคอนกรีตกรณี U-SHAPE อัตราส่วนสมจริง 1:1 แสดงทุกชั้นดินและโครงสร้าง
                </p>
            </div>
        </div>

        <!-- 3. Section 2: Area Summary Table -->
        <div class="calc-print-avoid space-y-2 pt-2 bg-white" style="background-color: #ffffff;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                2. ตารางสรุปผลการคำนวณพื้นที่รูปตัดขวาง (Cross-Section Area Summary)
            </h2>
            <table class="w-full text-left border-collapse border border-slate-300 text-xs bg-white" style="width: 100%; border-collapse: collapse; border: 1.5px solid #94a3b8; background-color: #ffffff;">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 45px;">ลำดับ</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">หมวดงานดิน / งานโครงสร้าง</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">จุด Node อ้างอิง</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">พื้นที่คำนวณได้ (ตร.ม. / m²)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">หมายเหตุและเงื่อนไข</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">1</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #92400e;">งานขุดลอกหน้าดิน (Stripping)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodeLabels.nodesStrippingStr}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #b45309; font-size: 13px;">${sec.areas.stripping.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">ลอกหน้าดินเดิมหนา dt = ${sec.params.dt.toFixed(2)} ม.</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">2</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #115e59;">งานดินถมบดอัดแน่น 85% (Compacted Fill)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodeLabels.nodesCompactedStr}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #0f766e; font-size: 13px;">${sec.areas.compacted.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">${sec.areas.compacted > 0 ? 'ดินถมบดอัดใต้ท้องคูรองรับโครงสร้าง' : 'ไม่มีงานถมใต้คู (NGL สูงกว่าท้องคู)'}</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">3</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #9a3412;">งานดินขุด (Excavation)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodeLabels.nodesExcavationStr}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #c2410c; font-size: 13px;">${sec.areas.excavation.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">${sec.areas.excavation > 0 ? 'ขุดเปิดร่องคลองและชานพักข้างคู' : 'สภาพพื้นที่เป็นงานถมสูงทั้งช่วง'}</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">4</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #6b21a8;">งานดินถมด้วยแรงคน (ซ้าย)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodeLabels.nodesManualLeftStr}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #7e22ce; font-size: 13px;">${sec.areas.manualLeft.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">ถมกระทุ้งแน่นข้างผนังคูฝั่งซ้าย</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">5</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #6b21a8;">งานดินถมด้วยแรงคน (ขวา)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodeLabels.nodesManualRightStr}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #7e22ce; font-size: 13px;">${sec.areas.manualRight.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">ถมกระทุ้งแน่นข้างผนังคูฝั่งขวา</td>
                    </tr>
                    <tr style="background-color: #faf5ff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #581c87;">รวมงานดินถมด้วยแรงคน (ซ้าย + ขวา)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; color: #94a3b8;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #581c87; font-size: 13px;">${sec.areas.manualTotal.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #6b21a8; font-weight: 500;">ผลรวมปริมาตรดินถมข้างผนังคูทั้งสองฝั่ง</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">6</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0369a1;">งานโครงสร้างคอนกรีตคูส่งน้ำ (Concrete)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">U-Shape</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #0284c7; font-size: 13px;">${sec.areas.concrete.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">[(B+2tw)×(H+tb)] - (B×H)</td>
                    </tr>
                    <tr style="background-color: #ffffff;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">7</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0369a1;">งานคอนกรีตหยาบรองพื้น (Lean Concrete)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">4-11</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #0284c7; font-size: 13px;">${sec.areas.subbase.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #475569;">(B+2tw) × ts หนา ${ts.toFixed(2)} ม.</td>
                    </tr>
                    <tr style="background-color: #fdf2f8;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #831843;">ความกว้างขุดลอกหน้าดิน (Node 6-9)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">6-9</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #be185d; font-size: 13px;">${roundLen(sec.widths.width69).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #9d174d; font-weight: 500;">ความกว้างผิวดินเดิมที่ต้องขุดลอกจริง</td>
                    </tr>
                    <tr style="background-color: #fff1f2;">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: bold;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #881337;">ความกว้างคันดินด้านล่าง (Node 1-14)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace;">${sec.nodes.p1 ? '1-14' : '2-13'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #e11d48; font-size: 13px;">${roundLen(sec.widths.width114).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #9f1239; font-weight: 500;">ความกว้างฐานดินล่างสุดรวมคันดิน</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 4. Section 3: Detailed Calculations with Formulations & Individual White-Background Drawings -->
        <!-- Starts cleanly on Page 2 with page-break-before: always; to avoid orphan headings (User Request 5) -->
        <div class="space-y-6 pt-3 bg-white calc-print-break" style="background-color: #ffffff; page-break-before: always; break-before: page;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                3. รายการคำนวณแบบละเอียดแยกตามรายการพื้นที่ พร้อมรูปประกอบ (Detailed Calculations)
            </h2>

            <!-- 3.1 ขุดลอกหน้าดิน -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #78350f; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #f59e0b; display: inline-block;"></span>
                        รายการที่ 1: การคำนวณพื้นที่ขุดลอกหน้าดิน (Topsoil Stripping Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #fef3c7; color: #78350f; padding: 3px 8px; border-radius: 4px; border: 1px solid #fcd34d;">
                        พื้นที่ = ${sec.areas.stripping.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>วัตถุประสงค์และข้อกำหนด:</strong> ขุดลอกชั้นหน้าดินเดิมที่มีวัชพืช หญ้า และฮิวมัส ความหนา dt = ${sec.params.dt.toFixed(2)} ม. ออกจากแนวก่อสร้างคูส่งน้ำ โดยมีแนวเส้นขอบรอบรูปหลายเหลี่ยมตามจุด Node: <strong>${sec.nodeLabels.nodesStrippingStr}</strong>
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgStripping}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปพื้นที่ขุดลอกหน้าดิน">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 2: พื้นที่ขุดลอกหน้าดิน (Node ${sec.nodeLabels.nodesStrippingStr}) ไฮไลต์สีทอง พื้นหลังสีขาว</p>
                </div>

                <!-- Coordinate Table -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #ffffff; margin: 10px 0; font-size: 11px; text-align: center;">
                    <thead style="background-color: #fef3c7; color: #78350f; font-weight: bold;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">จุด Node</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด X (เมตร)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด Y / ระดับ (ม.รทก.)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ลง: (Xi × Yi+1)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ขึ้น: (Xi+1 × Yi)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${calcStrip.tableRows.map(r => `
                            <tr style="background-color: #ffffff;">
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold; color: #78350f;">Node ${r.node}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${r.x.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">+${r.y.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.fwd.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.bwd.toFixed(3)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background-color: #fef3c7; font-weight: bold;">
                            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; color: #78350f;">ผลรวมการคูณไขว้ (Sum):</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #78350f;">${calcStrip.sumForward.toFixed(3)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #78350f;">${calcStrip.sumBackward.toFixed(3)}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="background-color: #fefce8; border: 1px solid #fef08a; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #78350f; line-height: 1.6;">
                    <div>ผลต่างการคูณไขว้ 2A = |${calcStrip.sumForward.toFixed(3)} - (${calcStrip.sumBackward.toFixed(3)})| = ${calcStrip.diff.toFixed(3)}</div>
                    <div style="font-weight: bold; font-size: 12px; margin-top: 4px;">พื้นที่ขุดลอกหน้าดิน (A) = 2A / 2 = ${calcStrip.diff.toFixed(3)} / 2 = <u>${sec.areas.stripping.toFixed(3)} ตร.ม.</u></div>
                </div>
            </div>

            <!-- 3.2 ดินถมบดอัดแน่น 85% -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d9488; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #134e4a; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #0d9488; display: inline-block;"></span>
                        รายการที่ 2: การคำนวณพื้นที่ดินถมบดอัดแน่น 85% (Compacted Fill 85% Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #ccfbf1; color: #134e4a; padding: 3px 8px; border-radius: 4px; border: 1px solid #5eead4;">
                        พื้นที่ = ${sec.areas.compacted.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>เงื่อนไขทางวิศวกรรม:</strong> ดินถมบดอัดแน่นมาตรฐาน 85% Standard Proctor ใต้ระดับท้องคอนกรีตหยาบ (BL - tb - ts = +${sec.elevs.ELEV_SUBBASE_BOT.toFixed(2)} ม.) จะเกิดขึ้นเมื่อระดับลอกหน้าดิน (+${sec.elevs.topsoilElev.toFixed(2)} ม.) อยู่ต่ำกว่าระดับท้องรองพื้น
                    ${sec.areas.compacted > 0 ? `ซึ่งในกรณีนี้ระดับลอกหน้าดินต่ำกว่า จึงต้องทำการถมดินบดอัดแน่นรองรับโครงสร้าง ตามจุด Node: <strong>${sec.nodeLabels.nodesCompactedStr}</strong>` : 'ซึ่งในกรณีนี้ระดับลอกหน้าดินอยู่สูงกว่าท้องรองพื้น สภาพเป็นงานขุด ดินเดิมมีความแน่นตามธรรมชาติรองรับโครงสร้างได้ จึงไม่มีงานดินถมบดอัดแน่นใต้ท้องคู (พื้นที่ = 0.000 ตร.ม.)'}
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgCompacted}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปพื้นที่ดินถมบดอัดแน่น">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 3: พื้นที่ดินถมบดอัดแน่น 85% (${sec.nodeLabels.nodesCompactedStr}) ไฮไลต์สีเขียวอมฟ้า พื้นหลังสีขาว</p>
                </div>

                ${sec.areas.compacted > 0 ? `
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #ffffff; margin: 10px 0; font-size: 11px; text-align: center;">
                    <thead style="background-color: #ccfbf1; color: #134e4a; font-weight: bold;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">จุด Node</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด X (เมตร)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด Y / ระดับ (ม.รทก.)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ลง: (Xi × Yi+1)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ขึ้น: (Xi+1 × Yi)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${calcComp.tableRows.map(r => `
                            <tr style="background-color: #ffffff;">
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold; color: #134e4a;">Node ${r.node}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${r.x.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">+${r.y.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.fwd.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.bwd.toFixed(3)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background-color: #ccfbf1; font-weight: bold;">
                            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; color: #134e4a;">ผลรวมการคูณไขว้ (Sum):</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #134e4a;">${calcComp.sumForward.toFixed(3)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #134e4a;">${calcComp.sumBackward.toFixed(3)}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-left: 4px solid #0d9488; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #134e4a; line-height: 1.6;">
                    <div>ผลต่างการคูณไขว้ 2A = |${calcComp.sumForward.toFixed(3)} - (${calcComp.sumBackward.toFixed(3)})| = ${calcComp.diff.toFixed(3)}</div>
                    <div style="font-weight: bold; font-size: 12px; margin-top: 4px;">พื้นที่ดินถมบดอัดแน่น 85% (A) = 2A / 2 = ${calcComp.diff.toFixed(3)} / 2 = <u>${sec.areas.compacted.toFixed(3)} ตร.ม.</u></div>
                </div>
                ` : `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #64748b; font-style: italic;">
                    * ไม่มีรายการคำนวณพิกัดคูณไขว้เนื่องจากค่าพื้นที่เป็น 0.000 ตร.ม. (NGL - dt > ท้องรองพื้น)
                </div>
                `}
            </div>

            <!-- 3.3 ดินขุด -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #7c2d12; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #ea580c; display: inline-block;"></span>
                        รายการที่ 3: การคำนวณพื้นที่ดินขุด (Canal Trench Excavation Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #ffedd5; color: #7c2d12; padding: 3px 8px; border-radius: 4px; border: 1px solid #fed7aa;">
                        พื้นที่ = ${sec.areas.excavation.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>เงื่อนไขทางวิศวกรรม:</strong> งานดินขุดเปิดร่องคลองและชานพักข้างคูส่งน้ำ จะเกิดขึ้นเมื่อระดับผิวดินเดิม (+${sec.params.ngl.toFixed(2)} ม.) อยู่สูงกว่าระดับท้องคอนกรีตหยาบ (+${sec.elevs.ELEV_SUBBASE_BOT.toFixed(2)} ม.)
                    ${sec.areas.excavation > 0 ? `ขุดเปิดร่องคลองตามแนวจุด Node: <strong>${sec.nodeLabels.nodesExcavationStr}</strong>` : 'ซึ่งในกรณีนี้ผิวดินเดิมอยู่ต่ำกว่าท้องรองพื้น สภาพพื้นที่เป็นงานถมสูงทั้งช่วง จึงไม่มีงานดินขุดเปิดร่องคลอง (พื้นที่ดินขุด = 0.000 ตร.ม.)'}
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgExcavation}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปพื้นที่ดินขุด">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 4: พื้นที่ดินขุด (${sec.nodeLabels.nodesExcavationStr}) ไฮไลต์สีส้ม พื้นหลังสีขาว</p>
                </div>

                ${sec.areas.excavation > 0 ? `
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #ffffff; margin: 10px 0; font-size: 11px; text-align: center;">
                    <thead style="background-color: #ffedd5; color: #7c2d12; font-weight: bold;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">จุด Node</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด X (เมตร)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">พิกัด Y / ระดับ (ม.รทก.)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ลง: (Xi × Yi+1)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">คูณไขว้ขึ้น: (Xi+1 × Yi)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${calcExc.tableRows.map(r => `
                            <tr style="background-color: #ffffff;">
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold; color: #7c2d12;">Node ${r.node}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${r.x.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">+${r.y.toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.fwd.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; color: #334155;">${r.bwd.toFixed(3)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background-color: #ffedd5; font-weight: bold;">
                            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; color: #7c2d12;">ผลรวมการคูณไขว้ (Sum):</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #7c2d12;">${calcExc.sumForward.toFixed(3)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; color: #7c2d12;">${calcExc.sumBackward.toFixed(3)}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #7c2d12; line-height: 1.6;">
                    <div>ผลต่างการคูณไขว้ 2A = |${calcExc.sumForward.toFixed(3)} - (${calcExc.sumBackward.toFixed(3)})| = ${calcExc.diff.toFixed(3)}</div>
                    <div style="font-weight: bold; font-size: 12px; margin-top: 4px;">พื้นที่ดินขุด (A) = 2A / 2 = ${calcExc.diff.toFixed(3)} / 2 = <u>${sec.areas.excavation.toFixed(3)} ตร.ม.</u></div>
                </div>
                ` : `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #64748b; font-style: italic;">
                    * ไม่มีรายการคำนวณพิกัดคูณไขว้เนื่องจากค่าพื้นที่เป็น 0.000 ตร.ม. (สภาพงานถมสูงทั้งช่วง)
                </div>
                `}
            </div>

            <!-- 3.4 ดินถมด้วยแรงคน (ขึ้นหน้าใหม่แยกเป็นอีกหน้าหนึ่ง ตามรูป 2) -->
            <div class="calc-print-break calc-print-avoid" style="page-break-before: always; break-before: page; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #9333ea; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #581c87; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #9333ea; display: inline-block;"></span>
                        รายการที่ 4: การคำนวณพื้นที่ดินถมด้วยแรงคน (Manual Backfill Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #f3e8ff; color: #581c87; padding: 3px 8px; border-radius: 4px; border: 1px solid #d8b4fe;">
                        รวมทั้งสองฝั่ง = ${sec.areas.manualTotal.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>วัตถุประสงค์:</strong> ถมดินและกระทุ้งแน่นด้วยแรงคนบริเวณข้างผนังคูส่งน้ำคอนกรีตทั้งสองฝั่ง จากระดับชานพักข้างคู (0.30 ม.) ขึ้นไปถึงระดับหลังคันคลอง (TBL)
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgManual}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปพื้นที่ดินถมด้วยแรงคน">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 5: พื้นที่ดินถมด้วยแรงคนข้างผนังคูทั้งสองฝั่ง (ซ้าย ${sec.areas.manualLeft.toFixed(3)} + ขวา ${sec.areas.manualRight.toFixed(3)} m²) ไฮไลต์สีม่วง พื้นหลังสีขาว</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 6px;">
                            <div style="border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px; background-color: #faf5ff;">
                                <div style="font-weight: bold; color: #581c87; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>ฝั่งซ้าย (Left Berm):</span>
                                    <span>${sec.areas.manualLeft.toFixed(3)} ตร.ม.</span>
                                </div>
                                <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">จุด Node: ${sec.nodeLabels.nodesManualLeftStr}</div>
                                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; font-family: monospace; font-size: 11px; color: #581c87;">
                                    2A = ${calcManLeft.diff.toFixed(3)}<br>
                                    A (ซ้าย) = 2A / 2 = <strong>${sec.areas.manualLeft.toFixed(3)} ตร.ม.</strong>
                                </div>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 6px;">
                            <div style="border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px; background-color: #faf5ff;">
                                <div style="font-weight: bold; color: #581c87; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>ฝั่งขวา (Right Berm):</span>
                                    <span>${sec.areas.manualRight.toFixed(3)} ตร.ม.</span>
                                </div>
                                <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">จุด Node: ${sec.nodeLabels.nodesManualRightStr}</div>
                                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; font-family: monospace; font-size: 11px; color: #581c87;">
                                    2A = ${calcManRight.diff.toFixed(3)}<br>
                                    A (ขวา) = 2A / 2 = <strong>${sec.areas.manualRight.toFixed(3)} ตร.ม.</strong>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>

                <div style="background-color: #f3e8ff; border: 1px solid #e9d5ff; border-left: 4px solid #9333ea; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #581c87; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>รวมพื้นที่ดินถมด้วยแรงคน (ซ้าย + ขวา) = ${sec.areas.manualLeft.toFixed(3)} + ${sec.areas.manualRight.toFixed(3)}</span>
                    <span style="font-size: 13px; font-weight: bold; text-decoration: underline;">${sec.areas.manualTotal.toFixed(3)} ตร.ม.</span>
                </div>
            </div>

            <!-- 3.5 โครงสร้างคอนกรีต U-Shape (ขึ้นหน้าใหม่สำหรับรายการที่ 5 และ 6 ตามรูป 2) -->
            <div class="calc-print-break calc-print-avoid" style="page-break-before: always; break-before: page; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #0c4a6e; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #0284c7; display: inline-block;"></span>
                        รายการที่ 5: การคำนวณพื้นที่โครงสร้างคอนกรีตคูส่งน้ำ (Concrete U-Section Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #e0f2fe; color: #0c4a6e; padding: 3px 8px; border-radius: 4px; border: 1px solid #7dd3fc;">
                        พื้นที่ = ${sec.areas.concrete.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>สูตรเรขาคณิตมาตรฐาน:</strong> คำนวณจากพื้นที่สี่เหลี่ยมกรอบนอก ลบด้วยพื้นที่ช่องเปิดภายในคูส่งน้ำ
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgConcrete}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปโครงสร้างคอนกรีตคูส่งน้ำ">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 6: พื้นที่โครงสร้างคอนกรีตคูส่งน้ำรูปตัว U (Concrete U-Ditch) ไฮไลต์สีฟ้า พื้นหลังสีขาว</p>
                </div>

                <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.7;">
                    <div>ความกว้างกรอบนอก = B + (2 × tw) = ${b.toFixed(2)} + (2 × ${tw.toFixed(2)}) = ${outerW.toFixed(2)} ม.</div>
                    <div>ความสูงกรอบนอก = H + tb = ${h.toFixed(2)} + ${tb.toFixed(2)} = ${outerH.toFixed(2)} ม.</div>
                    <div>พื้นที่กรอบนอก (Gross Outer Area) = ${outerW.toFixed(2)} × ${outerH.toFixed(2)} = ${grossArea.toFixed(3)} ตร.ม.</div>
                    <div>พื้นที่ช่องเปิดภายใน (Canal Waterway) = B × H = ${b.toFixed(2)} × ${h.toFixed(2)} = ${innerArea.toFixed(3)} ตร.ม.</div>
                    <div style="border-top: 1px solid #bae6fd; padding-top: 6px; margin-top: 6px; font-weight: bold; font-size: 12px; color: #082f49;">
                        พื้นที่คอนกรีตสุทธิ = ${grossArea.toFixed(3)} - ${innerArea.toFixed(3)} = <u>${sec.areas.concrete.toFixed(3)} ตร.ม.</u>
                    </div>
                </div>
            </div>

            <!-- 3.6 คอนกรีตหยาบรองพื้น -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; background-color: #ffffff; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: bold; color: #0c4a6e; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: #38bdf8; display: inline-block;"></span>
                        รายการที่ 6: การคำนวณพื้นที่คอนกรีตหยาบรองพื้น (Lean Concrete Subbase Area)
                    </h3>
                    <span style="font-size: 12px; font-family: monospace; font-weight: bold; background-color: #e0f2fe; color: #0c4a6e; padding: 3px 8px; border-radius: 4px; border: 1px solid #7dd3fc;">
                        พื้นที่ = ${sec.areas.subbase.toFixed(3)} ตร.ม.
                    </span>
                </div>
                <p style="font-size: 12px; color: #334155; line-height: 1.6; margin: 6px 0;">
                    <strong>สูตรเรขาคณิต:</strong> เทคอนกรีตหยาบรองพื้นใต้ฐานคูส่งน้ำ ความกว้างเท่ากับฐานคู (B + 2 × tw) หนา ts = ${ts.toFixed(2)} ม.
                </p>

                <!-- White Background Diagram -->
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff; margin: 10px auto;">
                    <img src="${imgSubbase}" width="640" style="width: 100%; max-width: 640px; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #cbd5e1;" alt="รูปคอนกรีตหยาบรองพื้น">
                    <p style="font-size: 11px; color: #475569; margin-top: 6px; font-weight: 500;">รูปที่ 7: พื้นที่คอนกรีตหยาบรองพื้น (Lean Concrete) หนา ${ts.toFixed(2)} ม. ไฮไลต์สีฟ้าอ่อน พื้นหลังสีขาว</p>
                </div>

                <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.7;">
                    <div>ความกว้างฐานรองพื้น = B + (2 × tw) = ${outerW.toFixed(2)} ม.</div>
                    <div>ความหนารองพื้น (ts) = ${ts.toFixed(2)} ม.</div>
                    <div style="border-top: 1px solid #bae6fd; padding-top: 6px; margin-top: 6px; font-weight: bold; font-size: 12px; color: #082f49;">
                        พื้นที่คอนกรีตหยาบ = ${outerW.toFixed(2)} × ${ts.toFixed(2)} = <u>${sec.areas.subbase.toFixed(3)} ตร.ม.</u>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
// ============================================================================
// WORD (.doc) EXPORT - รองรับทั้ง (1) รายการคำนวณรูปตัดเดี่ยว [ส่วนที่ 1]
//                            และ (2) รายการคำนวณเปรียบเทียบรูปตัด [ส่วนที่ 3]
// ============================================================================
// ============================================================================
// WORD EXPORT (.docx) - สร้างไฟล์ Microsoft Word จริง (OOXML) จากเนื้อหา
// รายการคำนวณ โดยใช้ html-to-docx ที่ฝังไว้ในหน้าเว็บ (ไม่ต้องมีเซิร์ฟเวอร์)
// รองรับทั้ง (1) รายการคำนวณรูปตัดเดี่ยว [ส่วนที่ 1]
//            และ (2) รายการคำนวณเปรียบเทียบรูปตัด [ส่วนที่ 3]
// ============================================================================

// ------------------------------------------------------------------------
// แปลงคลาส Tailwind ที่ใช้ในหน้ารายการคำนวณ ให้เป็น inline style
// (html-to-docx อ่านได้เฉพาะ inline style เท่านั้น)
// ------------------------------------------------------------------------
const WORD_TAILWIND_STYLES = {
    'text-xs': 'font-size: 9pt;',
    'text-sm': 'font-size: 10pt;',
    'text-xl': 'font-size: 14pt;',
    'sm:text-sm': 'font-size: 10pt;',
    'sm:text-base': 'font-size: 11pt;',
    'sm:text-2xl': 'font-size: 16pt;',
    'text-[11px]': 'font-size: 9pt;',
    'font-bold': 'font-weight: bold;',
    'font-semibold': 'font-weight: bold;',
    'text-center': 'text-align: center;',
    'text-left': 'text-align: left;',
    'text-slate-900': 'color: #0f172a;',
    'text-slate-700': 'color: #334155;',
    'text-slate-500': 'color: #64748b;',
    'text-blue-700': 'color: #1d4ed8;',
    'text-emerald-700': 'color: #047857;',
    'bg-white': 'background-color: #ffffff;',
    'bg-slate-100': 'background-color: #f1f5f9;',
    'w-full': 'width: 100%;',
    'border': 'border: 1px solid #cbd5e1;',
    'border-b-2': 'border-bottom: 2px solid #0f172a;',
    'border-t': 'border-top: 1px solid #e2e8f0;',
    'border-l-4': 'border-left: 4px solid #0891b2;',
    'border-slate-200': 'border: 1px solid #e2e8f0;',
    'border-slate-300': 'border: 1px solid #cbd5e1;',
    'border-slate-900': 'border: 1px solid #0f172a;',
    'border-cyan-600': 'border: 1px solid #0891b2;',
    'border-emerald-600': 'border: 1px solid #059669;',
    'rounded-lg': 'border-radius: 4pt;',
    'pt-2': 'margin-top: 4pt;',
    'pt-3': 'margin-top: 6pt;',
    'pb-4': 'padding-bottom: 8pt;',
    'pl-2.5': 'padding-left: 6pt;',
    'py-0.5': 'padding-top: 1pt; padding-bottom: 1pt;',
    'mt-2': 'margin-top: 4pt;',
    'space-y-1': 'margin-bottom: 4pt;',
    'space-y-2': 'margin-bottom: 6pt;',
    'space-y-3': 'margin-bottom: 8pt;',
    'space-y-4': 'margin-bottom: 10pt;',
    'space-y-6': 'margin-bottom: 14pt;',
    'flex': 'display: block;',
    'items-center': '',
    'justify-between': '',
    'border-collapse': 'border-collapse: collapse;'
};

// ------------------------------------------------------------------------
// แปลง HTML ของรายการคำนวณ ให้อยู่ในรูปแบบที่ html-to-docx แปลงได้ถูกต้อง
//   - ถอดคลาส Tailwind ออกแล้วแทนที่ด้วย inline style
//   - ลบแอตทริบิวต์ style ที่ซ้ำซ้อน (กัน Word แจ้งว่าไฟล์เสีย)
//   - ความกว้างเซลล์แบบ % แปลงเป็นหน่วยที่ Word เข้าใจ
//   - .calc-print-break เปลี่ยนเป็น <div class="page-break"> (ตัวหยุดหน้า)
// ------------------------------------------------------------------------
function buildWordDocumentHtml(docContentHtml, docTitle) {
    let html = docContentHtml || '';

    // 0) ตัดส่วนที่ไม่ต้องนำไปแปลง (script / style / comment)
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    // ความกว้างข้อความที่ใช้ได้บน A4 (หน่วย pt) = (11906 - 1134*2) twip = 481.9 pt
    const TEXT_WIDTH_PT = 481.9;
    const HEADING_SIZE = { 1: '14pt', 2: '12pt', 3: '11pt', 4: '10.5pt', 5: '10pt', 6: '10pt' };
    const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

    // สแต็กเก็บ text-align ของบรรพบุรุษ เพื่อให้ย่อหน้าภายในกล่อง inherit การจัดวาง
    const stack = [];

    const readAttrs = (raw) => {
        const attrs = {};
        const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
        let mm;
        while ((mm = re.exec(raw)) !== null) {
            const val = mm[3] !== undefined ? mm[3] : (mm[4] !== undefined ? mm[4] : (mm[5] || ''));
            attrs[mm[1].toLowerCase()] = val;
        }
        return attrs;
    };

    const writeAttrs = (attrs, extraStyle) => {
        let out = '';
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'style' || k === 'class') continue;
            out += ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
        }
        if (extraStyle && extraStyle.trim()) out += ` style="${extraStyle.trim().replace(/"/g, '&quot;')}"`;
        return out;
    };

    html = html.replace(/<(\/)?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g,
        (m, close, rawTag, rawAttrs, selfClose) => {
            const tag = rawTag.toLowerCase();
            const isClose = !!close;
            const isVoid = VOID_TAGS.has(tag) || !!selfClose;

            // ---- แท็กปิด ----
            if (isClose) {
                if (/^h[1-6]$/.test(tag)) return '</p>';
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].tag === tag) { stack.length = i; break; }
                }
                return m;
            }

            const attrs = readAttrs(rawAttrs);
            const classes = (attrs.class || '').split(/\s+/).filter(Boolean);

            // ---- หัวข้อ h1..h6 -> ย่อหน้าธรรมดา ----
            const isHeading = /^h[1-6]$/.test(tag);
            const outTag = isHeading ? 'p' : tag;

            // ---- รวม style ----
            let styleParts = [];

            // (ก) สไตล์จากคลาส Tailwind (มี precedence ต่ำกว่า inline style)
            for (const c of classes) {
                if (Object.prototype.hasOwnProperty.call(WORD_TAILWIND_STYLES, c)) {
                    const st = WORD_TAILWIND_STYLES[c];
                    if (st) styleParts.push(st);
                }
            }

            // (ข) สไตล์เดิมจาก inline style
            if (attrs.style) styleParts.push(attrs.style);

            // (ค) หัวข้อ: กำหนดขนาดฟอนต์พื้นฐาน (ถ้ายังไม่มีขนาดจากคลาส)
            if (isHeading) {
                const hasFontSize = styleParts.some(s => /font-size\s*:/i.test(s));
                if (!hasFontSize) styleParts.unshift(`font-size: ${HEADING_SIZE[tag[1]] || '10.5pt'};`);
                if (!styleParts.some(s => /font-weight\s*:/i.test(s))) styleParts.push('font-weight: bold;');
                styleParts.push('page-break-after: avoid;');
            }

            // (ง) inherit text-align จากบรรพบุรุษ (เฉพาะย่อหน้าที่ไม่ได้กำหนดเอง)
            if (outTag === 'p' && !styleParts.some(s => /text-align\s*:/i.test(s))) {
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].textAlign) { styleParts.push(`text-align: ${stack[i].textAlign};`); break; }
                }
            }

            let style = styleParts.join(' ').replace(/\s+/g, ' ').trim();

            // ---- ความกว้างเซลล์แบบ % ----
            if (outTag === 'td' || outTag === 'th' || outTag === 'col') {
                style = style.replace(/width\s*:\s*([\d.]+)%\s*;?/gi,
                    (mm, pct) => `width: ${(parseFloat(pct) / 100 * TEXT_WIDTH_PT).toFixed(1)}pt;`);
            }

            // ---- ตัวหยุดหน้า ----
            // หมายเหตุ: html-to-docx จะ "ทิ้งเนื้อหาทั้งหมด" ของ <div class="page-break">
            // จึงต้องแยกตัวหยุดหน้าออกมาเป็น <div class="page-break"></div> แยกต่างหาก
            let prefix = '';
            const isBreakDiv = tag === 'div' && classes.includes('calc-print-break');
            if (isBreakDiv) {
                prefix = '<div class="page-break"></div>';
                classes.splice(classes.indexOf('calc-print-break'), 1);
                style = style.replace(/page-break-before\s*:[^;"]*;?/gi, '')
                             .replace(/break-before\s*:[^;"]*;?/gi, '');
            }

            // ---- คุณสมบัติ CSS ที่ Word ไม่รองรับ ----
            style = style
                .replace(/box-shadow\s*:[^;"]*;?/gi, '')
                .replace(/border-radius\s*:[^;"]*;?/gi, '')
                .replace(/display\s*:\s*(inline-)?flex[^;"]*;?/gi, 'display: block;')
                .replace(/justify-content\s*:[^;"]*;?/gi, '')
                .replace(/align-items\s*:[^;"]*;?/gi, '')
                .replace(/gap\s*:[^;"]*;?/gi, '')
                .replace(/flex-wrap\s*:[^;"]*;?/gi, '')
                .replace(/grid-template-(columns|rows)\s*:[^;"]*;?/gi, '')
                .replace(/mso-outline-level\s*:[^;"]*;?/gi, '')
                .replace(/page-break-inside\s*:[^;"]*;?/gi, '')
                .replace(/break-inside\s*:[^;"]*;?/gi, '')
                .replace(/;\s*;/g, ';')
                .replace(/\s+/g, ' ')
                .trim();

            // ---- ประกอบแท็กกลับ ----
            const keepClass = classes.filter(c => c !== 'calc-print-avoid').join(' ');
            let out = `<${outTag}`;
            if (keepClass) out += ` class="${keepClass}"`;
            out += writeAttrs(attrs, style);
            out += selfClose ? '/>' : '>';

            // ---- อัปเดตสแต็ก ----
            if (!isVoid) {
                const taMatch = style.match(/text-align\s*:\s*([a-z]+)/i);
                stack.push({ tag, textAlign: taMatch ? taMatch[1].toLowerCase() : null });
            }

            return prefix + out;
        });

    return html;
}

// ------------------------------------------------------------------------
// ดาวน์โหลดไฟล์ Microsoft Word (.docx จริง) จากหน้ารายการคำนวณ
// ------------------------------------------------------------------------
async function downloadCalculationSheetWord(sec, docContentHtml, options = {}) {
    const docEl = document.getElementById('calcReportDocument');
    const contentHtml = (typeof docContentHtml === 'string' && docContentHtml.trim())
        ? docContentHtml
        : (docEl ? docEl.innerHTML : '');

    if (!contentHtml || !contentHtml.trim()) {
        showToast('⚠️ ไม่พบเนื้อหารายการคำนวณ กรุณากดปุ่ม "แสดงรายการคำนวณ" ก่อนดาวน์โหลด', 'amber');
        return;
    }

    const row = (typeof boqRows !== 'undefined' && boqRows[selectedRowIndex]) ? boqRows[selectedRowIndex] : {};
    const isRowReport = options.type === 'row' || (typeof activeCalcReportType !== 'undefined' && activeCalcReportType === 'row');

    const canalName = (!isRowReport && sec && sec.canalName && sec.canalName !== '-')
        ? sec.canalName
        : ((row.canalName && row.canalName !== '-') ? row.canalName : ((sec && sec.canalName) ? sec.canalName : '-'));

    let fileName;
    let docTitle;

    if (isRowReport) {
        const staStart = formatMetersToStation(parseStationToMeters(row.staStart || 0));
        const staEnd = formatMetersToStation(parseStationToMeters(row.staEnd || 0));
        fileName = `รายการคำนวณเปรียบเทียบรูปตัด_${canalName}_กม.${staStart}_ถึง_${staEnd}.docx`;
        docTitle = `รายการคำนวณเปรียบเทียบรูปตัดคูส่งน้ำคอนกรีตกรณี U-SHAPE (${canalName} กม.${staStart} - กม.${staEnd})`;
    } else {
        const staStr = (sec && sec.stationFormatted) ? sec.stationFormatted : '0+000';
        const blStr = (sec && sec.params) ? roundElev(sec.params.invert).toFixed(2) : (typeof paramInvert !== 'undefined' ? roundElev(paramInvert).toFixed(2) : '0.00');
        const nglStr = (sec && sec.params) ? roundElev(sec.params.ngl).toFixed(2) : (typeof ngl !== 'undefined' ? roundElev(ngl).toFixed(2) : '0.00');
        fileName = `รายการคำนวณรูปตัดคูส่งน้ำ_${canalName}_กม.${staStr}_BL+${blStr}_NGL+${nglStr}.docx`;
        docTitle = 'รายการคำนวณรูปตัดคูส่งน้ำคอนกรีตกรณี U-SHAPE';
    }

    const converter = (typeof HTMLToDOCX !== 'undefined')
        ? (HTMLToDOCX.default || HTMLToDOCX)
        : null;
    if (typeof converter !== 'function') {
        const wordInnerHtml = buildWordDocumentHtml(contentHtml, docTitle);
        const docFileHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${docTitle}</title><style>@page WordSection1 { size: 595.3pt 841.9pt; margin: 12mm 12mm 12mm 12mm; } div.WordSection1 { page: WordSection1; } body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size: 10pt; color: #0f172a; } table { border-collapse: collapse; width: 100%; }</style></head><body><div class="WordSection1">${wordInnerHtml}</div></body></html>`;
        const outBlob = new Blob(['\ufeff' + docFileHtml], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace(/\.docx$/i, '.doc');
        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showToast(`📄 ดาวน์โหลดไฟล์ Word (${a.download}) เรียบร้อยแล้ว`, 'emerald');
        return;
    }

    showToast('⏳ กำลังสร้างไฟล์ Word (.docx) กรุณารอสักครู่...', 'cyan');

    try {
        const wordHtml = buildWordDocumentHtml(contentHtml, docTitle);

        const blob = await converter(wordHtml, null, {
            title: docTitle,
            subject: 'รายการคำนวณรูปตัดคูส่งน้ำคอนกรีตกรณี U-SHAPE',
            creator: 'ระบบแบบจำลองรูปตัดคูส่งน้ำ',
            description: docTitle,
            font: 'TH Sarabun New',
            fontSize: 23,
            complexScriptFontSize: 23,
            lang: 'th-TH',
            orientation: 'portrait',
            pageSize: { width: 11906, height: 16838 },   // A4 (twip)
            margins: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 567, footer: 567, gutter: 0 },
            table: { row: { cantSplit: true } },
            pageNumber: false
        });

        const outBlob = (blob instanceof Blob) ? blob : new Blob([blob], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        showToast(`📄 ดาวน์โหลดไฟล์ Word (.docx) ${isRowReport ? 'เปรียบเทียบรูปตัด' : 'รายการคำนวณรูปตัด'} เรียบร้อยแล้ว`, 'emerald');
    } catch (err) {
        console.error('[Word Export] เกิดข้อผิดพลาด:', err);
        showToast('❌ เกิดข้อผิดพลาดในการสร้างไฟล์ Word: ' + (err && err.message ? err.message : 'ไม่ทราบสาเหตุ'), 'rose');
    }
}

// Direct capture on docEl with scroll position reset - solves empty/blank PDF (User Request 6)
function downloadCalculationSheetPdf() {
    const docEl = document.getElementById('calcReportDocument');
    if (typeof html2pdf !== 'undefined' && docEl) {
        showToast('กำลังประมวลผลและสร้างไฟล์ PDF กรุณารอสักครู่...', 'cyan');

        const scrollContainer = docEl.parentElement;
        if (scrollContainer) scrollContainer.scrollTop = 0;

        const row = (typeof boqRows !== 'undefined' && boqRows[selectedRowIndex]) ? boqRows[selectedRowIndex] : {};
        const s1Info = (typeof section1ActiveStationInfo !== 'undefined' && section1ActiveStationInfo) ? section1ActiveStationInfo : null;
        const canalName = (activeCalcReportType !== 'row' && s1Info && s1Info.canalName) ? s1Info.canalName : ((row.canalName && row.canalName !== '-') ? row.canalName : '-');
        const staStr = (activeCalcReportType !== 'row' && s1Info && s1Info.stationFormatted) ? s1Info.stationFormatted : formatMetersToStation(parseStationToMeters(row.staStart || 0));

        const opt = {
            margin: [8, 8, 8, 8],
            filename: (activeCalcReportType === 'row')
                ? `รายการคำนวณเปรียบเทียบรูปตัด_${canalName}_กม.${formatMetersToStation(parseStationToMeters(row.staStart || 0))}_ถึง_${formatMetersToStation(parseStationToMeters(row.staEnd || 0))}.pdf`
                : `รายการคำนวณรูปตัดคูส่งน้ำ_${canalName}_กม.${staStr}_BL+${roundElev(paramInvert).toFixed(2)}_NGL+${roundElev(ngl).toFixed(2)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: 0,
                scrollX: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], before: ['.calc-print-break'], avoid: ['.calc-print-avoid'] }
        };

        html2pdf().set(opt).from(docEl).save().then(() => {
            showToast('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว', 'emerald');
        }).catch(() => {
            window.print();
        });
    } else {
        showToast('เปิดหน้าต่างพิมพ์ กรุณาเลือกปลายทางเป็น "บันทึกเป็น PDF" (Save as PDF) ในเบราว์เซอร์ครับ', 'cyan');
        setTimeout(() => window.print(), 250);
    }
}

// Event listener bindings for calculation sheet modal

// สถานะชนิดรายการคำนวณที่เปิดอยู่ใน Modal: 'single' = รูปตัดเดี่ยว (ส่วนที่ 1), 'row' = เปรียบเทียบ 2 รูปตัด (ส่วนที่ 3)
let activeCalcReportType = 'single';

const btnShowRowCalc = document.getElementById('btnShowRowCalcSheet');
if (btnShowRowCalc) {
    btnShowRowCalc.addEventListener('click', () => {
        if (!boqRows.length) {
            showToast('ยังไม่มีข้อมูลในตาราง กรุณาเพิ่มแถวหรือนำเข้าข้อมูลก่อน', 'amber');
            return;
        }
        activeCalcReportType = 'row';
        const titleEl = document.getElementById('calcReportModalHeader')?.querySelector('h3 span');
        if (titleEl) titleEl.innerText = 'รายการคำนวณเปรียบเทียบรูปตัดขวางและปริมาณงานตามหมวดงาน (ส่วนที่ 3)';
        generateRowComparisonCalculationReport(selectedRowIndex);
        document.getElementById('calcReportModal').classList.remove('hidden');
        showToast('เปิดหน้ารายการคำนวณเปรียบเทียบรูปตัดขวางและคำนวณปริมาณงานสำหรับแถวนี้เรียบร้อยแล้ว', 'cyan');
    });
}

document.getElementById('btnShowCalcSheet')?.addEventListener('click', () => {
    activeCalcReportType = 'single';
    const titleEl = document.getElementById('calcReportModalHeader')?.querySelector('h3 span');
    if (titleEl) titleEl.innerText = 'รายการคำนวณพื้นที่รูปตัดคูส่งน้ำคอนกรีตกรณี U-SHAPE';
    const activeRow = (typeof boqRows !== 'undefined' && boqRows[selectedRowIndex]) ? boqRows[selectedRowIndex] : {};
    const sec = computeSectionData({
        invert: paramInvert,
        ngl: ngl,
        B: paramB,
        H: paramH,
        TBL: paramTBL,
        TBR: paramTBR,
        tw: paramWallT,
        tb: paramBaseT,
        ts: paramSubbaseT,
        dt: paramTopsoil
    });
    const s1Info = (typeof section1ActiveStationInfo !== 'undefined' && section1ActiveStationInfo) ? section1ActiveStationInfo : null;
    sec.canalName = s1Info ? (s1Info.canalName || '-') : ((activeRow.canalName && activeRow.canalName !== '-') ? activeRow.canalName : '-');
    sec.subCanalName = s1Info ? (s1Info.subCanalName || '-') : ((activeRow.subCanalName && activeRow.subCanalName !== '-') ? activeRow.subCanalName : '-');
    sec.stationFormatted = s1Info ? (s1Info.stationFormatted || '-') : formatMetersToStation(parseStationToMeters(activeRow.staStart || 0));
    generateCalculationReport(sec);
    document.getElementById('calcReportModal').classList.remove('hidden');
    showToast('เปิดหน้ารายการคำนวณแบบละเอียดเรียบร้อยแล้ว', 'cyan');
});

document.getElementById('btnCloseCalcReport')?.addEventListener('click', () => {
    document.getElementById('calcReportModal').classList.add('hidden');
});

document.getElementById('btnPrintCalcReport')?.addEventListener('click', () => {
    window.print();
});

document.getElementById('btnDownloadCalcPdf')?.addEventListener('click', () => {
    downloadCalculationSheetPdf();
});

document.getElementById('btnCopyCalcReportText')?.addEventListener('click', () => {
    const docEl = document.getElementById('calcReportDocument');
    if (!docEl) return;
    const plainText = docEl.innerText;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(() => {
            showToast('📋 คัดลอกข้อความรายการคำนวณทั้งหมดลงคลิปบอร์ดเรียบร้อยแล้ว', 'emerald');
        }).catch(() => {
            fallbackCopyText(plainText);
        });
    } else {
        fallbackCopyText(plainText);
    }
});

function fallbackCopyText(txt) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    showToast('📋 คัดลอกข้อความรายการคำนวณทั้งหมดลงคลิปบอร์ดเรียบร้อยแล้ว', 'emerald');
}

document.getElementById('btnDownloadCalcWord')?.addEventListener('click', () => {
    const activeRow = (typeof boqRows !== 'undefined' && boqRows[selectedRowIndex]) ? boqRows[selectedRowIndex] : {};
    const sec = computeSectionData({
        invert: paramInvert,
        ngl: ngl,
        B: paramB,
        H: paramH,
        TBL: paramTBL,
        TBR: paramTBR,
        tw: paramWallT,
        tb: paramBaseT,
        ts: paramSubbaseT,
        dt: paramTopsoil
    });
    const s1Info = (typeof section1ActiveStationInfo !== 'undefined' && section1ActiveStationInfo) ? section1ActiveStationInfo : null;
    sec.canalName = s1Info ? (s1Info.canalName || '-') : ((activeRow.canalName && activeRow.canalName !== '-') ? activeRow.canalName : '-');
    sec.subCanalName = s1Info ? (s1Info.subCanalName || '-') : ((activeRow.subCanalName && activeRow.subCanalName !== '-') ? activeRow.subCanalName : '-');
    sec.stationFormatted = s1Info ? (s1Info.stationFormatted || '-') : formatMetersToStation(parseStationToMeters(activeRow.staStart || 0));
    const docEl = document.getElementById('calcReportDocument');
    if (docEl) {
        // ส่งชนิดรายงานไปด้วย เพื่อให้สร้างชื่อไฟล์และหัวเรื่องเอกสารได้ตรงกับประเภทที่เปิดอยู่
        // ('single' = รายการคำนวณรูปตัดเดี่ยว, 'row' = รายการคำนวณเปรียบเทียบ 2 รูปตัดของส่วนที่ 3)
        downloadCalculationSheetWord(sec, docEl.innerHTML, { type: activeCalcReportType });
    }
});

document.getElementById('calcReportModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'calcReportModal') {
        document.getElementById('calcReportModal').classList.add('hidden');
    }
});

// ============================================================================


function bindCanvasPanZoom(canvasEl, viewObj, onRedraw) {
    if (!canvasEl || typeof canvasEl.addEventListener !== 'function') return;
    canvasEl.addEventListener('mousedown', (e) => {
        viewObj.isDragging = true;
        viewObj.startX = e.clientX - viewObj.panX;
        viewObj.startY = e.clientY - viewObj.panY;
    });
    window.addEventListener('mousemove', (e) => {
        if (viewObj.isDragging) {
            viewObj.panX = e.clientX - viewObj.startX;
            viewObj.panY = e.clientY - viewObj.startY;
            onRedraw();
        }
    });
    window.addEventListener('mouseup', () => {
        viewObj.isDragging = false;
    });
    canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        viewObj.panX = mouseX - (mouseX - viewObj.panX) * zoomFactor;
        viewObj.panY = mouseY - (mouseY - viewObj.panY) * zoomFactor;
        viewObj.scale *= zoomFactor;
        onRedraw();
    }, { passive: false });
}


// ============================================================================
// 5. MODULE 3: BOQ TABLE, DIGITIZER-TO-TABLE BRIDGE, & 2-SECTION COMPARISON
// ============================================================================
const WORK_CATEGORIES = [
    { key: 'stripping', label: 'ขุดลอกหน้าดิน', shortLabel: 'ขุดลอกหน้าดิน', color: 'text-amber-400', bgHeader: 'bg-amber-950/50', borderHeader: 'border-amber-700/50', dot: 'bg-amber-500' },
    { key: 'compacted', label: 'ดินถมบดอัดแน่น 85%', shortLabel: 'ดินถมบดอัด 85%', color: 'text-teal-400', bgHeader: 'bg-teal-950/50', borderHeader: 'border-teal-700/50', dot: 'bg-teal-500' },
    { key: 'excavation', label: 'ดินขุด', shortLabel: 'ดินขุด', color: 'text-orange-400', bgHeader: 'bg-orange-950/50', borderHeader: 'border-orange-700/50', dot: 'bg-orange-500' },
    { key: 'manualLeft', label: 'ดินถมแรงคน (ซ้าย)', shortLabel: 'ถมแรงคน (ซ้าย)', color: 'text-purple-300', bgHeader: 'bg-purple-950/40', borderHeader: 'border-purple-700/50', dot: 'bg-purple-400' },
    { key: 'manualRight', label: 'ดินถมแรงคน (ขวา)', shortLabel: 'ถมแรงคน (ขวา)', color: 'text-purple-300', bgHeader: 'bg-purple-950/40', borderHeader: 'border-purple-700/50', dot: 'bg-purple-400' },
    { key: 'manualTotal', label: 'รวมดินถมแรงคน (ซ้าย+ขวา)', shortLabel: 'รวมดินถมแรงคน', color: 'text-purple-400', bgHeader: 'bg-purple-900/50', borderHeader: 'border-purple-600/60', dot: 'bg-purple-500' },
    { key: 'concrete', label: 'โครงสร้างคอนกรีต', shortLabel: 'คอนกรีตโครงสร้าง', color: 'text-sky-400', bgHeader: 'bg-sky-950/50', borderHeader: 'border-sky-700/50', dot: 'bg-sky-400' },
    { key: 'subbase', label: 'คอนกรีตหยาบรองพื้น', shortLabel: 'คอนกรีตหยาบ', color: 'text-sky-300', bgHeader: 'bg-sky-900/40', borderHeader: 'border-sky-600/50', dot: 'bg-sky-300' }
];

// ============================================================================
// ค่าเริ่มต้นคูส่งน้ำ (Canal Default Thicknesses & U-SHAPE Dimension Table ตามรูป 1)
// ============================================================================
function getStandardUShapeTypeTable() {
    return [
        { type: 'VU1', B: 0.35, H: 0.50 },
        { type: 'VU2', B: 0.50, H: 0.55 },
        { type: 'VU3', B: 0.60, H: 0.60 },
        { type: 'VU4', B: 0.60, H: 0.70 },
        { type: 'VU5', B: 0.70, H: 0.70 },
        { type: 'VU6', B: 0.70, H: 0.80 }
    ];
}

function getStandardCanalDefaultParams() {
    return {
        tw: 0.10, // 1. ความหนากำแพง U-SHAPE (tw) = 0.10 ม.
        tb: 0.10, // 2. ความหนาพื้น U-SHAPE (tb) = 0.10 ม.
        ts: 0.05, // 3. ความหนาคอนกรีตหยาบรองพื้น (ts) = 0.05 ม.
        dt: 0.30  // 4. ความหนาขุดลอกหน้าดิน (dt) = 0.30 ม.
    };
}

let canalDefaultParams = getStandardCanalDefaultParams();
let uShapeTypeTable = getStandardUShapeTypeTable();

function findUShapeTypeSpec(typeName) {
    const key = String(typeName || '').trim().toUpperCase();
    if (!key) return null;
    return uShapeTypeTable.find(item => String(item.type || '').trim().toUpperCase() === key) || null;
}

const INPUT_COLUMNS = [
    { colLetter: 'A', key: 'canalName', label: 'คลองส่งน้ำ', type: 'text', width: 'w-28' },
    { colLetter: 'B', key: 'subCanalName', label: 'คูส่งน้ำ', type: 'text', width: 'w-24' },
    { colLetter: 'C', key: 'type', label: 'TYPE', type: 'text', width: 'w-24' },
    { colLetter: 'D', key: 'staStart', label: 'กม.เริ่มต้น', type: 'station', width: 'w-24' },
    { colLetter: 'E', key: 'nglStart', label: 'ระดับ NGL. เริ่มต้น', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'F', key: 'blStart', label: 'ระดับ BL. เริ่มต้น', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'G', key: 'tblStart', label: 'ระดับ TBL. เริ่มต้น', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'H', key: 'staEnd', label: 'กม.สิ้นสุด', type: 'station', width: 'w-24' },
    { colLetter: 'I', key: 'nglEnd', label: 'ระดับ NGL. สิ้นสุด', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'J', key: 'blEnd', label: 'ระดับ BL. สิ้นสุด', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'K', key: 'tblEnd', label: 'ระดับ TBL. สิ้นสุด', type: 'number', step: '0.01', decimals: 2, width: 'w-28' },
    { colLetter: 'L', key: 'B', label: 'B', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'M', key: 'H', label: 'H', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'N', key: 'TBL', label: 'TBL', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'O', key: 'TBR', label: 'TBR', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'P', key: 'tw', label: 'tw', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'Q', key: 'tb', label: 'tb', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'R', key: 'ts', label: 'ts', type: 'number', step: '0.01', decimals: 2, width: 'w-16' },
    { colLetter: 'S', key: 'dt', label: 'dt', type: 'number', step: '0.05', decimals: 2, width: 'w-16' },
    { colLetter: 'T', key: 'remark', label: 'หมายเหตุ', type: 'text', width: 'w-64' },
    { colLetter: 'U', key: 'sectionNo', label: 'ช่วงคูส่งน้ำ', type: 'text', width: 'w-24' }
];

// Item 2: รูปแบบ กม ให้ใช้ ทศนิยม 0 ตำแหน่ง ทุกที่ และถ้าน้อยกว่า 0 ให้เท่ากับ 0
function parseStationToMeters(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return (isNaN(val) || val < 0) ? 0 : Math.round(val);
    const str = String(val).trim().replace(/,/g, '');
    if (!str) return 0;
    const plusMatch = str.match(/^([+-]?\d+)\s*\+\s*(\d+(?:\.\d+)?)$/);
    if (plusMatch) {
        const km = parseInt(plusMatch[1], 10);
        const m = parseFloat(plusMatch[2]);
        const total = (km < 0 ? -1 : 1) * (Math.abs(km) * 1000 + m);
        return total < 0 ? 0 : Math.round(total);
    }
    const num = parseFloat(str);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num);
}

function formatMetersToStation(meters) {
    let num = Number(meters);
    if (isNaN(num) || num < 0) num = 0; // ถ้าน้อยกว่า 0 ให้เท่ากับ 0
    const roundedM = Math.round(num);   // ทศนิยม 0 ตำแหน่ง ทุกที่
    const km = Math.floor(roundedM / 1000);
    const rem = roundedM % 1000;
    return `${km}+${String(rem).padStart(3, '0')}`;
}

function getInitialSampleRows() {
    return [
        {
            canalName: '-', subCanalName: '-', type: 'VU1',
            staStart: 0, nglStart: 99.66, blStart: 100.00, tblStart: 100.50,
            staEnd: 50, nglEnd: 99.85, blEnd: 99.95, tblEnd: 100.45,
            B: 0.35, H: 0.50, TBL: 0.50, TBR: 0.50, tw: 0.10, tb: 0.10, ts: 0.05, dt: 0.30,
            staStartTags: ['baseStart'], staEndTags: ['baseEnd'],
            remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
            sectionNo: '1'
        },
        {
            canalName: '-', subCanalName: '-', type: 'VU1',
            staStart: 50, nglStart: 99.85, blStart: 99.95, tblStart: 100.45,
            staEnd: 100, nglEnd: 100.35, blEnd: 99.90, tblEnd: 100.40,
            B: 0.35, H: 0.50, TBL: 0.50, TBR: 0.50, tw: 0.10, tb: 0.10, ts: 0.05, dt: 0.30,
            staStartTags: ['baseStart'], staEndTags: ['baseEnd'],
            remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
            sectionNo: '2'
        },
        {
            canalName: '-', subCanalName: '-', type: 'VU1',
            staStart: 100, nglStart: 100.35, blStart: 99.90, tblStart: 100.40,
            staEnd: 150, nglEnd: 100.68, blEnd: 99.85, tblEnd: 100.35,
            B: 0.35, H: 0.50, TBL: 0.50, TBR: 0.50, tw: 0.10, tb: 0.10, ts: 0.05, dt: 0.30,
            staStartTags: ['baseStart'], staEndTags: ['baseEnd'],
            remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
            sectionNo: '3'
        },
        {
            canalName: '-', subCanalName: '-', type: 'VU1',
            staStart: 150, nglStart: 100.68, blStart: 99.85, tblStart: 100.35,
            staEnd: 200, nglEnd: 99.55, blEnd: 99.80, tblEnd: 100.30,
            B: 0.35, H: 0.50, TBL: 0.50, TBR: 0.50, tw: 0.10, tb: 0.10, ts: 0.05, dt: 0.30,
            staStartTags: ['baseStart'], staEndTags: ['baseEnd'],
            remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
            sectionNo: '4'
        }
    ];
}

let boqRows = [];
let selectedRowIndex = 0;
let selectedCategoryFilter = 'all';

const STATION_DUP_EPS = 0.01; // ระยะความละเอียดตรวจสอบ กม. ซ้ำ (0.01 เมตร = 1 ซม.)

function deduplicateDigitizerPointArray(ptsArray, eps = STATION_DUP_EPS) {
    if (!Array.isArray(ptsArray) || !ptsArray.length) return [];
    const sorted = [...ptsArray].sort((a, b) => parseFloat(a.data.x) - parseFloat(b.data.x));
    const deduped = [];
    sorted.forEach(pt => {
        const xVal = roundStation(parseFloat(pt.data.x));
        const yVal = roundElev(parseFloat(pt.data.y));
        if (!deduped.length || Math.abs(xVal - deduped[deduped.length - 1].data.x) > eps) {
            deduped.push({
                pixel: { x: pt.pixel.x, y: pt.pixel.y },
                data: { x: xVal, y: yVal }
            });
        } else {
            // หาก กม. ซ้ำกัน ให้ใช้ค่าล่าสุดแทนเพื่อไม่ให้มีจุด กม. ซ้ำ
            deduped[deduped.length - 1] = {
                pixel: { x: pt.pixel.x, y: pt.pixel.y },
                data: { x: deduped[deduped.length - 1].data.x, y: yVal }
            };
        }
    });
    return deduped;
}

function getCombinedDigitizerPoints() {
    saveCurrentDigPageState();
    const combineAll = document.getElementById('chkCombineAllPdfPages')?.checked;
    if (digIsMultiPage && combineAll && digPdfLayoutMode.value === 'single') {
        const allPts = [];
        for (let p = 1; p <= digTotalPages; p++) {
            const st = digPageStates[p];
            if (st && st.points && st.points.length) {
                st.points.forEach(pt => allPts.push(pt));
            }
        }
        if (allPts.length > 0) {
            return deduplicateDigitizerPointArray(allPts, STATION_DUP_EPS);
        }
    }
    return deduplicateDigitizerPointArray(digPoints, STATION_DUP_EPS);
}

let lastSubdivideStepLabel = 25;

function stationTagToThaiLabel(tag, stepVal = lastSubdivideStepLabel) {
    if (!tag) return 'จุดเริ่มต้นช่วง';
    if (tag === 'baseStart') return 'จุดเริ่มต้นช่วง';
    if (tag === 'baseEnd') return 'จุดสิ้นสุดช่วง';
    if (tag === 'base') return 'จุดตารางหลัก';
    if (tag === 'ngl') return 'จุดหักดินเดิม';
    if (tag === 'step' || tag.startsWith('step:')) {
        const stp = tag.includes(':') ? tag.split(':')[1] : stepVal;
        return `จุดแบ่งทุก ${stp} ม.`;
    }
    if (tag === 'zero_stripping') return 'จุดพื้นที่ขุดลอกหน้าดินเป็น 0';
    if (tag === 'zero_compacted') return 'จุดพื้นที่ดินถมบดอัด 85% เป็น 0';
    if (tag === 'zero_excavation') return 'จุดพื้นที่ดินขุดเป็น 0';
    if (tag === 'zero_manual') return 'จุดพื้นที่ดินถมแรงคนเป็น 0';
    return tag;
}

function formatTagSetForStation(tagSet, isIntervalStart, stepVal = lastSubdivideStepLabel) {
    if (!tagSet || tagSet.size === 0) {
        return isIntervalStart ? 'จุดเริ่มต้นช่วง' : 'จุดสิ้นสุดช่วง';
    }
    const arr = Array.from(tagSet);
    // จัดลำดับความสำคัญของการแสดงคำอธิบายที่มาของ กม.
    const specificTags = arr.filter(t => t !== 'baseStart' && t !== 'baseEnd' && t !== 'base');
    const displayTags = specificTags.length > 0 ? specificTags : [isIntervalStart ? 'baseStart' : 'baseEnd'];
    const labels = displayTags.map(t => stationTagToThaiLabel(t, stepVal));
    return Array.from(new Set(labels)).join(' / ');
}

function buildRemarkFromTags(startTags, endTags, stepVal = lastSubdivideStepLabel) {
    const sSet = new Set(Array.isArray(startTags) ? startTags : ['baseStart']);
    const eSet = new Set(Array.isArray(endTags) ? endTags : ['baseEnd']);
    const sText = formatTagSetForStation(sSet, true, stepVal);
    const eText = formatTagSetForStation(eSet, false, stepVal);
    return `${sText} → ${eText}`;
}

// ============================================================================
// SYSTEM STATE FOR MASTER ROWS, SHOW/HIDE SPLIT STATIONS, & UNDO/REDO STACK
// ============================================================================
function cloneBoqRowItem(r, fallbackIdx = 0) {
    if (!r) return r;
    const matchedSpec = findUShapeTypeSpec(r.type);
    const bVal = (r.B !== undefined && r.B !== '' && !isNaN(Number(r.B)) && Number(r.B) > 0)
        ? roundLen(r.B)
        : roundLen(matchedSpec ? matchedSpec.B : 0.35);
    const hVal = (r.H !== undefined && r.H !== '' && !isNaN(Number(r.H)) && Number(r.H) > 0)
        ? roundLen(r.H)
        : roundLen(matchedSpec ? matchedSpec.H : 0.50);
    const blStartVal = roundElev(r.blStart);
    const blEndVal = roundElev(r.blEnd);
    // หากมีค่า tblStart / tblEnd ที่ระบุไว้แล้วให้คงค่าตามที่เลือก หากไม่มีให้คำนวณ ระดับ TBL. = BL. + H
    const tblStartVal = (r.tblStart !== undefined && r.tblStart !== '' && !isNaN(Number(r.tblStart)))
        ? roundElev(r.tblStart)
        : roundElev(blStartVal + hVal);
    const tblEndVal = (r.tblEnd !== undefined && r.tblEnd !== '' && !isNaN(Number(r.tblEnd)))
        ? roundElev(r.tblEnd)
        : roundElev(blEndVal + hVal);
    return {
        ...r,
        staStart: parseStationToMeters(r.staStart),
        nglStart: isMissingNglValue(r.nglStart) ? '-' : roundElev(r.nglStart),
        blStart: blStartVal,
        tblStart: tblStartVal,
        staEnd: parseStationToMeters(r.staEnd),
        nglEnd: isMissingNglValue(r.nglEnd) ? '-' : roundElev(r.nglEnd),
        blEnd: blEndVal,
        tblEnd: tblEndVal,
        B: bVal,
        H: hVal,
        TBL: roundLen(r.TBL ?? 0.50),
        TBR: roundLen(r.TBR ?? 0.50),
        tw: roundLen(r.tw ?? canalDefaultParams.tw),
        tb: roundLen(r.tb ?? canalDefaultParams.tb),
        ts: roundLen(r.ts ?? canalDefaultParams.ts),
        dt: roundLen(r.dt ?? canalDefaultParams.dt),
        sectionNo: (r && r.sectionNo !== undefined && String(r.sectionNo).trim() !== '') ? String(r.sectionNo).trim() : String(fallbackIdx + 1),
        staStartTags: Array.isArray(r.staStartTags) ? [...r.staStartTags] : ['baseStart'],
        staEndTags: Array.isArray(r.staEndTags) ? [...r.staEndTags] : ['baseEnd']
    };
}

// ตรวจสอบและจัดลำดับคอลัมน์ "ช่วงคูส่งน้ำ" (sectionNo) ให้เริ่มนับ 1 ใหม่ทุกครั้งที่สายคูส่งน้ำเปลี่ยน
function recalculateSectionNumbersByCanalLine(rowsArr) {
    if (!Array.isArray(rowsArr) || !rowsArr.length) return rowsArr;
    let prevLineKey = null;
    let currentSecNum = 0;

    rowsArr.forEach((r) => {
        if (!r) return;
        const lineKey = makeCanalLineKey(r.canalName, r.subCanalName);
        const sTags = Array.isArray(r.staStartTags) ? r.staStartTags : [];
        const hasBaseStartTag = sTags.length === 0 || sTags.some(t => t === 'baseStart' || t === 'baseEnd' || t === 'base');

        if (lineKey !== prevLineKey) {
            prevLineKey = lineKey;
            currentSecNum = 1;
        } else if (hasBaseStartTag) {
            currentSecNum++;
        }
        r.sectionNo = String(currentSecNum);
    });
    return rowsArr;
}

// ชุดสีพื้นหลังของแต่ละ "ช่วงคูส่งน้ำ" (sectionNo) เพื่อให้เกิดความแตกต่างชัดเจน
// รอบ 60: เปลี่ยนพื้นหลังแถวจากโทนมืด (ทึบ/เข้ม) เป็นโทนอ่อนโปร่ง (พาสเทล) ให้เข้ากับธีมสว่าง
const SECTION_COLOR_PALETTE = [
    {
        name: 'sky',
        rowCls: 'bg-sky-950/40 hover:bg-sky-900/55 transition cursor-pointer',
        selectedCls: 'bg-sky-900/75 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(224, 242, 254, 0.65);',
        selectedStyle: 'background-color: rgba(186, 230, 253, 0.88);',
        leftBorderCls: 'border-l-4 border-l-sky-400',
        secInputCls: 'bg-sky-500/25 text-sky-200 ring-1 ring-inset ring-sky-400/70 font-extrabold',
        printBg: '#f0f9ff',
        printText: '#0369a1'
    },
    {
        name: 'emerald',
        rowCls: 'bg-emerald-950/40 hover:bg-emerald-900/55 transition cursor-pointer',
        selectedCls: 'bg-emerald-900/75 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(209, 250, 229, 0.65);',
        selectedStyle: 'background-color: rgba(167, 243, 208, 0.88);',
        leftBorderCls: 'border-l-4 border-l-emerald-400',
        secInputCls: 'bg-emerald-500/25 text-emerald-200 ring-1 ring-inset ring-emerald-400/70 font-extrabold',
        printBg: '#ecfdf5',
        printText: '#047857'
    },
    {
        name: 'amber',
        rowCls: 'bg-amber-950/35 hover:bg-amber-900/50 transition cursor-pointer',
        selectedCls: 'bg-amber-900/70 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(255, 247, 237, 0.70);',
        selectedStyle: 'background-color: rgba(253, 230, 138, 0.85);',
        leftBorderCls: 'border-l-4 border-l-amber-400',
        secInputCls: 'bg-amber-500/25 text-amber-200 ring-1 ring-inset ring-amber-400/70 font-extrabold',
        printBg: '#fffbeb',
        printText: '#b45309'
    },
    {
        name: 'purple',
        rowCls: 'bg-purple-950/40 hover:bg-purple-900/55 transition cursor-pointer',
        selectedCls: 'bg-purple-900/75 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(250, 245, 255, 0.68);',
        selectedStyle: 'background-color: rgba(233, 213, 254, 0.88);',
        leftBorderCls: 'border-l-4 border-l-purple-400',
        secInputCls: 'bg-purple-500/25 text-purple-200 ring-1 ring-inset ring-purple-400/70 font-extrabold',
        printBg: '#faf5ff',
        printText: '#7e22ce'
    },
    {
        name: 'rose',
        rowCls: 'bg-rose-950/35 hover:bg-rose-900/50 transition cursor-pointer',
        selectedCls: 'bg-rose-900/70 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(255, 241, 242, 0.68);',
        selectedStyle: 'background-color: rgba(254, 205, 211, 0.85);',
        leftBorderCls: 'border-l-4 border-l-rose-400',
        secInputCls: 'bg-rose-500/25 text-rose-200 ring-1 ring-inset ring-rose-400/70 font-extrabold',
        printBg: '#fff1f2',
        printText: '#be123c'
    },
    {
        name: 'indigo',
        rowCls: 'bg-indigo-950/40 hover:bg-indigo-900/55 transition cursor-pointer',
        selectedCls: 'bg-indigo-900/75 ring-2 ring-inset ring-cyan-400 font-medium shadow-lg transition cursor-pointer',
        rowStyle: 'background-color: rgba(238, 242, 255, 0.68);',
        selectedStyle: 'background-color: rgba(199, 210, 254, 0.88);',
        leftBorderCls: 'border-l-4 border-l-indigo-400',
        secInputCls: 'bg-indigo-500/25 text-indigo-200 ring-1 ring-inset ring-indigo-400/70 font-extrabold',
        printBg: '#eef2ff',
        printText: '#4338ca'
    }
];

function getSectionColorPaletteItem(sectionNoVal) {
    const num = parseInt(String(sectionNoVal || '1').replace(/[^0-9]/g, ''), 10);
    const idx = (!isNaN(num) && num >= 1) ? ((num - 1) % SECTION_COLOR_PALETTE.length) : 0;
    return SECTION_COLOR_PALETTE[idx];
}

function cloneBoqRows(rowsArr) {
    const cloned = (Array.isArray(rowsArr) ? rowsArr : []).map(cloneBoqRowItem);
    return recalculateSectionNumbersByCanalLine(cloned);
}

let masterBoqRows = cloneBoqRows(boqRows);
let hiddenStationCategories = new Set(); // เก็บหมวด กม. ที่ถูกสั่งซ่อนชั่วคราว ('step', 'ngl', 'zero_stripping', 'zero_compacted', 'zero_excavation', 'zero_manual')

const MAX_UNDO_STEPS = 50;
let undoStack = [];
let redoStack = [];
let pendingCellEditSnapshot = null;
let pendingCellEditKey = '';
let pendingCellEditBeforeVal = '';

function createWorkspaceSnapshot(actionLabel = 'แก้ไขข้อมูล') {
    return {
        label: actionLabel,
        boqRows: cloneBoqRows(boqRows),
        masterBoqRows: cloneBoqRows(masterBoqRows),
        hiddenStationCategories: Array.from(hiddenStationCategories),
        selectedRowIndex: selectedRowIndex,
        lastSubdivideStepLabel: lastSubdivideStepLabel,
        inputSubdivideStepVal: document.getElementById('inputSubdivideStep')?.value || String(lastSubdivideStepLabel || 25),
        savedNglProfilesByLine: JSON.parse(JSON.stringify(savedNglProfilesByLine || [])),
        digPoints: (Array.isArray(digPoints) ? digPoints : []).map(p => ({
            pixel: { ...(p.pixel || { x: 0, y: 0 }) },
            data: { ...(p.data || { x: 0, y: 0 }) }
        })),
        digPageStates: JSON.parse(JSON.stringify(digPageStates || {}))
    };
}

function updateUndoRedoButtonsUI() {
    const canUndo = undoStack.length > 0;
    const canRedo = redoStack.length > 0;
    const lastUndoLabel = canUndo ? undoStack[undoStack.length - 1].label : '';
    const lastRedoLabel = canRedo ? redoStack[redoStack.length - 1].label : '';

    ['btnHeaderUndo', 'btnUndoAction'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !canUndo;
        btn.title = canUndo
            ? `ยกเลิก: "${lastUndoLabel}" (เหลือ ${undoStack.length} ขั้นตอน • Ctrl+Z)`
            : 'ไม่มีขั้นตอนก่อนหน้าให้ยกเลิก (Ctrl+Z)';
        btn.innerHTML = canUndo
            ? `<span>↩ ยกเลิก (${undoStack.length})</span>`
            : `<span>↩ ยกเลิก</span>`;
    });

    ['btnHeaderRedo', 'btnRedoAction'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !canRedo;
        btn.title = canRedo
            ? `กลับการทำงาน: "${lastRedoLabel}" (เหลือ ${redoStack.length} ขั้นตอน • Ctrl+Y)`
            : 'ไม่มีขั้นตอนถัดไปให้ทำซ้ำ (Ctrl+Y)';
        btn.innerHTML = canRedo
            ? `<span>↪ กลับการทำงาน (${redoStack.length})</span>`
            : `<span>↪ กลับการทำงาน</span>`;
    });
}

function pushUndoSnapshot(actionLabel = 'แก้ไขข้อมูล') {
    if (typeof isRestoringState !== 'undefined' && isRestoringState) return;
    undoStack.push(createWorkspaceSnapshot(actionLabel));
    if (undoStack.length > MAX_UNDO_STEPS) {
        undoStack.shift();
    }
    redoStack = [];
    updateUndoRedoButtonsUI();
}

function applyWorkspaceSnapshotState(snap) {
    if (!snap) return;
    boqRows = cloneBoqRows(snap.boqRows);
    masterBoqRows = cloneBoqRows(snap.masterBoqRows && snap.masterBoqRows.length ? snap.masterBoqRows : snap.boqRows);
    hiddenStationCategories = new Set(Array.isArray(snap.hiddenStationCategories) ? snap.hiddenStationCategories : []);
    selectedRowIndex = Math.min(Math.max(0, Number(snap.selectedRowIndex || 0)), Math.max(0, boqRows.length - 1));
    if (snap.lastSubdivideStepLabel) {
        lastSubdivideStepLabel = snap.lastSubdivideStepLabel;
    }
    const stepInp = document.getElementById('inputSubdivideStep');
    if (stepInp && snap.inputSubdivideStepVal) {
        stepInp.value = snap.inputSubdivideStepVal;
    }
    if (Array.isArray(snap.digPoints)) {
        digPoints = snap.digPoints.map(p => ({
            pixel: { ...(p.pixel || { x: 0, y: 0 }) },
            data: { ...(p.data || { x: 0, y: 0 }) }
        }));
    }
    if (Array.isArray(snap.savedNglProfilesByLine)) {
        savedNglProfilesByLine = JSON.parse(JSON.stringify(snap.savedNglProfilesByLine));
        updateSavedNglLinesBadgeUI();
    }
    if (snap.digPageStates && typeof snap.digPageStates === 'object') {
        digPageStates = JSON.parse(JSON.stringify(snap.digPageStates));
    }
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, Number(snap.selectedRowIndex || 0)), Math.max(0, boqRows.length - 1));
    updateDigTable();
    redrawDigitizer();
    renderBoqTable();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
}

function performWorkspaceUndo() {
    if (!undoStack.length) {
        showToast('ไม่มีรายการก่อนหน้าให้ยกเลิก (Undo)', 'amber');
        return;
    }
    const targetSnap = undoStack.pop();
    redoStack.push(createWorkspaceSnapshot(targetSnap.label));
    applyWorkspaceSnapshotState(targetSnap);
    updateUndoRedoButtonsUI();
    showBanner(`↩ ยกเลิกการทำงาน: "${targetSnap.label}" เรียบร้อยแล้ว (ตารางมี ${boqRows.length} ช่วง กม.)`, 'cyan');
    showToast(`↩ ยกเลิก: ${targetSnap.label}`, 'cyan');
}

function performWorkspaceRedo() {
    if (!redoStack.length) {
        showToast('ไม่มีรายการถัดไปให้กลับการทำงาน (Redo)', 'amber');
        return;
    }
    const targetSnap = redoStack.pop();
    undoStack.push(createWorkspaceSnapshot(targetSnap.label));
    applyWorkspaceSnapshotState(targetSnap);
    updateUndoRedoButtonsUI();
    showBanner(`↪ กลับการทำงาน (Redo): "${targetSnap.label}" เรียบร้อยแล้ว (ตารางมี ${boqRows.length} ช่วง กม.)`, 'cyan');
    showToast(`↪ กลับการทำงาน: ${targetSnap.label}`, 'cyan');
}

// แปลงข้อความหมายเหตุ (คอลัมน์ T) กลับเป็น Tags เพื่อให้ระบบตรวจสอบสถานะปุ่มแบ่ง/ลบ กม. ได้ทันทีเมื่อเปิดเว็บหรือโหลดไฟล์ใหม่
function parseSingleSideRemarkToTags(sideStr, isStartSide) {
    const text = String(sideStr || '').trim();
    if (!text) return [isStartSide ? 'baseStart' : 'baseEnd'];

    const parts = text.split('/').map(s => s.trim()).filter(Boolean);
    const tags = new Set();

    parts.forEach(part => {
        const stepMatch = part.match(/จุดแบ่งทุก\s*([0-9.]+)/);
        if (stepMatch) {
            const stp = parseFloat(stepMatch[1]);
            if (!isNaN(stp) && stp > 0) {
                tags.add(`step:${stp}`);
                lastSubdivideStepLabel = stp;
                const inpStep = document.getElementById('inputSubdivideStep');
                if (inpStep) inpStep.value = String(stp);
            } else {
                tags.add('step');
            }
        } else if (part.includes('จุดแบ่ง')) {
            tags.add(`step:${lastSubdivideStepLabel || 25}`);
        }
        if (part.includes('จุดหักดินเดิม') || part.includes('ดินเดิม')) {
            tags.add('ngl');
        }
        if (part.includes('ขุดลอกหน้าดินเป็น 0') || part.includes('ขุดลอกหน้าดิน=0')) {
            tags.add('zero_stripping');
        }
        if (part.includes('ดินถมบดอัด') && part.includes('0')) {
            tags.add('zero_compacted');
        }
        if (part.includes('ดินขุดเป็น 0') || part.includes('ดินขุด=0')) {
            tags.add('zero_excavation');
        }
        if ((part.includes('ดินถมแรงคน') || part.includes('ดินถมด้วยแรงคน')) && part.includes('0')) {
            tags.add('zero_manual');
        }
        if (part.includes('จุดเริ่มต้นช่วง') || part.includes('จุดตารางหลัก')) {
            tags.add('baseStart');
        }
        if (part.includes('จุดสิ้นสุดช่วง')) {
            tags.add('baseEnd');
        }
    });

    if (tags.size === 0) {
        tags.add(isStartSide ? 'baseStart' : 'baseEnd');
    }
    return Array.from(tags);
}

function ensureAllRowsHaveParsedTags(rowsArr) {
    if (!Array.isArray(rowsArr) || !rowsArr.length) return rowsArr;
    rowsArr.forEach((r, idx) => {
        if (!r.type || r.type === 'คอนกรีตดาด') {
            r.type = 'VU1';
        }
        const remarkStr = String(r.remark || '').trim();
        const hasSpecificStart = Array.isArray(r.staStartTags) && r.staStartTags.some(t => t !== 'baseStart' && t !== 'baseEnd');
        const hasSpecificEnd = Array.isArray(r.staEndTags) && r.staEndTags.some(t => t !== 'baseStart' && t !== 'baseEnd');

        if (remarkStr && (!hasSpecificStart && !hasSpecificEnd)) {
            let leftPart = remarkStr;
            let rightPart = remarkStr;
            if (remarkStr.includes('→')) {
                const sp = remarkStr.split('→');
                leftPart = sp[0];
                rightPart = sp.slice(1).join('→');
            } else if (remarkStr.includes('->')) {
                const sp = remarkStr.split('->');
                leftPart = sp[0];
                rightPart = sp.slice(1).join('->');
            }
            r.staStartTags = parseSingleSideRemarkToTags(leftPart, true);
            r.staEndTags = parseSingleSideRemarkToTags(rightPart, false);
        } else {
            if (!Array.isArray(r.staStartTags) || !r.staStartTags.length) {
                r.staStartTags = ['baseStart'];
            }
            if (!Array.isArray(r.staEndTags) || !r.staEndTags.length) {
                r.staEndTags = ['baseEnd'];
            }
        }
        if (idx === 0 && !r.staStartTags.includes('baseStart')) {
            r.staStartTags.push('baseStart');
        }
        if (idx === rowsArr.length - 1 && !r.staEndTags.includes('baseEnd')) {
            r.staEndTags.push('baseEnd');
        }
        if (r.sectionNo === undefined || String(r.sectionNo).trim() === '') {
            r.sectionNo = String(idx + 1);
        }
    });
    return rowsArr;
}

function mapTagToSplitCategoryKey(tag) {
    if (!tag) return 'base';
    if (tag === 'baseStart' || tag === 'baseEnd' || tag === 'base') return 'base';
    if (tag === 'step' || tag.startsWith('step:')) return 'step';
    if (tag === 'ngl') return 'ngl';
    if (tag === 'zero_stripping') return 'zero_stripping';
    if (tag === 'zero_compacted') return 'zero_compacted';
    if (tag === 'zero_excavation') return 'zero_excavation';
    if (tag === 'zero_manual') return 'zero_manual';
    return 'base';
}

// จัดกลุ่มแถวตามสายคลองส่งน้ำ + คูส่งน้ำ โดยรักษาลำดับสายเดิมในตาราง
function groupBoqRowsByCanalLine(rowsArr) {
    const groups = [];
    const map = new Map();
    (Array.isArray(rowsArr) ? rowsArr : []).forEach(r => {
        const lKey = makeCanalLineKey(r.canalName, r.subCanalName);
        if (!map.has(lKey)) {
            const g = { lineKey: lKey, canalName: r.canalName, subCanalName: r.subCanalName, rows: [] };
            map.set(lKey, g);
            groups.push(g);
        }
        map.get(lKey).rows.push(r);
    });
    return groups;
}

// นับจำนวนจุด กม. ที่เกิดจากการแบ่งแต่ละประเภทใน masterBoqRows (แยกนับตามสายคลองเพื่อไม่ให้ กม. ต่างสายปนกัน)
function getSplitStationCountsInMaster() {
    const sourceRows = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    ensureAllRowsHaveParsedTags(sourceRows);

    const counts = {
        step: 0,
        stepLabel: lastSubdivideStepLabel || 25,
        ngl: 0,
        zero_stripping: 0,
        zero_compacted: 0,
        zero_excavation: 0,
        zero_manual: 0,
        zero_all: 0
    };

    const lineGroups = groupBoqRowsByCanalLine(sourceRows);
    lineGroups.forEach(grp => {
        const stationMap = new Map();
        const addStaTags = (staVal, tagsArr) => {
            const key = Math.round(parseStationToMeters(staVal) * 100);
            if (!stationMap.has(key)) {
                stationMap.set(key, new Set());
            }
            const setRef = stationMap.get(key);
            (tagsArr || []).forEach(t => setRef.add(t));
        };

        grp.rows.forEach(r => {
            addStaTags(r.staStart, r.staStartTags);
            addStaTags(r.staEnd, r.staEndTags);
        });

        const sortedKeys = Array.from(stationMap.keys()).sort((a, b) => a - b);
        sortedKeys.forEach((key, idx) => {
            // จุดปลายสุดหัว-ท้ายของแต่ละสายคลองเป็นจุดหลักเสมอ
            if (idx === 0 || idx === sortedKeys.length - 1) return;
            const tags = Array.from(stationMap.get(key));
            let hasStep = false;
            let hasNgl = false;
            let hasZStrip = false;
            let hasZComp = false;
            let hasZExc = false;
            let hasZMan = false;

            tags.forEach(t => {
                if (t === 'step' || t.startsWith('step:')) {
                    hasStep = true;
                    if (t.includes(':')) {
                        const stp = parseFloat(t.split(':')[1]);
                        if (!isNaN(stp) && stp > 0) counts.stepLabel = stp;
                    }
                }
                if (t === 'ngl') hasNgl = true;
                if (t === 'zero_stripping') hasZStrip = true;
                if (t === 'zero_compacted') hasZComp = true;
                if (t === 'zero_excavation') hasZExc = true;
                if (t === 'zero_manual') hasZMan = true;
            });

            if (hasStep) counts.step++;
            if (hasNgl) counts.ngl++;
            if (hasZStrip) counts.zero_stripping++;
            if (hasZComp) counts.zero_compacted++;
            if (hasZExc) counts.zero_excavation++;
            if (hasZMan) counts.zero_manual++;
            if (hasZStrip || hasZComp || hasZExc || hasZMan) counts.zero_all++;
        });
    });

    return counts;
}

// สร้าง boqRows ที่แสดงผลจาก masterBoqRows โดยกรองจุด กม. ที่ถูกสั่ง "ซ่อน (Hide)" ออกชั่วคราว (แยกตามสายคลอง)
function rebuildVisibleBoqRowsFromMaster() {
    if (!Array.isArray(masterBoqRows) || !masterBoqRows.length) {
        masterBoqRows = cloneBoqRows(boqRows);
    }
    if (hiddenStationCategories.size === 0) {
        boqRows = cloneBoqRows(masterBoqRows);
        return;
    }

    const lineGroups = groupBoqRowsByCanalLine(masterBoqRows);
    const builtAll = [];

    lineGroups.forEach(grp => {
        const stationMap = new Map();
        const ensureEntry = (staVal) => {
            const key = Math.round(staVal * 100);
            if (!stationMap.has(key)) {
                stationMap.set(key, {
                    sta: roundStation(staVal),
                    tags: new Set(),
                    startProps: null,
                    endProps: null
                });
            }
            return stationMap.get(key);
        };

        grp.rows.forEach((r, idx) => {
            const s1 = parseStationToMeters(r.staStart);
            const s2 = parseStationToMeters(r.staEnd);

            const e1 = ensureEntry(s1);
            e1.startProps = {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglStart) ? '-' : Number(r.nglStart), bl: Number(r.blStart), tbl: Number(r.tblStart),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            };
            (r.staStartTags || [idx === 0 ? 'baseStart' : 'baseEnd']).forEach(t => e1.tags.add(t));

            const e2 = ensureEntry(s2);
            e2.endProps = {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglEnd) ? '-' : Number(r.nglEnd), bl: Number(r.blEnd), tbl: Number(r.tblEnd),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            };
            (r.staEndTags || ['baseEnd']).forEach(t => e2.tags.add(t));
        });

        const sortedPts = Array.from(stationMap.values()).sort((a, b) => a.sta - b.sta);
        if (sortedPts.length < 2) {
            builtAll.push(...cloneBoqRows(grp.rows));
            return;
        }

        const visiblePts = [];
        sortedPts.forEach((pt, idx) => {
            const isBoundary = (idx === 0 || idx === sortedPts.length - 1);
            if (isBoundary) {
                visiblePts.push({
                    sta: pt.sta,
                    tags: Array.from(pt.tags),
                    startProps: pt.startProps || pt.endProps,
                    endProps: pt.endProps || pt.startProps
                });
                return;
            }
            const activeVisibleTags = Array.from(pt.tags).filter(t => {
                const cat = mapTagToSplitCategoryKey(t);
                return !hiddenStationCategories.has(cat);
            });
            if (activeVisibleTags.length > 0) {
                visiblePts.push({
                    sta: pt.sta,
                    tags: activeVisibleTags,
                    startProps: pt.startProps || pt.endProps,
                    endProps: pt.endProps || pt.startProps
                });
            }
        });

        for (let i = 0; i < visiblePts.length - 1; i++) {
            const ptA = visiblePts[i];
            const ptB = visiblePts[i + 1];
            if (ptB.sta - ptA.sta <= STATION_DUP_EPS) continue;
            const sMid = (ptA.sta + ptB.sta) * 0.5;
            const covRow = grp.rows.find(mr => {
                const ms1 = parseStationToMeters(mr.staStart);
                const ms2 = parseStationToMeters(mr.staEnd);
                return sMid >= Math.min(ms1, ms2) - STATION_DUP_EPS && sMid <= Math.max(ms1, ms2) + STATION_DUP_EPS;
            }) || grp.rows.find(mr => Math.abs(parseStationToMeters(mr.staStart) - ptA.sta) <= STATION_DUP_EPS);

            const pStart = ptA.startProps || ptA.endProps;
            const pEnd = ptB.endProps || ptB.startProps;
            const pRef = covRow || pStart;
            builtAll.push({
                canalName: pRef.canalName || '1L-RMC',
                subCanalName: pRef.subCanalName || 'คูส่งน้ำสาย 1',
                type: pRef.type || 'VU1',
                staStart: ptA.sta,
                nglStart: isMissingNglValue(pStart.ngl) ? '-' : roundElev(pStart.ngl),
                blStart: roundElev(pStart.bl),
                tblStart: roundElev(pStart.tbl),
                staEnd: ptB.sta,
                nglEnd: isMissingNglValue(pEnd.ngl) ? '-' : roundElev(pEnd.ngl),
                blEnd: roundElev(pEnd.bl),
                tblEnd: roundElev(pEnd.tbl),
                B: Number(pRef.B),
                H: Number(pRef.H),
                TBL: Number(pRef.TBL),
                TBR: Number(pRef.TBR),
                tw: Number(pRef.tw),
                tb: Number(pRef.tb),
                ts: Number(pRef.ts),
                dt: Number(pRef.dt),
                staStartTags: [...ptA.tags],
                staEndTags: [...ptB.tags],
                remark: buildRemarkFromTags(ptA.tags, ptB.tags, lastSubdivideStepLabel),
                sectionNo: (covRow && covRow.sectionNo !== undefined && String(covRow.sectionNo).trim() !== '') ? String(covRow.sectionNo).trim() : String(i + 1)
            });
        }
    });

    if (builtAll.length > 0) {
        boqRows = builtAll;
    }
}

// ซิงค์การแก้ไขข้อมูลจากแถวที่แสดงผลกลับไปยัง masterBoqRows (แยกตามสายคลอง)
function syncVisibleRowEditToMaster(editedRow, matchLineKey = null, matchStaStart = null, matchStaEnd = null) {
    if (!editedRow) return;
    if (hiddenStationCategories.size === 0) {
        masterBoqRows = cloneBoqRows(boqRows);
        return;
    }
    const targetLineKey = matchLineKey || makeCanalLineKey(editedRow.canalName, editedRow.subCanalName);
    const s1 = matchStaStart !== null ? parseStationToMeters(matchStaStart) : parseStationToMeters(editedRow.staStart);
    const s2 = matchStaEnd !== null ? parseStationToMeters(matchStaEnd) : parseStationToMeters(editedRow.staEnd);
    masterBoqRows.forEach(mr => {
        if (makeCanalLineKey(mr.canalName, mr.subCanalName) !== targetLineKey) return;
        const ms1 = parseStationToMeters(mr.staStart);
        const ms2 = parseStationToMeters(mr.staEnd);
        if (Math.abs(ms1 - s1) <= STATION_DUP_EPS) {
            mr.staStart = editedRow.staStart;
            mr.nglStart = editedRow.nglStart;
            mr.blStart = editedRow.blStart;
            mr.tblStart = editedRow.tblStart;
        }
        if (Math.abs(ms2 - s2) <= STATION_DUP_EPS) {
            mr.staEnd = editedRow.staEnd;
            mr.nglEnd = editedRow.nglEnd;
            mr.blEnd = editedRow.blEnd;
            mr.tblEnd = editedRow.tblEnd;
        }
        if (ms1 >= s1 - STATION_DUP_EPS && ms2 <= s2 + STATION_DUP_EPS) {
            mr.canalName = editedRow.canalName;
            mr.subCanalName = editedRow.subCanalName;
            mr.type = editedRow.type;
            mr.B = editedRow.B;
            mr.H = editedRow.H;
            mr.TBL = editedRow.TBL;
            mr.TBR = editedRow.TBR;
            mr.tw = editedRow.tw;
            mr.tb = editedRow.tb;
            mr.ts = editedRow.ts;
            mr.dt = editedRow.dt;
            mr.sectionNo = editedRow.sectionNo;
        }
    });
}

// สลับสถานะแสดง/ซ่อน กม. ตามหมวดหมู่ (Show / Hide Split Stations)
function toggleShowHideStationCategory(categoryKeys, labelThai) {
    const keysArr = Array.isArray(categoryKeys) ? categoryKeys : [categoryKeys];
    const counts = getSplitStationCountsInMaster();

    let totalPtsInCat = 0;
    keysArr.forEach(k => {
        totalPtsInCat += (counts[k] || 0);
    });

    if (totalPtsInCat === 0) {
        showToast(`ยังไม่มีจุด กม. ประเภท "${labelThai}" ที่แบ่งไว้ในตารางให้แสดง/ซ่อน กรุณากดปุ่มแบ่ง กม. ก่อนครับ`, 'amber');
        return;
    }

    const allCurrentlyHidden = keysArr.every(k => hiddenStationCategories.has(k));
    pushUndoSnapshot(allCurrentlyHidden ? `แสดง กม. (${labelThai})` : `ซ่อน กม. (${labelThai})`);

    if (allCurrentlyHidden) {
        keysArr.forEach(k => hiddenStationCategories.delete(k));
        rebuildVisibleBoqRowsFromMaster();
        selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
        renderBoqTable();
        resetCompareStartView();
        resetCompareEndView();
        if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
        showBanner(`👁 แสดงจุด กม. ประเภท "${labelThai}" (${totalPtsInCat} จุด) กลับมาในตารางเรียบร้อยแล้ว (รวม ${boqRows.length} ช่วง กม.)`, 'emerald');
        showToast(`👁 แสดง ${labelThai} (${totalPtsInCat} จุด) เรียบร้อยแล้ว`, 'emerald');
    } else {
        keysArr.forEach(k => hiddenStationCategories.add(k));
        rebuildVisibleBoqRowsFromMaster();
        selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
        renderBoqTable();
        resetCompareStartView();
        resetCompareEndView();
        if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
        showBanner(`🙈 ซ่อนจุด กม. ประเภท "${labelThai}" (${totalPtsInCat} จุด) ชั่วคราวเรียบร้อยแล้ว (แสดงผล ${boqRows.length} ช่วง กม. • กดปุ่ม "👁 แสดง กม." เพื่อเรียกคืนได้ทันที)`, 'cyan');
        showToast(`🙈 ซ่อน ${labelThai} (${totalPtsInCat} จุด) ชั่วคราวแล้ว`, 'cyan');
    }
}

// อัปเดตสถานะปุ่มแบ่ง กม. (เปลี่ยนเป็น "ลบ กม. ที่แบ่ง" เมื่อตรวจพบว่าแบ่งไว้แล้ว) และปุ่มแสดง/ซ่อน กม.
function syncSplitButtonsStatusUI() {
    const counts = getSplitStationCountsInMaster();
    const stepInputVal = parseFloat(document.getElementById('inputSubdivideStep')?.value) || counts.stepLabel || 25;

    // 1. บล็อกที่ 1: ปุ่มแบ่ง/ลบ กม. ทุกๆ X เมตร (#btnSubdivideStations), ปุ่มแสดง/ซ่อน (#btnRemoveSubdividedStations), และป้ายจำนวนจุด (#badgeCountStepStations)
    const btnSub = document.getElementById('btnSubdivideStations');
    const btnVisSub = document.getElementById('btnRemoveSubdividedStations');
    const badgeStep = document.getElementById('badgeCountStepStations');
    const isStepHid = hiddenStationCategories.has('step');
    if (badgeStep) {
        badgeStep.innerText = isStepHid && counts.step > 0 ? `${counts.step} จุด (ซ่อน)` : `${counts.step} จุด`;
    }
    if (btnSub) {
        if (counts.step > 0) {
            btnSub.className = 'py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] ring-1 ring-rose-300 transition truncate';
            btnSub.innerHTML = `🗑 ลบ กม. ที่แบ่ง (${counts.step})`;
            btnSub.title = `ตรวจพบจุดแบ่งทุกๆ ${counts.stepLabel} เมตร จำนวน ${counts.step} จุด • คลิกเพื่อลบจุด กม. ที่แบ่งออก`;
        } else {
            btnSub.className = 'py-1 px-2 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white font-semibold text-[11px] transition truncate';
            btnSub.innerHTML = `✂️ แบ่ง กม. ทุกๆ ${stepInputVal} เมตร`;
            btnSub.title = `แบ่งช่วง กม. ออกเป็นทุกๆ ${stepInputVal} เมตร`;
        }
    }
    if (btnVisSub) {
        if (counts.step === 0) {
            btnVisSub.className = 'py-1 px-2 rounded-lg bg-slate-800/70 text-slate-400 border border-slate-700/80 text-[11px] font-medium transition opacity-75 truncate';
            btnVisSub.innerHTML = `👁️ แสดง/ซ่อน กม. ที่แบ่ง`;
            btnVisSub.title = 'ยังไม่มีจุด กม. ที่แบ่งทุกๆ X เมตรในตาราง';
        } else if (isStepHid) {
            btnVisSub.className = 'py-1 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white border border-amber-300 text-[11px] font-bold ring-1 ring-amber-300 transition truncate';
            btnVisSub.innerHTML = `👁️ แสดง กม. (${counts.step})`;
            btnVisSub.title = 'คลิกเพื่อแสดงจุด กม. ที่แบ่งทุกๆ X เมตร กลับมาในตาราง';
        } else {
            btnVisSub.className = 'py-1 px-2 rounded-lg bg-indigo-950/90 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 text-[11px] font-semibold transition truncate';
            btnVisSub.innerHTML = `👁️ ซ่อน กม. (${counts.step})`;
            btnVisSub.title = 'คลิกเพื่อซ่อนจุด กม. ที่แบ่งทุกๆ X เมตร ชั่วคราวโดยไม่ลบข้อมูล';
        }
    }

    // 2. บล็อกที่ 2: ปุ่มแทรก/ลบ กม. ดินเดิม (#btnInsertDigitizerStations), ปุ่มแสดง/ซ่อน (#btnRemoveDigitizerStations), และป้ายจำนวนจุด (#badgeCountNglStations)
    const btnNgl = document.getElementById('btnInsertDigitizerStations');
    const btnVisNgl = document.getElementById('btnRemoveDigitizerStations');
    const badgeNgl = document.getElementById('badgeCountNglStations');
    const isNglHid = hiddenStationCategories.has('ngl');
    if (badgeNgl) {
        badgeNgl.innerText = isNglHid && counts.ngl > 0 ? `${counts.ngl} จุด (ซ่อน)` : `${counts.ngl} จุด`;
    }
    if (btnNgl) {
        if (counts.ngl > 0) {
            btnNgl.className = 'py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] ring-1 ring-rose-300 transition truncate';
            btnNgl.innerHTML = `🗑 ลบ กม. ที่แบ่ง (${counts.ngl})`;
            btnNgl.title = `ตรวจพบจุดหักดินเดิมในตาราง จำนวน ${counts.ngl} จุด • คลิกเพื่อลบออก`;
        } else {
            btnNgl.className = 'py-1 px-2 rounded-lg bg-emerald-600/85 hover:bg-emerald-500 text-white font-semibold text-[11px] transition truncate';
            btnNgl.innerHTML = `➕ แทรก กม. ดินเดิม`;
            btnNgl.title = 'แทรกจุดหักดินเดิมจาก XY Digitizer เข้ามาในตารางพร้อมใส่หมายเหตุ จุดหักดินเดิม';
        }
    }
    if (btnVisNgl) {
        if (counts.ngl === 0) {
            btnVisNgl.className = 'py-1 px-2 rounded-lg bg-slate-800/70 text-slate-400 border border-slate-700/80 text-[11px] font-medium transition opacity-75 truncate';
            btnVisNgl.innerHTML = `👁️ แสดง/ซ่อน กม. ดินเดิม`;
            btnVisNgl.title = 'ยังไม่มีจุดหักดินเดิมที่แทรกไว้ในตาราง';
        } else if (isNglHid) {
            btnVisNgl.className = 'py-1 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white border border-amber-300 text-[11px] font-bold ring-1 ring-amber-300 transition truncate';
            btnVisNgl.innerHTML = `👁️ แสดง กม. (${counts.ngl})`;
            btnVisNgl.title = 'คลิกเพื่อแสดงจุดหักดินเดิมกลับมาในตาราง';
        } else {
            btnVisNgl.className = 'py-1 px-2 rounded-lg bg-indigo-950/90 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 text-[11px] font-semibold transition truncate';
            btnVisNgl.innerHTML = `👁️ ซ่อน กม. (${counts.ngl})`;
            btnVisNgl.title = 'คลิกเพื่อซ่อนจุดหักดินเดิมชั่วคราวโดยไม่ลบข้อมูล';
        }
    }

    // 2.5 บล็อกที่ 3: อัปเดตจำนวนช่วง กม. บนป้าย #badgeBoqRowCountInfo
    const badgeRowCount = document.getElementById('badgeBoqRowCountInfo');
    if (badgeRowCount) {
        badgeRowCount.innerText = `${boqRows.length} ช่วง กม.`;
    }

    // 3. ปุ่มรวมค่างานเป็น 0 (#btnSplitZeroAll) & ปุ่มแสดง/ซ่อนรวม (#btnRemoveZeroAll)
    const btnZeroAll = document.getElementById('btnSplitZeroAll');
    const btnVisZeroAll = document.getElementById('btnRemoveZeroAll');
    const allZeroKeys = ['zero_stripping', 'zero_compacted', 'zero_excavation', 'zero_manual'];
    const isAllZeroHidden = counts.zero_all > 0 && allZeroKeys.every(k => counts[k] === 0 || hiddenStationCategories.has(k));

    if (btnZeroAll) {
        if (counts.zero_all > 0) {
            btnZeroAll.className = 'px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow ring-2 ring-rose-400/50 transition';
            btnZeroAll.innerHTML = `🗑 ลบ กม. ที่แบ่ง ค่างานเป็น 0 (ทั้งหมด • ${counts.zero_all} จุด)`;
            btnZeroAll.title = 'คลิกเพื่อลบจุด กม. ที่ค่างานดินเป็น 0 ทั้งหมดออกจากตาราง';
        } else {
            btnZeroAll.className = 'px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition';
            btnZeroAll.innerHTML = `⚡ แบ่ง กม. ค่างานเป็น 0 (ครบทุกงาน)`;
            btnZeroAll.title = 'แบ่งจุด กม. ณ ตำแหน่งที่พื้นที่งานดินเปลี่ยนผ่านค่า 0 ครบทุกหมวดงาน';
        }
    }
    if (btnVisZeroAll) {
        if (counts.zero_all === 0) {
            btnVisZeroAll.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 font-medium text-[11px] transition opacity-75';
            btnVisZeroAll.innerHTML = `👁 แสดง/ซ่อน กม. ค่างานเป็น 0 (ทั้งหมด)`;
        } else if (isAllZeroHidden) {
            btnVisZeroAll.className = 'px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white border border-amber-300 font-bold text-[11px] ring-2 ring-amber-400/50 transition';
            btnVisZeroAll.innerHTML = `👁 แสดง กม. ค่างานเป็น 0 (ซ่อน ${counts.zero_all} จุด)`;
        } else {
            btnVisZeroAll.className = 'px-2.5 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 font-semibold text-[11px] transition';
            btnVisZeroAll.innerHTML = `👁 ซ่อน กม. ค่างานเป็น 0 (ทั้งหมด • ${counts.zero_all} จุด)`;
        }
    }

    // 4. ปุ่มแยกตามหมวดงาน 4 หมวด
    const zeroConfigs = [
        {
            key: 'zero_stripping',
            splitId: 'btnSplitZeroStripping',
            visId: 'btnRemoveZeroStripping',
            badgeId: 'badgeCountZeroStripping',
            defaultSplitCls: 'py-1 px-2 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-semibold text-[11px] transition',
            badgeCls: 'text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50'
        },
        {
            key: 'zero_compacted',
            splitId: 'btnSplitZeroCompacted',
            visId: 'btnRemoveZeroCompacted',
            badgeId: 'badgeCountZeroCompacted',
            defaultSplitCls: 'py-1 px-2 rounded-lg bg-teal-600/80 hover:bg-teal-500 text-white font-semibold text-[11px] transition',
            badgeCls: 'text-[10px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/50'
        },
        {
            key: 'zero_excavation',
            splitId: 'btnSplitZeroExcavation',
            visId: 'btnRemoveZeroExcavation',
            badgeId: 'badgeCountZeroExcavation',
            defaultSplitCls: 'py-1 px-2 rounded-lg bg-orange-600/80 hover:bg-orange-500 text-white font-semibold text-[11px] transition',
            badgeCls: 'text-[10px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-700/50'
        },
        {
            key: 'zero_manual',
            splitId: 'btnSplitZeroManualFill',
            visId: 'btnRemoveZeroManualFill',
            badgeId: 'badgeCountZeroManual',
            defaultSplitCls: 'py-1 px-2 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-semibold text-[11px] transition',
            badgeCls: 'text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700/50'
        }
    ];

    zeroConfigs.forEach(cfg => {
        const cnt = counts[cfg.key] || 0;
        const isHid = hiddenStationCategories.has(cfg.key);
        const elSplit = document.getElementById(cfg.splitId);
        const elVis = document.getElementById(cfg.visId);
        const elBadge = document.getElementById(cfg.badgeId);

        if (elBadge) {
            elBadge.className = cfg.badgeCls;
            elBadge.innerText = isHid && cnt > 0 ? `${cnt} จุด (ซ่อน)` : `${cnt} จุด`;
        }
        if (elSplit) {
            if (cnt > 0) {
                elSplit.className = 'py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] ring-1 ring-rose-300 transition';
                elSplit.innerHTML = `🗑 ลบ กม. ที่แบ่ง (${cnt})`;
                elSplit.title = `ตรวจพบจุดแบ่งในหมวดนี้ ${cnt} จุด • คลิกเพื่อลบจุด กม. ที่แบ่งออก`;
            } else {
                elSplit.className = cfg.defaultSplitCls;
                elSplit.innerHTML = `➕ แบ่ง กม.`;
                elSplit.title = 'คลิกเพื่อแบ่ง กม. ณ จุดที่พื้นที่หมวดนี้เปลี่ยนผ่านค่า 0';
            }
        }
        if (elVis) {
            if (cnt === 0) {
                elVis.className = 'py-1 px-2 rounded-lg bg-slate-800/70 text-slate-400 border border-slate-700/80 text-[11px] font-medium transition opacity-75';
                elVis.innerHTML = `👁 แสดง/ซ่อน กม.`;
                elVis.title = 'ยังไม่มีจุดแบ่งในหมวดนี้ให้แสดง/ซ่อน';
            } else if (isHid) {
                elVis.className = 'py-1 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white border border-amber-300 text-[11px] font-bold ring-1 ring-amber-300 transition';
                elVis.innerHTML = `👁 แสดง กม. (${cnt})`;
                elVis.title = 'คลิกเพื่อแสดงจุด กม. หมวดนี้กลับมาในตาราง';
            } else {
                elVis.className = 'py-1 px-2 rounded-lg bg-indigo-950/90 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 text-[11px] font-semibold transition';
                elVis.innerHTML = `👁 ซ่อน กม. (${cnt})`;
                elVis.title = 'คลิกเพื่อซ่อนจุด กม. หมวดนี้ชั่วคราว';
            }
        }
    });

    if (typeof updateOriginalGroundTabBadgeUI === 'function') {
        updateOriginalGroundTabBadgeUI();
    }
    updateUndoRedoButtonsUI();
}

function updateZeroSplitCountBadges() {
    const btnToggleCS = document.getElementById('btnToggleCrossSectionCollapse');
if (btnToggleCS) btnToggleCS.innerHTML = '<span>ย่อ / ขยายส่วนที่ 1</span>';
syncSplitButtonsStatusUI();
}

// ค้นหาจุด กม. ที่ค่างานดินแต่ละหมวดเปลี่ยนผ่านค่า 0 ภายในช่วงแถว r ([staStart, staEnd])
function findZeroTransitionStationsInRow(r, zeroCategoryKey) {
    if (isMissingNglValue(r.nglStart) || isMissingNglValue(r.nglEnd)) return [];
    const s1 = parseStationToMeters(r.staStart);
    const s2 = parseStationToMeters(r.staEnd);
    if (Math.abs(s2 - s1) <= STATION_DUP_EPS) return [];

    const ngl1 = Number(r.nglStart);
    const ngl2 = Number(r.nglEnd);
    const bl1 = Number(r.blStart);
    const bl2 = Number(r.blEnd);
    const tbl1 = Number(r.tblStart);
    const tbl2 = Number(r.tblEnd);
    const H = Number(r.H ?? 0.50);
    const tb = Number(r.tb ?? 0.10);
    const ts = Number(r.ts ?? 0.05);
    const dt = Number(r.dt ?? 0.30);

    const subBot1 = bl1 - tb - ts;
    const subBot2 = bl2 - tb - ts;
    const topElev1 = ngl1 - dt;
    const topElev2 = ngl2 - dt;

    const found = [];
    const addCrossingIfValid = (d1, d2, tagKey, exactNglAtStaFn) => {
        // ต้องมีเครื่องหมายตรงข้ามกันอย่างแท้จริง (ตัดผ่านจุด 0 ภายในช่วงเปิด (s1, s2))
        if (d1 * d2 < 0 && Math.abs(d1) > 1e-4 && Math.abs(d2) > 1e-4) {
            const t = (-d1) / (d2 - d1);
            if (t > 0.005 && t < 0.995) {
                const sZero = roundStation(s1 + t * (s2 - s1));
                if (Math.abs(sZero - s1) > STATION_DUP_EPS && Math.abs(sZero - s2) > STATION_DUP_EPS) {
                    const tSta = (sZero - s1) / (s2 - s1);
                    const blAtZero = roundElev(bl1 + tSta * (bl2 - bl1));
                    const tblAtZero = roundElev(tbl1 + tSta * (tbl2 - tbl1));
                    const exactNgl = typeof exactNglAtStaFn === 'function'
                        ? roundElev(exactNglAtStaFn(blAtZero, tblAtZero))
                        : roundElev(ngl1 + t * (ngl2 - ngl1));
                    found.push({ sta: sZero, tag: tagKey, exactNgl: exactNgl });
                }
            }
        }
    };

    if (zeroCategoryKey === 'zero_compacted' || zeroCategoryKey === 'all') {
        // ดินถมบดอัดแน่น 85% เป็น 0 เมื่อ (NGL - dt) = (BL - tb - ts) => NGL = BL - tb - ts + dt
        addCrossingIfValid(topElev1 - subBot1, topElev2 - subBot2, 'zero_compacted', (blAtZ) => blAtZ - tb - ts + dt);
    }
    if (zeroCategoryKey === 'zero_excavation' || zeroCategoryKey === 'all') {
        // ดินขุด เป็น 0 เมื่อ (NGL - dt) = (BL - tb - ts) => NGL = BL - tb - ts + dt
        addCrossingIfValid(topElev1 - subBot1, topElev2 - subBot2, 'zero_excavation', (blAtZ) => blAtZ - tb - ts + dt);
    }
    if (zeroCategoryKey === 'zero_manual' || zeroCategoryKey === 'all') {
        // คันดินถมด้วยแรงคนด้านนอก (Node 1, 14) เป็น 0 เมื่อ NGL = TBL
        addCrossingIfValid(ngl1 - tbl1, ngl2 - tbl2, 'zero_manual', (blAtZ, tblAtZ) => tblAtZ);
    }
    if (zeroCategoryKey === 'zero_stripping' || zeroCategoryKey === 'all') {
        const rim1 = roundElev(bl1 + H);
        const rim2 = roundElev(bl2 + H);
        const dist63AtRim = roundLen(0.30 + H + tb + ts);
        const isSpecialPossible = (Number(r.TBL ?? 0.50) > dist63AtRim + 1e-6)
            || (Number(r.TBR ?? 0.50) > dist63AtRim + 1e-6);

        if (isSpecialPossible) {
            // (1) ชั้นลอกหน้าดินแตะขอบบนโครงสร้าง: NGL - dt = BL + H => NGL = BL + H + dt
            addCrossingIfValid(topElev1 - rim1, topElev2 - rim2, 'zero_stripping', (blAtZ) => blAtZ + H + dt);
            // (2) เส้นดินเดิมถึงขอบบนโครงสร้าง: NGL = BL + H
            addCrossingIfValid(ngl1 - rim1, ngl2 - rim2, 'zero_stripping', (blAtZ) => blAtZ + H);
        }
    }

    return found;
}

// ประมวลผลรวมแถวซ้ำหรือแบ่งช่วง กม. สำหรับสายคลองเดียว (Single Canal Line)
function deduplicateAndNormalizeSingleLineRows(lineRowsInput, includeDigitizerPoints = false, subdivideStep = 0, zeroSplitCategory = null, customDigPoints = null) {
    if (!Array.isArray(lineRowsInput) || !lineRowsInput.length) return { rows: [], removedDupCount: 0, addedStaCount: 0 };

    let removedDupCount = 0;
    const validRows = [];
    lineRowsInput.forEach(r => {
        let s1 = roundStation(parseStationToMeters(r.staStart));
        let s2 = roundStation(parseStationToMeters(r.staEnd));
        if (Math.abs(s2 - s1) <= STATION_DUP_EPS) {
            removedDupCount++;
            return;
        }
        const rowCopy = { ...r };
        if (s1 > s2) {
            rowCopy.staStart = s2;
            rowCopy.staEnd = s1;
            rowCopy.nglStart = r.nglEnd;
            rowCopy.nglEnd = r.nglStart;
            rowCopy.blStart = r.blEnd;
            rowCopy.blEnd = r.blStart;
            rowCopy.tblStart = r.tblEnd;
            rowCopy.tblEnd = r.tblStart;
            rowCopy.staStartTags = Array.isArray(r.staEndTags) ? [...r.staEndTags] : ['baseStart'];
            rowCopy.staEndTags = Array.isArray(r.staStartTags) ? [...r.staStartTags] : ['baseEnd'];
        } else {
            rowCopy.staStart = s1;
            rowCopy.staEnd = s2;
            rowCopy.staStartTags = Array.isArray(r.staStartTags) && r.staStartTags.length ? [...r.staStartTags] : ['baseStart'];
            rowCopy.staEndTags = Array.isArray(r.staEndTags) && r.staEndTags.length ? [...r.staEndTags] : ['baseEnd'];
        }
        validRows.push(rowCopy);
    });

    if (!validRows.length) return { rows: [], removedDupCount, addedStaCount: 0 };

    validRows.sort((a, b) => {
        const diffS1 = a.staStart - b.staStart;
        if (Math.abs(diffS1) > STATION_DUP_EPS) return diffS1;
        return a.staEnd - b.staEnd;
    });

    const uniqueIntervalRows = [];
    validRows.forEach(r => {
        const dupIdx = uniqueIntervalRows.findIndex(u =>
            Math.abs(u.staStart - r.staStart) <= STATION_DUP_EPS &&
            Math.abs(u.staEnd - r.staEnd) <= STATION_DUP_EPS
        );
        if (dupIdx !== -1) {
            const mergedStartTags = Array.from(new Set([...(uniqueIntervalRows[dupIdx].staStartTags || []), ...(r.staStartTags || [])]));
            const mergedEndTags = Array.from(new Set([...(uniqueIntervalRows[dupIdx].staEndTags || []), ...(r.staEndTags || [])]));
            uniqueIntervalRows[dupIdx] = {
                ...r,
                staStart: uniqueIntervalRows[dupIdx].staStart,
                staEnd: uniqueIntervalRows[dupIdx].staEnd,
                staStartTags: mergedStartTags,
                staEndTags: mergedEndTags
            };
            removedDupCount++;
        } else {
            uniqueIntervalRows.push(r);
        }
    });

    const stationTagsMap = new Map();
    const zeroExactNglMap = new Map();
    const addTagAtStation = (staVal, tagStr) => {
        const key = Math.round(staVal * 100);
        if (!stationTagsMap.has(key)) {
            stationTagsMap.set(key, { sta: roundStation(staVal), tags: new Set() });
        }
        if (tagStr) {
            stationTagsMap.get(key).tags.add(tagStr);
        }
    };

    const isStationAlreadyBase = (staVal) => {
        const key = Math.round(staVal * 100);
        const entry = stationTagsMap.get(key);
        if (!entry) return false;
        return entry.tags.has('baseStart') || entry.tags.has('baseEnd') || entry.tags.has('base');
    };

    uniqueIntervalRows.forEach(r => {
        (r.staStartTags || ['baseStart']).forEach(t => addTagAtStation(r.staStart, t));
        (r.staEndTags || ['baseEnd']).forEach(t => addTagAtStation(r.staEnd, t));
    });

    uniqueIntervalRows.forEach(r => {
        if (subdivideStep > 0) {
            const stepTag = `step:${subdivideStep}`;
            const firstMul = Math.ceil((r.staStart - STATION_DUP_EPS) / subdivideStep) * subdivideStep;
            for (let s = firstMul; s <= r.staEnd + STATION_DUP_EPS; s += subdivideStep) {
                const sFixed = roundStation(s);
                if (!isStationAlreadyBase(sFixed)) {
                    addTagAtStation(sFixed, stepTag);
                }
            }
        }

        if (zeroSplitCategory) {
            const zeroCrossings = findZeroTransitionStationsInRow(r, zeroSplitCategory);
            zeroCrossings.forEach(zc => {
                if (!isStationAlreadyBase(zc.sta)) {
                    addTagAtStation(zc.sta, zc.tag);
                    if (zc.exactNgl !== undefined && !isNaN(zc.exactNgl)) {
                        zeroExactNglMap.set(Math.round(zc.sta * 100), zc.exactNgl);
                    }
                }
            });
        }
    });

    const lineKey = makeCanalLineKey(uniqueIntervalRows[0].canalName, uniqueIntervalRows[0].subCanalName);
    const useDigForNglProfile = includeDigitizerPoints || (subdivideStep > 0 && document.getElementById('chkSubdivideUseDigitizerNgl')?.checked);
    let digPts = [];
    if (Array.isArray(customDigPoints) && customDigPoints.length > 0) {
        digPts = deduplicateDigitizerPointArray(customDigPoints, STATION_DUP_EPS);
    } else if (useDigForNglProfile) {
        const linePts = typeof getNglPointsForCanalLine === 'function' ? getNglPointsForCanalLine(lineKey) : [];
        digPts = (linePts && linePts.length >= 2) ? deduplicateDigitizerPointArray(linePts, STATION_DUP_EPS) : getCombinedDigitizerPoints();
    }

    if (includeDigitizerPoints && digPts.length >= 2) {
        digPts.forEach(pt => {
            const xSta = roundStation(parseFloat(pt.data.x));
            if (!isStationAlreadyBase(xSta)) {
                addTagAtStation(xSta, 'ngl');
            }
        });
    }

    const sortedEntries = Array.from(stationTagsMap.values()).sort((a, b) => a.sta - b.sta);
    const uniqueStationObjs = [];
    sortedEntries.forEach(entry => {
        if (!uniqueStationObjs.length || Math.abs(entry.sta - uniqueStationObjs[uniqueStationObjs.length - 1].sta) > STATION_DUP_EPS) {
            uniqueStationObjs.push({
                sta: roundStation(entry.sta),
                tags: new Set(entry.tags)
            });
        } else {
            const prev = uniqueStationObjs[uniqueStationObjs.length - 1];
            entry.tags.forEach(t => prev.tags.add(t));
            removedDupCount++;
        }
    });

    if (uniqueStationObjs.length < 2) {
        return { rows: uniqueIntervalRows, removedDupCount, addedStaCount: 0 };
    }

    const startEndpointNglMap = new Map();
    const endEndpointNglMap = new Map();
    const nglControlMap = new Map();
    uniqueIntervalRows.forEach(r => {
        const k1 = Math.round(r.staStart * 100);
        const k2 = Math.round(r.staEnd * 100);
        startEndpointNglMap.set(k1, isMissingNglValue(r.nglStart) ? '-' : Number(r.nglStart));
        endEndpointNglMap.set(k2, isMissingNglValue(r.nglEnd) ? '-' : Number(r.nglEnd));
        if (!isMissingNglValue(r.nglStart)) {
            nglControlMap.set(k1, { x: r.staStart, y: Number(r.nglStart) });
        }
        if (!isMissingNglValue(r.nglEnd)) {
            nglControlMap.set(k2, { x: r.staEnd, y: Number(r.nglEnd) });
        }
    });
    zeroExactNglMap.forEach((exactY, k) => {
        nglControlMap.set(k, { x: k / 100, y: exactY });
    });
    if (useDigForNglProfile && digPts.length > 0) {
        digPts.forEach(pt => {
            const xSta = roundStation(Number(pt.data.x));
            const k = Math.round(xSta * 100);
            nglControlMap.set(k, { x: xSta, y: Number(pt.data.y) });
        });
    }
    const nglProfilePts = Array.from(nglControlMap.values()).sort((a, b) => a.x - b.x);

    function interpolateNglAtStation(sta, parentRow, isStartOfInterval = true) {
        const kSta = Math.round(sta * 100);
        if (zeroExactNglMap.has(kSta)) {
            return zeroExactNglMap.get(kSta);
        }
        if (!useDigForNglProfile) {
            if (isStartOfInterval && startEndpointNglMap.has(kSta)) return startEndpointNglMap.get(kSta);
            if (!isStartOfInterval && endEndpointNglMap.has(kSta)) return endEndpointNglMap.get(kSta);
            if (isMissingNglValue(parentRow.nglStart) || isMissingNglValue(parentRow.nglEnd)) {
                return '-';
            }
        }
        for (let i = 0; i < nglProfilePts.length; i++) {
            if (Math.abs(sta - nglProfilePts[i].x) <= STATION_DUP_EPS) {
                return Number(nglProfilePts[i].y);
            }
        }
        if (zeroSplitCategory && !isMissingNglValue(parentRow.nglStart) && !isMissingNglValue(parentRow.nglEnd)) {
            const span = parentRow.staEnd - parentRow.staStart;
            if (Math.abs(span) > 1e-6 && sta >= parentRow.staStart - STATION_DUP_EPS && sta <= parentRow.staEnd + STATION_DUP_EPS) {
                const t = (sta - parentRow.staStart) / span;
                return Number(parentRow.nglStart) + t * (Number(parentRow.nglEnd) - Number(parentRow.nglStart));
            }
        }
        for (let i = 0; i < nglProfilePts.length - 1; i++) {
            const p1 = nglProfilePts[i];
            const p2 = nglProfilePts[i + 1];
            if (sta >= p1.x - STATION_DUP_EPS && sta <= p2.x + STATION_DUP_EPS) {
                if (Math.abs(p2.x - p1.x) < 1e-6) return p1.y;
                const t = (sta - p1.x) / (p2.x - p1.x);
                return p1.y + t * (p2.y - p1.y);
            }
        }
        if (isMissingNglValue(parentRow.nglStart) || isMissingNglValue(parentRow.nglEnd)) {
            return '-';
        }
        const span = parentRow.staEnd - parentRow.staStart;
        if (Math.abs(span) < 1e-6) return Number(parentRow.nglStart);
        const t = (sta - parentRow.staStart) / span;
        return Number(parentRow.nglStart) + t * (Number(parentRow.nglEnd) - Number(parentRow.nglStart));
    }

    const baseSlope = parseFloat(document.getElementById('digTransferBlSlope')?.value) || -0.0010;
    const resultRows = [];

    for (let i = 0; i < uniqueStationObjs.length - 1; i++) {
        const objA = uniqueStationObjs[i];
        const objB = uniqueStationObjs[i + 1];
        const sA = objA.sta;
        const sB = objB.sta;
        if (sB - sA <= STATION_DUP_EPS) continue;
        const sMid = (sA + sB) * 0.5;

        let parent = uniqueIntervalRows.find(r => sMid >= r.staStart - STATION_DUP_EPS && sMid <= r.staEnd + STATION_DUP_EPS);
        let isExtendedOutsideTable = false;

        if (!parent) {
            if (!includeDigitizerPoints || subdivideStep > 0 || zeroSplitCategory) {
                continue;
            }
            isExtendedOutsideTable = true;
            if (sMid < uniqueIntervalRows[0].staStart) {
                parent = uniqueIntervalRows[0];
            } else {
                parent = uniqueIntervalRows[uniqueIntervalRows.length - 1];
            }
        }

        const pSpan = parent.staEnd - parent.staStart;
        let blA, blB, tblA, tblB;

        if (!isExtendedOutsideTable && Math.abs(pSpan) > 1e-6) {
            const tA = (sA - parent.staStart) / pSpan;
            const tB = (sB - parent.staStart) / pSpan;
            blA = roundElev(Number(parent.blStart) + tA * (Number(parent.blEnd) - Number(parent.blStart)));
            blB = roundElev(Number(parent.blStart) + tB * (Number(parent.blEnd) - Number(parent.blStart)));
            const parentTblStart = (parent.tblStart !== undefined && parent.tblStart !== '' && !isNaN(Number(parent.tblStart)))
                ? roundElev(parent.tblStart)
                : roundElev(roundElev(parent.blStart) + roundLen(parent.H));
            const parentTblEnd = (parent.tblEnd !== undefined && parent.tblEnd !== '' && !isNaN(Number(parent.tblEnd)))
                ? roundElev(parent.tblEnd)
                : roundElev(roundElev(parent.blEnd) + roundLen(parent.H));
            tblA = roundElev(parentTblStart + tA * (parentTblEnd - parentTblStart));
            tblB = roundElev(parentTblStart + tB * (parentTblEnd - parentTblStart));
        } else {
            const rowSlope = Math.abs(pSpan) > 1e-6
                ? (Number(parent.blEnd) - Number(parent.blStart)) / pSpan
                : baseSlope;
            blA = roundElev(Number(parent.blEnd) + (sA - parent.staEnd) * rowSlope);
            blB = roundElev(Number(parent.blEnd) + (sB - parent.staEnd) * rowSlope);
            tblA = roundElev(blA + Number(parent.H));
            tblB = roundElev(blB + Number(parent.H));
        }

        const rawNglA = interpolateNglAtStation(sA, parent, true);
        const rawNglB = interpolateNglAtStation(sB, parent, false);
        const nglA = isMissingNglValue(rawNglA) ? '-' : roundElev(rawNglA);
        const nglB = isMissingNglValue(rawNglB) ? '-' : roundElev(rawNglB);

        const startTagsArr = Array.from(objA.tags);
        const endTagsArr = Array.from(objB.tags);
        const autoRemark = buildRemarkFromTags(startTagsArr, endTagsArr, lastSubdivideStepLabel);

        resultRows.push({
            canalName: parent.canalName || '1L-RMC',
            subCanalName: parent.subCanalName || 'คูส่งน้ำสาย 1',
            type: parent.type || 'VU1',
            staStart: sA,
            nglStart: nglA,
            blStart: blA,
            tblStart: tblA,
            staEnd: sB,
            nglEnd: nglB,
            blEnd: blB,
            tblEnd: tblB,
            B: Number(parent.B),
            H: Number(parent.H),
            TBL: Number(parent.TBL),
            TBR: Number(parent.TBR),
            tw: Number(parent.tw),
            tb: Number(parent.tb),
            ts: Number(parent.ts),
            dt: Number(parent.dt),
            staStartTags: startTagsArr,
            staEndTags: endTagsArr,
            remark: autoRemark,
            sectionNo: (parent.sectionNo !== undefined && String(parent.sectionNo).trim() !== '') ? String(parent.sectionNo).trim() : '1'
        });
    }

    const addedStaCount = Math.max(0, resultRows.length - uniqueIntervalRows.length);
    return { rows: resultRows, removedDupCount, addedStaCount };
}

// ตรวจสอบและรวมแถวที่มี กม. ซ้ำกัน หรือแบ่งช่วง กม. โดยแยกประมวลผลตามสายคลองส่งน้ำ/คูส่งน้ำเพื่อไม่ให้ข้อมูลข้ามสายปนกัน
function deduplicateAndNormalizeBoqRows(rowsInput, includeDigitizerPoints = false, subdivideStep = 0, zeroSplitCategory = null, customDigPoints = null) {
    if (!Array.isArray(rowsInput) || !rowsInput.length) return { rows: [], removedDupCount: 0, addedStaCount: 0 };

    if (subdivideStep > 0) {
        lastSubdivideStepLabel = subdivideStep;
    }

    const lineGroups = groupBoqRowsByCanalLine(rowsInput);
    const allResultRows = [];
    let totalRemovedDup = 0;
    let totalAddedSta = 0;

    lineGroups.forEach(grp => {
        const subRes = deduplicateAndNormalizeSingleLineRows(
            grp.rows,
            includeDigitizerPoints,
            subdivideStep,
            zeroSplitCategory,
            customDigPoints
        );
        allResultRows.push(...subRes.rows);
        totalRemovedDup += subRes.removedDupCount;
        totalAddedSta += subRes.addedStaCount;
    });

    return { rows: allResultRows, removedDupCount: totalRemovedDup, addedStaCount: totalAddedSta };
}

// ฟังก์ชันลบจุด กม. ตามประเภท Tag (แยกประมวลผลตามสายคลองส่งน้ำ/คูส่งน้ำ)
function removeStationsByOriginTag(tagPredicate, actionDescription, clearHiddenCatKeys = []) {
    const sourceRows = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    if (!sourceRows.length) return;

    const lineGroups = groupBoqRowsByCanalLine(sourceRows);
    let removedStationCount = 0;
    const rebuiltRows = [];

    lineGroups.forEach(grp => {
        const stationMap = new Map();
        const ensureStationEntry = (staVal) => {
            const key = Math.round(staVal * 100);
            if (!stationMap.has(key)) {
                stationMap.set(key, {
                    sta: roundStation(staVal),
                    tags: new Set(),
                    startProps: null,
                    endProps: null
                });
            }
            return stationMap.get(key);
        };

        grp.rows.forEach((r, idx) => {
            const s1 = parseStationToMeters(r.staStart);
            const s2 = parseStationToMeters(r.staEnd);

            const e1 = ensureStationEntry(s1);
            e1.startProps = {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglStart) ? '-' : Number(r.nglStart), bl: Number(r.blStart), tbl: Number(r.tblStart),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            };
            const sTags = Array.isArray(r.staStartTags) && r.staStartTags.length ? r.staStartTags : (idx === 0 ? ['baseStart'] : ['baseEnd']);
            sTags.forEach(t => e1.tags.add(t));

            const e2 = ensureStationEntry(s2);
            e2.endProps = {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglEnd) ? '-' : Number(r.nglEnd), bl: Number(r.blEnd), tbl: Number(r.tblEnd),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            };
            const eTags = Array.isArray(r.staEndTags) && r.staEndTags.length ? r.staEndTags : ['baseEnd'];
            eTags.forEach(t => e2.tags.add(t));
        });

        const sortedPts = Array.from(stationMap.values()).sort((a, b) => a.sta - b.sta);
        if (sortedPts.length < 2) {
            rebuiltRows.push(...cloneBoqRows(grp.rows));
            return;
        }

        sortedPts[0].tags.add('baseStart');
        sortedPts[sortedPts.length - 1].tags.add('baseEnd');

        const keptPts = [];
        sortedPts.forEach((pt, idx) => {
            const isBoundary = (idx === 0 || idx === sortedPts.length - 1);
            for (const t of Array.from(pt.tags)) {
                if (tagPredicate(t)) {
                    pt.tags.delete(t);
                }
            }
            if (pt.tags.size === 0 && !isBoundary) {
                removedStationCount++;
            } else {
                if (pt.tags.size === 0 && isBoundary) {
                    pt.tags.add(idx === 0 ? 'baseStart' : 'baseEnd');
                }
                keptPts.push(pt);
            }
        });

        for (let i = 0; i < keptPts.length - 1; i++) {
            const ptA = keptPts[i];
            const ptB = keptPts[i + 1];
            if (ptB.sta - ptA.sta <= STATION_DUP_EPS) continue;

            const startTagsArr = Array.from(ptA.tags);
            const endTagsArr = Array.from(ptB.tags);
            const sMid = (ptA.sta + ptB.sta) * 0.5;
            const covRow = grp.rows.find(sr => {
                const ms1 = parseStationToMeters(sr.staStart);
                const ms2 = parseStationToMeters(sr.staEnd);
                return sMid >= Math.min(ms1, ms2) - STATION_DUP_EPS && sMid <= Math.max(ms1, ms2) + STATION_DUP_EPS;
            }) || grp.rows.find(sr => Math.abs(parseStationToMeters(sr.staStart) - ptA.sta) <= STATION_DUP_EPS);
            const pStart = ptA.startProps || ptA.endProps;
            const pEnd = ptB.endProps || ptB.startProps;
            const pRef = covRow || pStart;

            rebuiltRows.push({
                canalName: pRef.canalName || '1L-RMC',
                subCanalName: pRef.subCanalName || 'คูส่งน้ำสาย 1',
                type: pRef.type || 'VU1',
                staStart: ptA.sta,
                nglStart: isMissingNglValue(pStart.ngl) ? '-' : roundElev(pStart.ngl),
                blStart: roundElev(pStart.bl),
                tblStart: roundElev(pStart.tbl),
                staEnd: ptB.sta,
                nglEnd: isMissingNglValue(pEnd.ngl) ? '-' : roundElev(pEnd.ngl),
                blEnd: roundElev(pEnd.bl),
                tblEnd: roundElev(pEnd.tbl),
                B: Number(pRef.B),
                H: Number(pRef.H),
                TBL: Number(pRef.TBL),
                TBR: Number(pRef.TBR),
                tw: Number(pRef.tw),
                tb: Number(pRef.tb),
                ts: Number(pRef.ts),
                dt: Number(pRef.dt),
                staStartTags: startTagsArr,
                staEndTags: endTagsArr,
                remark: buildRemarkFromTags(startTagsArr, endTagsArr, lastSubdivideStepLabel),
                sectionNo: (covRow && covRow.sectionNo !== undefined && String(covRow.sectionNo).trim() !== '') ? String(covRow.sectionNo).trim() : String(i + 1)
            });
        }
    });

    if (removedStationCount === 0) {
        showToast(`ไม่พบจุด กม. ประเภท "${actionDescription}" ที่สามารถลบออกได้ในตารางปัจจุบัน`, 'amber');
        return;
    }

    if (rebuiltRows.length > 0) {
        pushUndoSnapshot(`ลบ กม. ที่แบ่ง (${actionDescription})`);
        (Array.isArray(clearHiddenCatKeys) ? clearHiddenCatKeys : [clearHiddenCatKeys]).forEach(k => {
            if (k) hiddenStationCategories.delete(k);
        });
        masterBoqRows = cloneBoqRows(rebuiltRows);
        rebuildVisibleBoqRowsFromMaster();
        selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
        renderBoqTable();
        resetCompareStartView();
        resetCompareEndView();
        if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
        showBanner(`🗑 ลบจุด กม. ประเภท "${actionDescription}" ออกจำนวน ${removedStationCount} จุด เรียบร้อยแล้ว (ปุ่มเปลี่ยนกลับเป็นสถานะ "แบ่ง กม." • ตารางรวมกลับเป็น ${boqRows.length} ช่วง กม.)`, 'cyan');
        showToast(`🗑 ลบ ${actionDescription} (${removedStationCount} จุด) เรียบร้อยแล้ว`, 'cyan');
    }
}

// ตรวจสอบสถานะ กม. ซ้ำกันทั้งในเส้นดินเดิม (Digitizer) และในตาราง (BoQ) เพื่อแสดงที่ Badge
function updateStationDuplicateBadgeUI() {
    const badge = document.getElementById('badgeStationDupStatus');
    if (!badge) return;

    let dupIssues = 0;
    const seenIntervals = new Set();

    boqRows.forEach((r, idx) => {
        const s1 = parseStationToMeters(r.staStart);
        const s2 = parseStationToMeters(r.staEnd);
        if (Math.abs(s2 - s1) <= STATION_DUP_EPS) {
            dupIssues++;
        }
        const key = `${r.canalName || ''}_${r.subCanalName || ''}_${Math.round(s1 * 100)}_${Math.round(s2 * 100)}`;
        if (seenIntervals.has(key)) {
            dupIssues++;
        }
        seenIntervals.add(key);

        if (idx > 0) {
            const prev = boqRows[idx - 1];
            if ((prev.canalName || '') === (r.canalName || '') && (prev.subCanalName || '') === (r.subCanalName || '')) {
                const prevS2 = parseStationToMeters(prev.staEnd);
                if (s1 < prevS2 - STATION_DUP_EPS) {
                    dupIssues++;
                }
            }
        }
    });

    if (dupIssues === 0) {
        badge.className = 'px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 font-semibold text-[11px] flex items-center gap-1.5';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>ตรวจสอบ กม.: ไม่ซ้ำกัน (${boqRows.length} ช่วง กม.)</span>`;
    } else {
        badge.className = 'px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/70 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 animate-pulse';
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>พบ กม. ซ้ำ/ทับซ้อน (${dupIssues} จุด) • กดตรวจสอบเพื่อรวมอัตโนมัติ</span>`;
    }
}


function evaluateBoqRow(row) {
    const staStartM = parseStationToMeters(row.staStart);
    const staEndM = parseStationToMeters(row.staEnd);
    const L = roundLen(Math.abs(staEndM - staStartM));

    const hVal = roundLen(row.H);
    const blStartVal = roundElev(row.blStart);
    const blEndVal = roundElev(row.blEnd);
    const tblStartVal = (row.tblStart !== undefined && row.tblStart !== '' && !isNaN(Number(row.tblStart)))
        ? roundElev(row.tblStart)
        : roundElev(blStartVal + hVal);
    const tblEndVal = (row.tblEnd !== undefined && row.tblEnd !== '' && !isNaN(Number(row.tblEnd)))
        ? roundElev(row.tblEnd)
        : roundElev(blEndVal + hVal);

    const secStart = computeSectionData({
        invert: blStartVal,
        ngl: isMissingNglValue(row.nglStart) ? '-' : roundElev(row.nglStart),
        tblElev: tblStartVal,
        B: roundLen(row.B),
        H: hVal,
        TBL: roundLen(row.TBL),
        TBR: roundLen(row.TBR),
        tw: roundLen(row.tw),
        tb: roundLen(row.tb),
        ts: roundLen(row.ts),
        dt: roundLen(row.dt)
    });

    const secEnd = computeSectionData({
        invert: blEndVal,
        ngl: isMissingNglValue(row.nglEnd) ? '-' : roundElev(row.nglEnd),
        tblElev: tblEndVal,
        B: roundLen(row.B),
        H: hVal,
        TBL: roundLen(row.TBL),
        TBR: roundLen(row.TBR),
        tw: roundLen(row.tw),
        tb: roundLen(row.tb),
        ts: roundLen(row.ts),
        dt: roundLen(row.dt)
    });

    const calcByCat = {};
    const isEarthMissing = isMissingNglValue(row.nglStart) || isMissingNglValue(row.nglEnd);
    WORK_CATEGORIES.forEach(cat => {
        const isStructureCat = (cat.key === 'concrete' || cat.key === 'subbase');
        const a1 = roundArea(secStart.areas[cat.key]);
        const a2 = roundArea(secEnd.areas[cat.key]);
        const aAvg = (!isStructureCat && isEarthMissing) ? 0 : roundAvgArea(a1, a2);
        const vol = (!isStructureCat && isEarthMissing) ? 0 : roundVol(aAvg * L);
        calcByCat[cat.key] = { a1, a2, aAvg, L, vol };
    });

    return {
        staStartM,
        staEndM,
        staStartFormatted: formatMetersToStation(staStartM),
        staEndFormatted: formatMetersToStation(staEndM),
        L,
        secStart,
        secEnd,
        calcByCat
    };
}

// Interactive Longitudinal Profile Chart Canvas (NGL vs BL vs TBL)
const canvasLongProfile = document.getElementById('canvasLongProfile');
const ctxLongProfile = (canvasLongProfile && typeof canvasLongProfile.getContext === 'function') ? canvasLongProfile.getContext('2d') : null;

function drawLongitudinalProfile() {
    if (!canvasLongProfile || !ctxLongProfile || !canvasLongProfile.parentElement || typeof canvasLongProfile.parentElement.getBoundingClientRect !== 'function') return;
    const rect = canvasLongProfile.parentElement.getBoundingClientRect();
    if (rect.width < 50) return;
    const w = rect.width;
    const h = rect.height;
    const ratio = Math.max(2, window.devicePixelRatio || 1);
    canvasLongProfile.width = Math.round(w * ratio);
    canvasLongProfile.height = Math.round(h * ratio);
    ctxLongProfile?.setTransform?.(ratio, 0, 0, ratio, 0, 0);
    ctxLongProfile.clearRect(0, 0, w, h);

    if (!boqRows.length) {
        const bSta = document.getElementById('profileScrubBadgeSta');
        const bNgl = document.getElementById('profileScrubBadgeNgl');
        const bBl = document.getElementById('profileScrubBadgeBl');
        const bTbl = document.getElementById('profileScrubBadgeTbl');
        if (bSta) bSta.innerText = '-';
        if (bNgl) bNgl.innerText = '-';
        if (bBl) bBl.innerText = '-';
        if (bTbl) bTbl.innerText = '-';
        ctxLongProfile.save();
        ctxLongProfile.fillStyle = '#64748b';
        ctxLongProfile.font = '600 12.5px "Sarabun", sans-serif';
        ctxLongProfile.textAlign = 'center';
        ctxLongProfile.textBaseline = 'middle';
        ctxLongProfile.fillText('ยังไม่มีข้อมูลช่วง กม. ในตารางสำหรับแสดงกราฟโปรไฟล์ตามยาว', w / 2, h / 2);
        ctxLongProfile.restore();
        return;
    }

    const padL = 54, padR = 24, padT = 18, padB = 26;
    const plotW = Math.max(50, w - padL - padR);
    const plotH = Math.max(30, h - padT - padB);

    const activeRowForProfile = boqRows[selectedRowIndex] || boqRows[0];
    const activeLineKey = activeRowForProfile ? makeCanalLineKey(activeRowForProfile.canalName, activeRowForProfile.subCanalName) : '__BLANK__';
    const profileRows = boqRows.filter(r => makeCanalLineKey(r.canalName, r.subCanalName) === activeLineKey);
    const rowsToPlot = profileRows.length > 0 ? profileRows : boqRows;

    let minSta = Infinity, maxSta = -Infinity;
    let minElev = Infinity, maxElev = -Infinity;

    rowsToPlot.forEach(r => {
        const s1 = parseStationToMeters(r.staStart);
        const s2 = parseStationToMeters(r.staEnd);
        minSta = Math.min(minSta, s1, s2);
        maxSta = Math.max(maxSta, s1, s2);
        [r.nglStart, r.nglEnd, r.blStart, r.blEnd, r.tblStart, r.tblEnd].forEach(ev => {
            const v = Number(ev);
            if (!isNaN(v)) {
                minElev = Math.min(minElev, v);
                maxElev = Math.max(maxElev, v);
            }
        });
    });

    if (maxSta <= minSta) maxSta = minSta + 50;
    const elevSpan = Math.max(0.5, maxElev - minElev);
    minElev -= elevSpan * 0.15;
    maxElev += elevSpan * 0.15;

    const toX = (s) => padL + ((s - minSta) / (maxSta - minSta)) * plotW;
    const toY = (e) => padT + plotH - ((e - minElev) / (maxElev - minElev)) * plotH;

    // Sync Scrubber Slider range
    const slider = document.getElementById('profileScrubberSlider');
    if (slider) {
        slider.min = Math.round(minSta);
        slider.max = Math.round(maxSta);
        if (profileCursorStation === null || profileCursorStation < minSta || profileCursorStation > maxSta) {
            profileCursorStation = parseStationToMeters(boqRows[selectedRowIndex]?.staStart ?? minSta);
        }
        slider.value = Math.round(profileCursorStation);
    }

    // Draw Active Row Shaded Selection
    const selRow = boqRows[selectedRowIndex];
    if (selRow) {
        const sx1 = toX(parseStationToMeters(selRow.staStart));
        const sx2 = toX(parseStationToMeters(selRow.staEnd));
        ctxLongProfile.fillStyle = 'rgba(6, 182, 212, 0.16)';
        ctxLongProfile.fillRect(Math.min(sx1, sx2), padT, Math.max(4, Math.abs(sx2 - sx1)), plotH);
        ctxLongProfile.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctxLongProfile.lineWidth = 1.2;
        ctxLongProfile.strokeRect(Math.min(sx1, sx2), padT, Math.max(4, Math.abs(sx2 - sx1)), plotH);
    }

    // 1. เพิ่มเส้นแนวนอนตลอดกราฟ (Horizontal Grid & Baseline lines across entire graph per รูป 5)
    ctxLongProfile.strokeStyle = '#1e293b';
    ctxLongProfile.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const ev = minElev + (i / 4) * (maxElev - minElev);
        const py = toY(ev);
        ctxLongProfile.beginPath();
        ctxLongProfile.moveTo(padL, py);
        ctxLongProfile.lineTo(w - padR, py);
        ctxLongProfile.stroke();

        ctxLongProfile.fillStyle = '#64748b';
        ctxLongProfile.font = '10px "Sarabun", sans-serif';
        ctxLongProfile.textAlign = 'right';
        ctxLongProfile.fillText(`+${ev.toFixed(2)}`, padL - 6, py + 3);
    }

    // Reference baseline horizontal line
    ctxLongProfile.strokeStyle = '#334155';
    ctxLongProfile.lineWidth = 1.5;
    ctxLongProfile.beginPath();
    ctxLongProfile.moveTo(padL, padT + plotH);
    ctxLongProfile.lineTo(w - padR, padT + plotH);
    ctxLongProfile.stroke();

    // Draw Longitudinal Curves
    const drawProfileSeries = (keyStart, keyEnd, color, lineWidth = 2, dash = []) => {
        ctxLongProfile.save();
        ctxLongProfile.strokeStyle = color;
        ctxLongProfile.lineWidth = lineWidth;
        ctxLongProfile.setLineDash(dash);
        ctxLongProfile.beginPath();
        let hasStarted = false;
        rowsToPlot.forEach((r) => {
            if (isMissingNglValue(r[keyStart]) || isMissingNglValue(r[keyEnd])) {
                hasStarted = false;
                return;
            }
            const x1 = toX(parseStationToMeters(r.staStart));
            const y1 = toY(Number(r[keyStart]));
            const x2 = toX(parseStationToMeters(r.staEnd));
            const y2 = toY(Number(r[keyEnd]));
            if (!hasStarted) {
                ctxLongProfile.moveTo(x1, y1);
                hasStarted = true;
            } else {
                ctxLongProfile.lineTo(x1, y1);
            }
            ctxLongProfile.lineTo(x2, y2);
        });
        ctxLongProfile.stroke();
        ctxLongProfile.restore();
    };

    drawProfileSeries('blStart', 'blEnd', '#38bdf8', 2.2, []);
    drawProfileSeries('tblStart', 'tblEnd', '#fb7185', 1.8, [4, 3]);
    drawProfileSeries('nglStart', 'nglEnd', '#34d399', 2.5, []);

    // Station labels on X-axis
    ctxLongProfile.fillStyle = '#94a3b8';
    ctxLongProfile.font = '10px "Sarabun", sans-serif';
    ctxLongProfile.textAlign = 'center';
    rowsToPlot.forEach((r, idx) => {
        const s1 = parseStationToMeters(r.staStart);
        const x1 = toX(s1);
        if (idx === 0 || rowsToPlot.length <= 12 || idx % Math.ceil(rowsToPlot.length / 10) === 0) {
            ctxLongProfile.fillText(formatMetersToStation(s1), x1, h - 6);
        }
        if (idx === rowsToPlot.length - 1) {
            const s2 = parseStationToMeters(r.staEnd);
            ctxLongProfile.fillText(formatMetersToStation(s2), toX(s2), h - 6);
        }
    });

    // 2. มีเส้นแนวตั้งแสดงบนกราฟ และกล่องแสดงค่า กม. และระดับทั้ง 3 ค่า วิ่งตามเส้นไป (รูป 5)
    if (profileCursorStation !== null && profileCursorStation >= minSta && profileCursorStation <= maxSta) {
        const curX = Math.round(toX(profileCursorStation));
        const interp = getInterpolatedProfileValues(profileCursorStation);

        // Update bottom badges
        const bSta = document.getElementById('profileScrubBadgeSta');
        const bNgl = document.getElementById('profileScrubBadgeNgl');
        const bBl = document.getElementById('profileScrubBadgeBl');
        const bTbl = document.getElementById('profileScrubBadgeTbl');
        if (bSta) bSta.innerText = `กม. ${formatMetersToStation(profileCursorStation)}`;
        if (bNgl) bNgl.innerText = isMissingNglValue(interp.ngl) ? '-' : `+${roundElev(interp.ngl).toFixed(2)} m`;
        if (bBl) bBl.innerText = `+${roundElev(interp.bl).toFixed(2)} m`;
        if (bTbl) bTbl.innerText = `+${roundElev(interp.tbl).toFixed(2)} m`;

        // Draw Vertical Tracking Line across graph
        ctxLongProfile.save();
        ctxLongProfile.strokeStyle = '#f59e0b';
        ctxLongProfile.lineWidth = 1.8;
        ctxLongProfile.setLineDash([4, 3]);
        ctxLongProfile.beginPath();
        ctxLongProfile.moveTo(curX, padT - 4);
        ctxLongProfile.lineTo(curX, padT + plotH + 4);
        ctxLongProfile.stroke();
        ctxLongProfile.restore();

        // Draw Dots at intersection points on 3 curves
        const hasInterpNgl = !isMissingNglValue(interp.ngl);
        const yBl = toY(interp.bl);
        const yTbl = toY(interp.tbl);
        const yNgl = hasInterpNgl ? toY(interp.ngl) : yBl;

        const drawIntersectionDot = (py, color) => {
            ctxLongProfile.save();
            ctxLongProfile.beginPath();
            ctxLongProfile.arc(curX, py, 4.5, 0, Math.PI * 2);
            ctxLongProfile.fillStyle = color;
            ctxLongProfile.fill();
            ctxLongProfile.strokeStyle = '#ffffff';
            ctxLongProfile.lineWidth = 1.5;
            ctxLongProfile.stroke();
            ctxLongProfile.restore();
        };

        if (hasInterpNgl) drawIntersectionDot(yNgl, '#10b981');
        drawIntersectionDot(yBl, '#0284c7');
        drawIntersectionDot(yTbl, '#e11d48');

        // Draw Floating 3-Level Values HUD Box Moving with the Vertical Line
        const boxW = 142;
        const boxH = 68;
        let boxX = curX + 10;
        if (boxX + boxW > w - padR + 6) {
            boxX = curX - boxW - 10;
        }
        let boxY = Math.min(yNgl, yBl, yTbl) - 15;
        boxY = Math.max(padT + 2, Math.min(padT + plotH - boxH - 2, boxY));

        ctxLongProfile.save();
        ctxLongProfile.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctxLongProfile.shadowBlur = 10;
        ctxLongProfile.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctxLongProfile.strokeStyle = '#38bdf8';
        ctxLongProfile.lineWidth = 1.3;
        ctxLongProfile.beginPath();
        ctxLongProfile?.roundRect?.(boxX, boxY, boxW, boxH, 6);
        ctxLongProfile.fill();
        ctxLongProfile.stroke();
        ctxLongProfile.shadowBlur = 0;

        // Render texts inside floating HUD box
        ctxLongProfile.textAlign = 'left';
        ctxLongProfile.textBaseline = 'middle';

        // กม. Header
        ctxLongProfile.font = 'bold 11px "Sarabun", sans-serif';
        ctxLongProfile.fillStyle = '#ffffff';
        ctxLongProfile.fillText(`📍 กม. ${formatMetersToStation(profileCursorStation)}`, boxX + 8, boxY + 12);

        // NGL Level
        ctxLongProfile.font = 'bold 10.5px monospace';
        ctxLongProfile.fillStyle = '#34d399';
        ctxLongProfile.fillText(`● NGL: ${hasInterpNgl ? '+' + roundElev(interp.ngl).toFixed(2) + ' m' : '-'}`, boxX + 8, boxY + 28);

        // BL Level
        ctxLongProfile.fillStyle = '#38bdf8';
        ctxLongProfile.fillText(`● BL:  +${roundElev(interp.bl).toFixed(2)} m`, boxX + 8, boxY + 43);

        // TBL Level
        ctxLongProfile.fillStyle = '#fb7185';
        ctxLongProfile.fillText(`● TBL: +${roundElev(interp.tbl).toFixed(2)} m`, boxX + 8, boxY + 58);

        ctxLongProfile.restore();
    }
}

        // Interactive Scrubber Slider and Canvas Hover Listeners (รูป 5)
const profileScrubberSlider = document.getElementById('profileScrubberSlider');
if (profileScrubberSlider) {
    const onScrubInput = (e) => {
        const staVal = parseFloat(e.target.value);
        if (isNaN(staVal)) return;
        profileCursorStation = staVal;
        const interp = getInterpolatedProfileValues(staVal);
        if (interp.rowIndex !== selectedRowIndex) {
            selectedRowIndex = interp.rowIndex;
            updateComparisonView(false);
        }
        drawLongitudinalProfile();
    };
    profileScrubberSlider.addEventListener('input', onScrubInput);
    profileScrubberSlider.addEventListener('change', onScrubInput);
}

const btnSnapProfile = document.getElementById('btnSnapProfileToActiveRow');
if (btnSnapProfile) {
    btnSnapProfile.addEventListener('click', () => {
        if (!boqRows.length) return;
        const r = boqRows[selectedRowIndex] || boqRows[0];
        profileCursorStation = parseStationToMeters(r.staStart);
        drawLongitudinalProfile();
    });
}

let isScrubbingProfileCanvas = false;
canvasLongProfile?.addEventListener('mousedown', (e) => {
    isScrubbingProfileCanvas = true;
    scrubProfileFromEvent(e, true);
});

window.addEventListener('mousemove', (e) => {
    if (isScrubbingProfileCanvas) {
        scrubProfileFromEvent(e, true);
    }
});

window.addEventListener('mouseup', () => {
    isScrubbingProfileCanvas = false;
});

canvasLongProfile?.addEventListener('mousemove', (e) => {
    if (!isScrubbingProfileCanvas) {
        scrubProfileFromEvent(e, false);
    }
});

function scrubProfileFromEvent(e, updateSelection = true) {
    if (!boqRows.length) return;
    const rect = canvasLongProfile.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const padL = 54, padR = 24;
    const plotW = Math.max(50, rect.width - padL - padR);

    const activeRowForProfile = boqRows[selectedRowIndex] || boqRows[0];
    const activeLineKey = activeRowForProfile ? makeCanalLineKey(activeRowForProfile.canalName, activeRowForProfile.subCanalName) : '__BLANK__';
    const lineRowEntries = [];
    boqRows.forEach((r, idx) => {
        if (makeCanalLineKey(r.canalName, r.subCanalName) === activeLineKey) {
            lineRowEntries.push({ r, idx });
        }
    });
    const entriesToUse = lineRowEntries.length > 0 ? lineRowEntries : boqRows.map((r, idx) => ({ r, idx }));

    let minSta = Infinity, maxSta = -Infinity;
    entriesToUse.forEach(({ r }) => {
        const s1 = parseStationToMeters(r.staStart);
        const s2 = parseStationToMeters(r.staEnd);
        minSta = Math.min(minSta, s1, s2);
        maxSta = Math.max(maxSta, s1, s2);
    });
    if (maxSta <= minSta) return;

    const clampedX = Math.max(padL, Math.min(rect.width - padR, clickX));
    const clickedSta = minSta + ((clampedX - padL) / plotW) * (maxSta - minSta);
    profileCursorStation = Math.round(clickedSta);

    if (updateSelection) {
        let bestIdx = entriesToUse[0].idx;
        let bestDist = Infinity;
        entriesToUse.forEach(({ r, idx }) => {
            const s1 = parseStationToMeters(r.staStart);
            const s2 = parseStationToMeters(r.staEnd);
            const mid = (s1 + s2) / 2;
            if (clickedSta >= Math.min(s1, s2) && clickedSta <= Math.max(s1, s2)) {
                bestIdx = idx;
                bestDist = 0;
            } else if (bestDist > 0) {
                const d = Math.abs(clickedSta - mid);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = idx;
                }
            }
        });
        if (bestIdx !== selectedRowIndex) {
            selectedRowIndex = bestIdx;
            updateComparisonView(false);
            const tr = document.querySelector(`tr[data-row-tr="${selectedRowIndex}"]`);
            if (tr) tr.scrollIntoView({ block: 'nearest' });
        }
    }
    drawLongitudinalProfile();
}


// Side-by-Side Comparison Canvases Setup
const canvasCompareStart = document.getElementById('canvasCompareStart');
const ctxCompareStart = (canvasCompareStart && typeof canvasCompareStart.getContext === 'function') ? canvasCompareStart.getContext('2d') : null;
const canvasCompareEnd = document.getElementById('canvasCompareEnd');
const ctxCompareEnd = (canvasCompareEnd && typeof canvasCompareEnd.getContext === 'function') ? canvasCompareEnd.getContext('2d') : null;

let cmpStartW = 400, cmpStartH = 360;
let cmpEndW = 400, cmpEndH = 360;
const cmpStartView = { scale: 150, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
const cmpEndView = { scale: 150, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };

function resetCompareStartView() {
    const row = boqRows[selectedRowIndex] || boqRows[0];
    if (!row) return;
    const centerElev = Number(row.blStart) + Number(row.H) * 0.05;
    cmpStartView.scale = Math.min(cmpStartW / 4.8, cmpStartH / 3.8);
    cmpStartView.panX = cmpStartW / 2;
    cmpStartView.panY = cmpStartH / 2 + centerElev * cmpStartView.scale;
    drawComparisonCanvases();
}

function resetCompareEndView() {
    const row = boqRows[selectedRowIndex] || boqRows[0];
    if (!row) return;
    const centerElev = Number(row.blEnd) + Number(row.H) * 0.05;
    cmpEndView.scale = Math.min(cmpEndW / 4.8, cmpEndH / 3.8);
    cmpEndView.panX = cmpEndW / 2;
    cmpEndView.panY = cmpEndH / 2 + centerElev * cmpEndView.scale;
    drawComparisonCanvases();
}

function resizeComparisonCanvases(resetViews = false) {
    if (!canvasCompareStart || !canvasCompareEnd || !canvasCompareStart.parentElement || !canvasCompareEnd.parentElement || typeof canvasCompareStart.parentElement.getBoundingClientRect !== 'function') return;
    const r1 = canvasCompareStart.parentElement.getBoundingClientRect();
    const r2 = canvasCompareEnd.parentElement.getBoundingClientRect();
    if (r1.width < 50 || r2.width < 50) return;
    cmpStartW = Math.max(260, r1.width);
    cmpStartH = Math.max(320, r1.height - 68);
    cmpEndW = Math.max(260, r2.width);
    cmpEndH = Math.max(320, r2.height - 68);
    const ratio = Math.max(2, window.devicePixelRatio || 1);

    canvasCompareStart.width = Math.round(cmpStartW * ratio);
    canvasCompareStart.height = Math.round(cmpStartH * ratio);
    canvasCompareEnd.width = Math.round(cmpEndW * ratio);
    canvasCompareEnd.height = Math.round(cmpEndH * ratio);

    if (resetViews || cmpStartView.panX === 0) {
        resetCompareStartView();
        resetCompareEndView();
    } else {
        drawComparisonCanvases();
    }
}

// สถานะการแสดงผลเฉพาะสำหรับรูปตัดเปรียบเทียบทั้ง 2 รูปในส่วนที่ 3 (แยกอิสระจากส่วนที่ 1 ตามรูป 3)
let cmpShowStripping = true;
let cmpShowCompacted = true;
let cmpShowExcavation = true;
let cmpShowManualFill = true;
let cmpShowDims = true;
let cmpShowWidths = true;

function syncCmpToggleButtonsUI() {
    const cmpSpecs = [
        {
            isOn: cmpShowStripping,
            btnId: 'btnCmpToggleAreaStripping',
            dotId: 'dotCmpAreaStripping',
            lblId: 'lblCmpAreaStripping',
            showText: 'แสดงขุดลอกหน้าดิน',
            hideText: 'ซ่อนขุดลอกหน้าดิน',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900/80 text-[10.5px] xl:text-[11px] font-semibold text-amber-200 border border-amber-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-amber-400 shrink-0'
        },
        {
            isOn: cmpShowCompacted,
            btnId: 'btnCmpToggleAreaCompacted',
            dotId: 'dotCmpAreaCompacted',
            lblId: 'lblCmpAreaCompacted',
            showText: 'แสดงดินถมบดอัดแน่น 85%',
            hideText: 'ซ่อนดินถมบดอัดแน่น 85%',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900/80 text-[10.5px] xl:text-[11px] font-semibold text-teal-200 border border-teal-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-teal-400 shrink-0'
        },
        {
            isOn: cmpShowExcavation,
            btnId: 'btnCmpToggleAreaExcavation',
            dotId: 'dotCmpAreaExcavation',
            lblId: 'lblCmpAreaExcavation',
            showText: 'แสดงดินขุด',
            hideText: 'ซ่อนดินขุด',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-orange-950/80 hover:bg-orange-900/80 text-[10.5px] xl:text-[11px] font-semibold text-orange-200 border border-orange-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-orange-400 shrink-0'
        },
        {
            isOn: cmpShowManualFill,
            btnId: 'btnCmpToggleAreaManualFill',
            dotId: 'dotCmpAreaManualFill',
            lblId: 'lblCmpAreaManualFill',
            showText: 'แสดงดินถมด้วยแรงคน',
            hideText: 'ซ่อนดินถมด้วยแรงคน',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900/80 text-[10.5px] xl:text-[11px] font-semibold text-purple-200 border border-purple-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-purple-400 shrink-0'
        },
        {
            isOn: cmpShowDims,
            btnId: 'btnCmpToggleDims',
            dotId: 'dotCmpDims',
            lblId: 'lblCmpDims',
            showText: 'แสดงมิติโครงสร้าง',
            hideText: 'ซ่อนมิติโครงสร้าง',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-[10.5px] xl:text-[11px] font-semibold text-cyan-200 border border-cyan-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-cyan-400 shrink-0'
        },
        {
            isOn: cmpShowWidths,
            btnId: 'btnCmpToggleWidths',
            dotId: 'dotCmpWidths',
            lblId: 'lblCmpWidths',
            showText: 'แสดงความกว้างขุดลอก/คันดิน',
            hideText: 'ซ่อนความกว้างขุดลอก/คันดิน',
            onBtnCls: 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-pink-950/80 hover:bg-pink-900/80 text-[10.5px] xl:text-[11px] font-semibold text-pink-200 border border-pink-500/60 transition flex items-center gap-1 whitespace-nowrap',
            onDotCls: 'w-2 h-2 rounded-full bg-pink-400 shrink-0'
        }
    ];

    const offBtnCls = 'flex-1 min-w-0 justify-center px-1.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-[10.5px] xl:text-[11px] font-medium text-slate-400 border border-slate-700/80 transition flex items-center gap-1 whitespace-nowrap opacity-80';
    const offDotCls = 'w-2 h-2 rounded-full bg-slate-600 shrink-0';

    cmpSpecs.forEach(spec => {
        const btnEl = document.getElementById(spec.btnId);
        const dotEl = document.getElementById(spec.dotId);
        const lblEl = document.getElementById(spec.lblId);
        if (!btnEl || !dotEl || !lblEl) return;
        if (spec.isOn) {
            btnEl.className = spec.onBtnCls;
            dotEl.className = spec.onDotCls;
            lblEl.innerText = spec.showText;
        } else {
            btnEl.className = offBtnCls;
            dotEl.className = offDotCls;
            lblEl.innerText = spec.hideText;
        }
    });
}

function drawComparisonCanvases() {
    if (!ctxCompareStart || !ctxCompareEnd) return;
    const ratio = Math.max(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    if (!boqRows.length) {
        [
            { c: ctxCompareStart, w: cmpStartW, h: cmpStartH, label: 'ยังไม่มีข้อมูล กม.เริ่มต้น ในตาราง' },
            { c: ctxCompareEnd, w: cmpEndW, h: cmpEndH, label: 'ยังไม่มีข้อมูล กม.สิ้นสุด ในตาราง' }
        ].forEach(item => {
            if (!item.c) return;
            item.c?.setTransform?.(ratio, 0, 0, ratio, 0, 0);
            item.c.clearRect(0, 0, item.w, item.h);
            item.c.save();
            item.c.fillStyle = '#64748b';
            item.c.font = '600 12px "Sarabun", sans-serif';
            item.c.textAlign = 'center';
            item.c.textBaseline = 'middle';
            item.c.fillText(item.label, item.w / 2, item.h / 2);
            item.c.restore();
        });
        return;
    }
    const idx = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    const evaluated = evaluateBoqRow(boqRows[idx]);

    const opts = {
        showStripping: cmpShowStripping,
        showCompacted: cmpShowCompacted,
        showExcavation: cmpShowExcavation,
        showManualFill: cmpShowManualFill,
        showDims: cmpShowDims,
        showWidths: cmpShowWidths,
        compact: true
    };

    renderSectionToCanvas(ctxCompareStart, cmpStartW, cmpStartH, ratio, cmpStartView, evaluated.secStart, opts);
    renderSectionToCanvas(ctxCompareEnd, cmpEndW, cmpEndH, ratio, cmpEndView, evaluated.secEnd, opts);
}

bindCanvasPanZoom(canvasCompareStart, cmpStartView, drawComparisonCanvases);
bindCanvasPanZoom(canvasCompareEnd, cmpEndView, drawComparisonCanvases);

document.getElementById('btnResetCompareStart')?.addEventListener('click', resetCompareStartView);
document.getElementById('btnResetCompareEnd')?.addEventListener('click', resetCompareEndView);

document.getElementById('btnCmpToggleAreaStripping')?.addEventListener('click', () => {
    cmpShowStripping = !cmpShowStripping;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpToggleAreaCompacted')?.addEventListener('click', () => {
    cmpShowCompacted = !cmpShowCompacted;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpToggleAreaExcavation')?.addEventListener('click', () => {
    cmpShowExcavation = !cmpShowExcavation;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpToggleAreaManualFill')?.addEventListener('click', () => {
    cmpShowManualFill = !cmpShowManualFill;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpToggleDims')?.addEventListener('click', () => {
    cmpShowDims = !cmpShowDims;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpToggleWidths')?.addEventListener('click', () => {
    cmpShowWidths = !cmpShowWidths;
    syncCmpToggleButtonsUI();
    drawComparisonCanvases();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});
document.getElementById('btnCmpResetBothViews')?.addEventListener('click', () => {
    cmpShowStripping = true;
    cmpShowCompacted = true;
    cmpShowExcavation = true;
    cmpShowManualFill = true;
    cmpShowDims = true;
    cmpShowWidths = true;
    syncCmpToggleButtonsUI();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
});

function updateComparisonView(recenterCanvases = false) {
    const tbody = document.getElementById('cmpBreakdownBody');
    if (!boqRows.length) {
        document.getElementById('lblCompareStartTitle').innerText = 'กม.เริ่มต้น: -';
        document.getElementById('lblCompareEndTitle').innerText = 'กม.สิ้นสุด: -';
        document.getElementById('badgeCompareStartInfo').innerHTML = `
            <span>NGL: <strong class="text-slate-500">-</strong></span>
            <span>BL.: <strong class="text-slate-500">-</strong></span>
            <span>TBL.: <strong class="text-slate-500">-</strong></span>
            <span>กว้างขุดลอก (6-9): <strong class="text-slate-500">-</strong></span>
        `;
        document.getElementById('badgeCompareEndInfo').innerHTML = `
            <span>NGL: <strong class="text-slate-500">-</strong></span>
            <span>BL.: <strong class="text-slate-500">-</strong></span>
            <span>TBL.: <strong class="text-slate-500">-</strong></span>
            <span>กว้างขุดลอก (6-9): <strong class="text-slate-500">-</strong></span>
        `;
        document.getElementById('cmpRowBadge').innerText = 'ไม่มีข้อมูล (0 แถว)';
        document.getElementById('cmpCanalTitle').innerText = '-';
        document.getElementById('cmpStructSummary').innerText = 'ยังไม่มีข้อมูลในตาราง';
        document.getElementById('cmpStaRange').innerText = '-';
        document.getElementById('cmpLengthL').innerText = '0.00 m';
        if (tbody) {
            tbody.innerHTML = WORK_CATEGORIES.map(cat => `
                <tr class="hover:bg-slate-800/50 transition">
                    <td class="py-1.5 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full ${cat.dot} inline-block shrink-0"></span>
                        <span class="text-slate-400">${cat.label}</span>
                    </td>
                    <td class="py-1.5 text-right font-mono text-slate-500">0.000</td>
                    <td class="py-1.5 text-right font-mono text-slate-500">0.000</td>
                    <td class="py-1.5 text-right font-mono text-slate-500">0.00</td>
                    <td class="py-1.5 text-right font-mono font-bold text-slate-500">0.000</td>
                </tr>
            `).join('');
        }
        drawComparisonCanvases();
        drawLongitudinalProfile();
        return;
    }
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    const row = boqRows[selectedRowIndex];
    const ev = evaluateBoqRow(row);

    document.getElementById('lblCompareStartTitle').innerText = `กม.เริ่มต้น: ${ev.staStartFormatted} (${ev.secStart.flags.statusText})`;
    document.getElementById('lblCompareEndTitle').innerText = `กม.สิ้นสุด: ${ev.staEndFormatted} (${ev.secEnd.flags.statusText})`;

    const nglStartBadgeStr = isMissingNglValue(row.nglStart) ? '-' : `+${roundElev(row.nglStart).toFixed(2)} m`;
    const nglEndBadgeStr = isMissingNglValue(row.nglEnd) ? '-' : `+${roundElev(row.nglEnd).toFixed(2)} m`;
    document.getElementById('badgeCompareStartInfo').innerHTML = `
        <span>NGL: <strong class="text-emerald-400">${nglStartBadgeStr}</strong></span>
        <span>BL.: <strong class="text-sky-400">+${roundElev(row.blStart).toFixed(2)} m</strong></span>
        <span>TBL.: <strong class="text-indigo-300">+${roundElev(row.tblStart).toFixed(2)} m</strong></span>
        <span>กว้างขุดลอก (6-9): <strong class="text-pink-300">${roundLen(ev.secStart.widths.width69).toFixed(2)} m</strong></span>
    `;
    document.getElementById('badgeCompareEndInfo').innerHTML = `
        <span>NGL: <strong class="text-emerald-400">${nglEndBadgeStr}</strong></span>
        <span>BL.: <strong class="text-sky-400">+${roundElev(row.blEnd).toFixed(2)} m</strong></span>
        <span>TBL.: <strong class="text-indigo-300">+${roundElev(row.tblEnd).toFixed(2)} m</strong></span>
        <span>กว้างขุดลอก (6-9): <strong class="text-pink-300">${roundLen(ev.secEnd.widths.width69).toFixed(2)} m</strong></span>
    `;

    document.getElementById('cmpRowBadge').innerText = `แถวที่ ${selectedRowIndex + 1} / ${boqRows.length} • ช่วงคูส่งน้ำที่ ${row.sectionNo || (selectedRowIndex + 1)}`;
    document.getElementById('cmpCanalTitle').innerText = `${row.canalName || '-'} • ${row.subCanalName || '-'}`;
    document.getElementById('cmpStructSummary').innerText = `TYPE: ${row.type || '-'} | B=${roundLen(row.B).toFixed(2)}, H=${roundLen(row.H).toFixed(2)}, TBL=${roundLen(row.TBL).toFixed(2)}, TBR=${roundLen(row.TBR).toFixed(2)}, tw=${roundLen(row.tw).toFixed(2)}, tb=${roundLen(row.tb).toFixed(2)}, ts=${roundLen(row.ts).toFixed(2)}, dt=${roundLen(row.dt).toFixed(2)}`;
    document.getElementById('cmpStaRange').innerText = `${ev.staStartFormatted} → ${ev.staEndFormatted}`;
    document.getElementById('cmpLengthL').innerText = `${roundLen(ev.L).toFixed(2)} m`;

    const avgW69 = roundLen((roundLen(ev.secStart.widths.width69) + roundLen(ev.secEnd.widths.width69)) * 0.5);
    const avgW114 = roundLen((roundLen(ev.secStart.widths.width114) + roundLen(ev.secEnd.widths.width114)) * 0.5);

    tbody.innerHTML = WORK_CATEGORIES.map(cat => {
        const c = ev.calcByCat[cat.key];
        return `
            <tr class="hover:bg-slate-800/50 transition">
                <td class="py-1.5 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full ${cat.dot} inline-block shrink-0"></span>
                    <span class="text-slate-200">${cat.label}</span>
                </td>
                <td class="py-1.5 text-right font-mono text-cyan-300">${c.a1.toFixed(3)}</td>
                <td class="py-1.5 text-right font-mono text-amber-300">${c.a2.toFixed(3)}</td>
                <td class="py-1.5 text-right font-mono text-slate-400">${c.L.toFixed(2)}</td>
                <td class="py-1.5 text-right font-mono font-bold ${cat.color}">${c.vol.toFixed(3)}</td>
            </tr>
        `;
    }).join('') + `
        <tr class="border-t border-slate-700 bg-slate-800/40 text-[11px]">
            <td class="py-1.5 text-pink-300 font-medium">ความกว้างขุดลอกหน้าดิน (6-9)</td>
            <td class="py-1.5 text-right font-mono text-pink-300">${roundLen(ev.secStart.widths.width69).toFixed(2)} m</td>
            <td class="py-1.5 text-right font-mono text-pink-300">${roundLen(ev.secEnd.widths.width69).toFixed(2)} m</td>
            <td class="py-1.5 text-right text-slate-500">-</td>
            <td class="py-1.5 text-right font-mono text-pink-200">เฉลี่ย ${avgW69.toFixed(2)} m</td>
        </tr>
        <tr class="bg-slate-800/40 text-[11px]">
            <td class="py-1.5 text-rose-300 font-medium">ความกว้างคันดินด้านล่าง (1-14)</td>
            <td class="py-1.5 text-right font-mono text-rose-300">${roundLen(ev.secStart.widths.width114).toFixed(2)} m</td>
            <td class="py-1.5 text-right font-mono text-rose-300">${roundLen(ev.secEnd.widths.width114).toFixed(2)} m</td>
            <td class="py-1.5 text-right text-slate-500">-</td>
            <td class="py-1.5 text-right font-mono text-rose-200">เฉลี่ย ${avgW114.toFixed(2)} m</td>
        </tr>
    `;

    if (recenterCanvases) {
        resetCompareStartView();
        resetCompareEndView();
    } else {
        drawComparisonCanvases();
    }

    drawLongitudinalProfile();

    document.querySelectorAll('#boqTableBody tr[data-row-tr]').forEach((tr) => {
        const idx = parseInt(tr.getAttribute('data-row-tr'), 10);
        const rObj = boqRows[idx];
        if (!rObj) return;
        const pal = getSectionColorPaletteItem(rObj.sectionNo);
        const topBorderCls = tr.getAttribute('data-top-border-cls') || '';
        if (idx === selectedRowIndex) {
            tr.className = `${pal.selectedCls} ${topBorderCls}`;
            tr.style.cssText = pal.selectedStyle;
        } else {
            tr.className = `${pal.rowCls} ${topBorderCls}`;
            tr.style.cssText = pal.rowStyle;
        }
    });
}

// Track station information sent to Section 1 (รูป 3)
let section1ActiveStationInfo = null;

function loadSelectedRowStationToMain(which) {
    if (!boqRows.length) return;
    const row = boqRows[selectedRowIndex] || boqRows[0];
    const isStart = which === 'start';
    const targetBL = isStart ? Number(row.blStart) : Number(row.blEnd);
    const targetNGL = isStart ? Number(row.nglStart) : Number(row.nglEnd);
    const targetTBL = isStart ? Number(row.tblStart) : Number(row.tblEnd);
    const targetStaM = isStart ? parseStationToMeters(row.staStart) : parseStationToMeters(row.staEnd);
    const targetStaStr = formatMetersToStation(targetStaM);

    section1ActiveStationInfo = {
        canalName: (row.canalName && row.canalName !== '-') ? row.canalName : (row.canalName || '-'),
        subCanalName: (row.subCanalName && row.subCanalName !== '-') ? row.subCanalName : (row.subCanalName || '-'),
        stationFormatted: targetStaStr,
        stationFullText: `กม. ${targetStaStr} (${isStart ? 'รูปที่ 1 • เริ่มต้น' : 'รูปที่ 2 • สิ้นสุด'})`,
        which: which,
        targetBL: targetBL,
        targetNGL: targetNGL,
        targetTBL: targetTBL,
        rowIndex: selectedRowIndex
    };

    if (typeof channels !== 'undefined' && Array.isArray(channels) && channels.length > 0) {
        const matchedCh = channels.find(c =>
            c && String(c.canal || '').trim() === String(row.canalName || '').trim() &&
            String(c.ditch || '').trim() === String(row.subCanalName || '').trim()
        ) || channels[0];
        if (matchedCh) {
            activeChannelId = matchedCh.id;
            if (typeof activeCrossSectionState !== 'undefined' && activeCrossSectionState) {
                activeCrossSectionState.channelId = matchedCh.id;
                activeCrossSectionState.km = targetStaM;
                activeCrossSectionState.sourceTab = 'earthwork';
            }
        }
    }

    if (typeof returnToTakeoff === 'function') returnToTakeoff();
    if (typeof switchMediaViewTab === 'function') switchMediaViewTab('draw');
    if (typeof syncCrossSectionSelectorsUI === 'function') syncCrossSectionSelectorsUI();
    if (typeof redraw === 'function') redraw();
    showToast(`ส่งข้อมูล ${isStart ? 'รูปที่ 1 (กม.เริ่มต้น' : 'รูปที่ 2 (กม.สิ้นสุด'} ${targetStaStr}) ไปยังส่วนรูปตัดขวางในหน้าหลักเรียบร้อยแล้ว`, 'cyan');
}

document.getElementById('btnLoadStartToMain')?.addEventListener('click', () => loadSelectedRowStationToMain('start'));
document.getElementById('btnLoadEndToMain')?.addEventListener('click', () => loadSelectedRowStationToMain('end'));

document.getElementById('btnPrevRow')?.addEventListener('click', () => {
    if (selectedRowIndex > 0) {
        selectedRowIndex--;
        updateComparisonView(true);
    }
});
document.getElementById('btnNextRow')?.addEventListener('click', () => {
    if (selectedRowIndex < boqRows.length - 1) {
        selectedRowIndex++;
        updateComparisonView(true);
    }
});

const hiddenWorkCategories = new Set();

function getVisibleCategories() {
    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
        return WORK_CATEGORIES.filter(c => c.key === selectedCategoryFilter);
    }
    const filtered = WORK_CATEGORIES.filter(c => !hiddenWorkCategories.has(c.key));
    return filtered.length > 0 ? filtered : WORK_CATEGORIES;
}

function syncWorkCategoryToggleButtonsUI() {
    const catStyleMap = {
        stripping: { activeCls: 'px-2 py-1 rounded-lg bg-amber-950/85 hover:bg-amber-900 text-[11px] text-amber-200 border border-amber-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-amber-400 shrink-0' },
        compacted: { activeCls: 'px-2 py-1 rounded-lg bg-teal-950/85 hover:bg-teal-900 text-[11px] text-teal-200 border border-teal-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-teal-400 shrink-0' },
        excavation: { activeCls: 'px-2 py-1 rounded-lg bg-orange-950/85 hover:bg-orange-900 text-[11px] text-orange-200 border border-orange-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-orange-400 shrink-0' },
        manualLeft: { activeCls: 'px-2 py-1 rounded-lg bg-purple-950/85 hover:bg-purple-900 text-[11px] text-purple-200 border border-purple-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-purple-400 shrink-0' },
        manualRight: { activeCls: 'px-2 py-1 rounded-lg bg-purple-950/85 hover:bg-purple-900 text-[11px] text-purple-200 border border-purple-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-purple-400 shrink-0' },
        manualTotal: { activeCls: 'px-2 py-1 rounded-lg bg-purple-950/85 hover:bg-purple-900 text-[11px] text-purple-200 border border-purple-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-purple-400 shrink-0' },
        concrete: { activeCls: 'px-2 py-1 rounded-lg bg-sky-950/85 hover:bg-sky-900 text-[11px] text-sky-200 border border-sky-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-sky-400 shrink-0' },
        subbase: { activeCls: 'px-2 py-1 rounded-lg bg-sky-950/85 hover:bg-sky-900 text-[11px] text-sky-200 border border-sky-500/70 font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0', dotCls: 'w-2 h-2 rounded-full bg-sky-300 shrink-0' }
    };
    const inactiveCls = 'px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] text-slate-500 border border-slate-700/70 font-medium transition flex items-center gap-1 opacity-65 whitespace-nowrap shrink-0';
    const inactiveDotCls = 'w-2 h-2 rounded-full bg-slate-600 shrink-0';

    document.querySelectorAll('button[data-toggle-work-cat]').forEach(btn => {
        const k = btn.getAttribute('data-toggle-work-cat');
        const isVis = !hiddenWorkCategories.has(k);
        const cfg = catStyleMap[k];
        if (!cfg) return;
        btn.className = isVis ? cfg.activeCls : inactiveCls;
        const dot = btn.querySelector('span:first-child');
        if (dot) dot.className = isVis ? cfg.dotCls : inactiveDotCls;
    });

    const btnAll = document.getElementById('btnShowAllWorkCategories');
    if (btnAll) {
        const allShown = hiddenWorkCategories.size === 0;
        btnAll.className = allShown
            ? 'px-2 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 text-[11px] text-cyan-200 border border-cyan-500/60 font-bold transition flex items-center gap-1 shadow-sm'
            : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 border border-amber-500/50 font-semibold transition flex items-center gap-1';
        btnAll.innerHTML = allShown
            ? `<span>👁️ แสดงครบทุกหมวด (8)</span>`
            : `<span>👁️ แสดงอยู่ ${WORK_CATEGORIES.length - hiddenWorkCategories.size}/${WORK_CATEGORIES.length} หมวด (คลิกแสดงทั้งหมด)</span>`;
    }
}


// ============================================================================
// 5.5 COLUMN VISIBILITY TOGGLE SYSTEM (รูป 2: ซ่อน/แสดงคอลัมน์ A-T ยกเว้นคำนวณพื้นที่)
// ============================================================================
const hiddenColumnKeys = new Set();

function renderColumnVisibilityCheckboxes() {
    const container = document.getElementById('colVisibilityCheckboxContainer');
    if (!container) return;
    const nodeColsChecked = showNodeCoordsInTable ? 'checked' : '';
    const nodeToggleCardHtml = `
        <label class="sm:col-span-3 flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/50 hover:border-emerald-400 cursor-pointer select-none transition">
            <div class="flex items-center gap-2">
                <input type="checkbox" id="chkColVisNode1To14" ${nodeColsChecked} class="rounded border-emerald-600 text-emerald-500 focus:ring-emerald-400">
                <span class="px-1.5 py-0.5 rounded bg-emerald-900 border border-emerald-600 font-mono font-bold text-emerald-200 text-[11px] shrink-0">จุด 1-14</span>
                <span class="text-emerald-200 font-semibold text-xs">แสดงคอลัมน์พิกัดจุด 1-14 (กม.เริ่มต้น และ กม.สิ้นสุด)</span>
            </div>
            <span class="text-[10px] text-emerald-300/80">ซ่อน/แสดงคอลัมน์ จุด 1-14</span>
        </label>
    `;
    container.innerHTML = nodeToggleCardHtml + INPUT_COLUMNS.map(col => {
        const isChecked = !hiddenColumnKeys.has(col.key);
        return `
            <label class="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition">
                <input type="checkbox" data-col-key="${col.key}" ${isChecked ? 'checked' : ''} class="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400">
                <span class="w-5 h-5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-cyan-300 text-[11px] flex items-center justify-center shrink-0">${col.colLetter}</span>
                <span class="text-slate-200 text-xs truncate" title="${col.label}">${col.label}</span>
            </label>
        `;
    }).join('');
    document.getElementById('chkColVisNode1To14')?.addEventListener('change', (e) => {
        showNodeCoordsInTable = e.target.checked;
        updateNodeCoordsToggleBtnUI();
        renderBoqTable();
    });

    container.querySelectorAll('input[data-col-key]').forEach(chk => {
        chk.addEventListener('change', () => {
            const k = chk.getAttribute('data-col-key');
            if (chk.checked) {
                hiddenColumnKeys.delete(k);
            } else {
                hiddenColumnKeys.add(k);
            }
            updateColVisibilityButtonBadge();
            renderBoqTable();
        });
    });
    updateColVisibilityButtonBadge();
}

function updateColVisibilityButtonBadge() {
    const btnLbl = document.getElementById('lblColVisibilityBtn');
    if (!btnLbl) return;
    if (hiddenColumnKeys.size > 0) {
        btnLbl.innerText = `👁️ ซ่อนคอลัมน์ (${hiddenColumnKeys.size})`;
    } else {
        btnLbl.innerText = `👁️ ซ่อน/แสดงคอลัมน์ A-U`;
    }
}

function toggleHideColumn(colKey) {
    if (hiddenColumnKeys.has(colKey)) {
        hiddenColumnKeys.delete(colKey);
    } else {
        hiddenColumnKeys.add(colKey);
    }
    renderColumnVisibilityCheckboxes();
    renderBoqTable();
}
window.toggleHideColumn = toggleHideColumn;

function setColumnsVisibilityPreset(preset) {
    if (preset === 'showAll') {
        hiddenColumnKeys.clear();
    } else if (preset === 'hideDims') {
        ['B', 'H', 'TBL', 'TBR', 'tw', 'tb', 'ts', 'dt'].forEach(k => hiddenColumnKeys.add(k));
    } else if (preset === 'hideCanal') {
        ['canalName', 'subCanalName', 'type'].forEach(k => hiddenColumnKeys.add(k));
    } else if (preset === 'hideElevs') {
        ['nglStart', 'tblStart', 'nglEnd', 'tblEnd'].forEach(k => hiddenColumnKeys.add(k));
    }
    renderColumnVisibilityCheckboxes();
    renderBoqTable();
}

const colModal = document.getElementById('columnVisibilityModal');
const btnToggleColModal = document.getElementById('btnToggleColumnVisibility');
const btnCloseColModal = document.getElementById('btnCloseColVisibilityModal');
const btnConfirmColModal = document.getElementById('btnConfirmColVisibility');

if (btnToggleColModal && colModal) {
    btnToggleColModal.addEventListener('click', () => {
        renderColumnVisibilityCheckboxes();
        colModal.classList.remove('hidden');
    });
}
if (btnCloseColModal && colModal) {
    btnCloseColModal.addEventListener('click', () => colModal.classList.add('hidden'));
}
if (btnConfirmColModal && colModal) {
    btnConfirmColModal.addEventListener('click', () => colModal.classList.add('hidden'));
}
if (colModal) {
    colModal.addEventListener('click', (e) => {
        if (e.target.id === 'columnVisibilityModal') colModal.classList.add('hidden');
    });
}

document.getElementById('btnPresetColShowAll')?.addEventListener('click', () => {
    showNodeCoordsInTable = true;
    setColumnsVisibilityPreset('showAll');
});
document.getElementById('btnPresetColHideDims')?.addEventListener('click', () => setColumnsVisibilityPreset('hideDims'));
document.getElementById('btnPresetColHideCanal')?.addEventListener('click', () => setColumnsVisibilityPreset('hideCanal'));
document.getElementById('btnPresetColHideElevs')?.addEventListener('click', () => setColumnsVisibilityPreset('hideElevs'));
document.getElementById('btnPresetColToggleNodes')?.addEventListener('click', () => {
    showNodeCoordsInTable = !showNodeCoordsInTable;
    updateNodeCoordsToggleBtnUI();
    renderBoqTable();
});



// Helper function for row text & background styling based on station split type
function getRowSplitTheme(row) {
    const startTags = Array.isArray(row.staStartTags) ? row.staStartTags : [];
    const endTags = Array.isArray(row.staEndTags) ? row.staEndTags : [];
    const allTags = [...startTags, ...endTags];
    const remark = String(row.remark || '');

    if (allTags.some(t => t === 'zero_stripping') || remark.includes('ขุดลอกหน้าดินเป็น 0')) {
        return {
            type: 'zero_stripping',
            textCls: 'text-amber-300 font-semibold',
            stationCls: 'text-amber-300 font-mono font-bold',
            borderCls: 'border-l-4 border-l-amber-500',
            rowBgCls: 'bg-amber-950/20 hover:bg-amber-900/30',
            badgeCls: 'bg-amber-950/90 border-amber-500/60 text-amber-300',
            badgeLabel: 'ขุดลอก=0'
        };
    }
    if (allTags.some(t => t === 'zero_compacted') || (remark.includes('ดินถมบดอัด') && remark.includes('0'))) {
        return {
            type: 'zero_compacted',
            textCls: 'text-teal-300 font-semibold',
            stationCls: 'text-teal-300 font-mono font-bold',
            borderCls: 'border-l-4 border-l-teal-500',
            rowBgCls: 'bg-teal-950/20 hover:bg-teal-900/30',
            badgeCls: 'bg-teal-950/90 border-teal-500/60 text-teal-300',
            badgeLabel: 'บดอัด85%=0'
        };
    }
    if (allTags.some(t => t === 'zero_excavation') || remark.includes('ดินขุดเป็น 0') || remark.includes('ดินขุด=0')) {
        return {
            type: 'zero_excavation',
            textCls: 'text-orange-300 font-semibold',
            stationCls: 'text-orange-300 font-mono font-bold',
            borderCls: 'border-l-4 border-l-orange-500',
            rowBgCls: 'bg-orange-950/20 hover:bg-orange-900/30',
            badgeCls: 'bg-orange-950/90 border-orange-500/60 text-orange-300',
            badgeLabel: 'ดินขุด=0'
        };
    }
    if (allTags.some(t => t === 'zero_manual') || (remark.includes('ดินถมแรงคน') && remark.includes('0'))) {
        return {
            type: 'zero_manual',
            textCls: 'text-purple-300 font-semibold',
            stationCls: 'text-purple-300 font-mono font-bold',
            borderCls: 'border-l-4 border-l-purple-500',
            rowBgCls: 'bg-purple-950/20 hover:bg-purple-900/30',
            badgeCls: 'bg-purple-950/90 border-purple-500/60 text-purple-300',
            badgeLabel: 'ถมแรงคน=0'
        };
    }
    const hasNglTag = allTags.some(t => t === 'ngl') || remark.includes('จุดหักดินเดิม') || remark.includes('ดินเดิม');
    const hasStepTag = allTags.some(t => t === 'step' || t.startsWith('step:')) || remark.includes('จุดแบ่งทุก');

    if (hasNglTag && hasStepTag) {
        return {
            type: 'ngl_and_step',
            textCls: 'text-emerald-200 font-semibold',
            stationCls: 'text-emerald-300 font-mono font-bold',
            borderCls: 'border-l-4 border-l-emerald-400',
            rowBgCls: 'bg-emerald-950/25 hover:bg-emerald-900/35',
            badgeCls: 'bg-gradient-to-r from-emerald-900/90 to-amber-900/90 border border-emerald-400/70 text-yellow-200',
            badgeLabel: '🌱ดินเดิม+✂️แบ่งระยะ'
        };
    }
    if (hasNglTag) {
        return {
            type: 'ngl',
            textCls: 'text-emerald-300 font-semibold',
            stationCls: 'text-emerald-200 font-mono font-extrabold',
            borderCls: 'border-l-4 border-l-emerald-400',
            rowBgCls: 'bg-emerald-950/35 hover:bg-emerald-900/45',
            badgeCls: 'bg-emerald-900/90 border border-emerald-400/80 text-emerald-200',
            badgeLabel: '🌱 หักดินเดิม'
        };
    }
    if (hasStepTag) {
        return {
            type: 'step',
            textCls: 'text-yellow-200 font-semibold',
            stationCls: 'text-yellow-300 font-mono font-extrabold',
            borderCls: 'border-l-4 border-l-yellow-400',
            rowBgCls: 'bg-amber-950/30 hover:bg-amber-900/40',
            badgeCls: 'bg-yellow-500/25 border border-yellow-400/80 text-yellow-200',
            badgeLabel: '✂️ แบ่งตามระยะ'
        };
    }
    // Base / standard interval
    return {
        type: 'base',
        textCls: 'text-slate-100 font-medium',
        stationCls: 'text-cyan-200 font-mono font-bold',
        borderCls: 'border-l-4 border-l-cyan-600',
        rowBgCls: '',
        badgeCls: 'bg-slate-800 text-slate-300 border-slate-700',
        badgeLabel: 'ช่วงหลัก'
    };
}

// ใส่สีเฉพาะที่ช่อง "กม.เริ่มต้น" (staStart) เท่านั้น สำหรับ กม. ที่ได้จากการแบ่งด้วยปุ่มแบ่ง กม. ต่างๆ
// ส่วน กม.สิ้นสุด (staEnd) และข้อมูลช่องอื่นๆ ให้แสดงสีปกติเหมือนเดิมทั้งหมด
function getSingleStationVisualStyle(row, isStartSide = true) {
    if (!isStartSide) {
        return {
            origin: 'base',
            inputCls: 'text-cyan-300 font-mono font-bold',
            printStyle: 'color: #0f172a; font-weight: bold;'
        };
    }
    const tags = Array.isArray(row.staStartTags) ? row.staStartTags : [];
    const remarkStr = String(row.remark || '');
    let startRemark = '';
    if (remarkStr.includes('→')) {
        startRemark = remarkStr.split('→')[0] || '';
    } else if (remarkStr.includes('->')) {
        startRemark = remarkStr.split('->')[0] || '';
    }

    if (tags.includes('zero_stripping') || startRemark.includes('ขุดลอกหน้าดินเป็น 0')) {
        return {
            origin: 'zero_stripping',
            inputCls: 'bg-amber-500/25 text-amber-200 font-mono font-extrabold ring-1 ring-inset ring-amber-400/85',
            printStyle: 'background-color: #fef3c7; color: #92400e; font-weight: bold;'
        };
    }
    if (tags.includes('zero_compacted') || (startRemark.includes('ดินถมบดอัด') && startRemark.includes('0'))) {
        return {
            origin: 'zero_compacted',
            inputCls: 'bg-teal-500/25 text-teal-200 font-mono font-extrabold ring-1 ring-inset ring-teal-400/85',
            printStyle: 'background-color: #ccfbf1; color: #115e59; font-weight: bold;'
        };
    }
    if (tags.includes('zero_excavation') || startRemark.includes('ดินขุดเป็น 0') || startRemark.includes('ดินขุด=0')) {
        return {
            origin: 'zero_excavation',
            inputCls: 'bg-orange-500/25 text-orange-200 font-mono font-extrabold ring-1 ring-inset ring-orange-400/85',
            printStyle: 'background-color: #ffedd5; color: #9a3412; font-weight: bold;'
        };
    }
    if (tags.includes('zero_manual') || (startRemark.includes('ดินถมแรงคน') && startRemark.includes('0'))) {
        return {
            origin: 'zero_manual',
            inputCls: 'bg-purple-500/25 text-purple-200 font-mono font-extrabold ring-1 ring-inset ring-purple-400/85',
            printStyle: 'background-color: #f3e8ff; color: #6b21a8; font-weight: bold;'
        };
    }
    if (tags.includes('ngl') || startRemark.includes('จุดหักดินเดิม') || startRemark.includes('ดินเดิม')) {
        return {
            origin: 'ngl',
            inputCls: 'bg-emerald-500/25 text-emerald-200 font-mono font-extrabold ring-1 ring-inset ring-emerald-400/85',
            printStyle: 'background-color: #d1fae5; color: #065f46; font-weight: bold;'
        };
    }
    if (tags.some(t => t === 'step' || String(t).startsWith('step:')) || startRemark.includes('จุดแบ่งทุก')) {
        return {
            origin: 'step',
            inputCls: 'bg-yellow-500/25 text-yellow-200 font-mono font-extrabold ring-1 ring-inset ring-yellow-400/85',
            printStyle: 'background-color: #fef08a; color: #854d0e; font-weight: bold;'
        };
    }
    return {
        origin: 'base',
        inputCls: 'text-cyan-300 font-mono font-bold',
        printStyle: 'color: #0f172a; font-weight: bold;'
    };
}



// ============================================================================
// 3.6 DETAILED ROW COMPARISON CALCULATION REPORT (แสดงการคำนวณหาพื้นที่ของแต่ละหมวดงาน เปรียบเทียบกันทั้งสอง กม.)
// ============================================================================
function renderSingleStationCoordTableHtml(calcObj, nodeStr, areaVal, stationLabel, roleLabel, accentHex, headBgHex, boxBgHex, emptyNote) {
    if (!areaVal || areaVal <= 0 || !calcObj || !calcObj.tableRows || !calcObj.tableRows.length) {
        return `
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background-color: #f8fafc; height: 100%;">
                <div style="font-weight: bold; font-size: 11.5px; color: ${accentHex}; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                    <span>${roleLabel}: กม. ${stationLabel}</span>
                    <span style="font-family: monospace;">พื้นที่ = 0.000 ตร.ม.</span>
                </div>
                <div style="font-size: 11px; color: #64748b; font-style: italic; padding: 8px 4px;">
                    * ${emptyNote || 'ไม่มีพื้นที่ในหมวดงานนี้ ณ กม. นี้ (พื้นที่ = 0.000 ตร.ม.)'}
                </div>
            </div>
        `;
    }
    return `
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background-color: #ffffff;">
            <div style="font-weight: bold; font-size: 11.5px; color: ${accentHex}; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                <span>${roleLabel}: กม. ${stationLabel} (Node ${nodeStr})</span>
                <span style="font-family: monospace;">${areaVal.toFixed(3)} ตร.ม.</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10.5px; text-align: center; margin-bottom: 6px;">
                <thead style="background-color: ${headBgHex}; color: ${accentHex}; font-weight: bold;">
                    <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 3px 4px;">Node</th>
                        <th style="border: 1px solid #cbd5e1; padding: 3px 4px;">X (ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 3px 4px;">Y (ม.รทก.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 3px 4px;">Xi × Yi+1</th>
                        <th style="border: 1px solid #cbd5e1; padding: 3px 4px;">Xi+1 × Yi</th>
                    </tr>
                </thead>
                <tbody>
                    ${calcObj.tableRows.map(r => `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; font-weight: bold; color: ${accentHex};">${r.node}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; font-family: monospace;">${r.x.toFixed(2)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; font-family: monospace;">+${r.y.toFixed(2)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; font-family: monospace;">${r.fwd.toFixed(3)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; font-family: monospace;">${r.bwd.toFixed(3)}</td>
                        </tr>
                    `).join('')}
                    <tr style="background-color: ${headBgHex}; font-weight: bold; color: ${accentHex};">
                        <td colspan="3" style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: right;">รวมผลคูณไขว้ (Sum):</td>
                        <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-family: monospace;">${calcObj.sumForward.toFixed(3)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-family: monospace;">${calcObj.sumBackward.toFixed(3)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="background-color: ${boxBgHex}; border-left: 3px solid ${accentHex}; padding: 5px 8px; border-radius: 4px; font-family: monospace; font-size: 10.5px; color: ${accentHex}; line-height: 1.5;">
                <div>2A = |${calcObj.sumForward.toFixed(3)} - (${calcObj.sumBackward.toFixed(3)})| = ${calcObj.diff.toFixed(3)}</div>
                <div style="font-weight: bold;">พื้นที่ A = ${calcObj.diff.toFixed(3)} / 2 = <u>${areaVal.toFixed(3)} ตร.ม.</u></div>
            </div>
        </div>
    `;
}

function generateRowComparisonCalculationReport(rowIndex) {
    const container = document.getElementById('calcReportDocument');
    if (!container) return;
    const rIdx = Math.min(Math.max(0, rowIndex), boqRows.length - 1);
    const row = boqRows[rIdx];
    if (!row) return;

    const ev = evaluateBoqRow(row);
    const sec1 = ev.secStart;
    const sec2 = ev.secEnd;

    // Render crisp diagrams for Start & End cross sections on clean white backgrounds (All Categories)
    const imgStartOverview = renderCalcDiagramWhiteBg(sec1, 'overview', 720, 300);
    const imgEndOverview = renderCalcDiagramWhiteBg(sec2, 'overview', 720, 300);

    const imgStartStrip = renderCalcDiagramWhiteBg(sec1, 'stripping', 680, 285);
    const imgEndStrip = renderCalcDiagramWhiteBg(sec2, 'stripping', 680, 285);

    const imgStartComp = renderCalcDiagramWhiteBg(sec1, 'compacted', 680, 285);
    const imgEndComp = renderCalcDiagramWhiteBg(sec2, 'compacted', 680, 285);

    const imgStartExc = renderCalcDiagramWhiteBg(sec1, 'excavation', 680, 285);
    const imgEndExc = renderCalcDiagramWhiteBg(sec2, 'excavation', 680, 285);

    const imgStartMan = renderCalcDiagramWhiteBg(sec1, 'manual', 680, 285);
    const imgEndMan = renderCalcDiagramWhiteBg(sec2, 'manual', 680, 285);

    const imgStartConc = renderCalcDiagramWhiteBg(sec1, 'concrete', 680, 285);
    const imgEndConc = renderCalcDiagramWhiteBg(sec2, 'concrete', 680, 285);

    const imgStartSub = renderCalcDiagramWhiteBg(sec1, 'subbase', 680, 285);
    const imgEndSub = renderCalcDiagramWhiteBg(sec2, 'subbase', 680, 285);

    // Coordinate calculations for both stations (sec1 = A1, sec2 = A2)
    const calcStrip1 = formatPolygonCalculationSteps(sec1.polys.polyStripping, (sec1.nodeLabels.nodesStrippingStr || '6-7-8-9').split('-').filter(Boolean));
    const calcStrip2 = formatPolygonCalculationSteps(sec2.polys.polyStripping, (sec2.nodeLabels.nodesStrippingStr || '6-7-8-9').split('-').filter(Boolean));

    const calcComp1 = formatPolygonCalculationSteps(sec1.polys.polyCompacted, (sec1.nodeLabels.nodesCompactedStr || '5-6-7-8-9-10').split('-').filter(Boolean));
    const calcComp2 = formatPolygonCalculationSteps(sec2.polys.polyCompacted, (sec2.nodeLabels.nodesCompactedStr || '5-6-7-8-9-10').split('-').filter(Boolean));

    const calcExc1 = formatPolygonCalculationSteps(sec1.polys.polyExcavation, (sec1.nodeLabels.nodesExcavationStr || '5-7-8-10').split('-').filter(Boolean));
    const calcExc2 = formatPolygonCalculationSteps(sec2.polys.polyExcavation, (sec2.nodeLabels.nodesExcavationStr || '5-7-8-10').split('-').filter(Boolean));

    const calcManL1 = formatPolygonCalculationSteps(sec1.polys.polyManualLeft, (sec1.nodeLabels.nodesManualLeftStr || '1-2-3-4-5-6').split('-').filter(Boolean));
    const calcManL2 = formatPolygonCalculationSteps(sec2.polys.polyManualLeft, (sec2.nodeLabels.nodesManualLeftStr || '1-2-3-4-5-6').split('-').filter(Boolean));

    const calcManR1 = formatPolygonCalculationSteps(sec1.polys.polyManualRight, (sec1.nodeLabels.nodesManualRightStr || '9-10-11-12-13-14').split('-').filter(Boolean));
    const calcManR2 = formatPolygonCalculationSteps(sec2.polys.polyManualRight, (sec2.nodeLabels.nodesManualRightStr || '9-10-11-12-13-14').split('-').filter(Boolean));

    // Concrete & Subbase geometry for both stations
    const b1 = sec1.params.B, h1 = sec1.params.H, tw1 = sec1.params.tw, tb1 = sec1.params.tb, ts1 = sec1.params.ts;
    const outerW1 = roundLen(b1 + 2 * tw1), outerH1 = roundLen(h1 + tb1);
    const grossArea1 = roundArea(outerW1 * outerH1), innerArea1 = roundArea(b1 * h1);

    const b2 = sec2.params.B, h2 = sec2.params.H, tw2 = sec2.params.tw, tb2 = sec2.params.tb, ts2 = sec2.params.ts;
    const outerW2 = roundLen(b2 + 2 * tw2), outerH2 = roundLen(h2 + tb2);
    const grossArea2 = roundArea(outerW2 * outerH2), innerArea2 = roundArea(b2 * h2);

    const canalName = (row.canalName && row.canalName !== '-') ? row.canalName : 'คลองส่งน้ำ';
    const subCanalName = (row.subCanalName && row.subCanalName !== '-') ? row.subCanalName : 'คูส่งน้ำ';
    const sectionNoStr = (row.sectionNo !== undefined && String(row.sectionNo).trim() !== '') ? String(row.sectionNo).trim() : String(rIdx + 1);
    const L_val = ev.L;

    const buildVolumeFormulaBoxHtml = (catKey, titleLabel, accentHex, bgHex, borderHex) => {
        const c = ev.calcByCat[catKey];
        return `
            <div style="background-color: ${bgHex}; border: 1px solid ${borderHex}; border-left: 4px solid ${accentHex}; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; color: ${accentHex}; margin-top: 8px; line-height: 1.6;">
                <div>เปรียบเทียบพื้นที่หน้าตัด: <strong>A1 (กม. ${ev.staStartFormatted}) = ${c.a1.toFixed(3)} ตร.ม.</strong> | <strong>A2 (กม. ${ev.staEndFormatted}) = ${c.a2.toFixed(3)} ตร.ม.</strong></div>
                <div>พื้นที่เฉลี่ย Aเฉลี่ย = (A1 + A2) × 0.5 = (${c.a1.toFixed(3)} + ${c.a2.toFixed(3)}) × 0.5 = <strong>${c.aAvg.toFixed(3)} ตร.ม.</strong></div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">
                    ปริมาณงาน ${titleLabel} (V) = Aเฉลี่ย × L = ${c.aAvg.toFixed(3)} × ${roundLen(c.L).toFixed(2)} = <u>${c.vol.toFixed(3)} ลบ.ม.</u>
                </div>
            </div>
        `;
    };

    let html = `
        <!-- 1. Document Header -->
        <div class="text-center border-b-2 border-slate-900 pb-4 space-y-1 bg-white" style="background-color: #ffffff;">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900 text-center" style="line-height: 1.5; margin: 0 0 6px 0; padding: 0;">
                รายการคำนวณเปรียบเทียบรูปตัดขวางและคำนวณปริมาณงาน<br>
                คูส่งน้ำคอนกรีตกรณี U-SHAPE (แถวที่ ${rIdx + 1} จาก ${boqRows.length} • ช่วงคูส่งน้ำที่ ${sectionNoStr})
            </h1>
            <div class="text-xs sm:text-sm text-slate-700 font-semibold text-center">
                แสดงการคำนวณหาพื้นที่หน้าตัด (A1 และ A2) ของแต่ละหมวดงานเปรียบเทียบกันทั้งสอง กม. พร้อมคำนวณปริมาตร
            </div>

            <div style="margin: 8px auto; text-align: center;">
                <div style="display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; background-color: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 6px 14px; font-size: 12px;">
                    <span>คลองส่งน้ำ: <strong style="color: #0369a1; font-weight: bold;">${canalName}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>คูส่งน้ำ: <strong style="color: #0369a1; font-weight: bold;">${subCanalName}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>ช่วงคูส่งน้ำ: <strong style="color: #4338ca; font-weight: bold;">ช่วงที่ ${sectionNoStr}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>ช่วง กม.: <strong style="color: #0d9488; font-family: monospace; font-size: 13px; font-weight: bold;">${ev.staStartFormatted} → ${ev.staEndFormatted}</strong></span>
                    <span style="color: #94a3b8;">•</span>
                    <span>ระยะทาง (L): <strong style="color: #b45309; font-family: monospace; font-size: 13px; font-weight: bold;">${roundLen(L_val).toFixed(2)} ม.</strong></span>
                </div>
            </div>

            <div class="text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-200 pt-2 mt-2">
                <span>วันที่จัดทำ: ${formatThaiDateTime(new Date())}</span>
                <span>สูตรคำนวณ: <strong class="text-emerald-700 font-bold">ปริมาณ (m³) = (A1 + A2) × 0.5 × L</strong></span>
                <span>วิธีพิกัดจุดยอด (Coordinate Method) & เฉลี่ยพื้นที่หน้าตัด</span>
            </div>
        </div>

        <!-- 2. Section 1: Side-by-Side Comparison of Both Stations -->
        <div class="calc-print-avoid space-y-3 pt-2 bg-white" style="background-color: #ffffff;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                1. สรุปข้อมูลระดับและมิติโครงสร้างเปรียบเทียบทั้ง 2 สถานี (กม.เริ่มต้น A1 และ กม.สิ้นสุด A2)
            </h2>

            <table class="w-full text-xs border border-slate-300 rounded-lg" style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; background-color: #ffffff;">
                <thead>
                    <tr style="background-color: #f8fafc; color: #0f172a;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 34%;">พารามิเตอร์การออกแบบ</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; width: 33%; color: #0284c7; background-color: #f0f9ff;">รูปที่ 1: กม.เริ่มต้น (${ev.staStartFormatted})</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; width: 33%; color: #d97706; background-color: #fffbeb;">รูปที่ 2: กม.สิ้นสุด (${ev.staEndFormatted})</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">ระดับดินเดิม (NGL)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #15803d;">${isMissingNglValue(row.nglStart) ? '-' : '+' + roundElev(row.nglStart).toFixed(2) + ' ม.รทก.'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #15803d;">${isMissingNglValue(row.nglEnd) ? '-' : '+' + roundElev(row.nglEnd).toFixed(2) + ' ม.รทก.'}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">ระดับท้องคู (BL.)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #0369a1;">+${roundElev(row.blStart).toFixed(2)} ม.รทก.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #0369a1;">+${roundElev(row.blEnd).toFixed(2)} ม.รทก.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">ระดับหลังคันคลอง (TBL.)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #be123c;">+${roundElev(row.tblStart).toFixed(2)} ม.รทก.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #be123c;">+${roundElev(row.tblEnd).toFixed(2)} ม.รทก.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">ระดับลอกหน้าดิน (NGL - dt)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #b45309;">+${roundElev(sec1.elevs.topsoilElev).toFixed(2)} ม.รทก.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #b45309;">+${roundElev(sec2.elevs.topsoilElev).toFixed(2)} ม.รทก.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">ระดับท้องคอนกรีตหยาบ (BL - tb - ts)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #4338ca;">+${roundElev(sec1.elevs.ELEV_SUBBASE_BOT).toFixed(2)} ม.รทก.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #4338ca;">+${roundElev(sec2.elevs.ELEV_SUBBASE_BOT).toFixed(2)} ม.รทก.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">สภาพงานดินตามระดับ</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-weight: 600; color: #0369a1;">${sec1.flags.statusText}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-weight: 600; color: #d97706;">${sec2.flags.statusText}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">มิติก้นคลองใน (B) × ลึก (H)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.B).toFixed(2)} × ${Number(row.H).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.B).toFixed(2)} × ${Number(row.H).toFixed(2)} ม.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">คันคลองซ้าย (TBL) / ขวา (TBR)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.TBL).toFixed(2)} / ${Number(row.TBR).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.TBL).toFixed(2)} / ${Number(row.TBR).toFixed(2)} ม.</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">หนากำแพง tw / พื้น tb / รองพื้น ts / ลอกดิน dt</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.tw).toFixed(2)} / ${Number(row.tb).toFixed(2)} / ${Number(row.ts).toFixed(2)} / ${Number(row.dt).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; font-family: monospace;">${Number(row.tw).toFixed(2)} / ${Number(row.tb).toFixed(2)} / ${Number(row.ts).toFixed(2)} / ${Number(row.dt).toFixed(2)} ม.</td>
                    </tr>
                </tbody>
            </table>

            <!-- Side-by-side Overview Cross Section Images -->
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                <tr>
                    <td style="width: 50%; vertical-align: top; padding-right: 6px; border: none;">
                        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff;">
                            <img src="${imgStartOverview}" width="360" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #e2e8f0;" alt="รูปตัดขวางรวม กม.เริ่มต้น">
                            <p style="font-size: 11px; color: #0284c7; margin-top: 6px; font-weight: bold;">
                                รูปที่ 1.1 (A1): แผนภาพรวมรูปตัดขวาง ณ กม.เริ่มต้น ${ev.staStartFormatted}
                            </p>
                        </div>
                    </td>
                    <td style="width: 50%; vertical-align: top; padding-left: 6px; border: none;">
                        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background-color: #ffffff;">
                            <img src="${imgEndOverview}" width="360" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px; border: 1px solid #e2e8f0;" alt="รูปตัดขวางรวม กม.สิ้นสุด">
                            <p style="font-size: 11px; color: #d97706; margin-top: 6px; font-weight: bold;">
                                รูปที่ 1.2 (A2): แผนภาพรวมรูปตัดขวาง ณ กม.สิ้นสุด ${ev.staEndFormatted}
                            </p>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- 2.5 ตารางพิกัดจุดยอดทั้ง 14 จุด (Node 1 ถึง Node 14) แยก กม.เริ่มต้น (A1) และ กม.สิ้นสุด (A2) -->
        <div class="calc-print-break calc-print-avoid space-y-2 pt-2 bg-white" style="background-color: #ffffff; page-break-before: always; break-before: page;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                2. ตารางพิกัดจุดยอดทั้ง 14 จุด (Node 1 – Node 14) แยกกันระหว่าง กม.เริ่มต้น (${ev.staStartFormatted}) และ กม.สิ้นสุด (${ev.staEndFormatted})
            </h2>
            <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #94a3b8; background-color: #ffffff; font-size: 11px; text-align: center;">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: bold;">
                        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 5px 6px; width: 12%;">จุด Node</th>
                        <th rowspan="2" style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; width: 28%;">ตำแหน่งบนรูปตัดขวาง</th>
                        <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 8px; background-color: #f0f9ff; color: #0284c7; width: 30%;">กม.เริ่มต้น ${ev.staStartFormatted} (รูปที่ 1 • A1)</th>
                        <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 8px; background-color: #fffbeb; color: #b45309; width: 30%;">กม.สิ้นสุด ${ev.staEndFormatted} (รูปที่ 2 • A2)</th>
                    </tr>
                    <tr style="background-color: #f8fafc; font-size: 10.5px;">
                        <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #f0f9ff; color: #0369a1;">ระยะ X (ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #f0f9ff; color: #0369a1;">ระดับ Y (ม.รทก.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #fffbeb; color: #b45309;">ระยะ X (ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 4px 6px; background-color: #fffbeb; color: #b45309;">ระดับ Y (ม.รทก.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${[
                        { n: 1, desc: 'ตีนลาดคันดินถมฝั่งซ้าย (Outer Berm Toe Left)' },
                        { n: 2, desc: 'ขอบนอกคันคลองฝั่งซ้าย (Outer Berm Crest Left)' },
                        { n: 3, desc: 'ขอบบนผนังคูส่งน้ำฝั่งซ้าย (Top Wall Outer Left)' },
                        { n: 4, desc: 'มุมล่างฐานรองพื้นฝั่งซ้าย (Subbase Bottom Left)' },
                        { n: 5, desc: 'มุมนอกชานพักก้นร่องฝั่งซ้าย (Bottom Step Left)' },
                        { n: 6, desc: 'จุดตัดลาดขุด/ถมกับระดับดินเดิมฝั่งซ้าย (NGL Left)' },
                        { n: 7, desc: 'มุมในชั้นขุดลอกหน้าดินฝั่งซ้าย (Stripping Base Left)' },
                        { n: 8, desc: 'มุมในชั้นขุดลอกหน้าดินฝั่งขวา (Stripping Base Right)' },
                        { n: 9, desc: 'จุดตัดลาดขุด/ถมกับระดับดินเดิมฝั่งขวา (NGL Right)' },
                        { n: 10, desc: 'มุมนอกชานพักก้นร่องฝั่งขวา (Bottom Step Right)' },
                        { n: 11, desc: 'มุมล่างฐานรองพื้นฝั่งขวา (Subbase Bottom Right)' },
                        { n: 12, desc: 'ขอบบนผนังคูส่งน้ำฝั่งขวา (Top Wall Outer Right)' },
                        { n: 13, desc: 'ขอบนอกคันคลองฝั่งขวา (Outer Berm Crest Right)' },
                        { n: 14, desc: 'ตีนลาดคันดินถมฝั่งขวา (Outer Berm Toe Right)' }
                    ].map(item => {
                        const pt1 = sec1.nodes[`p${item.n}`];
                        const pt2 = sec2.nodes[`p${item.n}`];
                        return `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 6px; font-weight: bold; font-family: monospace; color: #15803d;">Node ${item.n}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 8px; text-align: left; color: #334155; font-size: 10.5px;">${item.desc}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 6px; font-family: monospace; color: #0369a1;">${pt1 ? roundLen(pt1.x).toFixed(2) : '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 6px; font-family: monospace; font-weight: 600; color: #0369a1;">${pt1 ? '+' + roundElev(pt1.elev).toFixed(2) : '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 6px; font-family: monospace; color: #b45309;">${pt2 ? roundLen(pt2.x).toFixed(2) : '-'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 3.5px 6px; font-family: monospace; font-weight: 600; color: #b45309;">${pt2 ? '+' + roundElev(pt2.elev).toFixed(2) : '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <!-- 3. Section 3: Summary Calculation of Volumes for this Row -->
        <div class="calc-print-avoid space-y-2 pt-2 bg-white" style="background-color: #ffffff;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                3. ตารางสรุปพื้นที่หน้าตัดเปรียบเทียบ (A1, A2) และการคำนวณปริมาณงานตามสูตร (A1 + A2) × 0.5 × L
            </h2>

            <table class="w-full text-left border-collapse border border-slate-300 text-xs bg-white" style="width: 100%; border-collapse: collapse; border: 1.5px solid #94a3b8; background-color: #ffffff;">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; width: 40px;">#</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">หมวดงาน</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; color: #0284c7;">A1 กม.${ev.staStartFormatted} (ตร.ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; color: #d97706;">A2 กม.${ev.staEndFormatted} (ตร.ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Aเฉลี่ย (ตร.ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">ระยะ L (ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: bold; color: #047857;">ปริมาณงาน (ลบ.ม.)</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">การแทนค่าคำนวณปริมาตร</th>
                    </tr>
                </thead>
                <tbody>
                    ${WORK_CATEGORIES.map((cat, idx) => {
                        const c = ev.calcByCat[cat.key];
                        const aAvg = roundAvgArea(c.a1, c.a2);
                        const isTotalRow = cat.key === 'manualTotal';
                        const rowBg = isTotalRow ? 'background-color: #faf5ff; font-weight: bold;' : 'background-color: #ffffff;';
                        return `
                            <tr style="${rowBg}">
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-family: monospace;">${isTotalRow ? '-' : idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: 600;">${cat.label}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #0369a1;">${c.a1.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #b45309;">${c.a2.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #475569;">${aAvg.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace;">${roundLen(c.L).toFixed(2)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #047857; font-size: 13px;">${c.vol.toFixed(3)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-size: 11px; color: #64748b;">${c.vol > 0 ? `(${c.a1.toFixed(3)} + ${c.a2.toFixed(3)}) × 0.5 × ${roundLen(c.L).toFixed(2)} = ${c.vol.toFixed(3)}` : 'ไม่มีปริมาณงานในช่วงนี้'}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr style="background-color: #fdf2f8;">
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: bold; color: #831843;">ความกว้างขุดลอกหน้าดิน (6-9)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #be185d;">${roundLen(sec1.widths.width69).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #be185d;">${roundLen(sec2.widths.width69).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #be185d;">${roundLen((roundLen(sec1.widths.width69) + roundLen(sec2.widths.width69)) * 0.5).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace;">${roundLen(L_val).toFixed(2)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #be185d;">${roundArea(roundLen((roundLen(sec1.widths.width69) + roundLen(sec2.widths.width69)) * 0.5) * roundLen(L_val)).toFixed(3)} ตร.ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; color: #9d174d; font-size: 11px;">พื้นที่ผิวขุดลอกหน้าดินตามแนวคลอง</td>
                    </tr>
                    <tr style="background-color: #fff1f2;">
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-family: monospace; font-weight: bold;">-</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; font-weight: bold; color: #881337;">ความกว้างคันดินด้านล่าง (1-14)</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #e11d48;">${roundLen(sec1.widths.width114).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; color: #e11d48;">${roundLen(sec2.widths.width114).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #e11d48;">${roundLen((roundLen(sec1.widths.width114) + roundLen(sec2.widths.width114)) * 0.5).toFixed(2)} ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-family: monospace;">${roundLen(L_val).toFixed(2)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #e11d48;">${roundArea(roundLen((roundLen(sec1.widths.width114) + roundLen(sec2.widths.width114)) * 0.5) * roundLen(L_val)).toFixed(3)} ตร.ม.</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 10px; color: #9f1239; font-size: 11px;">ความกว้างฐานดินล่างสุดรวมคันดิน</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 4. Section 4: Detailed Area Calculations Comparing Both Stations (A1 vs A2) + Volume for Every Category -->
        <div class="space-y-4 pt-2 bg-white calc-print-break" style="background-color: #ffffff; page-break-before: always; break-before: page;">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 border-l-4 border-cyan-600 pl-2.5 py-0.5 bg-slate-100" style="background-color: #f1f5f9; border-left: 4px solid #0891b2; padding: 4px 8px; page-break-after: avoid; break-after: avoid;">
                4. รายการคำนวณหาพื้นที่หน้าตัด (A1 และ A2) เปรียบเทียบทั้งสอง กม. แสดงเฉพาะจุดที่เกี่ยวข้องแยกตามหมวดงาน
            </h2>

            <!-- 4.1 หมวดที่ 1: ขุดลอกหน้าดิน -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 12px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #f59e0b; margin-bottom: 8px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #78350f; font-size: 13px;">
                            รายการที่ 1: พื้นที่ขุดลอกหน้าดิน (Stripping) • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #fef3c7; color: #78350f; padding: 2px 8px; border-radius: 4px; border: 1px solid #fcd34d;">
                                A1 = ${sec1.areas.stripping.toFixed(3)} m² | A2 = ${sec2.areas.stripping.toFixed(3)} m² | V = ${ev.calcByCat.stripping.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartStrip}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ขุดลอกหน้าดิน A1">
                                <p style="font-size: 10.5px; color: #78350f; margin-top: 3px; font-weight: bold;">รูปตัดที่ 1 (A1) กม. ${ev.staStartFormatted}: จุดที่เกี่ยวข้อง (${sec1.nodeLabels.nodesStrippingStr}) = ${sec1.areas.stripping.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndStrip}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ขุดลอกหน้าดิน A2">
                                <p style="font-size: 10.5px; color: #78350f; margin-top: 3px; font-weight: bold;">รูปตัดที่ 2 (A2) กม. ${ev.staEndFormatted}: จุดที่เกี่ยวข้อง (${sec2.nodeLabels.nodesStrippingStr}) = ${sec2.areas.stripping.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcStrip1, sec1.nodeLabels.nodesStrippingStr, sec1.areas.stripping, ev.staStartFormatted, 'การคำนวณพื้นที่ A1', '#78350f', '#fef3c7', '#fefce8', 'ไม่มีงานขุดลอกหน้าดิน (dt = 0)')}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcStrip2, sec2.nodeLabels.nodesStrippingStr, sec2.areas.stripping, ev.staEndFormatted, 'การคำนวณพื้นที่ A2', '#78350f', '#fef3c7', '#fefce8', 'ไม่มีงานขุดลอกหน้าดิน (dt = 0)')}
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('stripping', 'ขุดลอกหน้าดิน', '#78350f', '#fefce8', '#fef08a')}
            </div>

            <!-- 4.2 หมวดที่ 2: ดินถมบดอัดแน่น 85% -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 12px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #0d9488; margin-bottom: 8px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #134e4a; font-size: 13px;">
                            รายการที่ 2: พื้นที่ดินถมบดอัดแน่น 85% • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #ccfbf1; color: #134e4a; padding: 2px 8px; border-radius: 4px; border: 1px solid #5eead4;">
                                A1 = ${sec1.areas.compacted.toFixed(3)} m² | A2 = ${sec2.areas.compacted.toFixed(3)} m² | V = ${ev.calcByCat.compacted.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartComp}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินถมบดอัด A1">
                                <p style="font-size: 10.5px; color: #134e4a; margin-top: 3px; font-weight: bold;">รูปตัดที่ 1 (A1) กม. ${ev.staStartFormatted}: จุดที่เกี่ยวข้อง (${sec1.nodeLabels.nodesCompactedStr}) = ${sec1.areas.compacted.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndComp}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินถมบดอัด A2">
                                <p style="font-size: 10.5px; color: #134e4a; margin-top: 3px; font-weight: bold;">รูปตัดที่ 2 (A2) กม. ${ev.staEndFormatted}: จุดที่เกี่ยวข้อง (${sec2.nodeLabels.nodesCompactedStr}) = ${sec2.areas.compacted.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcComp1, sec1.nodeLabels.nodesCompactedStr, sec1.areas.compacted, ev.staStartFormatted, 'การคำนวณพื้นที่ A1', '#134e4a', '#ccfbf1', '#f0fdfa', 'ระดับลอกหน้าดินสูงกว่าท้องรองพื้น จึงไม่มีงานดินถมบดอัดใต้ท้องคู (A1 = 0.000 ตร.ม.)')}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcComp2, sec2.nodeLabels.nodesCompactedStr, sec2.areas.compacted, ev.staEndFormatted, 'การคำนวณพื้นที่ A2', '#134e4a', '#ccfbf1', '#f0fdfa', 'ระดับลอกหน้าดินสูงกว่าท้องรองพื้น จึงไม่มีงานดินถมบดอัดใต้ท้องคู (A2 = 0.000 ตร.ม.)')}
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('compacted', 'ดินถมบดอัดแน่น 85%', '#134e4a', '#f0fdfa', '#ccfbf1')}
            </div>

            <!-- 4.3 หมวดที่ 3: ดินขุด -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 12px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #ea580c; margin-bottom: 8px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #7c2d12; font-size: 13px;">
                            รายการที่ 3: พื้นที่ดินขุด (Excavation) • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #ffedd5; color: #7c2d12; padding: 2px 8px; border-radius: 4px; border: 1px solid #fed7aa;">
                                A1 = ${sec1.areas.excavation.toFixed(3)} m² | A2 = ${sec2.areas.excavation.toFixed(3)} m² | V = ${ev.calcByCat.excavation.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartExc}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินขุด A1">
                                <p style="font-size: 10.5px; color: #7c2d12; margin-top: 3px; font-weight: bold;">รูปตัดที่ 1 (A1) กม. ${ev.staStartFormatted}: จุดที่เกี่ยวข้อง (${sec1.nodeLabels.nodesExcavationStr}) = ${sec1.areas.excavation.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndExc}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินขุด A2">
                                <p style="font-size: 10.5px; color: #7c2d12; margin-top: 3px; font-weight: bold;">รูปตัดที่ 2 (A2) กม. ${ev.staEndFormatted}: จุดที่เกี่ยวข้อง (${sec2.nodeLabels.nodesExcavationStr}) = ${sec2.areas.excavation.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcExc1, sec1.nodeLabels.nodesExcavationStr, sec1.areas.excavation, ev.staStartFormatted, 'การคำนวณพื้นที่ A1', '#7c2d12', '#ffedd5', '#fff7ed', 'ระดับลอกหน้าดินต่ำกว่าท้องรองพื้น สภาพเป็นงานถมสูง (A1 = 0.000 ตร.ม.)')}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; padding-top: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcExc2, sec2.nodeLabels.nodesExcavationStr, sec2.areas.excavation, ev.staEndFormatted, 'การคำนวณพื้นที่ A2', '#7c2d12', '#ffedd5', '#fff7ed', 'ระดับลอกหน้าดินต่ำกว่าท้องรองพื้น สภาพเป็นงานถมสูง (A2 = 0.000 ตร.ม.)')}
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('excavation', 'ดินขุด', '#7c2d12', '#fff7ed', '#ffedd5')}
            </div>

            <!-- 4.4 หมวดที่ 4: ดินถมด้วยแรงคน (ซ้าย / ขวา / รวมสองฝั่ง) - แยกเป็นอีกหน้าหนึ่งตามรูป 2 -->
            <div class="calc-print-break calc-print-avoid" style="page-break-before: always; break-before: page; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 14px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #9333ea; margin-bottom: 6px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #581c87; font-size: 13px;">
                            รายการที่ 4: พื้นที่ดินถมด้วยแรงคน (ซ้าย, ขวา และรวม) • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #f3e8ff; color: #581c87; padding: 2px 8px; border-radius: 4px; border: 1px solid #d8b4fe;">
                                รวม A1 = ${sec1.areas.manualTotal.toFixed(3)} m² | รวม A2 = ${sec2.areas.manualTotal.toFixed(3)} m² | Vรวม = ${ev.calcByCat.manualTotal.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartMan}" width="320" style="width: 100%; max-height: 150px; object-fit: contain; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินถมแรงคน A1">
                                <p style="font-size: 10px; color: #581c87; margin-top: 2px; font-weight: bold;">
                                    รูปตัดที่ 1 (A1) กม. ${ev.staStartFormatted}: ซ้าย ${sec1.areas.manualLeft.toFixed(3)} + ขวา ${sec1.areas.manualRight.toFixed(3)} = ${sec1.areas.manualTotal.toFixed(3)} ตร.ม.
                                </p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndMan}" width="320" style="width: 100%; max-height: 150px; object-fit: contain; display: block; margin: 0 auto; border-radius: 4px;" alt="ดินถมแรงคน A2">
                                <p style="font-size: 10px; color: #581c87; margin-top: 2px; font-weight: bold;">
                                    รูปตัดที่ 2 (A2) กม. ${ev.staEndFormatted}: ซ้าย ${sec2.areas.manualLeft.toFixed(3)} + ขวา ${sec2.areas.manualRight.toFixed(3)} = ${sec2.areas.manualTotal.toFixed(3)} ตร.ม.
                                </p>
                            </div>
                        </td>
                    </tr>
                </table>
                <div style="font-weight: bold; font-size: 11px; color: #581c87; margin: 4px 0 3px 0;">
                    4.1 การคำนวณหาพื้นที่ดินถมด้วยแรงคน (ฝั่งซ้าย • เฉพาะจุดที่เกี่ยวข้อง) เปรียบเทียบทั้งสอง กม.:
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcManL1, sec1.nodeLabels.nodesManualLeftStr, sec1.areas.manualLeft, ev.staStartFormatted, 'ฝั่งซ้าย A1', '#581c87', '#f3e8ff', '#faf5ff', 'ไม่มีพื้นที่ดินถมแรงคนฝั่งซ้าย')}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcManL2, sec2.nodeLabels.nodesManualLeftStr, sec2.areas.manualLeft, ev.staEndFormatted, 'ฝั่งซ้าย A2', '#581c87', '#f3e8ff', '#faf5ff', 'ไม่มีพื้นที่ดินถมแรงคนฝั่งซ้าย')}
                        </td>
                    </tr>
                </table>
                <div style="font-weight: bold; font-size: 11px; color: #581c87; margin: 4px 0 3px 0;">
                    4.2 การคำนวณหาพื้นที่ดินถมด้วยแรงคน (ฝั่งขวา • เฉพาะจุดที่เกี่ยวข้อง) เปรียบเทียบทั้งสอง กม.:
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcManR1, sec1.nodeLabels.nodesManualRightStr, sec1.areas.manualRight, ev.staStartFormatted, 'ฝั่งขวา A1', '#581c87', '#f3e8ff', '#faf5ff', 'ไม่มีพื้นที่ดินถมแรงคนฝั่งขวา')}
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            ${renderSingleStationCoordTableHtml(calcManR2, sec2.nodeLabels.nodesManualRightStr, sec2.areas.manualRight, ev.staEndFormatted, 'ฝั่งขวา A2', '#581c87', '#f3e8ff', '#faf5ff', 'ไม่มีพื้นที่ดินถมแรงคนฝั่งขวา')}
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('manualLeft', 'ดินถมด้วยแรงคน (ซ้าย)', '#581c87', '#faf5ff', '#e9d5ff')}
                ${buildVolumeFormulaBoxHtml('manualRight', 'ดินถมด้วยแรงคน (ขวา)', '#581c87', '#faf5ff', '#e9d5ff')}
                ${buildVolumeFormulaBoxHtml('manualTotal', 'รวมดินถมด้วยแรงคน (ซ้าย+ขวา)', '#581c87', '#f3e8ff', '#d8b4fe')}
            </div>

            <!-- 4.5 หมวดที่ 5 และ 6: โครงสร้างคอนกรีตคูส่งน้ำ & คอนกรีตหยาบรองพื้น - แยกเป็นอีกหน้าหนึ่งตามรูป 2 -->
            <div class="calc-print-break calc-print-avoid" style="page-break-before: always; break-before: page; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 14px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #0284c7; margin-bottom: 8px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #0c4a6e; font-size: 13px;">
                            รายการที่ 5: พื้นที่โครงสร้างคอนกรีตคูส่งน้ำ (U-Shape • Node 3-4-11-12) • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #e0f2fe; color: #0c4a6e; padding: 2px 8px; border-radius: 4px; border: 1px solid #7dd3fc;">
                                A1 = ${sec1.areas.concrete.toFixed(3)} m² | A2 = ${sec2.areas.concrete.toFixed(3)} m² | V = ${ev.calcByCat.concrete.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartConc}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="คอนกรีต A1">
                                <p style="font-size: 10.5px; color: #0c4a6e; margin-top: 4px; font-weight: bold;">รูปตัดที่ 1 (A1): โครงสร้างคอนกรีต กม. ${ev.staStartFormatted} = ${sec1.areas.concrete.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndConc}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="คอนกรีต A2">
                                <p style="font-size: 10.5px; color: #0c4a6e; margin-top: 4px; font-weight: bold;">รูปตัดที่ 2 (A2): โครงสร้างคอนกรีต กม. ${ev.staEndFormatted} = ${sec2.areas.concrete.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; padding-top: 6px; border: none;">
                            <div style="border: 1px solid #bae6fd; border-radius: 6px; padding: 8px; background-color: #f0f9ff; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.6;">
                                <div style="font-weight: bold; border-bottom: 1px solid #bae6fd; padding-bottom: 3px; margin-bottom: 4px;">การคำนวณพื้นที่ A1 (กม. ${ev.staStartFormatted}):</div>
                                <div>กว้างกรอบนอก = B + 2tw = ${b1.toFixed(2)} + 2(${tw1.toFixed(2)}) = ${outerW1.toFixed(2)} ม.</div>
                                <div>สูงกรอบนอก = H + tb = ${h1.toFixed(2)} + ${tb1.toFixed(2)} = ${outerH1.toFixed(2)} ม.</div>
                                <div>พื้นที่กรอบนอก = ${outerW1.toFixed(2)} × ${outerH1.toFixed(2)} = ${grossArea1.toFixed(3)} ตร.ม.</div>
                                <div>พื้นที่ช่องเปิดใน = B × H = ${b1.toFixed(2)} × ${h1.toFixed(2)} = ${innerArea1.toFixed(3)} ตร.ม.</div>
                                <div style="font-weight: bold; margin-top: 3px;">พื้นที่คอนกรีต A1 = ${grossArea1.toFixed(3)} - ${innerArea1.toFixed(3)} = <u>${sec1.areas.concrete.toFixed(3)} ตร.ม.</u></div>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; padding-top: 6px; border: none;">
                            <div style="border: 1px solid #bae6fd; border-radius: 6px; padding: 8px; background-color: #f0f9ff; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.6;">
                                <div style="font-weight: bold; border-bottom: 1px solid #bae6fd; padding-bottom: 3px; margin-bottom: 4px;">การคำนวณพื้นที่ A2 (กม. ${ev.staEndFormatted}):</div>
                                <div>กว้างกรอบนอก = B + 2tw = ${b2.toFixed(2)} + 2(${tw2.toFixed(2)}) = ${outerW2.toFixed(2)} ม.</div>
                                <div>สูงกรอบนอก = H + tb = ${h2.toFixed(2)} + ${tb2.toFixed(2)} = ${outerH2.toFixed(2)} ม.</div>
                                <div>พื้นที่กรอบนอก = ${outerW2.toFixed(2)} × ${outerH2.toFixed(2)} = ${grossArea2.toFixed(3)} ตร.ม.</div>
                                <div>พื้นที่ช่องเปิดใน = B × H = ${b2.toFixed(2)} × ${h2.toFixed(2)} = ${innerArea2.toFixed(3)} ตร.ม.</div>
                                <div style="font-weight: bold; margin-top: 3px;">พื้นที่คอนกรีต A2 = ${grossArea2.toFixed(3)} - ${innerArea2.toFixed(3)} = <u>${sec2.areas.concrete.toFixed(3)} ตร.ม.</u></div>
                            </div>
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('concrete', 'โครงสร้างคอนกรีต', '#0c4a6e', '#f0f9ff', '#bae6fd')}
            </div>

            <!-- 4.6 หมวดที่ 6: คอนกรีตหยาบรองพื้น (อยู่หน้าเดียวกับรายการที่ 5 ตามรูป 2) -->
            <div class="calc-print-avoid" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background-color: #ffffff; margin-bottom: 12px;">
                <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 2px solid #0284c7; margin-bottom: 8px;">
                    <tr>
                        <td style="border: none; padding: 0 0 5px 0; text-align: left; font-weight: bold; color: #0c4a6e; font-size: 13px;">
                            รายการที่ 6: พื้นที่คอนกรีตหยาบรองพื้น (Subbase • Node 4-11) • กม. ${ev.staStartFormatted} (A1) เทียบ กม. ${ev.staEndFormatted} (A2)
                        </td>
                        <td style="border: none; padding: 0 0 5px 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 11px; font-family: monospace; font-weight: bold; background-color: #e0f2fe; color: #0c4a6e; padding: 2px 8px; border-radius: 4px; border: 1px solid #7dd3fc;">
                                A1 = ${sec1.areas.subbase.toFixed(3)} m² | A2 = ${sec2.areas.subbase.toFixed(3)} m² | V = ${ev.calcByCat.subbase.vol.toFixed(3)} m³
                            </span>
                        </td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: center; background-color: #ffffff;">
                                <img src="${imgStartSub}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="คอนกรีตหยาบ A1">
                                <p style="font-size: 10.5px; color: #0c4a6e; margin-top: 4px; font-weight: bold;">รูปตัดที่ 1 (A1): คอนกรีตหยาบ กม. ${ev.staStartFormatted} = ${sec1.areas.subbase.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; border: none;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: center; background-color: #ffffff;">
                                <img src="${imgEndSub}" width="340" style="width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px;" alt="คอนกรีตหยาบ A2">
                                <p style="font-size: 10.5px; color: #0c4a6e; margin-top: 4px; font-weight: bold;">รูปตัดที่ 2 (A2): คอนกรีตหยาบ กม. ${ev.staEndFormatted} = ${sec2.areas.subbase.toFixed(3)} ตร.ม.</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 5px; padding-top: 6px; border: none;">
                            <div style="border: 1px solid #bae6fd; border-radius: 6px; padding: 8px; background-color: #f0f9ff; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.6;">
                                <div style="font-weight: bold; border-bottom: 1px solid #bae6fd; padding-bottom: 3px; margin-bottom: 4px;">การคำนวณพื้นที่ A1 (กม. ${ev.staStartFormatted}):</div>
                                <div>ความกว้างฐานรองพื้น = B + 2tw = ${outerW1.toFixed(2)} ม.</div>
                                <div>ความหนาคอนกรีตหยาบ (ts) = ${ts1.toFixed(2)} ม.</div>
                                <div style="font-weight: bold; margin-top: 3px;">พื้นที่คอนกรีตหยาบ A1 = ${outerW1.toFixed(2)} × ${ts1.toFixed(2)} = <u>${sec1.areas.subbase.toFixed(3)} ตร.ม.</u></div>
                            </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 5px; padding-top: 6px; border: none;">
                            <div style="border: 1px solid #bae6fd; border-radius: 6px; padding: 8px; background-color: #f0f9ff; font-family: monospace; font-size: 11px; color: #0c4a6e; line-height: 1.6;">
                                <div style="font-weight: bold; border-bottom: 1px solid #bae6fd; padding-bottom: 3px; margin-bottom: 4px;">การคำนวณพื้นที่ A2 (กม. ${ev.staEndFormatted}):</div>
                                <div>ความกว้างฐานรองพื้น = B + 2tw = ${outerW2.toFixed(2)} ม.</div>
                                <div>ความหนาคอนกรีตหยาบ (ts) = ${ts2.toFixed(2)} ม.</div>
                                <div style="font-weight: bold; margin-top: 3px;">พื้นที่คอนกรีตหยาบ A2 = ${outerW2.toFixed(2)} × ${ts2.toFixed(2)} = <u>${sec2.areas.subbase.toFixed(3)} ตร.ม.</u></div>
                            </div>
                        </td>
                    </tr>
                </table>
                ${buildVolumeFormulaBoxHtml('subbase', 'คอนกรีตหยาบรองพื้น', '#0c4a6e', '#f0f9ff', '#bae6fd')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}



// Longitudinal Profile Cursor & Interactive Scrubber (รูป 5)
let profileCursorStation = null;

function getInterpolatedProfileValues(staM) {
    if (!boqRows.length) return { ngl: 0, bl: 0, tbl: 0, rowIndex: 0 };
    const activeRowForProfile = boqRows[selectedRowIndex] || boqRows[0];
    const activeLineKey = activeRowForProfile ? makeCanalLineKey(activeRowForProfile.canalName, activeRowForProfile.subCanalName) : '__BLANK__';
    const lineIndices = [];
    for (let i = 0; i < boqRows.length; i++) {
        if (makeCanalLineKey(boqRows[i].canalName, boqRows[i].subCanalName) === activeLineKey) {
            lineIndices.push(i);
        }
    }
    const indicesToSearch = lineIndices.length > 0 ? lineIndices : boqRows.map((_, i) => i);

    let foundRow = null;
    let foundIdx = indicesToSearch[0];
    for (let k = 0; k < indicesToSearch.length; k++) {
        const i = indicesToSearch[k];
        const s1 = parseStationToMeters(boqRows[i].staStart);
        const s2 = parseStationToMeters(boqRows[i].staEnd);
        if (staM >= Math.min(s1, s2) - 0.001 && staM <= Math.max(s1, s2) + 0.001) {
            foundRow = boqRows[i];
            foundIdx = i;
            break;
        }
    }
    if (!foundRow) {
        const firstIdx = indicesToSearch[0];
        const lastIdx = indicesToSearch[indicesToSearch.length - 1];
        if (staM <= parseStationToMeters(boqRows[firstIdx].staStart)) {
            foundRow = boqRows[firstIdx];
            foundIdx = firstIdx;
        } else {
            foundRow = boqRows[lastIdx];
            foundIdx = lastIdx;
        }
    }
    const s1 = parseStationToMeters(foundRow.staStart);
    const s2 = parseStationToMeters(foundRow.staEnd);
    const span = s2 - s1;
    const t = Math.abs(span) > 1e-4 ? Math.max(0, Math.min(1, (staM - s1) / span)) : 0;
    const ngl = (isMissingNglValue(foundRow.nglStart) || isMissingNglValue(foundRow.nglEnd)) ? '-' : roundElev(Number(foundRow.nglStart) + t * (Number(foundRow.nglEnd) - Number(foundRow.nglStart)));
    const bl = roundElev(Number(foundRow.blStart) + t * (Number(foundRow.blEnd) - Number(foundRow.blStart)));
    const tbl = roundElev(Number(foundRow.tblStart) + t * (Number(foundRow.tblEnd) - Number(foundRow.tblStart)));
    return { ngl, bl, tbl, rowIndex: foundIdx, row: foundRow };
}


// ระบบแสดงพิกัดจุด 14 จุด (กม.เริ่มต้น และ กม.สิ้นสุด แยกกัน) และกรองเฉพาะจุดที่เกี่ยวข้องเมื่อแยกแสดงแต่ละงาน
const ALL_14_NODE_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
let showNodeCoordsInTable = true;

function getSectionActiveNodeNumbers(sec, catKey) {
    if (!sec || !sec.nodes) return [];
    if (!catKey || catKey === 'all' || catKey === 'overview') {
        return ALL_14_NODE_NUMS.filter(n => !!sec.nodes[`p${n}`]);
    }
    const parseNodeStr = (s) => {
        if (!s || s === '-') return [];
        return String(s).split('-').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 14);
    };
    if (catKey === 'stripping') {
        return sec.areas.stripping > 0 ? parseNodeStr(sec.nodeLabels.nodesStrippingStr) : [];
    }
    if (catKey === 'compacted') {
        return sec.areas.compacted > 0 ? parseNodeStr(sec.nodeLabels.nodesCompactedStr) : [];
    }
    if (catKey === 'excavation') {
        return sec.areas.excavation > 0 ? parseNodeStr(sec.nodeLabels.nodesExcavationStr) : [];
    }
    if (catKey === 'manualLeft') {
        return sec.areas.manualLeft > 0 ? parseNodeStr(sec.nodeLabels.nodesManualLeftStr) : [];
    }
    if (catKey === 'manualRight') {
        return sec.areas.manualRight > 0 ? parseNodeStr(sec.nodeLabels.nodesManualRightStr) : [];
    }
    if (catKey === 'manual' || catKey === 'manualTotal') {
        const l = sec.areas.manualLeft > 0 ? parseNodeStr(sec.nodeLabels.nodesManualLeftStr) : [];
        const r = sec.areas.manualRight > 0 ? parseNodeStr(sec.nodeLabels.nodesManualRightStr) : [];
        return Array.from(new Set([...l, ...r]));
    }
    if (catKey === 'concrete') {
        return [3, 4, 11, 12];
    }
    if (catKey === 'subbase') {
        return sec.areas.subbase > 0 ? [4, 11] : [];
    }
    return ALL_14_NODE_NUMS;
}

function getVisibleNodeNumbersForTable(catFilter) {
    const visCats = getVisibleCategories();
    const isAllCatsVisible = visCats.length === WORK_CATEGORIES.length && (!catFilter || catFilter === 'all');
    if (isAllCatsVisible) {
        return ALL_14_NODE_NUMS;
    }
    const fallbackMap = {
        stripping: [6, 7, 8, 9],
        compacted: [5, 6, 7, 8, 9, 10],
        excavation: [5, 7, 8, 10],
        manualLeft: [1, 2, 3, 4, 5, 6],
        manualRight: [9, 10, 11, 12, 13, 14],
        manualTotal: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14],
        concrete: [3, 4, 11, 12],
        subbase: [4, 11]
    };
    const activeSet = new Set();
    (boqRows || []).forEach(r => {
        const ev = evaluateBoqRow(r);
        visCats.forEach(cat => {
            getSectionActiveNodeNumbers(ev.secStart, cat.key).forEach(n => activeSet.add(n));
            getSectionActiveNodeNumbers(ev.secEnd, cat.key).forEach(n => activeSet.add(n));
        });
    });
    if (activeSet.size > 0) {
        return Array.from(activeSet).sort((a, b) => a - b);
    }
    visCats.forEach(cat => {
        (fallbackMap[cat.key] || []).forEach(n => activeSet.add(n));
    });
    return activeSet.size > 0 ? Array.from(activeSet).sort((a, b) => a - b) : ALL_14_NODE_NUMS;
}

function formatNodeCoordCellText(sec, nodeNum, catFilter) {
    if (!sec || !sec.nodes || (sec.flags && sec.flags.hasNgl === false)) return '-';
    const pt = sec.nodes[`p${nodeNum}`];
    if (!pt) return '-';
    const visCats = getVisibleCategories();
    const isAllCatsVisible = visCats.length === WORK_CATEGORIES.length && (!catFilter || catFilter === 'all');
    if (!isAllCatsVisible) {
        let isRelevant = false;
        for (let i = 0; i < visCats.length; i++) {
            const activeNums = getSectionActiveNodeNumbers(sec, visCats[i].key);
            if (activeNums.includes(nodeNum)) {
                isRelevant = true;
                break;
            }
        }
        if (!isRelevant) return '-';
    }
    const xStr = (pt.x >= 0 ? '+' : '') + roundLen(pt.x).toFixed(2);
    const yStr = (pt.elev >= 0 ? '+' : '') + roundElev(pt.elev).toFixed(2);
    return `(${xStr}, ${yStr})`;
}

function updateNodeCoordsToggleBtnUI() {
    const btn = document.getElementById('btnToggleNodeCoordsCols');
    const lbl = document.getElementById('lblToggleNodeCoordsBtn');
    if (!btn || !lbl) return;
    const visibleNodes = getVisibleNodeNumbersForTable(selectedCategoryFilter);
    const countTxt = selectedCategoryFilter === 'all' ? 'จุด 1-14' : `เฉพาะจุดที่เกี่ยวข้อง ${visibleNodes.length} จุด`;
    if (showNodeCoordsInTable) {
        btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 text-xs text-emerald-300 border border-emerald-500/50 font-semibold transition flex items-center gap-1.5 shadow';
        lbl.innerText = `📍 ซ่อนคอลัมน์ ${countTxt}`;
    } else {
        btn.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 border border-slate-700 font-medium transition flex items-center gap-1.5';
        lbl.innerText = `📍 แสดงคอลัมน์ ${countTxt}`;
    }
}

document.getElementById('btnToggleNodeCoordsCols')?.addEventListener('click', () => {
    showNodeCoordsInTable = !showNodeCoordsInTable;
    const selCat = document.getElementById('selectCategoryView');
    if (selCat && selectedCategoryFilter === 'all') {
        selCat.value = showNodeCoordsInTable ? 'all' : 'all_hide_nodes';
    }
    updateNodeCoordsToggleBtnUI();
    renderBoqTable();
});

// ผูกปุ่มแสดง/ซ่อนแต่ละหมวดงานบนแถวที่ 2 (เมื่อกดปุ่ม 6. รวมถมแรงคน ให้ซ่อน/แสดงกลุ่มถมแรงคนทั้งซ้าย-ขวา-รวมพร้อมกัน)
document.querySelectorAll('button[data-toggle-work-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-toggle-work-cat');
        if (!k) return;
        selectedCategoryFilter = 'all';
        const keysToToggle = k === 'manualTotal' ? ['manualLeft', 'manualRight', 'manualTotal'] : [k];
        const isCurrentlyHidden = hiddenWorkCategories.has(k);
        if (isCurrentlyHidden) {
            keysToToggle.forEach(tk => hiddenWorkCategories.delete(tk));
        } else {
            const remainingVisible = WORK_CATEGORIES.filter(c => !hiddenWorkCategories.has(c.key) && !keysToToggle.includes(c.key));
            if (remainingVisible.length === 0) {
                showToast('ต้องแสดงผลอย่างน้อย 1 หมวดงานในตารางครับ', 'amber');
                return;
            }
            keysToToggle.forEach(tk => hiddenWorkCategories.add(tk));
        }
        syncWorkCategoryToggleButtonsUI();
        updateNodeCoordsToggleBtnUI();
        renderBoqTable();
    });
});

document.getElementById('btnShowAllWorkCategories')?.addEventListener('click', () => {
    selectedCategoryFilter = 'all';
    if (hiddenWorkCategories.size > 0) {
        hiddenWorkCategories.clear();
        showToast('👁️ แสดงครบทุกหมวดงานเรียบร้อยแล้ว', 'cyan');
    } else {
        // หากแสดงครบอยู่แล้ว ให้ซ่อนเหลือหมวดแรกเพื่อเลือกเปิดทีละหมวดได้สะดวก
        WORK_CATEGORIES.slice(1).forEach(c => hiddenWorkCategories.add(c.key));
        showToast('เลือกแสดงเฉพาะหมวดที่ 1 (คลิกปุ่มหมวดงานอื่นเพื่อเปิดเพิ่มได้ทันที)', 'cyan');
    }
    syncWorkCategoryToggleButtonsUI();
    updateNodeCoordsToggleBtnUI();
    renderBoqTable();
});

// ============================================================================
// ระบบ "ค่าเริ่มต้นคูส่งน้ำ" (Canal Defaults Modal & U-SHAPE Dimension Table ตามรูป 1 และ รูป 2)
// ============================================================================
function renderUShapeTypeTableModal() {
    const tbody = document.getElementById('uShapeTypeTableBody');
    if (!tbody) return;
    tbody.innerHTML = uShapeTypeTable.map((item, idx) => {
        const isLast = idx === uShapeTypeTable.length - 1;
        const canDelete = uShapeTypeTable.length > 1;
        const rowBgCls = idx % 2 === 0
            ? 'bg-slate-950/80 hover:bg-slate-800/80 transition'
            : 'bg-slate-900/60 hover:bg-slate-800/80 transition';
        return `
            <tr class="${rowBgCls}">
                <td class="p-1 border-r border-slate-800/80">
                    <div class="flex items-center justify-center gap-1.5 relative">
                        <input
                            type="text"
                            data-ushape-idx="${idx}"
                            data-ushape-field="type"
                            value="${item.type}"
                            class="w-24 px-2 py-1 text-center font-mono font-bold text-amber-300 bg-transparent focus:bg-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        >
                        ${isLast ? `
                            <button type="button" data-ushape-add-inline="1" class="w-5 h-5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs leading-none flex items-center justify-center shadow border border-emerald-400/50 transition shrink-0" title="เพิ่มแถว Type ใหม่">+</button>
                        ` : ''}
                    </div>
                </td>
                <td class="p-1 border-r border-slate-800/80">
                    <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        data-ushape-idx="${idx}"
                        data-ushape-field="B"
                        value="${ roundLen(item.B).toFixed(2) }"
                        class="w-24 px-2 py-1 text-center font-mono font-semibold text-cyan-300 bg-transparent focus:bg-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    >
                </td>
                <td class="p-1">
                    <div class="flex items-center justify-center gap-1.5">
                        <input
                            type="number"
                            step="0.01"
                            min="0.05"
                            data-ushape-idx="${idx}"
                            data-ushape-field="H"
                            value="${ roundLen(item.H).toFixed(2) }"
                            class="w-24 px-2 py-1 text-center font-mono font-semibold text-emerald-300 bg-transparent focus:bg-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        >
                        ${canDelete && idx >= 6 ? `
                            <button type="button" data-ushape-del-idx="${idx}" class="text-slate-500 hover:text-rose-400 font-bold text-xs px-1 transition" title="ลบแถวนี้">✕</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('input[data-ushape-idx]').forEach(inp => {
        inp.addEventListener('change', () => {
            const idx = parseInt(inp.getAttribute('data-ushape-idx'), 10);
            const field = inp.getAttribute('data-ushape-field');
            if (!uShapeTypeTable[idx]) return;
            if (field === 'type') {
                uShapeTypeTable[idx].type = String(inp.value || '').trim() || `VU${idx + 1}`;
                inp.value = uShapeTypeTable[idx].type;
            } else {
                const val = parseFloat(inp.value);
                if (!isNaN(val) && val > 0) {
                    uShapeTypeTable[idx][field] = roundLen(val);
                    inp.value = uShapeTypeTable[idx][field].toFixed(2);
                } else {
                    inp.value = roundLen(uShapeTypeTable[idx][field]).toFixed(2);
                }
            }
        });
    });

    tbody.querySelectorAll('button[data-ushape-add-inline]').forEach(btn => {
        btn.addEventListener('click', addNewUShapeTypeRowInModal);
    });

    tbody.querySelectorAll('button[data-ushape-del-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-ushape-del-idx'), 10);
            if (uShapeTypeTable.length > 1 && !isNaN(idx)) {
                uShapeTypeTable.splice(idx, 1);
                renderUShapeTypeTableModal();
            }
        });
    });
}

function addNewUShapeTypeRowInModal() {
    const nextNum = uShapeTypeTable.length + 1;
    const lastItem = uShapeTypeTable[uShapeTypeTable.length - 1] || { B: 0.70, H: 0.80 };
    uShapeTypeTable.push({
        type: `VU${nextNum}`,
        B: roundLen(lastItem.B),
        H: roundLen(lastItem.H + 0.10)
    });
    renderUShapeTypeTableModal();
}

function syncCanalDefaultsInputsFromState() {
    const elTw = document.getElementById('defInputTw');
    const elTb = document.getElementById('defInputTb');
    const elTs = document.getElementById('defInputTs');
    const elDt = document.getElementById('defInputDt');
    if (elTw) elTw.value = roundLen(canalDefaultParams.tw).toFixed(2);
    if (elTb) elTb.value = roundLen(canalDefaultParams.tb).toFixed(2);
    if (elTs) elTs.value = roundLen(canalDefaultParams.ts).toFixed(2);
    if (elDt) elDt.value = roundLen(canalDefaultParams.dt).toFixed(2);
    renderUShapeTypeTableModal();
}

function readCanalDefaultsModalInputsToState() {
    const elTw = document.getElementById('defInputTw');
    const elTb = document.getElementById('defInputTb');
    const elTs = document.getElementById('defInputTs');
    const elDt = document.getElementById('defInputDt');
    const twVal = parseFloat(elTw?.value);
    const tbVal = parseFloat(elTb?.value);
    const tsVal = parseFloat(elTs?.value);
    const dtVal = parseFloat(elDt?.value);

    canalDefaultParams.tw = (!isNaN(twVal) && twVal > 0) ? roundLen(twVal) : 0.10;
    canalDefaultParams.tb = (!isNaN(tbVal) && tbVal > 0) ? roundLen(tbVal) : 0.10;
    canalDefaultParams.ts = (!isNaN(tsVal) && tsVal >= 0) ? roundLen(tsVal) : 0.05;
    canalDefaultParams.dt = (!isNaN(dtVal) && dtVal >= 0) ? roundLen(dtVal) : 0.30;

    const tbody = document.getElementById('uShapeTypeTableBody');
    if (tbody) {
        tbody.querySelectorAll('input[data-ushape-idx]').forEach(inp => {
            const idx = parseInt(inp.getAttribute('data-ushape-idx'), 10);
            const field = inp.getAttribute('data-ushape-field');
            if (!uShapeTypeTable[idx]) return;
            if (field === 'type') {
                uShapeTypeTable[idx].type = String(inp.value || '').trim() || `VU${idx + 1}`;
            } else {
                const v = parseFloat(inp.value);
                if (!isNaN(v) && v > 0) {
                    uShapeTypeTable[idx][field] = roundLen(v);
                }
            }
        });
    }
}

function applyCanalDefaultsToAllTableRows() {
    readCanalDefaultsModalInputsToState();
    syncCanalDefaultsInputsFromState();

    if (boqRows.length > 0 || masterBoqRows.length > 0) {
        pushUndoSnapshot('นำค่าเริ่มต้นคูส่งน้ำและตารางมิติ U-SHAPE ไปใช้กับตาราง');
        [boqRows, masterBoqRows].forEach(arr => {
            arr.forEach(r => {
                r.tw = roundLen(canalDefaultParams.tw);
                r.tb = roundLen(canalDefaultParams.tb);
                r.ts = roundLen(canalDefaultParams.ts);
                r.dt = roundLen(canalDefaultParams.dt);
                const matched = findUShapeTypeSpec(r.type);
                if (matched) {
                    r.B = roundLen(matched.B);
                    r.H = roundLen(matched.H);
                }
                // การคำนวณ: 1. ระดับ TBL. = BL. + H
                r.tblStart = roundElev(roundElev(r.blStart) + roundLen(r.H));
                r.tblEnd = roundElev(roundElev(r.blEnd) + roundLen(r.H));
            });
        });
        renderBoqTable();
        if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
        showBanner(`✅ นำค่าเริ่มต้นคูส่งน้ำ (tw=${canalDefaultParams.tw.toFixed(2)}, tb=${canalDefaultParams.tb.toFixed(2)}, ts=${canalDefaultParams.ts.toFixed(2)}, dt=${canalDefaultParams.dt.toFixed(2)}), มิติ B/H ตาม TYPE และคำนวณ ระดับ TBL. = BL. + H ไปใช้ครบทั้ง ${boqRows.length} แถวเรียบร้อยแล้ว`, 'emerald');
        showToast(`✅ อัปเดตค่าเริ่มต้นคูส่งน้ำและ TBL. = BL. + H ทั้ง ${boqRows.length} แถวแล้ว`, 'emerald');
    } else {
        if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
        showToast(`💾 บันทึกค่าเริ่มต้นคูส่งน้ำ (tw=${canalDefaultParams.tw.toFixed(2)}, tb=${canalDefaultParams.tb.toFixed(2)}, ts=${canalDefaultParams.ts.toFixed(2)}, dt=${canalDefaultParams.dt.toFixed(2)}) และตารางมิติ U-SHAPE แล้ว`, 'emerald');
    }
    document.getElementById('canalDefaultsModal')?.classList.add('hidden');
}

let refreshIconAngle = 0;
document.getElementById('btnRefreshBoqTableData')?.addEventListener('click', () => {
    if (document.activeElement && document.activeElement.classList.contains('table-cell-input')) {
        document.activeElement.blur();
    }
    const iconEl = document.getElementById('iconRefreshBoqTable');
    if (iconEl) {
        refreshIconAngle += 360;
        iconEl.style.transform = `rotate(${refreshIconAngle}deg)`;
    }
    if (boqRows.length === 0 && (!masterBoqRows || masterBoqRows.length === 0) && typeof syncEarthworkFromTakeoff === 'function') {
        syncEarthworkFromTakeoff(true);
        return;
    }
    if (boqRows.length > 0 || masterBoqRows.length > 0) {
        recalculateSectionNumbersByCanalLine(boqRows);
        if (Array.isArray(masterBoqRows) && masterBoqRows.length) {
            recalculateSectionNumbersByCanalLine(masterBoqRows);
        }
    }
    renderBoqTable();
    updateComparisonView(false);
    drawLongitudinalProfile();
    syncSplitButtonsStatusUI();
    showToast('🔄 รีเฟรชและอัปเดตข้อมูลตารางคำนวณเรียบร้อยแล้ว', 'cyan');
});

document.getElementById('btnOpenCanalDefaultsModal')?.addEventListener('click', () => {
    syncCanalDefaultsInputsFromState();
    document.getElementById('canalDefaultsModal')?.classList.remove('hidden');
});
document.getElementById('btnCloseCanalDefaultsModal')?.addEventListener('click', () => {
    document.getElementById('canalDefaultsModal')?.classList.add('hidden');
});
document.getElementById('btnAddUShapeTypeRow')?.addEventListener('click', () => {
    addNewUShapeTypeRowInModal();
});
document.getElementById('btnResetCanalDefaults')?.addEventListener('click', () => {
    canalDefaultParams = getStandardCanalDefaultParams();
    uShapeTypeTable = getStandardUShapeTypeTable();
    syncCanalDefaultsInputsFromState();
    showToast('↺ คืนค่าเริ่มต้นคูส่งน้ำและตารางมิติ U-SHAPE (VU1–VU6) ตามมาตรฐานแล้ว', 'cyan');
});
document.getElementById('btnSaveCanalDefaultsOnly')?.addEventListener('click', () => {
    readCanalDefaultsModalInputsToState();
    syncCanalDefaultsInputsFromState();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
    document.getElementById('canalDefaultsModal')?.classList.add('hidden');
    showToast(`💾 บันทึกค่าเริ่มต้นคูส่งน้ำ (tw=${canalDefaultParams.tw.toFixed(2)}, tb=${canalDefaultParams.tb.toFixed(2)}, ts=${canalDefaultParams.ts.toFixed(2)}, dt=${canalDefaultParams.dt.toFixed(2)}) เรียบร้อยแล้ว`, 'emerald');
});
document.getElementById('btnApplyCanalDefaultsToTable')?.addEventListener('click', () => {
    applyCanalDefaultsToAllTableRows();
});

document.getElementById('btnCheckTableMismatchesFromDefaults')?.addEventListener('click', () => {
    readCanalDefaultsModalInputsToState();
    syncCanalDefaultsInputsFromState();
    document.getElementById('canalDefaultsModal')?.classList.add('hidden');
    const found = checkAndOpenImportMismatchModal('ตารางปัจจุบัน');
    if (!found) {
        showToast('✅ ค่าในตารางทั้งหมดตรงกับค่าเริ่มต้นคูส่งน้ำและสูตรคำนวณที่กำหนดไว้ทุกประการ', 'emerald');
    }
});

// ============================================================================
// ระบบตรวจสอบค่าในตารางนำเข้าเทียบกับค่าเริ่มต้นคูส่งน้ำที่กำหนดไว้ (Import Mismatch Checker)
// ============================================================================
const MISMATCH_FIELD_META = {
    B: {
        key: 'B',
        label: 'ความกว้างก้นคลอง (B) ตามตารางมิติ U-SHAPE',
        shortLabel: 'ความกว้าง B',
        unit: 'ม.'
    },
    H: {
        key: 'H',
        label: 'ความลึกคลอง (H) ตามตารางมิติ U-SHAPE',
        shortLabel: 'ความลึก H',
        unit: 'ม.'
    },
    tw: {
        key: 'tw',
        label: '1. ความหนากำแพง U-SHAPE (tw)',
        shortLabel: 'ความหนากำแพง (tw)',
        unit: 'ม.'
    },
    tb: {
        key: 'tb',
        label: '2. ความหนาพื้น U-SHAPE (tb)',
        shortLabel: 'ความหนาพื้น (tb)',
        unit: 'ม.'
    },
    ts: {
        key: 'ts',
        label: '3. ความหนาคอนกรีตหยาบรองพื้น (ts)',
        shortLabel: 'คอนกรีตหยาบ (ts)',
        unit: 'ม.'
    },
    dt: {
        key: 'dt',
        label: '4. ความหนาขุดลอกหน้าดิน (dt)',
        shortLabel: 'ขุดลอกหน้าดิน (dt)',
        unit: 'ม.'
    },
    tblStart: {
        key: 'tblStart',
        label: 'ระดับ TBL. เริ่มต้น (สูตร TBL. = BL. + H)',
        shortLabel: 'ระดับ TBL. เริ่มต้น',
        unit: 'ม.รทก.'
    },
    tblEnd: {
        key: 'tblEnd',
        label: 'ระดับ TBL. สิ้นสุด (สูตร TBL. = BL. + H)',
        shortLabel: 'ระดับ TBL. สิ้นสุด',
        unit: 'ม.รทก.'
    }
};

let currentImportMismatchList = [];

function collectTableMismatchesAgainstDefaults(rowsArray) {
    const list = [];
    if (!Array.isArray(rowsArray) || !rowsArray.length) return list;

    rowsArray.forEach((row, rIdx) => {
        const staRangeStr = `${formatMetersToStation(parseStationToMeters(row.staStart))} - ${formatMetersToStation(parseStationToMeters(row.staEnd))}`;
        const rowType = String(row.type || 'VU1').trim();
        const typeSpec = findUShapeTypeSpec(rowType);

        // 1. ตรวจสอบ B และ H ตามตารางมิติ U-SHAPE (เมื่อพบ Type ในตารางมิติ)
        if (typeSpec) {
            const impB = roundLen(row.B);
            const defB = roundLen(typeSpec.B);
            if (Math.abs(impB - defB) > 1e-4) {
                list.push({
                    id: `${rIdx}_B`,
                    rowIndex: rIdx,
                    staRangeStr,
                    type: rowType,
                    field: 'B',
                    fieldLabel: `${MISMATCH_FIELD_META.B.shortLabel} (Type ${typeSpec.type})`,
                    importedVal: impB,
                    configuredVal: defB,
                    choice: 'configured' // ค่าเริ่มต้นให้เลือกใช้ค่าที่กำหนดไว้ หรือผู้ใช้สลับเป็น 'imported' ได้
                });
            }

            const impH = roundLen(row.H);
            const defH = roundLen(typeSpec.H);
            if (Math.abs(impH - defH) > 1e-4) {
                list.push({
                    id: `${rIdx}_H`,
                    rowIndex: rIdx,
                    staRangeStr,
                    type: rowType,
                    field: 'H',
                    fieldLabel: `${MISMATCH_FIELD_META.H.shortLabel} (Type ${typeSpec.type})`,
                    importedVal: impH,
                    configuredVal: defH,
                    choice: 'configured'
                });
            }
        }

        // 2. ตรวจสอบ tw, tb, ts, dt เทียบกับค่าเริ่มต้นคูส่งน้ำ
        ['tw', 'tb', 'ts', 'dt'].forEach(fKey => {
            const impVal = roundLen(row[fKey]);
            const defVal = roundLen(canalDefaultParams[fKey]);
            if (Math.abs(impVal - defVal) > 1e-4) {
                list.push({
                    id: `${rIdx}_${fKey}`,
                    rowIndex: rIdx,
                    staRangeStr,
                    type: rowType,
                    field: fKey,
                    fieldLabel: MISMATCH_FIELD_META[fKey].shortLabel,
                    importedVal: impVal,
                    configuredVal: defVal,
                    choice: 'configured'
                });
            }
        });

        // 3. ตรวจสอบ ระดับ TBL. = BL. + H (ทั้งเริ่มต้นและสิ้นสุด)
        const targetH = typeSpec ? roundLen(typeSpec.H) : roundLen(row.H);
        const impTblStart = roundElev(row.tblStart);
        const defTblStart = roundElev(roundElev(row.blStart) + targetH);
        if (Math.abs(impTblStart - defTblStart) > 1e-4) {
            list.push({
                id: `${rIdx}_tblStart`,
                rowIndex: rIdx,
                staRangeStr,
                type: rowType,
                field: 'tblStart',
                fieldLabel: `${MISMATCH_FIELD_META.tblStart.shortLabel} (BL.+H = ${roundElev(row.blStart).toFixed(2)}+${targetH.toFixed(2)})`,
                importedVal: impTblStart,
                configuredVal: defTblStart,
                choice: 'configured'
            });
        }

        const impTblEnd = roundElev(row.tblEnd);
        const defTblEnd = roundElev(roundElev(row.blEnd) + targetH);
        if (Math.abs(impTblEnd - defTblEnd) > 1e-4) {
            list.push({
                id: `${rIdx}_tblEnd`,
                rowIndex: rIdx,
                staRangeStr,
                type: rowType,
                field: 'tblEnd',
                fieldLabel: `${MISMATCH_FIELD_META.tblEnd.shortLabel} (BL.+H = ${roundElev(row.blEnd).toFixed(2)}+${targetH.toFixed(2)})`,
                importedVal: impTblEnd,
                configuredVal: defTblEnd,
                choice: 'configured'
            });
        }
    });

    return list;
}

function renderImportMismatchModalUI() {
    const cardsContainer = document.getElementById('importMismatchCategoryCards');
    const tbody = document.getElementById('importMismatchTableBody');
    const badge = document.getElementById('importMismatchSummaryBadge');
    if (!cardsContainer || !tbody) return;

    const uniqueRowsCount = new Set(currentImportMismatchList.map(m => m.rowIndex)).size;
    if (badge) {
        badge.innerText = `พบ ${currentImportMismatchList.length} จุด ใน ${uniqueRowsCount} แถว`;
    }

    // จัดกลุ่มตามประเภทพารามิเตอร์ (field)
    const fieldGroups = {};
    currentImportMismatchList.forEach(item => {
        if (!fieldGroups[item.field]) {
            fieldGroups[item.field] = [];
        }
        fieldGroups[item.field].push(item);
    });

    cardsContainer.innerHTML = Object.keys(fieldGroups).map(fKey => {
        const items = fieldGroups[fKey];
        const meta = MISMATCH_FIELD_META[fKey] || { label: fKey, unit: '' };
        const allImported = items.every(x => x.choice === 'imported');
        const allConfigured = items.every(x => x.choice === 'configured');
        const sample = items[0];

        const btnImpCls = allImported
            ? 'bg-cyan-600 text-white border-cyan-400 font-bold shadow'
            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800';
        const btnCfgCls = allConfigured
            ? 'bg-emerald-600 text-white border-emerald-400 font-bold shadow'
            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800';

        return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="font-bold text-slate-100 text-xs">${meta.label}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">
                            ตัวอย่าง: ตารางนำเข้า <strong class="text-cyan-300 font-mono">${sample.importedVal.toFixed(2)}</strong> ${meta.unit}
                            vs กำหนดไว้ <strong class="text-emerald-300 font-mono">${sample.configuredVal.toFixed(2)}</strong> ${meta.unit}
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-600/50 text-amber-300 font-mono font-bold text-[10px] shrink-0">
                        ${items.length} แถว
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <button type="button" data-mismatch-group="${fKey}" data-mismatch-choice="imported" class="px-2.5 py-1.5 rounded-lg border text-[11px] transition flex items-center justify-center gap-1 ${btnImpCls}">
                        <span>📄 ใช้ค่าจากตารางนำเข้า</span>
                    </button>
                    <button type="button" data-mismatch-group="${fKey}" data-mismatch-choice="configured" class="px-2.5 py-1.5 rounded-lg border text-[11px] transition flex items-center justify-center gap-1 ${btnCfgCls}">
                        <span>⚙️ ใช้ค่าที่กำหนดไว้</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    tbody.innerHTML = currentImportMismatchList.map((item, idx) => {
        const isImp = item.choice === 'imported';
        const impBtnCls = isImp
            ? 'bg-cyan-600 text-white border-cyan-400 font-bold'
            : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800';
        const cfgBtnCls = !isImp
            ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
            : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800';

        return `
            <tr class="hover:bg-slate-900/80 transition">
                <td class="py-1.5 px-2.5 text-center font-mono font-bold text-slate-300 border-r border-slate-800/80">${item.rowIndex + 1}</td>
                <td class="py-1.5 px-2.5 text-center font-mono text-slate-200 border-r border-slate-800/80">${item.staRangeStr}</td>
                <td class="py-1.5 px-2.5 text-center font-bold text-amber-300 border-r border-slate-800/80">${item.type}</td>
                <td class="py-1.5 px-2.5 text-slate-200 border-r border-slate-800/80">${item.fieldLabel}</td>
                <td class="py-1.5 px-2.5 text-right font-mono font-bold ${isImp ? 'text-cyan-300 bg-cyan-950/30' : 'text-slate-400'} border-r border-slate-800/80">${item.importedVal.toFixed(2)}</td>
                <td class="py-1.5 px-2.5 text-right font-mono font-bold ${!isImp ? 'text-emerald-300 bg-emerald-950/30' : 'text-slate-400'} border-r border-slate-800/80">${item.configuredVal.toFixed(2)}</td>
                <td class="py-1 px-2 text-center">
                    <div class="inline-flex rounded-lg overflow-hidden border border-slate-700">
                        <button type="button" data-mismatch-item-idx="${idx}" data-mismatch-choice="imported" class="px-2 py-1 text-[10px] transition ${impBtnCls}">
                            ตารางนำเข้า (${item.importedVal.toFixed(2)})
                        </button>
                        <button type="button" data-mismatch-item-idx="${idx}" data-mismatch-choice="configured" class="px-2 py-1 text-[10px] transition ${cfgBtnCls}">
                            ที่กำหนดไว้ (${item.configuredVal.toFixed(2)})
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // ผูกเหตุการณ์ปุ่มเลือกตามกลุ่มหมวดพารามิเตอร์
    cardsContainer.querySelectorAll('button[data-mismatch-group]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fKey = btn.getAttribute('data-mismatch-group');
            const ch = btn.getAttribute('data-mismatch-choice');
            currentImportMismatchList.forEach(item => {
                if (item.field === fKey) item.choice = ch;
            });
            renderImportMismatchModalUI();
        });
    });

    // ผูกเหตุการณ์ปุ่มเลือกรายแถว
    tbody.querySelectorAll('button[data-mismatch-item-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-mismatch-item-idx'), 10);
            const ch = btn.getAttribute('data-mismatch-choice');
            if (currentImportMismatchList[idx]) {
                currentImportMismatchList[idx].choice = ch;
                renderImportMismatchModalUI();
            }
        });
    });
}

function checkAndOpenImportMismatchModal(sourceTitle = 'ตารางที่นำเข้า') {
    currentImportMismatchList = collectTableMismatchesAgainstDefaults(boqRows);
    if (!currentImportMismatchList.length) {
        return false;
    }
    const subEl = document.getElementById('importMismatchSubtitle');
    if (subEl) {
        subEl.innerText = `ตรวจพบค่าใน ${sourceTitle} ไม่ตรงกับค่าที่กำหนดไว้ใน "ค่าเริ่มต้นคูส่งน้ำ" จำนวน ${currentImportMismatchList.length} จุด กรุณาเลือกค่าที่ต้องการใช้คำนวณ`;
    }
    renderImportMismatchModalUI();
    document.getElementById('importMismatchModal')?.classList.remove('hidden');
    return true;
}

function applyImportMismatchDecisions() {
    if (!currentImportMismatchList.length) {
        document.getElementById('importMismatchModal')?.classList.add('hidden');
        return;
    }

    pushUndoSnapshot('เลือกใช้ค่าจากการตรวจสอบตารางนำเข้า');
    let usedConfiguredCount = 0;
    let usedImportedCount = 0;

    // อัปเดตค่าตามที่ผู้ใช้เลือกในแต่ละแถว
    currentImportMismatchList.forEach(item => {
        const row = boqRows[item.rowIndex];
        if (!row) return;
        const chosenVal = item.choice === 'configured' ? item.configuredVal : item.importedVal;
        if (item.choice === 'configured') {
            usedConfiguredCount++;
        } else {
            usedImportedCount++;
        }
        row[item.field] = (item.field === 'tblStart' || item.field === 'tblEnd')
            ? roundElev(chosenVal)
            : roundLen(chosenVal);
    });

    // กรณีที่แถวใดไม่มีรายการขัดแย้งของ tblStart/tblEnd แต่มีการเปลี่ยน H ตามที่เลือก ให้คำนวณ TBL. = BL. + H ให้สอดคล้องกัน
    const hChangedRows = new Set(
        currentImportMismatchList.filter(x => x.field === 'H').map(x => x.rowIndex)
    );
    hChangedRows.forEach(rIdx => {
        const row = boqRows[rIdx];
        if (!row) return;
        const hasExplicitTblStartChoice = currentImportMismatchList.some(x => x.rowIndex === rIdx && x.field === 'tblStart' && x.choice === 'imported');
        const hasExplicitTblEndChoice = currentImportMismatchList.some(x => x.rowIndex === rIdx && x.field === 'tblEnd' && x.choice === 'imported');
        if (!hasExplicitTblStartChoice) {
            row.tblStart = roundElev(roundElev(row.blStart) + roundLen(row.H));
        }
        if (!hasExplicitTblEndChoice) {
            row.tblEnd = roundElev(roundElev(row.blEnd) + roundLen(row.H));
        }
    });

    masterBoqRows = cloneBoqRows(boqRows);
    renderBoqTable();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();
    document.getElementById('importMismatchModal')?.classList.add('hidden');

    showBanner(`✅ อัปเดตค่าตามที่เลือกเรียบร้อยแล้ว (ใช้ค่าที่กำหนดไว้ ${usedConfiguredCount} จุด • ใช้ค่าจากตารางนำเข้า ${usedImportedCount} จุด)`, 'emerald');
    showToast(`✅ นำค่าที่เลือกไปคำนวณเรียบร้อย (ค่าที่กำหนดไว้ ${usedConfiguredCount} จุด / ตารางนำเข้า ${usedImportedCount} จุด)`, 'emerald');
}

document.getElementById('btnCloseImportMismatchModal')?.addEventListener('click', () => {
    document.getElementById('importMismatchModal')?.classList.add('hidden');
});

document.getElementById('btnMismatchKeepAllImported')?.addEventListener('click', () => {
    currentImportMismatchList.forEach(item => { item.choice = 'imported'; });
    applyImportMismatchDecisions();
});

document.getElementById('btnMismatchUseAllDefaults')?.addEventListener('click', () => {
    currentImportMismatchList.forEach(item => { item.choice = 'configured'; });
    applyImportMismatchDecisions();
});

document.getElementById('btnMismatchConfirmSelection')?.addEventListener('click', () => {
    applyImportMismatchDecisions();
});

// ============================================================================
// ระบบ "แสดงข้อมูลตาราง" (พิมพ์ตารางปัจจุบันที่ผู้ใช้ทำงาน + แบ่งหน้าอัตโนมัติเมื่อเกิน 1 หน้า)
// ============================================================================
function generatePrintableBoqTableReport() {
    const container = document.getElementById('printableBoqDocument');
    if (!container) return;

    const visibleInputCols = INPUT_COLUMNS.filter(c => !hiddenColumnKeys.has(c.key));
    const visibleCats = getVisibleCategories();
    const visibleNodeNums = showNodeCoordsInTable ? getVisibleNodeNumbersForTable(selectedCategoryFilter) : [];

    // 1. จัดกลุ่มข้อมูลตามสาย (คลองส่งน้ำ + คูส่งน้ำ) เพื่อสร้างตารางย่อยสรุปส่วนหัว และแทรกแถวแรกของแต่ละสาย
    const lineSummaryGroups = [];
    const lineSummaryMap = new Map();
    const grandTotalsByCat = {};
    WORK_CATEGORIES.forEach(c => { grandTotalsByCat[c.key] = 0; });
    let grandTotalL = 0;

    boqRows.forEach((row, rIdx) => {
        const ev = evaluateBoqRow(row);
        const cName = String(row.canalName ?? '-').trim() || '-';
        const sName = String(row.subCanalName ?? '-').trim() || '-';
        const lKey = `${cName}|||${sName}`;

        if (!lineSummaryMap.has(lKey)) {
            const catSums = {};
            WORK_CATEGORIES.forEach(c => { catSums[c.key] = 0; });
            const grpObj = {
                lineKey: lKey,
                canalName: cName,
                subCanalName: sName,
                type: row.type || 'VU1',
                firstRow: row,
                minSta: parseStationToMeters(row.staStart),
                maxSta: parseStationToMeters(row.staEnd),
                totalL: 0,
                rowCount: 0,
                catSums: catSums,
                rowsWithEval: []
            };
            lineSummaryMap.set(lKey, grpObj);
            lineSummaryGroups.push(grpObj);
        }

        const grp = lineSummaryMap.get(lKey);
        grp.rowCount++;
        grp.minSta = Math.min(grp.minSta, parseStationToMeters(row.staStart), parseStationToMeters(row.staEnd));
        grp.maxSta = Math.max(grp.maxSta, parseStationToMeters(row.staStart), parseStationToMeters(row.staEnd));
        grp.totalL = roundLen(grp.totalL + ev.L);
        grandTotalL = roundLen(grandTotalL + ev.L);

        WORK_CATEGORIES.forEach(cat => {
            const v = ev.calcByCat[cat.key].vol;
            grp.catSums[cat.key] = roundVol(grp.catSums[cat.key] + v);
            grandTotalsByCat[cat.key] = roundVol(grandTotalsByCat[cat.key] + v);
        });

        grp.rowsWithEval.push({ row, ev, rIdx });
    });

    // 2. สร้าง HTML ตารางย่อยสรุปส่วนหัว (ตารางสรุป คลองส่งน้ำ คูส่งน้ำ ปริมาณงานแต่ละหมวด แถวสุดท้ายจำนวนรวมทั้งหมด)
    const summarySubTableHtml = `
        <div style="margin-bottom: 8px; border: 1.5px solid #0284c7; border-radius: 6px; padding: 6px 8px; background-color: #f8fafc; box-sizing: border-box; width: 100%;">
            <table style="width: 100%; border-collapse: collapse; border: none; border-bottom: 1.5px solid #0284c7; margin-bottom: 5px;">
                <tr>
                    <td style="border: none; padding: 0 0 3px 0; text-align: left;">
                        <div style="font-size: 12.5px; font-weight: bold; color: #0f172a;">
                            ตารางสรุปปริมาณงานก่อสร้างรางระบายน้ำคอนกรีตเสริมเหล็ก (U-Shape) แยกตามคลองส่งน้ำ / คูส่งน้ำ
                        </div>
                        <div style="font-size: 9.5px; color: #475569;">
                            สรุปข้อมูลจากตารางปัจจุบัน (${lineSummaryGroups.length} สาย • รวม ${boqRows.length} ช่วง กม. • ระยะทางรวม ${grandTotalL.toFixed(2)} ม.) •
                            สีที่ช่อง กม.เริ่มต้น:
                            <span style="background-color: #fef08a; color: #854d0e; padding: 0 4px; border-radius: 3px; font-weight: bold;">แบ่งตามระยะ</span>
                            <span style="background-color: #d1fae5; color: #065f46; padding: 0 4px; border-radius: 3px; font-weight: bold; margin-left: 3px;">จุดหักดินเดิม</span>
                            <span style="background-color: #fef3c7; color: #92400e; padding: 0 4px; border-radius: 3px; font-weight: bold; margin-left: 3px;">ค่างานดิน=0</span>
                        </div>
                    </td>
                    <td style="border: none; padding: 0 0 3px 0; text-align: right; font-size: 9.5px; color: #334155; white-space: nowrap;">
                        วันที่พิมพ์: ${formatThaiDateTime(new Date())}
                    </td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; background-color: #ffffff; table-layout: fixed;">
                <thead>
                    <tr style="background-color: #e0f2fe; color: #0c4a6e;">
                        <th style="border: 1px solid #94a3b8; padding: 3px 3px; text-align: center; width: 28px;">ลำดับ</th>
                        <th style="border: 1px solid #94a3b8; padding: 3px 5px; text-align: left;">คลองส่งน้ำ</th>
                        <th style="border: 1px solid #94a3b8; padding: 3px 5px; text-align: left;">คูส่งน้ำ</th>
                        <th style="border: 1px solid #94a3b8; padding: 3px 4px; text-align: center; width: 82px;">ช่วง กม.</th>
                        <th style="border: 1px solid #94a3b8; padding: 3px 4px; text-align: right; width: 68px;">ระยะ L (ม.)</th>
                        ${visibleCats.map(cat => `<th style="border: 1px solid #94a3b8; padding: 3px 4px; text-align: right;">${cat.shortLabel} (m³)</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${lineSummaryGroups.map((g, gIdx) => `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 3px; text-align: center; font-weight: bold;">${gIdx + 1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 5px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis;">${g.canalName}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 5px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis;">${g.subCanalName}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; text-align: center; font-family: monospace;">${formatMetersToStation(g.minSta)} - ${formatMetersToStation(g.maxSta)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; text-align: right; font-family: monospace; font-weight: 600;">${g.totalL.toFixed(2)}</td>
                            ${visibleCats.map(cat => `<td style="border: 1px solid #cbd5e1; padding: 2.5px 4px; text-align: right; font-family: monospace;">${g.catSums[cat.key].toFixed(3)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f1f5f9; font-weight: bold; color: #0f172a;">
                        <td colspan="4" style="border: 1px solid #94a3b8; padding: 3.5px 5px; text-align: right;">รวมทั้งหมด (${lineSummaryGroups.length} สาย | ${boqRows.length} ช่วง กม.):</td>
                        <td style="border: 1px solid #94a3b8; padding: 3.5px 4px; text-align: right; font-family: monospace; color: #047857;">${grandTotalL.toFixed(2)}</td>
                        ${visibleCats.map(cat => `<td style="border: 1px solid #94a3b8; padding: 3.5px 4px; text-align: right; font-family: monospace; color: #0369a1;">${grandTotalsByCat[cat.key].toFixed(3)}</td>`).join('')}
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // 3. แยกเป็นตารางย่อยที่ความกว้างพอดีกระดาษ A4 แนวนอน (< 980px) ทุกตาราง ไม่ล้นขอบซ้าย-ขวา:
    //    - ส่วนที่ 1: คอลัมน์ข้อมูลโครงสร้างและระดับ (A–U)
    //    - ส่วนที่ 2: พิกัดจุดตัดรูปตัดขวาง (แบ่งหน้าละไม่เกิน 7 จุด เพื่อให้ช่องพิกัด (X, Y) กว้างพอดีไม่ล้นหน้า)
    //    - ส่วนที่ 3: ผลการคำนวณพื้นที่ (A1, A2) และปริมาณงาน (แบ่งหน้าละไม่เกิน 3 หมวดงาน = 12 คอลัมน์ผลลัพธ์)
    const totalRawCols = 1 + visibleInputCols.length + (visibleNodeNums.length * 2) + (visibleCats.length * 4);
    const columnSections = [];

    const refInputCols = INPUT_COLUMNS.filter(c =>
        ['canalName', 'subCanalName', 'staStart', 'staEnd', 'sectionNo'].includes(c.key) &&
        !hiddenColumnKeys.has(c.key)
    );
    if (!refInputCols.some(c => c.key === 'staStart')) {
        const colD = INPUT_COLUMNS.find(c => c.key === 'staStart');
        if (colD) refInputCols.push(colD);
    }
    if (!refInputCols.some(c => c.key === 'staEnd')) {
        const colH = INPUT_COLUMNS.find(c => c.key === 'staEnd');
        if (colH) refInputCols.push(colH);
    }

    if (totalRawCols <= 18 && visibleNodeNums.length <= 4) {
        columnSections.push({
            sectionTitle: 'รายละเอียดตารางคำนวณปริมาณงานแยกตามช่วง กม. (ตารางปัจจุบันที่กำลังทำงาน)',
            inputCols: visibleInputCols,
            startNodeNums: visibleNodeNums,
            endNodeNums: visibleNodeNums,
            cats: visibleCats,
            showGrandTotalFooter: visibleCats.length > 0
        });
    } else {
        // ส่วนที่ 1: คอลัมน์ A–U
        if (visibleInputCols.length > 0) {
            columnSections.push({
                sectionTitle: 'ส่วนที่ 1: ตารางข้อมูลโครงสร้าง ระดับน้ำ และระดับดินเดิม (คอลัมน์ A–U)',
                inputCols: visibleInputCols,
                startNodeNums: [],
                endNodeNums: [],
                cats: [],
                showGrandTotalFooter: false
            });
        }

        // ส่วนที่ 2: พิกัดจุด 1–14 (แบ่งชุดละไม่เกิน 7 จุดต่อหน้า เพื่อไม่ให้ตารางล้นขอบกระดาษ)
        if (visibleNodeNums.length > 0) {
            const NODES_PER_PAGE = 7;
            if (visibleNodeNums.length <= 4) {
                columnSections.push({
                    sectionTitle: `ส่วนที่ 2: ตารางพิกัดจุดตัดรูปตัดขวาง (กม.เริ่มต้น และ กม.สิ้นสุด • ${visibleNodeNums.length} จุด)`,
                    inputCols: refInputCols,
                    startNodeNums: visibleNodeNums,
                    endNodeNums: visibleNodeNums,
                    cats: [],
                    showGrandTotalFooter: false
                });
            } else {
                for (let nIdx = 0; nIdx < visibleNodeNums.length; nIdx += NODES_PER_PAGE) {
                    const nodeChunk = visibleNodeNums.slice(nIdx, nIdx + NODES_PER_PAGE);
                    const partNo = Math.floor(nIdx / NODES_PER_PAGE) + 1;
                    const totalParts = Math.ceil(visibleNodeNums.length / NODES_PER_PAGE);
                    columnSections.push({
                        sectionTitle: `ส่วนที่ 2.${partNo}: ตารางพิกัดจุดตัด ณ กม.เริ่มต้น (จุดที่ ${nodeChunk[0]} ถึง จุดที่ ${nodeChunk[nodeChunk.length - 1]})`,
                        inputCols: refInputCols,
                        startNodeNums: nodeChunk,
                        endNodeNums: [],
                        cats: [],
                        showGrandTotalFooter: false
                    });
                }
                for (let nIdx = 0; nIdx < visibleNodeNums.length; nIdx += NODES_PER_PAGE) {
                    const nodeChunk = visibleNodeNums.slice(nIdx, nIdx + NODES_PER_PAGE);
                    const partNo = Math.ceil(visibleNodeNums.length / NODES_PER_PAGE) + Math.floor(nIdx / NODES_PER_PAGE) + 1;
                    columnSections.push({
                        sectionTitle: `ส่วนที่ 2.${partNo}: ตารางพิกัดจุดตัด ณ กม.สิ้นสุด (จุดที่ ${nodeChunk[0]} ถึง จุดที่ ${nodeChunk[nodeChunk.length - 1]})`,
                        inputCols: refInputCols,
                        startNodeNums: [],
                        endNodeNums: nodeChunk,
                        cats: [],
                        showGrandTotalFooter: false
                    });
                }
            }
        }

        // ส่วนที่ 3: ผลการคำนวณพื้นที่ (A1, A2) และปริมาณงาน (แบ่งชุดละไม่เกิน 3 หมวดงาน = 12 คอลัมน์ผลลัพธ์ต่อหน้า)
        const CATS_PER_PAGE = 3;
        for (let cIdx = 0; cIdx < visibleCats.length; cIdx += CATS_PER_PAGE) {
            const catChunk = visibleCats.slice(cIdx, cIdx + CATS_PER_PAGE);
            const chunkNo = Math.floor(cIdx / CATS_PER_PAGE) + 1;
            const totalChunks = Math.ceil(visibleCats.length / CATS_PER_PAGE);
            const catNames = catChunk.map(c => c.shortLabel).join(', ');
            columnSections.push({
                sectionTitle: `ส่วนที่ 3${totalChunks > 1 ? `.${chunkNo}` : ''}: ตารางผลการคำนวณพื้นที่ (A1, A2) และปริมาณงาน (${catNames})`,
                inputCols: refInputCols,
                startNodeNums: [],
                endNodeNums: [],
                cats: catChunk,
                showGrandTotalFooter: true
            });
        }
    }

    // 4. สร้างหน้ากระดาษของแต่ละตารางย่อย
    const allRenderedPages = [];

    columnSections.forEach((sec, secIdx) => {
        const secColsCount = 1 + sec.inputCols.length + sec.startNodeNums.length + sec.endNodeNums.length + (sec.cats.length * 4);
        const fontSize = secColsCount > 18 ? '8px' : '9px';
        const cellPad = secColsCount > 18 ? '2px 2px' : '2.5px 3.5px';

        let headRow1 = `<tr style="background-color: #1e293b; color: #ffffff;">`;
        headRow1 += `<th rowspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; width: 24px;">#</th>`;
        sec.inputCols.forEach(col => {
            headRow1 += `<th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-family: monospace; color: #38bdf8;">${col.colLetter}</th>`;
        });
        if (sec.startNodeNums.length > 0) {
            headRow1 += `<th colspan="${sec.startNodeNums.length}" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; background-color: #083344; color: #67e8f9;">พิกัดจุด กม.เริ่มต้น (X, ระดับ Y)</th>`;
        }
        if (sec.endNodeNums.length > 0) {
            headRow1 += `<th colspan="${sec.endNodeNums.length}" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; background-color: #451a03; color: #fcd34d;">พิกัดจุด กม.สิ้นสุด (X, ระดับ Y)</th>`;
        }
        sec.cats.forEach(cat => {
            headRow1 += `<th colspan="4" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; background-color: #0f172a; color: #e2e8f0;">${cat.label}</th>`;
        });
        headRow1 += `</tr>`;

        let headRow2 = `<tr style="background-color: #334155; color: #f8fafc;">`;
        sec.inputCols.forEach(col => {
            headRow2 += `<th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center;">${col.label}</th>`;
        });
        sec.startNodeNums.forEach(n => {
            headRow2 += `<th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-family: monospace;">จุด ${n} (เริ่ม)</th>`;
        });
        sec.endNodeNums.forEach(n => {
            headRow2 += `<th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-family: monospace;">จุด ${n} (สิ้นสุด)</th>`;
        });
        sec.cats.forEach(() => {
            headRow2 += `
                <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: right;">A1 (m²)</th>
                <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: right;">A2 (m²)</th>
                <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: right;">L (m)</th>
                <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: right;">ปริมาณ (m³)</th>
            `;
        });
        headRow2 += `</tr>`;

        const buildLineBannerForSec = (grp, gIdx, isCont = false) => {
            const fr = grp.firstRow || {};
            return `
                <tr style="background-color: #e0f2fe; color: #0c4a6e; font-weight: bold;">
                    <td colspan="${secColsCount}" style="border: 1.5px solid #0284c7; padding: 3.5px 6px; text-align: left; font-size: 9.5px; line-height: 1.35;">
                        <span style="background-color: #0284c7; color: #ffffff; padding: 1px 5px; border-radius: 3px; margin-right: 4px;">สายที่ ${gIdx + 1}${isCont ? ' (ต่อ)' : ''}</span>
                        <strong>คลองส่งน้ำ:</strong> ${grp.canalName} &nbsp;|&nbsp;
                        <strong>คูส่งน้ำ:</strong> ${grp.subCanalName} &nbsp;|&nbsp;
                        <strong>TYPE:</strong> ${grp.type || 'VU1'} &nbsp;|&nbsp;
                        <strong>ช่วง กม.:</strong> ${formatMetersToStation(grp.minSta)} ถึง ${formatMetersToStation(grp.maxSta)} (รวม ${grp.totalL.toFixed(2)} ม.)
                        &nbsp;•&nbsp;
                        <span style="color: #1e3a8a;">
                            📐 <strong>มิติ:</strong> B=${Number(fr.B ?? 0.35).toFixed(2)}, H=${Number(fr.H ?? 0.50).toFixed(2)}, TBL=${Number(fr.TBL ?? 0.50).toFixed(2)}, TBR=${Number(fr.TBR ?? 0.50).toFixed(2)} ม.
                            &nbsp;|&nbsp;
                            🧱 <strong>ความหนา:</strong> tw=${Number(fr.tw ?? 0.10).toFixed(2)}, tb=${Number(fr.tb ?? 0.10).toFixed(2)}, ts=${Number(fr.ts ?? 0.05).toFixed(2)}, dt=${Number(fr.dt ?? 0.30).toFixed(2)} ม.
                        </span>
                    </td>
                </tr>
            `;
        };

        const buildDataRowForSec = (row, ev, rIdx) => {
            let cells = `<td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: center; font-weight: bold;">${rIdx + 1}</td>`;
            sec.inputCols.forEach(col => {
                let val = row[col.key];
                let align = 'right';
                let extraCellStyle = '';
                if (col.type === 'station') {
                    val = formatMetersToStation(parseStationToMeters(val));
                    align = 'center';
                    if (col.key === 'staStart') {
                        const stVis = getSingleStationVisualStyle(row, true);
                        extraCellStyle = stVis.printStyle;
                    } else {
                        extraCellStyle = 'color: #0f172a; font-weight: bold;';
                    }
                } else if (col.key === 'nglStart' || col.key === 'nglEnd') {
                    val = formatNglCellValue(val);
                    if (val === '-') align = 'center';
                } else if (col.type === 'number' && val !== undefined && val !== '') {
                    val = Number(val).toFixed(col.decimals);
                } else if (col.key === 'sectionNo') {
                    align = 'center';
                    extraCellStyle = 'font-weight: bold;';
                } else if (col.type === 'text') {
                    align = 'left';
                }
                cells += `<td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: ${align}; ${col.type !== 'text' ? 'font-family: monospace;' : ''} ${extraCellStyle}">${val ?? ''}</td>`;
            });

            sec.startNodeNums.forEach(n => {
                const c1 = formatNodeCoordCellText(ev.secStart, n, selectedCategoryFilter);
                cells += `<td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: center; font-family: monospace; background-color: #f0f9ff;">${c1}</td>`;
            });
            sec.endNodeNums.forEach(n => {
                const c2 = formatNodeCoordCellText(ev.secEnd, n, selectedCategoryFilter);
                cells += `<td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: center; font-family: monospace; background-color: #fffbeb;">${c2}</td>`;
            });

            sec.cats.forEach(cat => {
                const c = ev.calcByCat[cat.key];
                cells += `
                    <td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: right; font-family: monospace;">${c.a1.toFixed(3)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: right; font-family: monospace;">${c.a2.toFixed(3)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: right; font-family: monospace;">${c.L.toFixed(2)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: ${cellPad}; text-align: right; font-family: monospace; font-weight: bold; background-color: #f8fafc;">${c.vol.toFixed(3)}</td>
                `;
            });

            const pal = getSectionColorPaletteItem(row.sectionNo);
            return `<tr style="background-color: ${pal.printBg};">${cells}</tr>`;
        };

        const leadingSpan = 1 + sec.inputCols.length + sec.startNodeNums.length + sec.endNodeNums.length;
        const footHtmlForSec = sec.showGrandTotalFooter ? `
            <tfoot>
                <tr style="background-color: #e2e8f0; font-weight: bold; color: #0f172a;">
                    <td colspan="${leadingSpan}" style="border: 1px solid #64748b; padding: 4px 5px; text-align: right;">
                        รวมทั้งสิ้น (${boqRows.length} ช่วง กม. | L = ${grandTotalL.toFixed(2)} ม.):
                    </td>
                    ${sec.cats.map(cat => `
                        <td colspan="3" style="border: 1px solid #64748b; padding: 4px 3px; text-align: right; font-size: 8.5px;">รวม ${cat.shortLabel}:</td>
                        <td style="border: 1px solid #64748b; padding: 4px 4px; text-align: right; font-family: monospace; color: #0369a1;">${grandTotalsByCat[cat.key].toFixed(3)}</td>
                    `).join('')}
                </tr>
            </tfoot>
        ` : '';

        const maxRowsFirstPageOfSec = (secIdx === 0)
            ? Math.max(9, 15 - Math.min(5, lineSummaryGroups.length))
            : 20;
        const maxRowsNextPageOfSec = 20;

        const secPagesRows = [];
        let curRows = [];
        let curWeight = 0;
        let curMax = maxRowsFirstPageOfSec;

        const flushSecPage = () => {
            if (curRows.length > 0) {
                secPagesRows.push([...curRows]);
                curRows = [];
                curWeight = 0;
                curMax = maxRowsNextPageOfSec;
            }
        };

        lineSummaryGroups.forEach((grp, gIdx) => {
            if (curWeight + 2 > curMax && curRows.length > 0) {
                flushSecPage();
            }
            curRows.push(buildLineBannerForSec(grp, gIdx, false));
            curWeight += 1.6;

            grp.rowsWithEval.forEach(({ row, ev, rIdx }) => {
                if (curWeight + 1 > curMax && curRows.length > 0) {
                    flushSecPage();
                    curRows.push(buildLineBannerForSec(grp, gIdx, true));
                    curWeight += 1.6;
                }
                curRows.push(buildDataRowForSec(row, ev, rIdx));
                curWeight += 1;
            });
        });
        flushSecPage();
        if (!secPagesRows.length) secPagesRows.push([]);

        secPagesRows.forEach((pRows, subPageIdx) => {
            allRenderedPages.push({
                hasTopSummary: (secIdx === 0 && subPageIdx === 0),
                sectionTitle: subPageIdx > 0 ? `${sec.sectionTitle} (ต่อ)` : sec.sectionTitle,
                fontSize: fontSize,
                headHtml: `${headRow1}${headRow2}`,
                bodyHtml: pRows.join(''),
                footHtml: (subPageIdx === secPagesRows.length - 1) ? footHtmlForSec : ''
            });
        });
    });

    const totalPagesCount = allRenderedPages.length;
    container.innerHTML = allRenderedPages.map((pg, pageIdx) => {
        const isFirst = pageIdx === 0;
        const breakCls = isFirst ? 'boq-print-page-sheet' : 'boq-print-page-sheet calc-print-break';
        const breakStyle = isFirst
            ? 'width: 100%; max-width: 100%; box-sizing: border-box; background-color: #ffffff; margin: 0; padding: 2px;'
            : 'page-break-before: always; break-before: page; padding: 6px 2px 2px 2px; margin-top: 12px; border-top: 2px dashed #cbd5e1; width: 100%; max-width: 100%; box-sizing: border-box; background-color: #ffffff;';

        return `
            <div class="${breakCls}" style="${breakStyle}">
                ${pg.hasTopSummary ? summarySubTableHtml : ''}
                <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 4px;">
                    <tr>
                        <td style="border: none; padding: 0; text-align: left; font-size: 11.5px; font-weight: bold; color: #0f172a;">
                            ${pg.sectionTitle}
                        </td>
                        <td style="border: none; padding: 0; text-align: right; white-space: nowrap;">
                            <span style="font-size: 10px; font-weight: bold; color: #0284c7; background-color: #e0f2fe; padding: 2px 8px; border-radius: 4px; border: 1px solid #7dd3fc;">
                                หน้าที่ ${pageIdx + 1} / ${totalPagesCount}
                            </span>
                        </td>
                    </tr>
                </table>
                <table class="boq-unified-print-table" style="width: 100%; max-width: 100%; border-collapse: collapse; font-size: ${pg.fontSize}; background-color: #ffffff; table-layout: auto;">
                    <thead>${pg.headHtml}</thead>
                    <tbody>${pg.bodyHtml}</tbody>
                    ${pg.footHtml}
                </table>
            </div>
        `;
    }).join('');
}

document.getElementById('btnShowPrintableTableModal')?.addEventListener('click', () => {
    generatePrintableBoqTableReport();
    document.body.classList.add('printing-boq-table');
    document.getElementById('printableBoqTableModal')?.classList.remove('hidden');
});
document.getElementById('btnClosePrintableBoqModal')?.addEventListener('click', () => {
    document.body.classList.remove('printing-boq-table');
    document.getElementById('printableBoqTableModal')?.classList.add('hidden');
});
document.getElementById('btnPrintCurrentBoqTable')?.addEventListener('click', () => {
    generatePrintableBoqTableReport();
    document.body.classList.add('printing-boq-table');
    window.print();
});
window.addEventListener('afterprint', () => {
    const modal = document.getElementById('printableBoqTableModal');
    if (modal && modal.classList.contains('hidden')) {
        document.body.classList.remove('printing-boq-table');
    }
});

// ปุ่มดาวน์โหลด PDF ของหน้าต่างแสดงข้อมูลตาราง:
// ใช้เวิร์กโฟลว์มาตรฐานเดียวกับ downloadCalculationSheetPdf() (ไม่ส่ง windowWidth/width ที่ทำให้เกิดการเลื่อนพิกัด x)
// และเรนเดอร์ทีละแผ่น (.boq-print-page-sheet) ลงที่ขอบบนสุดของกระดาษ A4 แนวนอนทีละหน้า
document.getElementById('btnDownloadPrintableBoqPdf')?.addEventListener('click', async () => {
    generatePrintableBoqTableReport();
    const docEl = document.getElementById('printableBoqDocument');
    if (!docEl || typeof html2pdf === 'undefined') {
        document.getElementById('btnPrintCurrentBoqTable')?.click();
        return;
    }
    showToast('⏳ กำลังสร้างไฟล์ PDF กรุณารอสักครู่...', 'cyan');

    const scrollContainer = docEl.parentElement;
    if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        scrollContainer.scrollLeft = 0;
    }

    const sheets = Array.from(docEl.querySelectorAll('.boq-print-page-sheet'));
    if (!sheets.length) return;

    // ซ่อนเส้นประคั่นหน้าชั่วคราวขณะสร้าง PDF
    sheets.forEach(s => {
        s.style.borderTop = 'none';
        s.style.marginTop = '0';
    });

    const opt = {
        margin: [6, 6, 6, 6],
        filename: `ตารางสรุปและคำนวณปริมาณงาน_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
        // เรนเดอร์หน้าแรก (.boq-print-page-sheet แผ่นที่ 1) ลงที่ขอบบนสุดของหน้า 1
        let worker = html2pdf().set(opt).from(sheets[0]).toPdf();
        // เรนเดอร์แผ่นที่ 2, 3, ... แยกทีละแผ่นลงที่ขอบบนสุดของหน้าถัดไป
        for (let i = 1; i < sheets.length; i++) {
            worker = worker.get('pdf').then(pdf => {
                pdf.addPage();
            }).from(sheets[i]).toContainer().toCanvas().toPdf();
        }
        await worker.save();
        showToast('📥 ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว', 'emerald');
    } catch (err) {
        showToast('เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message, 'amber');
    } finally {
        sheets.forEach((s, idx) => {
            if (idx > 0) {
                s.style.borderTop = '2px dashed #cbd5e1';
                s.style.marginTop = '12px';
            }
        });
    }
});

// ปุ่มดาวน์โหลด Word (.doc) ของหน้าต่างแสดงข้อมูลตาราง (แนวนอน A4 Landscape ตรงตามตารางที่แสดง)
document.getElementById('btnDownloadPrintableBoqWord')?.addEventListener('click', () => {
    generatePrintableBoqTableReport();
    const docEl = document.getElementById('printableBoqDocument');
    if (!docEl) return;

    const tempClone = document.createElement('div');
    tempClone.innerHTML = docEl.innerHTML;
    tempClone.querySelectorAll('.calc-print-break').forEach(el => {
        el.style.borderTop = 'none';
        el.style.marginTop = '0';
        el.style.pageBreakBefore = 'auto';
        el.style.breakBefore = 'auto';
        el.classList.remove('calc-print-break');
        const br = document.createElement('br');
        br.setAttribute('clear', 'all');
        br.style.cssText = 'page-break-before: always; mso-break-type: section-break;';
        el.parentNode.insertBefore(br, el);
    });

    const wordHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>ตารางสรุปและคำนวณปริมาณงานก่อสร้างรางระบายน้ำ U-Shape</title>
            <style>
                @page WordSection1 {
                    size: 841.9pt 595.3pt;
                    mso-page-orientation: landscape;
                    margin: 10mm 10mm 10mm 10mm;
                }
                div.WordSection1 { page: WordSection1; }
                body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size: 9pt; color: #0f172a; }
                table { border-collapse: collapse; width: 100%; }
            </style>
        </head>
        <body>
            <div class="WordSection1">
                ${tempClone.innerHTML}
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ตารางสรุปและคำนวณปริมาณงาน_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📘 ดาวน์โหลดไฟล์ Word (.doc) ของตารางปัจจุบันเรียบร้อยแล้ว', 'emerald');
});

function renderBoqTable() {
    const thead = document.getElementById('boqTableHead');
    const tbody = document.getElementById('boqTableBody');
    const tfoot = document.getElementById('boqTableFoot');
    const visibleCats = getVisibleCategories();
    const visibleNodeNums = showNodeCoordsInTable ? getVisibleNodeNumbersForTable(selectedCategoryFilter) : [];
    const isFilteredCat = selectedCategoryFilter !== 'all';
    const activeCatLabel = isFilteredCat && visibleCats[0] ? visibleCats[0].shortLabel : 'ครบ 14 จุด';

    // Row 1 of Table Header: With Column Hide Eye Icon at Cell #
    let headerRow1 = `<tr class="border-b border-slate-700 text-[11px] text-slate-400">`;
    headerRow1 += `
        <th rowspan="2" class="py-1.5 px-2 text-center bg-slate-900 border-r border-slate-800 sticky left-0 z-30">
            <div class="flex items-center justify-center gap-1">
                <span>#</span>
                <button type="button" id="btnHeaderColEye" onclick="openColumnVisibilityModal()" class="p-0.5 rounded hover:bg-slate-800 text-cyan-400 hover:text-white transition" title="คลิกเพื่อซ่อน/แสดงคอลัมน์ A ถึง U">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
            </div>
        </th>
    `;

    INPUT_COLUMNS.forEach(col => {
        const isHidden = hiddenColumnKeys.has(col.key);
        const hideStyle = isHidden ? 'style="display:none;"' : '';
        headerRow1 += `<th ${hideStyle} class="py-1 px-2 text-center border-r border-slate-800 font-mono text-cyan-400 bg-slate-900/95 cursor-pointer hover:bg-slate-800 transition" title="คลิกเพื่อซ่อนคอลัมน์ ${col.colLetter} (${col.label})" onclick="toggleHideColumn('${col.key}')">${col.colLetter}</th>`;
    });

    // 14 Node Coordinate Header Groups (กม.เริ่มต้น และ กม.สิ้นสุด แยกกัน และกรองเฉพาะจุดที่เกี่ยวข้องเมื่อเลือกแยกหมวดงาน)
    if (visibleNodeNums.length > 0) {
        headerRow1 += `<th colspan="${visibleNodeNums.length}" class="py-1.5 px-3 text-center border-r border-slate-700 font-bold text-cyan-300 bg-cyan-950/60">📍 พิกัดจุด กม.เริ่มต้น (X, ระดับ Y) • ${isFilteredCat ? `เฉพาะจุดที่เกี่ยวข้อง (${activeCatLabel})` : 'ครบ 14 จุด (Node 1–14)'}</th>`;
        headerRow1 += `<th colspan="${visibleNodeNums.length}" class="py-1.5 px-3 text-center border-r border-slate-700 font-bold text-amber-300 bg-amber-950/60">📍 พิกัดจุด กม.สิ้นสุด (X, ระดับ Y) • ${isFilteredCat ? `เฉพาะจุดที่เกี่ยวข้อง (${activeCatLabel})` : 'ครบ 14 จุด (Node 1–14)'}</th>`;
    }

    // Area/Volume Calculation Columns: Always preserved and governed by Category filter
    visibleCats.forEach(cat => {
        headerRow1 += `<th colspan="4" class="py-1.5 px-3 text-center border-r border-slate-700 font-bold ${cat.color} ${cat.bgHeader}">${cat.label}</th>`;
    });
    headerRow1 += `<th rowspan="2" class="py-2 px-2 text-center bg-slate-900">ลบ</th>`;
    headerRow1 += `</tr>`;

    // Row 2 of Table Header: Column Labels
    let headerRow2 = `<tr class="border-b-2 border-slate-700 text-xs bg-slate-900/95">`;
    INPUT_COLUMNS.forEach(col => {
        const isHidden = hiddenColumnKeys.has(col.key);
        const hideStyle = isHidden ? 'style="display:none;"' : '';
        headerRow2 += `<th ${hideStyle} class="py-2 px-2 text-center border-r border-slate-800 font-semibold text-slate-200">${col.label}</th>`;
    });
    if (visibleNodeNums.length > 0) {
        visibleNodeNums.forEach(n => {
            headerRow2 += `<th class="py-1.5 px-2 text-center border-r border-slate-800/80 text-cyan-200 font-mono text-[11px] bg-cyan-950/40">จุดที่ ${n} (เริ่มต้น)</th>`;
        });
        visibleNodeNums.forEach(n => {
            headerRow2 += `<th class="py-1.5 px-2 text-center border-r border-slate-800/80 text-amber-200 font-mono text-[11px] bg-amber-950/40">จุดที่ ${n} (สิ้นสุด)</th>`;
        });
    }
    visibleCats.forEach(cat => {
        headerRow2 += `
            <th class="py-1.5 px-2 text-right border-r border-slate-800/80 text-cyan-300 font-medium ${cat.bgHeader}">A1 (m²)</th>
            <th class="py-1.5 px-2 text-right border-r border-slate-800/80 text-amber-300 font-medium ${cat.bgHeader}">A2 (m²)</th>
            <th class="py-1.5 px-2 text-right border-r border-slate-800/80 text-slate-300 font-medium ${cat.bgHeader}">L (m)</th>
            <th class="py-1.5 px-2.5 text-right border-r border-slate-700 font-bold ${cat.color} ${cat.bgHeader}">ปริมาณ (m³)</th>
        `;
    });
    headerRow2 += `</tr>`;
    thead.innerHTML = headerRow1 + headerRow2;

    const totalsByCat = {};
    WORK_CATEGORIES.forEach(c => { totalsByCat[c.key] = 0; });
    let totalLengthL = 0;

    const visibleInputColCount = INPUT_COLUMNS.filter(c => !hiddenColumnKeys.has(c.key)).length;
    const totalLeadingCols = 1 + visibleInputColCount + (visibleNodeNums.length * 2);
    const totalAllCols = totalLeadingCols + (visibleCats.length * 4) + 1;

    if (!boqRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${totalAllCols}" class="py-10 px-4 text-center text-slate-400 text-xs bg-slate-950/60">
                    ยังไม่มีข้อมูลในตารางคำนวณปริมาณงาน (กรุณาอัปโหลดไฟล์ Excel, โหลดไฟล์โปรเจกต์, หรือส่งข้อมูลระดับดินเดิม NGL จากส่วนที่ 2)
                </td>
            </tr>
        `;
    } else {
    // ตรวจสอบและจัดลำดับ ช่วงคูส่งน้ำ (sectionNo) ให้เริ่มนับ 1 ใหม่ทุกครั้งที่สายคูส่งน้ำเปลี่ยน
    recalculateSectionNumbersByCanalLine(boqRows);
    if (Array.isArray(masterBoqRows) && masterBoqRows.length) {
        recalculateSectionNumbersByCanalLine(masterBoqRows);
    }

    // คำนวณข้อมูลสรุปแต่ละสายคูส่งน้ำเพื่อแสดงเส้นแบ่งสายคูส่งน้ำ
    const lineSummaryByKey = new Map();
    boqRows.forEach(r => {
        const lKey = makeCanalLineKey(r.canalName, r.subCanalName);
        const s1 = parseStationToMeters(r.staStart);
        const s2 = parseStationToMeters(r.staEnd);
        if (!lineSummaryByKey.has(lKey)) {
            lineSummaryByKey.set(lKey, {
                canalName: r.canalName || '-',
                subCanalName: r.subCanalName || '-',
                minSta: Math.min(s1, s2),
                maxSta: Math.max(s1, s2),
                rowCount: 0,
                secSet: new Set()
            });
        }
        const info = lineSummaryByKey.get(lKey);
        info.minSta = Math.min(info.minSta, s1, s2);
        info.maxSta = Math.max(info.maxSta, s1, s2);
        info.rowCount++;
        info.secSet.add(String(r.sectionNo || '1'));
    });

    let currentLineOrder = 0;

    // รอบ 60: คำนวณยอดรวมจากทุกแถว (ไม่ได้กรอง) แล้วค่อยกรอง/ย่อสายตอน render
    boqRows.forEach((row) => {
        const ev = evaluateBoqRow(row);
        totalLengthL = roundLen(totalLengthL + ev.L);
        WORK_CATEGORIES.forEach(cat => {
            totalsByCat[cat.key] = roundVol(totalsByCat[cat.key] + ev.calcByCat[cat.key].vol);
        });
    });

    // รอบ 60: สร้างรายการแถวที่จะแสดง (กรองตามสาย + ย่อ/ขยายสาย) โดยยังคงดัชนีเดิม rIdx
    const renderedEntries = [];
    boqRows.forEach((row, rIdx) => {
        const lKey = makeCanalLineKey(row.canalName, row.subCanalName);
        if (activeCanalLineFilter !== 'all' && lKey !== activeCanalLineFilter) return;
        if (collapsedCanalLines.has(lKey)) {
            // สายที่ย่อไว้: แสดงเฉพาะแถวหัวป้ายชื่อสาย (พร้อมปุ่มขยาย) ไม่แสดงแถวข้อมูล
            const alreadyAdded = renderedEntries.some(e => e.isCollapsedLine && e.lineKey === lKey);
            if (!alreadyAdded) {
                renderedEntries.push({ isCollapsedLine: true, lineKey: lKey, row: row, rIdx: rIdx });
            }
            return;
        }
        renderedEntries.push({ row: row, rIdx: rIdx, lineKey: lKey });
    });

    tbody.innerHTML = renderedEntries.map((entry, visIdx) => {
        const row = entry.row;
        const rIdx = entry.rIdx;
        const ev = evaluateBoqRow(row);

        const isSelected = rIdx === selectedRowIndex;
        const theme = getRowSplitTheme(row);
        const pal = getSectionColorPaletteItem(row.sectionNo);

        const curLineKey = entry.lineKey;
        const prevEntry = visIdx > 0 ? renderedEntries[visIdx - 1] : null;
        const prevRow = prevEntry ? prevEntry.row : null;
        const prevLineKey = prevEntry ? prevEntry.lineKey : null;
        const isNewCanalLine = (prevEntry === null || curLineKey !== prevLineKey);
        const isNewSectionInSameLine = (!isNewCanalLine && prevRow && String(row.sectionNo) !== String(prevRow.sectionNo));

        let topBorderCls = '';
        if (rIdx > 0 && isNewCanalLine) {
            topBorderCls = 'border-t-2 border-t-cyan-400';
        } else if (isNewSectionInSameLine) {
            topBorderCls = 'border-t border-t-slate-500/80';
        }

        const rowBgClass = isSelected ? `${pal.selectedCls} ${topBorderCls}` : `${pal.rowCls} ${topBorderCls}`;
        const rowInlineStyle = isSelected ? pal.selectedStyle : pal.rowStyle;

        let dividerRowHtml = '';
        if (isNewCanalLine) {
            currentLineOrder++;
            const lInfo = lineSummaryByKey.get(curLineKey) || { canalName: row.canalName || '-', subCanalName: row.subCanalName || '-', minSta: 0, maxSta: 0, rowCount: 1, secSet: new Set(['1']) };
            const topSepStyle = visIdx > 0 ? 'border-top: 3px solid #06b6d4;' : '';
            const isCollapsed = isCanalLineCollapsed(curLineKey);
            const toggleLabel = isCollapsed ? 'ขยายข้อมูลสายนี้' : 'ย่อข้อมูลสายนี้';
            const toggleTitle = isCollapsed ? 'คลิกเพื่อขยายดูข้อมูลทั้งหมดของสายคูส่งน้ำนี้' : 'คลิกเพื่อย่อ/ซ่อนข้อมูลของสายคูส่งน้ำนี้';
            dividerRowHtml = `
                <tr class="canal-line-divider-row select-none bg-slate-900/95 border-b border-cyan-500/50" style="${topSepStyle}">
                    <td colspan="${totalAllCols}" class="py-1.5 px-3 text-left text-xs font-bold text-cyan-200 bg-gradient-to-r from-cyan-950/95 via-slate-900/95 to-slate-900/90">
                        <div class="flex items-center gap-2 flex-wrap">
                            <button type="button" class="ew-line-toggle-btn" data-line-key="${ewEscapeAttr(curLineKey)}" onclick="toggleCanalLineCollapse('${ewEscapeAttr(curLineKey)}')" title="${toggleTitle}" aria-expanded="${isCollapsed ? 'false' : 'true'}">
                                <span class="ew-line-toggle-icon">${isCollapsed ? '▸' : '▾'}</span>
                                <span>${toggleLabel}</span>
                            </button>
                            <span class="px-2 py-0.5 rounded bg-cyan-600 text-white text-[11px] font-extrabold shadow">สายคูส่งน้ำที่ ${currentLineOrder}</span>
                            <span>คลองส่งน้ำ: <strong class="text-white">${lInfo.canalName}</strong></span>
                            <span class="text-slate-500">•</span>
                            <span>คูส่งน้ำ: <strong class="text-emerald-300">${lInfo.subCanalName}</strong></span>
                            <span class="text-slate-500">•</span>
                            <span class="text-slate-300 font-mono text-[11px]">กม. ${formatMetersToStation(lInfo.minSta)} – ${formatMetersToStation(lInfo.maxSta)} (${lInfo.secSet.size} ช่วงคูส่งน้ำ • ${lInfo.rowCount} แถว)${isCollapsed ? ' • <span class="text-amber-300 font-bold">[ย่ออยู่]</span>' : ''}</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        // รอบ 60: ถ้าสายนี้ถูกย่อไว้ ให้แสดงเฉพาะแถวหัวป้ายชื่อสาย (ไม่แสดงแถวข้อมูล)
        if (entry.isCollapsedLine) {
            return dividerRowHtml;
        }

        let cellsHtml = `<td class="py-1.5 px-2 text-center font-bold text-slate-300 border-r border-slate-800 sticky left-0 bg-slate-900/95 z-10 ${pal.leftBorderCls}">${rIdx + 1}</td>`;

        INPUT_COLUMNS.forEach((col, cIdx) => {
            const isHidden = hiddenColumnKeys.has(col.key);
            const hideStyle = isHidden ? 'style="display:none;"' : '';

            let displayVal = row[col.key];
            const isNglCol = (col.key === 'nglStart' || col.key === 'nglEnd');
            if (col.type === 'station') {
                displayVal = formatMetersToStation(parseStationToMeters(row[col.key]));
            } else if (isNglCol) {
                displayVal = formatNglCellValue(row[col.key]);
            } else if (col.type === 'number' && displayVal !== undefined && displayVal !== '') {
                displayVal = Number(displayVal).toFixed(col.decimals);
            }

            let cellTextCls = 'text-slate-100 font-medium';
            let alignCls = 'text-right font-mono';
            if (col.key === 'sectionNo') {
                alignCls = 'text-center font-mono font-bold';
                cellTextCls = pal.secInputCls;
            } else if (isNglCol && isMissingNglValue(row[col.key])) {
                alignCls = 'text-center font-mono font-bold';
                cellTextCls = 'text-amber-300';
            } else if (col.type === 'text') {
                alignCls = 'text-left';
            } else if (col.type === 'station') {
                alignCls = 'text-center';
                if (col.key === 'staStart') {
                    const stStyle = getSingleStationVisualStyle(row, true);
                    cellTextCls = stStyle.inputCls;
                } else {
                    cellTextCls = 'text-cyan-300 font-mono font-bold';
                }
            }

            if (col.key === 'remark') {
                cellsHtml += `
                    <td ${hideStyle} class="p-0.5 border-r border-slate-800/80">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${theme.badgeCls}">${theme.badgeLabel}</span>
                            <input
                                type="text"
                                data-row="${rIdx}"
                                data-col="${cIdx}"
                                data-key="${col.key}"
                                data-type="${col.type}"
                                data-decimals="${col.decimals || 0}"
                                value="${displayVal ?? ''}"
                                class="table-cell-input ${col.width} px-1.5 py-1 bg-transparent focus:bg-slate-800 text-xs ${alignCls} ${cellTextCls} rounded focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            >
                        </div>
                    </td>
                `;
            } else {
                cellsHtml += `
                    <td ${hideStyle} class="p-0.5 border-r border-slate-800/80">
                        <input
                            type="text"
                            data-row="${rIdx}"
                            data-col="${cIdx}"
                            data-key="${col.key}"
                            data-type="${col.type}"
                            data-decimals="${col.decimals || 0}"
                            value="${displayVal ?? ''}"
                            class="table-cell-input ${col.width} px-1.5 py-1 bg-transparent focus:bg-slate-800 text-xs ${alignCls} ${cellTextCls} rounded focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        >
                    </td>
                `;
            }
        });

        // Node Coordinate Cells (กม.เริ่มต้น และ กม.สิ้นสุด แยกกัน)
        if (visibleNodeNums.length > 0) {
            visibleNodeNums.forEach(n => {
                const coordStr1 = formatNodeCoordCellText(ev.secStart, n, selectedCategoryFilter);
                cellsHtml += `<td data-node-coord="start-${n}-${rIdx}" class="py-1.5 px-2 text-center font-mono text-[11px] ${coordStr1 === '-' ? 'text-slate-600' : 'text-cyan-200/95'} border-r border-slate-800/60 bg-cyan-950/15">${coordStr1}</td>`;
            });
            visibleNodeNums.forEach(n => {
                const coordStr2 = formatNodeCoordCellText(ev.secEnd, n, selectedCategoryFilter);
                cellsHtml += `<td data-node-coord="end-${n}-${rIdx}" class="py-1.5 px-2 text-center font-mono text-[11px] ${coordStr2 === '-' ? 'text-slate-600' : 'text-amber-200/95'} border-r border-slate-800/60 bg-amber-950/15">${coordStr2}</td>`;
            });
        }

        // Calculation Result Columns: Always visible per Category filter
        visibleCats.forEach(cat => {
            const c = ev.calcByCat[cat.key];
            cellsHtml += `
                <td data-calc="${cat.key}-a1-${rIdx}" class="py-1.5 px-2 text-right font-mono text-cyan-300/90 border-r border-slate-800/60 bg-slate-900/30">${c.a1.toFixed(3)}</td>
                <td data-calc="${cat.key}-a2-${rIdx}" class="py-1.5 px-2 text-right font-mono text-amber-300/90 border-r border-slate-800/60 bg-slate-900/30">${c.a2.toFixed(3)}</td>
                <td data-calc="${cat.key}-L-${rIdx}" class="py-1.5 px-2 text-right font-mono text-slate-300 border-r border-slate-800/60 bg-slate-900/30">${c.L.toFixed(2)}</td>
                <td data-calc="${cat.key}-vol-${rIdx}" class="py-1.5 px-2.5 text-right font-mono font-bold ${cat.color} border-r border-slate-700/80 bg-slate-900/60">${c.vol.toFixed(3)}</td>
            `;
        });

        cellsHtml += `
            <td class="py-1 px-2 text-center">
                <button data-del-row="${rIdx}" class="text-slate-500 hover:text-rose-400 transition px-1" title="ลบแถวนี้">✕</button>
            </td>
        `;

        return `${dividerRowHtml}<tr data-row-tr="${rIdx}" data-top-border-cls="${topBorderCls}" class="${rowBgClass}" style="${rowInlineStyle}">${cellsHtml}</tr>`;
    }).join('');
    }

    // Footer Row: Colspan adjusted dynamically for hidden columns & node coordinate columns
    let footHtml = `<tr class="text-xs">`;
    footHtml += `<td colspan="${totalLeadingCols}" class="py-2 px-3 text-right text-slate-300 border-r border-slate-700">รวมทั้งสิ้น (${boqRows.length} ช่วง กม. | ระยะทางรวม L = <span id="footTotalL" class="text-emerald-400 font-mono">${totalLengthL.toFixed(2)}</span> m):</td>`;
    visibleCats.forEach(cat => {
        footHtml += `
            <td colspan="3" class="py-2 px-2 text-right text-[11px] text-slate-400 border-r border-slate-800">รวม ${cat.shortLabel}:</td>
            <td id="footTotal-${cat.key}" class="py-2 px-2.5 text-right font-mono font-bold ${cat.color} border-r border-slate-700">${totalsByCat[cat.key].toFixed(3)}</td>
        `;
    });
    footHtml += `<td></td></tr>`;
    tfoot.innerHTML = footHtml;

    attachTableEvents();
    updateComparisonView(false);
    if (typeof updateStationDuplicateBadgeUI === 'function') updateStationDuplicateBadgeUI();
    if (typeof updateZeroSplitCountBadges === 'function') updateZeroSplitCountBadges();
    updateColVisibilityButtonBadge();
    updateNodeCoordsToggleBtnUI();
    if (typeof syncWorkCategoryToggleButtonsUI === 'function') syncWorkCategoryToggleButtonsUI();
    // รอบ 60: อัปเดตตัวเลือกสายคูส่งน้ำในดรอปลิด
    updateCanalLineFilterOptions();
}

function refreshRowCalculationsInDOM(rIdx) {
    const row = boqRows[rIdx];
    if (!row) return;
    const ev = evaluateBoqRow(row);
    const visibleCats = getVisibleCategories();
    const visibleNodeNums = showNodeCoordsInTable ? getVisibleNodeNumbersForTable(selectedCategoryFilter) : [];

    visibleNodeNums.forEach(n => {
        const elStart = document.querySelector(`[data-node-coord="start-${n}-${rIdx}"]`);
        const elEnd = document.querySelector(`[data-node-coord="end-${n}-${rIdx}"]`);
        if (elStart) {
            const c1 = formatNodeCoordCellText(ev.secStart, n, selectedCategoryFilter);
            elStart.innerText = c1;
            elStart.className = `py-1.5 px-2 text-center font-mono text-[11px] ${c1 === '-' ? 'text-slate-600' : 'text-cyan-200/95'} border-r border-slate-800/60 bg-cyan-950/15`;
        }
        if (elEnd) {
            const c2 = formatNodeCoordCellText(ev.secEnd, n, selectedCategoryFilter);
            elEnd.innerText = c2;
            elEnd.className = `py-1.5 px-2 text-center font-mono text-[11px] ${c2 === '-' ? 'text-slate-600' : 'text-amber-200/95'} border-r border-slate-800/60 bg-amber-950/15`;
        }
    });

    visibleCats.forEach(cat => {
        const c = ev.calcByCat[cat.key];
        const elA1 = document.querySelector(`[data-calc="${cat.key}-a1-${rIdx}"]`);
        const elA2 = document.querySelector(`[data-calc="${cat.key}-a2-${rIdx}"]`);
        const elL = document.querySelector(`[data-calc="${cat.key}-L-${rIdx}"]`);
        const elVol = document.querySelector(`[data-calc="${cat.key}-vol-${rIdx}"]`);
        if (elA1) elA1.innerText = c.a1.toFixed(3);
        if (elA2) elA2.innerText = c.a2.toFixed(3);
        if (elL) elL.innerText = c.L.toFixed(2);
        if (elVol) elVol.innerText = c.vol.toFixed(3);
    });

    const totalsByCat = {};
    WORK_CATEGORIES.forEach(c => { totalsByCat[c.key] = 0; });
    let totalLengthL = 0;
    boqRows.forEach(r => {
        const e = evaluateBoqRow(r);
        totalLengthL = roundLen(totalLengthL + e.L);
        WORK_CATEGORIES.forEach(cat => {
            totalsByCat[cat.key] = roundVol(totalsByCat[cat.key] + e.calcByCat[cat.key].vol);
        });
    });

    const footL = document.getElementById('footTotalL');
    if (footL) footL.innerText = totalLengthL.toFixed(2);
    visibleCats.forEach(cat => {
        const footCat = document.getElementById(`footTotal-${cat.key}`);
        if (footCat) footCat.innerText = totalsByCat[cat.key].toFixed(3);
    });

    if (rIdx === selectedRowIndex) {
        updateComparisonView(false);
    } else {
        drawLongitudinalProfile();
    }
    if (typeof updateStationDuplicateBadgeUI === 'function') updateStationDuplicateBadgeUI();
    if (typeof updateZeroSplitCountBadges === 'function') updateZeroSplitCountBadges();
}

function attachTableEvents() {
    const tbody = document.getElementById('boqTableBody');

    tbody.querySelectorAll('tr[data-row-tr]').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button[data-del-row]')) return;
            const rIdx = parseInt(tr.getAttribute('data-row-tr'), 10);
            if (!isNaN(rIdx) && rIdx !== selectedRowIndex) {
                selectedRowIndex = rIdx;
                updateComparisonView(true);
            }
        });
    });

    tbody.querySelectorAll('button[data-del-row]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rIdx = parseInt(btn.getAttribute('data-del-row'), 10);
            pushUndoSnapshot(`ลบแถวที่ ${rIdx + 1}`);
            boqRows.splice(rIdx, 1);
            masterBoqRows = cloneBoqRows(boqRows);
            if (selectedRowIndex >= boqRows.length) {
                selectedRowIndex = Math.max(0, boqRows.length - 1);
            }
            renderBoqTable();
        });
    });

    tbody.querySelectorAll('input.table-cell-input').forEach(inp => {
        inp.addEventListener('focus', () => {
            const rIdx = parseInt(inp.getAttribute('data-row'), 10);
            const key = inp.getAttribute('data-key') || '';
            pendingCellEditSnapshot = createWorkspaceSnapshot(`แก้ไขช่อง ${key} แถวที่ ${rIdx + 1}`);
            pendingCellEditKey = `${rIdx}_${key}`;
            pendingCellEditBeforeVal = inp.value;
            if (!isNaN(rIdx) && rIdx !== selectedRowIndex) {
                selectedRowIndex = rIdx;
                updateComparisonView(true);
            }
            inp.select();
        });

        inp.addEventListener('input', () => {
            const rIdx = parseInt(inp.getAttribute('data-row'), 10);
            const key = inp.getAttribute('data-key');
            const type = inp.getAttribute('data-type');
            const row = boqRows[rIdx];
            if (!row) return;

            const prevLineKey = makeCanalLineKey(row.canalName, row.subCanalName);
            const prevStaStart = row.staStart;
            const prevStaEnd = row.staEnd;

            if (type === 'text') {
                row[key] = inp.value;
                if (key === 'canalName' || key === 'subCanalName') {
                    recalculateSectionNumbersByCanalLine(boqRows);
                    boqRows.forEach((rObj, idx) => {
                        const secInp = tbody.querySelector(`input[data-row="${idx}"][data-key="sectionNo"]`);
                        if (secInp && document.activeElement !== secInp) {
                            secInp.value = rObj.sectionNo;
                        }
                    });
                }
                if (key === 'type') {
                    const matchedSpec = findUShapeTypeSpec(inp.value);
                    if (matchedSpec) {
                        row.B = roundLen(matchedSpec.B);
                        row.H = roundLen(matchedSpec.H);
                        row.tblStart = roundElev(roundElev(row.blStart) + row.H);
                        row.tblEnd = roundElev(roundElev(row.blEnd) + row.H);
                        const bInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="B"]`);
                        const hInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="H"]`);
                        const tblStartInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="tblStart"]`);
                        const tblEndInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="tblEnd"]`);
                        if (bInp && document.activeElement !== bInp) bInp.value = row.B.toFixed(2);
                        if (hInp && document.activeElement !== hInp) hInp.value = row.H.toFixed(2);
                        if (tblStartInp && document.activeElement !== tblStartInp) tblStartInp.value = row.tblStart.toFixed(2);
                        if (tblEndInp && document.activeElement !== tblEndInp) tblEndInp.value = row.tblEnd.toFixed(2);
                    }
                }
            } else if (type === 'station') {
                row[key] = parseStationToMeters(inp.value);
            } else if (type === 'number') {
                const rawTrim = String(inp.value || '').trim();
                if ((key === 'nglStart' || key === 'nglEnd') && (rawTrim === '' || rawTrim === '-')) {
                    row[key] = '-';
                } else {
                    const num = parseFloat(rawTrim);
                    if (!isNaN(num)) {
                    const isElevKey = ['nglStart', 'blStart', 'tblStart', 'nglEnd', 'blEnd', 'tblEnd'].includes(key);
                    row[key] = isElevKey ? roundElev(num) : roundLen(num);
                    if (key === 'blStart' || key === 'H') {
                        row.tblStart = roundElev(roundElev(row.blStart) + roundLen(row.H));
                        const tblInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="tblStart"]`);
                        if (tblInp && document.activeElement !== tblInp) {
                            tblInp.value = row.tblStart.toFixed(2);
                        }
                    }
                    if (key === 'blEnd' || key === 'H') {
                        row.tblEnd = roundElev(roundElev(row.blEnd) + roundLen(row.H));
                        const tblEndInp = tbody.querySelector(`input[data-row="${rIdx}"][data-key="tblEnd"]`);
                        if (tblEndInp && document.activeElement !== tblEndInp) {
                            tblEndInp.value = row.tblEnd.toFixed(2);
                        }
                    }
                }
                }
            }
            if (pendingCellEditSnapshot && pendingCellEditKey === `${rIdx}_${key}` && inp.value !== pendingCellEditBeforeVal) {
                undoStack.push(pendingCellEditSnapshot);
                if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
                redoStack = [];
                pendingCellEditSnapshot = null;
                updateUndoRedoButtonsUI();
            }
            syncVisibleRowEditToMaster(row, prevLineKey, prevStaStart, prevStaEnd);
            if (key === 'remark') {
                ensureAllRowsHaveParsedTags(masterBoqRows);
                syncSplitButtonsStatusUI();
            }
            refreshRowCalculationsInDOM(rIdx);
        });

        inp.addEventListener('blur', () => {
            const rIdx = parseInt(inp.getAttribute('data-row'), 10);
            const key = inp.getAttribute('data-key');
            const type = inp.getAttribute('data-type');
            const decimals = parseInt(inp.getAttribute('data-decimals'), 10) || 0;
            const row = boqRows[rIdx];
            if (!row) return;

            if (type === 'station') {
                const m = parseStationToMeters(inp.value);
                row[key] = m;
                inp.value = formatMetersToStation(m);
            } else if (type === 'number') {
                const rawTrim = String(inp.value || '').trim();
                const isNglCol = (key === 'nglStart' || key === 'nglEnd');
                const isElevKey = ['nglStart', 'blStart', 'tblStart', 'nglEnd', 'blEnd', 'tblEnd'].includes(key);
                if (isNglCol && (rawTrim === '' || rawTrim === '-' || isNaN(parseFloat(rawTrim)))) {
                    row[key] = '-';
                    inp.value = '-';
                } else {
                    const num = parseFloat(rawTrim);
                    if (!isNaN(num)) {
                        let rounded = isElevKey ? roundElev(num) : roundLen(num);
                        if (key === 'tblStart') {
                            rounded = roundElev(roundElev(row.blStart) + roundLen(row.H));
                        } else if (key === 'tblEnd') {
                            rounded = roundElev(roundElev(row.blEnd) + roundLen(row.H));
                        }
                        row[key] = rounded;
                        inp.value = rounded.toFixed(decimals);
                    } else if (isNglCol && isMissingNglValue(row[key])) {
                        row[key] = '-';
                        inp.value = '-';
                    } else {
                        const fallback = isElevKey ? roundElev(row[key] || 0) : roundLen(row[key] || 0);
                        inp.value = fallback.toFixed(decimals);
                    }
                }
            }
            if (key === 'canalName' || key === 'subCanalName' || key === 'sectionNo') {
                renderBoqTable();
                return;
            }
            refreshRowCalculationsInDOM(rIdx);
        });

        inp.addEventListener('keydown', (e) => {
            const rIdx = parseInt(inp.getAttribute('data-row'), 10);
            const cIdx = parseInt(inp.getAttribute('data-col'), 10);
            const maxRow = boqRows.length - 1;
            const maxCol = INPUT_COLUMNS.length - 1;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const targetRow = Math.max(0, rIdx - 1);
                const nextEl = tbody.querySelector(`input[data-row="${targetRow}"][data-col="${cIdx}"]`);
                if (nextEl) {
                    nextEl.focus();
                    nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                const targetRow = Math.min(maxRow, rIdx + 1);
                const nextEl = tbody.querySelector(`input[data-row="${targetRow}"][data-col="${cIdx}"]`);
                if (nextEl) {
                    nextEl.focus();
                    nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            } else if (e.key === 'ArrowLeft') {
                const isAtStart = inp.selectionStart === 0 && inp.selectionEnd === 0;
                const isAllSelected = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
                if (isAtStart || isAllSelected) {
                    e.preventDefault();
                    let targetCol = cIdx - 1;
                    while (targetCol >= 0 && hiddenColumnKeys.has(INPUT_COLUMNS[targetCol]?.key)) {
                        targetCol--;
                    }
                    if (targetCol >= 0) {
                        const nextEl = tbody.querySelector(`input[data-row="${rIdx}"][data-col="${targetCol}"]`);
                        if (nextEl) {
                            nextEl.focus();
                            nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
            } else if (e.key === 'ArrowRight') {
                const isAtEnd = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
                const isAllSelected = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
                if (isAtEnd || isAllSelected) {
                    e.preventDefault();
                    let targetCol = cIdx + 1;
                    while (targetCol <= maxCol && hiddenColumnKeys.has(INPUT_COLUMNS[targetCol]?.key)) {
                        targetCol++;
                    }
                    if (targetCol <= maxCol) {
                        const nextEl = tbody.querySelector(`input[data-row="${rIdx}"][data-col="${targetCol}"]`);
                        if (nextEl) {
                            nextEl.focus();
                            nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
            }
        });
    });
}

document.getElementById('boqTableContainer')?.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.classList.contains('table-cell-input')) return;
    if (e.key === 'ArrowUp' && selectedRowIndex > 0) {
        e.preventDefault();
        selectedRowIndex--;
        updateComparisonView(true);
        const tr = document.querySelector(`tr[data-row-tr="${selectedRowIndex}"]`);
        if (tr) tr.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowDown' && selectedRowIndex < boqRows.length - 1) {
        e.preventDefault();
        selectedRowIndex++;
        updateComparisonView(true);
        const tr = document.querySelector(`tr[data-row-tr="${selectedRowIndex}"]`);
        if (tr) tr.scrollIntoView({ block: 'nearest' });
    }
});

document.getElementById('selectCategoryView')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all_hide_nodes') {
        selectedCategoryFilter = 'all';
        showNodeCoordsInTable = false;
    } else {
        selectedCategoryFilter = val;
        if (val !== 'all') {
            showNodeCoordsInTable = true;
        }
    }
    updateNodeCoordsToggleBtnUI();
    renderBoqTable();
});

// ผูกปุ่มยกเลิกไป-กลับการทำงาน (Undo / Redo) และคีย์ลัด Ctrl+Z / Ctrl+Y
['btnHeaderUndo', 'btnUndoAction'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', performWorkspaceUndo);
});
['btnHeaderRedo', 'btnRedoAction'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', performWorkspaceRedo);
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const keyLower = e.key.toLowerCase();
        if (keyLower === 'z' && !e.shiftKey) {
            if (document.activeElement && document.activeElement.classList.contains('table-cell-input')) {
                document.activeElement.blur();
            }
            e.preventDefault();
            performWorkspaceUndo();
        } else if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
            if (document.activeElement && document.activeElement.classList.contains('table-cell-input')) {
                document.activeElement.blur();
            }
            e.preventDefault();
            performWorkspaceRedo();
        }
    }
});

document.getElementById('inputSubdivideStep')?.addEventListener('input', () => {
    syncSplitButtonsStatusUI();
});

document.getElementById('btnAddRow')?.addEventListener('click', () => {
    pushUndoSnapshot('เพิ่มแถว กม. ใหม่');
    const sourceRows = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    const defSpec = findUShapeTypeSpec('VU1') || { type: 'VU1', B: 0.35, H: 0.50 };
    const last = sourceRows[sourceRows.length - 1] || {
        canalName: '1L-RMC', subCanalName: 'คูส่งน้ำสาย 1', type: defSpec.type,
        staStart: 0, nglStart: 99.66, blStart: 100.00, tblStart: roundElev(100.00 + defSpec.H),
        staEnd: 50, nglEnd: 99.66, blEnd: 99.95, tblEnd: roundElev(99.95 + defSpec.H),
        B: roundLen(defSpec.B), H: roundLen(defSpec.H), TBL: 0.50, TBR: 0.50,
        tw: roundLen(canalDefaultParams.tw), tb: roundLen(canalDefaultParams.tb),
        ts: roundLen(canalDefaultParams.ts), dt: roundLen(canalDefaultParams.dt)
    };
    const nextStart = sourceRows.length > 0 ? parseStationToMeters(last.staEnd) : 0;
    const nextEnd = nextStart + 50;
    const nextBlEnd = roundElev(Number(last.blEnd) - 0.05);
    const newRowObj = {
        canalName: last.canalName,
        subCanalName: last.subCanalName,
        type: last.type,
        staStart: nextStart,
        nglStart: Number(last.nglEnd),
        blStart: Number(last.blEnd),
        tblStart: Number(last.tblEnd),
        staEnd: nextEnd,
        nglEnd: Number(last.nglEnd),
        blEnd: nextBlEnd,
        tblEnd: roundElev(nextBlEnd + Number(last.H)),
        B: Number(last.B),
        H: Number(last.H),
        TBL: Number(last.TBL),
        TBR: Number(last.TBR),
        tw: Number(last.tw),
        tb: Number(last.tb),
        ts: Number(last.ts),
        dt: Number(last.dt),
        staStartTags: ['baseStart'],
        staEndTags: ['baseEnd'],
        remark: 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
        sectionNo: String((parseInt(last.sectionNo, 10) || sourceRows.length) + 1)
    };
    masterBoqRows.push(cloneBoqRowItem(newRowObj));
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = boqRows.length - 1;
    renderBoqTable();
});

document.getElementById('btnResetSampleRows')?.addEventListener('click', () => {
    pushUndoSnapshot('ล้างข้อมูลตาราง');
    hiddenStationCategories.clear();
    boqRows = [];
    masterBoqRows = [];
    selectedRowIndex = 0;
    renderBoqTable();
    showBanner('ล้างข้อมูลในตารางเรียบร้อยแล้ว', 'cyan');
});

// ปุ่มแบ่ง กม. ทุกๆ X เมตร (Toggle: เมื่อกดแบ่งแล้ว ปุ่มจะกลายเป็นสถานะ "ลบ กม. ที่แบ่ง" แทนอัตโนมัติ)
document.getElementById('btnSubdivideStations')?.addEventListener('click', () => {
    const counts = getSplitStationCountsInMaster();
    if (counts.step > 0) {
        removeStationsByOriginTag(t => t === 'step' || t.startsWith('step:'), `จุดแบ่งทุก ${counts.stepLabel} ม.`, ['step']);
        return;
    }

    const stepVal = parseFloat(document.getElementById('inputSubdivideStep').value);
    if (isNaN(stepVal) || stepVal <= 0) {
        showToast('กรุณาระบุระยะแบ่ง กม. (เมตร) ให้มากกว่า 0 ครับ', 'amber');
        return;
    }
    const scope = document.getElementById('selectSubdivideScope').value;
    const baseSource = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    const prevRowCount = baseSource.length;

    pushUndoSnapshot(`แบ่ง กม. ทุกๆ ${stepVal} ม.`);
    hiddenStationCategories.delete('step');

    if (scope === 'selected') {
        const targetRow = boqRows[selectedRowIndex];
        if (!targetRow) return;
        const subResult = deduplicateAndNormalizeBoqRows([targetRow], false, stepVal);
        if (subResult.rows.length > 0) {
            const updatedAll = [
                ...boqRows.slice(0, selectedRowIndex),
                ...subResult.rows,
                ...boqRows.slice(selectedRowIndex + 1)
            ];
            const finalCleaned = deduplicateAndNormalizeBoqRows(updatedAll, false, 0);
            masterBoqRows = cloneBoqRows(finalCleaned.rows);
        }
    } else {
        const subResult = deduplicateAndNormalizeBoqRows(baseSource, false, stepVal);
        if (subResult.rows.length > 0) {
            masterBoqRows = cloneBoqRows(subResult.rows);
        }
    }

    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    renderBoqTable();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

    const diffRows = masterBoqRows.length - prevRowCount;
    if (diffRows > 0) {
        showBanner(`✂️ แบ่งช่วง กม. ออกเป็นทุกๆ ${stepVal} เมตร สำเร็จ! (เพิ่มจาก ${prevRowCount} แถว เป็น ${boqRows.length} ช่วง กม. • ปุ่มเปลี่ยนสถานะเป็น "ลบ กม. ที่แบ่ง" เรียบร้อย)`, 'emerald');
        showToast(`✂️ แบ่ง กม. ทุกๆ ${stepVal} ม. สำเร็จ (ปุ่มเปลี่ยนเป็นสถานะ ลบ กม. ที่แบ่ง)`, 'emerald');
    } else {
        showBanner(`ตรวจสอบแล้ว: ตารางปัจจุบันมีจุด กม. ตามระยะทุกๆ ${stepVal} เมตรครบถ้วนแล้ว (${boqRows.length} ช่วง กม.)`, 'cyan');
        showToast(`ตารางมีจุด กม. ทุกๆ ${stepVal} ม. ครบแล้ว`, 'cyan');
    }
});

// ปุ่มตรวจสอบและล้าง กม. ที่ซ้ำกันทั้งในเส้นดินเดิม (Digitizer) และในตารางคำนวณ (BoQ)
document.getElementById('btnCheckDeduplicateStations')?.addEventListener('click', () => {
    pushUndoSnapshot('ตรวจสอบและล้าง กม. ซ้ำ');
    const beforeDigCount = digPoints.length;
    digPoints = deduplicateDigitizerPointArray(digPoints, STATION_DUP_EPS);
    if (digIsMultiPage && digPageStates) {
        Object.keys(digPageStates).forEach(k => {
            if (digPageStates[k] && Array.isArray(digPageStates[k].points)) {
                digPageStates[k].points = deduplicateDigitizerPointArray(digPageStates[k].points, STATION_DUP_EPS);
            }
        });
    }
    updateDigTable();
    redrawDigitizer();

    const baseSource = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    const cleaned = deduplicateAndNormalizeBoqRows(baseSource, false, 0);
    if (cleaned.rows.length > 0) {
        masterBoqRows = cloneBoqRows(cleaned.rows);
    }
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    renderBoqTable();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

    showBanner(`ตรวจสอบความซ้ำซ้อนของ กม. เรียบร้อยแล้ว: เส้นดินเดิม (${digPoints.length} จุด) และตาราง BoQ (${boqRows.length} ช่วง กม.) เรียงลำดับถูกต้องและไม่มี กม. ซ้ำกัน`, 'emerald');
    showToast(`✅ ตรวจสอบเรียบร้อย: ไม่มี กม. ซ้ำกัน (ตาราง BoQ ${boqRows.length} ช่วง กม.)`, 'emerald');
});

// ปุ่มแสดง/ซ่อน กม. ที่แบ่งทุกๆ X เมตร
document.getElementById('btnRemoveSubdividedStations')?.addEventListener('click', () => {
    toggleShowHideStationCategory('step', 'จุดแบ่งทุก X ม.');
});

// ฟังก์ชันช่วยตรวจสอบและดึงจุด NGL สำหรับสายคลองส่งน้ำ/คูส่งน้ำที่ระบุ
function getNglPointsForCanalLine(lineKey) {
    // 1. ค้นหาใน savedNglProfilesByLine ที่ตรงกับ lineKey
    const exactMatch = savedNglProfilesByLine.find(item => item.lineKey === lineKey && Array.isArray(item.points) && item.points.length >= 2);
    if (exactMatch) {
        return exactMatch.points;
    }
    // 2. ค้นหาในสายว่างๆ (__BLANK__) หากบันทึกไว้เป็นสายว่าง
    const blankMatch = savedNglProfilesByLine.find(item => item.isBlankLine && Array.isArray(item.points) && item.points.length >= 2);
    if (blankMatch) {
        return blankMatch.points;
    }
    // 3. หากมีข้อมูลใน savedNglProfilesByLine เพียงสายเดียวและตารางมีเพียงสายเดียว
    if (savedNglProfilesByLine.length === 1 && Array.isArray(savedNglProfilesByLine[0].points) && savedNglProfilesByLine[0].points.length >= 2) {
        return savedNglProfilesByLine[0].points;
    }
    // 4. ดึงจากหน้าจอดึงค่าพิกัดส่วนที่ 2 ปัจจุบัน (ถ้ามี >= 2 จุด)
    const curDig = getCombinedDigitizerPoints();
    if (curDig && curDig.length >= 2) {
        return curDig;
    }
    return [];
}

function hasAnyNglDataInSystem() {
    const hasSaved = savedNglProfilesByLine.some(item => Array.isArray(item.points) && item.points.length >= 2);
    const curDig = getCombinedDigitizerPoints();
    return hasSaved || (Array.isArray(curDig) && curDig.length >= 2);
}

function openNoNglDataAlertModal(customMsg) {
    const modal = document.getElementById('noNglDataAlertModal');
    const msgEl = document.getElementById('noNglDataAlertMessage');
    if (msgEl) {
        msgEl.innerHTML = customMsg || 'ยังไม่มีข้อมูลระดับดินเดิมสำหรับแทรก กม. กรุณาไปดำเนินการดึงค่าระดับดินเดิม (NGL) และกดบันทึก (Save) ที่ <strong>ส่วนที่ 2 • XY Digitizer</strong> ก่อนครับ';
    }
    if (modal) modal.classList.remove('hidden');
    showToast('⚠️ ไม่มีข้อมูลระดับดินเดิม กรุณาไปดำเนินการที่ส่วนที่ 2 ก่อน', 'amber');
}

document.getElementById('btnCloseNoNglAlertModal')?.addEventListener('click', () => {
    document.getElementById('noNglDataAlertModal')?.classList.add('hidden');
});
document.getElementById('btnGoToSection2FromAlert')?.addEventListener('click', () => {
    document.getElementById('noNglDataAlertModal')?.classList.add('hidden');
    if (typeof returnToTakeoff === 'function') returnToTakeoff();
    if (typeof switchTableTab === 'function') switchTableTab('ground');
});

// นับจำนวนจุด กม. ดินเดิม ('ngl') ที่แทรกอยู่ในแต่ละสายของตารางส่วนที่ 3
function getInsertedNglCountForLine(lineKey) {
    const sourceRows = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    ensureAllRowsHaveParsedTags(sourceRows);
    const lineRows = sourceRows.filter(r => makeCanalLineKey(r.canalName, r.subCanalName) === lineKey);
    if (!lineRows.length) return 0;

    const stationMap = new Map();
    lineRows.forEach(r => {
        const k1 = Math.round(parseStationToMeters(r.staStart) * 100);
        const k2 = Math.round(parseStationToMeters(r.staEnd) * 100);
        if (!stationMap.has(k1)) stationMap.set(k1, new Set());
        if (!stationMap.has(k2)) stationMap.set(k2, new Set());
        (r.staStartTags || []).forEach(t => stationMap.get(k1).add(t));
        (r.staEndTags || []).forEach(t => stationMap.get(k2).add(t));
    });
    const sortedKeys = Array.from(stationMap.keys()).sort((a, b) => a - b);
    let cnt = 0;
    sortedKeys.forEach((k, idx) => {
        if (idx === 0 || idx === sortedKeys.length - 1) return;
        if (stationMap.get(k).has('ngl')) cnt++;
    });
    return cnt;
}

// แทรก กม. ดินเดิม เฉพาะสายที่เลือก (targetLineKeysArray)
function insertNglStationsForSpecificLines(targetLineKeysArray) {
    const targetSet = new Set(targetLineKeysArray);
    if (!targetSet.size) {
        showToast('กรุณาเลือกสายคลองส่งน้ำ/คูส่งน้ำอย่างน้อย 1 สาย', 'amber');
        return false;
    }
    if (!hasAnyNglDataInSystem()) {
        openNoNglDataAlertModal();
        return false;
    }

    const baseSource = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    ensureAllRowsHaveParsedTags(baseSource);

    // จัดกลุ่มแถวตามลำดับสายในตาราง
    const lineGroups = [];
    const groupMap = new Map();
    baseSource.forEach(r => {
        const lKey = makeCanalLineKey(r.canalName, r.subCanalName);
        if (!groupMap.has(lKey)) {
            const grp = { lineKey: lKey, canalName: r.canalName, subCanalName: r.subCanalName, rows: [] };
            groupMap.set(lKey, grp);
            lineGroups.push(grp);
        }
        groupMap.get(lKey).rows.push(cloneBoqRowItem(r));
    });

    const missingLines = [];
    let modifiedLineCount = 0;
    const prevTotalRows = baseSource.length;
    const savedBackupDigPoints = digPoints.map(p => ({ pixel: { ...p.pixel }, data: { ...p.data } }));

    const newAllRows = [];
    lineGroups.forEach(grp => {
        if (!targetSet.has(grp.lineKey)) {
            newAllRows.push(...grp.rows);
            return;
        }
        const lineNglPts = getNglPointsForCanalLine(grp.lineKey);
        if (!lineNglPts || lineNglPts.length < 2) {
            missingLines.push(formatCanalLineLabel(grp.canalName, grp.subCanalName));
            newAllRows.push(...grp.rows);
            return;
        }
        // ใช้ชุดจุด NGL ของสายนี้ในการแทรกเฉพาะกลุ่มแถวของสายนี้โดยไม่กระทบ digPoints หลัก
        const cleanLinePts = lineNglPts.map(pt => ({
            pixel: pt.pixel ? { ...pt.pixel } : { x: 0, y: 0 },
            data: { x: Number(pt.data.x), y: Number(pt.data.y) }
        }));
        const mergedGrp = deduplicateAndNormalizeBoqRows(grp.rows, true, 0, null, cleanLinePts);
        if (mergedGrp.rows && mergedGrp.rows.length > 0) {
            newAllRows.push(...mergedGrp.rows);
            modifiedLineCount++;
        } else {
            newAllRows.push(...grp.rows);
        }
    });

    digPoints = savedBackupDigPoints;

    if (modifiedLineCount === 0 && missingLines.length > 0) {
        openNoNglDataAlertModal(`ไม่พบข้อมูลระดับดินเดิมสำหรับ <strong>${missingLines.join(', ')}</strong> กรุณาไปดำเนินการดึงค่าระดับดินเดิมและกดบันทึก (Save) ที่ <strong>ส่วนที่ 2 • XY Digitizer</strong> ก่อนครับ`);
        return false;
    }

    pushUndoSnapshot('แทรก กม. ดินเดิมตามสายที่เลือก');
    hiddenStationCategories.delete('ngl');
    masterBoqRows = cloneBoqRows(newAllRows);
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    renderBoqTable();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

    showBanner(`➕ แทรกจุดหักดินเดิม (NGL) ลงในตารางจำนวน ${modifiedLineCount} สาย สำเร็จ (จาก ${prevTotalRows} แถว เป็น ${boqRows.length} ช่วง กม.)`, 'emerald');
    showToast(`➕ แทรก กม. ดินเดิม (${modifiedLineCount} สาย) สำเร็จ`, 'emerald');
    return true;
}

// ลบ กม. ดินเดิม เฉพาะสายที่เลือก (targetLineKeysArray)
function deleteNglStationsForSpecificLines(targetLineKeysArray) {
    const targetSet = new Set(targetLineKeysArray);
    if (!targetSet.size) {
        showToast('กรุณาเลือกสายคลองส่งน้ำ/คูส่งน้ำอย่างน้อย 1 สาย', 'amber');
        return false;
    }
    const baseSource = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    ensureAllRowsHaveParsedTags(baseSource);

    const lineGroups = [];
    const groupMap = new Map();
    baseSource.forEach(r => {
        const lKey = makeCanalLineKey(r.canalName, r.subCanalName);
        if (!groupMap.has(lKey)) {
            const grp = { lineKey: lKey, rows: [] };
            groupMap.set(lKey, grp);
            lineGroups.push(grp);
        }
        groupMap.get(lKey).rows.push(cloneBoqRowItem(r));
    });

    let totalRemovedPts = 0;
    const rebuiltAllRows = [];

    lineGroups.forEach(grp => {
        if (!targetSet.has(grp.lineKey)) {
            rebuiltAllRows.push(...grp.rows);
            return;
        }
        const stationMap = new Map();
        const ensureStaEntry = (staVal, snapProps) => {
            const key = Math.round(staVal * 100);
            if (!stationMap.has(key)) {
                stationMap.set(key, {
                    sta: roundStation(staVal),
                    tags: new Set(),
                    props: { ...snapProps }
                });
            }
            return stationMap.get(key);
        };

        grp.rows.forEach((r, idx) => {
            const s1 = parseStationToMeters(r.staStart);
            const s2 = parseStationToMeters(r.staEnd);
            const e1 = ensureStaEntry(s1, {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglStart) ? '-' : Number(r.nglStart), bl: Number(r.blStart), tbl: Number(r.tblStart),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            });
            (r.staStartTags || [idx === 0 ? 'baseStart' : 'baseEnd']).forEach(t => e1.tags.add(t));

            const e2 = ensureStaEntry(s2, {
                canalName: r.canalName, subCanalName: r.subCanalName, type: r.type,
                ngl: isMissingNglValue(r.nglEnd) ? '-' : Number(r.nglEnd), bl: Number(r.blEnd), tbl: Number(r.tblEnd),
                B: Number(r.B), H: Number(r.H), TBL: Number(r.TBL), TBR: Number(r.TBR),
                tw: Number(r.tw), tb: Number(r.tb), ts: Number(r.ts), dt: Number(r.dt)
            });
            (r.staEndTags || ['baseEnd']).forEach(t => e2.tags.add(t));
        });

        const sortedPts = Array.from(stationMap.values()).sort((a, b) => a.sta - b.sta);
        if (sortedPts.length < 2) {
            rebuiltAllRows.push(...grp.rows);
            return;
        }
        sortedPts[0].tags.add('baseStart');
        sortedPts[sortedPts.length - 1].tags.add('baseEnd');

        const keptPts = [];
        sortedPts.forEach((pt, idx) => {
            const isBoundary = (idx === 0 || idx === sortedPts.length - 1);
            if (pt.tags.has('ngl')) {
                pt.tags.delete('ngl');
            }
            if (pt.tags.size === 0 && !isBoundary) {
                totalRemovedPts++;
            } else {
                if (pt.tags.size === 0 && isBoundary) {
                    pt.tags.add(idx === 0 ? 'baseStart' : 'baseEnd');
                }
                keptPts.push(pt);
            }
        });

        for (let i = 0; i < keptPts.length - 1; i++) {
            const ptA = keptPts[i];
            const ptB = keptPts[i + 1];
            if (ptB.sta - ptA.sta <= STATION_DUP_EPS) continue;
            const startTagsArr = Array.from(ptA.tags);
            const endTagsArr = Array.from(ptB.tags);
            const sMid = (ptA.sta + ptB.sta) * 0.5;
            const covRow = grp.rows.find(sr => {
                const ms1 = parseStationToMeters(sr.staStart);
                const ms2 = parseStationToMeters(sr.staEnd);
                return sMid >= Math.min(ms1, ms2) - STATION_DUP_EPS && sMid <= Math.max(ms1, ms2) + STATION_DUP_EPS;
            }) || grp.rows[0];
            const pRef = covRow || ptA.props;

            rebuiltAllRows.push({
                canalName: pRef.canalName || '1L-RMC',
                subCanalName: pRef.subCanalName || 'คูส่งน้ำสาย 1',
                type: pRef.type || 'VU1',
                staStart: ptA.sta,
                nglStart: roundElev(ptA.props.ngl),
                blStart: roundElev(ptA.props.bl),
                tblStart: roundElev(ptA.props.tbl),
                staEnd: ptB.sta,
                nglEnd: roundElev(ptB.props.ngl),
                blEnd: roundElev(ptB.props.bl),
                tblEnd: roundElev(ptB.props.tbl),
                B: Number(pRef.B),
                H: Number(pRef.H),
                TBL: Number(pRef.TBL),
                TBR: Number(pRef.TBR),
                tw: Number(pRef.tw),
                tb: Number(pRef.tb),
                ts: Number(pRef.ts),
                dt: Number(pRef.dt),
                staStartTags: startTagsArr,
                staEndTags: endTagsArr,
                remark: buildRemarkFromTags(startTagsArr, endTagsArr, lastSubdivideStepLabel),
                sectionNo: (covRow && covRow.sectionNo !== undefined && String(covRow.sectionNo).trim() !== '') ? String(covRow.sectionNo).trim() : String(i + 1)
            });
        }
    });

    if (totalRemovedPts === 0) {
        showToast('ไม่พบจุด กม. ดินเดิมที่แทรกไว้ในสายที่เลือก', 'amber');
        return false;
    }

    pushUndoSnapshot('ลบ กม. ดินเดิมตามสายที่เลือก');
    hiddenStationCategories.delete('ngl');
    masterBoqRows = cloneBoqRows(rebuiltAllRows);
    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    renderBoqTable();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

    showBanner(`🗑 ลบจุด กม. ดินเดิมออกจำนวน ${totalRemovedPts} จุด เรียบร้อยแล้ว (ตารางเหลือ ${boqRows.length} ช่วง กม.)`, 'cyan');
    showToast(`🗑 ลบ กม. ดินเดิม (${totalRemovedPts} จุด) เรียบร้อยแล้ว`, 'cyan');
    return true;
}

function openNglInsertDeleteLineModal(mode = 'insert') {
    const lines = getUniqueCanalLinesFromBoqTable();
    if (mode === 'insert' && !hasAnyNglDataInSystem()) {
        openNoNglDataAlertModal();
        return;
    }
    const modal = document.getElementById('nglInsertDeleteLineModal');
    const listEl = document.getElementById('nglLineModalListContainer');
    const summaryEl = document.getElementById('nglLineModalCountSummary');
    const chkAll = document.getElementById('chkSelectAllNglModalLines');
    if (!modal || !listEl) return;

    if (summaryEl) {
        summaryEl.innerText = `ตรวจพบในตารางทั้งหมด ${lines.length} สาย`;
    }
    if (chkAll) chkAll.checked = true;

    listEl.innerHTML = lines.map((l, idx) => {
        const insertedCnt = getInsertedNglCountForLine(l.lineKey);
        const availPts = getNglPointsForCanalLine(l.lineKey);
        const hasNgl = availPts && availPts.length >= 2;
        const statusBadge = insertedCnt > 0
            ? `<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold">แทรกแล้ว ${insertedCnt} จุด</span>`
            : `<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">ยังไม่แทรก กม. ดินเดิม</span>`;
        const nglSourceBadge = hasNgl
            ? `<span class="text-[11px] text-cyan-300 font-mono">พร้อมแทรก (${availPts.length} จุด NGL)</span>`
            : `<span class="text-[11px] text-amber-400">⚠️ ยังไม่มีข้อมูลดินเดิมในส่วนที่ 2</span>`;

        return `
            <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[220px]">
                    <input type="checkbox" data-ngl-line-chk="${l.lineKey}" checked class="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400">
                    <div>
                        <div class="font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>${idx + 1}. ${l.label}</span>
                            ${statusBadge}
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>ช่วง กม. ${formatMetersToStation(l.minSta)} - ${formatMetersToStation(l.maxSta)} (${l.rowCount} แถว)</span>
                            <span>•</span>
                            ${nglSourceBadge}
                        </div>
                    </div>
                </label>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" data-single-insert-ngl="${l.lineKey}" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition">
                        ➕ แทรกสายนี้
                    </button>
                    <button type="button" data-single-delete-ngl="${l.lineKey}" ${insertedCnt === 0 ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg ${insertedCnt > 0 ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'} font-semibold text-[11px] transition">
                        🗑 ลบสายนี้
                    </button>
                </div>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('button[data-single-insert-ngl]').forEach(btn => {
        btn.addEventListener('click', () => {
            const lKey = btn.getAttribute('data-single-insert-ngl');
            if (insertNglStationsForSpecificLines([lKey])) {
                openNglInsertDeleteLineModal('insert');
            }
        });
    });
    listEl.querySelectorAll('button[data-single-delete-ngl]').forEach(btn => {
        btn.addEventListener('click', () => {
            const lKey = btn.getAttribute('data-single-delete-ngl');
            if (deleteNglStationsForSpecificLines([lKey])) {
                openNglInsertDeleteLineModal('delete');
            }
        });
    });

    modal.classList.remove('hidden');
}

document.getElementById('chkSelectAllNglModalLines')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('input[data-ngl-line-chk]').forEach(chk => {
        chk.checked = checked;
    });
});
document.getElementById('btnCloseNglLineModal')?.addEventListener('click', () => {
    document.getElementById('nglInsertDeleteLineModal')?.classList.add('hidden');
});
document.getElementById('btnCancelNglLineModal')?.addEventListener('click', () => {
    document.getElementById('nglInsertDeleteLineModal')?.classList.add('hidden');
});
document.getElementById('btnConfirmInsertNglSelectedLines')?.addEventListener('click', () => {
    const selectedKeys = Array.from(document.querySelectorAll('input[data-ngl-line-chk]:checked')).map(el => el.getAttribute('data-ngl-line-chk'));
    if (insertNglStationsForSpecificLines(selectedKeys)) {
        document.getElementById('nglInsertDeleteLineModal')?.classList.add('hidden');
    }
});
document.getElementById('btnConfirmDeleteNglSelectedLines')?.addEventListener('click', () => {
    const selectedKeys = Array.from(document.querySelectorAll('input[data-ngl-line-chk]:checked')).map(el => el.getAttribute('data-ngl-line-chk'));
    if (deleteNglStationsForSpecificLines(selectedKeys)) {
        document.getElementById('nglInsertDeleteLineModal')?.classList.add('hidden');
    }
});

// ปุ่มแทรก กม. ดินเดิม (#btnInsertDigitizerStations) และปุ่มลบ กม. ดินเดิม (#btnDeleteDigitizerStationsByLine)
document.getElementById('btnInsertDigitizerStations')?.addEventListener('click', () => {
    const lines = getUniqueCanalLinesFromBoqTable();
    const counts = getSplitStationCountsInMaster();

    // กรณีในตารางมีหลายสาย ให้ขึ้นหน้าต่างให้เลือกแทรกหรือลบของสายไหน
    if (lines.length > 1) {
        if (counts.ngl === 0 && !hasAnyNglDataInSystem()) {
            openNoNglDataAlertModal();
            return;
        }
        openNglInsertDeleteLineModal(counts.ngl > 0 ? 'delete' : 'insert');
        return;
    }

    // กรณีตารางมีสายเดียว
    if (counts.ngl > 0) {
        deleteNglStationsForSpecificLines([lines[0]?.lineKey || '__BLANK__']);
        return;
    }
    if (!hasAnyNglDataInSystem()) {
        openNoNglDataAlertModal();
        return;
    }
    insertNglStationsForSpecificLines([lines[0]?.lineKey || '__BLANK__']);
});

document.getElementById('btnDeleteDigitizerStationsByLine')?.addEventListener('click', () => {
    const lines = getUniqueCanalLinesFromBoqTable();
    const counts = getSplitStationCountsInMaster();
    if (counts.ngl === 0) {
        if (!hasAnyNglDataInSystem()) {
            openNoNglDataAlertModal();
        } else {
            showToast('ยังไม่มีจุด กม. ดินเดิมที่แทรกไว้ในตารางให้ลบ', 'amber');
        }
        return;
    }
    if (lines.length > 1) {
        openNglInsertDeleteLineModal('delete');
        return;
    }
    deleteNglStationsForSpecificLines([lines[0]?.lineKey || '__BLANK__']);
});

// ปุ่มแสดง/ซ่อน กม. ดินเดิม
document.getElementById('btnRemoveDigitizerStations')?.addEventListener('click', () => {
    toggleShowHideStationCategory('ngl', 'จุดหักดินเดิม');
});

// ฟังก์ชันช่วย Toggle แบ่ง/ลบ กม. ที่ค่างานดินแต่ละหมวดเป็น 0
function handleSplitZeroTransitionByCategory(zeroCatKey, catLabelThai) {
    const counts = getSplitStationCountsInMaster();
    if (zeroCatKey === 'all') {
        if (counts.zero_all > 0) {
            removeStationsByOriginTag(
                t => t.startsWith('zero_'),
                'จุดที่ค่างานดินเป็น 0 (ทั้งหมด)',
                ['zero_stripping', 'zero_compacted', 'zero_excavation', 'zero_manual']
            );
            return;
        }
    } else if ((counts[zeroCatKey] || 0) > 0) {
        removeStationsByOriginTag(t => t === zeroCatKey, catLabelThai, [zeroCatKey]);
        return;
    }

    const scope = document.getElementById('selectSubdivideScope').value;
    const baseSource = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    const prevCount = baseSource.length;

    pushUndoSnapshot(`แบ่ง กม. (${catLabelThai})`);
    if (zeroCatKey === 'all') {
        ['zero_stripping', 'zero_compacted', 'zero_excavation', 'zero_manual'].forEach(k => hiddenStationCategories.delete(k));
    } else {
        hiddenStationCategories.delete(zeroCatKey);
    }

    if (scope === 'selected') {
        const targetRow = boqRows[selectedRowIndex];
        if (!targetRow) return;
        const subRes = deduplicateAndNormalizeBoqRows([targetRow], false, 0, zeroCatKey);
        if (subRes.rows.length > 0) {
            const updated = [
                ...boqRows.slice(0, selectedRowIndex),
                ...subRes.rows,
                ...boqRows.slice(selectedRowIndex + 1)
            ];
            masterBoqRows = cloneBoqRows(updated);
        }
    } else {
        const subRes = deduplicateAndNormalizeBoqRows(baseSource, false, 0, zeroCatKey);
        if (subRes.rows.length > 0) {
            masterBoqRows = cloneBoqRows(subRes.rows);
        }
    }

    rebuildVisibleBoqRowsFromMaster();
    selectedRowIndex = Math.min(Math.max(0, selectedRowIndex), boqRows.length - 1);
    renderBoqTable();
    resetCompareStartView();
    resetCompareEndView();
    if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

    const addedCount = masterBoqRows.length - prevCount;
    if (addedCount > 0) {
        showBanner(`🎯 แบ่งช่วง กม. ณ "${catLabelThai}" สำเร็จ! (เพิ่มจุดตัด ${addedCount} จุด รวมเป็น ${boqRows.length} ช่วง กม. • ปุ่มเปลี่ยนสถานะเป็น "ลบ กม. ที่แบ่ง" เรียบร้อย)`, 'emerald');
        showToast(`🎯 แบ่ง กม. (${catLabelThai}) เพิ่ม ${addedCount} จุด สำเร็จ!`, 'emerald');
    } else {
        showBanner(`ตรวจสอบแล้ว: ไม่พบจุดตัดผ่านค่า 0 สำหรับ "${catLabelThai}" ในช่วงข้อมูลปัจจุบัน`, 'cyan');
        showToast(`ไม่พบจุดตัดผ่านค่า 0 สำหรับ "${catLabelThai}" ในช่วงนี้`, 'cyan');
    }
}

// 1. ขุดลอกหน้าดินเป็น 0 (ปุ่มซ้าย: แบ่ง ↔ ลบ กม. ที่แบ่ง | ปุ่มขวา: แสดง/ซ่อน กม.)
document.getElementById('btnSplitZeroStripping')?.addEventListener('click', () => {
    handleSplitZeroTransitionByCategory('zero_stripping', 'จุดพื้นที่ขุดลอกหน้าดินเป็น 0');
});
document.getElementById('btnRemoveZeroStripping')?.addEventListener('click', () => {
    toggleShowHideStationCategory('zero_stripping', 'จุดพื้นที่ขุดลอกหน้าดินเป็น 0');
});

// 2. ดินถมบดอัดแน่น 85% เป็น 0 (ปุ่มซ้าย: แบ่ง ↔ ลบ กม. ที่แบ่ง | ปุ่มขวา: แสดง/ซ่อน กม.)
document.getElementById('btnSplitZeroCompacted')?.addEventListener('click', () => {
    handleSplitZeroTransitionByCategory('zero_compacted', 'จุดพื้นที่ดินถมบดอัด 85% เป็น 0');
});
document.getElementById('btnRemoveZeroCompacted')?.addEventListener('click', () => {
    toggleShowHideStationCategory('zero_compacted', 'จุดพื้นที่ดินถมบดอัด 85% เป็น 0');
});

// 3. พื้นที่ดินขุดเป็น 0 (ปุ่มซ้าย: แบ่ง ↔ ลบ กม. ที่แบ่ง | ปุ่มขวา: แสดง/ซ่อน กม.)
document.getElementById('btnSplitZeroExcavation')?.addEventListener('click', () => {
    handleSplitZeroTransitionByCategory('zero_excavation', 'จุดพื้นที่ดินขุดเป็น 0');
});
document.getElementById('btnRemoveZeroExcavation')?.addEventListener('click', () => {
    toggleShowHideStationCategory('zero_excavation', 'จุดพื้นที่ดินขุดเป็น 0');
});

// 4. ดินถมด้วยแรงคนเป็น 0 (ปุ่มซ้าย: แบ่ง ↔ ลบ กม. ที่แบ่ง | ปุ่มขวา: แสดง/ซ่อน กม.)
document.getElementById('btnSplitZeroManualFill')?.addEventListener('click', () => {
    handleSplitZeroTransitionByCategory('zero_manual', 'จุดพื้นที่ดินถมแรงคนเป็น 0');
});
document.getElementById('btnRemoveZeroManualFill')?.addEventListener('click', () => {
    toggleShowHideStationCategory('zero_manual', 'จุดพื้นที่ดินถมแรงคนเป็น 0');
});

// ปุ่มรวม: แบ่ง ↔ ลบ จุดที่ค่างานดินเป็น 0 ครบทุกหมวดงาน & ปุ่มแสดง/ซ่อนรวม
document.getElementById('btnSplitZeroAll')?.addEventListener('click', () => {
    handleSplitZeroTransitionByCategory('all', 'จุดที่ค่างานดินเป็น 0 ครบทุกหมวดงาน');
});
document.getElementById('btnRemoveZeroAll')?.addEventListener('click', () => {
    toggleShowHideStationCategory(['zero_stripping', 'zero_compacted', 'zero_excavation', 'zero_manual'], 'จุดที่ค่างานดินเป็น 0 (ทั้งหมด)');
});

// ============================================================================
// 6. EXCEL (.XLSX) & CSV UPLOAD / DOWNLOAD HANDLERS
// ============================================================================
const fileStatusBanner = document.getElementById('fileStatusBanner');
const fileStatusText = document.getElementById('fileStatusText');
document.getElementById('btnCloseBanner')?.addEventListener('click', () => {
    fileStatusBanner.classList.add('hidden');
});

function showBanner(msg, tone = 'emerald') {
    fileStatusText.innerText = msg;
    fileStatusBanner.classList.remove('hidden', 'bg-emerald-950/80', 'border-emerald-600/60', 'text-emerald-200', 'bg-amber-950/80', 'border-amber-600/60', 'text-amber-200', 'bg-cyan-950/80', 'border-cyan-600/60', 'text-cyan-200');
    if (tone === 'amber') {
        fileStatusBanner.classList.add('bg-amber-950/80', 'border-amber-600/60', 'text-amber-200');
    } else if (tone === 'cyan') {
        fileStatusBanner.classList.add('bg-cyan-950/80', 'border-cyan-600/60', 'text-cyan-200');
    } else {
        fileStatusBanner.classList.add('bg-emerald-950/80', 'border-emerald-600/60', 'text-emerald-200');
    }
}

const uploadExcelInput = document.getElementById('uploadExcelInput');
document.getElementById('btnUploadExcel')?.addEventListener('click', () => {
    uploadExcelInput.value = '';
    uploadExcelInput.click();
});

// สร้างข้อมูลตารางสำหรับแท็บที่ 2 "ข้อมูลดินเดิม_NGL" (เก็บข้อมูลดินเดิมจาก Digitizer และจุดหลักของคลอง)
function collectOriginalGroundPointsList() {
    const pointMap = new Map();
    const digCombined = typeof getCombinedDigitizerPoints === 'function' ? getCombinedDigitizerPoints() : [];
    const baseBlStart = parseFloat(document.getElementById('digTransferBlStart')?.value) || 100.000;
    const slope = parseFloat(document.getElementById('digTransferBlSlope')?.value) || -0.0010;
    const x0 = digCombined.length > 0 ? Number(digCombined[0].data.x) : 0;

    digCombined.forEach(pt => {
        const staM = roundStation(pt.data.x);
        const nglVal = roundElev(pt.data.y);
        const blVal = roundElev(baseBlStart + (staM - x0) * slope);
        const tblVal = roundElev(blVal + roundLen(paramH || 0.50));
        const key = Math.round(staM * 100);
        pointMap.set(key, {
            sta: staM,
            staFormatted: formatMetersToStation(staM),
            ngl: nglVal,
            bl: blVal,
            tbl: tblVal,
            source: 'จุดหักดินเดิม (XY Digitizer)',
            pixelX: pt.pixel && pt.pixel.x !== undefined ? Number(Number(pt.pixel.x).toFixed(2)) : '',
            pixelY: pt.pixel && pt.pixel.y !== undefined ? Number(Number(pt.pixel.y).toFixed(2)) : '',
            page: pt.page || 1
        });
    });

    const rowsRef = (Array.isArray(masterBoqRows) && masterBoqRows.length) ? masterBoqRows : boqRows;
    rowsRef.forEach(r => {
        const s1 = roundStation(parseStationToMeters(r.staStart));
        const s2 = roundStation(parseStationToMeters(r.staEnd));
        const k1 = Math.round(s1 * 100);
        const k2 = Math.round(s2 * 100);
        const s1Tags = Array.isArray(r.staStartTags) ? r.staStartTags : ['baseStart'];
        const s2Tags = Array.isArray(r.staEndTags) ? r.staEndTags : ['baseEnd'];

        const isBaseOrNgl1 = s1Tags.some(t => t === 'baseStart' || t === 'baseEnd' || t === 'base' || t === 'ngl');
        if (isBaseOrNgl1 && !pointMap.has(k1)) {
            pointMap.set(k1, {
                sta: s1,
                staFormatted: formatMetersToStation(s1),
                ngl: roundElev(r.nglStart),
                bl: roundElev(r.blStart),
                tbl: roundElev(r.tblStart),
                source: formatTagSetForStation(new Set(s1Tags), true, lastSubdivideStepLabel),
                pixelX: '',
                pixelY: '',
                page: 1
            });
        }

        const isBaseOrNgl2 = s2Tags.some(t => t === 'baseStart' || t === 'baseEnd' || t === 'base' || t === 'ngl');
        if (isBaseOrNgl2 && !pointMap.has(k2)) {
            pointMap.set(k2, {
                sta: s2,
                staFormatted: formatMetersToStation(s2),
                ngl: roundElev(r.nglEnd),
                bl: roundElev(r.blEnd),
                tbl: roundElev(r.tblEnd),
                source: formatTagSetForStation(new Set(s2Tags), false, lastSubdivideStepLabel),
                pixelX: '',
                pixelY: '',
                page: 1
            });
        }
    });

    return Array.from(pointMap.values()).sort((a, b) => a.sta - b.sta);
}

function updateOriginalGroundTabBadgeUI() {
    const badge = document.getElementById('badgeNglTabInfo');
    if (!badge) return;
    const nglList = collectOriginalGroundPointsList();
    badge.innerHTML = `<span>📑 แท็บข้อมูลดินเดิม_NGL: ${nglList.length} จุด</span>`;
}

function buildOriginalGroundSheetAoA() {
    const nglList = collectOriginalGroundPointsList();
    const calibMeta = JSON.stringify({
        p1XVal: document.getElementById('p1XVal')?.value ?? '0',
        p1YVal: document.getElementById('p1YVal')?.value ?? '98.000',
        p2XVal: document.getElementById('p2XVal')?.value ?? '200',
        p2YVal: document.getElementById('p2YVal')?.value ?? '102.000',
        digRefPixels: digRefPixels || { p1: null, p2: null },
        digTransferBlStart: document.getElementById('digTransferBlStart')?.value ?? '100.000',
        digTransferBlSlope: document.getElementById('digTransferBlSlope')?.value ?? '-0.0010',
        digXStepVal: document.getElementById('digXStepVal')?.value ?? '50'
    });

    const header = [
        'ลำดับที่',
        'ระยะ กม. (เมตร)',
        'กม. (0+000)',
        'ระดับดินเดิม NGL (ม.รทก.)',
        'ระดับท้องคลอง BL. (ม.รทก.)',
        'ระดับหลังคัน TBL. (ม.รทก.)',
        'แหล่งที่มาข้อมูลดินเดิม',
        'Pixel_X',
        'Pixel_Y',
        'PDF_Page',
        'Calibration_Metadata'
    ];

    const rows = [header];
    nglList.forEach((pt, idx) => {
        rows.push([
            idx + 1,
            roundStation(pt.sta),
            pt.staFormatted,
            roundElev(pt.ngl),
            roundElev(pt.bl),
            roundElev(pt.tbl),
            pt.source,
            pt.pixelX !== '' ? Number(pt.pixelX) : '',
            pt.pixelY !== '' ? Number(pt.pixelY) : '',
            pt.page || 1,
            idx === 0 ? calibMeta : ''
        ]);
    });
    return rows;
}

// อ่านข้อมูลจากแท็บที่ 2 "ข้อมูลดินเดิม_NGL" เมื่อนำเข้าไฟล์ Excel
function restoreOriginalGroundFromWorkbook(workbook) {
    if (!workbook || !Array.isArray(workbook.SheetNames)) return 0;
    const nglSheetName = workbook.SheetNames.find(
        n => n === 'ข้อมูลดินเดิม_NGL' || n.includes('ดินเดิม') || n.toUpperCase().includes('NGL')
    );
    if (!nglSheetName) return 0;

    const wsNgl = workbook.Sheets[nglSheetName];
    if (!wsNgl) return 0;
    const rawNglRows = XLSX.utils.sheet_to_json(wsNgl, { header: 1, defval: '' });
    if (!rawNglRows || rawNglRows.length < 2) return 0;

    // ตรวจสอบ Calibration_Metadata ในแถวแรกของข้อมูล (ถ้ามี)
    for (let i = 1; i < Math.min(rawNglRows.length, 5); i++) {
        const metaCell = String(rawNglRows[i]?.[10] ?? '').trim();
        if (metaCell.startsWith('{')) {
            try {
                const meta = JSON.parse(metaCell);
                if (meta.p1XVal !== undefined && document.getElementById('p1XVal')) document.getElementById('p1XVal').value = meta.p1XVal;
                if (meta.p1YVal !== undefined && document.getElementById('p1YVal')) document.getElementById('p1YVal').value = meta.p1YVal;
                if (meta.p2XVal !== undefined && document.getElementById('p2XVal')) document.getElementById('p2XVal').value = meta.p2XVal;
                if (meta.p2YVal !== undefined && document.getElementById('p2YVal')) document.getElementById('p2YVal').value = meta.p2YVal;
                if (meta.digTransferBlStart !== undefined && document.getElementById('digTransferBlStart')) document.getElementById('digTransferBlStart').value = meta.digTransferBlStart;
                if (meta.digTransferBlSlope !== undefined && document.getElementById('digTransferBlSlope')) document.getElementById('digTransferBlSlope').value = meta.digTransferBlSlope;
                if (meta.digXStepVal !== undefined && document.getElementById('digXStepVal')) { document.getElementById('digXStepVal').value = meta.digXStepVal; if (document.getElementById('digStepVisibleInput')) document.getElementById('digStepVisibleInput').value = meta.digXStepVal; }
                if (meta.digRefPixels && meta.digRefPixels.p1 && meta.digRefPixels.p2) {
                    digRefPixels = {
                        p1: { ...meta.digRefPixels.p1 },
                        p2: { ...meta.digRefPixels.p2 }
                    };
                }
                break;
            } catch (err) {}
        }
    }

    const headerRow = (rawNglRows[0] || []).map(h => String(h ?? '').trim());
    const isSection2Format = headerRow[1] === 'คลองส่งน้ำ' || headerRow[2] === 'คูส่งน้ำ';

    const restoredPts = [];
    const linePtsMap = new Map();

    for (let i = 1; i < rawNglRows.length; i++) {
        const r = rawNglRows[i];
        if (!r || r.length < 4) continue;

        let canalName = '-';
        let subCanalName = '-';
        let staRaw, nglRaw, pxXRaw, pxYRaw, pageRaw;

        if (isSection2Format) {
            canalName = String(r[1] ?? '-').trim() || '-';
            subCanalName = String(r[2] ?? '-').trim() || '-';
            staRaw = String(r[3] ?? '').trim() !== '' ? r[3] : r[4];
            nglRaw = r[5];
            pxXRaw = r[6];
            pxYRaw = r[7];
            pageRaw = 1;
        } else {
            staRaw = String(r[1] ?? '').trim() !== '' ? r[1] : r[2];
            nglRaw = r[3];
            pxXRaw = r[7];
            pxYRaw = r[8];
            pageRaw = r[9];
        }

        if (String(staRaw ?? '').trim() === '' || String(nglRaw ?? '').trim() === '') continue;

        const staVal = parseStationToMeters(staRaw);
        const nglVal = parseFloat(nglRaw);
        if (isNaN(staVal) || isNaN(nglVal)) continue;

        let pxX = parseFloat(pxXRaw);
        let pxY = parseFloat(pxYRaw);
        if (isNaN(pxX) || isNaN(pxY)) {
            const computedPx = typeof dataToPixel === 'function' ? dataToPixel(staVal, nglVal) : null;
            pxX = computedPx ? computedPx.x : 0;
            pxY = computedPx ? computedPx.y : 0;
        }
        const pageNum = parseInt(pageRaw, 10) || 1;
        const ptObj = {
            pixel: { x: pxX, y: pxY },
            data: { x: roundStation(staVal), y: roundElev(nglVal) },
            page: pageNum
        };
        restoredPts.push(ptObj);

        if (isSection2Format) {
            const lKey = makeCanalLineKey(canalName, subCanalName);
            if (!linePtsMap.has(lKey)) {
                linePtsMap.set(lKey, { canalName, subCanalName, pts: [] });
            }
            linePtsMap.get(lKey).pts.push(ptObj);
        }
    }

    if (restoredPts.length > 0) {
        if (isSection2Format && linePtsMap.size > 0) {
            linePtsMap.forEach((grp) => {
                const dedupedLinePts = deduplicateDigitizerPointArray(grp.pts, STATION_DUP_EPS);
                digPoints = dedupedLinePts;
                const payload = buildCurrentDigSavePayload(grp.canalName, grp.subCanalName);
                savePayloadIntoNglProfilesList(payload);
            });
        }
        digPoints = deduplicateDigitizerPointArray(restoredPts, STATION_DUP_EPS);
        if (digPageStates && digPageStates[1]) {
            digPageStates[1].points = digPoints.map(p => ({ pixel: { ...p.pixel }, data: { ...p.data } }));
        }
        updateDigTable();
        redrawDigitizer();
    }
    return restoredPts.length;
}

uploadExcelInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (!rawRows || rawRows.length < 2) {
                showBanner('ไม่พบแถวข้อมูลในไฟล์ที่อัปโหลด กรุณาตรวจสอบไฟล์อีกครั้ง', 'amber');
                return;
            }

            pushUndoSnapshot(`อัปโหลดไฟล์ ${file.name}`);

            // 1. ตรวจสอบและนำเข้าข้อมูลดินเดิมจากแท็บที่ 2 ("ข้อมูลดินเดิม_NGL") หากมีในไฟล์
            const importedNglCount = restoreOriginalGroundFromWorkbook(workbook);

            // 2. อ่านค่าเริ่มต้น ts และ dt จากส่วนหมายเหตุท้ายตาราง (ถ้ามี) และอ่านข้อมูลตารางคำนวณ BoQ จากแท็บที่ 1
            let noteDefaultTs = roundLen(canalDefaultParams.ts);
            let noteDefaultDt = roundLen(canalDefaultParams.dt);
            for (let i = 0; i < rawRows.length; i++) {
                const rowText = (rawRows[i] || []).slice(0, 4).map(x => String(x ?? '').trim()).join(' ');
                const tsMatch = rowText.match(/ts\s*=\s*([0-9.]+)/i);
                if (tsMatch && !isNaN(parseFloat(tsMatch[1]))) noteDefaultTs = parseFloat(tsMatch[1]);
                const dtMatch = rowText.match(/dt\s*=\s*([0-9.]+)/i);
                if (dtMatch && !isNaN(parseFloat(dtMatch[1]))) noteDefaultDt = parseFloat(dtMatch[1]);
            }

            const parsedData = [];
            for (let i = 0; i < rawRows.length; i++) {
                const r = rawRows[i];
                if (!r || r.length < 4) continue;
                const firstCellStr = String(r[0] ?? '').trim();
                if (
                    firstCellStr === 'คลองส่งน้ำ' ||
                    firstCellStr.startsWith('หมายเหตุ') ||
                    firstCellStr.startsWith('กรณี TYPE') ||
                    firstCellStr.startsWith('ระดับ NGL') ||
                    firstCellStr.startsWith('ความหนาคอนกรีตหยาบ') ||
                    firstCellStr.startsWith('ความลึกขุดลอกหน้าดิน') ||
                    firstCellStr.startsWith('รวมปริมาณงาน')
                ) {
                    continue;
                }
                const cellD = String(r[3] ?? '').trim();
                const cellE = String(r[4] ?? '').trim();
                const cellF = String(r[5] ?? '').trim();
                const cellH = String(r[7] ?? '').trim();
                if (!cellD && !cellE && !cellF && !cellH) continue;
                const nglStartVal = parseFloat(cellE);
                const blStartVal = parseFloat(cellF);
                const hasValidSta = (cellD !== '' && !isNaN(parseFloat(cellD.replace('+', '')))) || (cellH !== '' && !isNaN(parseFloat(cellH.replace('+', ''))));
                if (isNaN(nglStartVal) && isNaN(blStartVal) && !hasValidSta) continue;

                const rowTypeStr = String(r[2] ?? '').trim() || 'VU1';
                const matchedTypeSpec = findUShapeTypeSpec(rowTypeStr);
                const B_val = parseFloat(r[11]);
                const H_val = parseFloat(r[12]);
                const TBL_val = parseFloat(r[13]);
                const TBR_val = parseFloat(r[14]);
                const tw_val = parseFloat(r[15]);
                const tb_val = parseFloat(r[16]);
                const ts_val = !isNaN(parseFloat(r[17])) ? parseFloat(r[17]) : noteDefaultTs;
                const dt_val = !isNaN(parseFloat(r[18])) ? parseFloat(r[18]) : noteDefaultDt;

                const cleanB = roundLen(!isNaN(B_val) && B_val > 0 ? B_val : (matchedTypeSpec ? matchedTypeSpec.B : 0.35));
                const cleanH = roundLen(!isNaN(H_val) && H_val > 0 ? H_val : (matchedTypeSpec ? matchedTypeSpec.H : 0.50));
                const cleanBlStart = roundElev(!isNaN(blStartVal) ? blStartVal : 100.00);
                const cleanBlEnd = roundElev(!isNaN(parseFloat(r[9])) ? parseFloat(r[9]) : cleanBlStart);

                const rawTblStart = parseFloat(r[6]);
                const rawTblEnd = parseFloat(r[10]);
                const hasRawTblStart = String(r[6] ?? '').trim() !== '' && !isNaN(rawTblStart);
                const hasRawTblEnd = String(r[10] ?? '').trim() !== '' && !isNaN(rawTblEnd);

                const cellI = String(r[8] ?? '').trim();
                const nglEndVal = parseFloat(cellI);
                const hasNglStart = cellE !== '' && cellE !== '-' && !isNaN(nglStartVal);
                const hasNglEnd = cellI !== '' && cellI !== '-' && !isNaN(nglEndVal);

                const rowCanalName = String(r[0] ?? '').trim() || 'คลองส่งน้ำ';
                const rowSubCanalName = String(r[1] ?? '').trim() || 'คูส่งน้ำ';
                const prevParsedRow = parsedData.length > 0 ? parsedData[parsedData.length - 1] : null;
                const isSameLineAsPrev = prevParsedRow &&
                    makeCanalLineKey(prevParsedRow.canalName, prevParsedRow.subCanalName) === makeCanalLineKey(rowCanalName, rowSubCanalName);
                const autoSectionNo = isSameLineAsPrev
                    ? String((parseInt(prevParsedRow.sectionNo, 10) || 1) + 1)
                    : '1';

                const rawRemark = String(r[19] ?? '').trim() || 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง';

                parsedData.push({
                    canalName: rowCanalName,
                    subCanalName: rowSubCanalName,
                    type: rowTypeStr,
                    staStart: parseStationToMeters(r[3]),
                    nglStart: hasNglStart ? roundElev(nglStartVal) : '-',
                    blStart: cleanBlStart,
                    tblStart: hasRawTblStart ? roundElev(rawTblStart) : roundElev(cleanBlStart + cleanH),
                    staEnd: parseStationToMeters(r[7]),
                    nglEnd: hasNglEnd ? roundElev(nglEndVal) : '-',
                    blEnd: cleanBlEnd,
                    tblEnd: hasRawTblEnd ? roundElev(rawTblEnd) : roundElev(cleanBlEnd + cleanH),
                    B: cleanB,
                    H: cleanH,
                    TBL: roundLen(!isNaN(TBL_val) && TBL_val >= 0 ? TBL_val : 0.50),
                    TBR: roundLen(!isNaN(TBR_val) && TBR_val >= 0 ? TBR_val : 0.50),
                    tw: roundLen(!isNaN(tw_val) && tw_val > 0 ? tw_val : canalDefaultParams.tw),
                    tb: roundLen(!isNaN(tb_val) && tb_val > 0 ? tb_val : canalDefaultParams.tb),
                    ts: roundLen(!isNaN(ts_val) && ts_val >= 0 ? ts_val : canalDefaultParams.ts),
                    dt: roundLen(!isNaN(dt_val) && dt_val >= 0 ? dt_val : canalDefaultParams.dt),
                    staStartTags: [],
                    staEndTags: [],
                    remark: rawRemark,
                    sectionNo: autoSectionNo
                });
            }

            if (!parsedData.length) {
                showBanner('ไม่พบแถวข้อมูลตัวเลขที่สามารถคำนวณได้ กรุณาตรวจสอบคอลัมน์ A-S ตามรูปแบบมาตรฐาน', 'amber');
                return;
            }

            ensureAllRowsHaveParsedTags(parsedData);
            hiddenStationCategories.clear();

            const cleanedUpload = deduplicateAndNormalizeBoqRows(parsedData, false, 0);
            boqRows = cleanedUpload.rows.length ? cleanedUpload.rows : parsedData;
            masterBoqRows = cloneBoqRows(boqRows);
            selectedRowIndex = 0;
            renderBoqTable();
            resetCompareStartView();
            resetCompareEndView();
            if (typeof markWorkspaceDirty === 'function') markWorkspaceDirty();

            const activeCounts = getSplitStationCountsInMaster();
            const activeSummary = [];
            if (activeCounts.step > 0) activeSummary.push(`แบ่งทุก ${activeCounts.stepLabel} ม. (${activeCounts.step} จุด)`);
            if (activeCounts.ngl > 0) activeSummary.push(`จุดหักดินเดิม (${activeCounts.ngl} จุด)`);
            if (activeCounts.zero_all > 0) activeSummary.push(`จุดค่างานเป็น 0 (${activeCounts.zero_all} จุด)`);

            const splitInfoMsg = activeSummary.length > 0
                ? ` • ตรวจพบการแบ่ง กม. [${activeSummary.join(', ')}] ปรับสถานะปุ่มเป็น "ลบ กม. ที่แบ่ง" อัตโนมัติ`
                : '';
            const nglTabMsg = importedNglCount > 0
                ? ` • นำเข้าแท็บ "ข้อมูลดินเดิม_NGL" จำนวน ${importedNglCount} จุด`
                : '';

            showBanner(`อัปโหลดไฟล์ "${file.name}" สำเร็จ (${boqRows.length} ช่วง กม.)${nglTabMsg}${splitInfoMsg}`, 'emerald');
            showToast(`📂 โหลดไฟล์สำเร็จ (${boqRows.length} แถว${importedNglCount > 0 ? ` + ดินเดิม ${importedNglCount} จุด` : ''})`, 'emerald');
            checkAndOpenImportMismatchModal(`ตารางที่นำเข้าจากไฟล์ "${file.name}"`);
        } catch (err) {
            showBanner('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message, 'amber');
        }
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('btnDownloadExcel')?.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
        showBanner('ไม่สามารถโหลดไลบรารี Excel ได้ในขณะนี้', 'amber');
        return;
    }

    const rowHeaderGroup = [
        'คลองส่งน้ำ', 'คูส่งน้ำ', 'TYPE',
        'กม.เริ่มต้น', 'ระดับ NGL. เริ่มต้น', 'ระดับ BL. เริ่มต้น', 'ระดับ TBL. เริ่มต้น',
        'กม.สิ้นสุด', 'ระดับ NGL. สิ้นสุด', 'ระดับ BL. สิ้นสุด', 'ระดับ TBL. สิ้นสุด',
        'B', 'H', 'TBL', 'TBR', 'tw', 'tb', 'ts', 'dt', 'หมายเหตุ', 'ช่วงคูส่งน้ำ'
    ];
    const rowHeaderSub = [
        'คลองส่งน้ำ', 'คูส่งน้ำ', 'TYPE',
        'กม.เริ่มต้น', 'ระดับ NGL. เริ่มต้น', 'ระดับ BL. เริ่มต้น', 'ระดับ TBL. เริ่มต้น',
        'กม.สิ้นสุด', 'ระดับ NGL. สิ้นสุด', 'ระดับ BL. สิ้นสุด', 'ระดับ TBL. สิ้นสุด',
        'B', 'H', 'TBL', 'TBR', 'tw', 'tb', 'ts', 'dt', 'หมายเหตุ', 'ช่วงคูส่งน้ำ'
    ];

    // เพิ่มพิกัดจุด 14 จุด กม.เริ่มต้น และ กม.สิ้นสุด แยกกันในไฟล์ Excel
    rowHeaderGroup.push('พิกัดจุด 14 จุด กม.เริ่มต้น (X, Y)', ...new Array(13).fill(''));
    ALL_14_NODE_NUMS.forEach(n => rowHeaderSub.push(`จุดที่ ${n} (กม.เริ่มต้น)`));

    rowHeaderGroup.push('พิกัดจุด 14 จุด กม.สิ้นสุด (X, Y)', ...new Array(13).fill(''));
    ALL_14_NODE_NUMS.forEach(n => rowHeaderSub.push(`จุดที่ ${n} (กม.สิ้นสุด)`));

    WORK_CATEGORIES.forEach(cat => {
        rowHeaderGroup.push(cat.label, '', '', '');
        rowHeaderSub.push(
            `A1 (${cat.shortLabel})`,
            `A2 (${cat.shortLabel})`,
            `L (${cat.shortLabel})`,
            `ปริมาณ (${cat.shortLabel})`
        );
    });

    const sheetRows = [rowHeaderGroup, rowHeaderSub];
    const totalsByCat = {};
    WORK_CATEGORIES.forEach(c => { totalsByCat[c.key] = 0; });

    boqRows.forEach((r, idx) => {
        const ev = evaluateBoqRow(r);
        const dataRow = [
            r.canalName,
            r.subCanalName,
            r.type,
            ev.staStartFormatted,
            isMissingNglValue(r.nglStart) ? '-' : roundElev(r.nglStart),
            roundElev(r.blStart),
            roundElev(r.tblStart),
            ev.staEndFormatted,
            isMissingNglValue(r.nglEnd) ? '-' : roundElev(r.nglEnd),
            roundElev(r.blEnd),
            roundElev(r.tblEnd),
            roundLen(r.B),
            roundLen(r.H),
            roundLen(r.TBL),
            roundLen(r.TBR),
            roundLen(r.tw),
            roundLen(r.tb),
            roundLen(r.ts),
            roundLen(r.dt),
            r.remark || 'จุดเริ่มต้นช่วง → จุดสิ้นสุดช่วง',
            (r.sectionNo !== undefined && String(r.sectionNo).trim() !== '') ? String(r.sectionNo).trim() : String(idx + 1)
        ];

        ALL_14_NODE_NUMS.forEach(n => {
            dataRow.push(formatNodeCoordCellText(ev.secStart, n, 'all'));
        });
        ALL_14_NODE_NUMS.forEach(n => {
            dataRow.push(formatNodeCoordCellText(ev.secEnd, n, 'all'));
        });

        WORK_CATEGORIES.forEach(cat => {
            const c = ev.calcByCat[cat.key];
            totalsByCat[cat.key] = roundVol(totalsByCat[cat.key] + c.vol);
            dataRow.push(
                roundArea(c.a1),
                roundArea(c.a2),
                roundLen(c.L),
                roundVol(c.vol)
            );
        });

        sheetRows.push(dataRow);
    });

    const totalRow = new Array(21 + 28).fill('');
    totalRow[0] = 'รวมปริมาณงานทั้งสิ้น';
    WORK_CATEGORIES.forEach(cat => {
        totalRow.push('', '', 'รวม (m³):', roundVol(totalsByCat[cat.key]));
    });
    sheetRows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    const merges = [];
    for (let c = 0; c < 21; c++) {
        merges.push({ s: { r: 0, c }, e: { r: 1, c } });
    }
    merges.push({ s: { r: 0, c: 21 }, e: { r: 0, c: 34 } });
    merges.push({ s: { r: 0, c: 35 }, e: { r: 0, c: 48 } });
    WORK_CATEGORIES.forEach((_, idx) => {
        const startCol = 49 + idx * 4;
        merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 3 } });
    });
    ws['!merges'] = merges;

    // สร้างแท็บที่ 2: ข้อมูลดินเดิม_NGL
    const nglSheetAoA = buildOriginalGroundSheetAoA();
    const wsNgl = XLSX.utils.aoa_to_sheet(nglSheetAoA);
    wsNgl['!cols'] = [
        { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 24 },
        { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'คำนวณปริมาณงานคูส่งน้ำ');
    XLSX.utils.book_append_sheet(wb, wsNgl, 'ข้อมูลดินเดิม_NGL');
    XLSX.writeFile(wb, 'ผลการคำนวณปริมาณงานคูส่งน้ำคอนกรีต.xlsx');
    showBanner(`ดาวน์โหลดไฟล์ "ผลการคำนวณปริมาณงานคูส่งน้ำคอนกรีต.xlsx" เรียบร้อยแล้ว (ประกอบด้วย 2 แท็บ: 1. คำนวณปริมาณงานคูส่งน้ำ และ 2. ข้อมูลดินเดิม_NGL จำนวน ${nglSheetAoA.length - 1} จุด)`, 'cyan');
    showToast(`📥 ส่งออกไฟล์ .xlsx (พร้อมแท็บ ข้อมูลดินเดิม_NGL) สำเร็จ`, 'cyan');
});

document.getElementById('btnDownloadTemplate')?.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') return;
    // ลบคอลัมน์ หมายเหตุ และ ช่วงคูส่งน้ำ ออกจากไฟล์ตัวอย่าง (ให้ระบบกรอกให้เองเมื่อนำเข้า)
    const templateColumns = INPUT_COLUMNS.filter(c => c.key !== 'remark' && c.key !== 'sectionNo');
    const headers = templateColumns.map(c => c.label);
    const sampleRows = getInitialSampleRows().map((r) => [
        r.canalName, r.subCanalName, r.type,
        formatMetersToStation(r.staStart), roundElev(r.nglStart), roundElev(r.blStart), roundElev(r.tblStart),
        formatMetersToStation(r.staEnd), roundElev(r.nglEnd), roundElev(r.blEnd), roundElev(r.tblEnd),
        roundLen(r.B), roundLen(r.H), roundLen(r.TBL), roundLen(r.TBR), roundLen(r.tw), roundLen(r.tb), roundLen(r.ts), roundLen(r.dt)
    ]);
    // เพิ่มหมายเหตุในไฟล์ Excel ตัวอย่าง โดยให้ข้อ "กรณี TYPE เป็น VU1-VU6..." อยู่ข้อแรก
    const templateNoteRows = [
        [],
        ['หมายเหตุ'],
        ['กรณี TYPE เป็น VU1-VU6 ไม่ต้องกรอก ค่า  B ,H ,tw tb ,ts และ dt ก็ได้'],
        ['ระดับ NGL. และ ระดับ TBL.ไม่ต้องกรอกค่าก็ได้'],
        ['ความหนาคอนกรีตหยาบ,ts = 0.05'],
        ['ความลึกขุดลอกหน้าดิน,dt=0.30']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows, ...templateNoteRows]);

    const nglSheetAoA = buildOriginalGroundSheetAoA();
    const wsNgl = XLSX.utils.aoa_to_sheet(nglSheetAoA);
    wsNgl['!cols'] = [
        { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 24 },
        { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Input_A_S');
    XLSX.utils.book_append_sheet(wb, wsNgl, 'ข้อมูลดินเดิม_NGL');
    XLSX.writeFile(wb, 'Template_ข้อมูลคูส่งน้ำ_A_ถึง_S.xlsx');
    showBanner('ดาวน์โหลดไฟล์ตัวอย่าง "Template_ข้อมูลคูส่งน้ำ_A_ถึง_S.xlsx" (คอลัมน์ หมายเหตุ และ ช่วงคูส่งน้ำ ระบบจะกรอกให้อัตโนมัติ) เรียบร้อยแล้ว', 'cyan');
    showToast('📥 ดาวน์โหลดไฟล์ตัวอย่าง Excel เรียบร้อยแล้ว', 'cyan');
});

// ปุ่ม นำเข้า Excel / Save / Load ในบล็อกที่ 3 ของแถบเครื่องมือส่วนที่ 3 (ตามรูป 1)
document.getElementById('btnBoqImportExcel')?.addEventListener('click', () => {
    uploadExcelInput.value = '';
    uploadExcelInput.click();
});

document.getElementById('btnBoqSaveFile')?.addEventListener('click', () => {
    const payload = buildWorkspaceSavePayload();
    payload.type = 'RID_CANAL_BOQ_PROJECT_DATA';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const firstRow = boqRows[0] || {};
    const safeCanal = String(firstRow.canalName && firstRow.canalName !== '-' ? firstRow.canalName : 'Canal_BoQ').replace(/[^a-zA-Z0-9_฀-๿.-]/g, '_');
    a.download = `${safeCanal}_BoQ_Data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBanner(`💾 บันทึกไฟล์ข้อมูลตาราง BoQ และโปรเจกต์ (${boqRows.length} ช่วง กม.) เป็นไฟล์ .json เรียบร้อยแล้ว`, 'emerald');
    showToast(`💾 บันทึกข้อมูลตาราง BoQ (${boqRows.length} ช่วง กม.) สำเร็จ`, 'emerald');
});

const boqLoadJsonInput = document.getElementById('boqLoadJsonInput');
document.getElementById('btnBoqLoadFile')?.addEventListener('click', () => {
    if (!boqLoadJsonInput) return;
    boqLoadJsonInput.value = '';
    boqLoadJsonInput.click();
});

boqLoadJsonInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const obj = JSON.parse(ev.target.result);
            if (obj && Array.isArray(obj.boqRows) && obj.boqRows.length > 0) {
                pushUndoSnapshot(`โหลดไฟล์ข้อมูล ${file.name}`);
                applyRestoredWorkspace(obj);
                showBanner(`📂 โหลดไฟล์ข้อมูลตาราง BoQ "${file.name}" (${boqRows.length} ช่วง กม.) สำเร็จ`, 'emerald');
                showToast(`📂 โหลดข้อมูลตาราง BoQ (${boqRows.length} ช่วง กม.) สำเร็จ`, 'emerald');
                checkAndOpenImportMismatchModal(`ตารางที่โหลดจากไฟล์ "${file.name}"`);
            } else if (obj && Array.isArray(obj.points) && obj.points.length >= 2) {
                pushUndoSnapshot(`โหลดจุด NGL จาก ${file.name}`);
                digPoints = obj.points.map(pt => ({
                    pixel: pt.pixel ? { x: Number(pt.pixel.x), y: Number(pt.pixel.y) } : { x: 0, y: 0 },
                    data: { x: parseStationToMeters(pt.data?.x ?? pt.x ?? 0), y: Number(pt.data?.y ?? pt.y ?? 0) }
                }));
                digPoints.sort((a, b) => Number(a.data.x) - Number(b.data.x));
                saveCurrentDigPageState();
                updateDigTable();
                redrawDigitizer();
                document.getElementById('btnTransferReplaceBoq')?.click();
            } else {
                showToast('ไม่พบข้อมูลตาราง BoQ ในไฟล์ที่เลือก', 'amber');
            }
        } catch (err) {
            showToast('ไม่สามารถอ่านไฟล์ JSON ได้: ' + err.message, 'rose');
        }
    };
    reader.readAsText(file);
});



var _earthworkInitialized = false;
function initEarthworkSection3() {
  if (_earthworkInitialized) return;
  _earthworkInitialized = true;
  try {
    syncCmpToggleButtonsUI();
    renderColumnVisibilityCheckboxes();
    syncEarthworkFromTakeoff(false);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => {
        const qtyPage = document.getElementById('quantityCalcPage');
        if (qtyPage && qtyPage.style && qtyPage.style.display !== 'none') {
          resizeComparisonCanvases(false);
          drawLongitudinalProfile();
        }
      });
    }
  } catch (err) {
    console.warn('initEarthworkSection3 warning:', err);
  }
}
