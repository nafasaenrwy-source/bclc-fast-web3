// ตรวจ encoding ของทุกไฟล์ในโปรเจกต์ (อ่าน UTF-8 ตรง ๆ ผ่าน Node)
const fs = require('fs');
const path = require('path');

const TARGETS = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|js|css|md|json|py|ps1)$/i.test(e.name) && !/\.(bak|restored|corrupted-backup)/i.test(e.name)) {
      // ไฟล์ที่ "จงใจ" มี marker string อยู่ (ตัวตรวจเอง / เอกสารที่อธิบายอาการ) → ข้าม
      if (/check-encoding|verify-file|check-all-encoding|show-mojibake|check-state|find-lost/.test(e.name)) continue;
      if (e.name === 'HANDOFF.md') continue;
      if (e.name === 'round30-check.js') continue;
      TARGETS.push(p);
    }
  }
}
walk('.');

let bad = 0;
for (const p of TARGETS) {
  const b = fs.readFileSync(p);
  const hasBom = (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF);
  let valid = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { valid = false; }
  const s = b.toString('utf8');
  // ตรวจ mojibake แบบเจาะจง: ลำดับอักขระไทยที่ "แตก" จาก UTF-8 เดิม
  // (เช่น เธฃ แทน "รอบ", เนใ แทน "ใส่")
  // ห้ามจับคำไทยที่ถูกต้อง เช่น "ประสิทธิภาพ" / "สิทธิ์" / "อนุญาต"
  const mojibake = /เธฃ|เธญ|เนใ|แนะนํา|กํา|สิทธิ(?![์ภ])|นญาต|อน[ู]ญาต/.test(s);
  const replacement = (s.match(/\uFFFD/g) || []).length;

  const problems = [];
  if (!valid) problems.push('INVALID-UTF8');
  if (mojibake) problems.push('MOJIBAKE');
  if (replacement) problems.push('U+FFFD x' + replacement);
  if (hasBom) problems.push('BOM');

  if (problems.length) {
    bad++;
    console.log('WARN  ' + p + '  [' + problems.join(', ') + ']');
  }
}
console.log('');
console.log('scanned : ' + TARGETS.length + ' files');
console.log('warnings: ' + bad);
if (bad === 0) console.log('OK - all files are clean UTF-8');
