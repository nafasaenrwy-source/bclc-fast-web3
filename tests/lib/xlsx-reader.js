// ===== tests/lib/xlsx-reader.js =====
// ตัวอ่านไฟล์ .xlsx แบบไม่ต้องพึ่ง dependency ภายนอก (ใช้ zlib ของ Node อย่างเดียว)
// รองรับ: zip central directory, sharedStrings, inlineStr, ตัวเลข/บูล/วันที่พื้นฐาน
const fs = require('fs');
const zlib = require('zlib');

function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ไม่พบโครงสร้าง ZIP (EOCD) ในไฟล์ xlsx');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};

  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');

    // อ่าน local header เพื่อหาขนาดข้อมูลจริง
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataStart, dataStart + csize);
    entries[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;

    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function colToIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(m[1]))) texts.push(decodeXmlEntities(tm[1]));
    out.push(texts.join(''));
  }
  return out;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowAttrs = rm[1] || '';
    const rNum = parseInt(/\br="(\d+)"/.exec(rowAttrs)?.[1] || '0', 10);
    const cells = [];
    const cRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cRe.exec(rm[2]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] || '';
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || 'n';
      const colIdx = colToIndex(ref);

      let value = '';
      if (type === 'inlineStr') {
        const texts = [];
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tm;
        while ((tm = tRe.exec(inner))) texts.push(decodeXmlEntities(tm[1]));
        value = texts.join('');
      } else if (type === 's') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const si = v ? parseInt(v[1], 10) : -1;
        value = (si >= 0 && shared[si] !== undefined) ? shared[si] : '';
      } else if (type === 'str' || type === 'e') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = v ? decodeXmlEntities(v[1]) : '';
      } else if (type === 'b') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = (v && v[1] === '1') ? true : false;
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const raw = v ? v[1] : '';
        if (raw === '') value = '';
        else {
          const num = Number(raw);
          value = isNaN(num) ? raw : num;
        }
      }
      cells[colIdx] = value;
    }
    const row = [];
    for (let c = 0; c < cells.length; c++) row[c] = cells[c] === undefined ? '' : cells[c];
    rows[rNum - 1] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

// อ่านไฟล์ xlsx → { ชื่อชีต: อาร์เรย์แถว (AOA) }
function readXlsx(filePath) {
  const buf = fs.readFileSync(filePath);
  const entries = readZipEntries(buf);

  const wbXml = entries['xl/workbook.xml'] ? entries['xl/workbook.xml'].toString('utf8') : '';
  const relsXml = entries['xl/_rels/workbook.xml.rels'] ? entries['xl/_rels/workbook.xml.rels'].toString('utf8') : '';

  // แมป rId → target
  const relMap = {};
  const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
  let rm;
  while ((rm = relRe.exec(relsXml))) relMap[rm[1]] = rm[2];

  const shared = parseSharedStrings(entries['xl/sharedStrings.xml'] ? entries['xl/sharedStrings.xml'].toString('utf8') : '');

  const out = {};
  const sheetRe = /<sheet\b[^>]*name="([^"]*)"[^>]*sheetId="(\d+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  let sm;
  const sheets = [];
  while ((sm = sheetRe.exec(wbXml))) {
    sheets.push({ name: decodeXmlEntities(sm[1]), rid: sm[3] });
  }
  // บางไฟล์เรียง attribute ต่างกัน — ใช้ regex แยกอีกที
  if (!sheets.length) {
    const s2 = /<sheet\b([^>]*)\/?>/g;
    while ((sm = s2.exec(wbXml))) {
      const a = sm[1] || '';
      const name = /name="([^"]*)"/.exec(a)?.[1];
      const rid = /r:id="([^"]+)"/.exec(a)?.[1];
      if (name && rid) sheets.push({ name: decodeXmlEntities(name), rid });
    }
  }

  for (const sh of sheets) {
    let target = relMap[sh.rid];
    if (!target) continue;
    target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const path = 'xl/' + target;
    if (!entries[path]) continue;
    out[sh.name] = parseSheet(entries[path].toString('utf8'), shared);
  }
  return out;
}

module.exports = { readXlsx, readZipEntries };
