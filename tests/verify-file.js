// ตรวจสอบว่าไฟล์ HTML/JS ที่ระบุถูกต้องหรือไม่ (encoding + โครงสร้าง + เนื้อหาไทย)
// ใช้งาน: node tests\verify-file.js [ไฟล์ ...]
//   ไม่ใส่ไฟล์ = ตรวจไฟล์หลักของเว็บ (index.html + style.css + ไฟล์ js ทั้งหมด)
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');

const GOOD = [
  'ตั้งค่า AI',
  'โหลดสคริปต์เรียงตามลำดับความสัมพันธ์',
  'กันพังเมื่อโหลด',
  'ใส่ ?v=',
  'ดูโมเดล',
  'เรียงตามลำดับ'
];
const BAD = ['เธฃ', 'เธญ', 'เนใ'];

function verifyFile(relPath) {
  const abs = path.isAbsolute(relPath) ? relPath : path.join(base, relPath);
  const b = fs.readFileSync(abs);
  const s = b.toString('utf8');
  const isHtml = /\.html?$/i.test(relPath);

  console.log('=== file        :', relPath);
  console.log('    BOM         :', (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) ? 'YES' : 'no');
  console.log('    bytes       :', b.length);
  console.log('    valid utf8  :', (() => { try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true; } catch (e) { return false; } })());
  console.log('    U+FFFD      :', (s.match(/\uFFFD/g) || []).length);

  if (isHtml) {
    console.log('    --- required Thai strings ---');
    GOOD.forEach(g => console.log('    ' + (s.includes(g) ? 'OK   ' : 'MISS ') + g));
  }

  console.log('    --- mojibake markers (should all be 0) ---');
  BAD.forEach(x => console.log('    ' + (s.includes(x) ? 'BAD  ' : 'OK   ') + x + ' x' + (s.split(x).length - 1)));

  if (isHtml) {
    console.log('    --- structure ---');
    console.log('    script js/ tags :', (s.match(/<script src="js\//g) || []).length);
    console.log('    has aiFetchModels:', s.includes('aiFetchModels'));
    console.log('    has gpt-4o      :', s.includes('gpt-4o'));
  }
  console.log('');
}

const args = process.argv.slice(2);
let targets = args;
if (!targets.length) {
  targets = ['index.html', 'style.css'];
  const jsDir = path.join(base, 'js');
  if (fs.existsSync(jsDir)) {
    fs.readdirSync(jsDir)
      .filter(f => f.endsWith('.js'))
      .forEach(f => targets.push('js/' + f));
  }
}

targets.forEach(verifyFile);
console.log('ตรวจสอบเสร็จทั้งหมด ' + targets.length + ' ไฟล์');
