// ===== js/tab-qty-structure.js =====
// ส่วนคำนวณปริมาณ — แท็บงานอาคารประกอบ (แยกเป็น 1 ไฟล์ต่อ 1 แท็บย่อย ตามข้อตกลงรอบ 60)
// ============================================================================
// รอบ 69 (Version 1.0013):
//   - เพิ่มแท็บ "งานอาคารประกอบ" ต่อจากแท็บ "งานดิน" ในหน้า "ส่วนคำนวณปริมาณ" (#quantityCalcPage)
//   - ดึงข้อมูลจาก "ส่วนถอดแบบ" (แท็บอาคารประกอบ + แท็บอาคารท่อรับน้ำเข้าแปลงไร่นา + มิติ/ระดับคูส่งน้ำ + Typeคูส่งน้ำ/Typeอาคารประกอบ)
//   - สรุปและจัดกลุ่มเป็นแต่ละอาคาร โดยนำ คูส่งน้ำ + Type คูส่งน้ำ + ขนาด (H, ศก.ท่อ, ความยาว) ที่เหมือนกันมาอยู่ด้วยกัน
//   - มีทั้งตารางส่วนที่ 1 (สรุปแยกตามแต่ละอาคาร • คูส่งน้ำ + Type + ขนาดที่เหมือนกันอยู่ด้วยกัน)
//     และตารางส่วนที่ 2 (สรุปรวมทุกคูส่งน้ำที่มี อาคาร + Type + ขนาด เหมือนกัน เพื่อรวมยอด BoQ ทั้งโครงการ)
// ============================================================================

var qtyStructureRawItems = [];
var qtyStructureGroupedByDitch = [];
var qtyStructureGroupedAcrossDitches = [];
var collapsedQtyStructureGroups = new Set();

var selectedQtyStructCanalFilter = 'ALL';
var selectedQtyStructBuildingFilter = 'ALL';
var selectedQtyStructDitchTypeFilter = 'ALL';
var selectedQtyStructSourceFilter = 'ALL'; // 'ALL' | 'structure' | 'attachment'
var qtyStructureHasSyncedInitial = false;
var lastQtyStructureTakeoffSignature = '';

function makeQtyStructureCanalLineKey(canalName, ditchName) {
  return `${String(canalName || '').trim()}||${String(ditchName || '').trim()}`;
}

function formatQtyStructureKm(kmVal) {
  if (kmVal === '' || kmVal === null || kmVal === undefined) return '-';
  const num = parseFloat(kmVal);
  if (isNaN(num)) return String(kmVal);
  if (typeof kmHasDecimal === 'function' && typeof formatKmDisplayDecimal === 'function' && kmHasDecimal(num)) {
    return formatKmDisplayDecimal(num);
  }
  if (typeof formatKmDisplay === 'function') {
    return formatKmDisplay(num);
  }
  const sign = num < 0 ? '-' : '';
  const absVal = Math.abs(Math.round(num));
  const kmPart = Math.floor(absVal / 1000);
  const mPart = String(absVal % 1000).padStart(3, '0');
  return `${sign}${kmPart}+${mPart}`;
}

function getDitchTypeDimensionSummary(typeCode, channelId) {
  const cleanType = String(typeCode || '').trim();
  if (!cleanType || cleanType === '-') return '-';

  if (typeof ditchTypeDatabase !== 'undefined' && Array.isArray(ditchTypeDatabase)) {
    const found = ditchTypeDatabase.find(t => t && String(t.type || '').trim().toUpperCase() === cleanType.toUpperCase());
    if (found) {
      const b = (found.b !== undefined && found.b !== '') ? Number(found.b).toFixed(2) : '-';
      const h = (found.h !== undefined && found.h !== '') ? Number(found.h).toFixed(2) : '-';
      return `B=${b}×H=${h} ม.`;
    }
  }
  if (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows) && channelId !== undefined) {
    const dim = dimensionRows.find(d => d && d.channelId === channelId);
    if (dim) {
      const b = (dim.b !== undefined && dim.b !== '') ? Number(dim.b).toFixed(2) : '-';
      const h = (dim.d !== undefined && dim.d !== '') ? Number(dim.d).toFixed(2) : '-';
      return `B=${b}×H=${h} ม.`;
    }
  }
  return '-';
}

function normalizeStructureParamDisplay(val) {
  if (val === undefined || val === null) return '-';
  const s = String(val).trim();
  if (!s || s === '-') return '-';
  const n = parseFloat(s);
  if (!isNaN(n)) {
    if (Math.abs(n) < 1e-9) return '-';
    return n.toFixed(2);
  }
  return s;
}

function buildStructureSizeSignature(hVal, pipeDia, lengthVal) {
  const h = normalizeStructureParamDisplay(hVal);
  const d = normalizeStructureParamDisplay(pipeDia);
  const l = normalizeStructureParamDisplay(lengthVal);
  const parts = [];
  if (h !== '-') parts.push(`H=${h} ม.`);
  if (d !== '-' && l !== '-') {
    parts.push(`ศก. ${d}×${l} ม.`);
  } else if (d !== '-') {
    parts.push(`ศก. ${d} ม.`);
  } else if (l !== '-') {
    parts.push(`L=${l} ม.`);
  }
  return {
    h,
    pipeDia: d,
    length: l,
    sizeKey: `${h}|${d}|${l}`,
    sizeLabel: parts.length > 0 ? parts.join(' • ') : 'ขนาดมาตรฐานตาม Type คูส่งน้ำ'
  };
}

function computeTakeoffSignatureForQtyStructure() {
  try {
    const chPart = (typeof channels !== 'undefined' && Array.isArray(channels))
      ? channels.map(c => `${c.id}:${c.canal}:${c.ditch}`).join(';')
      : '';
    const dimPart = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.map(d => `${d.channelId}:${d.type}:${d.b}:${d.d}:${d.kmStart}:${d.kmEnd}`).join(';')
      : '';
    const lvlPart = (typeof levelRowsData !== 'undefined' && Array.isArray(levelRowsData))
      ? levelRowsData.map(l => `${l.channelId}:${l.customType}:${l.customKmStart}:${l.customKmEnd}:${l.h}`).join(';')
      : '';
    const stPart = (typeof structureRowsData !== 'undefined' && Array.isArray(structureRowsData))
      ? structureRowsData.map(s => `${s.channelId}:${s.km}:${s.name}:${s.hOverride}:${s.pipeDia}:${s.pipeCount}:${s.remark}`).join(';')
      : '';
    const attPart = (typeof attachmentRowsData !== 'undefined' && Array.isArray(attachmentRowsData))
      ? attachmentRowsData.map(a => `${a.channelId}:${a.km}:${a.name}:${a.h}:${a.pipeDia}:${a.length}:${a.count}:${a.remark}`).join(';')
      : '';
    return `${chPart}#${dimPart}#${lvlPart}#${stPart}#${attPart}`;
  } catch (e) {
    return '';
  }
}

function collectQtyStructureItemsFromTakeoff() {
  const hasExistingStruct = (typeof structureRowsData !== 'undefined' && Array.isArray(structureRowsData) && structureRowsData.length > 0);
  if (!hasExistingStruct && typeof syncDimensionRowsWithChannels === 'function' && typeof channels !== 'undefined' && Array.isArray(channels) && channels.length > 0) {
    syncDimensionRowsWithChannels();
  }

  const items = [];
  const structRows = (typeof structureRowsData !== 'undefined' && Array.isArray(structureRowsData)) ? structureRowsData : [];
  const attachRows = (typeof attachmentRowsData !== 'undefined' && Array.isArray(attachmentRowsData)) ? attachmentRowsData : [];

  // 1. ดึงจากแท็บ "อาคารประกอบ" (structureRowsData)
  structRows.forEach((srow, sIdx) => {
    if (!srow) return;
    const rawName = String(srow.name || '').trim();
    if (!rawName || rawName === '-ไม่มี-') return;

    const cIdx = srow.channelId;
    const chObj = (typeof getChannelById === 'function' ? getChannelById(cIdx) : null) || { canal: 'คลอง', ditch: '-' };
    const canalName = String(chObj.canal || 'คลอง').trim() || 'คลอง';
    const ditchName = String(chObj.ditch || '-').trim() || '-';

    const sEntry = (typeof getStructureTypeEntry === 'function') ? getStructureTypeEntry(rawName) : null;
    const tableH = (sEntry && sEntry.h !== undefined) ? String(sEntry.h) : '';
    const tableDia = (sEntry && sEntry.pipeDia !== undefined) ? String(sEntry.pipeDia) : '';
    const tableLen = (sEntry && sEntry.length !== undefined) ? String(sEntry.length) : '';
    const hIsDash = (tableH.trim() === '-');
    const diaIsDash = (tableDia.trim() === '-');
    const lenIsDash = (tableLen.trim() === '-');

    const hLvlVal = (srow.isFromLevel && typeof getStructureLevelH === 'function') ? getStructureLevelH(srow) : '';
    const hUserVal = (srow.hOverride === undefined || srow.hOverride === null) ? '' : String(srow.hOverride).trim();
    let hResolved = '-';
    if (hUserVal !== '') {
      hResolved = hUserVal;
    } else if (srow.isFromLevel && hLvlVal !== '') {
      hResolved = hLvlVal;
    } else {
      hResolved = hIsDash ? '-' : (tableH !== '' ? tableH : '-');
    }
    const hShown = (typeof formatStructureCellValue === 'function')
      ? formatStructureCellValue(hResolved)
      : normalizeStructureParamDisplay(hResolved);

    const diaEditable = !!(sEntry && sEntry.diaEditable) && !diaIsDash;
    const diaRaw = diaEditable
      ? (typeof structureNameValue === 'function' ? structureNameValue(srow.pipeDia, tableDia, true) : (srow.pipeDia || tableDia))
      : (diaIsDash ? '-' : (tableDia || '-'));
    const diaShown = (typeof formatStructureCellValue === 'function')
      ? formatStructureCellValue(diaRaw)
      : normalizeStructureParamDisplay(diaRaw);

    const lenEditable = !!(sEntry && sEntry.lenEditable) && !lenIsDash;
    const lenRaw = lenEditable
      ? (typeof structureNameValue === 'function' ? structureNameValue(srow.pipeCount, tableLen, true) : (srow.pipeCount || tableLen))
      : (lenIsDash ? '-' : (tableLen || '-'));
    const lenShown = (typeof formatStructureCellValue === 'function')
      ? formatStructureCellValue(lenRaw)
      : normalizeStructureParamDisplay(lenRaw);

    const remarkEditable = !!(sEntry && sEntry.remarkEditable);
    const remarkTableVal = (sEntry && sEntry.remark) ? String(sEntry.remark) : '';
    const remarkShown = remarkEditable
      ? ((typeof structureNameValue === 'function') ? structureNameValue(srow.remark, remarkTableVal, true) : (srow.remark || remarkTableVal || '-'))
      : (remarkTableVal !== '' ? remarkTableVal : (srow.remark || '-'));

    const fullItemName = (typeof computeStructureItemName === 'function')
      ? computeStructureItemName(srow, cIdx)
      : rawName;

    const ditchTypeNow = (typeof getStructureLevelTypeAtKm === 'function')
      ? getStructureLevelTypeAtKm(cIdx, srow.km, 'TypeNow', srow)
      : 'VU1';
    const upDown = (typeof computeStructureUpDownTypes === 'function')
      ? computeStructureUpDownTypes(srow)
      : { up: ditchTypeNow, down: ditchTypeNow };

    const effectiveTypeLabel = (upDown.up !== '-' && upDown.down !== '-' && upDown.up !== upDown.down)
      ? `${upDown.up} → ${upDown.down}`
      : (upDown.now || (upDown.up !== '-' ? upDown.up : (upDown.down !== '-' ? upDown.down : ditchTypeNow)));

    const sizeObj = buildStructureSizeSignature(hShown, diaShown, lenShown);
    const kmNum = (srow.km !== '' && srow.km !== undefined && srow.km !== null) ? parseFloat(srow.km) : 0;

    items.push({
      id: `struct_${sIdx}`,
      sourceType: 'structure',
      sourceLabel: 'อาคารประกอบ',
      channelId: cIdx,
      canalName,
      ditchName,
      kmNum: isNaN(kmNum) ? 0 : kmNum,
      kmFormatted: formatQtyStructureKm(srow.km),
      structureType: rawName,
      fullItemName: fullItemName || rawName,
      ditchType: ditchTypeNow || 'VU1',
      upType: upDown.up || '-',
      downType: upDown.down || '-',
      effectiveTypeLabel: effectiveTypeLabel || ditchTypeNow || 'VU1',
      ditchDimText: getDitchTypeDimensionSummary(ditchTypeNow, cIdx),
      h: sizeObj.h,
      pipeDia: sizeObj.pipeDia,
      length: sizeObj.length,
      sizeKey: sizeObj.sizeKey,
      sizeLabel: sizeObj.sizeLabel,
      count: 1,
      remark: (remarkShown && remarkShown !== '-') ? String(remarkShown).trim() : '-'
    });
  });

  // 2. ดึงจากแท็บ "อาคารท่อรับน้ำเข้าแปลงไร่นา" (attachmentRowsData)
  attachRows.forEach((arow, aIdx) => {
    if (!arow) return;
    const rawName = String(arow.name || (typeof ATTACHMENT_BASE_NAME !== 'undefined' ? ATTACHMENT_BASE_NAME : 'อาคารท่อรับน้ำเข้าแปลงไร่นา')).trim();
    if (!rawName || rawName === '-ไม่มี-') return;

    const cIdx = arow.channelId;
    const chObj = (typeof getChannelById === 'function' ? getChannelById(cIdx) : null) || { canal: 'คลอง', ditch: '-' };
    const canalName = String(chObj.canal || 'คลอง').trim() || 'คลอง';
    const ditchName = String(chObj.ditch || '-').trim() || '-';

    const dimItem = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.find(d => d && d.channelId === cIdx)
      : null;
    const ditchType = (dimItem && dimItem.type) ? String(dimItem.type).trim() : 'VU1';

    const rule = (typeof getAttachmentRule === 'function') ? getAttachmentRule(rawName) : { h: false, dia: false, len: true };
    const hVal = rule.h ? (arow.h !== '' && arow.h !== undefined ? arow.h : '0.00') : '-';
    const diaVal = (typeof getAttachmentPipeDia === 'function') ? getAttachmentPipeDia(arow) : (arow.pipeDia || '0.20');
    const lenVal = rule.len ? (arow.length !== '' && arow.length !== undefined ? arow.length : '1.00') : '-';
    const countNum = Math.max(1, parseInt(arow.count, 10) || 1);

    const sizeObj = buildStructureSizeSignature(hVal, diaVal, lenVal);
    const fullItemName = (typeof computeStructureTypeName === 'function')
      ? computeStructureTypeName({
          type: rawName,
          h: sizeObj.h === '-' ? '' : sizeObj.h,
          pipeDia: sizeObj.pipeDia === '-' ? '' : sizeObj.pipeDia,
          length: sizeObj.length === '-' ? '' : sizeObj.length,
          remark: ''
        })
      : `${rawName} (${sizeObj.sizeLabel})`;

    const kmNum = (arow.km !== '' && arow.km !== undefined && arow.km !== null) ? parseFloat(arow.km) : 0;

    items.push({
      id: `attach_${aIdx}`,
      sourceType: 'attachment',
      sourceLabel: 'ท่อรับน้ำเข้าแปลงไร่นา',
      channelId: cIdx,
      canalName,
      ditchName,
      kmNum: isNaN(kmNum) ? 0 : kmNum,
      kmFormatted: arow.km !== '' && arow.km !== undefined ? formatQtyStructureKm(arow.km) : 'ตลอดสาย',
      structureType: rawName,
      fullItemName: fullItemName || rawName,
      ditchType,
      upType: ditchType,
      downType: ditchType,
      effectiveTypeLabel: ditchType,
      ditchDimText: getDitchTypeDimensionSummary(ditchType, cIdx),
      h: sizeObj.h,
      pipeDia: sizeObj.pipeDia,
      length: sizeObj.length,
      sizeKey: sizeObj.sizeKey,
      sizeLabel: sizeObj.sizeLabel,
      count: countNum,
      remark: (arow.remark && String(arow.remark).trim() !== '') ? String(arow.remark).trim() : '-'
    });
  });

  return items;
}

function buildQtyStructureGroupedSummaries(items) {
  const filtered = (Array.isArray(items) ? items : []).filter(it => {
    if (selectedQtyStructSourceFilter !== 'ALL' && it.sourceType !== selectedQtyStructSourceFilter) return false;
    if (selectedQtyStructCanalFilter !== 'ALL' && makeQtyStructureCanalLineKey(it.canalName, it.ditchName) !== selectedQtyStructCanalFilter) return false;
    if (selectedQtyStructBuildingFilter !== 'ALL' && it.structureType !== selectedQtyStructBuildingFilter) return false;
    if (selectedQtyStructDitchTypeFilter !== 'ALL' && it.ditchType !== selectedQtyStructDitchTypeFilter) return false;
    return true;
  });

  // 1) จัดกลุ่มตาม "แต่ละอาคาร" -> ภายในจัดกลุ่มและเรียงตาม "คูส่งน้ำ + Type คูส่งน้ำ + ขนาด" ที่เหมือนกันอยู่ด้วยกัน
  const buildingMap = new Map();
  filtered.forEach(it => {
    const bKey = it.structureType;
    if (!buildingMap.has(bKey)) {
      buildingMap.set(bKey, {
        structureType: bKey,
        sourceType: it.sourceType,
        totalCount: 0,
        ditchSizeMap: new Map()
      });
    }
    const bGroup = buildingMap.get(bKey);
    bGroup.totalCount += it.count;

    // คีย์สำหรับรวมแถวที่ "คูส่งน้ำ + Type คูส่งน้ำ (UP/DOWN) + ขนาด (H, ศก.ท่อ, ความยาว)" เหมือนกันให้อยู่ด้วยกัน
    const subKey = `${it.canalName}||${it.ditchName}||${it.ditchType}||${it.upType}||${it.downType}||${it.sizeKey}`;
    if (!bGroup.ditchSizeMap.has(subKey)) {
      bGroup.ditchSizeMap.set(subKey, {
        subKey,
        structureType: it.structureType,
        fullItemName: it.fullItemName,
        sourceType: it.sourceType,
        sourceLabel: it.sourceLabel,
        canalName: it.canalName,
        ditchName: it.ditchName,
        ditchType: it.ditchType,
        upType: it.upType,
        downType: it.downType,
        effectiveTypeLabel: it.effectiveTypeLabel,
        ditchDimText: it.ditchDimText,
        h: it.h,
        pipeDia: it.pipeDia,
        length: it.length,
        sizeKey: it.sizeKey,
        sizeLabel: it.sizeLabel,
        totalCount: 0,
        kmList: [],
        remarks: new Set(),
        rawRows: []
      });
    }
    const subGrp = bGroup.ditchSizeMap.get(subKey);
    subGrp.totalCount += it.count;
    if (it.kmFormatted && it.kmFormatted !== '-') {
      subGrp.kmList.push(it.kmFormatted);
    }
    if (it.remark && it.remark !== '-') {
      subGrp.remarks.add(it.remark);
    }
    subGrp.rawRows.push(it);
  });

  // เรียงแถวภายในแต่ละอาคารให้ Type คูส่งน้ำ -> ขนาด -> คลอง -> คูส่งน้ำ ที่เหมือนกันอยู่ติดกันเสมอ
  const groupedByBuilding = [];
  buildingMap.forEach(bGroup => {
    const rows = Array.from(bGroup.ditchSizeMap.values()).sort((a, b) => {
      const tCmp = String(a.ditchType || '').localeCompare(String(b.ditchType || ''), 'th', { numeric: true });
      if (tCmp !== 0) return tCmp;
      const udCmp = `${a.upType}/${a.downType}`.localeCompare(`${b.upType}/${b.downType}`, 'th', { numeric: true });
      if (udCmp !== 0) return udCmp;
      const sCmp = String(a.sizeKey || '').localeCompare(String(b.sizeKey || ''), 'th', { numeric: true });
      if (sCmp !== 0) return sCmp;
      const cCmp = String(a.canalName || '').localeCompare(String(b.canalName || ''), 'th', { numeric: true });
      if (cCmp !== 0) return cCmp;
      return String(a.ditchName || '').localeCompare(String(b.ditchName || ''), 'th', { numeric: true });
    });
    groupedByBuilding.push({
      structureType: bGroup.structureType,
      sourceType: bGroup.sourceType,
      totalCount: bGroup.totalCount,
      rows
    });
  });

  // 2) ตารางสรุปรวมทั้งโครงการ: รวมทุกคูส่งน้ำที่มี "แต่ละอาคาร + Type คูส่งน้ำ + ขนาด" เหมือนกันอยู่ด้วยกัน
  const acrossMap = new Map();
  filtered.forEach(it => {
    const aKey = `${it.structureType}||${it.ditchType}||${it.upType}||${it.downType}||${it.sizeKey}`;
    if (!acrossMap.has(aKey)) {
      acrossMap.set(aKey, {
        key: aKey,
        structureType: it.structureType,
        fullItemName: it.fullItemName,
        sourceType: it.sourceType,
        sourceLabel: it.sourceLabel,
        ditchType: it.ditchType,
        upType: it.upType,
        downType: it.downType,
        effectiveTypeLabel: it.effectiveTypeLabel,
        ditchDimText: it.ditchDimText,
        h: it.h,
        pipeDia: it.pipeDia,
        length: it.length,
        sizeKey: it.sizeKey,
        sizeLabel: it.sizeLabel,
        totalCount: 0,
        ditchCountMap: new Map()
      });
    }
    const entry = acrossMap.get(aKey);
    entry.totalCount += it.count;
    const dLabel = `${it.canalName} • คู ${it.ditchName}`;
    entry.ditchCountMap.set(dLabel, (entry.ditchCountMap.get(dLabel) || 0) + it.count);
  });

  const groupedAcross = Array.from(acrossMap.values()).map(entry => {
    const ditchBreakdownList = [];
    entry.ditchCountMap.forEach((cnt, dLabel) => {
      ditchBreakdownList.push(`${dLabel} (${cnt})`);
    });
    return {
      ...entry,
      ditchCount: entry.ditchCountMap.size,
      ditchBreakdownText: ditchBreakdownList.join(', ')
    };
  });

  return {
    filteredItems: filtered,
    groupedByBuilding,
    groupedAcross
  };
}

function updateQtyStructureFilterDropdownsUI(allItems) {
  const list = Array.isArray(allItems) ? allItems : [];

  // 1. ดรอปลิสต์สายคูส่งน้ำ
  const selCanal = document.getElementById('selectQtyStructCanalFilter');
  if (selCanal) {
    const canalMap = new Map();
    list.forEach(it => {
      const k = makeQtyStructureCanalLineKey(it.canalName, it.ditchName);
      if (!canalMap.has(k)) {
        canalMap.set(k, { canalName: it.canalName, ditchName: it.ditchName, count: 0 });
      }
      canalMap.get(k).count += it.count;
    });
    if (selectedQtyStructCanalFilter !== 'ALL' && !canalMap.has(selectedQtyStructCanalFilter)) {
      selectedQtyStructCanalFilter = 'ALL';
    }
    let htmlOpts = `<option value="ALL" ${selectedQtyStructCanalFilter === 'ALL' ? 'selected' : ''}>แสดงทั้งหมดทุกสาย (${canalMap.size} สาย)</option>`;
    let idx = 0;
    canalMap.forEach((info, k) => {
      idx++;
      const safeVal = String(k).replace(/"/g, '&quot;');
      const isSel = selectedQtyStructCanalFilter === k ? 'selected' : '';
      htmlOpts += `<option value="${safeVal}" ${isSel}>${idx}: คลอง ${escapeHtml(info.canalName)} • คู ${escapeHtml(info.ditchName)} (${info.count} แห่ง)</option>`;
    });
    selCanal.innerHTML = htmlOpts;
    selCanal.value = selectedQtyStructCanalFilter;
  }

  // 2. ดรอปลิสต์ประเภทอาคาร
  const selBld = document.getElementById('selectQtyStructBuildingFilter');
  if (selBld) {
    const bldMap = new Map();
    list.forEach(it => {
      bldMap.set(it.structureType, (bldMap.get(it.structureType) || 0) + it.count);
    });
    if (selectedQtyStructBuildingFilter !== 'ALL' && !bldMap.has(selectedQtyStructBuildingFilter)) {
      selectedQtyStructBuildingFilter = 'ALL';
    }
    let htmlOpts = `<option value="ALL" ${selectedQtyStructBuildingFilter === 'ALL' ? 'selected' : ''}>แสดงทุกประเภทอาคาร (${bldMap.size} ประเภท)</option>`;
    bldMap.forEach((cnt, bName) => {
      const safeVal = String(bName).replace(/"/g, '&quot;');
      const isSel = selectedQtyStructBuildingFilter === bName ? 'selected' : '';
      htmlOpts += `<option value="${safeVal}" ${isSel}>${escapeHtml(bName)} (${cnt} แห่ง)</option>`;
    });
    selBld.innerHTML = htmlOpts;
    selBld.value = selectedQtyStructBuildingFilter;
  }

  // 3. ดรอปลิสต์ Type คูส่งน้ำ
  const selType = document.getElementById('selectQtyStructDitchTypeFilter');
  if (selType) {
    const typeMap = new Map();
    list.forEach(it => {
      typeMap.set(it.ditchType, (typeMap.get(it.ditchType) || 0) + it.count);
    });
    if (selectedQtyStructDitchTypeFilter !== 'ALL' && !typeMap.has(selectedQtyStructDitchTypeFilter)) {
      selectedQtyStructDitchTypeFilter = 'ALL';
    }
    let htmlOpts = `<option value="ALL" ${selectedQtyStructDitchTypeFilter === 'ALL' ? 'selected' : ''}>แสดงทุก Type คูส่งน้ำ (${typeMap.size} Type)</option>`;
    typeMap.forEach((cnt, tName) => {
      const safeVal = String(tName).replace(/"/g, '&quot;');
      const isSel = selectedQtyStructDitchTypeFilter === tName ? 'selected' : '';
      htmlOpts += `<option value="${safeVal}" ${isSel}>TYPE: ${escapeHtml(tName)} (${cnt} แห่ง)</option>`;
    });
    selType.innerHTML = htmlOpts;
    selType.value = selectedQtyStructDitchTypeFilter;
  }

  // 4. ดรอปลิสต์แหล่งข้อมูล
  const selSrc = document.getElementById('selectQtyStructSourceFilter');
  if (selSrc) {
    selSrc.value = selectedQtyStructSourceFilter;
  }
}

function toggleQtyStructureGroupCollapse(buildingName) {
  if (!buildingName) return;
  if (collapsedQtyStructureGroups.has(buildingName)) {
    collapsedQtyStructureGroups.delete(buildingName);
  } else {
    collapsedQtyStructureGroups.add(buildingName);
  }
  renderQtyStructureTables();
}

function expandOrCollapseAllQtyStructureGroups(collapseAll) {
  if (collapseAll) {
    qtyStructureGroupedByDitch.forEach(g => collapsedQtyStructureGroups.add(g.structureType));
  } else {
    collapsedQtyStructureGroups.clear();
  }
  renderQtyStructureTables();
}

function onQtyStructureFilterChange() {
  const selCanal = document.getElementById('selectQtyStructCanalFilter');
  const selBld = document.getElementById('selectQtyStructBuildingFilter');
  const selType = document.getElementById('selectQtyStructDitchTypeFilter');
  const selSrc = document.getElementById('selectQtyStructSourceFilter');

  if (selCanal) selectedQtyStructCanalFilter = selCanal.value || 'ALL';
  if (selBld) selectedQtyStructBuildingFilter = selBld.value || 'ALL';
  if (selType) selectedQtyStructDitchTypeFilter = selType.value || 'ALL';
  if (selSrc) selectedQtyStructSourceFilter = selSrc.value || 'ALL';

  renderQtyStructureTables();
}

function resetQtyStructureFilters() {
  selectedQtyStructCanalFilter = 'ALL';
  selectedQtyStructBuildingFilter = 'ALL';
  selectedQtyStructDitchTypeFilter = 'ALL';
  selectedQtyStructSourceFilter = 'ALL';
  updateQtyStructureFilterDropdownsUI(qtyStructureRawItems);
  renderQtyStructureTables();
}

function toggleQtyStructSectionCollapse(secId, btnId) {
  const body = document.getElementById(secId);
  const btn = document.getElementById(btnId);
  if (!body) return;
  const isNowHidden = body.classList.toggle('hidden');
  if (btn) {
    btn.textContent = isNowHidden ? '+' : '-';
    btn.title = isNowHidden ? 'ขยายส่วนนี้' : 'ย่อส่วนนี้';
  }
}

function renderQtyStructureTables() {
  const summary = buildQtyStructureGroupedSummaries(qtyStructureRawItems);
  qtyStructureGroupedByDitch = summary.groupedByBuilding;
  qtyStructureGroupedAcrossDitches = summary.groupedAcross;

  const totalBuildingsCount = summary.filteredItems.reduce((acc, it) => acc + it.count, 0);
  const distinctBuildingTypes = summary.groupedByBuilding.length;
  const distinctTypeSizeGroups = summary.groupedAcross.length;

  // อัปเดตป้ายสรุปสถิติด้านบน
  const badgeTotalEl = document.getElementById('qtyStructStatTotalCount');
  const badgeTypesEl = document.getElementById('qtyStructStatBuildingTypes');
  const badgeGroupsEl = document.getElementById('qtyStructStatUniqueSpecs');
  if (badgeTotalEl) badgeTotalEl.textContent = `${totalBuildingsCount} แห่ง`;
  if (badgeTypesEl) badgeTypesEl.textContent = `${distinctBuildingTypes} ประเภทอาคาร`;
  if (badgeGroupsEl) badgeGroupsEl.textContent = `${distinctTypeSizeGroups} รูปแบบ (Type+ขนาด)`;

  // 1. Render ตารางส่วนที่ 1: แยกตามแต่ละอาคาร (คูส่งน้ำ + Type + ขนาดที่เหมือนกันอยู่ด้วยกัน)
  const tbodyByDitch = document.getElementById('qtyStructByDitchTableBody');
  const tfootByDitch = document.getElementById('qtyStructByDitchTableFoot');
  if (tbodyByDitch) {
    if (summary.groupedByBuilding.length === 0) {
      tbodyByDitch.innerHTML = `
        <tr>
          <td colspan="12" class="py-6 text-center text-slate-500 text-xs">
            ยังไม่มีข้อมูลอาคารประกอบตามเงื่อนไขที่เลือก — กดปุ่ม <strong>"🔄 ดึงค่าจากส่วนถอดแบบ"</strong> เพื่ออัปเดตข้อมูล
          </td>
        </tr>
      `;
    } else {
      let htmlRows = '';
      summary.groupedByBuilding.forEach((bGroup, bIdx) => {
        const isCollapsed = collapsedQtyStructureGroups.has(bGroup.structureType);
        const safeBName = String(bGroup.structureType).replace(/'/g, "\\'");
        const collapseSym = isCollapsed ? '+' : '-';
        const srcBadge = bGroup.sourceType === 'attachment'
          ? `<span class="ew-badge ew-badge-amber" style="font-size:10px;">ท่อรับน้ำเข้าแปลงไร่นา</span>`
          : `<span class="ew-badge ew-badge-cyan" style="font-size:10px;">อาคารประกอบ</span>`;

        htmlRows += `
          <tr class="ew-canal-group-header-row" data-struct-group="${escapeHtml(bGroup.structureType)}">
            <td colspan="12" class="px-3 py-1.5 text-left font-bold text-xs">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <button type="button" class="ew-line-collapse-btn" onclick="toggleQtyStructureGroupCollapse('${safeBName}')" title="ย่อ/ขยายกลุ่มอาคาร ${escapeHtml(bGroup.structureType)}">${collapseSym}</button>
                  <span class="text-slate-900">🏗️ ${bIdx + 1}. ${escapeHtml(bGroup.structureType)}</span>
                  ${srcBadge}
                  <span class="text-slate-600 font-normal text-[11px]">(${bGroup.rows.length} กลุ่มคูส่งน้ำ/Type/ขนาด)</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="ew-badge ew-badge-emerald">รวม ${bGroup.totalCount} แห่ง</span>
                </div>
              </div>
            </td>
          </tr>
        `;

        bGroup.rows.forEach((row, rIdx) => {
          const hiddenCls = isCollapsed ? ' ew-row-hidden' : '';
          const hiddenStyle = isCollapsed ? ' display: none !important;' : '';
          const kmText = row.kmList.length > 0 ? row.kmList.join(', ') : '-';
          const remarkText = row.remarks.size > 0 ? Array.from(row.remarks).join(', ') : '-';
          const upDownText = (row.upType !== '-' || row.downType !== '-')
            ? `${escapeHtml(row.upType)} / ${escapeHtml(row.downType)}`
            : '-';

          htmlRows += `
            <tr class="border-b border-slate-200 hover:bg-sky-50/70 transition${hiddenCls}" style="${hiddenStyle}">
              <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-600">${rIdx + 1}</td>
              <td class="px-2.5 py-1.5 text-left font-semibold text-slate-800">${escapeHtml(row.structureType)}</td>
              <td class="px-2.5 py-1.5 text-left text-sky-800 font-medium">${escapeHtml(row.fullItemName)}</td>
              <td class="px-2 py-1.5 text-center font-medium text-slate-700">${escapeHtml(row.canalName)}</td>
              <td class="px-2 py-1.5 text-center font-bold text-cyan-800">${escapeHtml(row.ditchName)}</td>
              <td class="px-2 py-1.5 text-center">
                <span class="ew-badge ew-badge-cyan">${escapeHtml(row.ditchType)}</span>
                <div class="text-[10px] text-slate-500 font-mono mt-0.5">${escapeHtml(row.ditchDimText)}</div>
              </td>
              <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-700">${upDownText}</td>
              <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(row.h)}</td>
              <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(row.pipeDia)}</td>
              <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(row.length)}</td>
              <td class="px-2.5 py-1.5 text-left font-mono text-[11px] text-slate-700">${escapeHtml(kmText)}</td>
              <td class="px-2.5 py-1.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/60">${row.totalCount}</td>
            </tr>
          `;
        });
      });
      tbodyByDitch.innerHTML = htmlRows;
    }
  }

  if (tfootByDitch) {
    tfootByDitch.innerHTML = `
      <tr class="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
        <td colspan="11" class="px-3 py-2 text-right text-xs">รวมจำนวนอาคารประกอบทั้งหมด (ตามเงื่อนไขที่แสดง):</td>
        <td class="px-3 py-2 text-center font-mono text-sm text-emerald-800 bg-emerald-100/80">${totalBuildingsCount} แห่ง</td>
      </tr>
    `;
  }

  // 2. Render ตารางส่วนที่ 2: สรุปรวมทุกคูส่งน้ำที่มี อาคาร + Type คูส่งน้ำ + ขนาด เหมือนกันอยู่ด้วยกัน
  const tbodyAcross = document.getElementById('qtyStructAcrossDitchesTableBody');
  const tfootAcross = document.getElementById('qtyStructAcrossDitchesTableFoot');
  if (tbodyAcross) {
    if (summary.groupedAcross.length === 0) {
      tbodyAcross.innerHTML = `
        <tr>
          <td colspan="10" class="py-6 text-center text-slate-500 text-xs">
            ยังไม่มีข้อมูลสรุปรวมตาม Type และขนาด
          </td>
        </tr>
      `;
    } else {
      tbodyAcross.innerHTML = summary.groupedAcross.map((grp, idx) => {
        const upDownText = (grp.upType !== '-' || grp.downType !== '-')
          ? `${escapeHtml(grp.upType)} / ${escapeHtml(grp.downType)}`
          : '-';
        return `
          <tr class="border-b border-slate-200 hover:bg-sky-50/70 transition">
            <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-600">${idx + 1}</td>
            <td class="px-2.5 py-1.5 text-left font-bold text-slate-800">${escapeHtml(grp.structureType)}</td>
            <td class="px-2.5 py-1.5 text-left text-sky-800 font-medium">${escapeHtml(grp.fullItemName)}</td>
            <td class="px-2 py-1.5 text-center">
              <span class="ew-badge ew-badge-cyan">${escapeHtml(grp.ditchType)}</span>
              <div class="text-[10px] text-slate-500 font-mono mt-0.5">${escapeHtml(grp.ditchDimText)}</div>
            </td>
            <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-700">${upDownText}</td>
            <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(grp.h)}</td>
            <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(grp.pipeDia)}</td>
            <td class="px-2 py-1.5 text-center font-mono text-xs text-slate-800">${escapeHtml(grp.length)}</td>
            <td class="px-2.5 py-1.5 text-left text-xs text-slate-700">${escapeHtml(grp.ditchBreakdownText)}</td>
            <td class="px-2.5 py-1.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/60">${grp.totalCount}</td>
          </tr>
        `;
      }).join('');
    }
  }

  if (tfootAcross) {
    tfootAcross.innerHTML = `
      <tr class="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
        <td colspan="9" class="px-3 py-2 text-right text-xs">รวมจำนวนอาคารประกอบทั้งโครงการ (ทุกคูส่งน้ำ):</td>
        <td class="px-3 py-2 text-center font-mono text-sm text-emerald-800 bg-emerald-100/80">${totalBuildingsCount} แห่ง</td>
      </tr>
    `;
  }
}

function syncQtyStructureFromTakeoff(showSuccessNotice = false) {
  qtyStructureRawItems = collectQtyStructureItemsFromTakeoff();
  qtyStructureHasSyncedInitial = true;
  lastQtyStructureTakeoffSignature = computeTakeoffSignatureForQtyStructure();

  updateQtyStructureFilterDropdownsUI(qtyStructureRawItems);
  renderQtyStructureTables();

  if (showSuccessNotice && typeof showBanner === 'function') {
    const totalCnt = qtyStructureRawItems.reduce((acc, it) => acc + it.count, 0);
    showBanner(`ดึงและสรุปข้อมูลงานอาคารประกอบจากส่วนถอดแบบสำเร็จ (${qtyStructureGroupedByDitch.length} ประเภทอาคาร • รวม ${totalCnt} แห่ง)`, 'emerald');
  }
  return qtyStructureRawItems;
}

function copyQtyStructureSummaryTableData(mode = 'byDitch') {
  if (!qtyStructureHasSyncedInitial || qtyStructureRawItems.length === 0) {
    syncQtyStructureFromTakeoff(false);
  }
  let lines = [];
  if (mode === 'acrossDitches') {
    lines.push([
      'ลำดับ', 'ประเภทอาคาร', 'รายการอาคาร (รวมขนาด)', 'Type คูส่งน้ำ', 'มิติคูส่งน้ำ',
      'UP / DOWN', 'H (ม.)', 'ศก. ท่อ (ม.)', 'ความยาว (ม.)', 'คูส่งน้ำที่มีรายการนี้', 'จำนวนรวม (แห่ง)'
    ].join('\t'));
    qtyStructureGroupedAcrossDitches.forEach((grp, idx) => {
      lines.push([
        idx + 1,
        grp.structureType,
        grp.fullItemName,
        grp.ditchType,
        grp.ditchDimText,
        `${grp.upType} / ${grp.downType}`,
        grp.h,
        grp.pipeDia,
        grp.length,
        grp.ditchBreakdownText,
        grp.totalCount
      ].join('\t'));
    });
  } else {
    lines.push([
      'ลำดับในกลุ่ม', 'ประเภทอาคาร', 'รายการอาคาร (รวมขนาด)', 'คลองส่งน้ำ', 'คูส่งน้ำ',
      'Type คูส่งน้ำ', 'มิติคูส่งน้ำ', 'UP / DOWN', 'H (ม.)', 'ศก. ท่อ (ม.)', 'ความยาว (ม.)', 'กม. ที่ตั้ง', 'จำนวนรวม (แห่ง)'
    ].join('\t'));
    qtyStructureGroupedByDitch.forEach(bGroup => {
      bGroup.rows.forEach((row, rIdx) => {
        lines.push([
          rIdx + 1,
          row.structureType,
          row.fullItemName,
          row.canalName,
          row.ditchName,
          row.ditchType,
          row.ditchDimText,
          `${row.upType} / ${row.downType}`,
          row.h,
          row.pipeDia,
          row.length,
          row.kmList.join(', ') || '-',
          row.totalCount
        ].join('\t'));
      });
    });
  }

  const text = lines.join('\n');
  if (typeof writeToClipboard === 'function') {
    writeToClipboard(text, 'คัดลอกตารางสรุปงานอาคารประกอบลงคลิปบอร์ดเรียบร้อยแล้ว!');
  } else if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text);
  }
  return text;
}
