// ===== รอบ 30: ระบบอ่านข้อมูลจากภาพแปลนด้วย AI (OpenAI-compatible Vision API) =====
// หน้าที่:
//   1) สร้าง prompt + JSON schema ที่บังคับให้ AI ตอบเป็น JSON ตามโครงสร้างที่แอปนำเข้าข้อมูลได้
//   2) ย่อภาพตามคุณภาพที่เลือก (1400 / 2400 / 3500 px) ก่อนส่ง
//   3) เรียก API แบบ OpenAI-compatible (/chat/completions)
//   4) แปลงคำตอบให้เป็นโครงสร้างข้อมูลที่แอปใช้ (validate + ทำค่าเริ่มต้นให้ค่าที่หายไป)
//   5) สร้าง overlay (ป้าย/เส้นระดับ/จุดอ้างอิง P1-P2) จากผลที่อ่านได้
//   6) นำเข้าผลลงตารางของแอป (นำเข้าเฉพาะส่วนที่ผู้ใช้ยืนยันจากแท็บ diff-preview)

// ---------- ข้อมูลตัวอย่างโครงสร้าง JSON ที่ต้องการ ----------
const AI_RESULT_SCHEMA_EXAMPLE = `{
  "channels": [
    {
      "canal": "คลองส่งน้ำ",
      "ditch": "01",
      "totalArea": "",
      "waterArea": "",
      "dimension": { "kmStart": 0, "kmEnd": 100, "q": 0.03, "slope": 4000, "b": 0.35, "d": 0.36, "type": "VU1", "tbl": 0.5, "tbr": 0.5 },
      "ground":    [ { "km": 0, "groundElevation": 252.45, "x": 0.08, "y": 0.55 }, { "km": 50, "groundElevation": 252.10, "x": 0.50, "y": 0.62 } ],
      "level":     [ { "kmStart": 0, "kmEnd": 100, "h": 0, "bl1": 251.90, "tbl1": 252.40, "bl2": 251.70, "tbl2": 252.20, "slope": 4000 } ],
      "structures":[ { "km": 0, "name": "อาคารท่อส่งน้ำเข้านา", "h": 0, "pipeDia": 0.6, "pipeCount": 1, "remark": "" } ],
      "attachments":[ { "km": 0, "name": "ท่อรับน้ำเข้าแปลงไร่นา", "h": 0.8, "pipeDia": 0.2, "length": 12, "count": 1, "remark": "" } ]
    }
  ],
  "refPoints": {
    "p1": { "x": 0.08, "y": 0.88, "km": 0,   "elev": 250.00 },
    "p2": { "x": 0.92, "y": 0.22, "km": 100, "elev": 254.00 }
  },
  "groundLine": [
    { "x": 0.08, "y": 0.55, "km": 0, "elev": 252.45 },
    { "x": 0.50, "y": 0.62, "km": 50, "elev": 252.10 },
    { "x": 0.92, "y": 0.68, "km": 100, "elev": 251.80 }
  ],
  "labels": [
    { "kind": "station",  "text": "0+050",          "x": 0.20, "y": 0.35, "angle": 0, "group": "g1" },
    { "kind": "structure","text": "อาคารท่อส่งน้ำเข้านา", "x": 0.22, "y": 0.30, "angle": 0, "group": "g1" },
    { "kind": "structure","text": "ปลายคู",          "x": 0.24, "y": 0.26, "angle": 0, "group": "g1" },
    { "kind": "h",        "text": "0.00",           "x": 0.26, "y": 0.22, "angle": 0, "group": "g1" },
    { "kind": "elev",     "text": "11.90",          "x": 0.30, "y": 0.60, "angle": 0, "group": "g2" },
    { "kind": "elev",     "text": "12.40",          "x": 0.32, "y": 0.58, "angle": 0, "group": "g2" },
    { "kind": "elev",     "text": "12.10",          "x": 0.34, "y": 0.56, "angle": 0, "group": "g2" }
  ],
  "levelLines": [
    { "type": "BL", "x1": 0.08, "y1": 0.86, "x2": 0.92, "y2": 0.16, "kmStart": 0, "kmEnd": 100 }
  ]
}`;

// ---------- รอบ 32: ลำดับการแสดงผลของป้ายที่รวมกลุ่มแล้ว ----------
//   ป้ายอาคารประกอบ = กม. → ชื่ออาคาร (ทั้งหมด) → H
const AI_LABEL_KIND_ORDER = ['station', 'structure', 'h', 'elev', 'slope'];

// ---------- รอบ 32: แปลงข้อความ "กม." เป็นค่าเมตร ----------
//   รองรับ "0+050" (0 กม. + 050 ม. = 50 ม.), "1+234.56", และตัวเลขเปล่า
function parseChainageKm(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (!s) return null;
  let m = s.match(/^(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const v = (parseFloat(m[1]) * 1000) + parseFloat(m[2]);
    return isFinite(v) ? v : null;
  }
  m = s.match(/^-?\d+(?:\.\d+)?$/);
  if (m) {
    const v = parseFloat(s);
    return isFinite(v) ? v : null;
  }
  return null;
}

// ---------- รอบ 35: แยกชื่ออาคารที่มี "และ" หรือ "," + จับคู่ชื่อใกล้เคียงกับ Typeอาคารประกอบ + ใส่ค่า H เฉพาะอาคารที่มีค่า H ----------
function getDefaultStructureTypeDBForAi() {
  if (typeof structureTypeDatabase !== 'undefined' && Array.isArray(structureTypeDatabase) && structureTypeDatabase.length > 0) {
    return structureTypeDatabase;
  }
  return [
    { type: "-ไม่มี-", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "-", down: "-" },
    { type: "อาคารท่อส่งน้ำเข้านา (เดิม)", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารท่อส่งน้ำเข้านา (ใหม่)", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "ปลายคู", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-" },
    { type: "อาคารปลายคูส่งน้ำแบบที่ 1", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-" },
    { type: "อาคารปลายคูส่งน้ำแบบที่ 2", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-" },
    { type: "อาคารปากคูซอย", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: true, up: "TypeNow", down: "-" },
    { type: "อาคารปากคูซอยแบบที่ 1", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "xxx", down: "TypeNow" },
    { type: "อาคารปากคูซอยแบบที่ 2", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "xxx", down: "TypeNow" },
    { type: "อาคารท่อลอดถนน", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
    { type: "อาคารท่อลอดถนนลดระดับ", h: "0.00", hEditable: true, pipeDia: "0.30", diaEditable: true, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "อาคารท่อลอดทางข้าม", h: "0.00", hEditable: true, pipeDia: "0.30", diaEditable: true, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "อาคารแผ่นพื้นทางข้าม", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "5.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
    { type: "อาคารน้ำตกลดระดับ", h: "0.00", hEditable: true, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "อาคารลดระดับ", h: "0.00", hEditable: true, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "บานอัดน้ำ", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-" },
    { type: "อาคารรับน้ำแบบที่ 1", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารรับน้ำแบบที่ 2", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารเปลี่ยนลาดทางเข้า", h: "0.00", hEditable: true, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "อาคารเปลี่ยนลาดทางออก", h: "0.00", hEditable: true, pipeDia: "", diaEditable: false, length: "", lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp", down: "TypeNow" },
    { type: "อาคารสะพานน้ำแบบที่ 1", h: "", hEditable: false, pipeDia: "0.30", diaEditable: true, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
    { type: "อาคารสะพานน้ำแบบที่ 2", h: "", hEditable: false, pipeDia: "", diaEditable: false, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
    { type: "อาคารท่อระบายน้ำแบบที่ 1", h: "", hEditable: false, pipeDia: "0.50", diaEditable: true, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารท่อระบายน้ำแบบที่ 2", h: "", hEditable: false, pipeDia: "0.50", diaEditable: true, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)", h: "", hEditable: false, pipeDia: "0.50", diaEditable: true, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "-", down: "TypeNow" },
    { type: "อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)", h: "", hEditable: false, pipeDia: "0.50", diaEditable: true, length: "6.00", lenEditable: true, remark: "", remarkEditable: false, up: "-", down: "TypeNow" }
  ];
}

// แยกข้อความชื่ออาคารที่มี "และ" หรือ "," (เฉพาะนอกวงเล็บ) ออกเป็นหลายอาคารตามลำดับในแบบ
function splitCompoundStructureText(rawText) {
  if (rawText === null || rawText === undefined) return [];
  const s = String(rawText).trim();
  if (!s) return [];

  // แยกเฉพาะ "," หรือ "และ" ที่อยู่นอกวงเล็บ (...)
  const parts = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; buf += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (depth === 0) {
      if (ch === ',') {
        if (buf.trim()) parts.push(buf.trim());
        buf = '';
        continue;
      }
      // ตรวจคำว่า "และ"
      if (s.slice(i, i + 3) === 'และ') {
        const prevChar = i > 0 ? s[i - 1] : ' ';
        const nextChar = (i + 3 < s.length) ? s[i + 3] : ' ';
        // แยกเมื่อมีช่องว่างหรือขึ้นต้นด้วยคำว่า "อาคาร"/"บาน"/"ปลาย"/"ท่อ"
        const afterStr = s.slice(i + 3).trim();
        if (/\s/.test(prevChar) || /\s/.test(nextChar) || /^(?:อาคาร|บาน|ปลาย|ท่อ|สะพาน|น้ำตก|แผ่นพื้น)/.test(afterStr)) {
          if (buf.trim()) parts.push(buf.trim());
          buf = '';
          i += 2;
          continue;
        }
      }
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean);
}

// คำนวณความคล้ายของสตริงแบบ Dice Bigram (0..1)
function computeThaiStringSimilarity(a, b) {
  const s1 = String(a || '').replace(/\s+/g, '');
  const s2 = String(b || '').replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;
  const bg1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bg1.set(bg, (bg1.get(bg) || 0) + 1);
  }
  let inter = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const c = bg1.get(bg) || 0;
    if (c > 0) {
      inter++;
      bg1.set(bg, c - 1);
    }
  }
  return (2 * inter) / ((s1.length - 1) + (s2.length - 1));
}

// จับคู่ชื่ออาคารที่อ่านได้กับ ประเภทอาคาร ในแท็บย่อย Typeอาคารประกอบ
function matchStructureTypeFromDatabase(rawName) {
  const db = getDefaultStructureTypeDBForAi().filter(e => e && e.type && e.type !== '-ไม่มี-');
  const raw = String(rawName || '').trim();
  if (!raw || raw === '-ไม่มี-') {
    return { matchedType: '-ไม่มี-', entry: null, extractedH: null, extractedRemark: '' };
  }

  let extractedH = null;
  let extractedRemark = '';
  const mH = raw.match(/h\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (mH) {
    const hv = parseFloat(mH[1]);
    if (!isNaN(hv) && hv > 0) extractedH = hv;
  }

  // ดึงหมายเหตุชื่อคูซอยถ้ามี เช่น "อาคารปากคูซอย (คูซอย 3)"
  if (/ปากคูซอย/.test(raw)) {
    const mRem = raw.match(/\(([^)]+)\)/);
    if (mRem && !/ศก|h\s*=|l\s*=|เดิม|ใหม่|แถว/i.test(mRem[1])) {
      extractedRemark = mRem[1].trim();
    }
  }

  // ล้างข้อมูลพารามิเตอร์ในวงเล็บ เช่น (H=0.25,ศก. 0.30x5.00) หรือ H=0.25 ท้ายชื่อ แต่คง (เดิม), (ใหม่), (2 แถว) ไว้
  let cleaned = raw
    .replace(/\(\s*(?:\d+\s*-\s*)?(?:h\s*=|ศก|l\s*=)[^)]*\)/gi, '')
    .replace(/\b(?:h|l)\s*=\s*[0-9]+(?:\.[0-9]+)?\s*(?:ม\.?|m\.?)?/gi, '')
    .trim();

  if (extractedRemark) {
    cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();
  }

  const norm = (str) => String(str || '')
    .replace(/\s+/g, '')
    .replace(/^อาคาร/, '')
    .toLowerCase();

  // 1) ตรงทุกตัวอักษร
  for (const e of db) {
    if (e.type === cleaned || e.type.replace(/\s+/g, '') === cleaned.replace(/\s+/g, '')) {
      return { matchedType: e.type, entry: e, extractedH, extractedRemark };
    }
  }

  // 2) กฎจับคู่คำสำคัญเฉพาะทาง (ป้องกันจับคู่ผิดระหว่าง ลดระดับ / ไม่ลดระดับ / แบบที่ 1 / แบบที่ 2)
  const hasDrop = /ลดระดับ/.test(cleaned);
  const hasWaterfall = /น้ำตก/.test(cleaned);
  const hasRoadPipe = /ท่อลอดถนน/.test(cleaned);
  const hasCrossPipe = /ท่อลอดทางข้าม|ลอดทางข้าม/.test(cleaned);
  const hasSlabCross = /แผ่นพื้นทางข้าม|แผ่นพื้น/.test(cleaned);
  const hasCheckGate = /บานอัดน้ำ|อัดน้ำ/.test(cleaned);
  const hasTurnout = /ท่อส่งน้ำเข้านา|ส่งน้ำเข้านา/.test(cleaned);
  const hasSubDitch = /ปากคูซอย/.test(cleaned);
  const hasEndDitch = /ปลายคู|สิ้นสุดคู|สุดคู/.test(cleaned);
  const hasFlumeBridge = /สะพานน้ำ/.test(cleaned);
  const hasDrainPipe = /ท่อระบายน้ำ/.test(cleaned);
  const hasInlet = /อาคารรับน้ำ|รับน้ำแบบ/.test(cleaned);
  const hasSlopeIn = /เปลี่ยนลาดทางเข้า/.test(cleaned);
  const hasSlopeOut = /เปลี่ยนลาดทางออก/.test(cleaned);
  const isType1 = /แบบที่\s*1/.test(cleaned);
  const isType2 = /แบบที่\s*2/.test(cleaned);
  const isTwoRow = /2\s*แถว|\b2\s*-\s*ศก/.test(raw);
  const isNew = /\(ใหม่\)|ใหม่/.test(cleaned);

  const findByType = (tName) => db.find(e => e.type === tName) || null;
  let ruleHit = null;
  if (hasCheckGate) ruleHit = findByType('บานอัดน้ำ');
  else if (hasRoadPipe && hasDrop) ruleHit = findByType('อาคารท่อลอดถนนลดระดับ');
  else if (hasRoadPipe) ruleHit = findByType('อาคารท่อลอดถนน');
  else if (hasCrossPipe) ruleHit = findByType('อาคารท่อลอดทางข้าม');
  else if (hasSlabCross) ruleHit = findByType('อาคารแผ่นพื้นทางข้าม');
  else if (hasWaterfall) ruleHit = findByType('อาคารน้ำตกลดระดับ');
  else if (hasSlopeIn) ruleHit = findByType('อาคารเปลี่ยนลาดทางเข้า');
  else if (hasSlopeOut) ruleHit = findByType('อาคารเปลี่ยนลาดทางออก');
  else if (hasTurnout) ruleHit = findByType(isNew ? 'อาคารท่อส่งน้ำเข้านา (ใหม่)' : 'อาคารท่อส่งน้ำเข้านา (เดิม)');
  else if (hasSubDitch) {
    if (isType2) ruleHit = findByType('อาคารปากคูซอยแบบที่ 2');
    else if (isType1) ruleHit = findByType('อาคารปากคูซอยแบบที่ 1');
    else ruleHit = findByType('อาคารปากคูซอย');
  } else if (hasEndDitch) {
    if (isType2) ruleHit = findByType('อาคารปลายคูส่งน้ำแบบที่ 2');
    else if (isType1) ruleHit = findByType('อาคารปลายคูส่งน้ำแบบที่ 1');
    else ruleHit = findByType('ปลายคู');
  } else if (hasFlumeBridge) {
    ruleHit = findByType(isType2 ? 'อาคารสะพานน้ำแบบที่ 2' : 'อาคารสะพานน้ำแบบที่ 1');
  } else if (hasDrainPipe) {
    if (isTwoRow) ruleHit = findByType(isType2 ? 'อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)' : 'อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)');
    else ruleHit = findByType(isType2 ? 'อาคารท่อระบายน้ำแบบที่ 2' : 'อาคารท่อระบายน้ำแบบที่ 1');
  } else if (hasInlet) {
    ruleHit = findByType(isType2 ? 'อาคารรับน้ำแบบที่ 2' : 'อาคารรับน้ำแบบที่ 1');
  } else if (hasDrop) {
    ruleHit = findByType('อาคารลดระดับ');
  }

  if (ruleHit) {
    return { matchedType: ruleHit.type, entry: ruleHit, extractedH, extractedRemark };
  }

  // 3) เปรียบเทียบความใกล้เคียงของชื่อ (Similarity) กับรายการใน Typeอาคารประกอบ
  const targetNorm = norm(cleaned);
  let bestEntry = null;
  let bestScore = 0;
  db.forEach(e => {
    const candNorm = norm(e.type);
    let score = computeThaiStringSimilarity(targetNorm, candNorm);
    const fullScore = computeThaiStringSimilarity(cleaned, e.type);
    if (fullScore > score) score = fullScore;
    if (candNorm.includes(targetNorm) || targetNorm.includes(candNorm)) {
      score = Math.max(score, 0.72);
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = e;
    }
  });

  if (bestEntry && bestScore >= 0.48) {
    return { matchedType: bestEntry.type, entry: bestEntry, extractedH, extractedRemark };
  }

  return { matchedType: cleaned || raw, entry: null, extractedH, extractedRemark };
}

// แยกอาคารที่มี "และ" หรือ "," เป็น 2+ อาคาร คนละแถว กม. เดียวกัน เรียงตามลำดับในแบบ
// และใส่ค่า H เฉพาะที่อาคารที่มีค่า H ตามตารางในแท็บย่อย Typeอาคารประกอบ (hEditable === true)
function aiSplitAndNormalizeStructures(rawStructures, rawLabels, levels) {
  const srcList = Array.isArray(rawStructures) ? rawStructures : [];
  const lvlList = Array.isArray(levels) ? levels : [];
  const lblList = Array.isArray(rawLabels) ? rawLabels : [];

  // รวบรวมค่า H ประจำ กม. จากทั้ง structures, levels และป้าย kind === 'h'
  const hByKm = new Map();
  const recordH = (kmVal, hVal) => {
    const k = aiNum(kmVal, null);
    const h = aiNum(hVal, null);
    if (k === null || h === null || h <= 0) return;
    const key = Math.round(k * 100) / 100;
    if (!hByKm.has(key) || h > hByKm.get(key)) hByKm.set(key, h);
  };

  lvlList.forEach(lv => {
    if (lv) recordH(lv.kmStart, lv.h);
  });
  srcList.forEach(s => {
    if (!s) return;
    recordH(s.km, s.h);
    const m = String(s.name || '').match(/h\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (m) recordH(s.km, parseFloat(m[1]));
  });

  // ถอดป้าย station + structure + h ในกลุ่มเดียวกัน เผื่อ AI ส่งชื่ออาคารที่มี "และ"/"," มาในป้าย
  const byGrp = new Map();
  lblList.forEach(lb => {
    if (!lb || !lb.group) return;
    if (!byGrp.has(lb.group)) byGrp.set(lb.group, []);
    byGrp.get(lb.group).push(lb);
  });
  byGrp.forEach(members => {
    const st = members.find(m => m.kind === 'station');
    const hLb = members.find(m => m.kind === 'h');
    const km = st ? parseChainageKm(st.text) : null;
    if (km !== null && hLb) {
      recordH(km, aiNum(hLb.text, null));
    }
  });

  const expanded = [];
  let seqCounter = 0;

  srcList.forEach(s => {
    if (!s) return;
    const km = aiNum(s.km, 0);
    const rawName = aiStr(s.name, '');
    if (!rawName) return;

    const parts = splitCompoundStructureText(rawName);
    const namesToProcess = parts.length > 0 ? parts : [rawName];

    namesToProcess.forEach(partName => {
      const matched = matchStructureTypeFromDatabase(partName);
      if (matched.extractedH) recordH(km, matched.extractedH);
      expanded.push({
        km: km,
        name: matched.matchedType,
        _entry: matched.entry,
        _rawH: aiNum(s.h, matched.extractedH !== null ? matched.extractedH : ''),
        pipeDia: aiNum(s.pipeDia, 0),
        pipeCount: aiNum(s.pipeCount, 0),
        remark: aiStr(s.remark, matched.extractedRemark || ''),
        _seqOrder: seqCounter++
      });
    });
  });

  // เรียงตาม กม. แต่ถ้า กม. เดียวกัน ให้เรียงตามลำดับในแบบ (_seqOrder)
  expanded.sort((a, b) => {
    const ka = Number(a.km) || 0;
    const kb = Number(b.km) || 0;
    if (Math.abs(ka - kb) > 0.001) return ka - kb;
    return a._seqOrder - b._seqOrder;
  });

  // จัดสรรค่า H ให้เฉพาะอาคารที่มีค่า H ใน Typeอาคารประกอบ (entry.hEditable === true)
  return expanded.map(item => {
    const entry = item._entry || ((typeof getStructureTypeEntry === 'function') ? getStructureTypeEntry(item.name) : null);
    const kmKey = Math.round((Number(item.km) || 0) * 100) / 100;
    let stationH = (item._rawH !== '' && item._rawH !== null && Number(item._rawH) > 0)
      ? Number(item._rawH)
      : (hByKm.has(kmKey) ? hByKm.get(kmKey) : '');

    // ตรวจจากตาราง Typeอาคารประกอบ ว่าอาคารนี้มีค่า H หรือไม่
    const hasHInTypeTable = entry ? (entry.hEditable === true) : /ลดระดับ|ท่อลอดทางข้าม|เปลี่ยนลาด/.test(item.name);
    const finalH = (hasHInTypeTable && stationH !== '' && stationH !== null && Number(stationH) > 0)
      ? Number(Number(stationH).toFixed(2))
      : '';

    // ศก. ท่อ และความยาว: ใส่เฉพาะอาคารที่แก้ไขได้ตามตาราง Typeอาคารประกอบ
    // หมายเหตุ: ถ้า AI ส่งค่า 0 (ไม่ได้ระบุ) -> เก็บเป็น 0 ไว้ เพื่อให้ "0 ไม่ทับค่าตาราง"
    //   (ค่าเริ่มต้นจากตาราง Typeอาคารประกอบจะถูกนำไปแสดงตอนเรนเดอร์แทน)
    let finalDia = item.pipeDia;
    let finalLen = item.pipeCount;
    if (entry) {
      if (!entry.diaEditable) finalDia = 0;
      if (!entry.lenEditable) finalLen = 0;
    }

    return {
      km: item.km,
      name: item.name,
      h: finalH,
      pipeDia: finalDia,
      pipeCount: finalLen,
      remark: item.remark,
      _seqOrder: item._seqOrder,
      _hasHInTypeTable: hasHInTypeTable
    };
  });
}

// ---------- รอบ 35: ตรวจว่ากลุ่มป้ายค่าระดับนี้อยู่ที่ "กม. 0" หรือไม่ ----------
//   ใช้ได้ทั้งกรณีที่ป้าย "กม." อยู่ในกลุ่มเดียวกัน และกรณีที่ป้าย กม. แยกกลุ่มอยู่ใกล้ ๆ
//   เกณฑ์: ป้าย กม. ต้องมีค่า 0 (0+000 / 0 / 0.00) และอยู่ใกล้แนวตั้งของกลุ่มป้ายค่าระดับ
function aiIsStationZeroLabelGroup(elevMembers, extraMembers) {
  const list = (Array.isArray(elevMembers) ? elevMembers : []);
  if (!list.length) return false;

  // 1) หา "กม." ที่อยู่ในกลุ่มเดียวกัน (บางครั้ง AI ใส่มาใน group เดียวกัน)
  const stationsInGroup = list.filter(m => m && m.kind === 'station');
  const checkStations = (stations) => {
    for (const st of stations) {
      if (!st) continue;
      const km = parseChainageKm(st.text);
      if (km !== null && Math.abs(km) < 0.5) return true;
    }
    return false;
  };
  if (checkStations(stationsInGroup)) return true;

  // 2) ดูป้าย กม. ที่แยกกลุ่มแต่อยู่ใกล้แนวตั้ง (ด้านบน/ล่าง) ของกลุ่มค่าระดับ
  const extra = (Array.isArray(extraMembers) ? extraMembers : []);
  if (extra.length) {
    const ys = list.map(m => Number(m.y) || 0);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const nearStations = extra.filter(m => {
      if (!m || m.kind !== 'station') return false;
      const y = Number(m.y);
      if (!isFinite(y)) return false;
      return y <= maxY + 0.10 && y >= minY - 0.16;
    });
    if (checkStations(nearStations)) return true;
  }
  return false;
}

// ---------- รอบ 32: รวมข้อความของป้ายกลุ่มเดียวกันให้อยู่ในป้ายเดียว ----------
//   members = [{ kind, text, x, y, angle }]
//   คืนค่า { text, kind, x, y, angle } โดย text ใช้ "\n" คั่นบรรทัด
// ---------- รอบ 35: ป้ายทั้งหมดในบริบทปัจจุบัน (ใช้ตรวจว่ากลุ่มค่าระดับอยู่ที่ กม. 0 หรือไม่) ----------
let aiCurrentLabelContext = [];

function aiMergeLabelGroup(members) {
  const list = (Array.isArray(members) ? members : []).filter(m => m && String(m.text || '').trim());
  if (!list.length) return null;

  // kind หลักของป้ายที่รวม = kind ที่สำคัญที่สุดในกลุ่ม
  let primaryKind = list[0].kind;
  if (list.some(m => m.kind === 'structure')) primaryKind = 'structure';
  else if (list.some(m => m.kind === 'elev')) primaryKind = 'elev';
  else if (list.some(m => m.kind === 'station')) primaryKind = 'station';

  // กรณีป้ายของ 3 ระดับ (kind === 'elev'):
  //   - เรียงจากบรรทัดบนลงล่างตามแกน Y
  //   - ให้ตำแหน่งแสดงป้ายอยู่ "หลังค่าระดับ" (ทางขวาของตัวเลขระดับในแบบ)
  //   - ให้ความสูงของบรรทัดแรกอยู่ในระดับเดียวกับแถวแรกเสมอ (firstRowY)
  //   - รอบ 35: ถ้ากลุ่มนี้อยู่ที่ "กม. 0" ให้เหลือแค่ 2 ค่า / "กม. อื่นๆ" ให้แสดง 3 ค่า
  if (primaryKind === 'elev') {
    const elevSorted = list.slice().sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
    const firstRowY = Number(elevSorted[0].y) || 0;
    const maxX = Math.max.apply(null, elevSorted.map(m => Number(m.x) || 0));
    // รอบ 35: เลื่อนป้ายไปทางขวาอีก 1 ตัวอักษร (หลังค่าระดับ)
    const behindX = Math.min(0.96, maxX + 0.022 + 0.014);
    // รอบ 35: กฎจำนวนค่าระดับ — กม. 0 → 2 ค่า / กม. อื่น → 3 ค่า
    const contextLabels = (Array.isArray(aiCurrentLabelContext) && aiCurrentLabelContext.length)
      ? aiCurrentLabelContext : list;
    const atStationZero = aiIsStationZeroLabelGroup(elevSorted, contextLabels);
    const maxRows = atStationZero ? 2 : 3;
    let elevParts = elevSorted.map(m => String(m.text).trim()).filter(Boolean);
    if (elevParts.length > maxRows) elevParts = elevParts.slice(0, maxRows);
    return {
      text: elevParts.join('\n'),
      kind: 'elev',
      x: behindX,
      y: firstRowY,
      boxCenterX: behindX,
      boxCenterY: firstRowY,
      firstRowY: firstRowY,
      anchorTopRow: true,
      align: 'left',
      angle: 0
    };
  }

  if (list.length === 1) {
    const m = list[0];
    let txt = String(m.text).trim();
    if (m.kind === 'structure') {
      const sp = splitCompoundStructureText(txt).map(p => matchStructureTypeFromDatabase(p).matchedType);
      if (sp.length > 0) txt = sp.join('\n');
    }
    return { text: txt, kind: m.kind, x: m.x, y: m.y, boxCenterX: m.x, boxCenterY: m.y, angle: m.angle || 0 };
  }

  // เรียงลำดับตาม kind ให้อ่านง่าย (กม. → อาคาร → H → ค่าระดับ)
  const sorted = list.slice().sort((a, b) => {
    const ia = AI_LABEL_KIND_ORDER.indexOf(a.kind);
    const ib = AI_LABEL_KIND_ORDER.indexOf(b.kind);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const parts = [];
  sorted.forEach(m => {
    let t = String(m.text).trim();
    if (m.kind === 'station' && !/^กม\.?\s*/i.test(t)) t = 'กม. ' + t;
    else if (m.kind === 'structure') {
      const sp = splitCompoundStructureText(t).map(p => matchStructureTypeFromDatabase(p).matchedType);
      if (sp.length > 0) t = sp.join('\n');
    } else if (m.kind === 'h' && !/^h\s*=/i.test(t)) {
      t = 'H=' + t;
    }
    parts.push(t);
  });

  // ตำแหน่งป้าย: ใช้ตำแหน่งป้าย "กม." เป็นจุดยึด (ถ้ามี) มิฉะนั้นใช้ค่าเฉลี่ย
  const anchor = sorted.find(m => m.kind === 'station') || sorted[0];
  const avgX = list.reduce((s, m) => s + (Number(m.x) || 0), 0) / list.length;
  const avgY = list.reduce((s, m) => s + (Number(m.y) || 0), 0) / list.length;
  const hasStation = sorted.some(m => m.kind === 'station');

  return {
    text: parts.join('\n'),
    kind: primaryKind,
    x: hasStation ? anchor.x : avgX,
    y: hasStation ? anchor.y : avgY,
    boxCenterX: avgX,
    boxCenterY: avgY,
    angle: anchor.angle || 0
  };
}

// ---------- รอบ 32: จัดกลุ่มป้าย ----------
//   วิธีที่ 1 (หลัก): ใช้ฟิลด์ "group" ที่ AI ตอบมา
//   วิธีที่ 2 (สำรอง): จัดกลุ่มตามระยะห่างในภาพ (กลุ่มก้อนเดียวกัน) เผื่อ AI ไม่ได้ใส่ group
function aiGroupOverlayLabels(labels) {
  const list = (Array.isArray(labels) ? labels : []).filter(l => l && String(l.text || '').trim());
  // รอบ 35: เก็บป้ายทั้งหมดไว้เป็นบริบท เพื่อให้กลุ่มค่าระดับตรวจได้ว่าอยู่ที่ "กม. 0" หรือไม่
  aiCurrentLabelContext = list.slice();
  if (list.length <= 1) return list.map(l => aiMergeLabelGroup([l])).filter(Boolean);

  // ── วิธีที่ 1: group จาก AI ──
  const byGroup = new Map();
  const noGroup = [];
  list.forEach(l => {
    const g = String(l.group || '').trim();
    if (!g) { noGroup.push(l); return; }
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(l);
  });

  const merged = [];
  byGroup.forEach((members, g) => {
    const m = aiMergeLabelGroup(members);
    if (m) { m.group = g; merged.push(m); }
  });

  // ── วิธีที่ 2: จัดกลุ่มตามระยะห่าง (เฉพาะที่ AI ไม่ได้ใส่ group) ──
  //   เกณฑ์: ระยะในพิกัดสัดส่วน 0..1 ไม่เกิน 0.08 → ถือว่าเป็นกลุ่มเดียวกัน
  //   แยกชนิด: กลุ่มอาคาร (station/structure/h) กับ กลุ่มค่าระดับ (elev) ไม่รวมกัน
  const GROUP_DIST = 0.08;
  const STRUCT_KINDS = ['station', 'structure', 'h'];
  const groups = [];
  noGroup.forEach(l => {
    const bucket = (l.kind === 'elev') ? 'elev' : (STRUCT_KINDS.indexOf(l.kind) >= 0 ? 'struct' : 'other');
    if (bucket === 'other') { groups.push([l]); return; }
    let found = null;
    for (const g of groups) {
      if (g._bucket !== bucket) continue;
      const near = g.some(m => {
        const dx = Math.abs((Number(m.x) || 0) - (Number(l.x) || 0));
        const dy = Math.abs((Number(m.y) || 0) - (Number(l.y) || 0));
        return Math.hypot(dx, dy) <= GROUP_DIST;
      });
      if (near) { found = g; break; }
    }
    if (found) found.push(l);
    else {
      const g = [l];
      g._bucket = bucket;
      groups.push(g);
    }
  });

  groups.forEach(g => {
    const members = g.filter(x => x && !x._bucket);
    if (!members.length) return;
    const m = aiMergeLabelGroup(members);
    if (m) merged.push(m);
  });

  return merged;
}

// ---------- รอบ 32: ให้เส้นระดับต่อจาก กม.เริ่มต้น ถึง กม.สิ้นสุด ----------
//   ใช้ตำแหน่งป้าย "กม." (station) ที่ AI อ่านได้ เป็นจุดยึดของปลายเส้น
//   วิธี: หาป้าย กม. ที่ใกล้เคียงที่สุด → ถ้าไม่มีพอดี ให้เชื่อมแบบเส้นตรงระหว่างป้าย กม. ที่อยู่รอบ ๆ
function aiResolveLevelLineEndpoints(levelLines, labels) {
  const lines = (Array.isArray(levelLines) ? levelLines : []).map(l => Object.assign({}, l));
  const stations = (Array.isArray(labels) ? labels : [])
    .filter(l => l && l.kind === 'station')
    .map(l => ({ km: parseChainageKm(l.text), x: l.x, y: l.y }))
    .filter(s => s.km !== null && typeof s.x === 'number' && typeof s.y === 'number')
    .sort((a, b) => a.km - b.km);

  if (!stations.length) return lines;

  // หาตำแหน่งบนเส้น "กม." สำหรับระยะทางที่ถามมา (interpolate ได้)
  const locate = (targetKm) => {
    // จุดที่ตรงพอดี
    for (const s of stations) {
      if (Math.abs(s.km - targetKm) < 0.5) return { x: s.x, y: s.y };
    }
    // อยู่ระหว่างสองป้าย → คำนวณสัดส่วนแล้วเชื่อมเส้นตรง
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1];
      if (targetKm > a.km && targetKm < b.km) {
        const t = (targetKm - a.km) / (b.km - a.km);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    // นอกช่วง → ใช้ป้ายที่ใกล้ที่สุด แต่ต้องไม่ไกลเกิน 20% ของช่วงทั้งหมด
    const span = (stations[stations.length - 1].km - stations[0].km) || 1;
    let best = null, bestD = Infinity;
    stations.forEach(s => {
      const d = Math.abs(s.km - targetKm);
      if (d < bestD) { bestD = d; best = s; }
    });
    if (best && bestD <= span * 0.2) return { x: best.x, y: best.y };
    return null;
  };

  lines.forEach(l => {
    const kmStart = aiNum(l.kmStart, null);
    const kmEnd = aiNum(l.kmEnd, null);
    if (kmStart === null || kmEnd === null) return;
    const p1 = locate(kmStart);
    const p2 = locate(kmEnd);
    if (p1) { l.x1 = p1.x; l.y1 = p1.y; }
    if (p2) { l.x2 = p2.x; l.y2 = p2.y; }
    // ยังไม่มีปลายทาง → ต่อจากจุดเริ่มไปตามทิศเดิมของเส้น
    if (!p2 && p1 && typeof l.x2 === 'number' && typeof l.y2 === 'number') {
      const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
      const len = Math.hypot(dx, dy) || 1;
      l.x2 = l.x1 + (dx / len) * 0.25;
      l.y2 = l.y1 + (dy / len) * 0.25;
    }
  });

  return lines;
}

// ---------- สร้าง prompt ----------
function buildAiSystemPrompt() {
  return `คุณเป็นผู้เชี่ยวชาญด้านงานชลประทาน อ่านแผนผังรูปตัดตามยาวคูส่งน้ำจากภาพและคืนค่าเป็น JSON เท่านั้น

กฎสำคัญ:
1. ตอบกลับเป็น JSON object เท่านั้น ห้ามมีข้อความอื่น และห้ามใส่ markdown code fence
2. พิกัด x,y ทุกตัวต้องเป็น "สัดส่วน 0..1" ของภาพ (0 = ซ้ายสุด, 1 = ขวาสุด, 0 = บนสุด, 1 = ล่างสุด)
3. กฎสเกลตารางกราฟมาตรฐานของแปลนรูปตัดตามยาว (สำคัญมากสำหรับจุด P1 และ P2):
   - ค่าระดับ (แกนตั้ง Y): ห่างกัน 1 ช่องตาราง = ค่าระดับห่างกัน 1.00 เมตร (เช่น +250.00, +251.00, +252.00, +253.00, +254.00 โดยค่าระดับเพิ่มขึ้นจากล่างขึ้นบน)
   - ค่า กม. (แกนนอน X): ห่างกัน 1 ช่องตารางหลัก = ระยะห่างกัน 100 เมตร (เช่น 0+000, 0+100, 0+200, ..., 0+800)
   - refPoints.p1 = จุดตัดเส้นตารางมุมซ้ายล่างของกราฟรูปตัดตามยาว (เช่น กม.เริ่มต้น 0+000 ที่เส้นระดับล่างสุดของตาราง เช่น +250.00)
   - refPoints.p2 = จุดตัดเส้นตารางมุมขวาบนของกราฟรูปตัดตามยาว (เช่น กม.สิ้นสุดของคู ที่เส้นระดับบนสุดของตาราง เช่น +254.00 โดย p2.elev ต้องมากกว่า p1.elev เสมอ และห่างกันช่องละ 1 เมตร)
4. ชื่อคูส่งน้ำ (ditch): ให้ใส่เฉพาะตัวเลขรหัสคูเท่านั้น เช่น "01", "02", "04", "04-1" (ตัดคำว่า "คูส่งน้ำ", "สาย" ออก)
5. เส้นดินเดิม (ground และ groundLine):
   - ต้องอ่านเส้นดินเดิม (เส้นหยักระดับดินธรรมชาติในกราฟ) มาเสมอ ทั้งใน channels[].ground ([{ "km": ..., "groundElevation": ..., "x": ..., "y": ... }]) และใน groundLine ([{ "x": ..., "y": ..., "km": ..., "elev": ... }]) ตามจุดหักเหของเส้นดินเดิมตั้งแต่ต้นคูถึงปลายคู
6. ตารางระดับคูส่งน้ำ (channels[].level) และ อาคารประกอบ (channels[].structures):
   - ให้แบ่งช่วง (kmStart -> kmEnd) เฉพาะตามจุด กม. ที่มีค่า H (เช่น อาคารลดระดับที่มี H=0.20, H=0.30 หรือจุดเริ่มต้น/สิ้นสุดคู)
   - อาคารที่ไม่มีค่า H (เช่น อาคารปากคูซอย, บานอัดน้ำ ที่ไม่มี H) ไม่ต้องนำมาตัดแบ่งช่วงในตาราง level
   - ข้อมูลอาคารประกอบ (structures): ถ้าที่จุด กม. เดียวกันอ่านเจอคำว่า "และ" หรือ "," (เช่น "บานอัดน้ำ และ อาคารลดระดับ" หรือ "อาคารปากคูซอย, อาคารลดระดับ") ให้แยกออกเป็น 2 อาคารคนละแถว ใช้ค่า กม. เดียวกัน เรียงตามลำดับที่ปรากฏในแบบ
   - ชื่ออาคารให้ใช้ชื่อตามรายการมาตรฐานใน Typeอาคารประกอบ ได้แก่: "อาคารท่อส่งน้ำเข้านา (เดิม)", "อาคารท่อส่งน้ำเข้านา (ใหม่)", "ปลายคู", "อาคารปลายคูส่งน้ำแบบที่ 1", "อาคารปลายคูส่งน้ำแบบที่ 2", "อาคารปากคูซอย", "อาคารปากคูซอยแบบที่ 1", "อาคารปากคูซอยแบบที่ 2", "อาคารท่อลอดถนน", "อาคารท่อลอดถนนลดระดับ", "อาคารท่อลอดทางข้าม", "อาคารแผ่นพื้นทางข้าม", "อาคารน้ำตกลดระดับ", "อาคารลดระดับ", "บานอัดน้ำ", "อาคารรับน้ำแบบที่ 1", "อาคารรับน้ำแบบที่ 2", "อาคารเปลี่ยนลาดทางเข้า", "อาคารเปลี่ยนลาดทางออก", "อาคารสะพานน้ำแบบที่ 1", "อาคารสะพานน้ำแบบที่ 2", "อาคารท่อระบายน้ำแบบที่ 1", "อาคารท่อระบายน้ำแบบที่ 2", "อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)", "อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)"
   - ค่า H ให้ใส่เฉพาะที่อาคารที่มีค่า H ตามตาราง Typeอาคารประกอบเท่านั้น (ได้แก่ อาคารลดระดับ, อาคารน้ำตกลดระดับ, อาคารท่อลอดถนนลดระดับ, อาคารท่อลอดทางข้าม, อาคารเปลี่ยนลาดทางเข้า, อาคารเปลี่ยนลาดทางออก) ส่วนอาคารอื่นใส่ h: 0
7. labels คือข้อความที่มีอยู่จริงในภาพ พร้อมตำแหน่ง x,y ที่ทับข้อความนั้นพอดี (ยกเว้นเส้นดินเดิมในกราฟไม่ต้องใส่ป้ายค่าระดับ):
   - ห้ามใส่ค่าระดับประจำเส้นตารางแกนตั้งซ้ายสุด (เช่น +250.00, +251.00 ที่ขอบซ้าย) ลงใน labels
   - ห้ามใส่ค่า F.S.L. (เช่น F.S.L. +252.95) และห้ามใส่สัญลักษณ์จุดดำ ● ในข้อความ
   - kind หนึ่งใน: station | structure | h | elev | slope | level | p1 | p2
     · station = ข้อความระยะทางรูปแบบ "0+050" หรือ "0+000" (อยู่แถบด้านบนเหนือกราฟ)
     · structure = ชื่ออาคารประกอบที่อยู่แถบด้านบนของแปลน
     · h = ค่า H ของอาคาร (เช่น "0.20")
     · elev = ป้าย 3 ระดับ (ระดับหลังคันคู, ระดับดินเดิม, ระดับก้นคู เช่น "252.86", "252.38", "252.36" ที่ปลายหางเส้นชี้ระดับ)
     · slope = ข้อความความลาดชัน เช่น "S=1:1000" หรือ "S 1:1000" (วางอยู่เหนือเส้นระดับ)
   - group = รหัสกลุ่ม (string) สำหรับป้ายที่อยู่ในก้อนเดียวกัน:
     · ป้ายกลุ่มอาคารด้านบน (station + ชื่ออาคาร + H) ใช้ group เดียวกัน เช่น "g1"
     · ป้ายกลุ่ม 3 ระดับ (elev 3 ค่าที่จุดเดียวกัน) ใช้ group เดียวกัน เช่น "g2"
8. levelLines คือเส้นระดับน้ำ/ก้นคู (type = "BL" หรือ "TBL")
   - kmStart / kmEnd = ระยะทางเริ่มต้นและสิ้นสุดของเส้นนั้น (ตัวเลขเมตร) ให้เชื่อมเส้นต่อจาก กม.เริ่มต้น ถึง กม.สิ้นสุด

โครงสร้าง JSON ที่ต้องตอบ (ตัวอย่าง):
${AI_RESULT_SCHEMA_EXAMPLE}`;
}

function buildAiUserPrompt(frameName, existingChannels) {
  let ctx = '';
  if (Array.isArray(existingChannels) && existingChannels.length > 0) {
    const list = existingChannels.slice(0, 40).map(c => `- ${c.canal || 'คลอง'} / ${c.ditch || '-'}`).join('\n');
    ctx = `\n\nชุดข้อมูล (คูส่งน้ำ) ที่มีอยู่ในโปรเจกต์นี้แล้ว:\n${list}\n\nถ้าคูในภาพตรงกับชุดข้อมูลที่มีอยู่ ให้ใช้ชื่อ "คลองส่งน้ำ" และ "คูส่งน้ำ" ให้ตรงกันทุกตัวอักษร`;
  }
  return `อ่านข้อมูลจากภาพแปลนนี้ (ชื่อ: ${frameName || 'รูปภาพ'}) แล้วตอบเป็น JSON ตามโครงสร้างที่กำหนด${ctx}`;
}

// ---------- ย่อภาพตามคุณภาพที่เลือก ----------
const AI_QUALITY_PX = { '1400': 1400, '2400': 2400, '3500': 3500 };

function downscaleImageForQuality(dataUrl, quality) {
  const maxSide = AI_QUALITY_PX[String(quality)] || 1400;
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const im = new Image();
    im.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        if (k >= 1) return resolve({ dataUrl: dataUrl, width: im.width, height: im.height });
        const w = Math.max(1, Math.round(im.width * k));
        const h = Math.max(1, Math.round(im.height * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        resolve({ dataUrl: c.toDataURL('image/jpeg', 0.9), width: im.width, height: im.height });
      } catch (_) { resolve({ dataUrl: dataUrl, width: im.width, height: im.height }); }
    };
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}

// ---------- เรียก API ----------
// รองรับทั้ง endpoint แบบเต็ม (/chat/completions) และแบบย่อ (ค่าที่ตั้งมาเป็น /v1 แล้วให้เติมให้เอง)
function buildAiChatEndpoint(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return 'https://api.openai.com/v1/chat/completions';
  if (/\/chat\/completions$/.test(base)) return base;
  return base + '/chat/completions';
}

// ---------- เดาชื่อผู้ให้บริการจาก Base URL ----------
//   รอบ 31: ข้อความ error เคย hardcode "Lovable" (จากตอนโปรเจกต์ใช้ Lovable gateway)
//   → ตอนนี้ใช้ OpenAI แล้วข้อความยังบอกให้ไปแก้ที่ Lovable → สับสน
//   แก้โดยเดาชื่อเจ้าให้บริการจาก URL จริง และใส่ลิงก์ไปหน้า Billing ที่ถูกต้อง
function detectAiProviderName(baseUrl) {
  const u = String(baseUrl || '').toLowerCase();
  if (!u) return 'ผู้ให้บริการ AI';
  if (u.indexOf('api.openai.com') >= 0) return 'OpenAI';
  if (u.indexOf('anthropic.com') >= 0) return 'Anthropic (Claude)';
  if (u.indexOf('generativelanguage.googleapis.com') >= 0 || u.indexOf('gemini') >= 0) return 'Google Gemini';
  if (u.indexOf('api.groq.com') >= 0) return 'Groq';
  if (u.indexOf('openrouter.ai') >= 0) return 'OpenRouter';
  if (u.indexOf('mistral') >= 0) return 'Mistral';
  if (u.indexOf('lovable.dev') >= 0 || u.indexOf('lovable') >= 0) return 'Lovable';
  if (u.indexOf('azure.com') >= 0) return 'Azure OpenAI';
  if (u.indexOf('openai') >= 0) return 'OpenAI';
  return 'ผู้ให้บริการ AI';
}

// ลิงก์หน้า Billing / แจ้งชำระเงิน ของผู้ให้บริการที่รู้จัก
function getAiProviderBillingUrl(baseUrl) {
  const u = String(baseUrl || '').toLowerCase();
  if (u.indexOf('api.openai.com') >= 0 || u.indexOf('openai') >= 0) {
    return 'https://platform.openai.com/settings/organization/billing/overview';
  }
  if (u.indexOf('lovable') >= 0) return 'https://lovable.dev/settings/billing';
  if (u.indexOf('openrouter.ai') >= 0) return 'https://openrouter.ai/settings/credits';
  if (u.indexOf('generativelanguage.googleapis.com') >= 0) return 'https://aistudio.google.com/';
  if (u.indexOf('anthropic.com') >= 0) return 'https://console.anthropic.com/settings/billing';
  return '';
}

// ---------- แปลง error จาก API เป็นข้อความที่เข้าใจง่าย + บอกทางแก้ไข ----------
//   API หลายเจ้าคืน error เป็น JSON ยาว ๆ (เช่น billing_not_active, invalid_api_key)
//   ดิบ ๆ แล้วอ่านยากมาก → จับกรณีที่พบบ่อยมาแปลงเป็นภาษาไทย + แนะนำการแก้ไข
//   รอบ 31: เพิ่มพารามิเตอร์ baseUrl เพื่อบอกชื่อผู้ให้บริการ + ลิงก์ Billing ที่ถูกต้อง
function describeAiApiError(status, detailText, modelName, baseUrl) {
  const raw = String(detailText || '');
  let code = '';
  let message = '';

  // พยายามอ่าน code/message จาก JSON ที่ API คืนมา (ลองหลายรูปแบบ)
  try {
    const j = JSON.parse(raw);
    if (j && j.error) {
      if (typeof j.error.code === 'string') code = j.error.code;
      if (typeof j.error.message === 'string') message = j.error.message;
      if (!code && typeof j.error.type === 'string') code = j.error.type;
    }
  } catch (_) {
    // ไม่ใช่ JSON → ใช้ regex ดึง code ที่อยู่ในรูป "code": "xxx"
    const m = raw.match(/"(?:code|type)"\s*:\s*"([a-zA-Z0-9_\-]+)"/);
    if (m) code = m[1];
    const m2 = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (m2) message = m2[1];
  }

  const lower = (code + ' ' + message + ' ' + raw).toLowerCase();

  // ── กรณีที่พบบ่อย: แปลงเป็นคำแนะนำที่ทำได้จริง ──
  //   ⚠️ ลำดับสำคัญ: ตรวจ billing ก่อน rate-limit
  //   เพราะบางเจ้าคืน status 429 พร้อม billing_not_active (ไม่ใช่โควตาหมด)
  //   รอบ 31: ใช้ชื่อผู้ให้บริการจริงจาก Base URL (ไม่ hardcode "Lovable" แล้ว)
  const providerName = detectAiProviderName(baseUrl);
  const billingUrl = getAiProviderBillingUrl(baseUrl);
  if (/billing_not_active|account is not active|billing|invoice|payment|credit balance|insufficient/i.test(lower)) {
    const billingLine = billingUrl
      ? '• เปิดหน้าชำระเงินของ ' + providerName + ':\n   ' + billingUrl + '\n'
      : '• เปิดหน้า Billing / Plans ของ ' + providerName + '\n';
    return 'บัญชีของ ' + providerName + ' ยังไม่ active (ชำระเงินไม่สมบูรณ์)\n\n' +
           '❌ แก้ที่เว็บของ ' + providerName + ' เท่านั้น — เว็บนี้แก้ไม่ได้\n' +
           billingLine +
           '• เลือกแพ็กเกจที่ใช้งานได้ หรือเติมเครดิต\n' +
           '• ถ้าเติมแล้วยัง error → ติดต่อผู้ให้บริการ (อาจต้องเปิดสิทธิ์ใช้งานโปรเจกต์ใหม่)\n\n' +
           '💡 ทางเลือก: เปลี่ยน Base URL / Model ใน ⚙️ ตั้งค่า AI ไปใช้ผู้ให้บริการอื่นที่บัญชีใช้งานได้';
  }
  if (status === 401 || /invalid_api_key|unauthorized|incorrect api key|invalid authentication/i.test(lower)) {
    return 'API key ไม่ถูกต้อง (หรือหมดอายุ)\n\n' +
           '• เปิด ⚙️ ตั้งค่า AI แล้วใส่ API key ใหม่\n' +
           '• ตรวจว่าคัดลอก key มาครบ (ไม่มีช่องว่างท้ายสุด)';
  }
  if (status === 429 || /rate.limit|too many requests|quota/i.test(lower)) {
    return 'ยิง API ถี่เกินไป (โควตาหมด)\n\n' +
           '• รอสักครู่แล้วลองใหม่\n' +
           '• ถ้าใช้บ่อย ให้ลดคุณภาพภาพลงเหลือ 1400 px ใน ⚙️ ตั้งค่า AI\n' +
           '• ถ้ายัง error แปลว่าโควตาของ key หมดแล้ว — ต้องเติมโควตา';
  }
  if (status === 404 || /model.*not found|does not exist|unknown model|model_not_found/i.test(lower)) {
    return 'ไม่พบโมเดลที่เลือก (' + (modelName || 'ไม่ระบุ') + ')\n\n' +
           '• เปิด ⚙️ ตั้งค่า AI → กดปุ่ม "🔄 ดูโมเดล" เพื่อดูรายชื่อโมเดลที่ใช้ได้จริง แล้วคลิกเลือก\n' +
           '• โมเดลที่อ่านรูปได้: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-5\n' +
           '• ตรวจสิทธิ์ของ API key ว่ามีสิทธิ์ใช้โมเดลนี้หรือไม่';
  }
  if (status === 403 || /forbidden|permission/i.test(lower)) {
    return 'ไม่มีสิทธิ์ใช้งาน (403)\n\n' +
           '• API key อาจไม่มีสิทธิ์ใช้โมเดลที่เลือก หรือถูกจำกัดสิทธิ์\n' +
           '• ลองเปลี่ยน Model ใน ⚙️ ตั้งค่า AI';
  }
  if (status === 413) {
    return 'ภาพใหญ่เกินไป (413)\n\n' +
           '• ลดคุณภาพภาพลง (1400 px) ใน ⚙️ ตั้งค่า AI';
  }
  if (status >= 500) {
    return 'เซิร์ฟเวอร์ของผู้ให้บริการ AI มีปัญหา (สถานะ ' + status + ')\n\n' +
           '• ไม่ใช่บั๊กของเว็บนี้ — ลองใหม่อีกครั้งในอีกสักครู่\n' +
           '• ถ้า error ต่อเนื่อง ให้ลองเปลี่ยนผู้ให้บริการ';
  }

  // ── ไม่เข้าเคสไหน → แสดงดิบแต่จัดรูปแบบให้อ่านง่าย ──
  const head = 'API error ' + status + (code ? ' (' + code + ')' : '');
  const detail = raw ? raw.slice(0, 400) : '(ไม่มีรายละเอียดเพิ่มเติม)';
  return head + '\n' + detail +
    '\n\nตรวจสอบ Base URL / Model / API key ใน ⚙️ ตั้งค่า AI' +
    '\n(รายละเอียดดิบจากเซิร์ฟเวอร์: ' + detail.replace(/\s+/g, ' ').slice(0, 200) + ')';
}

async function callAiVision(dataUrl, promptText, options) {
  const opts = options || {};
  if (typeof fetch !== 'function') throw new Error('เบราว์เซอร์ไม่รองรับ fetch');

  const settings = (typeof aiCurrentSettings !== 'undefined' && aiCurrentSettings) ? aiCurrentSettings : {};
  const apiKey = opts.apiKey || settings.apiKey || '';
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า API key ของ AI');

  const endpoint = buildAiChatEndpoint(opts.baseUrl || settings.baseUrl);
  const model = opts.model || settings.model || 'gpt-4o';

  const body = {
    model: model,
    messages: [
      { role: 'system', content: buildAiSystemPrompt() },
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const doFetch = async (withJsonMode) => {
    const payload = Object.assign({}, body);
    if (withJsonMode) payload.response_format = { type: 'json_object' };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      // รอบ 30: แปลง error ให้เป็นภาษาไทยที่บอกทางแก้ไขได้ แทนการโชว์ JSON ดิบ
      // รอบ 31: ส่ง baseUrl ไปด้วย เพื่อให้ข้อความบอกชื่อผู้ให้บริการที่ถูกต้อง
      const friendly = describeAiApiError(res.status, detail, model, opts.baseUrl || settings.baseUrl);
      const err = new Error(friendly);
      err.aiStatus = res.status;
      err.aiRaw = detail;
      throw err;
    }
    return res.json();
  };

  let json;
  try {
    json = await doFetch(true);
  } catch (e) {
    // บางเซิร์ฟเวอร์ไม่รองรับ response_format → ลองใหม่โดยไม่ใส่
    //   (ใช้ status + raw detail ตรวจ ไม่ใช้ regex กับข้อความที่แปลงเป็นภาษาไทยแล้ว)
    const st = (e && e.aiStatus) ? e.aiStatus : 0;
    const raw = (e && e.aiRaw) ? String(e.aiRaw) : '';
    const isBadRequest = st === 400 || /\b400\b/.test((e && e.message) ? e.message : '');
    const mentionsJsonMode = /response_format|json_object/i.test(raw);
    if (isBadRequest && mentionsJsonMode) {
      json = await doFetch(false);
    } else {
      throw e;
    }
  }

  const content = json && json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content : '';
  if (!content) throw new Error('API ไม่ได้ส่งเนื้อหากลับมา');
  return content;
}

// ---------- แปลงคำตอบ AI เป็นข้อมูล ----------
function parseAiJsonResponse(text) {
  if (!text) throw new Error('คำตอบ AI ว่างเปล่า');
  let s = String(text).trim();

  // ตัด markdown code fence ออก
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // ตัดวงเล็บปีกกา ที่อาจติดมาด้วย
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) s = s.slice(firstBrace, lastBrace + 1);

  let obj;
  try {
    obj = JSON.parse(s);
  } catch (e) {
    throw new Error('แปลงคำตอบ AI เป็น JSON ไม่สำเร็จ: ' + (e && e.message ? e.message : e));
  }
  return obj;
}

function aiNum(v, fallback) {
  if (v === null || v === undefined || v === '') return (fallback === undefined) ? null : fallback;
  if (typeof v === 'number') return isFinite(v) ? v : (fallback === undefined ? null : fallback);
  const cleaned = String(v).replace(/,/g, '').replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? (fallback === undefined ? null : fallback) : n;
}

function aiStr(v, fallback) {
  if (v === null || v === undefined) return (fallback === undefined) ? '' : fallback;
  const s = String(v).trim();
  return s === '' ? (fallback === undefined ? '' : fallback) : s;
}

// ทำให้ผลลัพธ์อยู่ในโครงสร้างที่แอปนำเข้าได้ (เติมค่าเริ่มต้นให้สมาชิกที่หายไป)
// รอบ 34: ชื่อคูส่งน้ำให้มีแต่ตัวเลข (เช่น "คูส่งน้ำ 01" -> "01", "สาย 04-1" -> "04-1")
function cleanDitchNumber(raw) {
  const s = aiStr(raw, '');
  if (!s || s === '-') return '-';
  let cleaned = s
    .replace(/คูส่งน้ำที่|คูส่งน้ำสายที่|คูส่งน้ำสาย|คูส่งน้ำ|คลองส่งน้ำ|สายที่|สาย|คูที่|คู|หมายเลข|เบอร์/gi, '')
    .trim();
  const m = cleaned.match(/\d+[A-Za-z0-9\-./]*/);
  if (m) return m[0].replace(/\s+/g, '');
  return cleaned || '-';
}

// รอบ 34: กรองข้อความที่ไม่ต้องแสดงบนรูปภาพ (ค่าระดับเส้นตารางแกนซ้าย / ค่า F.S.L. / จุดดำๆ)
function aiCleanLabelText(rawText) {
  if (rawText === null || rawText === undefined) return '';
  return String(rawText)
    .replace(/[●•⚫▪◆]/g, '')
    .replace(/^\s*\+\s*(?=\d)/, '')
    .trim();
}

function aiIsIgnoredOverlayLabel(l) {
  if (!l) return true;
  const raw = String(l.text || '').trim();
  if (!raw) return true;
  // ไม่แสดงค่า F.S.L. / FSL
  if (/f\s*\.?\s*s\s*\.?\s*l\.?/i.test(raw)) return true;
  // ไม่แสดงค่าระดับประจำเส้นตารางแกนซ้าย (เช่น +250.00, +251.00 ที่ขอบซ้าย หรือ kind === 'elev' เดี่ยวๆ ที่เป็นเลขจำนวนเต็ม .00 ชิดขอบซ้าย)
  if (l.kind === 'elev') {
    const nx = Number(l.x);
    const hasPlus = /^\s*\+\s*\d+(?:\.0+)?\s*$/.test(raw);
    const isRoundInt = /^\s*\+?\s*\d+\.00\s*$/.test(raw);
    if (hasPlus || (isRoundInt && isFinite(nx) && nx < 0.14 && !l.group)) return true;
  }
  return false;
}

// รอบ 34: ปรับเทียบจุด P1, P2 ให้ตรงตามสเกลตารางกราฟมาตรฐาน
//   - ค่าระดับห่างกันช่องละ 1.00 เมตร (P1 = เส้นตารางล่างสุด, P2 = เส้นตารางบนสุด โดย p2.elev > p1.elev)
//   - ค่า กม. ห่างกันช่องหลักละ 100 เมตร (P1 = กม.เริ่มต้น, P2 = กม.สิ้นสุด)
function aiCalibrateRefPoints(rp, channels, rawLabels) {
  const ch0 = (Array.isArray(channels) && channels[0]) ? channels[0] : null;
  const dim = (ch0 && ch0.dimension) ? ch0.dimension : {};
  let kmStart = aiNum(dim.kmStart, 0);
  let kmEnd = aiNum(dim.kmEnd, null);

  // หาช่วง กม. จากข้อมูลในช่องคูและป้าย station
  const allKms = [kmStart];
  if (kmEnd !== null && kmEnd > 0) allKms.push(kmEnd);
  if (ch0) {
    (ch0.ground || []).forEach(g => { const k = aiNum(g.km, null); if (k !== null) allKms.push(k); });
    (ch0.level || []).forEach(lv => {
      const ks = aiNum(lv.kmStart, null), ke = aiNum(lv.kmEnd, null);
      if (ks !== null) allKms.push(ks);
      if (ke !== null) allKms.push(ke);
    });
    (ch0.structures || []).forEach(s => { const k = aiNum(s.km, null); if (k !== null) allKms.push(k); });
  }
  (Array.isArray(rawLabels) ? rawLabels : []).forEach(lb => {
    if (lb && lb.kind === 'station') {
      const k = parseChainageKm(lb.text);
      if (k !== null) allKms.push(k);
    }
  });
  const minKm = allKms.length ? Math.min.apply(null, allKms) : 0;
  const maxKm = allKms.length ? Math.max.apply(null, allKms) : 100;
  kmStart = isFinite(minKm) ? minKm : 0;
  kmEnd = (isFinite(maxKm) && maxKm > kmStart) ? maxKm : (kmStart + 100);

  // รวบรวมค่าระดับทั้งหมดจากตารางเพื่อหาเส้นตารางล่างสุด (จำนวนเต็มเมตร) และบนสุด (ห่างช่องละ 1 เมตร)
  const allElevs = [];
  if (ch0) {
    (ch0.ground || []).forEach(g => { const e = aiNum(g.groundElevation, null); if (e !== null && e > 0) allElevs.push(e); });
    (ch0.level || []).forEach(lv => {
      ['bl1', 'tbl1', 'bl2', 'tbl2'].forEach(k => {
        const e = aiNum(lv[k], null);
        if (e !== null && e > 0) allElevs.push(e);
      });
    });
  }
  (Array.isArray(rawLabels) ? rawLabels : []).forEach(lb => {
    if (lb && lb.kind === 'elev') {
      const e = aiNum(lb.text, null);
      if (e !== null && e > 0 && e < 1000) allElevs.push(e);
    }
  });

  const p1In = (rp && rp.p1) ? rp.p1 : null;
  const p2In = (rp && rp.p2) ? rp.p2 : null;
  if (p1In && aiNum(p1In.elev, null) !== null) allElevs.push(aiNum(p1In.elev, 0));
  if (p2In && aiNum(p2In.elev, null) !== null) allElevs.push(aiNum(p2In.elev, 0));

  let p1Elev = p1In ? aiNum(p1In.elev, null) : null;
  let p2Elev = p2In ? aiNum(p2In.elev, null) : null;

  if (allElevs.length > 0) {
    const minE = Math.min.apply(null, allElevs);
    const maxE = Math.max.apply(null, allElevs);
    // เส้นตารางระดับมาตรฐานห่างกันช่องละ 1.00 เมตร (เช่น +250.00 ถึง +254.00)
    const gridFloor = Math.floor(minE);
    const gridCeil = Math.max(gridFloor + 4, Math.ceil(maxE));
    if (p1Elev === null || p2Elev === null || p1Elev >= p2Elev || (p1Elev % 1 !== 0) || (p2Elev % 1 !== 0)) {
      p1Elev = gridFloor;
      p2Elev = gridCeil;
    }
  } else {
    if (p1Elev === null) p1Elev = 100;
    if (p2Elev === null || p2Elev <= p1Elev) p2Elev = Math.floor(p1Elev) + 4;
  }

  // พิกัด X ของจุดเริ่มต้น (P1 = kmStart) และจุดสิ้นสุด (P2 = kmEnd):
  //   ระวัง: ป้ายข้อความ กม. สุดท้าย (เช่น 0+280 ที่อยู่ติดกับ 0+260) มักมีเส้นชี้ทแยงออกไปทางขวาเพื่อไม่ให้ตัวหนังสือทับกัน
  //   ถ้าเอา x ของป้ายข้อความสุดท้ายมาเป็น p2X โดยตรง จะทำให้เส้นระดับช่วงสุดท้ายยาวเกินจริงไปถึงขอบขวา!
  //   วิธีแก้: คำนวณอัตราส่วนสเกลแนวนอน (normX ต่อ 1 เมตร) จากช่วงหลักที่สอดคล้องกัน แล้วคำนวณ p2X = p1X + (kmEnd - kmStart) * rate
  const stationXs = (Array.isArray(rawLabels) ? rawLabels : [])
    .filter(lb => lb && lb.kind === 'station' && typeof lb.x === 'number')
    .map(lb => ({ km: parseChainageKm(lb.text), x: lb.x }))
    .filter(s => s.km !== null)
    .sort((a, b) => a.km - b.km);

  let p1X = (p1In && typeof p1In.x === 'number') ? p1In.x : 0.08;
  let p2X = (p2In && typeof p2In.x === 'number') ? p2In.x : 0.92;

  if (stationXs.length >= 1 && Math.abs(stationXs[0].km - kmStart) < 1) {
    p1X = stationXs[0].x;
  }

  if (stationXs.length >= 2 && kmEnd > kmStart) {
    // หา rate (normX / meter) ของแต่ละช่วงระหว่างป้าย กม.
    const segRates = [];
    for (let i = 0; i < stationXs.length - 1; i++) {
      const dKm = stationXs[i + 1].km - stationXs[i].km;
      const dX = stationXs[i + 1].x - stationXs[i].x;
      if (dKm > 0 && dX > 0) {
        segRates.push({ dKm, dX, rate: dX / dKm, endX: stationXs[i + 1].x, endKm: stationXs[i + 1].km });
      }
    }
    // ช่วงหลัก = ช่วงที่ยาว >= 60 ม. (หรือช่วงที่ยาวที่สุด) ซึ่งป้าย กม. ไม่โดนเบียดด้วยเส้นชี้ทแยง
    const mainSegs = segRates.filter(s => s.dKm >= 60);
    if (mainSegs.length > 0) {
      const totalMainKm = mainSegs.reduce((acc, s) => acc + s.dKm, 0);
      const totalMainX = mainSegs.reduce((acc, s) => acc + s.dX, 0);
      const mainRate = totalMainX / (totalMainKm || 1);
      const lastSt = stationXs[stationXs.length - 1];
      const lastSeg = segRates[segRates.length - 1];
      // ถ้าช่วงท้ายสั้น (< 60 ม.) และมีอัตราการกระโดดของ X สูงเกิน 1.25 เท่าของสเกลหลัก แปลว่าป้ายเยื้องตามเส้นชี้ทแยง
      if (lastSeg && lastSeg.dKm < 60 && lastSeg.rate > mainRate * 1.25) {
        p2X = p1X + (kmEnd - kmStart) * mainRate;
      } else if (Math.abs(lastSt.km - kmEnd) < 1) {
        // ตรวจว่าค่าเฉลี่ยรวมเพี้ยนจากสเกลหลักเกิน 1.20 เท่าหรือไม่
        const overallRate = (lastSt.x - p1X) / (kmEnd - kmStart);
        p2X = (overallRate > mainRate * 1.20) ? (p1X + (kmEnd - kmStart) * mainRate) : lastSt.x;
      } else {
        p2X = p1X + (kmEnd - kmStart) * mainRate;
      }
    } else {
      p2X = stationXs[stationXs.length - 1].x;
    }

    // รอบ 35: จุดเริ่มต้น (กม.ต้น) เคลื่อนในบางรูป เพราะยึดกับ "ตำแหน่งป้าย กม." ซึ่งมักถูกเลื่อนออกจากเส้นตาราง
    //   แก้โดยใช้การถดถอยเชิงเส้น (least squares) บนป้าย กม. ทั้งหมด
    //   แล้วคำนวณ p1X/p2X ใหม่จากสเกลที่ได้ → จุดเริ่มต้นไม่เคลื่อนตามความเลื่อนของป้าย
    if (stationXs.length >= 3) {
      const n = stationXs.length;
      let sumK = 0, sumX = 0, sumKK = 0, sumKX = 0;
      stationXs.forEach(s => { sumK += s.km; sumX += s.x; sumKK += s.km * s.km; sumKX += s.km * s.x; });
      const denom = (n * sumKK - sumK * sumK);
      if (Math.abs(denom) > 1e-9) {
        const slope = (n * sumKX - sumK * sumX) / denom;   // normX ต่อ 1 เมตร
        const intercept = (sumX - slope * sumK) / n;
        if (isFinite(slope) && slope > 0) {
          const regP1X = intercept + slope * kmStart;
          const regP2X = intercept + slope * kmEnd;
          // ใช้ค่าจากการถดถอยเมื่ออยู่ในช่วงที่สมเหตุสมผล (ไม่หลุดขอบภาพมากเกินไป)
          if (regP1X > -0.02 && regP2X < 1.02 && regP2X > regP1X) {
            p1X = regP1X;
            p2X = regP2X;
          }
        }
      }
    }
  }
  if (p2X <= p1X) { p1X = 0.08; p2X = 0.92; }

  // พิกัด Y: P1 อยู่เส้นตารางล่างสุด (y มากกว่า) และ P2 อยู่เส้นตารางบนสุด (y น้อยกว่า)
  let p1Y = (p1In && typeof p1In.y === 'number') ? p1In.y : 0.88;
  let p2Y = (p2In && typeof p2In.y === 'number') ? p2In.y : 0.24;
  if (p1Y <= p2Y) {
    // สลับถ้า AI ส่ง P1 อยู่สูงกว่า P2
    const tmpY = p1Y;
    p1Y = Math.max(p1Y, p2Y, 0.78);
    p2Y = Math.min(tmpY, p2Y, 0.28);
  }

  return {
    p1: { x: Math.max(0, Math.min(1, p1X)), y: Math.max(0, Math.min(1, p1Y)), km: kmStart, elev: Number(p1Elev.toFixed(2)) },
    p2: { x: Math.max(0, Math.min(1, p2X)), y: Math.max(0, Math.min(1, p2Y)), km: kmEnd,   elev: Number(p2Elev.toFixed(2)) }
  };
}

// รอบ 34: ตารางระดับคูส่งน้ำให้บันทึกเป็นช่วง ตาม กม. ที่มีค่า H เท่านั้น
//   (ถ้าแถวกลางไม่มีค่า H หรือ H === 0 ให้ยุบรวมเป็นช่วงเดียวกัน จนถึง กม. ที่มีค่า H หรือปลายคู)
function aiFilterLevelIntervalsByH(levels, structures, rawLabels, dim) {
  const lvls = (Array.isArray(levels) ? levels : []).slice().sort((a, b) => (aiNum(a.kmStart, 0) - aiNum(b.kmStart, 0)));
  if (lvls.length <= 1) return lvls;

  // หาชุดของ กม. ที่มีค่า H > 0 จากทั้ง level, structures และป้าย kind='h'
  const hKmSet = new Set();
  lvls.forEach(l => {
    const hVal = aiNum(l.h, 0);
    if (hVal !== null && Math.abs(hVal) > 1e-6) {
      hKmSet.add(Math.round(aiNum(l.kmStart, 0)));
    }
  });
  (Array.isArray(structures) ? structures : []).forEach(s => {
    const hVal = aiNum(s && s.h, 0);
    const hasHInName = /h\s*=\s*([0-9]+(?:\.[0-9]+)?)/i.test(String((s && s.name) || '') + ' ' + String((s && s.remark) || ''));
    if ((hVal !== null && Math.abs(hVal) > 1e-6) || hasHInName) {
      hKmSet.add(Math.round(aiNum(s.km, 0)));
    }
  });

  // ถ้ารายการ level ที่ AI ส่งมามีการแบ่งช่วงย่อยที่ไม่มีค่า H เลย ให้ยุบรวมช่วงที่ไม่มีค่า H เข้าด้วยกัน
  const merged = [];
  for (let i = 0; i < lvls.length; i++) {
    const cur = Object.assign({}, lvls[i]);
    if (merged.length === 0) {
      merged.push(cur);
      continue;
    }
    const prev = merged[merged.length - 1];
    const boundaryKm = Math.round(aiNum(cur.kmStart, 0));
    const curHasH = (aiNum(cur.h, 0) > 0) || hKmSet.has(boundaryKm);
    const slopeSame = !prev.slope || !cur.slope || Number(prev.slope) === Number(cur.slope);
    if (!curHasH && slopeSame) {
      // รวมช่วงเข้ากับแถวก่อนหน้า
      prev.kmEnd = cur.kmEnd;
      if (cur.bl2 !== '' && cur.bl2 !== null && cur.bl2 !== undefined) prev.bl2 = cur.bl2;
      if (cur.tbl2 !== '' && cur.tbl2 !== null && cur.tbl2 !== undefined) prev.tbl2 = cur.tbl2;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function normalizeAiResult(raw, frameMeta) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { channels: [], refPoints: null, labels: [], levelLines: [], groundLine: [], raw: src };

  // ---- labels (อ่านก่อนเพื่อใช้ช่วยเทียบสเกลและดึงค่า H / ระดับดินเดิมถ้า AI ส่งมาเฉพาะในป้าย) ----
  // รอบ 32: เพิ่ม kind 'h' + ฟิลด์ group และรวมกลุ่มป้ายให้อยู่ในป้ายเดียว
  // รอบ 34: กรองป้ายค่าระดับเส้นตารางแกนซ้าย / ค่า F.S.L. / จุดดำๆ ออก
  const rawLabels = (Array.isArray(src.labels) ? src.labels : []).map(l => {
    const o = (l && typeof l === 'object') ? l : {};
    const x = aiNum(o.x, null), y = aiNum(o.y, null);
    if (x === null || y === null) return null;
    const kind = aiStr(o.kind, 'station');
    const normKind = ['station', 'structure', 'h', 'elev', 'slope', 'level', 'p1', 'p2'].includes(kind) ? kind : 'station';
    const candidate = {
      kind: normKind,
      text: aiCleanLabelText(aiStr(o.text, '')),
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      angle: aiNum(o.angle, 0) || 0,
      group: aiStr(o.group, '')
    };
    if (aiIsIgnoredOverlayLabel(candidate)) return null;
    return candidate;
  }).filter(Boolean);

  // ---- channels ----
  const chans = Array.isArray(src.channels) ? src.channels : [];
  out.channels = chans.map((c) => {
    const ch = (c && typeof c === 'object') ? c : {};
    const dim = (ch.dimension && typeof ch.dimension === 'object') ? ch.dimension : {};
    const lvls = Array.isArray(ch.level) ? ch.level : [];
    const rawStructs = (Array.isArray(ch.structures) ? ch.structures : []).map(s => ({
      km: aiNum(s && s.km, 0),
      name: aiStr(s && s.name, ''),
      h: aiNum(s && s.h, ''),
      pipeDia: aiNum(s && s.pipeDia, 0),
      pipeCount: aiNum(s && s.pipeCount, 0),
      remark: aiStr(s && s.remark, '')
    }));
    const mappedLvls = lvls.map(l => ({
      kmStart: aiNum(l && l.kmStart, 0),
      kmEnd: aiNum(l && l.kmEnd, 0),
      h: aiNum(l && l.h, 0),
      bl1: aiNum(l && l.bl1, ''),
      tbl1: aiNum(l && l.tbl1, ''),
      bl2: aiNum(l && l.bl2, ''),
      tbl2: aiNum(l && l.tbl2, ''),
      slope: aiNum(l && l.slope, '')
    }));
    const filteredLvls = aiFilterLevelIntervalsByH(mappedLvls, rawStructs, rawLabels, dim);
    const structs = aiSplitAndNormalizeStructures(rawStructs, rawLabels, filteredLvls);

    let gndList = (Array.isArray(ch.ground) ? ch.ground : []).map(g => ({
      km: aiNum(g && g.km, 0),
      groundElevation: aiNum(g && (g.groundElevation !== undefined ? g.groundElevation : g.elev), ''),
      x: aiNum(g && g.x, null),
      y: aiNum(g && g.y, null)
    })).filter(g => g.groundElevation !== '' && g.groundElevation !== null);

    // รอบ 34: ถ้า AI ไม่ได้ใส่ channels[].ground มาโดยตรง ให้ดึงจาก src.groundLine หรือจากระดับคูส่งน้ำ เพื่อให้มีเส้นดินเดิมเสมอ
    if (gndList.length === 0 && Array.isArray(src.groundLine) && src.groundLine.length > 0) {
      gndList = src.groundLine.map(pt => ({
        km: aiNum(pt && pt.km, 0),
        groundElevation: aiNum(pt && (pt.elev !== undefined ? pt.elev : pt.groundElevation), ''),
        x: aiNum(pt && pt.x, null),
        y: aiNum(pt && pt.y, null)
      })).filter(g => g.groundElevation !== '' && g.groundElevation !== null);
    }
    if (gndList.length === 0 && filteredLvls.length > 0) {
      const derived = [];
      filteredLvls.forEach((lv, idx) => {
        const b1 = aiNum(lv.bl1, null), t1 = aiNum(lv.tbl1, null);
        const b2 = aiNum(lv.bl2, null), t2 = aiNum(lv.tbl2, null);
        if (idx === 0 && b1 !== null) {
          derived.push({ km: aiNum(lv.kmStart, 0), groundElevation: Number(((t1 !== null ? (b1 + t1) / 2 : b1 + 0.25)).toFixed(2)), x: null, y: null });
        }
        if (b2 !== null) {
          derived.push({ km: aiNum(lv.kmEnd, 0), groundElevation: Number(((t2 !== null ? (b2 + t2) / 2 : b2 + 0.25)).toFixed(2)), x: null, y: null });
        }
      });
      if (derived.length > 0) gndList = derived;
    }

    return {
      canal: aiStr(ch.canal, 'คลอง'),
      ditch: cleanDitchNumber(ch.ditch),
      totalArea: aiStr(ch.totalArea, ''),
      waterArea: aiStr(ch.waterArea, ''),
      dimension: {
        kmStart: aiNum(dim.kmStart, 0),
        kmEnd: aiNum(dim.kmEnd, 0),
        q: aiNum(dim.q, 0),
        slope: aiNum(dim.slope, 4000),
        b: aiNum(dim.b, 0.35),
        d: aiNum(dim.d, 0.36),
        type: aiStr(dim.type, 'VU1'),
        tbl: aiNum(dim.tbl, 0.5),
        tbr: aiNum(dim.tbr, 0.5)
      },
      ground: gndList,
      level: filteredLvls,
      structures: structs,
      attachments: (Array.isArray(ch.attachments) ? ch.attachments : []).map(a => ({
        km: aiNum(a && a.km, 0),
        name: aiStr(a && a.name, ''),
        h: aiNum(a && a.h, 0),
        pipeDia: aiNum(a && a.pipeDia, 0),
        length: aiNum(a && a.length, 0),
        count: aiNum(a && a.count, 0),
        remark: aiStr(a && a.remark, '')
      }))
    };
  }).filter(c => c.canal || c.ditch);

  // ---- refPoints ----
  const rp = (src.refPoints && typeof src.refPoints === 'object') ? src.refPoints : null;
  if (rp && (rp.p1 || rp.p2)) {
    const pick = (o) => {
      if (!o || typeof o !== 'object') return null;
      const x = aiNum(o.x, null), y = aiNum(o.y, null);
      if (x === null || y === null) return null;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        km: aiNum(o.km, ''),
        elev: aiNum(o.elev, '')
      };
    };
    out.refPoints = { p1: pick(rp.p1), p2: pick(rp.p2) };
    if (!out.refPoints.p1 && !out.refPoints.p2) out.refPoints = null;
  }
  // รอบ 35: ปรับเทียบ P1/P2 ตามสเกลตารางกราฟมาตรฐานเสมอเมื่อมีข้อมูลช่องคู เพื่อให้จุดเริ่มต้น-สิ้นสุดของเส้นตรงกับตาราง 100%
  if (out.channels.length > 0) {
    out.refPoints = aiCalibrateRefPoints(out.refPoints, out.channels, rawLabels);
  }

  out.labels = rawLabels;

  // ---- levelLines & groundLine & slope labels ----
  out.levelLines = (Array.isArray(src.levelLines) ? src.levelLines : []).map(l => {
    const o = (l && typeof l === 'object') ? l : {};
    const x1 = aiNum(o.x1, null), y1 = aiNum(o.y1, null), x2 = aiNum(o.x2, null), y2 = aiNum(o.y2, null);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    const t = aiStr(o.type, 'BL').toUpperCase();
    return {
      type: (t === 'TBL') ? 'TBL' : 'BL',
      x1: Math.max(0, Math.min(1, x1)), y1: Math.max(0, Math.min(1, y1)),
      x2: Math.max(0, Math.min(1, x2)), y2: Math.max(0, Math.min(1, y2)),
      kmStart: aiNum(o.kmStart, null),
      kmEnd: aiNum(o.kmEnd, null)
    };
  }).filter(Boolean);

  try {
    if (out.refPoints && out.refPoints.p1 && out.refPoints.p2 && out.channels.length > 0) {
      const p1 = out.refPoints.p1, p2 = out.refPoints.p2;
      const eSpan = (Number(p2.elev) - Number(p1.elev)) || 1;
      const kSpan = (Number(p2.km) - Number(p1.km)) || 1;
      const elevToNormY = (e) => Math.max(0.05, Math.min(0.95, p1.y + ((Number(e) - Number(p1.elev)) / eSpan) * (p2.y - p1.y)));
      const kmToNormX = (k) => Math.max(0.02, Math.min(0.98, p1.x + ((Number(k) - Number(p1.km)) / kSpan) * (p2.x - p1.x)));

      // รอบ 35 (จุดที่ 4): สร้างเส้นระดับ (BL และ TBL) จากค่าตาราง (out.channels[0].level) เสมอ
      // เพื่อให้ตำแหน่ง กม.เริ่มต้น - กม.สิ้นสุด และค่าระดับตรงกับตารางทุกช่วง ไม่ถูกดึงเพี้ยนตามป้ายข้อความ กม.
      if (out.channels[0].level && out.channels[0].level.length > 0) {
        const tableLines = [];
        out.channels[0].level.forEach(lv => {
          const x1 = kmToNormX(lv.kmStart), x2 = kmToNormX(lv.kmEnd);
          if (lv.bl1 !== '' && lv.bl1 !== null && lv.bl2 !== '' && lv.bl2 !== null) {
            tableLines.push({ type: 'BL', x1, y1: elevToNormY(lv.bl1), x2, y2: elevToNormY(lv.bl2), kmStart: lv.kmStart, kmEnd: lv.kmEnd, slope: lv.slope });
          }
          if (lv.tbl1 !== '' && lv.tbl1 !== null && lv.tbl2 !== '' && lv.tbl2 !== null) {
            tableLines.push({ type: 'TBL', x1, y1: elevToNormY(lv.tbl1), x2, y2: elevToNormY(lv.tbl2), kmStart: lv.kmStart, kmEnd: lv.kmEnd, slope: lv.slope });
          }
        });
        if (tableLines.length > 0) {
          out.levelLines = tableLines;
        }
      }

      // รอบ 35 (จุดที่ 4): สร้างพิกัดเส้นดินเดิม (out.groundLine) จากค่าตาราง (out.channels[0].ground)
      // โดยใช้ kmToNormX และ elevToNormY เพื่อให้จุดเริ่มต้น-สิ้นสุดตรงกับตาราง 100%
      const gPts = [];
      if (out.channels[0].ground && out.channels[0].ground.length > 0) {
        out.channels[0].ground.forEach(g => {
          const gx = kmToNormX(g.km);
          const gy = elevToNormY(g.groundElevation);
          gPts.push({ x: Math.max(0, Math.min(1, gx)), y: Math.max(0, Math.min(1, gy)), km: g.km, elev: g.groundElevation });
        });
      } else if (Array.isArray(src.groundLine) && src.groundLine.length > 0) {
        src.groundLine.forEach(pt => {
          const gx = kmToNormX(aiNum(pt && pt.km, 0));
          const gy = elevToNormY(aiNum(pt && (pt.elev !== undefined ? pt.elev : pt.groundElevation), p1.elev));
          gPts.push({ x: Math.max(0, Math.min(1, gx)), y: Math.max(0, Math.min(1, gy)), km: aiNum(pt && pt.km, 0), elev: aiNum(pt && (pt.elev !== undefined ? pt.elev : pt.groundElevation), '') });
        });
      }
      out.groundLine = gPts;

      // รอบ 35: ค่า slope ให้แสดงทุกช่วงของเส้นระดับ (สร้างป้าย slope ให้ครบทุกช่วงในตาราง level)
      //   รอบ 35 (ปรับเพิ่ม): ตัดป้าย slope ที่ซ้ำ/เกินออก
      //     - ข้ามช่วงที่ค่า slope เท่ากับช่วงก่อนหน้า (แสดงเฉพาะจุดที่ slope เปลี่ยน)
      //     - ข้ามช่วงที่ยาวสั้นมาก (ไม่มีพื้นที่ให้วางป้าย)
      if (out.channels[0].level && out.channels[0].level.length > 0) {
        const defaultSlope = (out.channels[0].dimension && out.channels[0].dimension.slope) ? out.channels[0].dimension.slope : 4000;
        out.labels = out.labels.filter(l => l && l.kind !== 'slope');
        let prevSlopeKey = null;
        out.channels[0].level.forEach((lv, idx) => {
          const sVal = (lv.slope !== '' && lv.slope !== null && lv.slope !== undefined) ? lv.slope : defaultSlope;
          if (!sVal) return;
          const x1 = kmToNormX(lv.kmStart), x2 = kmToNormX(lv.kmEnd);
          const yTop1 = (lv.tbl1 !== '' && lv.tbl1 !== null) ? elevToNormY(lv.tbl1) : elevToNormY(lv.bl1);
          const yTop2 = (lv.tbl2 !== '' && lv.tbl2 !== null) ? elevToNormY(lv.tbl2) : elevToNormY(lv.bl2);
          const midX = (x1 + x2) / 2;
          const midY = Math.max(0.04, (yTop1 + yTop2) / 2 - 0.018);
          const cleanS = Number(String(sVal).replace(/,/g, ''));
          const sText = (!isNaN(cleanS) && cleanS > 0) ? ('1:' + cleanS.toLocaleString('en-US')) : ('1:' + String(sVal));

          // ข้ามช่วงที่ค่า slope เหมือนช่วงก่อนหน้า (ป้ายซ้ำ)
          const slopeKey = sText.replace(/\s+/g, '');
          if (slopeKey === prevSlopeKey) return;
          prevSlopeKey = slopeKey;

          // ข้ามช่วงที่ยาวสั้นเกินไป (ไม่มีพื้นที่วางป้าย) — ยกเว้นช่วงสุดท้าย
          const isLast = (idx === out.channels[0].level.length - 1);
          const segLenNorm = Math.abs(x2 - x1);
          if (!isLast && segLenNorm < 0.08) return;

          out.labels.push({
            kind: 'slope',
            text: sText,
            x: midX,
            y: midY,
            angle: 0,
            group: 'slope_seg_' + idx
          });
        });
      }
    }
    out.labels = aiGroupOverlayLabels(out.labels);
  } catch (err) {
    console.error('[aiGroupOverlayLabels error]', err);
  }

  out.frameId = (frameMeta && frameMeta.frameId) ? frameMeta.frameId : null;
  out.frameName = (frameMeta && frameMeta.frameName) ? frameMeta.frameName : '';
  return out;
}

// ---------- แปลงพิกัดสัดส่วน 0..1 ของกรอบ → พิกัดหน้าจอ ----------
// frameW/frameH = ขนาดจริง (pixel) ของภาพกรอบที่ใช้คำนวณพิกัด AI
// ถ้าเฟรมไม่มีขนาดจริง → ใช้ขนาดของ img ที่แสดงอยู่ในแท็บรูป
function aiNormToScreen(nx, ny, frameW, frameH) {
  const s = (typeof imgScale === 'number' && imgScale > 0) ? imgScale : 1;
  const dispW = (typeof img !== 'undefined' && img && img.width) ? img.width : 0;
  const dispH = (typeof img !== 'undefined' && img && img.height) ? img.height : 0;
  const srcW = frameW || dispW;
  const srcH = frameH || dispH;
  if (!srcW || !srcH) return { x: 0, y: 0 };
  // ภาพที่แสดงอยู่อาจถูกย่อจากภาพต้นฉบับของกรอบ → คำนวณอัตราส่วน
  const kx = dispW ? (dispW / srcW) : 1;
  const ky = dispH ? (dispH / srcH) : 1;
  return { x: nx * srcW * kx * s, y: ny * srcH * ky * s };
}

// ---------- สร้าง overlay จากผล AI ----------
//   ป้าย → canvasLabels (ผู้ใช้จับย้ายได้)
//   เส้นระดับ → วาดเป็นเส้นชั่วคราวใน canvasLabels (kind: 'level')
//   P1/P2 → เก็บใน aiRefPoints (สัดส่วน 0..1 ของกรอบ)
function buildAiOverlayFromResult(result, frameMeta) {
  if (!result) return;
  const meta = frameMeta || {};
  const frameId = meta.frameId || result.frameId;
  const frameW = meta.frameWidth || 0;
  const frameH = meta.frameHeight || 0;

  // ---- ป้าย ----
  // รอบ 32: ป้ายที่รวมกลุ่มแล้วจะมี "\n" ใน text (หลายบรรทัด) → วาดเป็นกล่องเดียว
  // รอบ 34: ขยับตำแหน่งป้ายให้ทับข้อความจริงในรูป (ใช้ boxCenterX/boxCenterY),
  //         อาคารให้อยู่บน, slope ให้อยู่บนเส้นระดับ, 3 ระดับให้อยู่ท้าย
  const labels = (result.labels || []).map((l, idx) => {
    let nx = (typeof l.boxCenterX === 'number') ? l.boxCenterX : l.x;
    let ny = (l.kind === 'elev' && typeof l.firstRowY === 'number')
      ? l.firstRowY
      : ((typeof l.boxCenterY === 'number') ? l.boxCenterY : l.y);
    if (l.kind === 'slope') {
      ny = Math.max(0.04, ny);
    } else if (l.kind === 'structure' || l.kind === 'station') {
      // รอบ 35: ป้ายอาคารให้ขยับขึ้นด้านบนให้พ้นตัวหนังสือในแบบ (ไม่ทับข้อความเดิม)
      ny = Math.max(0.03, Math.min(ny, 0.32) - 0.02);
    }
    const p = aiNormToScreen(nx, ny, frameW, frameH);
    return {
      id: 'ai_lbl_' + (frameId || 'f') + '_' + idx + '_' + Math.round(nx * 1000) + '_' + Math.round(ny * 1000),
      frameId: frameId || '',
      kind: l.kind,
      text: l.text,
      x: p.x,
      y: p.y,
      normX: nx,
      normY: ny,
      angle: (l.kind === 'structure' || l.kind === 'station' || l.kind === 'h') ? (l.angle || -90) : (l.angle || 0),
      align: (l.kind === 'structure' || l.kind === 'station' || l.kind === 'elev') ? 'left' : 'center',
      anchorTopRow: (l.kind === 'elev'),
      color: (l.kind === 'structure') ? '#6f42c1' : (l.kind === 'elev' ? '#b45309' : (l.kind === 'slope' ? '#0d6efd' : '#0f172a')),
      bgColor: 'rgba(255,255,255,0.90)',
      source: 'ai'
    };
  }).filter(l => l.text);

  // ---- เส้นระดับ (สีละเส้น: BL = #0056b3 น้ำเงิน, TBL = #28a745 เขียว) ----
  const levelLines = (result.levelLines || []).map((l, idx) => {
    const a = aiNormToScreen(l.x1, l.y1, frameW, frameH);
    const b = aiNormToScreen(l.x2, l.y2, frameW, frameH);
    return {
      id: 'ai_lvl_' + (frameId || 'f') + '_' + idx + '_' + Math.round(l.x1 * 1000),
      frameId: frameId || '',
      kind: 'level',
      levelType: l.type,
      text: l.type,
      x: a.x,
      y: a.y,
      x2: b.x,
      y2: b.y,
      normX: l.x1,
      normY: l.y1,
      normX2: l.x2,
      normY2: l.y2,
      angle: 0,
      color: (l.type === 'TBL') ? '#28a745' : '#0056b3',
      source: 'ai'
    };
  });

  // ---- เส้นดินเดิมจาก AI (สีส้ม #fd7e14 แยกคนละสีกับ BL/TBL) ----
  const groundSegments = [];
  const gPts = Array.isArray(result.groundLine) ? result.groundLine : [];
  for (let i = 0; i < gPts.length - 1; i++) {
    const pA = gPts[i], pB = gPts[i + 1];
    if (!pA || !pB || typeof pA.x !== 'number' || typeof pA.y !== 'number' || typeof pB.x !== 'number' || typeof pB.y !== 'number') continue;
    const a = aiNormToScreen(pA.x, pA.y, frameW, frameH);
    const b = aiNormToScreen(pB.x, pB.y, frameW, frameH);
    groundSegments.push({
      id: 'ai_gnd_' + (frameId || 'f') + '_' + i,
      frameId: frameId || '',
      kind: 'ground',
      text: 'GROUND',
      x: a.x,
      y: a.y,
      x2: b.x,
      y2: b.y,
      normX: pA.x,
      normY: pA.y,
      normX2: pB.x,
      normY2: pB.y,
      km: pA.km,
      elev: pA.elev,
      angle: 0,
      color: '#fd7e14',
      source: 'ai'
    });
  }

  // เรียงลำดับให้ป้าย 3 ระดับ (kind === 'elev') อยู่ท้ายสุด ताकिวาดทับบนสุด
  const nonElevLabels = labels.filter(l => l.kind !== 'elev');
  const elevLabels = labels.filter(l => l.kind === 'elev');
  const all = groundSegments.concat(levelLines, nonElevLabels, elevLabels);

  // แทนที่ป้ายเดิมของกรอบนี้ (ไม่ลบที่ผู้ใช้จับย้ายเอง — ที่มี source !== 'ai')
  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
    canvasLabels = canvasLabels.filter(l => !(l && l.source === 'ai' && l.frameId === (frameId || '')));
    canvasLabels.push.apply(canvasLabels, all);
  }
  if (typeof mediaDrawingStateByTab !== 'undefined' && mediaDrawingStateByTab && mediaDrawingStateByTab.image) {
    const prevImgLabels = Array.isArray(mediaDrawingStateByTab.image.canvasLabels) ? mediaDrawingStateByTab.image.canvasLabels : [];
    mediaDrawingStateByTab.image.canvasLabels = prevImgLabels.filter(l => !(l && l.source === 'ai' && l.frameId === (frameId || ''))).concat(all);
  }
  if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();

  // ---- เก็บผลดิบของ AI ไว้ต่อกรอบ (บันทึกลงไฟล์ JSON เพื่อใช้อ้างอิงภายหลัง) ----
  if (typeof aiLabels !== 'undefined' && aiLabels) {
    aiLabels[frameId || ''] = {
      labels: (result.labels || []).map(l => ({
        kind: l.kind, text: l.text, x: l.x, y: l.y, angle: l.angle || 0
      })),
      levelLines: (result.levelLines || []).map(l => ({
        type: l.type, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2
      }))
    };
  }

  // ---- จุดอ้างอิง P1/P2 ----
  if (result.refPoints && typeof aiRefPoints !== 'undefined' && aiRefPoints) {
    const rp = {};
    ['p1', 'p2'].forEach(k => {
      const v = result.refPoints[k];
      if (!v) return;
      rp[k] = {
        x: v.x, y: v.y,
        km: v.km, elev: v.elev
      };
    });
    if (rp.p1 || rp.p2) {
      aiRefPoints[frameId || ''] = rp;
    }
  }
}

// ---------- นำเข้าผล AI ลงตารางข้อมูล ----------
//   matchExisting = true → จับคู่กับคูเดิมด้วยชื่อ (คลองส่งน้ำ + คูส่งน้ำ)
//   ถ้าไม่พบ → สร้างคูใหม่ท้ายสุด
function applyAiResultsToTables(results, options) {
  const opts = options || {};
  const list = Array.isArray(results) ? results : (results ? [results] : []);
  if (!list.length) return { channelsAdded: 0, channelsUpdated: 0, rowsAdded: 0 };

  let added = 0, updated = 0, rowsAdded = 0;

  // รอบ 30: เก็บอาคาร/ท่อรับน้ำไว้ก่อน แล้วค่อยนำเข้าหลัง sync เสร็จ
  //   (syncStructureRowsWithLevel() สร้างแถวอาคารของคูใหม่ทั้งชุด → ถ้านำเข้าก่อน ข้อมูล AI จะหาย)
  const pendingStructures = [];
  const pendingAttachments = [];

  list.forEach(res => {
    if (!res || !Array.isArray(res.channels)) return;
    res.channels.forEach((aiCh, chIdxInFrame) => {
      const cleanDitch = cleanDitchNumber(aiCh.ditch);
      aiCh.ditch = cleanDitch;
      // ── หาคูที่ตรงกัน ──
      let target = null;
      if (opts.matchExisting !== false) {
        target = channels.find(c => c && c.canal === aiCh.canal && cleanDitchNumber(c.ditch) === cleanDitch);
        if (!target && res.frameId) {
          target = channels.find(c => c && c._frameId === res.frameId && chIdxInFrame === 0);
        }
      }
      if (!target) {
        target = {
          id: (typeof generateChannelId === 'function') ? generateChannelId() : (channels.length + 1),
          canal: aiCh.canal,
          ditch: cleanDitch,
          totalArea: aiCh.totalArea || '',
          waterArea: aiCh.waterArea || '',
          collapsed: false,
          rows: []
        };
        channels.push(target);
        added++;
      } else {
        updated++;
        target.canal = aiCh.canal || target.canal;
        target.ditch = cleanDitch;
        if (aiCh.totalArea) target.totalArea = aiCh.totalArea;
        if (aiCh.waterArea) target.waterArea = aiCh.waterArea;
      }
      if (res.frameId) target._frameId = res.frameId;
      if (res.frameName) target._frameName = res.frameName;
      const chId = target.id;

      // ── มิติคูส่งน้ำ ──
      if (typeof dimensionRows !== 'undefined' && aiCh.dimension) {
        let dim = dimensionRows.find(d => d.channelId === chId);
        if (!dim) {
          dim = { channelId: chId };
          dimensionRows.push(dim);
          rowsAdded++;
        }
        Object.assign(dim, aiCh.dimension);
      }

      // ── ระดับดินเดิม ──
      if (typeof groundRowsData !== 'undefined' && Array.isArray(aiCh.ground) && aiCh.ground.length) {
        const existing = groundRowsData.filter(g => g.channelId === chId);
        // เก็บแถวขอบเขตเดิมไว้ แล้วจัดเรียง [แถวขอบเขตต้น, ...แถวข้อมูล AI, แถวขอบเขตปลาย]
        const boundaries = existing.filter(g => g.isBoundary);
        const body = aiCh.ground.map(g => ({
          channelId: chId, isDynamicRow: true, isBoundary: false,
          km: g.km, groundElevation: g.groundElevation
        })).sort((a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0));
        const kms = body.map(g => g.km);
        const first = boundaries[0]
          ? Object.assign({}, boundaries[0], { isDynamicRow: false, isBoundary: true })
          : { channelId: chId, isDynamicRow: false, isBoundary: true, groundElevation: '' };
        const last = (boundaries.length > 1 && boundaries[boundaries.length - 1] !== boundaries[0])
          ? Object.assign({}, boundaries[boundaries.length - 1], { isDynamicRow: false, isBoundary: true })
          : { channelId: chId, isDynamicRow: false, isBoundary: true, groundElevation: '' };
        if (kms.length) {
          first.km = Math.min.apply(null, kms);
          last.km = Math.max.apply(null, kms);
        }
        groundRowsData = groundRowsData.filter(g => g.channelId !== chId).concat([first], body, [last]);
        rowsAdded += body.length;
      }

      // ── ระดับคูส่งน้ำ ──
      //   ⚠️ โครงสร้างจริงของแท็บระดับคูใช้ customKmStart / customKmEnd / customSlope / customType
      //   แถวแรกของคู (isDynamicRow=false) จะดึง กม.เริ่มต้นจากแท็บมิติอัตโนมัติ
      //   แถวสุดท้ายของคู จะล็อก กม.สิ้นสุดเท่ากับ กม.สิ้นสุดของคู (จากแท็บมิติ)
      if (typeof levelRowsData !== 'undefined' && aiCh.level.length) {
        const dimCh = (typeof dimensionRows !== 'undefined')
          ? dimensionRows.find(d => d.channelId === chId) : null;
        const chanKmEnd = (dimCh && dimCh.kmEnd !== undefined) ? dimCh.kmEnd : '';
        const chanKmStart = (dimCh && dimCh.kmStart !== undefined) ? dimCh.kmStart : 0;
        const chanType = (dimCh && dimCh.type) ? dimCh.type : 'VU1';
        const chanSlope = (dimCh && dimCh.slope) ? dimCh.slope : 4000;

        const rows = aiCh.level.map((l, li) => {
          const isFirst = (li === 0);
          const isLast = (li === aiCh.level.length - 1);
          return {
            channelId: chId,
            isDynamicRow: !isFirst,
            customType: isFirst ? '' : (l.type || chanType),
            customSlope: (l.slope !== '' && l.slope !== null && l.slope !== undefined) ? l.slope : chanSlope,
            customKmStart: isFirst ? chanKmStart : l.kmStart,
            customKmEnd: isLast ? '' : l.kmEnd,
            h: l.h,
            bl1: l.bl1, tbl1: l.tbl1, bl2: l.bl2, tbl2: l.tbl2
          };
        });
        levelRowsData = levelRowsData.filter(r => r.channelId !== chId).concat(rows);
      }

      // ── อาคารประกอบ ──
      //   ⚠️ เก็บไว้ก่อน เพราะ syncStructureRowsWithLevel() จะสร้างแถวอาคารของคูใหม่ทั้งชุด
      //   (แถวขอบเขต + แถว "อาคารลดระดับ") → ถ้านำเข้าก่อน ข้อมูล AI จะหาย
      if (aiCh.structures && aiCh.structures.length) {
        pendingStructures.push({ chId: chId, rows: aiCh.structures });
      }

      // ── อาคารท่อรับน้ำเข้าแปลงไร่นา ──
      //   แถวแรกของคูต้องเป็น "อาคารท่อรับน้ำเข้าแปลงไร่นา" (ล็อกตามระบบ) → ใส่ไว้ทีหลังด้วย
      if (aiCh.attachments && aiCh.attachments.length) {
        pendingAttachments.push({ chId: chId, rows: aiCh.attachments });
      }
    });
  });

  if (typeof ensureChannelIds === 'function') ensureChannelIds();
  if (typeof syncDimensionRowsWithChannels === 'function') syncDimensionRowsWithChannels();
  // รอบ 30: ล็อก กม.สิ้นสุดของแถวระดับคูสุดท้ายให้ตรงกับ กม.สิ้นสุดของคู (จากแท็บมิติ)
  if (typeof enforceLevelLastKmEnd === 'function') enforceLevelLastKmEnd();
  // syncStructureRowsWithLevel() ต้องทำก่อนนำเข้าอาคารจาก AI เพื่อไม่ให้ข้อมูล AI ถูกทับ
  if (typeof syncStructureRowsWithLevel === 'function') syncStructureRowsWithLevel();

  // ── นำเข้าอาคารประกอบจาก AI (หลัง sync เสร็จ) ──
  //   - แยกชื่ออาคารที่มี "และ" หรือ "," เป็น 2 แถว กม. เดียวกัน เรียงตามลำดับในแบบ
  //   - เทียบชื่ออาคารกับ Typeอาคารประกอบ (ใกล้เคียงกันให้ใช้ชื่อตาม Typeอาคารประกอบ)
  //   - ค่า H ใส่เฉพาะที่อาคารที่มีค่า H ตามตารางในแท็บย่อย Typeอาคารประกอบ
  if (typeof structureRowsData !== 'undefined') {
    pendingStructures.forEach(({ chId, rows }) => {
      const chanLvls = (typeof levelRowsData !== 'undefined')
        ? levelRowsData.filter(l => l.channelId === chId).map(l => ({
            kmStart: l.customKmStart,
            kmEnd: l.customKmEnd,
            h: l.h
          }))
        : [];
      const normalizedList = aiSplitAndNormalizeStructures(rows, [], chanLvls);

      const current = structureRowsData.filter(r => r.channelId === chId);
      const startBoundaries = current.filter(r => r.isBoundary && !r.isEndBoundary);
      const endBoundaries = current.filter(r => r.isBoundary && r.isEndBoundary);
      const autoRows = current.filter(r => !r.isBoundary && r.isFromLevel);

      const kStartVal = startBoundaries[0] ? (parseFloat(startBoundaries[0].km) || 0) : 0;
      const kEndVal = endBoundaries[0] ? parseFloat(endBoundaries[0].km) : NaN;
      const subLevelKms = new Set(
        chanLvls.slice(1).map(l => Math.round((parseFloat(l.kmStart) || 0) * 100) / 100)
      );

      const aiMiddleRows = [];
      let startConsumed = false;
      let endConsumed = false;

      normalizedList.forEach((s, idx) => {
        const kmNum = parseFloat(s.km) || 0;
        const kmRound = Math.round(kmNum * 100) / 100;
        const entry = (typeof getStructureTypeEntry === 'function') ? getStructureTypeEntry(s.name) : null;
        const hasHInType = entry ? (entry.hEditable === true) : !!s._hasHInTypeTable;
        const hStr = (hasHInType && s.h !== undefined && s.h !== null && s.h !== '' && Number(s.h) > 0)
          ? Number(s.h).toFixed(2)
          : '';
        const diaStr = (s.pipeDia !== undefined && s.pipeDia !== null && s.pipeDia !== '' && Number(s.pipeDia) > 0)
          ? Number(s.pipeDia).toFixed(2)
          : '';
        const lenStr = (s.pipeCount !== undefined && s.pipeCount !== null && s.pipeCount !== '' && Number(s.pipeCount) > 0)
          ? Number(s.pipeCount).toFixed(2)
          : '';

        // ถ้าอยู่ที่ กม.เริ่มต้น และเป็นอาคารต้นคูที่ไม่มีค่า H -> อัปเดตแถวขอบเขตต้นคูแทนการสร้างซ้ำ
        if (!startConsumed && startBoundaries[0] && Math.abs(kmNum - kStartVal) < 0.001 && !hasHInType) {
          startBoundaries[0].name = s.name || startBoundaries[0].name;
          startBoundaries[0].hOverride = '';
          startBoundaries[0].pipeDia = diaStr || '0.00';
          startBoundaries[0].pipeCount = lenStr || '0.00';
          startBoundaries[0].remark = s.remark || '';
          startBoundaries[0]._seqOrder = -100 + idx;
          startConsumed = true;
          return;
        }
        // ถ้าอยู่ที่ กม.สิ้นสุด และเป็นอาคารปลายคูที่ไม่มีค่า H -> อัปเดตแถวขอบเขตปลายคูแทนการสร้างซ้ำ
        if (!endConsumed && endBoundaries[0] && !isNaN(kEndVal) && Math.abs(kmNum - kEndVal) < 0.001 && !hasHInType && /ปลายคู/.test(s.name)) {
          endBoundaries[0].name = s.name || endBoundaries[0].name;
          endBoundaries[0].hOverride = '';
          endBoundaries[0].pipeDia = diaStr || '0.00';
          endBoundaries[0].pipeCount = lenStr || '0.00';
          endBoundaries[0].remark = s.remark || '';
          endBoundaries[0]._seqOrder = 10000 + idx;
          endConsumed = true;
          return;
        }

        // ถ้า กม. นี้ตรงกับจุดตัดช่วงในแท็บระดับคูส่งน้ำ และเป็นอาคารที่มีค่า H ตาม Typeอาคารประกอบ ให้ผูก isFromLevel = true
        const isLevelMatch = hasHInType && subLevelKms.has(kmRound);
        if (isLevelMatch) {
          subLevelKms.delete(kmRound);
        }

        aiMiddleRows.push({
          channelId: chId,
          isDynamicRow: false,
          isBoundary: false,
          isFromLevel: isLevelMatch,
          km: s.km,
          name: s.name || '-ไม่มี-',
          hOverride: hStr,
          pipeDia: diaStr,
          pipeCount: lenStr,
          remark: s.remark || '',
          _seqOrder: idx + 1
        });
      });

      const filteredAuto = autoRows.filter(ar => !aiMiddleRows.some(air => Math.abs((parseFloat(air.km) || 0) - (parseFloat(ar.km) || 0)) < 0.001));
      const middleRows = filteredAuto.concat(aiMiddleRows).sort((a, b) => {
        const ka = parseFloat(a.km) || 0;
        const kb = parseFloat(b.km) || 0;
        if (Math.abs(ka - kb) > 0.001) return ka - kb;
        return ((typeof a._seqOrder === 'number') ? a._seqOrder : 999) - ((typeof b._seqOrder === 'number') ? b._seqOrder : 999);
      });

      structureRowsData = structureRowsData.filter(r => r.channelId !== chId);
      structureRowsData.push.apply(structureRowsData, startBoundaries.concat(middleRows, endBoundaries));
      rowsAdded += aiMiddleRows.length;
    });
  }

  // ── นำเข้าอาคารท่อรับน้ำเข้าแปลงไร่นา (หลัง sync เสร็จ) ──
  if (typeof attachmentRowsData !== 'undefined') {
    pendingAttachments.forEach(({ chId, rows }) => {
      const current = attachmentRowsData.filter(r => r.channelId === chId);
      const baseRow = current[0];
      const otherRows = current.slice(1);

      const aiRows = rows.map((a, ai) => {
        const rowName = (ai === 0 && baseRow) ? baseRow.name : (a.name || (baseRow ? baseRow.name : ''));
        const rowObj = {
          channelId: chId,
          isDynamicRow: false,
          isBoundary: false,
          km: a.km,
          name: rowName,
          h: a.h,
          pipeDia: a.pipeDia,
          length: a.length,
          count: a.count,
          remark: a.remark
        };
        // รอบ 30: ศก. ท่อของแท็บท่อรับน้ำ "ล็อกตามประเภทอาคาร" เสมอ → ใช้ค่าจากระบบ ไม่ใช่ค่าจาก AI
        if (typeof getAttachmentPipeDia === 'function') {
          rowObj.pipeDia = getAttachmentPipeDia(rowObj);
        }
        return rowObj;
      });

      attachmentRowsData = attachmentRowsData.filter(r => r.channelId !== chId);
      // แถวแรกของคู = แถวฐาน (ล็อกชื่อไว้) · ตามด้วยแถวจาก AI และแถวที่ผู้ใช้สร้างเอง
      const base = baseRow || {
        channelId: chId, isDynamicRow: false, isBoundary: false,
        km: 0, name: 'อาคารท่อรับน้ำเข้าแปลงไร่นา',
        h: 0, pipeDia: 0.2, length: 1, count: 1, remark: ''
      };
      base.isDynamicRow = false;
      base.isBoundary = false;
      attachmentRowsData.push(base);
      attachmentRowsData.push.apply(attachmentRowsData, aiRows.concat(otherRows));
      rowsAdded += aiRows.length;
    });
  }

  if (typeof updateTable === 'function') updateTable();
  if (typeof redraw === 'function') redraw();

  return { channelsAdded: added, channelsUpdated: updated, rowsAdded: rowsAdded };
}

// ---------- เขียน P1/P2 ของ AI ลง groundGroupState ----------
//   refPoints เก็บเป็นสัดส่วน 0..1 ของภาพกรอบ → ต้องแปลงเป็นพิกัดหน้าจอของภาพที่แสดงอยู่
function applyAiRefPointsToGroupState(frameMeta, channelId) {
  if (typeof aiRefPoints === 'undefined' || !aiRefPoints) return false;
  const frameId = (frameMeta && frameMeta.frameId) ? frameMeta.frameId : '';
  const rp = aiRefPoints[frameId];
  if (!rp || (!rp.p1 && !rp.p2)) return false;

  const chId = (channelId !== undefined && channelId !== null)
    ? channelId
    : ((typeof activeChannelId !== 'undefined') ? activeChannelId : (channels[0] ? channels[0].id : 1));

  const grpKey = 'ground_ch_' + chId;
  if (typeof groundGroupState === 'undefined') return false;
  if (!groundGroupState[grpKey]) groundGroupState[grpKey] = {};

  const frameW = (frameMeta && frameMeta.frameWidth) || 0;
  const frameH = (frameMeta && frameMeta.frameHeight) || 0;

  ['p1', 'p2'].forEach(k => {
    const v = rp[k];
    if (!v) return;
    const p = aiNormToScreen(v.x, v.y, frameW, frameH);
    groundGroupState[grpKey][k + 'Ref'] = { x: p.x, y: p.y, normX: v.x, normY: v.y };
    if (v.km !== '' && v.km !== null && v.km !== undefined) groundGroupState[grpKey][k + 'Km'] = v.km;
    if (v.elev !== '' && v.elev !== null && v.elev !== undefined) groundGroupState[grpKey][k + 'Elev'] = v.elev;
    if (typeof refPixels !== 'undefined' && refPixels && (typeof activeChannelId === 'undefined' || chId === activeChannelId)) {
      refPixels[k] = { x: p.x, y: p.y };
    }
  });

  if (typeof activeChannelId === 'undefined' || chId === activeChannelId) {
    try {
      const p1XEl = document.getElementById('p1XVal');
      const p1YEl = document.getElementById('p1YVal');
      const p2XEl = document.getElementById('p2XVal');
      const p2YEl = document.getElementById('p2YVal');
      if (p1XEl && rp.p1 && rp.p1.km !== '') p1XEl.value = rp.p1.km;
      if (p1YEl && rp.p1 && rp.p1.elev !== '') p1YEl.value = rp.p1.elev;
      if (p2XEl && rp.p2 && rp.p2.km !== '') p2XEl.value = rp.p2.km;
      if (p2YEl && rp.p2 && rp.p2.elev !== '') p2YEl.value = rp.p2.elev;
    } catch (_) {}
  }

  groundGroupState[grpKey]._coordSpace = 'screen';
  if (typeof updateTable === 'function') updateTable();
  if (typeof redraw === 'function') redraw();
  return true;
}

// ---------- อ่านกรอบเดียว (ใช้โดย aiReadCurrentFrame) ----------
async function aiReadFrameData(frameMeta) {
  const meta = frameMeta || {};
  const dataUrl = meta.dataUrl;
  if (!dataUrl) throw new Error('ไม่พบภาพของกรอบนี้');

  const settings = (typeof aiCurrentSettings !== 'undefined' && aiCurrentSettings) ? aiCurrentSettings : {};
  const quality = settings.quality || '1400';

  // ย่อภาพตามคุณภาพที่เลือก (ประหยัดเวลา + ค่าใช้จ่าย)
  const small = await downscaleImageForQuality(dataUrl, quality);
  const sendDataUrl = (small && small.dataUrl) ? small.dataUrl : dataUrl;

  const existingChannels = (typeof channels !== 'undefined') ? channels : [];
  const promptText = buildAiUserPrompt(meta.name, existingChannels);

  const rawText = await callAiVision(sendDataUrl, promptText);
  const parsed = parseAiJsonResponse(rawText);
  return normalizeAiResult(parsed, {
    frameId: meta.frameId,
    frameName: meta.name
  });
}
