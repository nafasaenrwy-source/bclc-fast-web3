// กฎเลขเวอร์ชัน: เมื่อมีการแก้ไขโค้ดทุกครั้ง ให้เพิ่มเลข APP_VERSION ขึ้น 0.0001 เสมอ (เช่น 1.0001 -> 1.0002)
const APP_VERSION = '1.0003';

// รอบ 58: ตัวช่วยเก็บค่าตัวเลขที่เป็น 0 ให้ถูกต้อง (ไม่ให้กลายเป็นค่าว่างเหมือนการใช้ ||)
//   - null / undefined / ''  → '' (ยังถือว่าไม่มีค่า)
//   - 0 (ตัวเลข)            → 0 (ต้องเก็บไว้!)
//   - '0' / '0.00' (ข้อความ) → 0
function keepNumValue(v) {
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

// ตัวแปรสำหรับจำ Directory Handle เพื่อใช้เป็นที่อยู่เริ่มต้นในการเซฟ/ส่งออก[cite: 2]
let lastDirectoryHandle = null;

// ฟังก์ชัน Escape HTML เพื่อป้องกันปัญหาสัญลักษณ์พิเศษใน input และ table[cite: 2]
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let projectPlanData = {
  name: "โครงการจัดรูปที่ดินระบบคูส่งน้ำสายหลัก",
  location: "ตำบลบ้านใหม่ อำเภอเมือง จังหวัดเชียงใหม่",
  description: "ปรับปรุงระบบคูส่งน้ำดาดคอนกรีตเพื่อเพิ่มประสิทธิภาพการบริหารจัดการน้ำในแปลงเกษตรกรรม"
};

let img = new Image();
let currentMode = 'pan'; 
let prevStepMode = 'pan';
let imgScale = 1.0; 
let isZoomLocked = false;
let currentTab = 'ditch'; 
let settingsSubTab = 'type'; // แท็ปย่อยใต้ setting: 'type' = Typeคูส่งน้ำ, 'structure' = Typeอาคารประกอบ

let refPixels = { p1: null, p2: null };

let channels = [
  {
    id: 1,
    canal: "คลอง",
    ditch: "01",
    totalArea: "",
    waterArea: "",
    collapsed: false,
    rows: []
  }
];

// ===== เฟส 1: ผูกข้อมูลด้วย channelId (id คงที่) ไม่ใช่ลำดับอาร์เรย์ =====
// id ของคูเป็นตัวเลขคงที่ ห้ามนำกลับมาใช้ซ้ำ → เพิ่ม/ลบคูกลางตารางแล้วข้อมูลแท็บอื่นไม่เลื่อนผิดคู
function generateChannelId() {
  let maxId = 0;
  channels.forEach(ch => { if (ch && typeof ch.id === 'number' && ch.id > maxId) maxId = ch.id; });
  return maxId + 1;
}

function getChannelById(id) {
  return channels.find(c => c && c.id === id) || null;
}

function getChannelIndexById(id) {
  return channels.findIndex(c => c && c.id === id);
}

// เติม id ให้คูที่ไม่มี (ไฟล์เก่ามากอาจไม่มีฟิลด์ id) — ใช้ตอนโหลด/นำเข้า/กู้ autosave
function ensureChannelIds() {
  channels.forEach(ch => {
    if (!ch) return;
    if (typeof ch.id !== 'number' || isNaN(ch.id)) ch.id = generateChannelId();
  });
}

// แปลงแถวไฟล์เก่า (ใช้ channelIdx) → channelId ตามคูปัจจุบัน (backward-compat)
function migrateRowsToChannelId(rows) {
  return (rows || []).map(r => {
    if (r && r.channelId === undefined && r.channelIdx !== undefined) {
      let ch = channels[r.channelIdx];
      let migrated = Object.assign({}, r, { channelId: ch ? ch.id : (channels[0] ? channels[0].id : 1) });
      delete migrated.channelIdx;
      return migrated;
    }
    return r;
  });
}

let activeChannelId = channels[0].id;

// tw = ความหนากำแพง (ม.) / tf = ความหนาพื้น (ม.)
// เหลือเฉพาะ VU1–VU6 ตามที่เจ้าของงานสั่ง (ตัด L/E/SL ออก)
let ditchTypeDatabase = [
  { type: "VU1", b: 0.35, h: 0.50, tw: 0.10, tf: 0.10 },
  { type: "VU2", b: 0.50, h: 0.55, tw: 0.10, tf: 0.10 },
  { type: "VU3", b: 0.60, h: 0.60, tw: 0.10, tf: 0.10 },
  { type: "VU4", b: 0.60, h: 0.70, tw: 0.10, tf: 0.10 },
  { type: "VU5", b: 0.70, h: 0.70, tw: 0.10, tf: 0.10 },
  { type: "VU6", b: 0.70, h: 0.80, tw: 0.10, tf: 0.10 }
];

function getDitchTypeOptions() {
  return ditchTypeDatabase.map(d => d.type);
}

function getHFromType(tName) {
  let found = ditchTypeDatabase.find(d => d.type === tName);
  if (!found) {
    console.warn(`Ditch type "${tName}" not found in database. Falling back to 0.50.`);
    return 0.50;
  }
  return found.h;
}

// Type อาคาร — ใช้เฉพาะแท็ปใหม่ "อาคารท่อรับน้ำเข้าแปลงไร่นา"
// (แก้ตามรูปภาพที่แนบ: เดิมเป็น MU ปลายคู/ปากคูซอย/สะพานน้ำ ฯลฯ)
const structureOptions = [
  "-ไม่มี-",
  "อาคารท่อรับน้ำเข้าแปลงไร่นา",
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ",
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 1",
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 1",
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 2",
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 2"
];

// ===== Typeอาคารประกอบ (ตารางตามรูปที่เจ้าของงานแนบ) =====
// แต่ละรายการเก็บ 5 ฟิลด์: type / h / pipeDia / length / remark
//   ค่า "-" ในรูป = ช่องนั้น "ล็อก" (เก็บเป็น "" และ hEditable/diaEditable/lenEditable = false)
//   ค่าที่มีตัวเลข = ช่องนั้น "แก้ไขได้" (ไฮไลต์สีเขียว และพิมพ์ทับได้)
//   หมายเหตุ: มีเพียง "อาคารปากคูซอย" ที่เป็นช่องให้กรอก (ใส่ชื่อคูซอย)
// ⚠️ ต้องเป็น let เพราะ loadProjectJSON() / importAllFromExcel() เขียนทับทั้งชุด
let structureTypeDatabase = [
  { type: "-ไม่มี-",                            h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "-",       down: "-"       },
  { type: "อาคารท่อส่งน้ำเข้านา (เดิม)",         h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารท่อส่งน้ำเข้านา (ใหม่)",         h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "ปลายคู",                             h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-"       },
  { type: "อาคารปลายคูส่งน้ำแบบที่ 1",           h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-"       },
  { type: "อาคารปลายคูส่งน้ำแบบที่ 2",           h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-"       },
  { type: "อาคารปากคูซอย",                      h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: true,  up: "TypeNow", down: "-"       },
  { type: "อาคารปากคูซอยแบบที่ 1",               h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "xxx",     down: "TypeNow" },
  { type: "อาคารปากคูซอยแบบที่ 2",               h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "xxx",     down: "TypeNow" },
  { type: "อาคารท่อลอดถนน",                    h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
  { type: "อาคารท่อลอดถนนลดระดับ",              h: "0.00", hEditable: true,  pipeDia: "0.30", diaEditable: true,  length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "อาคารท่อลอดทางข้าม",                 h: "0.00", hEditable: true,  pipeDia: "0.30", diaEditable: true,  length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "อาคารแผ่นพื้นทางข้าม",                h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "5.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
  { type: "อาคารน้ำตกลดระดับ",                  h: "0.00", hEditable: true,  pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "อาคารลดระดับ",                      h: "0.00", hEditable: true,  pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "บานอัดน้ำ",                          h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeNow", down: "-"       },
  { type: "อาคารรับน้ำแบบที่ 1",                 h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารรับน้ำแบบที่ 2",                 h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารเปลี่ยนลาดทางเข้า",              h: "0.00", hEditable: true,  pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "อาคารเปลี่ยนลาดทางออก",              h: "0.00", hEditable: true,  pipeDia: "",     diaEditable: false, length: "",     lenEditable: false, remark: "", remarkEditable: false, up: "TypeUp",  down: "TypeNow" },
  { type: "อาคารสะพานน้ำแบบที่ 1",              h: "",     hEditable: false, pipeDia: "0.30", diaEditable: true,  length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
  { type: "อาคารสะพานน้ำแบบที่ 2",              h: "",     hEditable: false, pipeDia: "",     diaEditable: false, length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "TypeNow", down: "TypeNow" },
  { type: "อาคารท่อระบายน้ำแบบที่ 1",            h: "",     hEditable: false, pipeDia: "0.50", diaEditable: true,  length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารท่อระบายน้ำแบบที่ 2",            h: "",     hEditable: false, pipeDia: "0.50", diaEditable: true,  length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารท่อระบายน้ำแบบที่ 1 (2 แถว)",    h: "",     hEditable: false, pipeDia: "0.50", diaEditable: true,  length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "-",       down: "TypeNow" },
  { type: "อาคารท่อระบายน้ำแบบที่ 2 (2 แถว)",    h: "",     hEditable: false, pipeDia: "0.50", diaEditable: true,  length: "6.00", lenEditable: true,  remark: "", remarkEditable: false, up: "-",       down: "TypeNow" }
];

// ===== สำเนา "ค่าตั้งต้น" ของคลัง Type ทั้งสองชุด (แช่แข็งไว้ตอนโหลดหน้าเว็บ) =====
// ใช้ตอน "โหลดไฟล์ JSON/Excel ที่ไม่มีคีย์คลัง Type" → ต้องกู้ค่าตั้งต้นกลับ
// ไม่ใช่ปล่อยให้ Type ที่แก้ค้างจากโปรเจกต์เดิมอยู่ต่อ (เดิมข้อมูล 2 โปรเจกต์ปนกัน)
const ditchTypeDefaultsSnapshot = JSON.parse(JSON.stringify(ditchTypeDatabase));
const structureTypeDefaultsSnapshot = JSON.parse(JSON.stringify(structureTypeDatabase));

// ชื่อ Type อาคารประกอบทั้งหมด (พร้อม "-ไม่มี-" ไว้เป็นตัวเลือกเริ่มต้นของแท็บอาคารประกอบ)
function getStructureTypeOptions() {
  return structureTypeDatabase.map(t => t.type);
}

// ===== "ชื่ออาคารประกอบ" = ประเภทอาคาร + ข้อมูลในวงเล็บ (คำนวณอัตโนมัติ) =====
// กฎการรวม (ตามที่เจ้าของงานกำหนด):
//   1) ช่องที่เป็น "-" หรือว่าง = ไม่ต้องเอามารวม
//   2) H มีค่า        -> "H=<ค่า>"
//   3) ความยาว มีค่า   -> "L=<ค่า>"
//   4) ศก. ท่อ มีค่า   -> "ศก. <ค่า>"
//   5) ศก. + ความยาว  -> "ศก. <ศก.>x<ยาว>"
//   6) H + ศก. + ยาว  -> "H=<H>,ศก. <ศก.>x<ยาว>"
//   7) "อาคารปากคูซอย" -> "อาคารปากคูซอย (<ค่าช่องหมายเหตุ>)" เสมอ
//   8) "อาคารท่อระบายน้ำแบบที่ 1/2 (รวมแบบ 2 แถว)" -> "<n>-ศก. <ศก.>x" (ไม่แสดงเลขความยาว)
//      n = 2 สำหรับ "แบบที่ 2" และ "(2 แถว)" ส่วนแบบที่ 1 = 1 · และตัดคำว่า "(2 แถว)" ออกจากชื่อที่แสดง
// ตัวอย่าง: "อาคารท่อส่งน้ำเข้านา (ใหม่) (ศก. 0.30x5.00)" · "อาคารท่อลอดถนนลดระดับ (H=0.00,ศก. 0.30x5.00)"
//           "อาคารปากคูซอย (คูซอย 3)" · "อาคารท่อระบายน้ำแบบที่ 1 (1-ศก. 0.50x)"
function structureHasValue(val) {
  if (val === undefined || val === null) return false;
  let s = String(val).trim();
  return !(s === "" || s === "-");
}

// แสดงค่าในช่องตัวเลขของแท็บอาคารประกอบ
//   ค่าว่าง / "-" -> "-"
//   ค่าอื่น (รวม 0.00) -> แสดงตามจริง (ช่องที่แก้ไขได้จะโชว์ค่าเริ่มต้นจากตาราง Typeอาคาร)
function formatStructureCellValue(val) {
  if (!structureHasValue(val)) return "-";
  return String(val);
}

function computeStructureTypeName(entry) {
  let typeName = (entry && entry.type) ? entry.type : "";
  if (!typeName) return "";

  // กฎ 7: "อาคารปากคูซอย" -> ชื่อ (ค่าช่องหมายเหตุ) เสมอ
  if (typeName === "อาคารปากคูซอย") {
    let rem = structureHasValue(entry.remark) ? String(entry.remark).trim() : "";
    return `${typeName} (${rem})`;
  }

  let h = structureHasValue(entry.h) ? String(entry.h).trim() : "";
  let dia = structureHasValue(entry.pipeDia) ? String(entry.pipeDia).trim() : "";
  let len = structureHasValue(entry.length) ? String(entry.length).trim() : "";

  // กฎ 8: "อาคารท่อระบายน้ำแบบที่ 1/2" (รวมรุ่น "(2 แถว)") -> "<n>-ศก. <ศก.>x"  (ไม่เอาเลขความยาวมาแสดง)
  //   n มาจาก "แบบที่ n" โดยตรง: แบบที่ 1 -> 1, แบบที่ 2 -> 2, "(2 แถว)" -> 2
  //   และ "ตัดคำว่า (2 แถว) ออก" ในชื่อที่แสดง (ชื่อใน dropdown ยังคงเดิมเพื่อไม่ให้ซ้ำกับตัวอื่น)
  if (typeName.indexOf("อาคารท่อระบายน้ำแบบที่") === 0 && dia) {
    let n = 0;
    if (typeName.indexOf("แบบที่ 2") !== -1) n = 2;
    else if (typeName.indexOf("แบบที่ 1") !== -1) n = 1;
    let mRow = typeName.match(/\((\d+)\s*แถว\)/);
    if (mRow) n = parseInt(mRow[1], 10);

    let baseName = typeName.replace(/\s*\(\d+\s*แถว\)\s*$/, "").trim();
    return `${baseName} (${n}-ศก. ${dia}x)`;
  }

  let name = "";
  if (h) name += "H=" + h;
  if (dia && len) {
    name += (name ? "," : "") + "ศก. " + dia + "x" + len;
  } else if (dia) {
    name += (name ? "," : "") + "ศก. " + dia;
  } else if (len) {
    name += (name ? "," : "") + "L=" + len;
  }

  return name ? `${typeName} (${name})` : typeName;
}

// แปลงข้อมูลจากไฟล์เก่า (string ล้วน) ให้เป็นรูปแบบ object ปัจจุบัน
function normalizeStructureTypeEntry(entry) {
  if (entry && typeof entry === 'object') {
    let tName = String(entry.type !== undefined ? entry.type : "");
    let defEntry = (typeof structureTypeDefaultsSnapshot !== 'undefined' && Array.isArray(structureTypeDefaultsSnapshot))
      ? structureTypeDefaultsSnapshot.find(t => t && t.type === tName)
      : null;
    return {
      type: tName,
      h: entry.h !== undefined && entry.h !== "" && entry.h !== null ? String(entry.h) : "",
      hEditable: entry.hEditable === true,
      pipeDia: entry.pipeDia !== undefined && entry.pipeDia !== "" && entry.pipeDia !== null ? String(entry.pipeDia) : "",
      diaEditable: entry.diaEditable === true,
      length: entry.length !== undefined && entry.length !== "" && entry.length !== null ? String(entry.length) : "",
      lenEditable: entry.lenEditable === true,
      remark: entry.remark !== undefined && entry.remark !== null ? String(entry.remark) : "",
      remarkEditable: entry.remarkEditable === true,
      up: (entry.up !== undefined && entry.up !== null && String(entry.up).trim() !== "")
        ? String(entry.up).trim()
        : (defEntry && defEntry.up ? defEntry.up : "-"),
      down: (entry.down !== undefined && entry.down !== null && String(entry.down).trim() !== "")
        ? String(entry.down).trim()
        : (defEntry && defEntry.down ? defEntry.down : "-")
    };
  }
  let builtin = structureTypeDatabase.find(t => t && t.type === String(entry));
  return builtin ? JSON.parse(JSON.stringify(builtin)) : {
    type: String(entry === undefined || entry === null ? "" : entry),
    h: "", hEditable: false, pipeDia: "", diaEditable: false,
    length: "", lenEditable: false, remark: "", remarkEditable: false,
    up: "-", down: "-"
  };
}

function getStructureTypeEntry(typeName) {
  return structureTypeDatabase.find(t => t && t.type === typeName) || null;
}

const pipeDiameterOptions = [
  "0.00", "0.20", "0.30", "0.40", "0.50", "0.60", "0.80", "1.00", "1.20"
];

// ตัวเลือกของคอลัมน์ "ความยาว (ม.)" ในแท็บอาคารประกอบ
// (เดิมใช้ลิสต์ "จำนวนท่อ" 0–12 ซึ่งไม่ตรงความหมายของความยาว · ยังพิมพ์ค่าเองได้)
const lengthOptions = [
  "0.50", "1.00", "1.50", "2.00", "2.50", "3.00", "3.50", "4.00", "4.50", "5.00",
  "5.50", "6.00", "6.50", "7.00", "7.50", "8.00", "8.50", "9.00", "9.50", "10.00"
];

// ตัวเลือกของคอลัมน์ Q และ SLOPE ในแท็บ "มิติคูส่งน้ำ" (ตามรูปที่เจ้าของงานแนบ)
// ยังพิมพ์ค่าเองได้ เพราะช่องเป็น combobox
const qOptions = [
  "0.03", "0.06", "0.09", "0.12", "0.15", "0.18"
];

const slopeOptions = [
  "500", "1000", "1500", "2000", "2500", "3000", "3500", "4000"
];

// ===== แท็บใหม่ "อาคารท่อรับน้ำเข้าแปลงไร่นา" =====
// กฎล็อก/แก้ไข ตามรูปภาพที่แนบ: y = แก้ไขได้ (ไฮไลต์เหลืองอ่อน)
// แถวแรกของแต่ละคูส่งน้ำใช้อาคารท่อรับน้ำเข้าแปลงไร่นา (H ล็อก, ศก. ท่อ ล็อก, ความยาว ล็อก)
const ATTACHMENT_BASE_NAME = "อาคารท่อรับน้ำเข้าแปลงไร่นา";

const attachmentTypeRules = {
  "อาคารท่อรับน้ำเข้าแปลงไร่นา":                      { h: false, dia: false, len: false },
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลดระดับ":                { h: true,  dia: false, len: false },
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 1":         { h: false, dia: false, len: true  },
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 1":  { h: true,  dia: false, len: true  },
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนน แบบที่ 2":         { h: false, dia: false, len: true  },
  "อาคารท่อรับน้ำเข้าแปลงไร่นาลอดถนนลดระดับ แบบที่ 2":  { h: true,  dia: false, len: true  }
};

function getAttachmentRule(typeName) {
  return attachmentTypeRules[typeName] || { h: false, dia: false, len: false };
}

// ศก. ท่อ (ม.) — ค่าเริ่มต้นตามรายการอาคาร และล็อกแก้ไม่ได้
//   4 รายการแรก (ท่อรับน้ำเข้าแปลงไร่นา + ลดระดับ + ลอดถนน แบบที่ 1 ทั้ง 2) = 0.20
//   2 รายการสุดท้าย (ลอดถนน แบบที่ 2 ทั้ง 2) = 0.15
function getAttachmentPipeDia(row) {
  let typeName = (row && row.name) ? row.name : ATTACHMENT_BASE_NAME;
  let idx = structureOptions.indexOf(typeName);
  // structureOptions[0] = "-ไม่มี-" จึงเลื่อนดัชนีขึ้น 1
  let pos = idx >= 1 ? idx : 1;
  return pos <= 4 ? "0.20" : "0.15";
}

// ตัวเลือกของลิสต์ "รายการอาคาร" (ตัด อาคารท่อรับน้ำเข้าแปลงไร่นา ออก เพราะเป็นแถวแรกคงที่)
function getAttachmentTypeOptions() {
  return structureOptions.filter(t => t !== ATTACHMENT_BASE_NAME && t !== "-ไม่มี-");
}

let attachmentRowsData = [
  { channelId: 1, km: 0, name: ATTACHMENT_BASE_NAME, h: "0.00", pipeDia: "0.20", length: "1.00", count: "1", remark: "" }
];

let dimensionRows = [
  {
    channelId: 1,
    kmStart: 0,
    kmEnd: 100,
    q: 0.030,
    slope: 4000,
    b: 0.35,
    d: 0.36,
    type: "VU1",
    tbl: 0.50,
    tbr: 0.50
  }
];

let levelRowsData = [
  {
    channelId: 1,
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
  }
];

let groundRowsData = [
  { channelId: 1, isDynamicRow: false, isBoundary: true, km: 0, groundElevation: "" },
  { channelId: 1, isDynamicRow: false, isBoundary: true, km: 100, groundElevation: "" }
];

let structureRowsData = [
  { channelId: 1, isBoundary: true, km: 0, name: "อาคารท่อส่งน้ำเข้านา (เดิม)", pipeDia: "0.00", pipeCount: "0.00", remark: "" },
  { channelId: 1, isBoundary: true, km: 100, name: "ปลายคู", pipeDia: "0.00", pipeCount: "0.00", remark: "" }
];

let levelGroupState = {};
let groundGroupState = {};
let structureGroupState = {};
let attachmentGroupState = {};

let manualGroundLinePoints = [];
let tableGroundLinePoints = [];
var selectedGroundPoint = null;
var draggingGroundPoint = null;
let canalLevelDrawingLines = [];
let currentFileName = '';
let pdfDoc = null;
let pageNum = 1;
let totalPages = 0;
let isPDF = false;
// เก็บ PDF ฉบับเต็ม (เป็น base64 data URL) ตอนอัปโหลด — ใช้ตอนบันทึก JSON เพื่อแนบไฟล์กลับไปด้วย
// (เดิมบันทึกแค่ PNG ของหน้าปัจจุบัน → เสียหน้าอื่น ๆ ของ PDF)
let pdfFileDataUrl = null;

// ===== รอบ 30: ป้ายข้อมูลบนภาพ (Label Layer) =====
// ป้ายที่ AI สร้าง + ผู้ใช้จับย้ายได้
//   kind: 'station' | 'elev' | 'structure' | 'slope' | 'level' | 'p1' | 'p2'
//   x, y   = พิกัดหน้าจอ (logical px ของ canvas)
//   angle  = มุม (องศา) สำหรับหมุนป้ายอาคารให้ตรงกับข้อความในรูป
let canvasLabels = [];
let draggingCanvasLabel = null;

// ผลการอ่านของ AI แยกตามกรอบรูป (ผูกด้วย frame.id)
//   refPoints[frameId] = { p1: {km, elev, x, y}, p2: {km, elev, x, y} }  (x,y = สัดส่วน 0..1 ในภาพกรอบ)
//   labels[frameId]    = [{ kind, text, x, y, angle, ... }]  (x,y = สัดส่วน 0..1 ในภาพกรอบ)
let aiRefPoints = {};
let aiLabels = {};
// ผลการอ่านล่าสุด (ใช้สร้างแท็บ diff preview)
let aiLastResults = [];