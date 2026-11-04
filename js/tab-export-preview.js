// ===== js/tab-export-preview.js =====
// รอบ 42 / รอบ 55 / รอบ 56: หน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก"
//
// ข้อกำหนดรอบ 55:
//   0) ลบแท็บ "setting" ออกจากหน้าต่างตรวจสอบข้อมูลก่อนส่งออก
//   1) แท็บ "📑 รวมข้อมูล" ย้ายไปไว้ท้ายสุด
//   2) เพิ่มปุ่ม "🧮 คำนวณ" ตำแหน่งต่อท้ายปุ่ม "ใช้ค่านี้" เพื่อคำนวณค่าระดับต่างๆ
//   3) รวมชีต "รวมข้อมูล" ในไฟล์ส่งออก Excel ด้วยเสมอ
//   4) ปุ่ม "🔍 ตรวจสอบข้อมูล" ให้ตรวจสอบข้อมูลในหน้าต่างนี้ และแสดงผลในหน้าต่างนี้ด้านล่างตาราง
//   5) กม. ที่มีระดับคูส่งน้ำ และที่ กม. ระดับดินเดิม ให้รวม กม. เดียวกันอยู่ในแถวเดียวกัน
//   6) ย้ายอาคารประกอบไปอยู่แถว กม. ที่มีระดับคูส่งน้ำด้วย
//
// ข้อกำหนดรอบ 56 (แท็บรวมข้อมูล):
//   1) ตรวจสอบ "ช่วงคูน้ำ" ให้ตรงกับค่าในตาราง (อาคารประกอบ / ระดับดินเดิม / ระดับคูส่งน้ำ) ทุกแถว
//   2) คำนวณค่าระดับให้ครบทุกแถวและทุกคอลัมน์ (รวมระดับ BL. สิ้นสุด / TBL สิ้นสุด และการส่งต่อค่าระดับข้ามช่วงคูน้ำ)
//   3) กม. ที่มีอาคารซ้ำกัน (มีหลายอาคารใน กม. เดียวกัน) แถวที่ซ้ำไม่ต้องใส่ค่าระดับดินเดิมและระดับคูส่งน้ำซ้ำ

// ---------- สถานะของหน้าต่าง ----------
let exportPreviewState = {
  open: false,
  actionLabel: 'ส่งออก',
  sheets: [],            // [{ name, rows }] (ไม่รวมชีต setting)
  activeSheet: 'merged', // key ของแท็บที่เลือกอยู่ ('merged' = แท็บรวม)
  mergedRows: [],        // แถวดิบของแท็บรวม (จาก epBuildMergedRows)
  kmStep: 20,            // ระยะห่าง (ม.) ของปุ่ม "แยก กม. ทุกๆ .. ม."
  calculated: true,      // คำนวณค่าระดับต่างๆ (BL, TBL, ระดับดินเดิม) ตาม กม.
  validationOpen: false, // แสดงผลการตรวจสอบข้อมูลด้านล่างตารางในหน้าต่างนี้
  resolve: null          // ตัว resolve ของ Promise
};

// ---------- ค่าคงที่ ----------
const EXPORT_PREVIEW_MERGED_KEY = 'merged';
const EXPORT_PREVIEW_MERGED_LABEL = '📑 รวมข้อมูล';
const EXPORT_PREVIEW_KM_STEPS = [5, 10, 20, 25, 50, 100];

// ---------- เครื่องมือเล็ก ๆ ----------
function epEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function epNum(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = parseFloat(v);
  return isNaN(n) ? '' : n;
}

function epKmText(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof formatKmForExport === 'function') return formatKmForExport(v);
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const km = Math.floor(abs / 1000);
  const m = abs - km * 1000;
  const mStr = (Math.abs(m - Math.round(m)) < 0.005)
    ? m.toFixed(0).padStart(3, '0')
    : m.toFixed(2).padStart(6, '0');
  return `${sign}${km}+${mStr}`;
}

function epKmNum(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof parseKmInput === 'function') {
    const r = parseKmInput(v);
    if (r !== '' && r !== null && r !== undefined && !isNaN(parseFloat(r))) return parseFloat(r);
  }
  const n = parseFloat(v);
  return isNaN(n) ? '' : n;
}

function epFilterSheetsNoSetting(sheets) {
  return (Array.isArray(sheets) ? sheets : []).filter(s => s && s.name !== 'setting');
}

function epFindHeaderIndex(headerRow, colName, fallbackIdx) {
  if (Array.isArray(headerRow)) {
    const idx = headerRow.findIndex(h => String(h === undefined || h === null ? '' : h).trim() === colName);
    if (idx >= 0) return idx;
  }
  return fallbackIdx;
}

// ---------- โมเดลข้อมูลดิบจาก 3 แท็บ ----------
function epBuildMergedRows(sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  const findSheet = (name) => list.find(s => s && s.name === name) || { rows: [] };
  const groundSheet = findSheet('ระดับดินเดิม');
  const levelSheet = findSheet('ระดับคูส่งน้ำ');
  const structSheet = findSheet('อาคารประกอบ');

  const out = [];

  // --- ระดับดินเดิม ---
  // คอลัมน์มาตรฐาน: คลองส่งน้ำ | คูส่งน้ำ | กม. | ระดับดินเดิม (ม.) | ลำดับคู | ช่วงคูน้ำ
  const gHdr = (groundSheet.rows || [])[0] || [];
  const gSecCol = epFindHeaderIndex(gHdr, 'ช่วงคูน้ำ', 5);
  (groundSheet.rows || []).slice(1).forEach(r => {
    const km = epKmNum(r[2]);
    const secRaw = r[gSecCol];
    out.push({
      src: 'ground',
      kind: 'ระดับดินเดิม',
      canal: r[0] || 'คลอง',
      ditch: r[1] || '-',
      km: isNaN(km) ? '' : km,
      kmText: epKmText(km === '' ? '' : km),
      section: (secRaw !== undefined && secRaw !== null && secRaw !== '') ? secRaw : '',
      values: { elev: r[3] },
      title: 'ระดับดินเดิม',
      detail: (r[3] === '' || r[3] === undefined) ? 'ไม่ได้กรอกระดับ' : ('ระดับ ' + epNum(r[3]) + ' ม.')
    });
  });

  // --- ระดับคูส่งน้ำ ---
  // คอลัมน์มาตรฐาน: คลองส่งน้ำ | คูส่งน้ำ | TYPE | H TBL | SLOPE | กม.เริ่มต้น | H | BL1 | TBL1 | กม.สิ้นสุด | BL2 | TBL2 | ลำดับคู | ช่วงคูน้ำ
  const lHdr = (levelSheet.rows || [])[0] || [];
  const lSecCol = epFindHeaderIndex(lHdr, 'ช่วงคูน้ำ', 13);
  (levelSheet.rows || []).slice(1).forEach(r => {
    const kmStart = epKmNum(r[5]);
    const kmEnd = epKmNum(r[9]);
    const secRaw = r[lSecCol];
    out.push({
      src: 'level',
      kind: 'ระดับคูส่งน้ำ',
      canal: r[0] || 'คลอง',
      ditch: r[1] || '-',
      km: isNaN(kmStart) ? '' : kmStart,
      kmText: epKmText(kmStart === '' ? '' : kmStart),
      kmEnd: isNaN(kmEnd) ? '' : kmEnd,
      kmEndText: epKmText(kmEnd === '' ? '' : kmEnd),
      section: (secRaw !== undefined && secRaw !== null && secRaw !== '') ? secRaw : '',
      values: {
        type: r[2], levelType: r[2], hTbl: r[3], slope: r[4], h: r[6], levelH: r[6],
        bl1: r[7], tbl1: r[8], bl2: r[10], tbl2: r[11]
      },
      title: 'ระดับคูส่งน้ำ (TYPE ' + (r[2] || '-') + ')',
      detail: 'H ' + epNum(r[6]) + ' · SLOPE ' + epNum(r[4]) +
              ' · BL ' + epNum(r[7]) + '→' + epNum(r[10]) +
              ' · TBL ' + epNum(r[8]) + '→' + epNum(r[11])
    });
  });

  // --- อาคารประกอบ ---
  // คอลัมน์มาตรฐาน: คลองส่งน้ำ | คูส่งน้ำ | กม. | รายการอาคาร | ประเภทอาคาร | H | ศก.ท่อ | ความยาว | หมายเหตุ | UP | DOWN | ลำดับคู | จากระดับ | ช่วงคูน้ำ
  const sHdr = (structSheet.rows || [])[0] || [];
  const sSecCol = epFindHeaderIndex(sHdr, 'ช่วงคูน้ำ', 13);
  const sFromLvlCol = epFindHeaderIndex(sHdr, 'จากระดับ', 12);
  (structSheet.rows || []).slice(1).forEach((r, sRowIdx) => {
    const km = epKmNum(r[2]);
    const secRaw = r[sSecCol];
    out.push({
      src: 'structure',
      kind: 'อาคารประกอบ',
      canal: r[0] || 'คลอง',
      ditch: r[1] || '-',
      km: isNaN(km) ? '' : km,
      kmText: epKmText(km === '' ? '' : km),
      section: (secRaw !== undefined && secRaw !== null && secRaw !== '') ? secRaw : '',
      _structOrder: sRowIdx,
      values: {
        item: r[3], type: r[4], structType: r[4], h: r[5], structH: r[5], dia: r[6], len: r[7],
        remark: r[8], up: r[9], down: r[10], fromLevel: sFromLvlCol < r.length ? r[sFromLvlCol] : ''
      },
      title: 'อาคารประกอบ · ' + (r[4] || '-ไม่มี-'),
      detail: (r[3] || '-') + (r[8] ? ' · ' + r[8] : '')
    });
  });

  return out;
}

// ---------- หัวตารางของแท็บรวม ----------
function epMergedHeaders() {
  return [
    'คลองส่งน้ำ', 'คูส่งน้ำ', 'ตาม กม.', 'ช่วงคูน้ำ', 'ประเภทข้อมูล',
    'ระดับดินเดิม (ม.)', 'TYPE', 'H TBL (ม.)', 'SLOPE', 'H (ม.)',
    'ระดับ BL. เริ่มต้น', 'ระดับ TBL เริ่มต้น', 'กม.สิ้นสุด',
    'ระดับ BL. สิ้นสุด', 'ระดับ TBL สิ้นสุด',
    'รายการอาคาร', 'ประเภทอาคาร', 'H อาคาร (ม.)', 'ศก. ท่อ (ม.)',
    'ความยาว (ม.)', 'หมายเหตุ', 'UP', 'DOWN'
  ];
}

// แปลงแถวของแท็บรวม → ค่าในคอลัมน์ตามหัวตาราง
// รอบ 56 ข้อ 3: หากเป็นแถวอาคารที่ กม. ซ้ำกัน (isDuplicateStructKm === true) จะไม่ใส่ค่าระดับดินเดิมและระดับคูส่งน้ำซ้ำ
function epMergedRowCells(row) {
  const v = row.values || {};
  const isDupStruct = !!row.isDuplicateStructKm;
  const hasGround = !isDupStruct && ((row.sources && row.sources.indexOf('ground') >= 0) || row.src === 'ground' || (v.elev !== undefined && v.elev !== ''));
  const hasLevel = !isDupStruct && ((row.sources && row.sources.indexOf('level') >= 0) || row.src === 'level' || (v.levelType !== undefined && v.levelType !== '') || (v.bl1 !== undefined && v.bl1 !== ''));
  const hasStruct = (row.sources && row.sources.indexOf('structure') >= 0) || row.src === 'structure' || (v.item !== undefined && v.item !== '') || (v.structType !== undefined && v.structType !== '');

  const levelType = v.levelType !== undefined ? v.levelType : (hasLevel && !hasStruct ? (v.type || '') : '');
  const levelH = v.levelH !== undefined ? v.levelH : (hasLevel && !hasStruct ? v.h : '');
  const structType = v.structType !== undefined ? v.structType : (hasStruct ? (v.type || '') : '');
  const structH = v.structH !== undefined ? v.structH : (hasStruct ? v.h : '');

  return [
    row.canal,
    row.ditch,
    row.kmText,
    row.section,
    row.kind,
    hasGround ? epNum(v.elev) : '',
    hasLevel ? (levelType || '') : '',
    hasLevel ? epNum(v.hTbl) : '',
    hasLevel ? epNum(v.slope) : '',
    hasLevel ? epNum(levelH) : '',
    hasLevel ? epNum(v.bl1) : '',
    hasLevel ? epNum(v.tbl1) : '',
    hasLevel ? (row.kmEndText || '') : '',
    hasLevel ? epNum(v.bl2) : '',
    hasLevel ? epNum(v.tbl2) : '',
    hasStruct ? (v.item || '') : '',
    hasStruct ? (structType || '') : '',
    hasStruct ? epNum(structH) : '',
    hasStruct ? epNum(v.dia) : '',
    hasStruct ? epNum(v.len) : '',
    hasStruct ? (v.remark || '') : '',
    hasStruct ? (v.up || '') : '',
    hasStruct ? (v.down || '') : ''
  ];
}

// ---------- ฟังก์ชันคำนวณระดับดินเดิมและระดับคูส่งน้ำตาม กม. ----------
function epInterpolate(a, b, t) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb)) return '';
  return na + (nb - na) * t;
}

function epRound2(n) {
  if (n === '' || n === null || n === undefined) return '';
  const v = parseFloat(n);
  if (isNaN(v)) return '';
  return v.toFixed(2);
}

// รอบ 58: เก็บค่าตัวเลขที่เป็น 0 ให้ถูกต้อง (ไม่ให้กลายเป็นค่าว่างเหมือนการใช้ ||)
//   - null / undefined / ''  → '' (ยังถือว่าไม่มีค่า)
//   - 0 (ตัวเลข)            → 0 (ต้องเก็บไว้!)
//   - '0' / '0.00' (ข้อความ) → 0
function epKeepNum(v) {
  if (typeof keepNumValue === 'function') return keepNumValue(v);
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return isNaN(v) ? '' : v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return '';
    const n = parseFloat(t);
    return isNaN(n) ? v : n;
  }
  return v;
}

// หาจุดระดับดินเดิมที่อยู่ใกล้ กม. ที่ต้องการ (interpolate จากจุดที่มีระดับจริงในคูเดียวกัน)
function epFindGroundElevAtKm(groundRows, km, canal, ditch) {
  if (km === '' || km === null || km === undefined || isNaN(parseFloat(km))) return '';
  const kmNum = parseFloat(km);
  const same = (groundRows || []).filter(g => g && g.canal === canal && String(g.ditch) === String(ditch));
  const pool = same.length ? same : (groundRows || []);
  const withVal = pool.filter(g => g.km !== '' && g.values && g.values.elev !== '' && g.values.elev !== undefined && !isNaN(parseFloat(g.values.elev)));
  if (!withVal.length) return '';

  const sorted = withVal.slice().sort((a, b) => a.km - b.km);
  const exact = sorted.find(g => Math.abs(g.km - kmNum) < 0.001);
  if (exact) return epRound2(exact.values.elev);

  if (kmNum <= sorted[0].km) return epRound2(sorted[0].values.elev);
  if (kmNum >= sorted[sorted.length - 1].km) return epRound2(sorted[sorted.length - 1].values.elev);

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (kmNum >= a.km && kmNum <= b.km) {
      const t = (b.km === a.km) ? 0 : ((kmNum - a.km) / (b.km - a.km));
      const v = epInterpolate(a.values.elev, b.values.elev, t);
      return epRound2(v);
    }
  }
  return '';
}

// รอบ 56 ข้อ 2: เตรียมและคำนวณส่งต่อค่าระดับคูส่งน้ำ (BL1, TBL1, BL2, TBL2) ของทุกช่วงในคูเดียวกันให้ครบถ้วน
function epPrepareCanalLevelSegments(levelRows, canal, ditch) {
  const raw = (levelRows || []).filter(l =>
    l && l.src === 'level' && !l.isGenerated &&
    l.canal === canal && String(l.ditch) === String(ditch)
  );
  if (!raw.length) return [];

  const prepared = [];
  let prevEnd = null;
  let prevBl2Num = null;

  raw.forEach((seg, idx) => {
    const v = seg.values || {};
    const kmStart = (seg.km !== '' && seg.km !== null && seg.km !== undefined && !isNaN(parseFloat(seg.km)))
      ? parseFloat(seg.km)
      : (prevEnd !== null ? prevEnd : 0);
    const kmEnd = (seg.kmEnd !== '' && seg.kmEnd !== null && seg.kmEnd !== undefined && !isNaN(parseFloat(seg.kmEnd)))
      ? parseFloat(seg.kmEnd)
      : kmStart;

    const lType = v.levelType || v.type || 'VU1';
    const hTblRaw = parseFloat(v.hTbl);
    const hTbl = !isNaN(hTblRaw)
      ? hTblRaw
      : (typeof getHFromType === 'function' ? getHFromType(lType) : 0.50);
    const slopeRaw = parseFloat(v.slope);
    const slope = (!isNaN(slopeRaw) && slopeRaw > 0) ? slopeRaw : 4000;
    const hRaw = v.levelH !== undefined ? v.levelH : v.h;
    const hDrop = (!isNaN(parseFloat(hRaw))) ? parseFloat(hRaw) : 0;

    let bl1Num = (v.bl1 !== '' && v.bl1 !== null && v.bl1 !== undefined && !isNaN(parseFloat(v.bl1)))
      ? parseFloat(v.bl1)
      : null;
    if (bl1Num === null && idx > 0 && prevBl2Num !== null) {
      bl1Num = prevBl2Num - hDrop;
    }

    let tbl1Num = (v.tbl1 !== '' && v.tbl1 !== null && v.tbl1 !== undefined && !isNaN(parseFloat(v.tbl1)))
      ? parseFloat(v.tbl1)
      : (bl1Num !== null && !isNaN(hTbl) ? (bl1Num + hTbl) : null);

    let bl2Num = (v.bl2 !== '' && v.bl2 !== null && v.bl2 !== undefined && !isNaN(parseFloat(v.bl2)))
      ? parseFloat(v.bl2)
      : null;
    if (bl2Num === null && bl1Num !== null && slope > 0 && kmEnd >= kmStart) {
      bl2Num = bl1Num - (Math.abs(kmEnd - kmStart) / slope);
    }

    let tbl2Num = (v.tbl2 !== '' && v.tbl2 !== null && v.tbl2 !== undefined && !isNaN(parseFloat(v.tbl2)))
      ? parseFloat(v.tbl2)
      : (bl2Num !== null && !isNaN(hTbl) ? (bl2Num + hTbl) : null);

    prevEnd = kmEnd;
    if (bl2Num !== null) prevBl2Num = bl2Num;

    const secVal = (seg.section !== undefined && seg.section !== null && String(seg.section).trim() !== '')
      ? seg.section
      : (idx + 1);

    prepared.push({
      km: kmStart,
      kmEnd: kmEnd,
      kmEndText: seg.kmEndText || epKmText(kmEnd),
      section: secVal,
      values: {
        levelType: lType,
        type: lType,
        hTbl: !isNaN(hTbl) ? hTbl : v.hTbl,
        slope: slope,
        levelH: hRaw !== undefined && hRaw !== '' ? hRaw : hDrop,
        h: hRaw !== undefined && hRaw !== '' ? hRaw : hDrop,
        bl1: bl1Num !== null ? epRound2(bl1Num) : '',
        tbl1: tbl1Num !== null ? epRound2(tbl1Num) : '',
        bl2: bl2Num !== null ? epRound2(bl2Num) : '',
        tbl2: tbl2Num !== null ? epRound2(tbl2Num) : ''
      }
    });
  });

  return prepared;
}

// คำนวณค่าระดับคูส่งน้ำ (TYPE, H TBL, SLOPE, H, BL1, TBL1, BL2, TBL2) ณ กม. ใดๆ จากช่วงระดับคูส่งน้ำของคูนั้น
function epEvalCanalLevelAtKm(levelRows, km, canal, ditch) {
  if (km === '' || km === null || km === undefined || isNaN(parseFloat(km))) return null;
  const kmNum = parseFloat(km);
  const same = epPrepareCanalLevelSegments(levelRows, canal, ditch);
  if (!same.length) return null;

  // 1) ถ้าตรงกับ กม.เริ่มต้น ของช่วงใด ให้ใช้ค่าของช่วงนั้นโดยตรง
  const exactStart = same.find(l => Math.abs(l.km - kmNum) < 0.001);
  if (exactStart) {
    const v = exactStart.values || {};
    return {
      section: exactStart.section,
      kmEnd: exactStart.kmEnd,
      kmEndText: exactStart.kmEndText,
      values: {
        levelType: v.levelType || v.type || '',
        type: v.levelType || v.type || '',
        hTbl: v.hTbl,
        slope: v.slope,
        levelH: v.levelH !== undefined ? v.levelH : v.h,
        h: v.levelH !== undefined ? v.levelH : v.h,
        bl1: epKeepNum(v.bl1),
        tbl1: epKeepNum(v.tbl1),
        bl2: epKeepNum(v.bl2),
        tbl2: epKeepNum(v.tbl2)
      }
    };
  }

  // 2) หาช่วงที่ครอบคลุม กม. นี้ (start <= km <= end) หรือช่วงใกล้สุดหากอยู่นอกขอบเล็กน้อย
  let seg = same.find(l => kmNum >= l.km - 0.001 && kmNum <= l.kmEnd + 0.001);
  if (!seg) {
    seg = (kmNum < same[0].km) ? same[0] : same[same.length - 1];
  }

  const v = seg.values || {};
  const start = seg.km;
  const end = seg.kmEnd;
  const t = (end > start) ? ((kmNum - start) / (end - start)) : 0;
  const slope = parseFloat(v.slope);
  const hTbl = parseFloat(v.hTbl);

  let blAt = '';
  if (!isNaN(slope) && slope > 0 && v.bl1 !== '' && v.bl1 !== undefined && !isNaN(parseFloat(v.bl1))) {
    blAt = parseFloat(v.bl1) - ((kmNum - start) / slope);
  } else {
    const interpBl = epInterpolate(v.bl1, v.bl2, t);
    if (interpBl !== '') blAt = parseFloat(interpBl);
  }

  let tblAt = '';
  if (blAt !== '' && !isNaN(hTbl)) {
    tblAt = parseFloat(blAt) + hTbl;
  } else {
    const interpTbl = epInterpolate(v.tbl1, v.tbl2, t);
    if (interpTbl !== '') tblAt = parseFloat(interpTbl);
  }

  const isAtEnd = Math.abs(kmNum - end) < 0.001;
  const bl1Out = blAt === '' ? (isAtEnd && epKeepNum(v.bl2) !== '' ? epRound2(v.bl2) : '') : epRound2(blAt);
  const tbl1Out = tblAt === '' ? (isAtEnd && epKeepNum(v.tbl2) !== '' ? epRound2(v.tbl2) : '') : epRound2(tblAt);
  // รอบ 56 ข้อ 2: คำนวณระดับ BL. สิ้นสุด และ TBL สิ้นสุด ให้ครบทุกแถวในแท็บรวมข้อมูล
  // รอบ 58: ใช้ epKeepNum เพื่อไม่ให้ค่า 0 กลายเป็นค่าว่าง
  const bl2Out = epKeepNum(v.bl2) !== '' ? epRound2(v.bl2) : bl1Out;
  const tbl2Out = epKeepNum(v.tbl2) !== '' ? epRound2(v.tbl2) : tbl1Out;

  return {
    section: seg.section !== undefined && seg.section !== '' ? seg.section : '',
    kmEnd: end,
    kmEndText: seg.kmEndText || epKmText(end),
    values: {
      levelType: v.levelType || v.type || '',
      type: v.levelType || v.type || '',
      hTbl: v.hTbl,
      slope: v.slope,
      levelH: isAtEnd ? 0 : (v.levelH !== undefined ? v.levelH : v.h),
      h: isAtEnd ? 0 : (v.levelH !== undefined ? v.levelH : v.h),
      bl1: bl1Out,
      tbl1: tbl1Out,
      bl2: bl2Out,
      tbl2: tbl2Out
    }
  };
}

// ---------- แยก "กม. ทุกๆ .. ม." (เติมแถวตามระยะ) ----------
function epBuildKmStepRows(mergedRows, stepMeters) {
  const step = parseFloat(stepMeters);
  if (!step || isNaN(step) || step <= 0) return [];

  const levelRows = (mergedRows || []).filter(r => r.src === 'level' && r.km !== '' && r.kmEnd !== '');
  const groundRows = (mergedRows || []).filter(r => r.src === 'ground' && r.km !== '');
  const out = [];

  // จัดกลุ่มตามคลอง/คู เพื่อใช้ช่วงระดับที่คำนวณต่อเนื่องครบทุกช่วง
  const chanKeys = [];
  const chanKeySet = new Set();
  levelRows.forEach(l => {
    const k = (l.canal || '') + '||' + String(l.ditch || '');
    if (!chanKeySet.has(k)) {
      chanKeySet.add(k);
      chanKeys.push({ canal: l.canal, ditch: l.ditch });
    }
  });

  chanKeys.forEach(({ canal, ditch }) => {
    const preparedSegs = epPrepareCanalLevelSegments(levelRows, canal, ditch);
    const existingAnyKm = (mergedRows || [])
      .filter(r => r.src !== 'ground' && r.canal === canal && String(r.ditch) === String(ditch) && r.km !== '')
      .map(r => Math.round(r.km * 1000) / 1000);

    preparedSegs.forEach(lvl => {
      const start = lvl.km;
      const end = lvl.kmEnd;
      if (end <= start) return;

      const n = Math.floor((end - start) / step);
      for (let i = 1; i <= n; i++) {
        const km = Math.round((start + i * step) * 1000) / 1000;
        if (km >= end) break;
        if (existingAnyKm.some(e => Math.abs(e - km) < 0.001)) continue;

        const evalLvl = epEvalCanalLevelAtKm(levelRows, km, canal, ditch);
        const elev = epFindGroundElevAtKm(groundRows, km, canal, ditch);
        const lv = evalLvl ? evalLvl.values : {};

        out.push({
          src: 'level',
          sources: elev !== '' ? ['ground', 'level'] : ['level'],
          kind: elev !== '' ? 'ระดับดินเดิม + ระดับคูส่งน้ำ (เติมตาม กม.)' : 'ระดับคูส่งน้ำ (เติมตาม กม.)',
          canal: canal,
          ditch: ditch,
          km: km,
          kmText: epKmText(km),
          kmEnd: end,
          kmEndText: lvl.kmEndText,
          section: lvl.section,
          values: {
            elev: elev,
            type: lv.levelType || lvl.values.type,
            levelType: lv.levelType || lvl.values.type,
            hTbl: lv.hTbl !== undefined ? lv.hTbl : lvl.values.hTbl,
            slope: lv.slope !== undefined ? lv.slope : lvl.values.slope,
            h: lv.levelH !== undefined ? lv.levelH : lvl.values.h,
            levelH: lv.levelH !== undefined ? lv.levelH : lvl.values.h,
            bl1: lv.bl1 !== undefined ? lv.bl1 : '',
            tbl1: lv.tbl1 !== undefined ? lv.tbl1 : '',
            // รอบ 58: ใช้ epKeepNum แทน || เพื่อไม่ให้ค่าตัวเลข 0 กลายเป็นค่าว่าง
            bl2: lv.bl2 !== undefined ? epKeepNum(lv.bl2) : epKeepNum(lvl.values.bl2),
            tbl2: lv.tbl2 !== undefined ? epKeepNum(lv.tbl2) : epKeepNum(lvl.values.tbl2)
          },
          title: 'ระดับดินเดิม + ระดับคูส่งน้ำ (เติมตาม กม.) · TYPE ' + (lvl.values.type || '-'),
          detail: 'เติมอัตโนมัติทุกๆ ' + step + ' ม. (BL ' + (lv.bl1 !== undefined && lv.bl1 !== '' ? lv.bl1 : 0) + ')',
          isGenerated: true
        });
      }
    });
  });

  return out;
}

// ---------- รอบ 55 / รอบ 56: รวมแถวที่ กม. เดียวกัน (ระดับดินเดิม + ระดับคูส่งน้ำ + อาคารประกอบ) ----------
//   - รอบ 56 ข้อ 1: ตรวจสอบ "ช่วงคูน้ำ" ให้ตรงกับตาราง (ยึดค่าช่วงคูน้ำจากแถวอาคารประกอบ / ระดับดินเดิม / ระดับคูส่งน้ำ ตามตารางจริง)
//   - รอบ 56 ข้อ 2: คำนวณค่าระดับให้ครบทุกแถวและทุกคอลัมน์ (รวม BL. สิ้นสุด / TBL สิ้นสุด)
//   - รอบ 56 ข้อ 3: กม. ที่มีอาคารซ้ำกัน (มีหลายอาคารใน กม. เดียวกัน) แถวที่ซ้ำไม่ต้องใส่ค่าระดับดินเดิมและระดับคูส่งน้ำซ้ำ
function epCombineRowsByKm(rawRows, baseRowsForCalc) {
  const list = Array.isArray(rawRows) ? rawRows : [];
  const basePool = Array.isArray(baseRowsForCalc) ? baseRowsForCalc : list;
  const levelPool = basePool.filter(r => r && r.src === 'level' && !r.isGenerated);
  const groundPool = basePool.filter(r => r && r.src === 'ground' && !r.isGenerated);
  const shouldCalc = !(typeof exportPreviewState !== 'undefined' && exportPreviewState && exportPreviewState.calculated === false);
  const hasSecVal = (v) => v !== undefined && v !== null && String(v).trim() !== '';

  // จัดกลุ่มตาม (คลองส่งน้ำ, คูส่งน้ำ) ตามลำดับที่ปรากฏ
  const chanGroups = [];
  const chanMap = new Map();
  list.forEach(r => {
    if (!r) return;
    const cKey = (r.canal || '') + '||' + String(r.ditch || '');
    if (!chanMap.has(cKey)) {
      const grp = { canal: r.canal || 'คลอง', ditch: r.ditch || '-', rows: [] };
      chanMap.set(cKey, grp);
      chanGroups.push(grp);
    }
    chanMap.get(cKey).rows.push(r);
  });

  const combinedOut = [];

  chanGroups.forEach(grp => {
    const { canal, ditch, rows } = grp;

    // จัดกลุ่มย่อยตาม กม. (ปัดทศนิยม 3 ตำแหน่งเพื่อจับคู่ กม. เดียวกัน)
    const kmBuckets = new Map();
    const noKmRows = [];

    rows.forEach(r => {
      if (r.km === '' || r.km === null || r.km === undefined || isNaN(parseFloat(r.km))) {
        noKmRows.push(r);
        return;
      }
      const kmRound = Math.round(parseFloat(r.km) * 1000) / 1000;
      if (!kmBuckets.has(kmRound)) {
        kmBuckets.set(kmRound, { km: kmRound, grounds: [], levels: [], structs: [], generated: [] });
      }
      const b = kmBuckets.get(kmRound);
      if (r.isGenerated) {
        b.generated.push(r);
      } else if (r.src === 'ground') {
        b.grounds.push(r);
      } else if (r.src === 'level') {
        b.levels.push(r);
      } else if (r.src === 'structure') {
        b.structs.push(r);
      }
    });

    const sortedKms = Array.from(kmBuckets.keys()).sort((a, b) => a - b);

    sortedKms.forEach(kmVal => {
      const b = kmBuckets.get(kmVal);
      const explicitGRow = b.grounds[0] || null;
      const explicitLRow = b.levels[0] || null;
      const gRow = explicitGRow || b.generated.find(x => x.values && x.values.elev !== undefined && x.values.elev !== '') || null;
      const lRow = explicitLRow || b.generated.find(x => x.src === 'level') || null;
      const isOnlyGenerated = (b.grounds.length === 0 && b.levels.length === 0 && b.structs.length === 0 && b.generated.length > 0);

      // คำนวณค่าระดับดินเดิมและระดับคูส่งน้ำ ณ กม. นี้ให้ครบถ้วน
      let elevVal = (gRow && gRow.values && gRow.values.elev !== undefined && gRow.values.elev !== '')
        ? epRound2(gRow.values.elev)
        : (shouldCalc ? epFindGroundElevAtKm(groundPool, kmVal, canal, ditch) : '');

      const calcFallback = shouldCalc ? epEvalCanalLevelAtKm(levelPool, kmVal, canal, ditch) : null;
      let evalLvl = null;
      if (lRow && lRow.values) {
        const lv = lRow.values;
        const cv = (calcFallback && calcFallback.values) ? calcFallback.values : {};
        evalLvl = {
          section: hasSecVal(lRow.section) ? lRow.section : (calcFallback ? calcFallback.section : ''),
          kmEnd: lRow.kmEnd !== undefined && lRow.kmEnd !== '' ? lRow.kmEnd : (calcFallback ? calcFallback.kmEnd : ''),
          kmEndText: lRow.kmEndText || (calcFallback ? calcFallback.kmEndText : ''),
          values: {
            levelType: lv.levelType || lv.type || cv.levelType || '',
            type: lv.levelType || lv.type || cv.type || '',
            hTbl: (lv.hTbl !== undefined && lv.hTbl !== '') ? lv.hTbl : cv.hTbl,
            slope: (lv.slope !== undefined && lv.slope !== '') ? lv.slope : cv.slope,
            levelH: (lv.levelH !== undefined && lv.levelH !== '') ? lv.levelH : (lv.h !== undefined && lv.h !== '' ? lv.h : cv.levelH),
            h: (lv.levelH !== undefined && lv.levelH !== '') ? lv.levelH : (lv.h !== undefined && lv.h !== '' ? lv.h : cv.h),
            bl1: (lv.bl1 !== undefined && lv.bl1 !== '') ? epRound2(lv.bl1) : cv.bl1,
            tbl1: (lv.tbl1 !== undefined && lv.tbl1 !== '') ? epRound2(lv.tbl1) : cv.tbl1,
            bl2: (lv.bl2 !== undefined && lv.bl2 !== '') ? epRound2(lv.bl2) : cv.bl2,
            tbl2: (lv.tbl2 !== undefined && lv.tbl2 !== '') ? epRound2(lv.tbl2) : cv.tbl2
          }
        };
      } else if (calcFallback) {
        evalLvl = calcFallback;
      }

      const structList = b.structs.length > 0 ? b.structs : [null];

      structList.forEach((sRow, sIdx) => {
        // รอบ 56 ข้อ 3: กม. ที่มีอาคารซ้ำกัน (แถวที่ 2, 3, ... ของ กม. เดียวกัน) ไม่ต้องใส่ค่าระดับดินเดิมและระดับคูส่งน้ำซ้ำ
        const isDuplicateStructKm = (sRow !== null && sIdx > 0);

        const sources = [];
        if (!isDuplicateStructKm) {
          if (gRow || (elevVal !== '' && elevVal !== undefined)) sources.push('ground');
          if (lRow || evalLvl) sources.push('level');
        }
        if (sRow) sources.push('structure');

        const kindParts = [];
        if (sources.indexOf('ground') >= 0) kindParts.push('ระดับดินเดิม');
        if (sources.indexOf('level') >= 0) kindParts.push('ระดับคูส่งน้ำ');
        if (sources.indexOf('structure') >= 0) kindParts.push('อาคารประกอบ');
        let kindLabel = kindParts.join(' + ') || 'รวมข้อมูล';
        if (isOnlyGenerated) kindLabel += ' (เติมตาม กม.)';

        const lv = (!isDuplicateStructKm && evalLvl) ? evalLvl.values : {};
        const sv = (sRow && sRow.values) ? sRow.values : {};

        // รอบ 56 ข้อ 1: ยึดค่า "ช่วงคูน้ำ" ให้ตรงกับตารางจริง (อาคารประกอบ -> ระดับดินเดิม -> ระดับคูส่งน้ำ -> ช่วงคำนวณ)
        const secVal = (sRow && hasSecVal(sRow.section))
          ? sRow.section
          : ((explicitGRow && hasSecVal(explicitGRow.section))
              ? explicitGRow.section
              : ((explicitLRow && hasSecVal(explicitLRow.section))
                  ? explicitLRow.section
                  : ((evalLvl && hasSecVal(evalLvl.section))
                      ? evalLvl.section
                      : ((gRow && hasSecVal(gRow.section))
                          ? gRow.section
                          : ((lRow && hasSecVal(lRow.section)) ? lRow.section : '')))));

        const primarySrc = sRow ? 'structure' : (lRow ? 'level' : (gRow ? 'ground' : 'level'));

        combinedOut.push({
          src: primarySrc,
          sources: sources,
          kind: kindLabel,
          canal: canal,
          ditch: ditch,
          km: kmVal,
          kmText: epKmText(kmVal),
          kmEnd: isDuplicateStructKm ? '' : (evalLvl ? evalLvl.kmEnd : (lRow ? lRow.kmEnd : '')),
          kmEndText: isDuplicateStructKm ? '' : (evalLvl ? evalLvl.kmEndText : (lRow ? lRow.kmEndText : '')),
          section: secVal,
          isDuplicateStructKm: isDuplicateStructKm,
          _structOrder: sRow && typeof sRow._structOrder === 'number' ? sRow._structOrder : sIdx,
          values: {
            elev: isDuplicateStructKm ? '' : elevVal,
            levelType: isDuplicateStructKm ? '' : (lv.levelType || ''),
            type: isDuplicateStructKm ? (sv.structType || sv.type || '') : (lv.levelType || sv.structType || sv.type || ''),
            hTbl: isDuplicateStructKm ? '' : (lv.hTbl !== undefined ? lv.hTbl : ''),
            slope: isDuplicateStructKm ? '' : (lv.slope !== undefined ? lv.slope : ''),
            levelH: isDuplicateStructKm ? '' : (lv.levelH !== undefined ? lv.levelH : ''),
            h: isDuplicateStructKm
              ? (sv.structH !== undefined ? sv.structH : (sRow ? sv.h : ''))
              : ((lv.levelH !== undefined && lv.levelH !== '') ? lv.levelH : (sv.structH !== undefined ? sv.structH : '')),
            bl1: isDuplicateStructKm ? '' : (lv.bl1 !== undefined ? lv.bl1 : ''),
            tbl1: isDuplicateStructKm ? '' : (lv.tbl1 !== undefined ? lv.tbl1 : ''),
            bl2: isDuplicateStructKm ? '' : (lv.bl2 !== undefined ? lv.bl2 : ''),
            tbl2: isDuplicateStructKm ? '' : (lv.tbl2 !== undefined ? lv.tbl2 : ''),
            item: sv.item || '',
            structType: sv.structType || sv.type || '',
            structH: sv.structH !== undefined ? sv.structH : (sRow ? sv.h : ''),
            dia: sv.dia !== undefined ? sv.dia : '',
            len: sv.len !== undefined ? sv.len : '',
            remark: sv.remark || '',
            up: sv.up || '',
            down: sv.down || '',
            fromLevel: sv.fromLevel
          },
          isGenerated: isOnlyGenerated
        });
      });
    });

    noKmRows.forEach(r => combinedOut.push(r));
  });

  return combinedOut;
}

// ---------- เรียงแถวของแท็บรวม ----------
function epSortMergedRows(rows) {
  const srcOrder = { ground: 0, level: 1, structure: 2 };
  const groupOrder = [];
  const groupKey = (r) => (r.canal || '') + '||' + String(r.ditch || '');
  (rows || []).forEach(r => {
    const k = groupKey(r);
    if (groupOrder.indexOf(k) < 0) groupOrder.push(k);
  });

  return (rows || []).slice().sort((a, b) => {
    const ga = groupOrder.indexOf(groupKey(a));
    const gb = groupOrder.indexOf(groupKey(b));
    if (ga !== gb) return ga - gb;

    const ka = (a.km === '' || a.km === null || a.km === undefined) ? -Infinity : parseFloat(a.km);
    const kb = (b.km === '' || b.km === null || b.km === undefined) ? -Infinity : parseFloat(b.km);
    if (ka !== kb) return ka - kb;

    const sa = (srcOrder[a.src] === undefined) ? 9 : srcOrder[a.src];
    const sb = (srcOrder[b.src] === undefined) ? 9 : srcOrder[b.src];
    if (sa !== sb) return sa - sb;

    const oa = (typeof a._structOrder === 'number') ? a._structOrder : 0;
    const ob = (typeof b._structOrder === 'number') ? b._structOrder : 0;
    return oa - ob;
  });
}

// คำนวณแถวของแท็บรวมทั้งหมด (รวม กม. เดียวกัน + เติมตามระยะ กม.)
function epGetMergedRows() {
  const base = exportPreviewState.mergedRows || [];
  const step = exportPreviewState.kmStep;

  let all = base.slice();
  if (step && step > 0) {
    const generated = epBuildKmStepRows(base, step);
    all = base.concat(generated);
  }
  return epSortMergedRows(epCombineRowsByKm(all, base));
}

// รอบ 55 ข้อ 3: สร้างชีต "รวมข้อมูล" สำหรับส่งออกลงไฟล์ Excel ด้วยเสมอ
function epBuildMergedExportSheet(sheets, stepMeters) {
  const baseRows = epBuildMergedRows(sheets || exportPreviewState.sheets || []);
  const step = (stepMeters !== undefined && stepMeters !== null) ? parseFloat(stepMeters) : (exportPreviewState.kmStep || 0);
  const stepRows = (step && step > 0) ? epBuildKmStepRows(baseRows, step) : [];
  const combined = epSortMergedRows(epCombineRowsByKm(baseRows.concat(stepRows), baseRows));
  const aoa = [epMergedHeaders()];
  combined.forEach(r => {
    aoa.push(epMergedRowCells(r));
  });
  return { name: "รวมข้อมูล", rows: aoa };
}

// ---------- รอบ 55 ข้อ 2 / รอบ 56 ข้อ 2: คำนวณค่าระดับ BL1 / TBL1 / BL2 / TBL2 ของทุกช่วงคูน้ำ ----------
function epSyncAndCalcLevelRowsData() {
  if (typeof levelRowsData === 'undefined' || !Array.isArray(levelRowsData) || typeof getHFromType !== 'function') {
    return;
  }
  levelRowsData.forEach((rLvl, rIdx) => {
    if (!rLvl) return;
    const cIdx = rLvl.channelId;
    const dimItem = (typeof dimensionRows !== 'undefined' && Array.isArray(dimensionRows))
      ? dimensionRows.find(d => d && d.channelId === cIdx) : null;
    const isFirstOfChan = (rIdx === 0) || (levelRowsData[rIdx - 1].channelId !== cIdx);
    const prevRow = !isFirstOfChan ? levelRowsData[rIdx - 1] : null;

    const fallbackKmStart = (!isFirstOfChan && prevRow && prevRow.customKmEnd !== '' && prevRow.customKmEnd !== undefined)
      ? prevRow.customKmEnd
      : (dimItem && dimItem.kmStart !== '' && dimItem.kmStart !== undefined ? dimItem.kmStart : 0);
    if (rLvl.customKmStart === '' || rLvl.customKmStart === undefined) {
      rLvl.customKmStart = fallbackKmStart;
    }

    if (!isFirstOfChan) {
      const prevBl2 = parseFloat(prevRow && prevRow.bl2);
      if (!isNaN(prevBl2) && (rLvl.bl1 === '' || rLvl.bl1 === undefined || isNaN(parseFloat(rLvl.bl1)))) {
        const curH = parseFloat(rLvl.h) || 0;
        rLvl.bl1 = (prevBl2 - curH).toFixed(2);
      }
    }

    const bl1 = parseFloat(rLvl.bl1);
    if (!isNaN(bl1)) {
      const curType = rLvl.isDynamicRow
        ? (rLvl.customType || (dimItem ? dimItem.type : 'VU1'))
        : (dimItem ? dimItem.type : 'VU1');
      const hTbl = getHFromType(curType);
      const km1 = parseFloat(rLvl.customKmStart !== '' && rLvl.customKmStart !== undefined ? rLvl.customKmStart : fallbackKmStart) || 0;
      const km2 = parseFloat(rLvl.customKmEnd !== '' && rLvl.customKmEnd !== undefined ? rLvl.customKmEnd : (typeof getChannelKmEnd === 'function' ? getChannelKmEnd(cIdx) : NaN));
      if (!isNaN(km2)) {
        const dist = Math.abs(km2 - km1);
        const slope = parseFloat(rLvl.isDynamicRow ? rLvl.customSlope : (dimItem ? dimItem.slope : 4000)) || 4000;
        const bl2 = bl1 - (dist / slope);
        rLvl.bl2 = bl2.toFixed(2);
        rLvl.tbl1 = (bl1 + hTbl).toFixed(2);
        rLvl.tbl2 = (bl2 + hTbl).toFixed(2);
      }
    }
  });
}

function calculateExportPreviewMergedLevels() {
  const inputEl = document.getElementById('epKmStepInput');
  if (inputEl && inputEl.value !== undefined && String(inputEl.value).trim() !== '') {
    const n = parseFloat(inputEl.value);
    if (!isNaN(n) && n >= 0) {
      exportPreviewState.kmStep = n;
    }
  }

  epSyncAndCalcLevelRowsData();

  // อัปเดตข้อมูลชีตและแถวรวมข้อมูลใหม่หลังคำนวณ
  if (typeof buildExportSheetsData === 'function') {
    try {
      exportPreviewState.sheets = epFilterSheetsNoSetting(buildExportSheetsData());
    } catch (_) {}
  }
  exportPreviewState.mergedRows = epBuildMergedRows(exportPreviewState.sheets);
  exportPreviewState.calculated = true;
  epRenderDialog();

  if (typeof uiToast === 'function') {
    uiToast('คำนวณค่าระดับต่างๆ ในแท็บรวมข้อมูลเรียบร้อยแล้ว', 'success');
  }
  return epGetMergedRows();
}

// ---------- การวาดหน้าต่าง ----------
function epSheetNameToTabKey(sheetName) {
  const map = {
    'แผนงานโครงการ': 'project',
    'ระบบคูส่งน้ำ': 'ditch',
    'มิติคูส่งน้ำ': 'dimension',
    'ระดับดินเดิม': 'ground',
    'ระดับคูส่งน้ำ': 'level',
    'อาคารประกอบ': 'structure',
    'อาคารท่อรับน้ำเข้าแปลงไร่นา': 'attachment'
  };
  return map[sheetName] || '';
}

function epRenderSheetTable(sheet) {
  const rows = sheet.rows || [];
  if (!rows.length) {
    return '<div class="ep-empty">ไม่มีข้อมูลในแท็บนี้</div>';
  }
  const header = rows[0] || [];
  const tabKey = epSheetNameToTabKey(sheet.name);
  const issuesForTab = (typeof validationIssues !== 'undefined' && Array.isArray(validationIssues) && tabKey)
    ? validationIssues.filter(it => it && it.tab === tabKey)
    : [];

  let html = '<table class="ep-table"><thead><tr>';
  header.forEach(h => { html += `<th>${epEsc(h)}</th>`; });
  html += '</tr></thead><tbody>';
  rows.slice(1).forEach((r, rIdx) => {
    const rowIssue = issuesForTab.find(it => it.rowIdx === rIdx);
    const rowCls = rowIssue ? ' class="ep-row-error"' : '';
    html += `<tr data-ep-row="${rIdx}"${rowCls}>`;
    for (let i = 0; i < header.length; i++) {
      const v = r[i];
      html += `<td>${epEsc(v === null || v === undefined ? '' : v)}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function epRenderMergedTable() {
  const rows = epGetMergedRows();
  const headers = epMergedHeaders();
  if (!rows.length) {
    return '<div class="ep-empty">ยังไม่มีข้อมูลในแท็บรวม (ระดับดินเดิม · ระดับคูส่งน้ำ · อาคารประกอบ)</div>';
  }

  let html = '<table class="ep-table ep-table-merged"><thead><tr>';
  headers.forEach(h => { html += `<th>${epEsc(h)}</th>`; });
  html += '</tr></thead><tbody>';

  rows.forEach((r, idx) => {
    const cells = epMergedRowCells(r);
    const cls = r.isGenerated ? ' class="ep-row-generated"' : '';
    html += `<tr data-ep-merged-row="${idx}"${cls}>`;
    cells.forEach(c => { html += `<td>${epEsc(c)}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function epRenderKmStepBar() {
  const step = exportPreviewState.kmStep;
  const base = exportPreviewState.mergedRows || [];
  const genCount = epBuildKmStepRows(base, step).length;

  let btns = '';
  const noSplitActive = (!step || step <= 0) ? ' active' : '';
  btns += `<button type="button" class="ep-km-step-btn${noSplitActive}" onclick="setExportPreviewKmStep(0)" title="ไม่แยก กม. — แสดงเฉพาะข้อมูลจริง">ไม่แยก</button>`;
  EXPORT_PREVIEW_KM_STEPS.forEach(s => {
    const active = (s === step) ? ' active' : '';
    btns += `<button type="button" class="ep-km-step-btn${active}" onclick="setExportPreviewKmStep(${s})" title="แยก กม. ทุกๆ ${s} ม.">ทุกๆ ${s} ม.</button>`;
  });

  return `
    <div class="ep-km-step-bar">
      <div class="ep-km-step-label">📏 แยก กม. :</div>
      ${btns}
      <input type="number" class="ep-km-step-input" id="epKmStepInput" min="1" step="1" value="${step || ''}" title="ระยะห่างเอง (เมตร)">
      <span class="ep-km-step-unit">ม.</span>
      <button type="button" class="ep-km-step-apply" onclick="applyExportPreviewKmStep()" title="ใช้ระยะที่พิมพ์เอง">ใช้ค่านี้</button>
      <button type="button" class="ep-km-step-calc" id="epBtnCalculateLevels" onclick="calculateExportPreviewMergedLevels()" title="คำนวณค่าระดับต่างๆ ในแท็บรวมข้อมูล">🧮 คำนวณ</button>
      <span class="ep-km-step-count">เติมเพิ่ม ${genCount} แถว</span>
    </div>`;
}

// รอบ 55 ข้อ 0 และ ข้อ 1: ลบแท็บ setting ออก และย้ายแท็บ "📑 รวมข้อมูล" ไปไว้ท้ายสุด
function epRenderTabs() {
  const sheets = epFilterSheetsNoSetting(exportPreviewState.sheets);
  const active = exportPreviewState.activeSheet;

  let html = '';
  sheets.forEach((s, si) => {
    const isActive = (active === si);
    const rowCount = Math.max(0, (s.rows || []).length - 1);
    html += `<button type="button" class="ep-tab${isActive ? ' active' : ''}" onclick="switchExportPreviewSheet(${si})" title="ชีต ${epEsc(s.name)}">${epEsc(s.name)} <span class="ep-tab-count">${rowCount}</span></button>`;
  });
  const mergedCount = epGetMergedRows().length;
  html += `<button type="button" class="ep-tab${active === EXPORT_PREVIEW_MERGED_KEY ? ' active' : ''}" onclick="switchExportPreviewSheet(-1)">${epEsc(EXPORT_PREVIEW_MERGED_LABEL)} <span class="ep-tab-count">${mergedCount}</span></button>`;
  return html;
}

// ---------- รอบ 55 ข้อ 4: แสดงผลการตรวจสอบข้อมูลภายในหน้าต่างนี้ ด้านล่างตาราง ----------
function epRenderValidationPanel() {
  const issues = (typeof validationIssues !== 'undefined' && Array.isArray(validationIssues)) ? validationIssues : [];
  const errCount = issues.filter(i => i && i.severity === 'error').length;
  const warnCount = issues.length - errCount;
  const checkedTime = (typeof validationCheckedAt !== 'undefined' && validationCheckedAt)
    ? new Date(validationCheckedAt).toLocaleString('th-TH')
    : new Date().toLocaleString('th-TH');

  const tabName = {
    ditch: 'ระบบคูส่งน้ำ', dimension: 'มิติคูส่งน้ำ', ground: 'ระดับดินเดิม',
    level: 'ระดับคูส่งน้ำ', structure: 'อาคารประกอบ', attachment: 'อาคารท่อรับน้ำเข้าแปลงไร่นา',
    cross: 'ความสอดคล้องข้ามแท็บ', ref: 'จุดอ้างอิง P1/P2'
  };
  const tabOrder = ['ditch', 'dimension', 'ground', 'level', 'structure', 'attachment', 'cross', 'ref'];
  const byTab = {};
  issues.forEach(it => {
    if (!it) return;
    if (!byTab[it.tab]) byTab[it.tab] = [];
    byTab[it.tab].push(it);
  });

  let html = `
    <div class="ep-validation-panel">
      <div class="validation-header">
        <div class="validation-summary-box">
          <span class="validation-count-badge err">พบ error ${errCount} จุด</span>
          <span class="validation-count-badge warn">เตือน ${warnCount} จุด</span>
          <span class="validation-time">ตรวจเมื่อ ${epEsc(checkedTime)}</span>
        </div>
        <div class="validation-actions">
          <button type="button" class="btn-action" style="background-color:#6c757d;" onclick="runExportPreviewValidation()">🔄 ตรวจสอบใหม่</button>
          <button type="button" class="btn-action" style="background-color:#0d6efd;" onclick="closeExportPreviewValidation()">✖ ปิดผลตรวจ</button>
        </div>
      </div>`;

  if (!issues.length) {
    html += `<div class="validation-all-clear">✅ ไม่พบปัญหาในข้อมูล — ข้อมูลในทุกแท็บสอดคล้องกันและพร้อมส่งออก</div>`;
  } else {
    html += `<div class="validation-issue-list">`;
    tabOrder.forEach(t => {
      const list = byTab[t];
      if (!list || !list.length) return;
      html += `<div class="validation-tab-group">
        <div class="validation-tab-title">📌 ${epEsc(tabName[t] || t)} <span class="validation-tab-count">(${list.length})</span></div>
        <table class="validation-table">
          <thead><tr><th style="min-width:40px;">#</th><th style="min-width:140px;">คูส่งน้ำ</th><th style="min-width:100px;">กม./ตำแหน่ง</th><th style="min-width:70px;">ระดับ</th><th>ปัญหาที่พบ</th><th style="min-width:110px; text-align:center;">ไปยังจุดที่ผิด</th><th style="min-width:44px; text-align:center;">ลบ</th></tr></thead>
          <tbody>
          ${list.map((it, i) => {
            const chTxt = (it.channelId !== null && it.channelId !== undefined && typeof vChannelLabel === 'function')
              ? vChannelLabel(it.channelId)
              : (it.channelId !== null && it.channelId !== undefined ? ('คู #' + it.channelId) : '-');
            return `<tr class="sev-${epEsc(it.severity)}" data-ep-issue-id="${epEsc(it.id)}">
              <td>${i + 1}</td>
              <td>${epEsc(chTxt)}</td>
              <td><a href="javascript:void(0)" class="validation-jump-link" onclick="goToExportPreviewValidationIssue('${epEsc(it.id)}', event)">${epEsc(it.km || 'ดูตำแหน่ง')}</a></td>
              <td><span class="sev-badge sev-${epEsc(it.severity)}">${it.severity === 'warn' ? 'เตือน' : 'ผิดพลาด'}</span></td>
              <td>
                <div class="validation-msg"><a href="javascript:void(0)" class="validation-msg-link" onclick="goToExportPreviewValidationIssue('${epEsc(it.id)}', event)">${epEsc(it.message)}</a></div>
                ${it.aiAdvice ? `<div class="validation-hint">💡 ${epEsc(it.aiAdvice)}</div>` : ''}
              </td>
              <td style="text-align:center; white-space:nowrap;">
                <a href="javascript:void(0)" class="validation-goto-btn" onclick="goToExportPreviewValidationIssue('${epEsc(it.id)}', event)">📍 ไปที่ตำแหน่ง</a>
              </td>
              <td style="text-align:center;">
                <button type="button" class="validation-dismiss-btn" onclick="dismissExportPreviewValidationIssue('${epEsc(it.id)}', event)" title="ลบข้อนี้">✖</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function epRenderBody() {
  const sheets = epFilterSheetsNoSetting(exportPreviewState.sheets);
  const active = exportPreviewState.activeSheet;
  let tableSectionHtml = '';
  if (active === EXPORT_PREVIEW_MERGED_KEY) {
    tableSectionHtml = epRenderKmStepBar() + '<div class="ep-table-wrap" id="epTableWrap">' + epRenderMergedTable() + '</div>';
  } else {
    const sheet = sheets[active];
    if (!sheet) {
      tableSectionHtml = '<div class="ep-empty">ไม่พบชีตนี้</div>';
    } else {
      tableSectionHtml = '<div class="ep-table-wrap" id="epTableWrap">' + epRenderSheetTable(sheet) + '</div>';
    }
  }
  const valStyle = exportPreviewState.validationOpen ? 'display: block;' : 'display: none;';
  const valContent = exportPreviewState.validationOpen ? epRenderValidationPanel() : '';
  return tableSectionHtml + `<div class="ep-validation-host" id="epValidationHost" style="${valStyle}">${valContent}</div>`;
}

function epRenderDialog() {
  const host = document.getElementById('exportPreviewOverlay');
  if (!host) return;

  const sheets = epFilterSheetsNoSetting(exportPreviewState.sheets);
  exportPreviewState.sheets = sheets;
  const totalRows = sheets.reduce((s, sh) => s + Math.max(0, ((sh.rows || []).length - 1)), 0);
  const mergedCount = epGetMergedRows().length;
  const actionLabel = exportPreviewState.actionLabel || 'ส่งออก';

  host.innerHTML = `
    <div class="ep-box" role="dialog" aria-modal="true" aria-label="ตรวจสอบข้อมูลก่อนส่งออก">
      <div class="ep-header">
        <div class="ep-title">📤 ตรวจสอบข้อมูลก่อน${epEsc(actionLabel)}</div>
        <button type="button" class="ep-close-x" onclick="closeExportPreviewDialog(false)" title="ปิดหน้าต่าง">✕</button>
      </div>
      <div class="ep-summary">
        <span class="ep-summary-chip">${sheets.length} ชีต</span>
        <span class="ep-summary-chip">${totalRows} แถว</span>
        <span class="ep-summary-chip">แท็บรวม ${mergedCount} แถว</span>
        <span class="ep-summary-hint">เลือกแท็บเพื่อดูข้อมูลของแท็บนั้น · แท็บ รวมข้อมูล อยู่ท้ายสุด</span>
      </div>
      <div class="ep-tabs" id="epTabsBar">${epRenderTabs()}</div>
      <div class="ep-content" id="epContent">${epRenderBody()}</div>
      <div class="ep-actions">
        <button type="button" class="ep-btn ep-btn-cancel" onclick="closeExportPreviewDialog(false)">✖ ยกเลิก</button>
        <button type="button" class="ep-btn ep-btn-validate" onclick="runExportPreviewValidation()" title="ตรวจสอบความถูกต้องของข้อมูลและแสดงผลด้านล่างตารางในหน้าต่างนี้">🔍 ตรวจสอบข้อมูล</button>
        <button type="button" class="ep-btn ep-btn-ok" onclick="closeExportPreviewDialog(true)">✅ ยืนยัน${epEsc(actionLabel)}</button>
      </div>
    </div>`;
}

// ---------- การสลับแท็บ / ตั้งค่าระยะ ----------
function switchExportPreviewSheet(sheetIdx) {
  const idx = parseInt(sheetIdx, 10);
  if (isNaN(idx) || idx < 0) {
    exportPreviewState.activeSheet = EXPORT_PREVIEW_MERGED_KEY;
  } else {
    exportPreviewState.activeSheet = idx;
  }
  epRenderDialog();
}

function setExportPreviewKmStep(step) {
  const n = parseFloat(step);
  if (isNaN(n) || n < 0) return;
  exportPreviewState.kmStep = (n === 0) ? 0 : n;
  epRenderDialog();
}

function applyExportPreviewKmStep() {
  const el = document.getElementById('epKmStepInput');
  if (!el) return;
  const n = parseFloat(el.value);
  if (isNaN(n) || n <= 0) {
    if (typeof uiToast === 'function') uiToast('กรุณากรอกระยะห่างเป็นตัวเลขที่มากกว่า 0', 'error');
    return;
  }
  exportPreviewState.kmStep = n;
  epRenderDialog();
}

// ---------- รอบ 55 ข้อ 4: ตรวจสอบข้อมูลและแสดงผลภายในหน้าต่างนี้ ด้านล่างตาราง ----------
function runExportPreviewValidation() {
  if (typeof runValidationRules === 'function') {
    runValidationRules();
    if (typeof validationCheckedAt !== 'undefined') validationCheckedAt = new Date();
    if (typeof clearValidationHighlights === 'function') clearValidationHighlights();
    if (typeof applyValidationHighlights === 'function') applyValidationHighlights();
    exportPreviewState.validationOpen = true;
    epRenderDialog();
    const valHost = document.getElementById('epValidationHost');
    if (valHost && typeof valHost.scrollIntoView === 'function') {
      try { valHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
    }
    const errCount = (typeof validationIssues !== 'undefined' && Array.isArray(validationIssues))
      ? validationIssues.filter(i => i && i.severity === 'error').length : 0;
    const warnCount = (typeof validationIssues !== 'undefined' && Array.isArray(validationIssues))
      ? (validationIssues.length - errCount) : 0;
    if (typeof uiToast === 'function') {
      uiToast(`ตรวจสอบข้อมูลแล้ว: พบ error ${errCount} จุด · เตือน ${warnCount} จุด`, errCount ? 'error' : 'success');
    }
    return validationIssues;
  } else if (typeof uiToast === 'function') {
    uiToast('ไม่พบระบบตรวจสอบข้อมูล', 'error');
  }
  return [];
}

function closeExportPreviewValidation() {
  exportPreviewState.validationOpen = false;
  epRenderDialog();
}

function dismissExportPreviewValidationIssue(issueId, ev) {
  if (typeof dismissValidationIssue === 'function') {
    dismissValidationIssue(issueId, ev);
  } else if (typeof validationIssues !== 'undefined' && Array.isArray(validationIssues)) {
    validationIssues = validationIssues.filter(it => it && it.id !== issueId);
  }
  epRenderDialog();
}

function goToExportPreviewValidationIssue(issueId, ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
  if (typeof validationIssues === 'undefined' || !Array.isArray(validationIssues)) return null;
  const it = validationIssues.find(x => x && x.id === issueId);
  if (!it) return null;

  const targetTab = (typeof resolveValidationTargetTab === 'function') ? resolveValidationTargetTab(it) : it.tab;
  const tabToSheetName = {
    project: 'แผนงานโครงการ',
    ditch: 'ระบบคูส่งน้ำ',
    dimension: 'มิติคูส่งน้ำ',
    ground: 'ระดับดินเดิม',
    level: 'ระดับคูส่งน้ำ',
    structure: 'อาคารประกอบ',
    attachment: 'อาคารท่อรับน้ำเข้าแปลงไร่นา'
  };
  const wantSheetName = tabToSheetName[targetTab] || '';
  const sheets = epFilterSheetsNoSetting(exportPreviewState.sheets);
  const sheetIdx = sheets.findIndex(s => s && s.name === wantSheetName);
  if (sheetIdx >= 0) {
    exportPreviewState.activeSheet = sheetIdx;
    epRenderDialog();
  }
  // ซิงก์ไปยังตารางหลักด้านหลังด้วยเพื่อให้ช่องที่ผิดถูกโฟกัสพร้อมแก้ไขทันทีที่ปิดหน้าต่าง
  if (typeof goToValidationIssue === 'function') {
    try { goToValidationIssue(issueId); } catch (_) {}
  }
  return it;
}

// ---------- เปิด / ปิดหน้าต่าง ----------
function closeExportPreviewDialog(confirmed) {
  const host = document.getElementById('exportPreviewOverlay');
  if (host) host.classList.remove('show');
  exportPreviewState.open = false;

  const resolve = exportPreviewState.resolve;
  exportPreviewState.resolve = null;
  if (typeof resolve === 'function') resolve(!!confirmed);
}

async function openExportPreviewDialog(actionLabel) {
  const host = document.getElementById('exportPreviewOverlay');
  if (!host) {
    return true;
  }

  // คำนวณค่าระดับที่ยังไม่ได้กดคำนวณในตารางให้ครบถ้วนก่อนสร้างชีตพรีวิว
  try {
    epSyncAndCalcLevelRowsData();
  } catch (_) {}

  let sheets = [];
  try {
    sheets = (typeof buildExportSheetsData === 'function') ? buildExportSheetsData() : [];
  } catch (e) {
    console.warn('openExportPreviewDialog: เตรียมข้อมูลไม่สำเร็จ', e);
    sheets = [];
  }

  exportPreviewState.sheets = epFilterSheetsNoSetting(sheets);
  exportPreviewState.mergedRows = epBuildMergedRows(exportPreviewState.sheets);
  exportPreviewState.activeSheet = EXPORT_PREVIEW_MERGED_KEY;
  exportPreviewState.actionLabel = actionLabel || 'ส่งออก';
  exportPreviewState.calculated = true;
  exportPreviewState.validationOpen = false;
  exportPreviewState.open = true;

  epRenderDialog();
  host.classList.add('show');

  if (!host.__epBound) {
    host.__epBound = true;
    host.addEventListener('mousedown', (e) => {
      if (e.target === host && exportPreviewState.open) {
        closeExportPreviewDialog(false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && exportPreviewState.open) {
        closeExportPreviewDialog(false);
      }
    });
  }

  return new Promise((resolve) => {
    exportPreviewState.resolve = resolve;
  });
}
