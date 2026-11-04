// ===== tests/lib/fixture.js =====
// หาไฟล์ Excel ตัวอย่าง (คลองซอย10RMC_แม่วัง_7แท็บ.xlsx) จากหลายแหล่ง แล้วอ่านเป็น AOA
// ลำดับการค้นหา:
//   1) env var BCLC_FIXTURE_XLSX
//   2) โฟลเดอร์ tests/fixtures/ ในโปรเจกต์
//   3) โฟลเดอร์ Downloads / Desktop / Documents ของผู้ใช้
//   4) path แบบ Linux เดิม (/working_dir/...) — เผื่อย้ายเครื่อง
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readXlsx } = require('./xlsx-reader');

const FIXTURE_NAME = 'คลองซอย10RMC_แม่วัง_7แท็บ.xlsx';

function candidatePaths() {
  const list = [];
  if (process.env.BCLC_FIXTURE_XLSX) list.push(process.env.BCLC_FIXTURE_XLSX);

  const home = os.homedir();
  list.push(path.join(__dirname, '..', 'fixtures', FIXTURE_NAME));
  list.push(path.join(__dirname, '..', FIXTURE_NAME));

  for (const d of ['Downloads', 'Desktop', 'Documents']) {
    list.push(path.join(home, d, FIXTURE_NAME));
  }

  list.push(path.join('/working_dir/c_2636c8e71509e16c/user_uploaded_files/ttl=63d/user_uploaded', FIXTURE_NAME));
  return list;
}

function findFixture() {
  for (const p of candidatePaths()) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch (_) {}
  }
  return null;
}

// คืนค่า { path, sheets } หรือ null ถ้าไม่พบไฟล์
function loadFixture() {
  const p = findFixture();
  if (!p) return null;
  try {
    return { path: p, sheets: readXlsx(p) };
  } catch (e) {
    return { path: p, sheets: null, error: e };
  }
}

module.exports = { loadFixture, findFixture, FIXTURE_NAME };
