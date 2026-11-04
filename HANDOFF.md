# 📦 HANDOFF — เว็บ XY Plot Digitizer (BCLC FAST)

> ไฟล์นี้สรุปสถานะโครงการสำหรับ **ส่งงานต่อให้เซสชัน/ผู้พัฒนาคนถัดไป**
> อัปเดตล่าสุด: **2026-11-04 14:00** (รอบ 60 — แท็บ "ส่วนคำนวณปริมาณ -> ⛰️ งานดิน" ปรับ UI สีอ่อนโปร่งทั้งหน้า + ปุ่มย่อ/ขยายข้อมูลรายสายคูส่งน้ำ + ดรอปลิดกรองสาย + แท็บหัวหน้าแสดงชื่อ/ที่อยู่/สถานะเชฟ + ปุ่ม Undo/Redo + เตือนก่อนปิดหน้าเว็บที่ยังไม่บันทึก · เพิ่ม `tests/check-round60.js` (48/48) · รอบ 58 — **กู้เว็บที่พังทั้งเว็บ** เพราะ Google Drive sync เติมเลข `(1)` ต่อชื่อไฟล์ (`state (1).js` / `canvas-viewer (1).js` / `tab-export-preview (1).js` / `style (1).css`) → เปลี่ยนชื่อกลับ + แก้ชุดเทสต์ที่รันไม่ได้ (`check-round48.js` / `check-round51.js` เลิกพึ่ง python+openpyxl ใช้ตัวอ่าน xlsx ในเครื่องแทน · `verify-file.js` เขียนใหม่) + ตัดโค้ดตายที่อ้าง breadcrumb ที่ถูกลบไปตั้งแต่รอบ 46 + แก้บั๊ก "falsy zero" (ค่าตัวเลข 0 กลายเป็นค่าว่าง) + เพิ่ม `tests/check-round58.js` · รอบ 51 — แก้ปัญหาเส้นดินเดิมถูกเขียนขึ้นมาหลายสายซ้อนกันในรูปเดียว โดยไม่ให้นำ refPixels ของสายแรกไปเป็นค่าสำรองของสายอื่นที่ยังไม่ได้กำหนดจุด P1/P2 + เพิ่ม `tests/check-round51.js` · รอบ 50 — แก้บั๊กไม่ให้ป้ายอาคารเด้งขึ้นเองตอนกำหนด P1/P2 เสร็จ + แก้ปุ่มแสดงเส้นดินเดิมของคูสายแรกให้คำนวณและแสดงเส้นทันที + แก้การคลิกเลือกและลากย้ายป้ายอาคารประกอบโดยคงอ็อบเจกต์เดิมระหว่าง redraw + เพิ่ม `tests/check-round50.js` · รอบ 49 — ปรับปรุงแท็บขวามือ ย้ายปุ่มเขียวใต้เส้นปะ/เพิ่มปุ่มลบวัตถุทั้งหมด/ลบเส้นปะล่างสุด + แท็บระดับดินเดิมปุ่มกำหนด P1,P2 ในคราวเดียวและแยกแสดงแต่ละสาย + แท็บระดับคูส่งน้ำปุ่มแสดง/ซ่อนเส้นระดับ และป้าย S1 E1/S2 E2 รวม TBL BL คนละบรรทัดย้ายได้/ซูมไม่ลดขนาด + แท็บอาคารประกอบป้ายแนวดิ่ง กม. เดียวกันอยู่ป้ายเดียวกันย้ายได้ + เพิ่ม `tests/check-round49.js` · รอบ 48 — นำเข้าคอลัมน์ ช่วงคูน้ำ ทั้ง 4 แท็บ และคอลัมน์ P1/P2 จากแท็บระดับดินเดิมในไฟล์ Excel ให้ตรงกับไฟล์นำเข้า 100% + เพิ่ม `tests/check-round48.js` · รอบ 46–47 — ปรับปรุง UI 14 รายการ + เพิ่ม `tests/check-round46.js` · รอบ 45 — วิเคราะห์และแก้บั๊กเชิงลึกครบ 14 จุด + เพิ่ม `tests/check-round45.js` · รอบ 43 — เอนจินรูปตัดขวาง U-SHAPE ตามหลักการ "ส่วนที่ 1" ของเวบแนบ `canal_cross_section_V2.html` + แก้บั๊ก #1/#2/#3/#5/#7 + ตัวเลขตรง PDF อ้างอิงทุกตัวเลข + ดรอปลิสต์เลือกคลอง/กม. · รอบ 42 — ตรวจสอบปุ่มทั้งหมด + หน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก" แบบแยกหน้าต่าง พร้อมแท็บแรก "📑 รวมข้อมูล" (รวม 3 แท็บ + คอลัมน์ "ตาม กม.") และปุ่ม "แยก กม. ทุกๆ .. ม." + ระบบเครดิต AI/คิวงานค้างที่ถามทำต่อเมื่อเติมเครดิต · รอบ 41 — ระบบตรวจสอบข้อมูลข้ามแท็บ + ช่วงคูน้ำ + แยกแท็บ PDF/รูป)

| รายการ | ค่า |
|---|---|
| โฟลเดอร์งาน | `G:\My Drive\web2` (ย้ายจาก Dropbox → Google Drive แล้ว) |
| สถานะ | ใช้งานได้ — **เทสต์อัตโนมัติผ่านครบ 100%: smoke 448 ข้อ + probe 52 ข้อ (P1–P11, FAIL=0) + รอบ 30 (120/120) + รอบ 32 (44/44) + รอบ 43 (30/30) + รอบ 29 (18/18) + รอบ 48 (16/16) + รอบ 51 (5/5) + รอบ 58 (25/25) · เทสต์ทุกชุด 38 ไฟล์รันผ่าน FAIL = 0 · ยังรอผู้ใช้ทดสอบบนเบราว์เซอร์** |
| Context window | 1,000,000 tokens |
| ระบบควบคุมเวอร์ชัน | **ยังไม่มี Git** (ติดตั้ง Git 2.55 ไว้แล้วในเครื่อง แต่ยังไม่ได้ `git init` ในโปรเจกต์นี้) · มี `.gitignore` เตรียมไว้แล้ว |
| จำนวนไฟล์ในโปรเจกต์ | 27 ไฟล์ (เว็บโหลดจริง 17 = html 1 + css 1 + js 15 · เทสต์ 9 · เอกสาร 1) |

---

## 0) สถานะปัจจุบันโดยสรุป (สำหรับคนที่เพิ่งรับงาน)

**เว็บนี้ทำอะไรได้แล้ว:** อัปโหลดแปลน (รูป/PDF หลายหน้า) → ตั้งจุดอ้างอิง P1/P2 (กม.–ระดับ) → ลากเส้นดินเดิม/วาดเส้นระดับบนภาพ → กรอกตาราง 8 แท็บ + แท็บย่อย setting 2 → **ตรวจสอบความถูกต้องข้อมูลข้ามแท็บ (ปุ่ม "ตรวจสอบข้อมูล" + ไฮไลต์ช่องสีแดงอ่อน + AI เสนอแนว)** → บันทึก JSON (แนบภาพไปด้วย) → ส่งออก/นำเข้า Excel 8 ชีต → Copy ทุกตาราง

**คำสั่งที่ต้องรู้ (รันในโฟลเดอร์งาน):**
```powershell
node tests\smoke-test.js     # เทสต์หลัก 448 ข้อ (รันโค้ดจริงบน DOM จำลอง)
node tests\probe-bugs.js     # ชุดล่าบั๊ก/ตรวจ regression 44 ข้อ (ควรได้ FAIL = 0)
node tests\check-round41.js  # รอบ 41: ระบบตรวจสอบข้อมูล + ช่วงคูน้ำ + แยกแท็บ PDF/รูป (100 ข้อ)
node tests\check-round58.js  # รอบ 58: กู้ไฟล์ที่ Drive sync เปลี่ยนชื่อ + falsy-zero + โค้ดตาย (25 ข้อ)
node --check js\state.js     # ตรวจไวยากรณ์รายไฟล์
```

> 💡 **รอบ 58:** ชุดเทสต์ที่ต้องใช้ไฟล์ Excel ตัวอย่าง (`check-round48.js` / `check-round51.js`) จะค้นหาไฟล์ `คลองซอย10RMC_แม่วัง_7แท็บ.xlsx` ให้เองอัตโนมัติจาก `Downloads/` → `Desktop/` → `Documents/` · ถ้าไฟล์อยู่ที่อื่นให้ตั้ง env var: `$env:BCLC_FIXTURE_XLSX = "D:\path\to\file.xlsx"`

**ยังไม่ได้ทำ (งานค้างจริง):** ~~undo~~ (ทำแล้วรอบ 60 · ปุ่ม Undo/Redo ในแท็บงานดิน) · ~~เตือนก่อนปิดหน้าเว็บ~~ (ทำแล้วรอบ 60 · `beforeunload` เตือนเมื่อมีข้อมูลยังไม่บันทึก) · เมนูว่าง 7 จุด (แผนที่ระบบงาน · แผนงานโครงการ(เมนูซ้าย) · จัดซื้อจัดจ้าง · เรียกเก็บค่าใช้จ่าย · **ส่วนคำนวณปริมาณ** · **ส่วนราคาวัสดุ** · **พิมพ์รายงาน**) · ย้ายโลโก้จาก i.ibb.co เข้าโปรเจกต์ · vendor ไลบรารีให้ใช้ offline · accessibility

**ข้อควรระวังที่สุด:** งานทุกอย่างอยู่ในเครื่อง/ไฟล์ — รอบ 36 เพิ่ม **ระบบเชฟอัตโนมัติทุก 5 นาที (เก็บสำรองในเบราว์เซอร์)** แล้ว (รอบ 37 ตัดส่วน "เขียนทับไฟล์จริง" ออก) → แต่ยังไม่มี undo และการลบทุกปุ่มมีกล่องยืนยันแล้ว (รอบ 27) · **สำรองอยู่ในเบราว์เซอร์ของเครื่องนั้นเท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์สำรองหาย**

---

## 1) กฎการทำงานที่ตกลงกับเจ้าของงาน (ต้องยึดทุกครั้ง)

1. **แก้เฉพาะส่วนที่เขาบอก ห้ามแตะส่วนอื่น** — ไม่ refactor / ไม่จัดฟอร์แมต / ไม่ลบไฟล์เอง
2. **สรุปแผนก่อนลงมือทุกครั้ง** (ไฟล์ – บรรทัด – สิ่งที่เปลี่ยน – ผลกระทบ) แล้วขออนุมัติ
3. **สำรองไฟล์ก่อนแก้** — ถ้ายังไม่มี Git ให้ใช้ **`.bak1`** ไปก่อน (`Copy-Item "<ไฟล์>" "<ไฟล์>.bak1"`) แล้วลบทิ้งหลังยืนยันผล · ถ้าตั้ง Git แล้วให้ commit ก่อนแก้ทุกครั้ง (คำสั่งในหัวข้อ 8)
4. หลังแก้: รายงาน diff + วิธีทดสอบให้เจ้าของงานทดสอบเอง (agent รันเบราว์เซอร์ไม่ได้)
5. **ก่อนลบไฟล์**: ยืนยัน resolved absolute path ให้ตรงกับที่อนุมัติแล้วจึงลบ
6. **ห้ามส่งงานโดยที่เทสต์ไม่ผ่าน** — `node tests\smoke-test.js` ต้องขึ้น `ALL CHECKS PASSED` และ `node tests\probe-bugs.js` ต้องได้ `FAIL = 0` ถ้าเทสต์เดิมต้องแก้ ให้แก้พร้อมเหตุผล (เทสต์บางข้อเคย "ผ่านฟรี" เพราะ mock ไม่ครบ — ดูหัวข้อ 6)
7. **แก้ข้อมูลในตาราง = ต้องคิดถึง 3 ทางเสมอ**: (ก) ตารางอื่นที่ซิงก์กัน (ข) ไฟล์ JSON (ค) Excel 8 ชีต — และต้องทดสอบ round-trip
8. **กฎการอัปเดตเลข Version (`+0.0001` ทุกครั้งที่มีการแก้ไข)**: เมื่อมีการแก้ไขโค้ดทุกครั้ง ต้องเพิ่มเลขเวอร์ชันใน `APP_VERSION` (`js/state.js`) และป้าย `#devBadge` (`index.html` บรรทัดที่ 2 ของปุ่ม `💻 พัฒนาโดย สจจ.2`) ขึ้นทีละ **`0.0001`** เสมอ (เช่น `Version 1.0001` → `Version 1.0002`)


---

## 2) ภาพรวมโปรเจกต์

Static site ล้วน — ไม่มี build, ไม่มี dependency installer, **ยังไม่มี Git** (มี `.gitignore` เตรียมไว้ · เครื่องติดตั้ง Git 2.55 แล้ว)
เปิด `index.html` ตรง ๆ ได้ แต่ต้องมีอินเทอร์เน็ตเพราะโหลด **pdf.js** (cdnjs 3.11.174) · **SheetJS/xlsx** (cdn.sheetjs.com 0.20.3 — มี fallback ไป cdnjs 0.18.5) และโลโก้จาก i.ibb.co

**หน้าที่:** อัปโหลดแปลน (รูปภาพ/PDF) → กำหนดจุดอ้างอิง P1/P2 (กม.–ระดับ) → ลากเส้นดินเดิม/วาดเส้นระดับบนภาพ → กรอกตาราง 8 แท็บ (+ แท็บย่อยของ setting อีก 2) → บันทึก JSON (แนบภาพแปลนไปด้วยตั้งแต่รอบ 27) / ส่งออก Excel 8 ชีต / นำเข้ากลับ / Copy ทุกตาราง

**เมนูที่ยังเป็น "หน้าว่าง" (7 จุด):** แผนที่ระบบงาน · แผนงานโครงการ (เมนูซ้าย) · แผนจัดซื้อจัดจ้าง · ส่วนเรียกเก็บค่าใช้จ่าย · (เมนูย่อย) ส่วนคำนวณปริมาณ · ส่วนราคาวัสดุ · พิมพ์รายงาน

---

## 3) โครงสร้างไฟล์ปัจจุบัน

### ไฟล์ที่ถูกโหลดจริง (18 ไฟล์)

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้า + markup กล่องยืนยัน/ที่วางข้อความแจ้งเตือน + แท็บย่อยของ setting + โหลดสคริปต์ 15 ไฟล์ |
| `style.css` | สไตล์ทั้งหมด + `.ui-toast*` / `.ui-modal*` / `.settings-subtabs-bar` / `.subtab-btn` / `.table-input.editable` · **รอบ 30: `.ai-result-*` / `.ai-diff-*` (แท็บผลอ่าน AI)** |
| `js/state.js` | ตัวแปรสถานะกลาง · ตัวเลือกอาคาร · `ditchTypeDatabase` · `structureTypeDatabase` · กฎและชื่ออาคารของแท็บใหม่ · **รอบ 30: `canvasLabels` / `draggingCanvasLabel` / `aiRefPoints` / `aiLabels` / `aiLastResults`** |
| `js/canvas-viewer.js` | เมนู · อัปโหลด/PDF · ซูม/แพน/zoom win · แว่นขยาย · P1/P2 · ลากเส้นดินเดิม · **UI ยืนยัน/toast/prompt** · `switchMainMenu` / `switchSubMenu` · `redraw()` · DPR · **รอบ 30: `loadCropFrameIntoViewer` / Label Layer (`drawCanvasLabels`, `findHitCanvasLabel`) / AI อ่านกรอบจริง** |
| `js/table-core.js` | `updateTable()` (ตัวจ่าย) · `syncTableInputsToChannels` · `switchTableTab` · `switchSettingsSubTab` · Excel navigation · **รอบ 30: แท็บ `ai-result`** |
| `js/table-sync.js` | ซิงก์ข้อมูลข้ามแท็บ · `getHFromLevelTab` · `computeStructureItemName` · `syncAttachmentRowsWithLevel` |
| `js/tab-project.js` | แท็บแผนงานโครงการ |
| `js/tab-ditch.js` | แท็บระบบคูส่งน้ำ |
| `js/tab-dimension.js` | แท็บมิติคูส่งน้ำ |
| `js/tab-level.js` | แท็บระดับคูส่งน้ำ (+ คำนวณ BL/TBL, วาดเส้นระดับ) |
| `js/tab-ground.js` | แท็บระดับดินเดิม (+ คำนวณ, วาดเส้นดินเดิม) |
| `js/tab-structure.js` | แท็บอาคารประกอบ |
| **`js/tab-attachment.js`** | **แท็บใหม่ "อาคารท่อรับน้ำเข้าแปลงไร่นา"** |
| `js/tab-type.js` | แท็บย่อย setting: Typeคูส่งน้ำ + Typeอาคารประกอบ |
| **`js/tab-ai-result.js`** | **รอบ 30: แท็บ "🤖 ผลอ่าน AI" — diff-preview + เลือกส่วนที่นำเข้า + ปุ่มนำเข้าข้อมูล** |
| `js/io-manager.js` | Copy · บันทึก/โหลด JSON · ส่งออก/นำเข้า Excel · **รอบ 30: `buildCropFramesPayload` / `restoreCropFrames` / `restoreMediaState` / `buildGroundGroupStateForSave` + กันไฟล์ใหญ่เกิน 20 MB** |
| **`js/ai-reader.js`** | **รอบ 30: ไฟล์ใหม่ — prompt/schema + เรียก Vision API + parse/normalize + สร้าง overlay + นำเข้าลงตาราง** |
| **`js/tab-validate.js`** | **รอบ 41: ไฟล์ใหม่ — ระบบตรวจสอบข้อมูลข้ามแท็บ (9 ชุดกติกา) + แท็บผลสีแดง `#validationTabHost` + ไฮไลต์ช่องสีแดงอ่อน + เรียก AI เสนอแนวทางแก้ไข + `confirmValidateBeforeSave()` (ถามก่อนบันทึก/ส่งออก)** |
| **`js/tab-export-preview.js`** | **รอบ 42: ไฟล์ใหม่ — หน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก" (`#exportPreviewOverlay`) แบบแยกหน้าต่าง · แท็บแรก "📑 รวมข้อมูล" รวม 3 แท็บ (ระดับดินเดิม · ระดับคูส่งน้ำ · อาคารประกอบ) ในตารางเดียวกัน พร้อมคอลัมน์ "ตาม กม." และเรียงตาม กม. · ปุ่ม "แยก กม. ทุกๆ .. ม." (5/10/20/25/50/100 ม. หรือกรอกเอง) เติมแถว BL/TBL ด้วยสูตร SLOPE และระดับดินเดิมด้วยการ interpolate** |
| **`js/ai-credit.js`** | **รอบ 42: ไฟล์ใหม่ — ระบบเครดิต AI + คิวงานอ่านรูปที่ค้างไว้ (เก็บใน localStorage: `bclc_ai_credit_v1` / `bclc_ai_queue_v1`) · หน้าต่าง "💳 เครดิต AI" (`#aiCreditOverlay`) + ป้ายตัวเลขบนปุ่มแถบข้าง · เมื่อเติมเครดิตแล้วและมีงานค้าง → ถาม "ทำงานที่ค้างให้ดำเนินการต่อไหม?" อัตโนมัติ** |

**ลำดับการโหลดใน `index.html`:** `state.js` → `tab-project.js` → `table-core.js` → `table-sync.js` → `tab-*.js` (8) → `tab-ai-result.js` → **`tab-validate.js`** (รอบ 41) → `io-manager.js` → **`tab-export-preview.js`** (รอบ 42 · ต้องหลัง `io-manager.js` เพราะใช้ `buildExportSheetsData()`) → **`ai-credit.js`** (รอบ 42) → `canvas-viewer.js` → **`ai-reader.js`** (ต้องหลัง `canvas-viewer.js` เพราะใช้ `aiCurrentSettings`/`imgScale`) → inline script เรียก `syncSettingsSubTabUI(); syncDimensionRowsWithChannels(); updateTable();` + `loadAiCreditState(); updateAiCreditBadge();` (รอบ 42)

### ไฟล์ทดสอบ (ไม่ถูกโหลดโดยเว็บ)

| ไฟล์ | หน้าที่ |
|---|---|
| `tests/smoke-test.js` | เทสต์หลัก — รันโค้ดจริง (12 ไฟล์ JS) ด้วย DOM จำลอง + parser อ่านตาราง HTML จริง + XLSX จำลอง และ **ทดสอบ `loadProjectJSON()` / `importAllFromExcel()` จริง** · **448 ข้อ** · สั่ง `node tests\smoke-test.js` |
| `tests/probe-bugs.js` | ชุด "ล่าบั๊ก/กันบั๊กกลับมา" — DOM จำลองที่เหมือนเบราว์เซอร์กว่า (canvas/Image/XLSX อ่านหัวตารางได้จริง) · **44 ข้อ · ต้องได้ FAIL = 0** · สั่ง `node tests\probe-bugs.js` |
| `tests/check-round26.js` · `check-safety.js` · `check-save-rule.js` · `check-ui-round18.js` | เทสต์แบบตรวจข้อความในโค้ด (static) จากรอบก่อน ๆ — ยังรันได้แต่ไม่ครอบคลุมเท่า 2 ไฟล์บน |
| **`tests/round30-check.js`** | **รอบ 30: ชุดตรวจเฉพาะรอบนี้ — persistence (cropFrames/canvasLabels/groupState) + Label Layer + AI Reader + แท็บ diff-preview · **86 ข้อ** · สั่ง `node tests\round30-check.js`** |
| **`tests/check-ai-error.js`** | **รอบ 30: ทดสอบ `describeAiApiError()` กับ error จริง 8 เคส (billing_not_active / 401 / 429 / 404 / 413 / 403 / 5xx / ไม่รู้จัก) · สั่ง `node tests\check-ai-error.js`** |
| **`tests/check-all-encoding.js`** | **รอบ 31: สแกนทุกไฟล์ในโปรเจกต์ว่าเป็น UTF-8 สะอาด (ไม่มี mojibake / U+FFFD / BOM) · สั่ง `node tests\check-all-encoding.js` → ต้องขึ้น "OK - all files are clean UTF-8"** |
| **`tests/verify-file.js`** | **รอบ 31: ตรวจไฟล์ HTML/JS รายไฟล์ (ไทยครบ, ไม่มี mojibake, โครงสร้างถูก) · `node tests\verify-file.js index.html`** |
| **`tests/bump-version.js`** | **รอบ 31: เพิ่มเลข cache-busting `?v=` อย่างปลอดภัย (ใช้แทน PowerShell ที่ทำไทยเพี้ยน) · `node tests\bump-version.js 20261025d`** |
| **`tests/check-migrate.js`** | **รอบ 31: ทดสอบ `migrateLegacyAiModel()` — แปลงชื่อโมเดลเก่า (`gpt-6-astra`) เป็น `gpt-4o` อัตโนมัติ 14 เคส · รอบ 43: เขียนใหม่ เพราะ `migrateLegacyAiModel()` ถูกยกเลิกไปแล้วในรอบ 35 → ตอนนี้ตรวจพฤติกรรมจริงของโค้ด (ค่าเริ่มต้น `gpt-4o` + ไม่มีการบังคับเปลี่ยนชื่อโมเดล + ประวัติ preset + รองรับ `max_completion_tokens`) · **12 ข้อ** · สั่ง `node tests\check-migrate.js`** |
| **`tests/check-round43.js`** | **รอบ 43: ชุดตรวจเฉพาะรอบนี้ — ตัวเลข 3 กรณีมาตรฐานตรง PDF อ้างอิงทุกตัวเลข + กรณีพิเศษ + แก้บั๊ก #1/#2/#3/#5/#7 + ไม่มี NaN + พื้นที่ต่อเนื่อง + ดึงค่าจากตารางแล้วรูปเปลี่ยนตาม กม. · **41 ข้อ** · สั่ง `node tests\check-round43.js`** |
| **`tests/restore-index.ps1`** | **รอบ 31: กู้ `index.html` ที่ encoding เพี้ยนจาก PowerShell (decode UTF-8 → encode cp874) · ใช้เมื่อเสียเท่านั้น** |
| **`tests/check-round41.js`** | **รอบ 41: ชุดตรวจเฉพาะรอบนี้ — ระบบตรวจสอบข้อมูลข้ามแท็บ + ไฮไลต์ช่องสีแดงอ่อน + ปุ่มลบชุดข้อมูลในแท็บ AI + คอลัมน์ "ช่วงคูน้ำ" + แยกภาพวาด/ปุ่มแสดงผลระหว่างแท็บ PDF กับแท็บรูปตัดตามยาว + ปุ่มจุด P1 P2 · **100 ข้อ** · สั่ง `node tests\check-round41.js`** |
| **`tests/check-round42.js`** | **รอบ 42: ชุดตรวจเฉพาะรอบนี้ — audit ปุ่มทั้งหมด (handler/ฟังก์ชันว่าง/id ซ้ำ) + หน้าต่างตรวจสอบก่อนส่งออก (แท็บรวม + สลับแท็บ) + ปุ่ม "แยก กม. ทุกๆ .. ม." (คำนวณ BL/TBL/ระดับดินเดิม) + เรียงตาม กม. + ระบบเครดิต/คิวงานค้าง/ถามทำต่อ · **~110 ข้อ** · สั่ง `node tests\check-round42.js`** |

> ⚠️ **บทเรียน:** `smoke-test.js` เคย "ผ่านฟรี" หลายข้อ เพราะ XLSX จำลองไม่มี `read()` → ทางนำเข้า Excel ล้มเหลวเงียบ ๆ แล้วเทสต์เทียบค่าเดิมกับค่าเดิม · **แก้แล้วในรอบ 27** (mock มี `read` + `sheet_to_json` ที่อ่านหัวตารางเป็น key และมีข้อตรวจว่า import ทำงานจริง)

### ระบบสำรอง / ควบคุมเวอร์ชัน (สถานะจริง ณ 2026-10-24 — รอบ 28)

| เรื่อง | สถานะจริงตอนนี้ |
|---|---|
| ไฟล์สำรอง `.bakN` เดิม 187 ไฟล์ | ลบหมดแล้วในรอบ 27 · **zip สำรอง `_backup_archive\เวบ2_backups_2026-10-16.zip` ไม่มีอยู่ในโปรเจกต์นี้แล้ว** (หายไประหว่างย้ายโฟลเดอร์) |
| Git | **ยังไม่มี repo** ใน `G:\My Drive\web2` (`git status` → *not a git repository*) · ติดตั้ง Git 2.55 ในเครื่องแล้ว · มี `.gitignore` เตรียมไว้ · **ยังไม่มี `GIT-SETUP.md` / `git-init.bat` / `git-init.ps1`** |
| ไฟล์สำรองปัจจุบัน | `js/table-core.js.bak1` + `HANDOFF.md.bak1` (สร้างรอบ 28) · `tests\smoke-test.js.bak_20261017-*` 2 ไฟล์ (ขยะจากรอบก่อน) |
| ขยะ sync (Dropbox/Google Drive) | `*.tmpdir/`, `._*`, `.DS_Store`, `~$*` ถูกกันไว้ใน `.gitignore` — อาจโผล่ใหม่ได้ระหว่างที่ Google Drive กำลังซิงก์ ก็ลบทิ้งได้เลย |

**กติกาปัจจุบัน:** ยังไม่มี Git → ใช้ **สำรอง `.bak1` ก่อนแก้** แล้วลบทิ้งหลังยืนยันผล · **ควร `git init` + commit ครั้งแรกโดยเร็ว** (คำสั่งอยู่ในหัวข้อ 8) เพราะโฟลเดอร์อยู่บน Google Drive ที่ sync ชนกันได้

### ⚠️ ขั้นตอนบังคับ: ตรวจชื่อไฟล์หลัง sync (เพิ่มรอบ 28)

Google Drive (และ Dropbox เดิม) จะ**เติมเลข `(1)`, `(2)` ต่อท้ายชื่อไฟล์** เมื่อสองเครื่องแก้ไฟล์เดียวกันพร้อมกัน → ไฟล์ต้นฉบับถูกแทนที่ด้วยสำเนา → **`index.html` โหลดสคริปต์ไม่ครบ → แท็บทั้งหมดพัง**

> อาการที่เจอจริงรอบ 28: `js/tab-ditch.js`, `js/tab-level.js`, `js/tab-structure.js` กลายเป็น `tab-ditch (1).js`, `tab-level (1).js`, `tab-structure (1).js` → 3 แท็บหาย + เทสต์รันไม่ได้ (`ENOENT`)

### ⚠️ ขั้นตอนบังคับ: ห้ามแก้ไฟล์ด้วย PowerShell Get-Content/Set-Content (เพิ่มรอบ 31)

> **อาการที่เจอจริงรอบ 31:** ใช้ `Get-Content index.html -Raw | Set-Content index.html -Encoding UTF8` เพื่อแก้เลขเวอร์ชัน cache → **ไฟล์เสียทั้งไฟล์** ภาษาไทยกลายเป็น mojibake (`รอบ` → `เธฃ`) · เพิ่ม BOM · ไฟล์โตจาก 32KB เป็น 52KB

**สาเหตุ:** PowerShell 5.1 (ที่มากับ Windows) อ่านไฟล์ด้วย **ANSI codepage (cp874 ไทย)** ไม่ใช่ UTF-8 → พอเขียนกลับเป็น UTF-8 ตัวไทยที่อยู่นอก cp874 จะเพี้ยนหรือหาย

**✅ วิธีที่ถูกต้อง — ใช้เครื่องมือใน Cursor เท่านั้น:**
- `StrReplace` / `Write` / `Read` — ปลอดภัย เขียน UTF-8 ถูกต้องเสมอ
- `node -e "..."` เพื่อแก้แบบ regex (Node อ่าน/เขียน UTF-8 ถูกต้อง)
- `python -c "..."` เช่นเดียวกัน (แต่ต้องระวัง `print()` ภาษาไทย → UnicodeEncodeError บน console cp874 → ใช้ `json.dumps` หรือเขียนลงไฟล์แทน)

**❌ ห้ามใช้:**
```powershell
(Get-Content file.txt -Raw) | Set-Content file.txt -Encoding UTF8   # เพี้ยนไทย!
(Get-Content file.txt) | Set-Content file.txt                        # เพี้ยน + เพิ่ม BOM
```

**ถ้าเกิดเสียแล้ว:** กู้ได้ด้วย `tests\restore-index.ps1` (decode UTF-8 → encode cp874) · แต่**อักขระที่หายจะกู้ไม่ได้** → ต้องไปเอาเวอร์ชันเดิมจาก Google Drive version history

**ตรวจสอบหลังแก้ไฟล์เสมอ:** `node tests\check-all-encoding.js` → ต้องขึ้น "OK - all files are clean UTF-8"

### ⚠️ ขั้นตอนบังคับ: เพิ่มเลขเวอร์ชัน ?v= หลังแก้ไฟล์ JS (เพิ่มรอบ 30)

**อาการที่เจอจริงรอบ 30:** แก้โค้ด `js/ai-reader.js` เสร็จ · รันเทสต์ผ่านหมด · แต่ **หน้าเว็บยังแสดงของเดิม** เพราะเบราว์เซอร์ใช้ไฟล์ JS เก่าจาก cache (โดยเฉพาะเปิดผ่าน `file://` หรือ Google Drive)

**แก้แล้ว:** ทุก `<script src="js/...">` ใน `index.html` มี `?v=20261025a` ต่อท้าย → แก้ไฟล์ JS แล้ว**ต้องเปลี่ยนเลขนี้** ทุกครั้ง ไม่งั้นเบราว์เซอร์ยังโหลดไฟล์เก่า

```powershell
# ดูเลขเวอร์ชันปัจจุบัน
Select-String -Path index.html -Pattern '\?v=' | Select-Object -First 3

# ✅ เพิ่มเลขเวอร์ชันใหม่ (ใช้ Node — ปลอดภัยจากปัญหา encoding)
node tests\bump-version.js 20261025c
```

> ⚠️ **ห้ามใช้** `(Get-Content index.html -Raw) -replace ... | Set-Content index.html -Encoding UTF8` เพราะ PowerShell 5.1 จะทำให้ภาษาไทยเพี้ยน (ดูหัวข้อ "ห้ามแก้ไฟล์ด้วย PowerShell" ด้านบน)

> ⚠️ **อย่าลืม:** แก้ `style.css` ก็ต้อง hard-refresh (`Ctrl+Shift+R`) เพราะ CSS ไม่ได้ใส่ `?v=` · เทสต์ `tests/round30-check.js` มีข้อตรวจว่า **ทุก script ต้องมี `?v=` และใช้เลขเดียวกันทั้งหมด** → ถ้าเพิ่มไฟล์ JS ใหม่ต้องเพิ่ม `?v=` ด้วย

**ตรวจก่อนเริ่มงานทุกครั้ง (คัดลอกคำสั่งนี้ไปรันในโฟลเดอร์งาน):**
```powershell
# 1) หาไฟล์ชื่อเพี้ยน (มี "(1)" / "(2)" ต่อท้าย)
Get-ChildItem -Recurse -File | Where-Object { $_.Name -match '\(\d+\)' } | Select-Object FullName

# 2) ตรวจว่าไฟล์ที่ index.html อ้างถึงมีอยู่จริงทุกไฟล์
$html = Get-Content index.html -Raw
[regex]::Matches($html,'(?:src|href)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -notmatch '^https?://' } | ForEach-Object {
    if (Test-Path $_) { "OK   $_" } else { "MISS $_" } }

# 3) รันเทสต์ (ต้องได้ ALL CHECKS PASSED และ FAIL = 0)
node tests\smoke-test.js
node tests\probe-bugs.js
```

**ถ้าเจอไฟล์ `(1)`:** ต้อง**เปลี่ยนชื่อกลับ** (ไม่ใช่แก้เนื้อในไฟล์ `(1)`) แล้วลบสำเนาทิ้ง — เช่น
```powershell
Rename-Item "js\tab-ditch (1).js" "tab-ditch.js"
```
> ⚠️ ถ้ามีทั้ง `xxx.js` และ `xxx (1).js` อยู่พร้อมกัน ให้เปรียบเทียบเนื้อหาก่อน (`Compare-Object (Get-Content a.js) (Get-Content "a (1).js")`) — ไฟล์ไหนใหม่กว่า/มีโค้ดครบกว่าให้เก็บไว้ แล้วลบอีกไฟล์ทิ้ง (เพราะ sync จะเติม `(2)`, `(3)` ไปเรื่อย ๆ)

### อื่น ๆ

- `HANDOFF.md.bak1` — สำรองไฟล์นี้ก่อนอัปเดตรอบ 28
- `js/table-core.js.bak1` — สำรองไฟล์นี้ก่อนลบฟังก์ชันซ้ำรอบ 28
- `tests\smoke-test.js.bak_20261017-195252` + `tests\smoke-test.js.bak_20261017-122113` — ไฟล์สำรองเทสต์จากรอบก่อน (รวม ~260 KB) · ขยะ ลบได้
- `Delete/` (local_agent.py, run_agent.bat) — **ไม่มีในโปรเจกต์นี้แล้ว**
- `.cursor\` — โฟลเดอร์ว่าง (เกิดจากการเปิดโปรเจกต์ด้วย Cursor) ไม่มีผลกับเว็บ และ Git ไม่ track โฟลเดอร์ว่าง

---

## 4) งานที่ทำในเซสชันนี้

| รอบ | อาการ/โจทย์ | การแก้ | ไฟล์ที่แก้ | สถานะ |
|---|---|---|---|---|
| 1 | ซูม/Reset ซูม แล้วเส้นและจุดเพี้ยน · ภาพเบลอบนจอ HiDPI | **A** เพิ่ม `scaleOverlayPixels(ratio)` ให้ `updateCanvasSize(oldScale)` ปรับพิกัด overlay 5 กลุ่ม · **B** เรนเดอร์ bitmap ที่ `devicePixelRatio` (เพดาน 2) + `setTransform` + ปรับแว่นขยายและ `centerImageInViewport` เป็น logical | `canvas-viewer.js` | ✅ ผู้ใช้ยืนยัน |
| 2 | ซูม win แล้ว **P2 กระโดด** · ปุ่ม **ลบเส้นไม่ทำงาน** | เพิ่มธง `suppressNextCanvasClick` (รีเซ็ตตอน mousedown, ตั้งตอนจบ zoom win, กลืนคลิกใน handler `click`) · เสริมความแข็งแรง `clearOnlyDrawingLines` (กัน `ch.rows` undefined + `try/finally` ให้ `redraw()` ทำงานเสมอ) | `canvas-viewer.js` | ✅ ผู้ใช้ยืนยัน |
| 3 | ต้นเหตุจริงของ "ลบเส้นไม่ทำงาน": จอมีเส้นค้างแต่ข้อมูลถูกล้างไปแล้ว | **X** ตัดการ `return` เงียบใน `clearOnlyDrawingLines` (ยืนยัน + redraw ทุกครั้ง) · **Y** ให้ `drawGroundFromTable()` และ `drawCanalLevelLines()` เรียก `redraw()` ทุกเส้นทางที่ออกกลางทาง (4 จุด) | `canvas-viewer.js`, `table-render.js` | ✅ ผู้ใช้ยืนยัน |
| 4 | **modal ถูกบล็อกในพรีวิว sandbox** → `alert/confirm/prompt` เงียบทั้งหมด | **Z** `uiConfirm(msg, onOk, opts)` · **W** `uiToast()` + override `window.alert` (ใช้กับ 33 จุดเดิมโดยไม่ต้องแก้ call-site) · เพิ่ม `uiPrompt()` (Promise) แทน `prompt()` ใน `saveFileWithDialog` | `index.html`, `style.css`, `canvas-viewer.js`, `io-manager.js` | ✅ ผู้ใช้ยืนยัน "ok ได้ละ" |
| 5 | โค้ดที่ไม่ได้ใช้ · ไฟล์ใหญ่เกินไป · ไฟล์ที่มีความเสี่ยง | ลบกลไกตาย **`r.pixel`** (−36 บรรทัด) · **แยก `table-render.js` 1,894 บรรทัด → 9 ไฟล์** · ลบ `Delete/.env` (มี GEMINI_API_KEY) + `js/table-render.js.bak` · ถอด id ไม่ใช้ออก 3 ตัว (`btn-clear-lines`, `jsonFileInput`, `excelFileInput`) | หลายไฟล์ | ⚠️ **ตรวจ static เท่านั้น ยังรอทดสอบ** |
| **6ก** | **แท็บอาคารประกอบ:** กด + ให้ H = 0 + แก้ H ได้ · เปลี่ยนชื่อคอลัมน์ "จำนวนท่อ" → "ความยาว (ม.)" · หมายเหตุเริ่มต้นว่าง | `addStructureRowAt` ใส่ `hOverride:"0.00"` และ `remark:""` · `updateStructureField` รับฟิลด์ `hOverride` · ช่อง H เรนเดอร์เป็น input ที่แก้ได้เมื่อปลดล็อก (ล็อกอยู่ = ดึงจากแท็ประดับคูส่งน้ำเหมือนเดิม) · `computeStructureItemName` ใช้ `hOverride` เมื่อมี · เปลี่ยนหัวคอลัมน์ · `syncStructureRowsWithLevel` และค่าเริ่มต้นทุกจุดเลิกใช้ `"-"` (ตอนโหลด JSON ไฟล์เก่าจะแปลง `"-"` → `""` ให้) | `state.js`, `table-sync.js`, `tab-structure.js` | ⚠️ รอทดสอบ |
| **6ข** | **เพิ่มแท็บ "อาคารท่อรับน้ำเข้าแปลงไร่นา"** | ไฟล์ใหม่ `js/tab-attachment.js` + สถานะ `attachmentRowsData` · คลองส่งน้ำ–คูส่งน้ำ ดึงจากแท็บมิติคูส่งน้ำ (ซิงก์ผ่าน `syncAttachmentRowsWithLevel`) · แถวแรกของแต่ละคู = "อาคารท่อรับน้ำเข้าแปลงไร่นา" (ล็อก, มีปุ่ม **+**) · แถวถัดไปเลือกรายการอาคารจากลิสต์ · ช่องที่แก้ไขได้ไฮไลต์สี (ภายหลังเปลี่ยนเป็นสีเขียวในรอบ 7) | `js/tab-attachment.js` (ใหม่), `state.js`, `table-core.js`, `table-sync.js`, `index.html`, `style.css` | ⚠️ รอทดสอบ |
| **6ค** | **เปลี่ยนชื่อแท็บ Typeคูส่งน้ำ → setting + แท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ** | แท็บ `setting` มีแถบแท็บย่อย 2 ปุ่ม (`subtab-btn-*`) แสดงเมื่ออยู่บนแท็บ setting · `currentTab` ใหม่ = `setting-type` / `setting-structure` · `structureTypeDatabase` (24 ชื่อ Type อาคารเดิม) ย้ายไปเก็บที่แท็บย่อยใหม่ · Excel: ชีต `Typeคูส่งน้ำ` รวมเป็นชีต `setting` (คอลัมน์ Typeคูส่งน้ำ / Typeอาคารประกอบ / B / H) · **ลิสต์ "ประเภทอาคาร" ของแท็บอาคารประกอบเปลี่ยนทั้งชุดตามรูปที่แนบ** (`structureOptions` = 6 แบบท่อรับน้ำเข้าแปลงไร่นา) | `index.html`, `style.css`, `state.js`, `table-core.js`, `tab-type.js`, `canvas-viewer.js`, `io-manager.js` | ⚠️ รอทดสอบ |
| **7** | **ปรับแท็บใหม่ + setting ตามที่เจ้าของงานตรวจแล้ว** | ดูตารางหัวข้อ **4.2** | `js/tab-attachment.js`, `state.js`, `table-sync.js`, `table-core.js`, `io-manager.js`, `canvas-viewer.js`, `index.html`, `style.css` | ⚠️ รอทดสอบ |
| **8** | **แก้ตามผลตรวจรอบ 2** — ยกเลิกสีช่องลิสต์, ล็อก ศก. ท่อ, เพิ่มคอลัมน์ความหนาในแท็บ Type, ซ่อมแถบแท็บ setting, รอข้อมูล Q/SLOPE | ดูตารางหัวข้อ **4.3** | `index.html`, `style.css`, `state.js`, `table-core.js`, `table-sync.js`, `tab-type.js`, `tab-attachment.js`, `io-manager.js` | ⚠️ รอทดสอบ |
| **9** | **เพิ่มลิสต์ให้คอลัมน์ Q และ SLOPE ในแท็บมิติคูส่งน้ำ** | ดูหัวข้อ **4.4** | `state.js`, `tab-dimension.js`, `io-manager.js` | ⚠️ รอทดสอบ |
| **10** | **เก็บสีเขียว/ตัด Type/ปรับสไตล์แท็บ ตามผลตรวจรอบ 3** | ดูหัวข้อ **4.5** | `state.js`, `tab-type.js`, `tab-attachment.js`, `style.css` | ⚠️ รอทดสอบ |
| **11** | **🐞 แก้บั๊ก "โหลดไฟล์ JSON ไม่ได้: Assignment to constant variable"** + ปรับปุ่ม +/− ตามรูป 9 | ดูหัวข้อ **4.6** | `state.js`, `tab-type.js`, `io-manager.js` | ⚠️ รอทดสอบ |
| **12** | *(ไม่พบร่องรอยในโค้ด/เทสต์)* | — | — | ? |
| **13** | นำเข้าข้อมูล Excel กลับ (round-trip) | ข้อตรวจ "นำเข้าชีต setting แล้วได้ … เท่าเดิม" + กันชื่ออาคารปนเข้าไปในลิสต์ Typeคูส่งน้ำ (หัวข้อ 20 ของ smoke-test) | `io-manager.js`, `tests/smoke-test.js` | ⚠️ รอทดสอบ · **ตอนนั้นเทสต์ข้อนี้ "ผ่านฟรี" — เพิ่งแก้ให้ทดสอบจริงในรอบ 27** |
| **14** | สถานะสีของแท็บ (ต้องมี active ตัวเดียวเสมอ) | `syncSettingsSubTabUI()` เคลียร์ active ทุกปุ่ม + แสดง/ซ่อนแถบแท็บย่อย (หัวข้อ 21) | `table-core.js` | ⚠️ รอทดสอบ |
| **15** | ตาราง Typeอาคารประกอบ 6 คอลัมน์ + ลิสต์ "ประเภทอาคาร" ดึงจากตาราง Type | เพิ่มคอลัมน์ "ชื่ออาคารประกอบ" + ให้แท็บอาคารประกอบอ่านตัวเลือกจาก `structureTypeDatabase` (หัวข้อ 21–22) | `tab-type.js`, `tab-structure.js`, `state.js` | ⚠️ รอทดสอบ |
| **16** | กฎการรวม "ชื่ออาคารประกอบ" 6 กฎ + แถวใหม่แก้ไขได้ทุกช่อง (พิมพ์ "-" ได้) | `computeStructureTypeName()` + `structureHasValue()` / `formatStructureCellValue()` (หัวข้อ 25–26) | `state.js`, `tab-type.js` | ⚠️ รอทดสอบ |
| **17** | คอลัมน์ "รายการอาคาร" ใช้ "ชื่ออาคารประกอบ" ที่รวมข้อมูลแล้ว | `computeStructureItemName()` + แสดงผลในตารางอาคารประกอบ (หัวข้อ 23) | `table-sync.js`, `tab-structure.js` | ⚠️ รอทดสอบ |
| **18** | ช่อง "-" → ล็อกบังคับ · เซฟค่าตัวเลขลงไฟล์ · สีเส้นใต้บรรทัด · ปุ่มหมุนภาพ | `structureNumericForFile()` / `structureRemarkForFile()` + คลาส `row-tint` + `rotateImageView()` และถอดปุ่ม หน้าก่อน/ถัดไป (หัวข้อ 27–30) | `io-manager.js`, `tab-structure.js`, `style.css`, `canvas-viewer.js` | ⚠️ รอทดสอบ |
| **19** | หมุนภาพวน 4 ครั้ง + Reset หมุน · ปุ่มล็อกชุดข้อมูลรายกลุ่ม · สีเส้นตาราง | `applyRotationToImage()` / `resetImageRotation()` + `toggleAttachmentGroupLock()` แทนปุ่มรวมด้านบน (หัวข้อ 31–33) | `canvas-viewer.js`, `tab-attachment.js`, `index.html`, `style.css` | ⚠️ รอทดสอบ |
| **21** | ปุ่ม + / − ของแท็บอาคารประกอบ (แถวแรกมี + · แถวจากระดับมี + · แถวผู้ใช้เพิ่มมี + −) | กติกาปุ่มใน `renderStructureTab()` (หัวข้อ 34) | `tab-structure.js` | ⚠️ รอทดสอบ |
| **23** | สีเส้นบนบรรทัดเฉพาะแถวที่มาจากระดับ · แถวแรก/สุดท้ายเลือกประเภทอาคารได้ | `shouldStructureRowHaveTint()` + ปลดล็อกช่อง "ประเภทอาคาร" ทุกแถว (หัวข้อ 35, 37) | `table-sync.js`, `tab-structure.js` | ⚠️ รอทดสอบ |
| **24** | 4 คอลัมน์สุดท้ายใช้ค่าเริ่มต้นจากตาราง Typeอาคาร + ช่องที่แก้ได้เป็นสีเขียว | `structureNameValue()` + สีเขียวในช่องที่แก้ได้ (หัวข้อ 38) | `table-sync.js`, `tab-structure.js`, `style.css` | ⚠️ รอทดสอบ |
| **25** | แถวที่คัดลอกจากระดับเลือกชื่ออาคารได้ · กด + ไม่คัดลอกค่าจากแถวบน | `nameEditable = !isLocked` + `addStructureRowAt()` ตั้งค่าช่องตัวเลขเป็นค่าว่าง (หัวข้อ 39) | `tab-structure.js`, `table-core.js` | ⚠️ รอทดสอบ |
| **26** | H ของแถวจากระดับดึงจากแท็ประดับคูส่งน้ำ (ยกเว้น กม.สิ้นสุด) · ค่าเริ่มต้นแถวกลาง = อาคารลดระดับ | `getStructureLevelH()` + `findLevelRowIndexForStructure()` + ธง `data-h-from-level` (หัวข้อ 36) | `table-sync.js`, `tab-structure.js`, `table-core.js` | ⚠️ รอทดสอบ |
| **27ก** | **ล่าบั๊กทั้งเว็บ (เจอ 11 บั๊ก)** | ดูหัวข้อ **4.7** · สร้างชุดทดสอบใหม่ `tests/probe-bugs.js` | 7 ไฟล์เว็บ + เทสต์ | ✅ เทสต์ผ่าน 347/44 · ⚠️ รอทดสอบบนเบราว์เซอร์ |
| **27ข** | **บั๊กจากการวิเคราะห์รอบ 2 + ความปลอดภัย dependency** | ดูหัวข้อ **4.7** | 12 ไฟล์เว็บ + เอกสาร/Git | ✅ เทสต์ผ่าน 347/44 |
| **28** | **3 แท็บหลักหาย (ระบบคูส่งน้ำ / ระดับคูส่งน้ำ / อาคารประกอบ)** — Google Drive เติมชื่อ `(1)` ให้ `js/tab-ditch.js`, `js/tab-level.js`, `js/tab-structure.js` → `index.html` โหลดไม่ได้ + เทสต์รันไม่ได้ (`ENOENT`) | **rename ไฟล์กลับ** (`tab-ditch (1).js` → `tab-ditch.js` ฯลฯ) + ลบ `openTakeoffFromEstimate()` ตัวที่ซ้ำใน `table-core.js` + อัปเดตเอกสารให้ตรงพาธจริง + เพิ่มหัวข้อ **"ตรวจชื่อไฟล์หลัง sync"** | `js/tab-ditch.js`, `js/tab-level.js`, `js/tab-structure.js`, `js/table-core.js`, `HANDOFF.md` | ✅ เทสต์ผ่าน 448/44 · ⚠️ รอทดสอบบนเบราว์เซอร์ |
| **29** | **แถวจุดอ้างอิง P1/P2** อยากเป็นข้อความสรุป + ย้ายปุ่มวาดเส้นระดับ + ลบคอลัมน์ "จัดการ" + เพิ่มปุ่มแสดงป้ายอาคารประกอบ | `renderReadonlyP1P2ToolbarRowHtml()` เปลี่ยนจากกล่องกรอกตัวเลข → ข้อความ "จุด P1 กม. 0+000 , ระดับ +250.00 / จุด P2 กม. 0+300 , ระดับ +254.00" + ข้อความ "(แก้ไขค่า จุด P1,P2 ได้ที่แท็ประดับดินเดิม)" **สีแดง** · รับพารามิเตอร์ `extraHtml` เพื่อแทรกปุ่ม · แท็บระดับคูส่งน้ำย้ายปุ่ม "📈 วาดเส้นระดับ" มาไว้ในแถวนี้ + ลบคอลัมน์ "จัดการ" (12 คอลัมน์) · แท็บอาคารประกอบเพิ่มปุ่ม "แสดงป้ายอาคารประกอบ" (`toggleStructureShowLabels`) + ตัวกรองใน `redraw()` | `js/table-core.js`, `js/tab-level.js`, `js/tab-structure.js`, `js/canvas-viewer.js`, `style.css` | ✅ เทสต์ผ่าน 448/44 + เช็คเฉพาะรอบ 29 ผ่าน 16/16 · ⚠️ รอทดสอบบนเบราว์เซอร์ |
| **30** | **กรอบรูปหายเมื่อบันทึก/โหลด JSON + Label Layer + อ่านข้อมูลด้วย AI** | ดูหัวข้อ **4.8** — บันทึกกรอบรูป/รูปอัปโหลดลงไฟล์ JSON (ย่อ JPEG 1800px) + กู้กลับมาพร้อมแท็บ/หน้าที่ค้างไว้ + `groupState`/P1-P2 (normalize เป็นสัดส่วน 0..1) + Label Layer (ป้ายลากย้าย/หมุนตามมุมข้อความ) + `js/ai-reader.js` (Vision API → JSON) + แท็บ "🤖 ผลอ่าน AI" (diff-preview + นำเข้า) | `js/state.js`, `js/io-manager.js`, `js/canvas-viewer.js`, `js/ai-reader.js` (ใหม่), `js/tab-ai-result.js` (ใหม่), `js/table-core.js`, `index.html`, `style.css` | ✅ เทสต์ผ่าน 448/44 + รอบ 30 ผ่าน 86/86 · ⚠️ รอทดสอบบนเบราว์เซอร์ |

| **31** | **แก้ "ทดสอบแล้วไม่มีอะไรเกิดขึ้น" + cache บังคุณโค้ดใหม่ + ข้อความ `/api/extract` ผิด + กู้ไฟล์ index.html ที่ encoding เพี้ยน + ข้อความ error บอกผิดเจ้าให้บริการ** | **A** `testAiConnectionConfig()` เดิมยิงแค่ `GET /models` → ผ่านแม้บัญชีไม่ active/โมเดลไม่มี → **เปลี่ยนมายิง `POST /chat/completions` จริง** พร้อมแสดง error ภาษาไทย · **B** เพิ่ม cache-busting `?v=20261025e` ทุก `<script src="js/...">` (+ `tests/bump-version.js`) · **C** `/api/extract` → `/v1/chat/completions` · **D** เพิ่มปุ่ม "🔄 ดูโมเดล" (`fetchAvailableAiModels()`) · **E** เปลี่ยนโมเดลเริ่มต้น `gpt-6-astra` → `gpt-4o` + **migrate ค่าเก่าใน localStorage อัตโนมัติ** (`migrateLegacyAiModel()`) · **F** รองรับ `max_completion_tokens` สำหรับโมเดลรุ่นใหม่ (gpt-5/o3) · **G** กู้ `index.html` ที่ PowerShell เพี้ยน encoding · **H** ข้อความ error เดาชื่อผู้ให้บริการจาก Base URL (`detectAiProviderName()`) แทนการ hardcode "Lovable" · เทสต์กันบั๊ก 38 ข้อ | `js/canvas-viewer.js`, `js/ai-reader.js`, `index.html`, `style.css`, `tests/round30-check.js`, `tests/probe-bugs.js`, `tests/check-all-encoding.js`, `tests/verify-file.js`, `tests/check-migrate.js`, `tests/bump-version.js`, `tests/check-ai-error.js`, `tests/restore-index.ps1`, `HANDOFF.md` | ✅ เทสต์ผ่าน 122/122 · ai-error 24/24 · encoding สะอาด 28 ไฟล์ · ทดสอบบนเบราว์เซอร์จริงแล้ว (ปุ่มดูโมเดล + fallback max_completion_tokens + ข้อความบอก OpenAI/Lovable ถูกต้อง) |
| **32** | **รวมกลุ่มป้าย AI + เชื่อมเส้นระดับตาม กม. + เปลี่ยนกากบาทลบกรอบจากแดงเป็นเทา** | เพิ่ม `parseChainageKm`, `aiMergeLabelGroup`, `aiGroupOverlayLabels`, `aiResolveLevelLineEndpoints` ใน `js/ai-reader.js` · วาดป้ายหลายบรรทัดใน `js/canvas-viewer.js` · เปลี่ยนสีกากบาทเป็น `#6b7280` | `js/ai-reader.js`, `js/canvas-viewer.js`, `style.css`, `tests/check-round32.js` | ✅ เทสต์รอบ 32 ผ่าน 44/44 |
| **33** | **ตรวจสอบและล่าบั๊กเชิงลึกทั้งโปรเจกต์ (พบและแก้ 11 รายการ)** | **1)** กู้คืนจุด P1/P2 และเส้นวาดหลัง `renderPDFPage()` เมื่อโหลด JSON ที่แนบ PDF · **2)** เก็บพิกัดสัดส่วน `normX/normY` ของ `canvasLabels` + `resyncCanvasLabelsForActiveFrame()` เมื่อสลับกรอบหรือโหลดไฟล์ และกันการซูมบนแท็บ PDF ไปขยายป้ายของกรอบรูป · **3)** `scaleOverlayPixels()` และ `rotateOverlayPixels()` ปรับพิกัดปลายเส้นระดับ AI (`x2, y2`) ด้วย · **4)** นำเข้าดินเดิมจาก AI เรียง `[first, ...body, last]` และแยก object ขอบเขตต้น/ปลาย · **5)** นำเข้ามิติเช็ก `if (aiCh.dimension)` ก่อนเขียนทับ + นำเข้าอาคารแยก `startBoundaries` / `endBoundaries` คงแถว `isFromLevel` และไม่เอาค่า `0` ทับค่าตาราง · **6)** `applyAiResultsFromTab()` จับคู่กรอบด้วย `res.frameId` และส่ง `channelId` เข้า `applyAiRefPointsToGroupState()` · **7)** ใช้ `uiConfirm()` แทน `confirm()` เมื่อไฟล์ JSON เกิน 20 MB · **8)** ซ่อน `#estimateSummaryPage` / `#projectPlanPage` เมื่อสลับไปเมนู Setting หรือเมนูย่อย และแก้เช็ก `settingsSubTab === 'structure'` · **9)** `findHitCanvasLabel()` หมุนพิกัดเมาส์ย้อนมุม `-angle` และคำนวณความสูงหลายบรรทัด · **10)** `copyTableData()` คัดลอกครบทุกคอลัมน์ในแท็บ `structure`, `setting-type`, `setting-structure` · **11)** อัปเดต regex ใน `tests/round30-check.js` ให้รองรับ kind `'h'` + เพิ่มเทสต์ `P11` (8 ข้อ) ใน `tests/probe-bugs.js` + bump เวอร์ชันเป็น `?v=20261025g` | `js/io-manager.js`, `js/canvas-viewer.js`, `js/ai-reader.js`, `js/tab-ai-result.js`, `index.html`, `tests/round30-check.js`, `tests/probe-bugs.js`, `HANDOFF.md` | ✅ เทสต์ผ่านครบทุกชุด 100% (smoke 448 · probe 52 FAIL=0 · round29 16/16 · round30 122/122 · round32 44/44 · ai-error 24/24 · migrate 14/14 · encoding สะอาด) |

> **หมายเหตุการบันทึก:** รอบ 1–11 บันทึกโดยเซสชันเดิม · **รอบ 12–26 ไม่ได้ถูกบันทึกไว้ตอนนั้น** — ตารางนี้สรุปย้อนหลังเมื่อ 2026-10-16 จาก *ชื่อหัวข้อใน `tests/smoke-test.js`* และโค้ดที่ยังอยู่ในโปรเจกต์ จึงไม่มีรายละเอียดลึกเท่ารอบก่อน ๆ · **รอบ 20 และ 22 ไม่พบร่องรอยในโค้ด/เทสต์** (อาจเป็นรอบทดสอบ/รอบที่ย้อนกลับ)

### 4.7) รายละเอียดรอบ 27 (2026-10-16) — ล่าบั๊กทั้งเว็บ + แก้บั๊กที่เจอ + ความปลอดภัย

**วิธีทำงานรอบนี้:** อ่านโค้ดจริงทั้ง 15 ไฟล์ → เขียน **`tests/probe-bugs.js`** ที่รันโค้ดจริงบน DOM จำลอง (มี canvas/Image/XLSX ที่อ่านหัวตาราง Excel ได้จริง) เพื่อ *พิสูจน์* ทุกบั๊กก่อนแก้ → แก้ → เพิ่มข้อตรวจกันบั๊กกลับมา (smoke 336 → **347** · probe → **44**)

**27ก — 11 บั๊กแรก (ยืนยันด้วยการรันโค้ดจริงทุกข้อ)**

| # | บั๊ก | ผลกระทบ | แก้ที่ |
|---|---|---|---|
| 1 | เพิ่ม/ลบคูส่งน้ำ ไม่เลื่อน `attachmentRowsData` | แถวแท็บอาคารท่อรับน้ำไปโผล่ผิดคู + เหลือ "แถวผี" ติดไปในไฟล์ | [tab-ditch.js](js/tab-ditch.js) (`addChannelAt`/`deleteChannelAt`) |
| 2 | `loadProjectJSON()` เขียนทับเฉพาะคีย์ที่มีในไฟล์ | ไฟล์เก่าไม่มีคีย์ไหน = ข้อมูลโปรเจกต์เดิมค้าง ปนกัน 2 โปรเจกต์ | [io-manager.js:253](js/io-manager.js#L253) + snapshot ค่าตั้งต้น [state.js:118](js/state.js#L118) |
| 3 | Excel: กม. ถูกปัดเป็นจำนวนเต็มเมตร | ไป-กลับไฟล์ทีหนึ่งคลาดเคลื่อนถึง ±0.5 ม. | [formatKmForExport()](js/table-core.js#L26) |
| 4 | Excel: แถวที่มาจากแท็ประดับคูส่งน้ำ → แถวซ้ำ + ค่า H หาย | จำนวนแถวเพิ่ม ชื่ออาคารเพี้ยน | คอลัมน์ "จากระดับ" + [sameStructureKm()](js/table-sync.js#L93) + กันซ้ำไฟล์เก่า |
| 5 | Excel: `0.30` → `0.3` · ช่องว่าง → `0` | ชื่ออาคารเพี้ยน เช่น `(H=1.25,ศก. 0.3x5)` | [excelCellText2()](js/io-manager.js#L31) + `pickUserVal()` |
| 6 | Excel: คูชื่อซ้ำ/ว่าง "-" → ข้อมูลยุบไปคูแรก | ข้อมูลหายเมื่อคูชื่อซ้ำ | คอลัมน์ "ลำดับคู" + [makeChannelResolver()](js/io-manager.js#L41) |
| 7 | หมุนภาพแล้ว P1/P2 + เส้นไม่หมุนตาม | จุด/เส้นชี้ผิดตำแหน่ง → ค่าที่ถอดได้ผิด | [rotateOverlayPixels()](js/canvas-viewer.js#L110) |
| 8 | หมุนภาพแล้วภาพไม่ถูกวาดใหม่ (ขึ้นกับจังหวะ decode) | จออาจว่างหลังกดหมุน | [applyRotationToImage(deltaDeg, onDone)](js/canvas-viewer.js#L134) + fit/redraw ใน `onload` (มุมหมุนคงอยู่เมื่อเปลี่ยนหน้า PDF ด้วย) |
| 9 | สถานะ 🔒/ยุบกลุ่ม (คีย์ตาม index) ไม่เลื่อนตามตอนเพิ่ม/ลบคู | คูที่เหลือได้สถานะล็อก/ยุบผิด | [shiftAllChannelGroupStates()](js/tab-ditch.js#L25) |
| 10 | กด + ที่แถวสุดท้ายของแท็บระดับคูส่งน้ำ ได้ช่วงยาว 0 | แถวใหม่ใช้งานไม่ได้ ต้องไปแก้แท็บมิติก่อน | [addLevelRowAt()](js/tab-level.js#L35) แบ่งครึ่งช่วงให้ |
| 11 | **เทสต์ import Excel "ผ่านฟรี"** (mock ไม่มี `XLSX.read`) | บั๊ก 4–6 รอดเทสต์มาได้ตลอด | เพิ่ม `read` + `sheet_to_json` ที่อ่านหัวตารางเป็น key |

**27ข — บั๊กจากการวิเคราะห์รอบ 2 + ความปลอดภัย dependency**

| # | เรื่อง | แก้ที่ |
|---|---|---|
| 1 | ลบข้อมูล 8 ปุ่มไม่ถามยืนยัน (ลบคู = ลบข้อมูล 5 แท็บพร้อมกัน) | [confirmDelete()](js/table-core.js#L62) + แยกฟังก์ชันทำงานจริงเป็น `doDeleteXxx()` |
| 2 | 📋 Copy ล้มเหลวแบบเงียบ (ไม่มี `.catch()` · clipboard ใช้ไม่ได้บน `file://`) | [writeToClipboard()](js/io-manager.js#L69) + fallback `execCommand` + แจ้งเตือน |
| 3 | 💾 JSON ไม่เก็บภาพ → เปิดไฟล์เก่าเห็นจุด/เส้นลอย · อัปโหลดภาพใหม่แล้วจุด/เส้นถูกล้าง | แนบภาพย่อ JPEG ≤2200px + `imageRotation` + พิกัดเป็น `coordSpace:'image'` ([buildOverlayPayload()](js/io-manager.js#L255) · [restoreProjectImage()](js/io-manager.js#L275)) + เตือนไฟล์เก่าที่ไม่มีภาพ |
| 4 | เปลี่ยนชื่อ Type ใน setting → แถวอาคารประกอบเดิมพัง | [updateStructureTypeField()](js/tab-type.js#L155) อัปเดต `structureRowsData` ตามชื่อใหม่ |
| 5 | คอลัมน์ "ความยาว (ม.)" ใช้ลิสต์ "จำนวนท่อ" | เพิ่ม [lengthOptions](js/state.js#L236) (0.50–10.00) และลบ `pipeCountOptions` ที่ไม่ใช้แล้ว |
| 6 | ซูมลึกบนภาพใหญ่ → canvas ใหญ่เกินเพดานเบราว์เซอร์ → จออาจว่าง | [computeRenderDPR()](js/canvas-viewer.js#L30) ยอมลด dpr ต่ำกว่า 1 + clamp bitmap ให้ตรงกับ transform |
| 7 | pdf.js **CVE-2024-4367** (เปิด PDF ประสงค์ร้าย → รัน JS ได้) | [isEvalSupported: false](js/canvas-viewer.js#L592) ตาม workaround ใน advisory |
| 8 | xlsx 0.18.5 มี **CVE-2023-30533** (prototype pollution ตอนอ่านไฟล์) | เปลี่ยนเป็น SheetJS **0.20.3** ([index.html:16](index.html#L16)) + fallback cdnjs เดิม |
| 9 | ไลบรารีโหลดไม่ขึ้น → ปุ่มเงียบ/error ดิบ | กัน `pdfjsLib` / `XLSX` undefined แล้วขึ้นข้อความบอกให้เช็คเน็ต+รีเฟรช |

**รูปแบบไฟล์ที่เปลี่ยนในรอบ 27 (ต้องรู้ก่อนแก้ต่อ)**
- **Excel ชีตข้อมูลมีคอลัมน์ท้ายเพิ่ม**: "ลำดับคู" (ทุกชีตข้อมูล) และ "จากระดับ" (ชีตอาคารประกอบ) — ตัวนำเข้าใช้คอลัมน์นี้ก่อน ถ้าไม่มี (ไฟล์เก่า) จะจับคู่จากชื่อ คลอง+คู แทน
- **กม. ใน Excel** เขียนเป็น `1+050.40` เมื่อมีเศษเมตร (เดิมปัดทิ้ง) — `parseKmInput()` อ่านได้ทั้งไฟล์เก่า/ใหม่
- **ช่องว่าง** (พื้นที่ทั้งหมด/พื้นที่ส่งน้ำ/ระดับดินเดิม) คงเป็นช่องว่าง (เดิมกลายเป็น `0`)
- **JSON** มีคีย์ใหม่ `imageData` (ภาพย่อ + ขนาดภาพเต็ม) · `imageRotation` · `drawingData.coordSpace = 'image'` (พิกัดอ้างภาพเต็ม ไม่ผูกกับซูม/ขนาดหน้าต่าง) → ไฟล์ใหญ่ขึ้นประมาณ 0.3–1.5 MB
- **การลบทุกปุ่ม** ผ่าน `confirmDelete()` → ถ้าหน้านั้นไม่มี `uiConfirm` (เช่นตอนรันเทสต์) จะลบทันทีเหมือนเดิม

### 4.8) รายละเอียดรอบ 30 (2026-10-24) — กรอบรูปคงอยู่ในไฟล์ + Label Layer + อ่านข้อมูลด้วย AI

**ปัญหาที่แก้:** เดิม `pdfCropFrames` (กรอบรูปที่ตีจาก PDF) **ไม่เคยถูกบันทึกลงไฟล์ JSON** → เปิดไฟล์ใหม่กรอบหายหมด · มีโค้ด `localStorage.setItem("bclc_saved_crop_frames", …)` ที่ **เขียนแต่ไม่มีโค้ดอ่านกลับ** (ข้อมูลมีแต่พิกัด ไม่มีภาพ) → ลบทิ้ง · ปุ่ม AI อ่านกรอบเดิมเป็น **ของจำลอง** (ยิง API แล้วทิ้งคำตอบ ไม่ได้อ่านอะไรจริง)

#### 4.8.1) บันทึก/กู้กรอบรูป + สถานะแท็บ (io-manager.js)

| เรื่อง | การแก้ |
|---|---|
| บันทึกกรอบรูป | `buildCropFramesPayload()` — ย่อแต่ละกรอบเป็น **JPEG ด้านยาว ≤ 1800 px** (`compressFrameImage`) แล้วแนบกลับในคีย์ `cropFrames` · เก็บ `imgWidth`/`imgHeight` (ขนาด pixel จริง **ก่อนย่อ**) + `_cropImgScale` ไว้ เพื่อแปลงพิกัด AI กลับได้ตรง |
| กู้กลับ | `restoreCropFrames()` → `restoreMediaState()` — คืน **แท็บที่ค้างไว้** (`activeMediaViewTab`) · **หน้า PDF** (`currentPage`) · **กรอบที่ active** (`activeCropFrameIndex`) และโหลดกรอบนั้นเข้า canvas อัตโนมัติผ่าน `loadCropFrameIntoViewer()` |
| กู้ `groupState` | เดิม **อ่านได้แต่ไม่เคยเขียน** → เพิ่ม `groupState` (level/ground/structure/attachment) ลงไฟล์ |
| พิกัด P1/P2 ของแต่ละคู | เดิมเป็น "พิกัดหน้าจอ" (ผูกกับซูม/ขนาดจอ) → `buildGroundGroupStateForSave()` แปลงเป็น **สัดส่วน 0..1** + ใส่ `_coordSpace: 'normalized'` → ตอนโหลด `restoreMediaState()` ขยายกลับเป็นพิกัดหน้าจอ → **เปิดไฟล์บนจอคนละขนาดแล้วจุดยังตรง** |
| กันไฟล์บันทึกใหญ่ | ถ้าไฟล์เกิน **20 MB** → `confirm()` เสนอ "บันทึกโดยไม่แนบรูป" (ตัด `cropFrames` + `imageData` ออก) |
| บั๊กที่เจอระหว่างทำ | `restoreProjectImage()` ใช้ `img.onload` แล้ว `return` ทันที → ผู้เรียกรอภาพไม่ทัน → แก้เป็น **`await new Promise(...)`** รอ `onload` จริง |
| `canvasLabels` / `aiData` | บันทึกป้ายที่ผู้ใช้จับย้าย + ผลการอ่านของ AI ลงไฟล์ |

#### 4.8.2) Label Layer (canvas-viewer.js)

- ตัวแปรใหม่ใน `state.js`: `canvasLabels` (ป้าย), `draggingCanvasLabel` (กำลังลาก), `aiRefPoints`, `aiLabels`, `aiLastResults`
- `drawCanvasLabels(ctx)` — วาดป้ายเป็นกล่องพื้นขาวโปร่งใส + ข้อความ · **หมุนตาม `angle`** (องศา) เพื่อให้ตรงกับทิศข้อความในรูปแปลน (เช่น ชื่ออาคารที่เขียนเฉียง) · วาด **เส้นระดับ** (`kind: 'level'`) แบบ BL (เส้นทึบ) / TBL (เส้นประ) ก่อนป้าย
- `findHitCanvasLabel(x, y)` — hit-test จับป้าย → `mousedown` เริ่มลาก → `mousemove` ย้าย → `mouseup` จบ (ขณะลากขอบกล่องจะเป็นเส้นประสีน้ำเงิน)
- แสดงเฉพาะป้ายของ **เฟรมที่กำลังดูอยู่** (`getCurrentDisplayedFrameId()`) — ป้ายที่ผู้ใช้สร้างเอง (ไม่มี `frameId`) แสดงทั้งหมด
- ป้าย **scale ตามภาพ** (`scaleOverlayPixels`) และ **หมุนตามภาพ** (`rotateOverlayPixels` — หมุนทั้งตำแหน่งและมุม)

#### 4.8.3) ระบบอ่านข้อมูลด้วย AI (ไฟล์ใหม่ `js/ai-reader.js`)

- `buildAiSystemPrompt()` — บอกบทบาท "ผู้เชี่ยวชาญงานชลประทาน" + กฎบังคับ (ตอบเป็น JSON อย่างเดียว · พิกัดเป็น **สัดส่วน 0..1** · `refPoints.p1` = ต้นทาง, `p2` = ปลายทาง · ไม่เดาข้อมูลที่ไม่มี) + **ตัวอย่าง JSON schema** ครบทุกแท็บ
- `buildAiUserPrompt()` — แนบรายชื่อคูส่งน้ำที่มีอยู่แล้ว ให้ AI ใช้ชื่อเดิม (จับคู่ตอนนำเข้าได้)
- `downscaleImageForQuality()` — ย่อภาพตามคุณภาพที่เลือกใน ⚙️ ตั้งค่า AI (**1400 / 2400 / 3500 px**) ประหยัดเวลา+ค่าใช้จ่าย
- `callAiVision()` — เรียก **OpenAI-compatible `/chat/completions`** · ลองใส่ `response_format: {type:'json_object'}` ก่อน · ถ้าเซิร์ฟเวอร์ไม่รองรับ (error 400) → ลองใหม่โดยไม่ใส่
- `parseAiJsonResponse()` — ถอด markdown code fence + ตัดวงเล็บปีกกาที่ติดมา → `JSON.parse`
- `normalizeAiResult()` — เติมค่าเริ่มต้นให้สมาชิกที่หายไป (Q→0, SLOPE→4000, B→0.35, D→0.36, TYPE→VU1 …) · จำกัด `kind` ของป้าย · clamp พิกัดให้อยู่ใน 0..1
- `buildAiOverlayFromResult()` — สร้างป้าย + เส้นระดับบน canvas (พิกัดสัดส่วน → พิกัดหน้าจอผ่าน `aiNormToScreen()`) · เก็บ P1/P2 ลง `aiRefPoints`
- `applyAiRefPointsToGroupState()` — เขียน P1/P2 ของ AI ลง `groundGroupState` ของคูที่เลือกอยู่ (พิกัด กม. + ระดับ)
- `applyAiResultsToTables()` — นำเข้าลงตารางจริง · **จับคู่คูเดิมด้วยชื่อ** (คลองส่งน้ำ + คูส่งน้ำ) ถ้าไม่พบ → สร้างคูใหม่ · แท็บระดับคูใช้ฟิลด์จริงของแอป (`customKmStart`/`customKmEnd`/`customSlope`/`customType`) · **แท็บท่อรับน้ำ**: แถวแรกคงชื่อฐานไว้ + ศก. ท่อใช้ค่าจากระบบ (ล็อกตามประเภทอาคาร) · ⚠️ **นำเข้าอาคาร/ท่อรับน้ำหลัง `syncStructureRowsWithLevel()`** เพราะฟังก์ชันนั้นสร้างแถวอาคารของคูใหม่ทั้งชุด (ถ้านำเข้าก่อน ข้อมูล AI จะหาย)

#### 4.8.4) แท็บ "🤖 ผลอ่าน AI" (ไฟล์ใหม่ `js/tab-ai-result.js`)

- แท็บหลักใหม่ (ระหว่าง "อาคารท่อรับน้ำ" กับ "setting") — แสดงผลแบบ **diff-preview**: ค่าเดิม vs ค่าจาก AI พร้อมป้าย **ใหม่ / ต่าง / เหมือนเดิม**
- ช่องเลือก 7 ช่อง (คูส่งน้ำ · มิติ · ระดับดิน · ระดับคู · อาคาร · ท่อรับน้ำ · P1/P2) — เลือกแล้วค่อยกด **"✅ นำเข้าข้อมูล"**
- แสดงส่วนที่ AI อ่านได้: มิติ / ระดับดิน / ระดับคู / อาคาร / ท่อรับน้ำ / P1-P2 / **รายการป้ายพร้อมตำแหน่งและมุม**
- Copy ในแท็บนี้คัดลอกผล AI เป็น TSV ได้

#### 4.8.5) สิ่งที่ต้องรู้ / ข้อควรระวังรอบนี้

| เรื่อง | รายละเอียด |
|---|---|
| **ต้องมี API key** | ปุ่ม AI จะแจ้งว่าไม่สำเร็จถ้าไม่ได้ตั้งค่า (⚙️ ตั้งค่า AI) — เก็บใน `localStorage` (`bclc_ai_settings_v2`) |
| **Base URL รองรับทั้งแบบ `/v1` และ `/v1/chat/completions`** | `buildAiChatEndpoint()` เติม `/chat/completions` ให้อัตโนมัติถ้ายังไม่มี |
| **JSON mode อาจไม่รองรับ** | ถ้าเซิร์ฟเวอร์ตอบ 400 เรื่อง `response_format` → ลองใหม่โดยถอดออกให้อัตโนมัติ (ตรวจจาก `err.aiStatus` + `err.aiRaw` ไม่ใช่ regex กับข้อความที่แปลงแล้ว) |
| **คุณภาพภาพ** | 1400px เร็ว/ถี่พอ · 3500px ชัดมากแต่ช้าและแพง (กดอ่านทุกกรอบควรใช้ 1400) |
| **P1/P2 ของ AI คือ "จุดต้น/ปลายทางของช่วงคู"** | ถ้า AI อ่านผิดช่วง (เช่นภาพมีหลายคู) ต้องตรึง P1/P2 เองในแท็บระดับดินเดิม — **นำเข้า P1/P2 ของ AI ได้แค่ครั้งเดียว ถ้าผิดให้แก้เอง** |
| **การนำเข้าทับข้อมูลเดิม** | แท็บระดับดิน/ระดับคู/อาคาร/ท่อรับน้ำ **แทนที่แถวของคูนั้น** → ควรตรวจ diff ในแท็บผล AI ก่อนกดนำเข้า |
| **ยังไม่ทำ** | ไม่มีการอ่าน "ทั้งไฟล์ PDF" อัตโนมัติ · ไม่มี OCR ซ้ำหลายรอบ · ไม่มีการหักล้าง/แก้ไขผล AI ในแท็บ (นำเข้าเป็นก้อน) · API key ยังเก็บใน localStorage ของเครื่อง (ยังไม่เข้ารหัส) |

#### 4.8.6) แก้ error AI ให้เป็นภาษาไทยที่บอกทางแก้ไข (รอบ 30 ต่อ)

**อาการที่เจอ:** ผู้ใช้กด AI อ่านแล้วขึ้นกล่องเขียวเต็มไปด้วย JSON ดิบ:

```
API error 429: {"error":{"message":"Your account is not active, please check your
billing details on our website.","type":"billing_not_active","code":"billing_not_active"}}
```

**สาเหตุ:** ไม่ใช่บั๊กของเว็บ — **ฝั่งผู้ให้บริการ AI (Lovable) บัญชีไม่ active / ชำระเงินไม่สมบูรณ์** · แต่ที่แก้ได้คือข้อความ error ที่โหลด JSON ยาว ๆ มาแสดง อ่านยากและไม่บอกว่าต้องทำอะไร

**การแก้:** เพิ่ม `describeAiApiError(status, detailText, modelName)` ใน `js/ai-reader.js` → แปลง error ที่พบบ่อยเป็น **ภาษาไทย + บอกวิธีแก้ทีละขั้น** (แนบ `err.aiStatus` / `err.aiRaw` ไว้บน error object เพื่อให้โค้ดอื่นใช้ต่อได้)

| สถานะ / อาการ | ข้อความที่ผู้ใช้เห็น |
|---|---|
| `billing_not_active` / account not active / billing / invoice / insufficient credit | "บัญชีของผู้ให้บริการ AI ยังไม่ active" + บอกให้ไปแก้ที่หน้า Billing ของผู้ให้บริการ + ทางเลือกเปลี่ยนผู้ให้บริการ |
| `401` / `invalid_api_key` | "API key ไม่ถูกต้อง (หรือหมดอายุ)" + ให้ใส่ key ใหม่ |
| `429` / rate limit / quota | "ยิง API ถี่เกินไป (โควตาหมด)" + ให้ลดคุณภาพภาพลง 1400px |
| `404` / model not found | "ไม่พบโมเดลที่เลือก" + ให้เปลี่ยนชื่อ Model |
| `403` / forbidden | "ไม่มีสิทธิ์ใช้งาน" + ให้ลองเปลี่ยน Model |
| `413` | "ภาพใหญ่เกินไป" + ให้ลดคุณภาพภาพ |
| `5xx` | "เซิร์ฟเวอร์ของผู้ให้บริการมีปัญหา" + ไม่ใช่บั๊กของเว็บ |
| อื่น ๆ | แสดง status + code + ดิบแบบย่อ + ทิ้งท้ายให้ตรวจ Base URL / Model / API key |

> ⚠️ **บั๊กที่เจอระหว่างทำ (สำคัญ):** **Lovable คืน status `429` พร้อม billing error** → ถ้าเงื่อนไข 429 (rate limit) ถูกตรวจก่อนเงื่อนไข billing จะแสดงคำแนะนำผิด ("โควตาหมด" แทนที่จะเป็น "บัญชีไม่ active") · **แก้โดยย้ายการตรวจ billing ขึ้นก่อน rate-limit** · มีเทสต์กันบั๊กนี้ใน `tests/check-ai-error.js` (8 เคส)

> ⚠️ **บั๊กรอบ 31 (แก้แล้ว):** ข้อความ error **hardcode คำว่า "Lovable"** (จากตอนโปรเจกต์ยังใช้ Lovable gateway) → พอเปลี่ยนมาใช้ `api.openai.com` ข้อความยังบอกให้ไปแก้ที่ Lovable → **สับสนมาก** · **แก้โดยเพิ่ม `detectAiProviderName(baseUrl)` + `getAiProviderBillingUrl(baseUrl)`** ให้เดาชื่อเจ้าให้บริการ + ลิงก์ Billing จาก Base URL จริง (รองรับ OpenAI / Lovable / OpenRouter / Groq / Gemini / Anthropic / Azure) และส่ง `baseUrl` เข้า `describeAiApiError(status, detail, model, baseUrl)` ทั้ง 3 จุด

**ไฟล์ที่แก้:** `js/ai-reader.js` (เพิ่ม `describeAiApiError` + แก้จุด throw + แก้เงื่อนไข retry ของ JSON mode) · `js/canvas-viewer.js` (alert เว้นบรรทัดให้อ่านง่ายขึ้น) · `tests/check-ai-error.js` (ใหม่)

### 4.9) รายละเอียดรอบ 41 (2026-10-27) — ระบบตรวจสอบข้อมูลข้ามแท็บ + ช่วงคูน้ำ + แยกภาพวาดระหว่างแท็บ

**ไฟล์ใหม่:** `js/tab-validate.js` · `tests/check-round41.js` (ใหม่ — 100 ข้อ)

#### 4.9.1) ระบบตรวจสอบข้อมูล (ปุ่ม "ตรวจสอบข้อมูล")

| เรื่อง | การแก้ |
|---|---|
| ปุ่ม | `<button id="btn-validate-data" … onclick="runDataValidation()">` อยู่ **ถัดจากปุ่ม "นำเข้า Excel"** ในแถบล่าง (สีแดง `#dc3545`) |
| แท็บผลตรวจสอบ | `<div id="validationTabHost" class="validation-tab-host">` อยู่ **ต่อจากปุ่ม** · แสดงจำนวน error / warning + ตารางรายละเอียดแยกตามแท็บ (แท็บไหน · คูไหน · กม.อะไร · ปัญหาอะไร) + **ปุ่มปิด** |
| กติกาตรวจ | `runValidationRules()` เรียก 9 ชุด: `vCheckDitchTab` · `vCheckDimensionTab` · `vCheckGroundTab` · `vCheckLevelTab` · `vCheckStructureTab` · `vCheckAttachmentTab` · `vCheckCrossTabConsistency` · `vCheckRefPoints` · `vCheckAiRefPoints` — **ไม่ตรวจแท็บ AI** |
| ตรวจอะไรบ้าง | ชื่อคูซ้ำ · พื้นที่ส่งน้ำ > พื้นที่ทั้งหมด · ช่วง กม. เริ่ม > สิ้นสุด · ช่วง กม. ซ้อนทับ · กม. ซ้ำ / ไม่เรียงลำดับ · ข้อมูลไม่ครบ · ระดับติดลบ · ประเภทอาคารไม่มีในฐานข้อมูล · **กม. นอกช่วงของแท็บมิติ** · **ช่วง กม. ของแท็บระดับคูส่งน้ำไม่ตรงกับแท็บมิติ** · คูที่มีข้อมูลข้ามแท็บแต่ไม่มีในแท็บระบบคูส่งน้ำ |
| AI เสนอแนว | `askAiForValidationAdvice()` สรุปปัญหาให้ AI → แสดงตาราง "รายละเอียดการแก้ไขที่แนะนำ" (ถ้าไม่ตั้งค่า API key จะข้าม AI แต่ยังแสดงผลตรวจปกติได้) |
| ช่องสีแดงอ่อน | `applyValidationHighlights()` ใส่ class `.validation-error-cell` (พื้น `#ffe4e6` · กรอบ `#f87171`) + `title` อธิบาย · **เรียกอัตโนมัติหลัง render ตาราง** (`table-core.js`) · ไม่ไฮไลต์ในแท็บ AI |
| บันทึก/ส่งออก | `io-manager.js` → `saveProjectJSON()` และ `exportAllToExcel()` เรียก `confirmValidateBeforeSave('บันทึก'/'ส่งออก')` → ถาม "ต้องการตรวจสอบข้อมูลก่อนไหม" (ยืนยัน = ตรวจแล้วเปิดแท็บผล · ยกเลิก = ทำต่อทันที) |

> ⚠️ **บั๊กที่เจอตอนทำรอบ 41 (แก้แล้ว):**
> 1. **ไฮไลต์ช่องไม่ตรงแถว** — เดิมอ่าน `data-row` จาก `<tr>` (แต่ `<tr>` **ไม่มี** attribute นี้) → ต้องอ่านจาก `data-row` ของ **ช่องในตาราง** แทน
> 2. **แท็บอาคารประกอบตรวจผิดฟิลด์** — ข้อมูลจริงเก็บชื่อ/ประเภทอาคารใน `name` (ไม่มีฟิลด์ `type`) · H เก็บใน `hOverride` · ความยาวเก็บใน `pipeCount` → เดิมตรวจ `r.type` / `r.h` / `r.length` ที่ไม่มีจริง → **แก้ให้อ่านฟิลด์จริง**
> 3. **แมป `data-col` ผิดหลายช่อง** (เช่น ระดับคูส่งน้ำ `h` เป็น col 6 ไม่ใช่ 5 · โครงสร้าง `name` เป็น col 4 ไม่ใช่ 3) → แก้ `vFieldColMap()` ให้ตรงกับ HTML จริง
> 4. **ไม่รู้ว่าปัญหาอยู่แถวไหน** → เพิ่ม `rowIdx` ใน `vAdd()` แล้วส่งดัชนีแถวทุกจุด → ไฮไลต์เจาะจงแถวได้
> 5. **`uiConfirm` ของจริงทับ mock ตอนรันเทสต์** → `eval()` โค้ด `canvas-viewer.js` เข้ามาทับ → ต้อง override หลัง `eval()` เสมอ
> 6. **error ปลอมในแท็บระดับคูส่งน้ำ** (เจอตอนทดสอบในเบราว์เซอร์จริง) — แถวแรกของแต่ละคูเก็บ `customKmStart: ""` ในข้อมูล แต่ **หน้าจอดึงค่าจากแท็บมิติ** (`renderLevelTab()`) → ตัวตรวจเดิมอ่านค่าดิบ → ขึ้น error "ช่วง กม. เริ่มต้น/สิ้นสุดยังไม่ครบ" ทั้งที่ข้อมูลปกติ → **แก้ให้คำนวณค่าที่ "แสดงจริง"** เหมือน `renderLevelTab()` (ทั้ง `customKmStart`, `customKmEnd` และ `customType`)
> 7. **ช่องสีแดงอ่อนไม่แสดง** (เจอตอนทดสอบในเบราว์เซอร์จริง) — `.table-input.locked` และ `.table-input.editable` ใช้ `!important` และมี specificity สูงกว่า `.validation-error-cell` → พื้นหลังถูกทับ → **แก้ CSS ให้ใช้ selector `.table-input.validation-error-cell` (specificity เท่ากัน + อยู่หลังกฎเดิม)**

#### 4.9.2) แท็บ AI: ปุ่ม "ลบข้อมูล" แทนปุ่มขยาย/ย่อ

- `deleteAiResultDataset(cardKey, frameIdx)` ใน `js/tab-ai-result.js` — ลบเฉพาะ **ชุดผลลัพธ์ AI** ที่เลือก ไม่แตะข้อมูลในตารางจริง (มีกล่องยืนยันก่อน)
- ปุ่มในหัวการ์ดชุดข้อมูลเปลี่ยนจาก "ขยาย/ย่อ" เป็น "ลบข้อมูล" (class `.ai-dataset-delete-btn`)
- ฟังก์ชันเดิม `toggleAiDatasetCardCollapse()` / `setAllAiDatasetCardsCollapsed()` **ยังอยู่** แต่ไม่มีปุ่มเรียกแล้ว

#### 4.9.3) คอลัมน์ "ช่วงคูน้ำ" (1 2 3 …)

- `getDitchSectionIndex(channelId)` ใน `js/tab-ditch.js` — คืนลำดับของคูส่งน้ำ **นับแยกต่อคลอง** (คูแรกของคลอง A = 1, คูที่สอง = 2 … คูแรกของคลอง B = 1 ใหม่) · คูที่ยังไม่ตั้งชื่อ → คืนค่าว่าง
- `getDitchSectionHtml(channelId)` — ห่อค่าเป็น HTML
- เพิ่มเป็น **คอลัมน์สุดท้าย** ของ 3 แท็บ: `js/tab-ground.js` (ระดับดินเดิม) · `js/tab-level.js` (ระดับคูส่งน้ำ) · `js/tab-structure.js` (อาคารประกอบ) + ส่งออก Excel มีคอลัมน์เดียวกัน (`js/io-manager.js`)

#### 4.9.4) แยกภาพวาด + ปุ่มแสดงผลระหว่างแท็บ PDF กับแท็บรูปตัดตามยาว

**ปัญหาที่แก้:** ภาพที่วาดในแท็บ "ส่วนแสดงรูปตัดตามยาว" **ไปโผล่ในแท็บ "ส่วนแสดงไฟล์ PDF"** และปุ่มแสดง/ซ่อนกดที่แท็บหนึ่งกระทบอีกแท็บ

| เรื่อง | การแก้ (ใน `js/canvas-viewer.js`) |
|---|---|
| เก็บภาพวาดแยกแท็บ | `mediaDrawingStateByTab = { pdf: {…}, image: {…} }` + `saveDrawingStateForTab()` / `restoreDrawingStateForTab()` · `switchMediaViewTab()` เรียก save ของแท็บเดิม → restore ของแท็บใหม่ (แท็บ PDF เริ่มต้นไม่มีภาพวาด) |
| สถานะเลเยอร์แยกแท็บ | `overlayVisibility` (PDF) · `overlayVisibilityImage` (รูปตัดตามยาว) · `overlayVisibilityDraw` (รูปตัดขวาง) + `getOverlayVisibilityForCurrentTab()` · ปุ่มทั้งหมดเปลี่ยนเป็น `toggleOverlayVisibilityForCurrentTab('key')` |
| จุด P1/P2 แยกแท็บ | `refPointsVisibility = { pdf: true, image: true, draw: true }` + `toggleRefPointsVisibility()` · `redraw()` เช็คสถานะก่อนวาดจุด P1/P2 |
| ปุ่มใน HTML | `#btn-toggle-ref-points-pdf` (ในกลุ่มปุ่มแท็บ PDF) และ `#btn-toggle-ref-points-image` (ในกลุ่มปุ่มแสดงผลร่วม) — **ทั้งคู่อยู่เหนือปุ่ม "แสดงเส้นดินเดิม"** |

**หลักฐานการตรวจสอบรอบ 41 (อัตโนมัติ):**
```
node tests\check-round41.js      -> ALL CHECKS PASSED (100 ข้อ)
node tests\smoke-test.js         -> ALL CHECKS PASSED
node tests\probe-bugs.js         -> FAIL = 0
node tests\check-round36/38/39/40.js + round30-check.js -> FAIL = 0
node tests\check-all-encoding.js -> OK - all files are clean UTF-8
```

**เพิ่มเติม: ทดสอบในเบราว์เซอร์จริง** (เปิดผ่าน local static server → `http://localhost:8912/index.html`) — ยืนยันว่า:
- ปุ่ม "ตรวจสอบข้อมูล" เปิดแท็บสีแดง (`border: rgb(220, 53, 69)` · `background: rgb(255, 245, 245)`) และแสดง "พบ error N จุด / เตือน N จุด"
- ช่องที่ผิดถูกไฮไลต์จริง (`background: rgb(255, 228, 230)` · `border: rgb(248, 113, 113)`) พร้อม `title` อธิบาย
- กด "บันทึก" → ขึ้น "ต้องการตรวจสอบข้อมูลก่อนบันทึกหรือไม่?" ก่อนทำงานต่อ
- คอลัมน์ "ช่วงคูน้ำ" เป็นคอลัมน์สุดท้ายในทั้ง 3 แท็บ ค่าเริ่มต้น = 1
- แท็บ PDF ไม่เห็นภาพที่วาดในแท็บรูป · ปุ่มแสดงเส้นดินเดิม/จุด P1 P2 ไม่กระทบข้ามแท็บ

**เลขเวอร์ชัน cache:** ทุก `<script src="js/...">` ใน `index.html` ถูก bump เป็น `?v=20261027a`

### 4.6) รายละเอียดรอบ 11 — แก้บั๊กโหลด JSON + ปุ่ม +/−

| # | คำสั่ง | การแก้ |
|---|---|---|
| 1 | **🐞 โหลดไฟล์ JSON ไม่ได้ (ไฟล์เมื่อวานโหลดได้) → "Assignment to constant variable"** | **ต้นเหตุ:** `structureTypeDatabase` ใน [state.js](js/state.js) ประกาศเป็น **`const`** แต่ `loadProjectJSON()` และ `importAllFromExcel()` **เขียนทับทั้งชุด** (`structureTypeDatabase = …`) → throw ทันทีเมื่อไฟล์ JSON มีคีย์ `structureTypeDatabase` · ไฟล์ที่บันทึก **ก่อน** รอบ 6 ไม่มีคีย์นี้จึงโหลดได้ — ไฟล์ที่บันทึกตั้งแต่รอบ 6 เป็นต้นมาจึงพัง · **แก้:** เปลี่ยนเป็น **`let`** พร้อมคอมเมนต์กำกับ |
| 1.1 | กันไม่ให้เกิดซ้ำ | เพิ่มการตรวจว่า **ทุกตัวแปรที่ `loadProjectJSON()` เขียนทับ ต้องเป็น `let`/`var`** — ทำโดยให้เทสต์เรียก `loadProjectJSON()` จริงด้วย `FileReader` จำลอง (หัวข้อ 18 ใน `tests/smoke-test.js`) |
| 1.2 | เสริมความทนทานตอนโหลด | `loadProjectJSON()` เติมค่า `tw`/`tf` (ความหนา) ให้ Type คูส่งน้ำที่โหลดมาจากไฟล์เก่าที่ไม่มีฟิลด์นี้ |
| 2 | **Typeคูส่งน้ำ: VU1–VU5 ไม่มีปุ่ม · VU6 มีแค่ `+` · แถวที่เพิ่มมาทีหลังมี `+ −`** | `addDitchTypeRow()` ติดธง **`_userAdded: true`** ให้แถวใหม่ · `renderTypeTab()` แสดงปุ่มเฉพาะ (ก) แถวที่ `_userAdded` → `+ −` (ข) แถวสุดท้ายของชุดตั้งต้น → `+` (ค) ที่เหลือ → ไม่มีปุ่ม · `deleteDitchTypeRow()` ลบได้เฉพาะแถว `_userAdded` |
| 3 | **Typeอาคารประกอบ: แถว อาคารท่อระบายน้ำแบบที่ 2 มีแค่ `+` / แถวอื่น ๆ มี `+ −` ที่เพิ่มมาทีหลัง** | ใช้กติกาเดียวกัน แต่ `structureTypeDatabase` เก็บเป็น **string ล้วน** (แท็บอาคารประกอบใช้ค่าเทียบ `===` ตรง ๆ) จึงแยกธงไปเก็บที่ **`structureTypeDBMeta`** (Map) + เพิ่ม `addStructureTypeRow()` / `deleteStructureTypeRow()` / `updateStructureTypeField()` ให้ย้ายธงตามเมื่อเปลี่ยนชื่อ และกันชื่อซ้ำ |
| 4 | ปุ่มของ **อาคารประกอบ** ต้องครบเหมือนเดิม | เพิ่ม `addDitchTypeRow()` ติดธงเฉพาะคูส่งน้ำ · ส่วน Type อาคารที่ผู้ใช้เพิ่ม จะถูกใส่ในลิสต์ "ประเภทอาคาร" ของแท็บอาคารประกอบด้วย (เป็น string ปกติ) — ตรวจแล้วว่ายังใช้ได้

### 4.5) รายละเอียดรอบ 10 — แก้ตามผลตรวจรอบ 3

| # | คำสั่ง | การแก้ |
|---|---|---|
| 1 | **คอลัมน์ รายการอาคาร เอาสีเขียว ๆ ออก** | ตัดคลาส `editable` ออกจาก `combobox-input` ของลิสต์รายการอาคาร (ใน `renderAttachmentTab()` และ `refreshAttachmentTypeCell()`) → ช่องลิสต์เป็น **พื้นโปร่งใส ไม่มีกรอบเขียว** ตามรูป · แถวแรกยังล็อกพื้นเทา · **ยังเลือกจากลิสต์และพิมพ์ได้เหมือนเดิม** · คลาส `.combobox-input.editable` ยังเก็บไว้ใน CSS เผื่อใช้ที่อื่น |
| 2 | **setting → Typeคูส่งน้ำ ให้เหลือเฉพาะ VU1–VU6** | ตัด `ditchTypeDatabase` จาก 20 รายการ (VU1–VU6 + L1–L5 + E1–E5 + SL1–SL4) **เหลือ 6 รายการ (VU1–VU6)** · ⚠️ ผลข้างเคียง: รายการ TYPE ในแท็บมิติคูส่งน้ำเหลือ 6 ตัวตามไปด้วย (เป็น database เดียวกัน) และ `getHFromType()` จะคืน 0.50 ให้ Type เก่าที่ไม่รู้จัก |
| 3 | **VU6 (แถวสุดท้าย) มีเฉพาะปุ่ม + / แถวที่เพิ่มมาถึงมี + −** | เปลี่ยนเงื่อนไขปุ่มใน `renderTypeTab()` จาก "แถวสุดท้ายมี + และ −" เป็น **"แถวสุดท้ายมีแค่ +"** ส่วนแถวก่อนหน้าและแถวที่เพิ่มมามีทั้ง + และ − (ตรงกับรูปแบบของแท็บอาคารประกอบ) |
| 4 | **รูปแบบแท็บ setting + แท็บย่อย ให้เป็นแบบรูปที่แนบ** | วัดสี/ทรงจากรูปจริงแล้ว: **แถวบน (แท็บหลัก)** = ทรงแท็บ มุมบนมน ตัว active พื้น `#007bff` ขาว (คงเดิม ตรงกับรูปแล้ว) · **แถวสอง (แท็บย่อย)** เปลี่ยนจาก "แท็บมุมบนมน" เป็น **ชิปมุมมน (pill)**: inactive พื้นขาว ขอบ `#ced4da` / **active พื้น teal `#17a2b8` ขอบขาว ตัวอักษรขาว** · ตัวรองรับเป็น **กล่องพื้นเทา `#f8f9fa` ขอบ `#dee2e6` มุมมน 8px** · เพิ่มระยะห่างระหว่างสองแถว (`gap: 10px` + `margin-bottom: 6px`) |

### 4.4) รายละเอียดรอบ 9 — ลิสต์ Q / SLOPE (ปิดงานค้างของรอบ 8 ข้อ 5)

เจ้าของงานส่งรูปที่แนบ 3 มาใหม่ → ได้รายการค่าจริงแล้ว

| # | คำสั่ง | การแก้ |
|---|---|---|
| 1 | **คอลัมน์ Q เพิ่มลิสต์ให้เลือก** | เพิ่ม `qOptions` = `0.03, 0.06, 0.09, 0.12, 0.15, 0.18` ใน `state.js` · เปลี่ยนช่อง Q ใน [tab-dimension.js](js/tab-dimension.js) จาก `<input type="number">` เป็น **combobox** (`.combobox-container` + `.combobox-input` + `.combobox-select` + ลูกศร ▼) แบบเดียวกับ ศก.ท่อ/ความยาว ของแท็บอาคารประกอบ |
| 2 | **คอลัมน์ SLOPE เพิ่มลิสต์ให้เลือก** | เพิ่ม `slopeOptions` = `500, 1000, 1500, 2000, 2500, 3000, 3500, 4000` และทำเป็น combobox เหมือนข้อ 1 |
| 3 | **คงสถานะช่องที่กรอกให้แก้ไขได้เหมือนเดิม** | ช่องยังเป็น `combobox-input` ที่ **พิมพ์ค่าเองได้** (ไม่มี `readonly`) และยังคง `data-row` / `data-col` / `data-field` ครบ → `syncTableInputsToChannels()` และ Excel navigation ทำงานเหมือนเดิม |
| 4 | กันการเลือกซ้ำ/ค่าไม่ตรงลิสต์ | ตัวเลือกที่ถูกเลือกใช้ `Number(q) === Number(r.q)` (ไม่ผูกกับรูปแบบสตริง) → ค่าเดิม `0.030` หรือ `0.03` ถูกเลือกให้ถูกต้อง |
| 5 | ค่าเริ่มต้นตอนนำเข้า Excel | เปลี่ยนจากค่าคงที่ `0.030` / `4000` เป็นดึงจาก `qOptions[0]` และ `slopeOptions` ตัวสุดท้าย เพื่อให้ค่าเริ่มต้นตรงกับลิสต์เสมอ |

**หมายเหตุ:** ค่าในลิสต์มาจากรูปของเจ้าของงานโดยตรง (Q มี 6 ค่า, SLOPE มี 8 ค่า) ถ้าต้องเพิ่ม/ลดค่า แก้ที่ `qOptions` / `slopeOptions` ใน [state.js](js/state.js) ที่เดียว

### 4.2) รายละเอียดรอบ 7 — แก้ตามผลตรวจของเจ้าของงาน

| # | คำสั่ง | การแก้ |
|---|---|---|
| 1 | ลบแถว/คอลัมน์ **"รายการอาคาร"** ที่คำนวณอัตโนมัติออก | ตัดคอลัมน์ที่คำนวณชื่ออาคารออก เหลือ 8 คอลัมน์ + ลบฟังก์ชัน `computeAttachmentItemName` / `attachmentPartText` / `stripTrailingZeros` ที่ไม่ใช้แล้ว |
| 2 | เปลี่ยนชื่อคอลัมน์ **ประเภทอาคาร → รายการอาคาร** | เปลี่ยนหัวคอลัมน์ + `data-field="name"` ยังใช้ชื่อเดิมในข้อมูล |
| 3 | คอลัมน์ **ประเภทอาคาร ไม่ต้องสีที่ช่อง** | แถวแรกของคูส่งน้ำ (รายการอาคาร = อาคารท่อรับน้ำเข้าแปลงไร่นา) ใช้ `.table-input.locked` (พื้นเทา) ไม่มีสีเขียว · แถวถัดไปยังเป็นลิสต์ที่แก้ไขได้ตามเดิม |
| 4 | **จำนวนอาคาร ค่าเริ่มต้น = 1 และมีทุกแถว** | เดิมมีเฉพาะแถวแรกของกลุ่ม → ตอนนี้แสดง/แก้ไขได้ **ทุกแถว** ค่าเริ่มต้น `"1"` (ทั้งใน `addAttachmentRowAt`, `syncAttachmentRowsWithLevel`, ข้อมูลตั้งต้น และตอนนำเข้า Excel) |
| 5 | **ศก. ท่อ ให้ใส่ค่าตามอาคาร** | ช่อง ศก. ท่อ แก้ไขได้ (เดิม `dia` เป็น false ทุกแบบ) พร้อม **ลิสต์ขนาดท่อ** ให้เลือกจาก `pipeDiameterOptions` · ยังล็อกเฉพาะแถวแรกที่เป็นอาคารท่อรับน้ำเข้าแปลงไร่นา |
| 6 | **ความยาว ค่าเริ่มต้น = 1.00** | เปลี่ยนค่าเริ่มต้นจาก `0.00` → `"1.00"` ทุกจุด (สร้างแถวใหม่ / ซิงก์คูใหม่ / ค่าตั้งต้น / นำเข้า Excel) |
| 7 | **ช่องที่แก้ไขได้ ใช้โทนสีเขียวเหมือนแท็ประดับคูส่งน้ำ** | เปลี่ยน `.table-input.editable` / `.combobox-input.editable` จากเหลือง `#fff9c4` → **เขียว `#e8f5e9` + ขอบ `#81c784` + ตัวอักษร `#1b5e20`** (ชุดเดียวกับ `.table-input.first-bl-input` ของแท็ประดับคูส่งน้ำ) |
| 8 | **กดล็อกแท็บ setting ไม่ต้องค้างสีแท็บก่อนหน้า** | `switchTableTab()` เรียก `syncSettingsSubTabUI()` เสมอเมื่อไม่ได้อยู่บน setting → ตัวจ่ายจะเคลียร์ `active` ของแท็บหลักและ **ซ่อนแถบแท็บย่อย** ทันที (เดิมแถบแท็บย่อยค้างอยู่เพราะรอ render) |
| 9 | **แท็บเมนูย่อยให้รูปแบบเหมือนแท็บหลัก** | `.subtab-btn` ใช้สไตล์ชุดเดียวกับ `.tab-btn` (padding/ขนาดฟอนต์/ขอบมน/สีฟ้าเมื่อ active) และย้าย `#settingsSubTabsBar` **เข้าไปใน `.table-tabs-header`** ให้ต่อเนื่องเป็นแถวเดียวกับแท็บหลัก มีเส้นคั่นบาง ๆ |
| 10 | **ถอดแท็บย่อยออกจากเมนูใหญ่ด้านซ้าย** | **ลบ `#subSettingMenu` ออกจาก sidebar** (ผมทำเกินคำสั่งในรอบ 6) และคืนค่า `switchMainMenu()` / `switchSubMenu()` / `returnToTakeoff()` ให้ทำงานแบบเดิม · แท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ อยู่ที่ **แถบแท็บเหนือตารางเท่านั้น** |

### 4.3) รายละเอียดรอบ 8 — แก้ตามผลตรวจรอบ 2

| # | คำสั่ง | การแก้ |
|---|---|---|
| 1 | **คอลัมน์ รายการอาคาร ไม่ต้องใส่สีช่องที่แก้ไขได้ ยกเลิกทั้งหมด** | แถวที่เลือกรายการอาคารได้ ตัดคลาส `editable` (สีเขียว) ออก ใช้ `.combobox-input` ธรรมดา (พื้นโปร่งใส เหมือนลิสต์ TYPE ของแท็บมิติคูส่งน้ำ) · แถวแรกยังล็อกพื้นเทาเหมือนเดิม |
| 2 | **คอลัมน์ ศก. ท่อ ใส่ค่าเริ่มต้นตามที่แจ้ง + ล็อกทั้งหมด** | เพิ่ม `getAttachmentPipeDia(row)` ใน `state.js` — **4 รายการแรก = 0.20**, **2 รายการสุดท้าย = 0.15** · ช่อง ศก. ท่อ เป็น **ล็อกทุกแถว** (readonly + พื้นเทา) ไม่มีลิสต์แล้ว · เปลี่ยนรายการอาคาร → ค่า ศก. ท่อ เปลี่ยนตามให้อัตโนมัติ · ไฟล์ JSON/Excel เก่าที่ไม่มีค่า จะเติมค่าเริ่มต้นให้ตอนซิงก์/นำเข้า |
| 3 | **แท็บ setting แสดงหน้าจอผิด — มองไม่เห็นแท็บย่อย และสีน้ำเงินค้างที่แท็บก่อนหน้า** | สาเหตุจริง: แถบ `table-tabs-header` มี `overflow-x: auto` + `margin-bottom: -1px` และแท็บหลัก 8 แท็บล้นจนเกิด **scrollbar ทับแถบแท็บย่อย** → **แยก DOM เป็น 2 ส่วน**: `.tabs-row-scroll` (แท็บหลัก เลื่อนเองได้) + `#settingsSubTabsBar` (ตรึงไว้ทางขวา ไม่ถูก scrollbar ทับ) · ตัด `overflow-x`/`margin-bottom` ติดลบออกจาก `.table-tabs-header` |
| 4 | **แท็บ setting เมนูย่อย Typeคูส่งน้ำ — แก้ตารางตามรูปที่แนบ** | เพิ่ม 2 คอลัมน์: **ความหนากำแพง (ม.)** และ **ความหนาพื้น (ม.)** (ค่า 0.10 ทุก Type) · เปลี่ยนหัวคอลัมน์เป็น `B (ม.)` / `H (ม.)` · เพิ่มฟิลด์ `tw`/`tf` ใน `ditchTypeDatabase` ทุกแถว · เพิ่มตัวช่วย `getDitchTypeThickness()` รองรับไฟล์เก่าที่ไม่มีฟิลด์นี้ · ส่งออก/นำเข้า Excel ครบ 6 คอลัมน์ |
| 5 | **แท็บมิติคูส่งน้ำ — คอลัมน์ Q และ SLOPE เพิ่มลิสต์ให้เลือก** | ✅ **ทำในรอบ 9 แล้ว** (ดูหัวข้อ 4.4) — รอบ 8 ค้างไว้เพราะรูปที่แนบ 3 ไม่ได้มาในข้อความ |
| 6 | **คอลัมน์ TYPE ดึงรายการจากแท็บ setting → Typeคูส่งน้ำ** | ✅ **มีอยู่แล้ว** — `renderDimensionTab()` เรียก `getDitchTypeOptions()` ซึ่งอ่านจาก `ditchTypeDatabase` ตัวเดียวกับแท็บ setting → เพิ่ม/แก้ Type ใน setting แล้วกลับมาแท็บมิติ รายการจะอัปเดตตามทันที |

### หลักฐานการตรวจสอบรอบ 5 (อัตโนมัติ)

- ย้ายโค้ด **47/47 ฟังก์ชันเหมือนต้นฉบับทุกตัวอักษร**
- body ของ 7 แท็บ **ตรงต้นฉบับทุกแท็บ** (ตรวจหลังลด indent)
- ฟังก์ชันรวม **55 ตัว** (48 เดิม + 7 `renderXxxTab`) · **ไม่มีชื่อซ้ำ** ใน 12 ไฟล์ที่โหลด (รวม 88 ฟังก์ชัน)
- `container.innerHTML =` **7 ครั้ง** เท่าเดิม · ไฟล์ใหม่ **ไม่มีโค้ดที่รันตอนโหลด** (มีแต่ `function` + คอมเมนต์)
- `node --check` **ผ่าน 12/12 ไฟล์**
- ตรวจโค้ดตายทั้งโปรเจกต์: ไม่พบฟังก์ชัน/ตัวแปร/พารามิเตอร์ที่ไม่ถูกใช้ (นอกจาก `r.pixel` ที่ลบไปแล้ว)

### หลักฐานการตรวจสอบรอบ 6–7 (อัตโนมัติ)

- `node --check` ผ่านทุกไฟล์ JS ที่ถูกโหลด (**13/13**)
- `tests/smoke-test.js` รัน **โค้ดจริง** (12 ไฟล์ JS) บน DOM จำลอง แล้วตรวจ **76 ข้อ ผ่านทั้งหมด** ครอบคลุม:
  render ครบทุกแท็บไม่ throw · หัวคอลัมน์/ค่าเริ่มต้นของแท็บอาคารประกอบ · กฎ H ของทั้ง 6 รายการอาคาร ·
  ปุ่ม +/− และการลบแถวแรกไม่ได้ · ค่าเริ่มต้น จำนวนอาคาร = 1 / ความยาว = 1.00 ·
  จำนวนอาคารมีทุกแถว · แท็บย่อย setting · Copy ทุกแท็บไม่ throw · ชีต Excel ที่ส่งออกครบ (มี `อาคารท่อรับน้ำเข้าแปลงไร่นา` + `setting`)
- **หมายเหตุ:** เป็นการทดสอบระดับตรรกะ/โครงสร้าง HTML เท่านั้น ยังไม่ได้ตรวจหน้าตาจริงบนเบราว์เซอร์

### หลักฐานการตรวจสอบรอบ 8–11 (อัตโนมัติ)

- `node --check` ผ่านทุกไฟล์ JS ที่ถูกโหลด (**13/13**)
- `tests/smoke-test.js` ตรวจ **148 ข้อ ผ่านทั้งหมด** — รอบ 8 เพิ่มตัวตรวจที่แข็งขึ้นคือ **parser อ่านตาราง HTML จริง** (thead/tbody/td + `data-field`/`readonly`/class) ใช้ยืนยัน:
  แท็บ Typeคูส่งน้ำมี **5 คอลัมน์** และ VU1 = `0.35 / 0.50 / 0.10 / 0.10` · แท็บใหม่ **8 คอลัมน์ ทุกแถวเท่ากัน** (จำนวนอาคารมีทุกแถว) ·
  **ศก. ท่อ ล็อกทุกแถว** และค่าอยู่ในชุด {0.20, 0.15} · จำนวนอาคาร = 1 ทุกแถว · แถวแรก รายการอาคารล็อกไม่มีสีเขียว ·
  holder ของลิสต์รายการอาคารถูกเติม combobox จริงหลัง render · โครงสร้างแถบแท็บ (`.tabs-row-scroll` + `#settingsSubTabsBar`) และ CSS ที่กัน scrollbar ทับ ·
  ชีต `setting` ที่ส่งออกมีหัวคอลัมน์ความหนาครบ
- รอบ 9 เพิ่มการตรวจ: `qOptions`/`slopeOptions` ตรงตามรูป · ช่อง Q/SLOPE เป็น combobox ที่ **แก้ไขได้และยังมี `data-field`** ·
  ลิสต์ TYPE ในแท็บมิติตรงกับ `ditchTypeDatabase` · เลือก Q/SLOPE/TYPE แล้ว **ค่าถูกเก็บลงข้อมูลจริง**
- รอบ 10 เพิ่มการตรวจ: `ditchTypeDatabase` เหลือ **6 รายการ VU1–VU6** · ปุ่มของ **แถวสุดท้ายมีเฉพาะ +** และแถวก่อนหน้ามีทั้ง + และ − ·
  แถวที่เพิ่มใหม่ได้แค่ + (เป็นแถวสุดท้าย) และพอเพิ่มอีกแถวจะได้ทั้ง + และ − · ลิสต์รายการอาคาร **ไม่มีคลาส `editable`** แล้วแต่ยังมี `select` ·
  CSS ของชิปแท็บย่อย (mุมมน 13px / active teal `#17a2b8` / กล่องพื้น `#f8f9fa` มุมมน 8px)
- รอบ 11 เพิ่มการตรวจ: **VU1–VU5 ไม่มีปุ่ม / VU6 มีแค่ `+` / แถวที่เพิ่มมี `+ −`** และลบได้เฉพาะแถวที่เพิ่มเอง ·
  แถวสุดท้ายของ **Typeอาคารประกอบ** มีแค่ `+` แถวกลางไม่มีปุ่ม แถวที่เพิ่มมี `+ −` · ค่าใน `structureTypeDatabase` ยังเป็น **string ล้วน** ·
  **`loadProjectJSON()` ทำงานได้จริง** ด้วย `FileReader` จำลอง (เทสต์นี้จะจับบั๊ก "Assignment to constant variable" ได้ทันที)
- **🔎 บทเรียนจากรอบ 8–11:**
  1. regex แบบ `id="x"[^>]*class=` ใช้ไม่ได้กับ HTML นี้ เพราะมีอักขระ `▼` (คือ `>`) ใน `combobox-arrow` ของแถวก่อนหน้า
     ⇒ ให้ใช้ `inputTagById()` / `typeRowSegment()` ที่หาขอบเขตแท็กจริงแทน
  2. **ตัวแปรที่เป็น "คลังข้อมูล" และถูกเขียนทับตอนโหลดไฟล์ ต้องเป็น `let` เสมอ** — เคยพลาด `structureTypeDatabase` เป็น `const` แล้วเว็บพังตอนโหลด JSON
     ⇒ มีเทสต์หัวข้อ 18 คอยจับอยู่ที่ `tests/smoke-test.js`

### 🔎 3 จุดที่ต้องตัดสินใจ/ยืนยันจากเจ้าของงาน

1. **แถวแรก H = "-"** — เจ้าของงานยืนยันแล้วว่า "ห้ามแก้ และไม่แสดงค่า H" จึงเก็บค่า H ของแถวแรกเป็นค่าว่างและล็อกไว้
   (ถ้าภายหลังต้องการให้ดึงค่า H จากแท็ประดับคูส่งน้ำอัตโนมัติ แก้จุดเดียวใน `tab-attachment.js`)
2. **คอลัมน์ "จำนวนอาคาร"** — ช่องกรอกเอง ค่าเริ่มต้น `1` มีทุกแถว (ยังไม่ถูกนำไปคำนวณต่อที่ใด)
3. **ลิสต์ "รายการอาคาร"** — เปลี่ยนทั้งชุดตามรูปที่แนบ เพราะรูปใช้ชื่อ "อาคารท่อรับน้ำเข้าแปลงไร่นา…" ซึ่งไม่มีในลิสต์เดิม
   ชื่อ Type อาคารชุดเดิม (24 ชื่อ) ยังอยู่ครบในแท็บย่อย **Typeอาคารประกอบ** เพื่อไม่ให้ข้อมูลหาย

### 📌 หมายเหตุการตีความที่อาจต้องยืนยันเพิ่ม

- **คอลัมน์ "ศก. ท่อ (ม.)"** ตีความว่า *"ให้ใส่ค่าตามอาคาร (ตามรูป)"* → ทำเป็นช่องที่ **แก้ไขได้ + มีลิสต์ขนาดท่อ** ให้เลือก
  แต่ยัง **ล็อกในแถวแรก** (อาคารท่อรับน้ำเข้าแปลงไร่นา) ตามรูปที่ระบุ H = `-` และ ศก. ท่อ = `0.20` (ล็อก)
- **คอลัมน์ "ความยาว (ม.)"** ตามรูปแถวแรกเป็น `1.00` (ล็อก) จึงตั้งค่าเริ่มต้น `1.00`
- รอบ 7 **ถอดเมนูย่อยออกจาก sidebar แล้ว** — แท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ อยู่ที่แถบแท็บเหนือตารางเท่านั้น

### เช็กลิสต์เฉพาะรอบ 8 (แก้ตามผลตรวจรอบ 2)

22. **แท็บ setting**: กดแล้วต้อง **เห็นแถบแท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ ทางขวาของแถบแท็บหลัก** เสมอ และ **แท็บที่เลือกไว้ก่อนหน้าต้องเลิกเป็นสีน้ำเงิน** (มีแค่แท็บ setting ที่ฟ้า)
23. เลื่อนแถบแท็บหลักแนวนอน → **แถบแท็บย่อยต้องไม่ถูก scrollbar ทับ** (แยก 2 ส่วนแล้ว)
24. **setting → Typeคูส่งน้ำ** ต้องมี **5 คอลัมน์**: Type / B (ม.) / H (ม.) / ความหนากำแพง (ม.) / ความหนาพื้น (ม.) และ VU1 = 0.35 / 0.5 / 0.1 / 0.1
25. **แท็บอาคารท่อรับน้ำเข้าแปลงไร่นา**:
   - ช่อง **รายการอาคาร** ของแถวที่เลือกได้ ต้อง **ไม่มีสีเขียว** (พื้นโปร่งใส)
   - ช่อง **ศก. ท่อ (ม.)** ต้อง **ล็อกทุกแถว** และค่าเริ่มต้น = **0.20** สำหรับ 4 รายการแรก, **0.15** สำหรับ 2 รายการสุดท้าย
   - เปลี่ยนรายการอาคาร → ค่า ศก. ท่อ ต้องเปลี่ยนตามทันที
26. **แท็บมิติคูส่งน้ำ**: คอลัมน์ **TYPE** ต้องมีรายการตรงกับแท็บ setting → Typeคูส่งน้ำ (ลองเพิ่ม/แก้ Type ใน setting แล้วกลับมาดู)
27. ✅ **คอลัมน์ Q และ SLOPE ในแท็บมิติคูส่งน้ำ มีลิสต์ให้เลือกแล้ว** (รอบ 9) — Q: 0.03/0.06/0.09/0.12/0.15/0.18 · SLOPE: 500/1000/1500/2000/2500/3000/3500/4000 · **ยังพิมพ์ค่าเองได้** และค่าถูกเก็บลงข้อมูลปกติ

### เช็กลิสต์เฉพาะรอบ 10 (แก้ตามผลตรวจรอบ 3)

28. **แท็บอาคารท่อรับน้ำเข้าแปลงไร่นา**: ช่อง **รายการอาคาร** ต้อง **ไม่มีกรอบ/พื้นสีเขียว** แล้ว (พื้นโปร่งใส) แต่ยังกดลูกศร ▼ เลือกได้และพิมพ์ได้
29. **setting → Typeคูส่งน้ำ**: ต้องเหลือ **6 แถว (VU1–VU6)** เท่านั้น — ไม่มี L/E/SL หลงเหลือ · ⚠️ **ลิสต์ TYPE ในแท็บมิติคูส่งน้ำจะเหลือ 6 ตัวตามไปด้วย** (ใช้ database เดียวกัน) ถ้าต้องการให้แท็บมิติมี Type มากกว่านี้ต้องแยก database
30. **Typeคูส่งน้ำ**: **VU1–VU5 ต้องไม่มีปุ่มเลย** · **VU6 มีแค่ `+`** · กด `+` แล้วแถวใหม่ (`NEW`) ต้องมี **`+` และ `−`** · กด `−` ที่แถว VU ต้องไม่ลบอะไร
31. **Typeอาคารประกอบ**: แถวสุดท้าย (อาคารท่อระบายน้ำแบบที่ 2) **มีแค่ `+`** · แถวอื่น ๆ ของชุดเดิม **ไม่มีปุ่ม** · แถวที่เพิ่มมาทีหลังมี **`+` และ `−`**
32. **🐞 ต้องโหลดไฟล์ JSON ที่บันทึกไว้ได้** (ทั้งไฟล์เก่าและไฟล์ที่เพิ่งบันทึก) — ต้องไม่ขึ้น *"ไม่สามารถอ่านไฟล์ JSON ได้: Assignment to constant variable"* อีก
33. **แท็บอาคารประกอบ** ยังต้องเลือก "ประเภทอาคาร" ได้ครบ 24 รายการ + รายการที่เพิ่มใหม่จากแท็บย่อย Typeอาคารประกอบ
31. **รูปแบบแถบแท็บ setting + แท็บย่อย**: แถวบน = แท็บหลัก (ตัวเลือกอยู่เป็นพื้นฟ้า `#007bff`) · **แถวล่าง = ชิปมุมมน** inactive พื้นขาวขอบเทา / **active พื้น teal `#17a2b8` ตัวอักษรขาว** และตัวรองรับเป็นกล่องพื้นเทามุมมน

---

## 5) ⚠️ สิ่งที่ต้องทดสอบก่อนแก้ไขต่อ

### เช็กลิสต์รอบ 31 (ใหม่ — เกี่ยวกับ cache + ปุ่มทดสอบ AI)

1. **Ctrl+Shift+R** (hard refresh) แล้วเปิดหน้าเว็บ → ต้องเห็นข้อความ **"/v1/chat/completions"** ในกล่องตั้งค่า AI (ไม่ใช่ `/api/extract`)
2. **ปุ่ม "🔌 ทดสอบการเชื่อมต่อ"** → ต้องขึ้นข้อความภาษาไทยที่บอกทางแก้ (ไม่ใช่ "เชื่อมต่อสำเร็จ" ตลอด) — ถ้าบัญชียังไม่ active ต้องขึ้นว่า "บัญชีของผู้ให้บริการ AI ยังไม่ active"
3. **ปุ่ม "🔄 ดูโมเดล"** → ต้องดึงรายชื่อโมเดลจริงมาให้คลิกเลือก (ต้องเห็น `gpt-4o` / `gpt-4.1` / `gpt-5`)
4. **ถ้าเปิด modal แล้วขึ้นข้อความ "ℹ️ พบว่าเคยตั้งค่าโมเดลเป็น gpt-6-astra..."** → แปลว่าระบบย้ายชื่อโมเดลเก่าให้แล้ว (ปกติ) → เลือกโมเดลใหม่แล้วกด "บันทึก"
5. **ตรวจว่าโค้ดใหม่มีผลจริง**: แก้ไฟล์ JS แล้วรัน `node tests\bump-version.js <เลขใหม่>` → refresh แล้วต้องเห็นของใหม่ (ถ้าไม่เห็น แปลว่ายังไม่ได้เปลี่ยนเลขเวอร์ชัน)

### เช็กลิสต์รอบ 30 (ใหม่ — ทดสอบบนเบราว์เซอร์หลัง Ctrl+Shift+R)

1. **บันทึก → ปิดหน้า → เปิดใหม่ → 📂 โหลด**: กรอบรูปที่ตีจาก PDF ต้อง **กลับมาครบทุกกรอบ** พร้อมกรอบที่เลือกอยู่ถูกโหลดเข้า canvas อัตโนมัติ · แท็บที่ค้างไว้ (PDF / รูปตัด / รูปอัปโหลด) ต้องเป็นแท็บเดิม
2. **พิกัด P1/P2**: เปิดไฟล์เดิมบนจอขนาดต่างจากตอนบันทึก → จุด P1/P2 ต้องยัง **ทับกับตำแหน่งเดิมในรูป** (ไม่เลื่อน)
3. **ป้ายลากย้าย**: คลิกที่ป้าย → ต้องจับได้และลากย้ายได้ (ขณะลากขอบกล่องต้องเป็นเส้นประ) · ลากแล้วป้ายต้องอยู่ตำแหน่งใหม่ตอนซูม/หมุนภาพ
4. **ป้ายหมุนตามข้อความ**: ป้ายชื่ออาคารที่เขียนเฉียงในรูป ต้องหมุนตามทิศข้อความนั้น
5. **เลือกแท็บรูป**: ถ้ามีหลายกรอบ → ป้ายของกรอบอื่น **ต้องไม่โผล่ทับ** (กดสลับกรอบแล้วป้ายของกรอบนั้นต้องมาแสดง)
6. **ปุ่ม AI**: ตั้งค่า API key ใน ⚙️ ตั้งค่า AI → กด "🤖 AI อ่านกรอบนี้" → ต้องเห็นป้าย/เส้นระดับที่วาดบนรูป + แท็บ "🤖 ผลอ่าน AI" ต้องแสดง diff พร้อมป้าย ใหม่/ต่าง/เหมือนเดิม
7. **นำเข้าจากแท็บผล AI**: เอาเครื่องหมายถูกเฉพาะบางช่อง (เช่น เฉพาะมิติ) → กด "✅ นำเข้าข้อมูล" → ตารางที่เลือกต้องเปลี่ยน ส่วนที่ไม่เลือกต้อง **ไม่เปลี่ยน**
8. **นำเข้าอาคาร**: หลังนำเข้า แถวอาคารของคูนั้นต้องยังอยู่ (ไม่ถูกล้างทิ้ง) · ศก. ท่อต้องถูกล็อกตามประเภทอาคาร
9. **ไฟล์ใหญ่**: ถ้าไฟล์เกิน 20 MB ต้องขึ้นถามว่าจะบันทึกโดยไม่แนบรูปหรือไม่
10. **ปุ่มเดิมต้องไม่พัง**: 📋 Copy · 💾 บันทึก · 📗 ส่งออก Excel · 📥 นำเข้า Excel · 📂 โหลด · 🗑 ลบเส้น · 🔲 ซูม win · 🔄 หมุนภาพ

### เช็กลิสต์รอบ 27 (ใหม่ — ทดสอบบนเบราว์เซอร์หลัง Ctrl+Shift+R)
1. **บันทึก → ปิดหน้า → เปิดใหม่ → 📂 โหลด**: ภาพแปลนต้องกลับมาแสดง พร้อมจุด P1/P2 และเส้นทุกเส้นตรงตำแหน่งเดิม (ไฟล์ JSON จะใหญ่ขึ้นเพราะแนบภาพ) — **ข้อนี้สำคัญที่สุด**
2. **การลบ**: กด `−` ทุกแท็บ (คู · มิติ · ระดับ · ดินเดิม · อาคารประกอบ · อาคารท่อรับน้ำ · Type ทั้ง 2 ตาราง) → ต้องมีกล่องยืนยัน และกด "ยกเลิก" ต้องไม่ลบ
3. **📋 Copy** ทุกแท็บ → ต้องขึ้นข้อความยืนยัน (ถ้าเบราว์เซอร์ไม่อนุญาตคลิปบอร์ด ต้องขึ้นข้อความแจ้ง ไม่เงียบ)
4. **setting → Typeอาคารประกอบ**: เปลี่ยนชื่อ Type แล้วกลับไปแท็บ 🏛️ อาคารประกอบ → แถวเดิมต้องเปลี่ยนชื่อตาม และช่อง H/ศก. ท่อ/ความยาว ยังแสดงค่าปกติ
5. **คอลัมน์ "ความยาว (ม.)"** → ลิสต์ต้องเป็น 0.50–10.00 (ยังพิมพ์ค่าเองได้)
6. **ซูมลึก ๆ** (ล้อเมาส์) บนภาพใหญ่ → จอต้องยังแสดงภาพ (อาจนุ่มขึ้นเล็กน้อย)
7. **Excel**: ส่งออก → นำเข้ากลับ → กม. (เช่น 1+050.40) · จำนวนแถวอาคารประกอบ (ต้องไม่เพิ่ม) · ชื่อ "รายการอาคาร" ของแถวที่มาจากระดับ · คูที่ชื่อซ้ำกันยังแยกข้อมูลถูกคู
8. **เปิด PDF** → ยังเปิดได้ปกติ (การปิด eval ของ pdf.js ไม่กระทบการแสดงผลทั่วไป)
9. **ปุ่ม 🔄 หมุนภาพ** → จุด/เส้นต้องหมุนตามภาพทันที และภาพต้องขึ้น (ไม่ว่าง)

### เช็กลิสต์เดิม (ยังใช้ได้)

1. **กด Ctrl+Shift+R (hard refresh)** — จำเป็น เพราะชื่อไฟล์ JS เปลี่ยน (มีไฟล์ใหม่ `js/tab-attachment.js`) เบราว์เซอร์อาจใช้แคชเก่า
2. คลิก **ทุกแท็บ** (8 แท็บ + แท็บย่อย setting 2 แท็บ) → ตารางต้องแสดงเหมือนเดิม
3. ปุ่ม **+ / −** เพิ่ม-ลบแถว · **🔒 ล็อก/แก้ไข** · **−/+ ยุบกลุ่ม** (แท็บระดับคูส่งน้ำ / ระดับดินเดิม / อาคารประกอบ / อาคารท่อรับน้ำเข้าแปลงไร่นา)
4. **🧮 คำนวณ** · **📈 วาดเส้นระดับ** · **✏️ วาดเส้นดินเดิม**
5. **📋 Copy** · **💾 บันทึก** · **📗 ส่งออก Excel** · **📥 นำเข้า Excel** · **📂 โหลด**
6. **🗑 ลบเส้น** (ต้องมีกล่องยืนยันในหน้าเว็บ) และ **🔲 ซูม win** (P1/P2 ต้องไม่ขยับ)
7. ทดสอบ **Ctrl+V** ว่าคัดลอกได้จริงหรือไม่ (ถ้าไม่ได้ → ต้องเพิ่ม fallback คลิปบอร์ด)

### เช็กลิสต์เฉพาะรอบ 7 (สำคัญ — แก้ตามที่เจ้าของงานตรวจ)

8. **แท็บอาคารท่อรับน้ำเข้าแปลงไร่นา** ต้องมี **8 คอลัมน์**: คลองส่งน้ำ / คูส่งน้ำ / **รายการอาคาร** / จำนวนอาคาร / H (ม.) / ศก. ท่อ (ม.) / ความยาว (ม.) / หมายเหตุ — **ต้องไม่มีคอลัมน์ "ประเภทอาคาร" และไม่มีคอลัมน์ชื่ออาคารที่คำนวณซ้ำ**
9. **แถวแรกของแต่ละคู**: ช่อง **รายการอาคาร** ต้องเป็นพื้นเทา (ล็อก ไม่มีสีเขียว) ค่าเป็น "อาคารท่อรับน้ำเข้าแปลงไร่นา" และลบแถวไม่ได้ · กด **+** ได้แถวใหม่ที่เลือกรายการอาคารได้
10. **จำนวนอาคาร** ต้องมีค่าเริ่มต้น **1** และแก้ไขได้ **ทุกแถว**
11. **ความยาว (ม.)** ค่าเริ่มต้น/แถวใหม่ ต้องเป็น **1.00**
12. **ศก. ท่อ (ม.)** ~~ของแถวที่แก้ไขได้ ต้องมีลิสต์ขนาดท่อให้เลือก~~ → **ถูกยกเลิกในรอบ 8** (กลายเป็นล็อกทั้งหมด ใส่ค่าเริ่มต้นให้ — ดูข้อ 25)
13. ช่องที่แก้ไขได้ทั้งหมดของแท็บนี้ ต้องเป็น **สีเขียว** (`#e8f5e9` ขอบ `#81c784`) เหมือนแท็บระดับคูส่งน้ำ — **ไม่ใช่สีเหลือง**
14. **กดปุ่ม "⚙️ setting" แล้วกดแท็บอื่น** → สีแท็บ setting และ **แถบแท็บย่อยต้องหายทันที** (ไม่ค้างสีแท็บก่อนหน้า)
15. **แถบแท็บย่อย Typeคูส่งน้ำ / Typeอาคารประกอบ** ต้องหน้าตาเหมือนแท็บหลัก (มุมบนมน สีฟ้าเมื่อ active) และต่อเนื่องเป็นแถวเดียวกับแท็บหลัก
16. **เมนูด้านซ้าย** ต้องมีแค่เมนูย่อยของ "ประมาณการ" — **ไม่มีเมนูย่อยใต้ Setting** แล้ว (กด Setting → เปิดแท็บ setting พร้อมแถบแท็บย่อย)
17. **คอลัมน์ คลองส่งน้ำ / คูส่งน้ำ** ต้องตรงกับที่ตั้งไว้ในแท็บ **มิติคูส่งน้ำ**
18. **setting**: แท็บ Typeคูส่งน้ำ ต้องมีข้อมูลเดิมครบ · แท็บย่อย **Typeอาคารประกอบ** ต้องเห็นลิสต์ชื่ออาคาร 24 รายการ (แก้ชื่อได้)
19. **ส่งออก Excel → นำเข้า Excel กลับ** ต้องได้ข้อมูลแท็บใหม่ครบ (ชีต `อาคารท่อรับน้ำเข้าแปลงไร่นา` และ `setting`)
20. **โหลด JSON ไฟล์เก่า** → ช่องหมายเหตุของแท็บอาคารประกอบต้องกลายเป็นว่าง (ไม่ใช่ `-`)
21. **แท็บอาคารประกอบ** (ของเดิม): ปลดล็อก 🔒 แล้วกด **+** → **H ต้องเป็น 0.00 และพิมพ์แก้ได้** · หัวคอลัมน์สุดท้ายเป็น **"ความยาว (ม.)"** · **หมายเหตุ ต้องว่าง** ไม่มี `-`

---

## 6) ข้อจำกัดสภาพแวดล้อม (ต้นเหตุของบั๊ก "กดแล้วเงียบ" ทั้งชุด)

- **พรีวิว DSH = iframe sandbox ที่ไม่มี `allow-modals`** → `alert()` / `confirm()` / `prompt()` **ถูกบล็อกเงียบ ๆ**
  (console จะขึ้น *"Ignored call to 'confirm()'. The document is sandboxed…"*)
  → **ต้องใช้ `uiToast()` / `uiConfirm()` / `uiPrompt()` เท่านั้น อย่ากลับไปใช้ modal ของเบราว์เซอร์**
- `window.alert` ถูก override ไปที่ `uiToast` แล้ว → เรียก `alert()` ในโค้ดใหม่ได้ตามปกติ (จะกลายเป็นข้อความในหน้าเว็บ)
- **การดาวน์โหลดไฟล์** ใน iframe ต้องมี `allow-downloads` (เจ้าของงานยืนยันว่าบันทึกไฟล์ได้)
- **คลิปบอร์ด** — ✅ แก้แล้วในรอบ 27: [io-manager.js](js/io-manager.js) ใช้ `writeToClipboard()` ที่มี `.catch()` + วิธีสำรอง `execCommand` + แจ้งเตือนเมื่อล้มเหลว (เดิมเงียบ)
- Agent **รันเบราว์เซอร์ headless ไม่ได้** ในแซนด์บ็อกซ์นี้ (`Access denied`) → ทดสอบหน้าจอจริงได้โดยเจ้าของงานเท่านั้น (แต่รัน **Node** ได้ → ใช้ `tests\smoke-test.js` + `tests\probe-bugs.js` ตรวจตรรกะได้)
- **เครื่องนี้ติดตั้ง Git แล้ว (2.55)** แต่ **ยังไม่ได้ `git init` ในโปรเจกต์นี้** (รอบ 27 เคยตั้งค่าไว้ตอนที่เครื่องยังไม่มี Git และเชลล์ agent ออกอินเทอร์เน็ตไม่ได้) → รอบ 28 ยังไม่ได้ init เพราะเจ้าของงานสั่งแก้เฉพาะ 3 ข้อที่ระบุ · **คำสั่ง init/commit อยู่ในหัวข้อ 8** รันเองได้ทันที
  - หมายเหตุ: `web_fetch`/`web_search` ของ agent ยังใช้ได้ (ออกเน็ตผ่านทาง harness ไม่ใช่เชลล์)
- **ไฟล์ที่เว็บต้องโหลดจากอินเทอร์เน็ต:** pdf.js + SheetJS (cdnjs / cdn.sheetjs.com) + โลโก้ `i.ibb.co` → ต้องต่อเน็ต และควรย้ายมาเก็บในโปรเจกต์ถ้าต้องการใช้ออฟไลน์

---

## 7) ค้างไว้ / ข้อเสนอถัดไป

1. 🔑 **เจ้าของงานต้อง rotate คีย์ GEMINI** ที่ Google AI Studio — ไฟล์ `.env` ถูกลบแล้ว แต่เคยซิงก์ขึ้น Dropbox (อาจอยู่ในประวัติ ~30 วัน) · **และพบ `serviceAccountKey.json` + `.firebaserc` ของ Firebase อยู่ในโฟลเดอร์พี่น้อง `เวบ1` ซึ่งซิงก์ Dropbox → ควร rotate + ย้าย secrets ออกจาก Dropbox ด้วย**
2. **`git init` + commit ครั้งแรก** (Git 2.55 ติดตั้งในเครื่องแล้ว — คำสั่งในหัวข้อ 8) แล้วลบ `js/table-core.js.bak1` + `HANDOFF.md.bak1` (หลัง commit) · `_backup_archive\...zip` ไม่มีอยู่แล้ว
3. ~~ลบ `Delete/` ที่เหลือ 2 ไฟล์~~ ✅ ไม่มีในโปรเจกต์นี้แล้ว (ย้ายโฟลเดอร์)
3.1 **ลบไฟล์ขยะใน `tests/`**: `smoke-test.js.bak_20261017-195252` + `smoke-test.js.bak_20261017-122113` (~260 KB)
3.2 **ตรวจชื่อไฟล์หลัง sync ทุกครั้ง** — Google Drive เติม `(1)` ได้ (หัวข้อ 3)
4. ~~autosave~~ ✅ ทำแล้วรอบ 36 (เชฟอัตโนมัติทุก 5 นาที เก็บสำรองในเบราว์เซอร์ · รอบ 37 ตัดปุ่มหน้าเว็บเหลือกล่องสถานะสีเขียว 3 บรรทัด) — **เหลือทำ: undo + เตือนก่อนปิดหน้า**
5. ~~เพิ่ม `.catch()` + fallback ให้ฟังก์ชันคัดลอก~~ ✅ ทำแล้วในรอบ 27
6. พัฒนาเมนูที่ยังเป็น "หน้าว่าง" 7 จุด: แผนที่ระบบงาน · แผนงานโครงการ (เมนูซ้าย) · แผนจัดซื้อจัดจ้าง · เรียกเก็บค่าใช้จ่าย · **ส่วนคำนวณปริมาณ** · **ส่วนราคาวัสดุ** · **พิมพ์รายงาน**
   — 3 ตัวท้ายคือคุณค่าธุรกิจสูงสุดที่ยังขาด (ตอนนี้เว็บเป็นเครื่องมือกรอกข้อมูล + digitizer ยังไม่คำนวณปริมาณ/ราคา)
7. **ความหนากำแพง/พื้น** (รอบ 8) และ **ขนาดท่อ/ความยาว** ที่มีอยู่ ยังไม่ถูกนำไปคำนวณปริมาณ — ต่อที่ "ส่วนคำนวณปริมาณ" ได้เลย
8. ย้ายโลโก้จาก `i.ibb.co` เข้าโปรเจกต์ + พิจารณา vendor pdf.js/SheetJS ให้ใช้แบบออฟไลน์ได้
9. Accessibility: เมนูเป็น `<a onclick>` ไม่มี `href`/role, แท็บกดด้วยคีย์บอร์ดไม่ได้, canvas ไม่มี fallback
10. **รอเจ้าของงานยืนยัน 2 เรื่อง:** การเพิ่มคอลัมน์เทคนิคใน Excel ("ลำดับคู" / "จากระดับ") และการที่ปุ่ม + ที่แถวสุดท้ายของแท็บระดับคูส่งน้ำ "แบ่งครึ่งช่วง" ให้อัตโนมัติ — ถ้าไม่ต้องการ แก้ได้ที่จุดเดียว

---

## 8) เคล็ดลับทางเทคนิคสำหรับผู้รับงาน

- ต้อง `read` ไฟล์ก่อน `edit` ทุกครั้ง (นโยบายไฟล์) — ถ้าเจอ *"file changed since it was read"* ให้ `read` ซ้ำแล้ว `edit` ทันทีในข้อความเดียวกัน (Dropbox แตะ mtime)
- **ห้ามใช้ภาษาไทยเป็นชื่อ property/key ในสคริปต์ PowerShell** (encoding เพี้ยน → parse error) ให้ใช้ชื่อ ASCII แล้วแสดงข้อความไทยเฉพาะในสตริง
- สคริปต์ยาว ๆ: เขียนลงไฟล์ชั่วคราวใน `$env:TEMP` แล้ว `node <ไฟล์>` (เลี่ยงปัญหา quote/encoding)
- ตรวจไวยากรณ์: `node --check js\<ไฟล์>.js`
- **ก่อนส่งงานต้องรัน:** `node tests\smoke-test.js` (ต้อง `ALL CHECKS PASSED`) + `node tests\probe-bugs.js` (ต้อง `FAIL = 0`)
- **ล่าบั๊กใหม่:** เปิด `tests\probe-bugs.js` ดูโครง DOM จำลอง แล้วเพิ่มหัวข้อใหม่เป็น `P11, P12, …` — จุดที่ mock ต่างจากเบราว์เซอร์จริง: `document.querySelectorAll` คืน `[]`, `getBoundingClientRect` ค่าคงที่, canvas ไม่วาดจริง
- **Git (ยังไม่ได้ `git init` ในโปรเจกต์นี้ — Git 2.55 ติดตั้งในเครื่องแล้ว):** รันครั้งเดียว
  ```powershell
  cd "G:\My Drive\web2"
  git init
  git add -A
  git commit -m "chore: บันทึกสถานะโปรเจกต์เวบ2 (รอบ 28)"
  ```
  จากนั้นใช้ `git add -A` → `git commit -m "…"` ก่อน/หลังแก้ทุกครั้ง · ดูเวอร์ชันเก่าโดยไม่ทับไฟล์: `git show HEAD~1:js/state.js`
  ⚠️ โฟลเดอร์อยู่บน **Google Drive** — Git ไม่ได้กันบั๊กชื่อไฟล์ `(1)` จาก sync ได้ ต้องตรวจชื่อไฟล์ตามหัวข้อ 3 ทุกครั้ง
- **ตรวจชื่อไฟล์หลัง sync (บังคับ):** ดูหัวข้อ 3 หัวข้อย่อย "⚠️ ขั้นตอนบังคับ: ตรวจชื่อไฟล์หลัง sync" — รันสคริปต์ตรวจ 3 ข้อก่อนเริ่มงานทุกครั้ง
- **ตรวจ token ที่เหลือ:** อ่าน `C:\Users\Lenovo\.dsh\sessions\<โฟลเดอร์โปรเจกต์>\<session-id>\session.v4.jsonl.zstd`
  (zstd + JSONL — ดูฟิลด์ `data.usage.{inputTokens,outputTokens,cacheReadTokens,totalTokens}` และ `request/context.contextWindow` = 1,000,000)
- ผู้ใช้อัปเดตไฟล์ผ่าน **พรีวิว DSH** (`http://127.0.0.1:19387`) — ต้องรีเฟรชทุกครั้งหลังแก้ไฟล์
- **ระวัง breaking change:** ถ้าจะเปลี่ยนคอลัมน์ Excel / โครง JSON / คีย์ Type ต้องคิดเรื่องไฟล์เก่าที่ผู้ใช้บันทึกไว้ด้วยเสมอ (ดูหัวข้อ 4.7 ท้ายสุด)

---

## 9) แผนที่โค้ด (หา function ได้เร็ว)

| อยากแก้เรื่อง | ไปที่ไฟล์ | ฟังก์ชันสำคัญ |
|---|---|---|
| การวาดบน Canvas / ซูม / P1-P2 | `js/canvas-viewer.js` | `redraw()`, `scaleOverlayPixels()`, `updateCanvasSize()`, `computeRenderDPR()`, `fitImageToViewportWithPadding()`, `setMode()` |
| หมุนภาพ (+ หมุนจุด/เส้นตาม) | `js/canvas-viewer.js` | `rotateImageView()`, `rotateOverlayPixels()`, `applyRotationToImage(deltaDeg, onDone)`, `applyPendingRotationToImage()`, `resetImageRotation()` |
| UI แจ้งเตือน/ยืนยัน/กรอกชื่อไฟล์ | `js/canvas-viewer.js` | `uiToast()`, `uiConfirm()`, `uiPrompt()`, `clearOnlyDrawingLines()` |
| โครงตาราง/สลับแท็บ | `js/table-core.js` | `updateTable()`, `switchTableTab()`, `switchSettingsSubTab()`, `syncSettingsSubTabUI()`, `syncTableInputsToChannels()`, `bindExcelNavigation()`, **แถวข้อความจุดอ้างอิง P1/P2 (รอบ 29)** `renderReadonlyP1P2ToolbarRowHtml(cIdx, colSpan, sepClass, extraHtml)` (พารามิเตอร์ `extraHtml` ใช้แทรกปุ่มในแถว) |
| **ยืนยันก่อนลบ** (ทุกปุ่ม `−`) | `js/table-core.js` + `js/tab-*.js` | `confirmDelete(msg, doIt)` และคู่ `deleteXxx()` (ถาม) / `doDeleteXxx()` (ทำงานจริง) |
| แปลง/แสดง กม. | `js/table-core.js` | `formatKmDisplay()` (บนจอ) · `formatKmForExport()` (ลง Excel — ไม่ปัดเศษเมตร) · `parseKmInput()` |
| ซิงก์ข้อมูลข้ามแท็บ | `js/table-sync.js` | `syncDimensionRowsWithChannels()`, `syncGroundRowsWithDimensions()`, `syncStructureRowsWithLevel()`, `syncAttachmentRowsWithLevel()`, `sameStructureKm()` |
| การแสดงตารางแต่ละแท็บ | `js/tab-<ชื่อแท็บ>.js` | `renderXxxTab()` |
| คำนวณระดับ BL/TBL และวาดเส้นระดับ | `js/tab-level.js` | `calculateLevelSingleRow()`, `drawCanalLevelLines()`, `stepLevelVal()`, `updateLevelField()`, `addLevelRowAt()` (แบ่งครึ่งช่วงเมื่อกด + ที่แถวสุดท้าย) |
| คำนวณ/วาดเส้นดินเดิม | `js/tab-ground.js` | `calculateGroundForChannel()`, `drawGroundFromTable()`, `updateGroundField()` |
| อาคารประกอบ (H, ความยาว) | `js/tab-structure.js` | `updateStructureField()`, `computeStructureItemName()` (อยู่ `table-sync.js`), ชื่อที่แสดงใช้ `computeStructureTypeName()` + `structureNameValue()`, **ปุ่มแสดง/ซ่อนป้ายอาคารประกอบ (รอบ 29)** `toggleStructureShowLabels()` + `isStructureLabelsVisible()` (เก็บใน `structureGroupState[...].showLabels` · ตัวกรองวาดใน `canvas-viewer.js` → `redraw()`) |
| เพิ่ม/ลบคูส่งน้ำ (ต้องเลื่อน index ทุกก้อน) | `js/tab-ditch.js` | `addChannelAt()`, `deleteChannelAt()` → `doDeleteChannelAt()`, `shiftAllChannelGroupStates()` (คีย์กลุ่ม `ch_*` / `ground_ch_*` / `struct_ch_*` / `attach_ch_*`) |
| **แท็บ อาคารท่อรับน้ำเข้าแปลงไร่นา** | `js/tab-attachment.js` | `renderAttachmentTab()`, `addAttachmentRowAt()`, `deleteAttachmentRowAt()`, `updateAttachmentField()`, `refreshAttachmentTypeCell()` · กฎ/ค่า ศก. ท่อ อยู่ `js/state.js` (`attachmentTypeRules`, `getAttachmentPipeDia()`) |
| **แท็บย่อย setting** | `js/tab-type.js` | `renderTypeTab()`, `renderSettingsStructureTab()`, `addStructureTypeRow()`, `updateStructureTypeField()` (เปลี่ยนชื่อ Type แล้วอัปเดตแถวอาคารประกอบให้ด้วย), `deleteDitchTypeRow()`, `deleteStructureTypeRow()` |
| บันทึก/โหลด JSON (แนบภาพ) | `js/io-manager.js` | `saveProjectJSON()`, `loadProjectJSON()`, `buildProjectImagePayload()`, `buildOverlayPayload()`, `restoreProjectImage()` |
| Excel 8 ชีต (ไป-กลับ) | `js/io-manager.js` | `exportAllToExcel()`, `importAllFromExcel()`, `excelCellText2()`, `makeChannelResolver()`, `pickUserVal()`, `structureNumericForFile()`, `structureRemarkForFile()` |
| Copy ทุกแท็บ | `js/io-manager.js` | `copyTableData()` → `writeToClipboard()` (มี fallback + แจ้งเตือน) |
| ข้อมูลกลาง/ตัวเลือกอาคาร | `js/state.js` | `channels`, `dimensionRows`, `levelRowsData`, `groundRowsData`, `structureRowsData`, `attachmentRowsData`, `ditchTypeDatabase`, `structureTypeDatabase`, `structureOptions`, `pipeDiameterOptions`, `lengthOptions`, `qOptions`, `slopeOptions`, `attachmentTypeRules`, `ditchTypeDefaultsSnapshot`, `structureTypeDefaultsSnapshot` |
| เทสต์/ล่าบั๊ก | `tests/*.js` | `smoke-test.js` (448 ข้อ · DOM จำลอง) · `probe-bugs.js` (44 ข้อ · mock ใกล้เบราว์เซอร์กว่า + XLSX อ่านหัวตารางได้) |
| ตั้ง Git | `.gitignore` (มีอยู่แล้ว) · ยังไม่มี repo → รัน `git init` + `git add -A` + `git commit` (หัวข้อ 8) |

---

## 10) สรุปงานรอบ 34 (`?v=20261025h`)

1. **จุด P1, P2 จาก AI และการแสดงบนรูปภาพ (`js/ai-reader.js`, `js/canvas-viewer.js`)**:
   - เพิ่ม `aiCalibrateRefPoints(rp, channels, rawLabels)` ปรับเทียบค่า P1 และ P2 ตามสเกลตารางกราฟมาตรฐานของแปลนรูปตัดตามยาว: **ค่าระดับห่างกัน 1 ช่องตาราง = 1.00 เมตร** (P1 = เส้นตารางล่างสุด, P2 = เส้นตารางบนสุด `p2.elev > p1.elev`) และ **ค่า กม. ห่างกัน 1 ช่องตารางหลัก = 100 เมตร**
   - วาดจุด P1 และ P2 พร้อมป้ายบอก กม. และค่าระดับบนรูปภาพใน `redraw()` ทันที
2. **การแสดงค่าในรูปภาพ (`js/ai-reader.js`, `js/canvas-viewer.js`)**:
   - กรองไม่แสดงค่าระดับประจำเส้นตารางแกนซ้าย (`+250.00` ฯลฯ), ค่า `F.S.L.` (`FSL`), จุดดำๆ (`●`) และไม่วาดจุดกลมปลายเส้นระดับรวมถึงไม่วาดค่าเริ่มต้นจากตาราง (`อาคารท่อส่งน้ำเข้านา (เดิม)`) ลงกลางภาพ
   - ขยับตำแหน่งป้ายให้ทับข้อความจริง (`boxCenterX, boxCenterY`), จัดป้าย **อาคาร** ให้อยู่ด้านบน, ป้าย **slope** ให้อยู่เหนือเส้นระดับ, และป้าย **3 ระดับ (`elev`)** ให้อยู่ท้ายสุด (วาดชั้นบนสุด)
   - ป้ายอาคารจัดชิดซ้าย (`textAlign = 'left'`) และแยกสีข้อความในป้ายเดียวกัน (**กม.** `#0d47a1`, **ชื่ออาคาร** `#6f42c1`, **ค่า H** `#dc2626`)
   - ชื่อคู (`ditch`) ใช้ `cleanDitchNumber()` ตัดคำนำหน้าออกให้เหลือเฉพาะตัวเลขรหัสคู (เช่น `"01"`, `"04"`, `"04-1"`)
   - แยกสีละเส้นชัดเจน: เส้นดินเดิมสีส้ม (`#fd7e14`), เส้นระดับก้นคู `BL` สีน้ำเงิน (`#0056b3`), เส้นระดับหลังคันคู `TBL` สีเขียว (`#28a745`)
3. **การอ่านและวาดเส้นดินเดิมจาก AI (`js/ai-reader.js`, `js/canvas-viewer.js`)**:
   - เพิ่มการอ่าน `ground` และ `groundLine` จาก AI พร้อมวาดเส้นดินเดิมสีส้ม (`kind === 'ground'`) บนรูปภาพและซิงก์เข้าตารางระดับดินเดิมอัตโนมัติ
4. **สถานะปุ่มแสดงแท็บขวาและชื่อปุ่ม (`index.html`, `js/canvas-viewer.js`)**:
   - ผูก `overlayVisibility` (`groundLine`, `levelLine`, `elevationLabels`, `structures`, `slopeLabels`) เข้ากับ `drawCanvasLabels(c)` และ `redraw()` เพื่อให้ปุ่มแถบขวาเปิด/ปิดสิ่งที่แสดงในรูปได้จริงทุกปุ่ม
   - เปลี่ยนชื่อปุ่ม `#btn-toggle-structures` ใน `index.html` จาก `🏛️ แสดงอาคาร` เป็น `🏛️ แสดงชื่ออาคาร`
5. **ตารางระดับคูส่งน้ำบันทึกเป็นช่วงตาม กม. ที่มีค่า H (`js/ai-reader.js`)**:
   - เพิ่ม `aiFilterLevelIntervalsByH()` รวมช่วงย่อยที่ไม่มีค่า H เข้าด้วยกัน และแบ่งช่วงเฉพาะตามจุด กม. ที่มีค่า `H > 0`
6. **แท็บผลอ่าน AI การเซฟอัตโนมัติ และการซิงก์รูปภาพ ↔ ชุดข้อมูล (`js/tab-ai-result.js`, `js/canvas-viewer.js`)**:
   - แสดงผลในแท็บ `🤖 ผลอ่าน AI` แยกเป็นชุดข้อมูลตามภาพ (`ai-frame-dataset-card`) และแสดงตารางเหมือนแต่ละแท็บ (`ai-mirror-table`)
   - เมื่อ AI อ่านค่าเสร็จ บันทึกค่าลงตารางและผูก P1/P2 อัตโนมัติทันที (`applyAiResultsToTables` + `applyAiRefPointsToGroupState`)
   - ซิงก์ 2 ทาง (`syncChannelSelectionFromFrame` / `syncFrameSelectionFromChannel`): กดเลือกรูปย่อยแล้วเปลี่ยนชุดข้อมูลตาม หรือกดเลือกข้อมูลในตารางแล้วรูปเปลี่ยนตามทันที

---

## 11) สรุปงานรอบ 35 (`?v=20261025k`)

แก้ไข 11 รายการตามคำสั่งผู้ใช้ (ตรวจสอบเว็บใหม่หลังแก้ไข):

1. **แสดงจุด P1 / P2 พร้อมป้าย กม. และระดับ (`js/canvas-viewer.js` → `redraw()`)**:
   - วาดจุดกลมสีแดงพร้อมป้ายสี่เหลี่ยมข้อความรูปแบบ `P1 (กม. 0+000, +250.00)` / `P2 (กม. 0+300, +254.00)`
   - ดึงพิกัดจาก `refPixels` → `groundGroupState` → `aiRefPoints` (ของกรอบรูปปัจจุบัน) ตามลำดับ
2. **แก้จุดเริ่มต้นเส้นวาดคาดเคลื่อน (`js/ai-reader.js` → `aiCalibrateRefPoints()`)**:
   - เพิ่ม **การถดถอยเชิงเส้น (least squares)** บนตำแหน่งป้าย "กม." ทั้งหมด เพื่อให้ได้สเกลตารางกราฟมาตรฐานที่สม่ำเสมอ
   - จุดเริ่มต้น/สิ้นสุดของเส้นระดับจึงตรงกับตาราง 100% (ไม่หลุดไปตามตำแหน่งป้ายที่ AI อ่านคลาดเคลื่อน)
3. **กรองป้าย slope ที่ซ้ำ/เกิน (`js/ai-reader.js` → `normalizeAiResult()`)**:
   - ข้ามค่า slope ที่ซ้ำกันติดกัน และไม่วางป้ายบนช่วงเส้นที่สั้นกว่า 0.08 (หน่วยสัดส่วน)
4. **กฎจำนวนค่าระดับ + ขยับป้ายไปทางท้าย (`js/ai-reader.js` → `aiMergeLabelGroup()`)**:
   - เพิ่ม `aiIsStationZeroLabelGroup()` — ตรวจว่ากลุ่มป้ายค่าระดับอยู่ที่ **"กม. 0"** หรือไม่ (ดูทั้งป้ายในกลุ่มเดียวกันและป้าย กม. ที่แยกกลุ่มแต่อยู่ใกล้แนวตั้ง)
   - **กม. 0 → 2 ค่า** · **กม. อื่นๆ → 3 ค่า** (`maxRows = atStationZero ? 2 : 3`)
   - เลื่อนป้ายไปทางขวาอีก 1 ตัวอักษร (`maxX + 0.022 + 0.014`)
   - เก็บป้ายทั้งหมดไว้เป็นบริบทใน `aiCurrentLabelContext` เพื่อให้ตรวจบริบทได้
5. **ขยับป้ายอาคารขึ้นด้านบนให้พ้นตัวหนังสือ (`js/ai-reader.js` → `normalizeAiResult()`)**:
   - `ny = Math.max(0.03, Math.min(ny, 0.32) - 0.02)`
6. **รูปภาพย่อยตอนไม่ได้เลือกให้สีอ่อนลง (`style.css`)**:
   - `.thumbnail-card.square-thumb:not(.active)` → พื้น `#b6bcc4`, ภาพ `opacity: 0.55` + `saturate(0.65)`
7. **ปุ่ม PDF สลับสองสถานะ (`index.html`, `js/canvas-viewer.js`)**:
   - ปุ่ม `#btn-side-save-frames` เริ่มต้นเป็น **"✂️ ตีกรอบรูป"**; เมื่อกดเข้าโหมดตีกรอบ → **"💾 บันทึก กรอบรูป"**; กดอีกครั้ง (บันทึกแล้ว) → กลับเป็น "✂️ ตีกรอบรูป"
   - ฟังก์ชัน `syncPdfCropSaveButtonUI()` (ซิงก์ UI) + `togglePdfFrameCropButton()` (สลับโหมด)
8. **AI เปลี่ยนชื่อรูปภาพ/รูปย่อยอัตโนมัติ (`js/canvas-viewer.js` → `applyAiFrameName()`)**:
   - เมื่อ AI อ่านเสร็จ เปลี่ยนชื่อกรอบรูปจาก "รูปภาพ 1" เป็นชื่อคูที่อ่านได้ เช่น `คลองส่งน้ำสายใหญ่ / คูส่งน้ำ 01`
   - ตั้ง `_customName = true` เพื่อไม่ให้ `renumberLongitudinalItems()` ตั้งชื่อกลับ
   - ซิงก์ทั้งฝั่ง PDF (`pdfCropFrames`) และฝั่งรูปตัดตามยาว (ชุดข้อมูล `channels[]._frameName`) + รีเฟรชรูปย่อย
9. **ลบการ์ดสถานะ (โหมด / ชุดข้อมูล / ซูม) จากแท็บขวา (`index.html`, `js/canvas-viewer.js`)**:
   - ลบ `#sideStatusCard` และ `#sideImageAiSection` ออกทั้งส่วน PDF และส่วนแสดงรูปตัดตามยาว
   - `updateSideControlStatus()` เหลือหน้าที่เรียก `syncSideControlPanelByMediaTab()` เท่านั้น
10. **ใช้ชื่อโครงการเป็นชื่อไฟล์เวลาเซฟ (`js/io-manager.js`)**:
    - `saveProjectJSON()` → `<ชื่อโครงการ>_Project.json`
    - `exportAllToExcel()` → `<ชื่อโครงการ>_AllData.xlsx`
    - fallback เป็นชื่อไฟล์เดิม หรือ `BCLC_Project` เมื่อไม่มีชื่อโครงการ
11. **จัดหน้าแท็บขวา ส่วนแสดงรูปตัดตามยาว (`index.html`, `style.css`)**:
    - ย้ายปุ่ม **"⚙️ ตั้งค่า AI"** มาใต้ปุ่ม "🤖 AI อ่านทุกกรอบ"
    - กล่องสถานะการทำงาน AI (`#aiWorkingStatusBox`) อยู่ใต้หน้าต่างแสดงสถานะ
    - เพิ่ม `<hr class="side-panel-divider">` (เส้นปะแบ่ง) ใต้ปุ่มตั้งค่า AI ก่อนปุ่มด้านล่าง

### แก้บั๊กระหว่างทาง
- **`P11.6` (probe-bugs.js)**: ค่า `pipeDia` = 0 จาก AI ถูกโดนค่าเริ่มต้นจากตาราง Typeอาคารประกอบทับ ทำให้ "0 ไม่ทับค่าตาราง" ไม่จริง → ปล่อยให้ค่าเริ่มต้นจากตารางถูกนำไปแสดงตอนเรนเดอร์แทน (`js/ai-reader.js` → `aiSplitAndNormalizeStructures()`)
- **`check-round32.js`**: harness ดึงฟังก์ชันมาแยก scope → ต้องเพิ่ม helper ที่ `aiMergeLabelGroup()` เรียกใช้ (`splitCompoundStructureText`, `matchStructureTypeFromDatabase`, `computeThaiStringSimilarity`, `getDefaultStructureTypeDBForAi`, `aiIsStationZeroLabelGroup`, `aiCurrentLabelContext`)
- **`round30-check.js`**: assertion เดิมอ้าง `escapeHtml(l.text)` ซึ่งลบไปแล้วในรอบ 34 (ตาราง "ป้ายข้อความในรูปภาพ" ถูกถอดออกจากแท็บผลอ่าน AI ตามคำสั่งผู้ใช้) → ปรับให้ตรวจกับ `escapeHtml(s.name)` / `escapeHtml(s.pipeDia ? ...)` แทน และเพิ่ม assertion ยืนยันว่าตารางป้ายถูกลบแล้ว

### ผลการทดสอบ (รอบ 35)
| ชุด | ผล |
|---|---|
| `tests/smoke-test.js` | ✅ ALL CHECKS PASSED |
| `tests/probe-bugs.js` | ✅ FAIL = 0 |
| `tests/round30-check.js` | ✅ 120 / 120 |
| `tests/check-round32.js` | ✅ 44 / 44 |
| `tests/check-all-encoding.js` | ✅ 0 warnings (UTF-8 สะอาดทุกไฟล์) |
| `node --check` ทุกไฟล์ใน `js/` | ✅ ไม่มี syntax error |

> ⚠️ **ยังรอผู้ใช้ทดสอบบนเบราว์เซอร์** — โดยเฉพาะการวาดเส้น/ป้ายบนรูปจริง, การสลับปุ่มตีกรอบ, และการเปลี่ยนชื่อรูปย่อยอัตโนมัติ

---

## 12) สรุปงานรอบ 38 (`?v=20261026c`) — พัฒนาแท็บส่วนแสดงรูปตัดขวาง

1. **เปลี่ยนชื่อแท็บ (`index.html`, `js/canvas-viewer.js`)**:
   - เปลี่ยนชื่อปุ่ม `#media-tab-draw` จาก `"📐 ส่วนแสดงรูปตัดตามขวาง"` เป็น `"📐 ส่วนแสดงรูปตัดขวาง"`
2. **พื้นที่วาดรูปใช้หลักการวาดรูปจากไฟล์ที่แนบ (`canal_cross_section.html` → `js/canvas-viewer.js`)**:
   - คำนวณพิกัดจุด Node 1–14 (`p1`–`p14`), พื้นที่ขุดลอกหน้าดิน (6-7-8-9), พื้นที่ดินถมบดอัดแน่น 85% (5-6-7-8-9-10), พื้นที่ดินขุด (5-7-8-10), พื้นที่ดินถมด้วยแรงคน (ซ้าย/ขวา/รวม), โครงสร้างคอนกรีต U-Section, คอนกรีตหยาบรองพื้น 0.05m (4-11), ความกว้างขุดลอกหน้าดิน (6-9) และความกว้างคันดินด้านล่าง (1-14) แบบอัตราส่วนสมจริง Scale 1:1
   - วาดตารางแสดงค่าพื้นที่ (Area Summary), เส้นบอกมิติโครงสร้าง, เส้นบอกความกว้างด้านล่าง และรองรับการลากเมาส์ย้ายมุมมอง (Pan) / หมุนลูกกลิ้งเมาส์ย่อ-ขยาย (Zoom)
3. **แท็บขวา: เพิ่มดรอปลิสต์เลือก คลองส่งน้ำและคูส่งน้ำ ตำแหน่งบนสุด (`#crossSectionChannelSelect`)**:
   - แสดงรายการคลองส่งน้ำและคูส่งน้ำทั้งหมดในโครงการ เมื่อเปลี่ยนสายจะอัปเดตรายการ กม. และวาดรูปตัดขวางใหม่ทันที
4. **แท็บขวา: เพิ่มดรอปลิสต์เลือก กม. คูส่งน้ำ (`#crossSectionKmSelect`) + ลูกศรขึ้น-ลง (`▲`/`▼` และปุ่มคีย์บอร์ด `ArrowUp`/`ArrowDown`)**:
   - รวมรายการ กม. จากแท็บระดับดินเดิม (`groundRowsData`) และแท็บระดับคูส่งน้ำ (`levelRowsData`) เข้าด้วยกันโดยอัตโนมัติ (`getCombinedKmsForChannel`)
   - หาก กม. ที่เลือกไม่มีค่าในตารางระดับดินเดิมหรือตารางระดับคูส่งน้ำ ระบบจะคำนวณ Interpolate ให้อัตโนมัติ (`computeCrossSectionParams`)
5. **เพิ่มเส้นประแบ่งกลุ่มปุ่ม (`<hr class="side-panel-divider">`)**:
   - แบ่งกลุ่มดรอปลิสต์เลือกคลอง/กม., กลุ่มปุ่มควบคุมรูปตัดขวาง, กลุ่มปุ่มแสดงผลร่วม และปุ่มหมุนภาพอย่างชัดเจน
6. **วาดรูปตัดขวาง Auto ตาม กม. ที่เลือก**:
   - เชื่อมโยงข้อมูลจาก กม. ที่เลือกไปวาดรูปตัดขวางอัตโนมัติทันที (`tests/check-round38.js` ผ่าน 8/8 ข้อ)

---

## 13) สรุปงานรอบ 42 (`?v=20261027b`) — ตรวจปุ่ม + หน้าต่างตรวจสอบก่อนส่งออก + ระบบเครดิต AI

### 13.1 ตรวจสอบการทำงานของปุ่มทั้งหมด

- **audit แบบ static** (`tests/check-round42.js` ข้อ R42.1): สแกน `onclick` / `onchange` / `oninput` / `onmousedown` / `onmouseup` / `onkeyup` / `onkeydown` / `onfocus` / `onblur` / `onsubmit` ทั้งใน `index.html` และในไฟล์ JS (รวม template string ที่สร้างปุ่ม dynamic) → ตรวจว่า (ก) ฟังก์ชันที่ถูกเรียกมีอยู่จริง (ข) ไม่มีฟังก์ชันที่ว่างเปล่า (ค) `id` ใน `index.html` ไม่ซ้ำ (ง) ไฟล์ `.js` ที่ `<script src>` โหลดมีอยู่จริง
- **audit ในเบราว์เซอร์จริง**: หน้าเว็บมีปุ่ม 102 ตัว → 100 ตัวมี `onclick` ที่ผูกฟังก์ชันถูกต้อง · อีก 2 ตัว (`uiConfirmOkBtn` / `uiConfirmCancelBtn`) ใช้ `addEventListener` แทน — ทดสอบแล้วทำงานถูกต้องทั้งปุ่มยืนยัน/ยกเลิก
- **บั๊กที่เจอและแก้รอบนี้**: `switchExportPreviewSheet(-1)` เดิมถูกตีความเป็น index `-1` → ตารางแท็บรวมหายเวลาสลับกลับ (แก้เป็น `idx < 0 → EXPORT_PREVIEW_MERGED_KEY`)

### 13.2 หน้าต่าง "ตรวจสอบข้อมูลก่อนส่งออก" (`js/tab-export-preview.js` — ไฟล์ใหม่)

- กดปุ่ม **"📗 ส่งออก Excel"** → เปิดหน้าต่างเต็มจอ `#exportPreviewOverlay` (แทนการถามยืนยันธรรมดา) แสดงตารางของ **ทุกแท็บ** ในแถบแท็บด้านบน + ปุ่มด้านล่าง 3 ปุ่ม (ยกเลิก · ตรวจสอบข้อมูล · ยืนยันส่งออก)
- **แท็บแรก "📑 รวมข้อมูล"** — รวม 3 แท็บไว้ในตารางเดียวกัน: ระดับดินเดิม · ระดับคูส่งน้ำ · อาคารประกอบ (23 คอลัมน์) มีคอลัมน์ **"ตาม กม."** + "ช่วงคูน้ำ" + "ประเภทข้อมูล" · เรียงตาม กม. จริง (กลุ่มคลอง–คู → กม.น้อย→มาก) ด้วย `epSortMergedRows()`
- **แถบเครื่องมือ "📏 แยก กม." ด้านบนแท็บรวม**: ปุ่ม `ไม่แยก` / `ทุกๆ 5 ม.` / `10` / `20` / `25` / `50` / `100 ม.` + ช่องกรอกเอง + ปุ่ม "ใช้ค่านี้" และตัวนับ "เติมเพิ่ม N แถว"
  - **ระดับคูส่งน้ำ**: เติมจุด กม. ในช่วง (กม.เริ่มต้น..กม.สิ้นสุด) ด้วย `BL = BL1 − (ระยะ / SLOPE)` และ `TBL = BL + H(TBL)` (ไม่ใช่การ interpolate เชิงเส้นตรง เพราะต้องตรงกับสูตรจริงของแท็บ)
  - **ระดับดินเดิม**: เติมระดับที่ กม. เดียวกัน โดย interpolate จากจุดที่มีระดับจริง (`epFindGroundElevAtKm()`)
  - **ไม่เติมทับ** จุด กม. ที่มีอยู่แล้ว · แถวที่เติมแยกสีส้มอ่อน (`.ep-row-generated`)
- **ข้อมูลเดียวกับไฟล์ Excel 100%**: แยก `buildExportSheetsData()` (เตรียมข้อมูลทุกชีต) ออกจาก `buildExportWorkbook()` (เขียนไฟล์) ใน `js/io-manager.js` → หน้าต่างกับไฟล์ Excel ใช้ตัวสร้างเดียวกัน ไม่มีโค้ดซ้ำ
- **ทางเลือกสำหรับทดสอบอัตโนมัติ**: `exportAllToExcel({ skipPreview: true, skipValidate: true })` → `tests/smoke-test.js` / `tests/probe-bugs.js` ใช้ค่านี้

### 13.3 ระบบเครดิต AI + คิวงานที่ค้าง (`js/ai-credit.js` — ไฟล์ใหม่)

- **ยอดเครดิต** ผู้ใช้กรอกเอง (ตามใบเสร็จของผู้ให้บริการ AI — แอปไม่ดึงจากผู้ให้บริการโดยตรง) เก็บใน localStorage คีย์ `bclc_ai_credit_v1` · คิวเก็บใน `bclc_ai_queue_v1`
- **ปุ่ม "💳 เครดิต AI"** ในแถบข้าง (แท็บรูปตัดตามยาว) → เปิดหน้าต่าง `#aiCreditOverlay` แสดงยอดคงเหลือ · ประวัติการเติม · งานที่ค้างไว้ + ปุ่ม "อ่าน" รายงาน และ "▶ ทำงานที่ค้างทั้งหมด" · ป้ายตัวเลข (จำนวนงานค้าง) บนปุ่ม
- **AI อ่านรูป → ลงทะเบียนคิวอัตโนมัติ** (`js/canvas-viewer.js`): `aiReadCurrentFrame()` และ `aiReadAllFrames()` ลงทะเบียนงานเป็น `running` ก่อนอ่าน · อ่านสำเร็จ → ลบออกจากคิว · อ่านไม่สำเร็จ → ทำเครื่องหมาย `failed` (พร้อมข้อความ error) ค้างไว้
- **⭐ เมื่อมีเครดิตเพิ่มมา → ถามทำค้างต่อ**: `checkAiCreditForPendingWork()` ถูกเรียกอัตโนมัติจาก `addAiCreditBalance()` และ `setAiCreditBalance()` (เมื่อยอดเพิ่มขึ้น) → ถ้ามีงานค้าง → เปิดกล่องถาม *"ตรวจพบว่ามีเครดิตเพิ่มมา (ยอด N เครดิต) และมีงานอ่านรูปที่ค้างไว้อยู่ N งาน — ต้องการทำงานที่ค้างให้ดำเนินการต่อไหม?"* ปุ่มยืนยัน = `▶ ทำต่อ` → `resumeAiCreditQueue()` ทำต่ออัตโนมัติทีละงาน

### 13.4 เทสต์รอบ 42

| ไฟล์ | ผล |
|---|---|
| `tests/check-round42.js` (ใหม่) | **ALL CHECKS PASSED** (audit ปุ่ม · หน้าต่างส่งออก · แท็บรวม · แยก กม. · เรียงตาม กม. · เครดิต/คิว · export flow) |
| `tests/smoke-test.js` | ALL CHECKS PASSED |
| `tests/probe-bugs.js` | FAIL = 0 |
| `tests/check-round41.js` | ALL CHECKS PASSED |
| `tests/check-round40/39/38/36/32/26.js` | ผ่านทั้งหมด |
| `tests/check-all-encoding.js` | OK (เหลือ BOM เดิม 2 ไฟล์ใน `tests/_audit*.js` — ไม่เกี่ยวกับรอบนี้) |

> ⚠️ **หมายเหตุ encoding:** ห้ามใช้ PowerShell `Set-Content` เขียนไฟล์ที่มีภาษาไทย — มันจะเข้ารหัสซ้ำจนไทยเพี้ยน (mojibake) · ใช้ `node` + `fs.writeFileSync(..., 'utf8')` หรือเครื่องมือแก้ไฟล์แทน · ถ้าเพี้ยนแล้ว ใช้ `tests/restore-index.ps1` หรือถอดกลับด้วยการ decode จาก codepage 874

---

## 14) สรุปงานรอบ 43 (`?v=20261030a`) — เอนจินรูปตัดขวาง U-SHAPE ตามหลักการ "ส่วนที่ 1" ของเวบแนบ

> รอบนี้ยก "ส่วนที่ 1" (รูปตัดขวาง 1:1) ของเวบแนบ `canal_cross_section_V2.html` มาใส่เวบ2 โดยตรง
> และอ้างอิงค่าตัวเลขทั้งหมดจาก **PDF เอกสารแนบ** (`เอกสารแนบคำนวณพื้นที่คูส่งน้ำ_A4`)

### 14.1 สิ่งที่ทำในรอบนี้

1. **ปัดเศษแบบ "เครื่องคิดเลขกดมือ"** (`js/canvas-viewer.js`)
   - `csRoundCalc(val, digits)` — Half-Up (ไม่ใช่ Half-Even ของ `toFixed()`) พร้อม epsilon กัน 1.005 × 100 = 100.49999...
   - `csRoundElev` (2 ตำแหน่ง) · `csRoundLen` (2 ตำแหน่ง) · `csRoundArea` (3 ตำแหน่ง)
2. **เขียนใหม่ `computeCrossSectionGeometry(p)`** — เอนจินเรขาคณิตทั้งหมด:
   - รองรับ **"กรณีพิเศษ"** (คันดินกว้างเกินจุดตัดเส้นลาด 1:1) → ย้าย Node 1/2/6/7 (ฝั่งซ้าย) และ 9/13/14 (ฝั่งขวา)
   - **ชุด Node ของแต่ละพื้นที่งานดินเปลี่ยนตามกรณี** (`nodesStrippingStr` / `nodesCompactedStr` / `nodesExcavationStr` / `nodesManualLeftStr` / `nodesManualRightStr`)
   - พิกัด X เก็บเป็น **ค่าเต็มความแม่นยำ** (ไม่ปัด 0.575) แล้วปัดเฉพาะผลลัพธ์ที่แสดง → ตรง PDF
   - พื้นที่คอนกรีต/รองพื้น คิดจาก **สูตร** ไม่ใช่ shoelace
3. **แก้บั๊ก #1 — ความกว้าง 6-9 / 1-14 วัดเฉียงคนละระดับ**
   - เดิมวัด `p9.x - p6.x` โดยในกรณีพิเศษ จุด 6/9 อยู่ระดับหลังคลอง (100.50) แต่จุด 1/14 อยู่ระดับ NGL → วัดเฉียง
   - ใหม่: ใช้ `pLeftAtNgl = p1 || p6` / `pRightAtNgl = p14 || p9` → วัดที่ระดับเดียวกันเสมอ
   - ตัวอย่าง (TBL=TBR=1.20, NGL=100.90): เดิม 2.450 → ใหม่ **3.750 m** (และเพิ่มขึ้น 0.20 m เมื่อ NGL +0.10 m)
4. **แก้บั๊ก #2 — ป้ายสถานะไม่ตรงกับปริมาณงานจริง**
   - ใช้เกณฑ์เดียวกับการคำนวณจริง: `ระดับลอกหน้าดิน (NGL − dt)` เทียบ `ระดับท้องรองพื้น`
   - NGL = 100.150 → Partial · 100.160 → Cut · 100.140 → Fill
5. **แก้บั๊ก #5 — ผลรวมพื้นที่ถมแรงคนไม่เท่าผลบวกของย่อย**
   - เพิ่ม `csCalcPolygonAreaRaw()` (คืนค่าดิบ) แยกจาก `csCalcPolygonArea()` (ปัด 3 ตำแหน่ง)
   - ผลรวมคิดจาก **ค่าดิบของซ้าย+ขวา แล้วปัดทีเดียว** → ตรง PDF (0.40625 × 2 = 0.8125 → **0.813**)
6. **แก้บั๊ก #7 — เส้นขอบดินเป็นหัวแหลมเมื่อ NGL = ระดับหลังคลองพอดี**
   - เมื่อ NGL == 100.50 ในกรณีพิเศษ → จุด 1 ซ้ำกับจุด 2 และจุด 14 ซ้ำกับจุด 13 → เส้นขอบดินตัดกันเอง
   - เพิ่ม `csDedupePolygonPoints()` → ตัดจุดซ้ำติดกันออกจากทุก polygon (earth + พื้นที่งานดินทั้ง 5)
7. **แก้บั๊ก #3 — ไม่บังคังค่าสูงสุดพารามิเตอร์** (`js/tab-dimension.js`)
   - เพิ่ม `DIM_PARAM_LIMITS` (B/H/TBL/TBR: 0.10–10.00) + `checkDimensionParamRange()`
   - `updateDimensionField()` ปฏิเสธค่าเกินขอบเขต + `alert()` แจ้งผู้ใช้
   - เพิ่ม `min`/`max` ในช่องกรอกของแท็บมิติคูส่งน้ำ
   - `computeCrossSectionGeometry()` clamp ซ้ำอีกชั้น (กันค่าจากไฟล์นำเข้า/โปรเจกต์เก่า)
8. **ดึงค่าจากตารางอัตโนมัติ** (`computeCrossSectionParams()`)
   - อ่านจาก `dimensionRows` (B/H/TBL/TBR) · `levelRowsData` (ระดับ BL/TBL, SLOPE) · `groundRowsData` (ระดับดินเดิม)
   - ถ้า กม. ที่เลือกไม่มีค่าระดับดิน → **Interpolate อัตโนมัติ**
   - ระดับ BL คำนวณตามสูตรจริงของแท็บ: `BL = BL1 − (ระยะ / SLOPE)`
9. **ดรอปลิสต์เลือกชื่อคลอง/คู + กม.** (`index.html`, `js/canvas-viewer.js`)
   - `#crossSectionChannelSelect` · `#crossSectionKmSelect` · ปุ่ม ▲/▼ (`stepCrossSectionKm()`) + คีย์บอร์ด ArrowUp/ArrowDown
   - รวม กม. จากทั้งแท็บระดับดินเดิมและแท็บระดับคูส่งน้ำอัตโนมัติ (`getCombinedKmsForChannel()`)
10. **แก้ cache-busting ให้เป็นเวอร์ชันเดียว** — เดิม `index.html` ปนกัน 3 เวอร์ชัน (20261027a / 20261027b / 20261030a) → รวมเป็น `20261030a` ทั้งหมด
11. **แก้เทสต์รอบ 29** (`tests/round29-check.js`) — เดิมคาด colSpan 12/9 (ล้าสมัยก่อนรอบ 41 เพิ่มคอลัมน์ "ช่วงคูน้ำ") → เปลี่ยนเป็นตรวจแบบ dynamic เทียบกับจำนวน `<th>` จริง

### 14.2 ผลการเทียบกับ PDF อ้างอิง (3 กรณีมาตรฐาน) — ตรงทุกตัวเลข

| ตัวแปร | กรณี 1 ขุดลึก (NGL 100.65) | กรณี 2 ถมสูง (NGL 99.66) | กรณี 3 กึ่งกลาง (NGL 100.20) |
|---|---|---|---|
| พื้นที่ขุดลอกหน้าดิน (6-7-8-9) | 0.735 ✅ | 0.369 ✅ | 0.465 ✅ |
| พื้นที่ถมบดอัด 85% | 0.000 ✅ | 0.624 ✅ | 0.000 ✅ |
| พื้นที่ดินขุด (5-7-8-10) | 0.825 ✅ | 0.000 ✅ | 0.060 ✅ |
| ถมแรงคนซ้าย | 0.406 ✅ | 0.698 ✅ | 0.361 ✅ |
| ถมแรงคนขวา | 0.406 ✅ | 0.698 ✅ | 0.361 ✅ |
| **รวมถมแรงคน** | **0.813 ✅** | **1.396 ✅** | **0.723 ✅** |
| ความกว้างขุดลอก (6-9) | 2.750 ✅ | 1.530 ✅ | 1.850 ✅ |
| ความกว้างคันดิน (1-14) | — (ขุดลึก) | 3.230 ✅ | 2.150 ✅ |
| ความกว้างช่วง 2-13 | 2.450 ✅ | 1.550 ✅ | 1.550 ✅ |
| พื้นที่คอนกรีต / รองพื้น | 0.155 / 0.028 ✅ | 0.155 / 0.028 ✅ | 0.155 / 0.028 ✅ |
| ป้ายสถานะ | งานขุดดินลึก (Cut) ✅ | งานถมดินสูง (Fill) ✅ | งานกึ่งขุดกึ่งถม (Partial) ✅ |

> หมายเหตุ: PDF ระบุค่า 2-13 = 2.450 เฉพาะกรณี 1 (กรณีขุดลึก) — กรณี 2/3 ไม่ได้ระบุไว้ แต่คำนวณได้ 1.550 ตามหลัก `2 × Xbl = 2 × 0.775`

### 14.3 เทสต์รอบนี้

| ไฟล์ | ผล |
|---|---|
| `tests/check-round43.js` (ใหม่ — 41 ข้อ) | **FAIL = 0 ข้อ** ✅ ผ่านครบทุกข้อ |
| `tests/check-migrate.js` (เขียนใหม่รอบ 43) | **PASS = 12 · FAIL = 0** ✅ |
| `tests/round29-check.js` (แก้ให้ตรงปัจจุบัน) | **PASS = 18 · FAIL = 0** ✅ |
| `tests/round30-check.js` | **PASS = 120 · FAIL = 0** ✅ (หลังแก้เลขเวอร์ชัน) |
| `tests/smoke-test.js` | ALL CHECKS PASSED ✅ |
| `tests/probe-bugs.js` | FAIL = 0 ✅ |
| `tests/check-round41/42.js` | ALL CHECKS PASSED ✅ |
| `tests/check-round36/38/39/40.js` | ผ่านทั้งหมด ✅ |
| `tests/check-round32.js` | 44/44 ✅ |
| `tests/check-all-encoding.js` | UTF-8 สะอาด (เหลือ BOM เดิม 2 ไฟล์ใน `tests/_audit*.js` ไม่เกี่ยวรอบนี้) |
| `node --check` ทุกไฟล์ใน `js/` | ไม่มี syntax error ✅ |

### 14.4 บั๊กจากเวบแนบที่ **ไม่เกี่ยวกับเวบ2** (ตรวจแล้ว)

- **บั๊ก #4 (Slider NGL หลุด sync)** — เวบ2 ไม่มี slider NGL ใช้ดรอปลิสต์เลือก กม. + ดึงระดับจากตาราง → ไม่มีปัญหานี้
- **บั๊ก #6 (ค่า BL ที่ยังไม่ commit หลุดเข้าระบบ)** — เวบ2 ใช้ `onchange` (commit ทุกครั้ง) + อ่านค่าสดจากตารางก่อนคำนวณ (`readLiveTableInputsForCrossSection()`) → ไม่มีช่อง BL อิสระให้หลุดได้

### 14.5 ⚠️ หมายเหตุสำคัญ

> **ห้ามใช้ PowerShell `Set-Content` เขียนไฟล์ที่มีภาษาไทย** — มันจะเข้ารหัสซ้ำจนไทยเพี้ยน (mojibake)
> ใช้ `node` + `fs.writeFileSync(..., 'utf8')` หรือเครื่องมือแก้ไฟล์แทน

> **ยังรอผู้ใช้ทดสอบบนเบราว์เซอร์** — โดยเฉพาะ:
> 1. การวาดรูปตัดขวางและป้ายสถานะ (Cut/Fill/Partial) บนรูปจริง
> 2. การสลับ กม. ด้วยปุ่ม ▲/▼ และดรอปลิสต์ — รูปต้องเปลี่ยนตาม กม.
> 3. กรณีพิเศษ (TBL/TBR กว้างเกิน ~0.95 m) — เส้นขอบดินเดิมต้องไม่มีรอยต่อ/หัวแหลม
> 4. การแจ้งเตือนเมื่อกรอก B/H/TBL/TBR เกินขอบเขต


---

## 15) สรุปงานรอบ 45 (2026-11-03 — ตรวจวิเคราะห์เชิงลึกและแก้ไขบั๊กทั้ง 14 จุด)

### 15.1 รายการบั๊กที่แก้ไขแล้วครบทั้ง 14 จุด
1. **`js/autosave.js` (บั๊ก #1 — วิกฤต)**: เพิ่มตัวแปร `autosaveRestorePending` ระงับการเชฟอัตโนมัติระหว่างเปิดกล่องถามกู้คืน (`offerAutosaveRestore`) และคำนวณ `autosaveLastHash` ของหน้าว่างเริ่มต้นตั้งแต่ `startAutosaveSystem()` / หลังกด `"ไม่กู้คืน"` เพื่อไม่ให้นำโปรเจกต์ว่างไปเขียนทับข้อมูลสำรองเดิมใน IndexedDB
2. **`js/canvas-viewer.js`, `js/io-manager.js`, `js/ai-reader.js` (บั๊ก #2 — วิกฤต)**: บันทึกและกู้คืน `mediaDrawingStateByTab` ในไฟล์ JSON/Autosave, ให้ `buildOverlayPayload()` และ `canvasLabels` ดึงข้อมูลจาก `mediaDrawingStateByTab.image` ได้แม้กดบันทึกขณะเปิดแท็บ `PDF`, ซิงก์สถานะหลังสร้างป้าย AI/ลากป้าย, และให้แท็บ `draw` (รูปตัดขวาง) ซิงก์สถานะเส้นวาดร่วมกับแท็บ `image`
3. **`js/tab-level.js` (บั๊ก #3 — วิกฤต)**: แก้ `calculateLevelSingleRow(rIdx)` ให้แถวย่อยคำนวณ `bl1 = prevRow.bl2 - H` อัตโนมัติเมื่อกดปุ่ม `🧮` ที่แถวย่อยโดยตรง และเพิ่ม fallback `customKmStart` ไปใช้ค่าของแถวก่อนหน้าหรือ `kmStart` ของแท็บมิติ
4. **`js/tab-validate.js` (บั๊ก #4 — วิกฤต)**: แก้ `confirmValidateBeforeSave()` ให้ปุ่ม `'ไม่ตรวจ · ทำต่อ'` คืนค่า `resolve(true)` เพื่อดำเนินการบันทึก/ส่งออกต่อได้จริงตามข้อความบนปุ่ม
5. **`js/tab-validate.js` (บั๊ก #5 — สูง)**: ตัดการบังคับตรวจ `r.km` ใน `vCheckAttachmentTab()` ออก เนื่องจากตารางอาคารท่อรับน้ำเข้าแปลงไร่นาไม่มีคอลัมน์ `กม.` ให้กรอก
6. **`js/table-sync.js` (บั๊ก #6 — สูง)**: แก้ Regex ตกเครื่องหมาย `\` ทั้ง 4 จุด (`\s*` และ `\d+`) ใน `normalizeDitchKeyForMatch`, `isSameDitchKey`, และ `resolveMainDitchTypeForSubDitchTurnout`
7. **`js/tab-ditch.js` (บั๊ก #7 — สูง)**: แก้ `sortChannelsByDitchOrder()` ให้จัดลำดับกลุ่มคลองส่งน้ำด้วย `canalOrder` (Strict Weak Ordering) ก่อนเปรียบเทียบรหัสคูน้ำ ทำให้เรียงลำดับคูน้ำภายในคลองเดียวกันได้ถูกต้องแม้มีหลายคลอง
8. **`js/tab-level.js` (บั๊ก #8 — สูง)**: แก้ `drawCanalLevelLines(cIdx)` ให้กรองเก็บเส้นระดับของคูส่งน้ำสายอื่นไว้ (`filter(l => l && l.channelId !== cIdx)`) ไม่ล้างทิ้งทั้งหมด
9. **`js/ai-credit.js`, `js/canvas-viewer.js` (บั๊ก #9 — สูง)**: ให้ `aiReadCurrentFrame()` คืนค่า `true/false` ตามผลการอ่านจริง โหลดกรอบรูปเข้า Viewer ก่อนอ่านใน `runAiCreditQueueItem()` ลบออกจากคิวเฉพาะเมื่ออ่านสำเร็จ และตัดการเรียก `checkAiCreditForPendingWork()` ซ้ำเมื่อตั้งยอดเครดิตลดลงใน `setAiCreditBalanceFromPrompt()`
10. **`js/tab-export-preview.js`, `js/io-manager.js` (บั๊ก #10 — กลาง)**: แยกเช็ค กม. ซ้ำของระดับคูส่งน้ำและระดับดินเดิมใน `epBuildKmStepRows()` ไม่ให้จุดระดับดินเดิมมาบังการเติมระดับคูส่งน้ำ และเพิ่ม `epBuildMergedExportSheet()` เพื่อส่งออกชีต `"รวมข้อมูล"` ลงไฟล์ Excel เมื่อตั้งระยะแยก กม. (`kmStep > 0`)
11. **`js/table-core.js`, `js/tab-validate.js` (บั๊ก #11 — กลาง)**: เพิ่ม `input.combobox-input` ใน `syncTableInputsToChannels()` (แท็บมิติ) และ `applyValidationHighlights()`
12. **`js/io-manager.js` (บั๊ก #12 — กลาง)**: รักษาสถานะ `_userAdded` ของ `ditchTypeDatabase` และสร้าง `structureTypeDBMeta` ใหม่ใน `loadProjectDataObject()` เพื่อให้ปุ่มลบ (`-`) ของ Type ที่ผู้ใช้เพิ่มเองไม่หายหลังโหลด JSON หรือกู้คืน Autosave
13. **`js/io-manager.js` (บั๊ก #13 — กลาง)**: แก้การเช็ค `isFirstOfChan` / `isLastOfChan` (`isBoundary`) ใน `importAllFromExcel()` ให้เทียบด้วย `cIdx` ที่ผ่าน `resolveChannelId()` แทนการเทียบค่าดิบจาก SheetJS ที่อาจเป็นตัวเลข (`Number`) กับ `String`
14. **`js/tab-ditch.js`, `js/tab-dimension.js`, `js/tab-ai-result.js` (บั๊ก #14 — กลาง)**: แก้ `getDitchSectionIndex()` ให้จับคู่ด้วย `channel.id` ก่อนชื่อคู, แก้ `renderDimensionTab()` ไม่ให้เขียนทับ `r.kmStart` ของแถวแรกที่มีค่าอยู่แล้วเป็น `0`, และรับ `ev` เพื่อเรียก `ev.stopPropagation()` ใน `deleteAiResultDataset()`

### 15.2 ผลการทดสอบรอบ 45
- เพิ่มไฟล์ทดสอบใหม่ `tests/check-round45.js` (25 ข้อ ครอบคลุมบั๊กทั้ง 14 จุด) → **FAIL = 0**
- รันชุดทดสอบเดิมทั้งหมด (`smoke-test.js`, `probe-bugs.js`, `round29-check.js`, `round30-check.js`, `check-round32/36/38/39/40/41/42/43.js`, `check-migrate.js`) → **ผ่านครบ 100% (`FAIL = 0`)**
- อัปเดตเลขเวอร์ชัน cache-busting ใน `index.html` เป็น `?v=20261103a` ตรงกันทุกสคริปต์

---

## 16) สรุปงานรอบ 46 (2026-11-03 — ปรับโครงสร้าง UI และฟีเจอร์ 11 รายการตามรูปที่เจ้าของงานกำหนด)

### 16.1 รายการที่ดำเนินการแก้ไขครบทั้ง 11 ข้อ
1. **ย้าย 3 แท็บมาอยู่แท็บขวา เรียงแนวดิ่ง และตัดคำว่า "แสดง" ออก (`index.html`, `style.css`)**: ย้าย `#mediaSubTabsGroup` เข้าไว้ด้านบนของ `#sideControlPanel` ใน `#pdfThumbnailsSidebar` เรียงแนวตั้ง และเปลี่ยนชื่อเป็น `📄 ส่วนไฟล์ PDF`, `🖼️ ส่วนรูปตัดตามยาว`, `📐 ส่วนรูปตัดขวาง`
2. **ย้ายหัวชื่อโครงการและที่อยู่มาอยู่แทนแท็บที่ย้ายไป (`index.html`, `style.css`)**: นำ `#topProjectInfoBar` (`#headerProjectName` และ `#headerProjectLocation`) มาแสดงฝั่งซ้ายของ `.top-toolbar-bar`
3. **ย้ายกล่องระบบเชฟอัตโนมัติมาอยู่ขวาบนของ `.top-toolbar-bar` (`index.html`, `js/autosave.js`, `style.css`)**: แสดงบรรทัดเดียว `⏱️ ระบบเชฟอัตโนมัติ : <วันเวลาเชฟล่าสุด>` ชี้เมาส์ขึ้น `title="เชฟทุกๆ 10 นาที"` และเปลี่ยน `AUTOSAVE_INTERVAL_MS = 10 * 60 * 1000` โดยใช้เวลาในเครื่อง (`Date.now() - autosaveLastCheckMs`) ตรวจสอบแทนโดยไม่แสดงเวลานับถอยหลัง
4. **ลบแถบหัวด้านบนสุด (`#pageTopHeaderBar`) ทิ้ง (`index.html`)**: ตัดแถบหัวด้านบนสุดและ breadcrumb เดิมออกตามกากบาท #4 ในรูป
5. **ย่อ/ขยายแท็บตารางด้านล่างให้เหลือแท็บเล็กๆ ได้ (`index.html`, `js/table-core.js`, `style.css`)**: เพิ่มปุ่ม `#btnToggleBottomTable` (`toggleBottomTableCollapse()`) บนแถบคั่น `#resizerBar` เพื่อพับซ่อน `#bottomTablePanel` เหลือเฉพาะแถบหัวแท็บเล็กๆ และคลิกแท็บหรือกดปุ่มเพื่อขยายกลับได้
6. **เพิ่มแท็บ `📋 แผนงานโครงการ` ไว้หน้าสุดของตารางด้านล่าง (`index.html`, `js/tab-project.js`, `js/table-core.js`, `js/io-manager.js`)**: เพิ่มปุ่ม `#tab-btn-project` ไว้หน้าสุดก่อน `🌊 ระบบคูส่งน้ำ` พร้อมฟังก์ชัน `renderProjectTab()` และซิงก์ข้อมูลชื่อ/ที่อยู่/รายละเอียดโครงการแบบเรียลไทม์
7. **ตัดความเชื่อมโยงระหว่างเมนู `⚙️ Setting` ซ้ายมือ กับแท็บ `⚙️ setting` ในตารางล่าง (`js/canvas-viewer.js`)**: แยก `switchMainMenu('setting')` ให้เปิดหน้าตั้งค่าระบบหลักของตัวเอง ไม่ไปสลับเปิดแท็บ `setting-type` / `setting-structure` ของตารางถอดแบบ
8. **เพิ่มเมนูย่อย `🏛️ ส่วนอาคารประกอบ` ในเมนูซ้ายใต้ `📊 ประมาณการ` (`index.html`, `js/table-core.js`)**: เพิ่มรายการ `switchSubMenu('structure-calc', this)` ต่อจาก `📐 ส่วนคำนวณปริมาณ`
9. **เพิ่มปุ่ม `📄 ตัวอย่างไฟล์นำเข้า` ต่อจากปุ่ม `📥 นำเข้า Excel` และลบปุ่ม `💳 เครดิต AI` จากแท็บขวามือ (`index.html`, `js/io-manager.js`)**: เพิ่มปุ่ม `#btn-sample-excel` เรียก `downloadSampleImportExcel()` สร้างไฟล์ตัวอย่าง Excel ครบ 8 ชีต และนำปุ่ม `#btn-side-ai-credit` ออกจากแท็บขวา
10. **เพิ่มปุ่มย่อ/ขยายแท็บขวามือให้เหลือแท็บเล็กๆ ได้ (`index.html`, `js/canvas-viewer.js`, `style.css`)**: เพิ่มปุ่ม `#rightSidebarToggleBtn` เรียก `toggleRightSidebar()` ย่อ `#pdfThumbnailsSidebar` เหลือแถบแคบ 42px และขยายกลับได้
11. **จัดเรียงหน้าเมนู `📊 ประมาณการ` ใหม่ (`js/table-core.js`, `style.css`)**: เรียงลำดับเป็น (1) แสดงชื่อโครงการ ที่อยู่ และรายละเอียด (2) ปุ่มเมนูย่อยทั้ง 5 เรียงแนวนอน (`#estimateHorizSubmenus`) และ (3) แยกเป็น 5 ส่วนตามเมนูย่อยเพื่อตรวจสอบขั้นตอน พร้อมปุ่ม `➖ ย่อ` / `➕ ขยาย` (`toggleEstimateSectionCollapse()`) ในแต่ละส่วน

---

## 17) สรุปงานรอบ 47 (2026-11-03 — ปรับ 3 รายการเพิ่มเติมตามรูปที่เจ้าของงานระบุ)

1. **ย้าย 3 ปุ่มแท็บมาอยู่ด้านข้างตามรูป (`index.html`, `style.css`)**: แยก `#mediaSubTabsGroup` (`📄 ส่วนไฟล์ PDF`, `🖼️ ส่วนรูปตัดตามยาว`, `📐 ส่วนรูปตัดขวาง`) ออกมาอยู่ในแถบด้านข้าง `#mediaSideRail` ขนาบซ้ายของแผงปุ่มแท็บขวา เรียงแนวตั้ง (`writing-mode: vertical-rl`) พร้อมปุ่มย่อ/ขยาย `#rightSidebarToggleBtn` ด้านล่างสุดของแถบเดียวกัน (เมื่อย่อแผงขวา แถบแท็บ 3 ปุ่มด้านข้างยังคงแสดงอยู่ให้สลับแท็บได้ทันที)
2. **เพิ่มคอลัมน์ `ช่วงคูน้ำ` ในแท็บ `🌾 อาคารท่อรับน้ำเข้าแปลงไร่นา` (`js/tab-attachment.js`, `js/io-manager.js`)**: เพิ่ม `<th style="min-width: 90px;">ช่วงคูน้ำ</th>` เป็นคอลัมน์ที่ 9 (คอลัมน์สุดท้าย) แสดงลำดับช่วงคูน้ำจาก `getDitchSectionHtml(cIdx)` พร้อมรองรับการ Copy และการส่งออก Excel
3. **เพิ่มปุ่มย่อ/ขยายส่วนแสดงรูปภาพให้เหลือแถบเล็กๆ (`index.html`, `js/table-core.js`, `style.css`)**: เพิ่มปุ่ม `#btnToggleViewportCollapse` (`▲ ย่อส่วนแสดงรูปภาพ` / `▼ ขยายส่วนแสดงรูปภาพ`) บน `#resizerBar` คู่กับปุ่ม `▼ ย่อตาราง` เรียก `toggleViewportCollapse()` เพื่อพับซ่อนส่วนแสดงรูปภาพด้านบนและขยายตารางด้านล่างเต็มพื้นที่ได้ทันที

## รอบ 52 (แก้ไขป้ายอาคาร กม. 0 + เลื่อนป้ายอาคารเหนือเส้นตาราง 1 ช่องค่าระดับ + ย้ายแท็บย่อย Typeคูส่งน้ำ/Typeอาคารประกอบ ไปเมนูย่อยส่วนอาคารประกอบ + ปรับตัวอย่างไฟล์นำเข้าเหลือแท็บ 1–7)
1. **ป้ายอาคาร ข้อมูล กม. 0 แถวแรกไม่แสดง แถวอื่นแสดง (`js/canvas-viewer.js`)**:
   - นำเงื่อนไขข้ามแถว `s.isBoundary` (`อาคารท่อส่งน้ำเข้านา (เดิม)` / `ปลายคูส่งน้ำ`) ใน `redraw()` ออก เพื่อให้ป้ายอาคารที่ กม. 0+000 แสดงข้อมูลแถวแรก (เช่น `อาคารท่อส่งน้ำเข้านา (เดิม)`) ร่วมกับแถวอื่น ๆ ที่ กม. 0+000 ครบทุกแถวในป้ายเดียวกัน
2. **ขยับตำแหน่งป้ายอาคารให้เลื่อนขึ้นไปเหนือเส้นตารางสุดท้ายไปอีก 1 ช่องค่าระดับ (`js/canvas-viewer.js`)**:
   - คำนวณความสูง 1 ช่องค่าระดับ (`oneElevGridPx = Math.abs(cal.p2Ref.y - cal.p1Ref.y) / Math.max(1, Math.abs(cal.y2Val - cal.y1Val))`) และเลื่อนตำแหน่ง `sy` ขึ้นไปเหนือเส้นตารางบนสุด (`topGridY = Math.min(cal.p1Ref.y, cal.p2Ref.y)`) อีก 1 ช่องค่าระดับ (`sy = Math.max(10, topGridY - oneElevGridPx - 10)`)
3. **ลบแท็บ `setting` และแท็บย่อย `Typeคูส่งน้ำ` / `Typeอาคารประกอบ` จากแถบตารางล่าง ไปไว้เมนูย่อย `ส่วนอาคารประกอบ` พร้อมเมนูแท็บซ้ายมือย่อ-ขยายได้ (`index.html`, `style.css`, `js/canvas-viewer.js`, `js/tab-type.js`, `js/table-core.js`)**:
   - ซ่อนแท็บ `⚙️ setting` และแถบย่อย `Typeคูส่งน้ำ` / `Typeอาคารประกอบ` ออกจากแถบตารางด้านล่างในหน้าส่วนถอดแบบ
   - สร้างหน้า `#structureCalcPage` สำหรับเมนูย่อย `🏛️ ส่วนอาคารประกอบ` โดยมีเมนูแท็บซ้ายมือ (`#structureCalcSidebar`) แสดงแท็บ `🧱 Typeคูส่งน้ำ` และ `🏗️ Typeอาคารประกอบ` พร้อมปุ่มย่อ/ขยายเข้าออกด้านข้าง (`#btnToggleStructureCalcSidebar`, `toggleStructureCalcSidebar()`)
4. **ตัวอย่างไฟล์นำเข้า สร้างเฉพาะแท็บ 1–7 และเฉพาะคอลัมน์ที่อยู่ในตารางเท่านั้น (`js/io-manager.js`)**:
   - ปรับ `downloadSampleImportExcel()` ให้สร้างเฉพาะชีต 1–7 (`แผนงานโครงการ`, `ระบบคูส่งน้ำ`, `มิติคูส่งน้ำ`, `ระดับดินเดิม`, `ระดับคูส่งน้ำ`, `อาคารประกอบ`, `อาคารท่อรับน้ำเข้าแปลงไร่นา`) โดยตัดชีตที่ 8 (`setting`) และตัดคอลัมน์ภายใน (`ลำดับคู`, `จากระดับ`) ออก เหลือเฉพาะคอลัมน์ที่แสดงอยู่ในตารางเท่านั้น
5. **ชุดทดสอบ**: `tests/check-round52.js` (PASS = 18, FAIL = 0) และชุดทดสอบเดิมทั้งหมดผ่าน 100% (`FAIL = 0`)

## รอบ 53 (เปลี่ยนชื่อหัวเมนูเป็น "รายการอาคารประกอบ" และปรับพื้นหลังแถบเมนูซ้ายในหน้าส่วนอาคารประกอบเป็นสีขาว)
1. **เปลี่ยนชื่อหัวเมนูซ้ายในหน้าส่วนอาคารประกอบ (`index.html`)**:
   - เปลี่ยนข้อความใน `.structure-calc-sidebar-title` (บรรทัดที่ 124) จาก `รายการตั้งค่า Type` เป็น `รายการอาคารประกอบ` และอัปเดตเลข cache-busting เป็น `?v=20261103d`
2. **ปรับพื้นหลังแถบเมนูซ้ายในหน้าส่วนอาคารประกอบเป็นสีขาว (`style.css`)**:
   - `.structure-calc-sidebar`: เปลี่ยนพื้นหลังจาก `#1e293b` เป็นสีขาว `#ffffff`, เส้นขอบขวาเป็น `#dee2e6`
   - `.structure-calc-sidebar-header` / `.structure-calc-sidebar-title`: เปลี่ยนเส้นคั่นล่างเป็น `#dee2e6` และสีตัวอักษรหัวข้อเป็น `#334155`
   - `.structure-calc-collapse-btn`: ปรับปุ่มย่อ/ขยาย `◀` เป็นพื้นเทาอ่อน `#f1f3f5` ขอบ `#ced4da` ตัวอักษร `#495057`
   - `.struct-calc-tab-btn`: ปรับสีตัวอักษรปุ่มที่ไม่ได้เลือกเป็น `#495057` และสีตอนชี้เมาส์ (`:hover`) เป็น `#e9ecef` (ปุ่ม `.active` คงสีน้ำเงิน `#0d6efd` ตัวอักษรขาวตามเดิม)

## รอบ 54 (ปรับปรุงปุ่มตรวจสอบข้อมูล: แสดงหน้าต่างใต้แถวปุ่ม + ปุ่มกากบาทลบรายข้อพร้อมยกเลิกไฮไลต์ + ลิงก์กดไปยังตำแหน่งที่แจ้ง Error)
1. **หน้าต่างแสดงข้อมูลปรับให้แสดงใต้แถวปุ่ม (`index.html`, `style.css`, `js/tab-validate.js`)**:
   - ย้าย `#validationTabHost` ลงมาวางใต้แถวปุ่ม `.table-bottom-bar-split` ภายใน `#bottomTablePanel` และกำหนด `.bottom-table-panel.has-validation-open` เพื่อขยายพื้นที่แสดงผลด้านล่างแถวปุ่มอย่างชัดเจน
2. **ทุกข้อมีปุ่มกากบาท (`✖`) เพื่อกดลบข้อนั้น และยกเลิกไฮไลต์ที่ช่องนั้นทันที (`js/tab-validate.js`, `style.css`)**:
   - เพิ่มปุ่ม `✖` (`dismissValidationIssue(issueId, event)`) ในทุกแถวของตารางผลการตรวจสอบ เมื่อกดลบจะนำรายการนั้นออกจาก `validationIssues` พร้อมเรียก `clearValidationHighlights()` และ `applyValidationHighlights()` เพื่อยกเลิกไฮไลต์สีแดงอ่อน (`.validation-error-cell`) ที่ช่องนั้นทันที
3. **ทุกข้อมีลิงก์กดไปยังตำแหน่งที่แจ้ง Error (`js/tab-validate.js`, `style.css`)**:
   - เพิ่มลิงก์ `goToValidationIssue(issueId, event)` ทั้งที่คอลัมน์ กม./ตำแหน่ง, ข้อความปัญหา และปุ่ม `📍 ไปที่ตำแหน่ง` เมื่อคลิกจะสลับไปยังแท็บเป้าหมาย ขยายกลุ่มคูส่งน้ำ (`collapsed = false`) เลื่อนหน้าจอและโฟกัสไปยังช่องที่เกิด Error พร้อมแสดงกรอบเน้นตำแหน่ง (`.validation-focus-pulse`)
4. **ชุดทดสอบ**: `tests/check-round54.js` (PASS = 10, FAIL = 0) และชุดทดสอบเดิมทั้งหมดผ่าน 100% (`FAIL = 0`)

## รอบ 55 (หน้าต่างตรวจสอบข้อมูลก่อนส่งออก: ลบแท็บ setting + ย้ายแท็บรวมข้อมูลไปท้ายสุด + เพิ่มปุ่มคำนวณ + รวมในไฟล์ส่งออก + แสดงผลตรวจสอบใต้ตารางในหน้าต่างนี้ + รวม กม. ระดับคู/ระดับดินเดิม/อาคารประกอบในแถวเดียวกัน)
1. **ลบแท็บ `setting` ออกจากหน้าต่างตรวจสอบข้อมูลก่อนส่งออก (`js/tab-export-preview.js`, `js/io-manager.js`)**:
   - กรองชีต `setting` ออกใน `epFilterSheetsNoSetting()` และตอนส่งออกผ่านหน้าต่าง เพื่อให้แสดงเฉพาะแท็บข้อมูลโครงการ 1–7 และแท็บ `รวมข้อมูล`
2. **ย้ายแท็บ `📑 รวมข้อมูล` ไปไว้ท้ายสุด (`js/tab-export-preview.js`)**:
   - ปรับ `epRenderTabs()` ให้เรียงแท็บชีต 1–7 ก่อน แล้ววางปุ่มแท็บ `📑 รวมข้อมูล` ไว้ท้ายสุด
3. **เพิ่มปุ่ม `🧮 คำนวณ` ต่อท้ายปุ่ม `ใช้ค่านี้` (`js/tab-export-preview.js`, `style.css`)**:
   - เพิ่มปุ่ม `#epBtnCalculateLevels` (`calculateExportPreviewMergedLevels()`) ต่อท้ายปุ่ม `ใช้ค่านี้` ในแถบ `แยก กม.` เพื่อคำนวณค่าระดับ BL / TBL / ระดับดินเดิม ณ ทุก กม. ในแท็บรวมข้อมูล
4. **รวมชีต `รวมข้อมูล` ในไฟล์ส่งออก Excel ด้วยเสมอ (`js/io-manager.js`, `js/tab-export-preview.js`)**:
   - ปรับ `exportAllToExcel()` และ `epBuildMergedExportSheet()` ให้สร้างชีต `รวมข้อมูล` (ครบทั้ง 23 คอลัมน์ตาม `epMergedHeaders()`) ต่อท้ายในไฟล์ Excel ที่ส่งออกเสมอ
5. **ปุ่ม `🔍 ตรวจสอบข้อมูล` ตรวจสอบและแสดงผลภายในหน้าต่างนี้ด้านล่างตาราง (`js/tab-export-preview.js`, `style.css`)**:
   - เพิ่ม `#epValidationHost` ใต้ `.ep-table-wrap` ภายในหน้าต่าง `ตรวจสอบข้อมูลก่อนส่งออก` พร้อมลิงก์กดไปยังตำแหน่งที่ผิด (`goToExportPreviewValidationIssue`) และปุ่มกากบาทลบรายข้อ (`dismissExportPreviewValidationIssue`)
6. **กม. ที่มีระดับคูและระดับดินเดิมให้ร่วม กม. กัน และย้ายอาคารประกอบไป กม. ที่มีระดับคูด้วย (`js/tab-export-preview.js`)**:
   - เพิ่ม `epCombineRowsByKm()` และ `epEvalCanalLevelAtKm()` เพื่อรวมข้อมูล `ระดับดินเดิม` + `ระดับคูส่งน้ำ` + `อาคารประกอบ` ที่อยู่ กม. เดียวกันให้อยู่ในแถวเดียวกัน พร้อมคำนวณค่าระดับคูส่งน้ำและระดับดินเดิมที่ตำแหน่งอาคารประกอบทุกจุด
7. **ชุดทดสอบ**: `tests/check-round55.js` (PASS = 12, FAIL = 0) และชุดทดสอบเดิมทั้งหมดผ่าน 100% (`FAIL = 0`)

## รอบ 56 (แก้ไขหน้าต่างตรวจสอบข้อมูลก่อนส่งออก -> แท็บรวมข้อมูล ทั้ง 3 ข้อ)
1. **ตรวจสอบ "ช่วงคูน้ำ" ให้ตรงกับตารางทุกแถว (`js/tab-export-preview.js`)**:
   - ปรับการอ่านคอลัมน์ `ช่วงคูน้ำ` ใน `epBuildMergedRows()` ให้ค้นหาจากชื่อหัวตารางของแต่ละชีตอย่างยืดหยุ่น (`epFindHeaderIndex`)
   - ปรับลำดับการเลือกค่า `ช่วงคูน้ำ` (`secVal`) ใน `epCombineRowsByKm()` ให้ยึดค่าจากแถวอาคารประกอบ (`sRow.section`) และระดับดินเดิม (`explicitGRow.section`) ก่อนค่าของช่วงระดับคูส่งน้ำที่เริ่มใหม่ ณ จุดรอยต่อ เพื่อให้แถวอาคารปากคูซอย/บานอัดน้ำ (ช่วงเหนือน้ำ $k$) และอาคารลดระดับ (ช่วงท้ายน้ำ $k+1$) ที่อยู่ กม. เดียวกันแสดงเลข `ช่วงคูน้ำ` ตรงกับในตาราง 100%
2. **คำนวณค่าระดับให้ครบทุกแถวและทุกคอลัมน์ (`js/tab-export-preview.js`)**:
   - เพิ่ม `epPrepareCanalLevelSegments()` และ `epSyncAndCalcLevelRowsData()` เพื่อคำนวณและส่งต่อค่าระดับ `BL1 = BL2_ก่อนหน้า - H`, `TBL1`, `BL2` และ `TBL2` ข้ามช่วงคูน้ำอัตโนมัติตั้งแต่เปิดหน้าต่างและเมื่อกดปุ่ม `🧮 คำนวณ`
   - ปรับ `epEvalCanalLevelAtKm()` และ `epBuildKmStepRows()` ให้ใส่ค่า `ระดับ BL. สิ้นสุด` (`bl2`) และ `ระดับ TBL สิ้นสุด` (`tbl2`) ครบทุกแถว (รวมถึงแถว กม. ระหว่างช่วงและแถวที่เติมตามระยะ `แยก กม. ทุกๆ .. ม.`)
3. **กม. ที่มีอาคารซ้ำกัน ไม่ต้องใส่ค่าระดับซ้ำ (`js/tab-export-preview.js`)**:
   - ใน `epCombineRowsByKm()` และ `epMergedRowCells()` เมื่อที่ `กม.` เดียวกันมีอาคารประกอบมากกว่า 1 รายการ (`sIdx > 0`, `isDuplicateStructKm = true`) จะแสดงค่าระดับดินเดิมและค่าระดับคูส่งน้ำเฉพาะแถวแรกของ `กม.` นั้น (`sIdx === 0`) เท่านั้น ส่วนแถวอาคารที่ซ้ำ `กม.` เดียวกันจะเว้นว่างคอลัมน์ค่าระดับ (`ระดับดินเดิม (ม.)`, `TYPE`, `H TBL (ม.)`, `SLOPE`, `H (ม.)`, `ระดับ BL. เริ่มต้น`, `ระดับ TBL เริ่มต้น`, `กม.สิ้นสุด`, `ระดับ BL. สิ้นสุด`, `ระดับ TBL สิ้นสุด`)
4. **ชุดทดสอบ**: `tests/check-round56.js` (PASS = 7, FAIL = 0) และชุดทดสอบเดิมทั้งหมดผ่าน 100% (`FAIL = 0`)

## รอบ 57 (เพิ่มบรรทัด Version 1.xxxx ในปุ่ม พัฒนาโดย สจจ.2 และตั้งกฎเพิ่มเลข Version ทีละ 0.0001 เมื่อมีการแก้ไข)
1. **เพิ่มบรรทัดที่ 2 แสดง `Version 1.0001` ในป้าย `💻 พัฒนาโดย สจจ.2` (`index.html`, `style.css`, `js/state.js`, `js/canvas-viewer.js`)**:
   - กำหนดตัวแปร `const APP_VERSION = '1.0001';` ใน `js/state.js`
   - ปรับ `#devBadge` (`.developer-tab`) ใน `index.html` และฟังก์ชัน `renderDevBadge()` / `toggleSidebar()` ใน `js/canvas-viewer.js` ให้แสดง 2 บรรทัด:
     - บรรทัดที่ 1: `💻 พัฒนาโดย สจจ.2` (หรือ `สจจ.2` เมื่อย่อแถบเมนูซ้าย)
     - บรรทัดที่ 2: `Version 1.0001` (`#devBadgeVersion`)
2. **ตั้งกฎการเพิ่มเลข Version ทีละ `0.0001` เมื่อมีการแก้ไข (`HANDOFF.md`, `js/state.js`)**:
   - บันทึกกฎข้อที่ 8 ในหมวด `1) กฎการทำงานที่ตกลงกับเจ้าของงาน` ใน `HANDOFF.md` และคอมเมนต์กำกับใน `js/state.js` ว่าเมื่อมีการแก้ไขโค้ดทุกครั้ง ให้เพิ่มเลข `APP_VERSION` และ `#devBadgeVersion` ขึ้นทีละ `0.0001` เสมอ
3. **ชุดทดสอบ**: `tests/check-round57.js` และชุดทดสอบเดิมทั้งหมดผ่าน 100% (`FAIL = 0`)

## รอบ 58 (กู้เว็บที่พังจาก Google Drive sync เปลี่ยนชื่อไฟล์ + แก้ชุดเทสต์ที่รันไม่ได้ + แก้บั๊กค่า 0 หาย + ตัดโค้ดตาย)
1. **กู้เว็บที่พังทั้งเว็บ — Google Drive sync เติมเลข `(1)` ต่อชื่อไฟล์**:
   - อาการ: `index.html` โหลดสคริปต์ไม่ครบ 4 ไฟล์ → เว็บเปิดแล้วแท็บ/ปุ่มหาย หรือพังทั้งหน้า
   - ไฟล์ที่ถูกเปลี่ยนชื่อและต้องเปลี่ยนกลับ:
     | เดิม (พัง) | แก้เป็น |
     |---|---|
     | `js/state (1).js` | `js/state.js` |
     | `js/canvas-viewer (1).js` | `js/canvas-viewer.js` |
     | `js/tab-export-preview (1).js` | `js/tab-export-preview.js` |
     | `style (1).css` | `style.css` |
   - **วิธีแก้ซ้ำเมื่อเกิดอีก:** `Get-ChildItem -Recurse -File | Where-Object { $_.Name -match '\s\(\d+\)\.(js|css)$' }` แล้ว `Rename-Item` กลับ · หรือ `git checkout .` ถ้าตั้ง Git ไว้แล้ว
2. **แก้ชุดเทสต์ที่รันไม่ได้**:
   - `tests/check-round48.js` + `tests/check-round51.js` เคย hardcode path Linux (`/working_dir/.../คลองซอย10RMC_แม่วัง_7แท็บ.xlsx`) และเรียก `python3` + `openpyxl` ที่ไม่มีในเครื่อง → `JSON.parse` ล้มเหลว
     - เพิ่ม `tests/lib/xlsx-reader.js` = ตัวอ่าน `.xlsx` แบบไม่ต้องพึ่ง dependency (ใช้ `zlib` ของ Node อย่างเดียว · รองรับ sharedStrings / inlineStr / ตัวเลข / บูล)
     - เพิ่ม `tests/lib/fixture.js` = ค้นหาไฟล์ตัวอย่างอัตโนมัติ: env var `BCLC_FIXTURE_XLSX` → `tests/fixtures/` → `Downloads/` → `Desktop/` → `Documents/`
     - ทั้ง 2 ไฟล์ทดสอบเปลี่ยนไปเรียก `loadFixture()` แทน python
   - `tests/verify-file.js` เคย default เป็น `index.html.restored` (ไฟล์ไม่มีอยู่แล้ว) → เขียนใหม่ให้รันได้จริง: ไม่ใส่ไฟล์ = ตรวจ `index.html` + `style.css` + `js/*.js` ทั้งหมด (21 ไฟล์) · ใส่ชื่อไฟล์ = ตรวจเฉพาะไฟล์นั้น
   - `tests/_audit.js` + `tests/_audit2.js` มี BOM → `check-all-encoding.js` เตือน 2 จุด → ถอด BOM ออก (ตอนนี้ `warnings: 0`)
3. **ตัดโค้ดตายที่อ้าง DOM ซึ่งถูกลบไปแล้ว (`js/canvas-viewer.js`)**:
   - รอบ 46 ลบแถบ breadcrumb (`#headerMainTabName` / `#headerSubTabName` / `#headerBreadcrumbSep`) ออกจาก `index.html` แต่โค้ด `updateTopHeaderBanner()` ยังคงพยายามแตะ DOM เหล่านั้น
   - แก้: ตัดส่วนที่แตะ breadcrumb ออก เหลือไว้เฉพาะการอัปเดต `#headerProjectName` / `#headerProjectLocation` (ชื่อ/ที่อยู่โครงการ) ที่ยังมีอยู่จริง
4. **แก้บั๊ก "falsy zero" — ค่าตัวเลข 0 กลายเป็นค่าว่าง (`js/state.js`, `js/tab-export-preview.js`, `js/tab-level.js`, `js/tab-ground.js`)**:
   - สาเหตุ: ใช้ `v.bl1 || ''` → ค่า `BL = 0` กลายเป็นค่าว่าง (แสดงเป็นช่องโล่งแทนที่จะเป็น `0`)
   - แก้: เพิ่ม `keepNumValue()` ใน `js/state.js` (ใช้ร่วมทั้งโปรเจกต์) + `epKeepNum()` ใน `js/tab-export-preview.js`
     - `null` / `undefined` / `''` → `''` (ยังถือว่าไม่มีค่า)
     - `0` (ตัวเลข) → `0` · `'0'` / `'0.00'` → `0` (ต้องเก็บไว้)
   - จุดที่แก้: `epEvalCanalLevelAtKm()` (`bl1/tbl1/bl2/tbl2`), `epBuildKmStepRows()` (`bl2/tbl2`), `epMergedRowCells()`, ตารางแท็บระดับคูส่งน้ำ (`tab-level.js`), ตารางแท็บระดับดินเดิม (`tab-ground.js`)
5. **ตรวจสอบแถวที่เติมตาม กม. (ปุ่ม "แยก กม. ทุกๆ .. ม.")**:
   - ยืนยันว่าแถวที่เติมตาม กม. มี `กม.สิ้นสุด` / `ระดับ BL. สิ้นสุด` / `ระดับ TBL สิ้นสุด` ที่สอดคล้องกับช่วงคูน้ำของแถวนั้น และ `ระดับ BL. เริ่มต้น` เปลี่ยนตามระยะ (ไม่ใช่ค่าเดียวทั้งช่วง) — **โค้ดเดิมถูกต้องอยู่แล้ว** บั๊กจริงอยู่ที่ falsy-zero ข้อ 4 เท่านั้น
6. **เพิ่มชุดทดสอบ**: `tests/check-round58.js` (PASS = 25, FAIL = 0) ครอบคลุมทั้ง 5 ข้อข้างต้น
7. **เลขเวอร์ชัน**: `APP_VERSION` 1.0001 → **1.0002** (`js/state.js` + ป้าย `#devBadgeVersion` ใน `index.html`) · cache-busting `?v=20261103f` → **`?v=20261103g`** (21 script/link tag)
8. **สถานะเทสต์หลังรอบ 58**: ทุกชุดรันผ่าน `FAIL = 0` รวม 38 ไฟล์ (smoke · probe · รอบ 26–57 · check-ai-error · check-migrate · check-encoding · check-all-encoding · verify-file · round29/30)
   - `check-round48.js` = 16 ข้อ · `check-round51.js` = 5 ข้อ · `check-round58.js` = 25 ข้อ (ก่อนแก้ 2 ไฟล์นี้รันไม่ได้เลย)

> ⚠️ **ข้อควรระวังรอบ 58:** โฟลเดอร์ยังอยู่บน Google Drive และ**ยังไม่มี Git** → ควร `git init` + commit ครั้งแรกโดยเร็ว (คำสั่งในหัวข้อ 8) เพราะปัญหาชื่อไฟล์เพี้ยนแบบนี้จะเกิดซ้ำได้

---

## รอบ 60 (Version 1.0004 · `?v=20261104b`) — แท็บ "ส่วนคำนวณปริมาณ -> ⛰️ งานดิน": UI สีอ่อนโปร่ง, กรอง/ย่อสายคูส่งน้ำ, Undo/Redo, เตือนก่อนปิดหน้า

1. **แก้การแสดงผลส่วนแรก (ปุ่มยาว หน้าจอขาว)**:
   - `#quantityCalcPage` ใช้ธีมสว่างโปร่งแบบ scoped ด้วย `#quantityCalcPage` + `!important` (พื้นหลัง `rgba(255,255,255,0.72)` แทนสีดำ) แทนที่จะ refactor
   - ปุ่มในแถบเครื่องมือด้านบนขวา (ตารางข้อมูล/คัดลอก/ส่งออก) ปรับเป็นชุด `.ew-btn` แบบเดียวกัน ไม่ยืดตามความกว้างเนื้อหา

2. **พื้นหลังสีดำ → สีอ่อนโปร่ง (ทั้งหน้า)**:
   - แก้ใน `style.css` (Round 60 block) + inline palette ใน `js/tab-earthwork.js` (`SECTION_COLOR_PALETTE` เปลี่ยนเป็น pastel RGBA)
   - ครอบคลุม: หน้าเมนูหลัง/พื้นหลังหน้า, แถบเครื่องมือส่วนที่ 3, แถบควบคุมการเปรียบเทียบ, ระยะสายคูส่งน้ำ (divider row), แท็บหัวหน้า, แท็บหัวตาก, และ modal ต่าง ๆ

3. **พื้นที่สองรูปตัด + แท็บขวามือ ยาวเกินไป**:
   - ถอด `min-h-[390px]` / `min-h-[325px]` → ใช้ `.ew-cmp-canvas-box` (`min-height: 0; height: auto`) และ `.ew-cmp-canvas` (`height: 260px !important`)
   - แท็บขวามือ `.ew-side-panel` (`align-self: start; height: auto`) + grid ใช้ `items-start` และ `justify-start`

4. **ตารางข้อมูล**:
   - ปุ่มในแถบเครื่องมือตาราง → ชุด `.ew-btn` สีอ่อนโปร่ง
   - เพิ่มดรอปลิด `#selectCanalLineFilter` ใต้ปุ่ม "ซ่อน/แสดงคอลัมน์" เลือกได้ "ทั้งหมด / สายเฉพาะ"
   - เพิ่มปุ่ม **ย่อ/ขยาย** ในแถวป้ายชื่อสายคูส่งน้ำ (`.ew-line-toggle-btn`) ย่อเฉพาะแถวของสายนั้น

5. **ปุ่มด้านล่าง**: รวมเป็น `#ewBottomToolbar` และบังคับรูปแบบเดียวกัน (`#ewBottomToolbar button`)

6. **แท็บหัวหน้า**: แสดงชื่อโปรเจกต์ (`#qtyHeaderProjectName`), ที่อยู่ (`#qtyHeaderProjectLocation`), สถานะเชฟอัตโนมัติ (`#qtyAutosaveStatusBox` / `#qtyAutosaveLastTimeText`) + ปุ่ม Undo/Redo (`#btnHeaderUndo` / `#btnHeaderRedo`)

7. **Undo/Redo ในหน้าดึงค่าจากส่วนถอดแบบ**: เพิ่มปุ่ม `#btnPullUndo` / `#btnPullRedo` เรียก `performWorkspaceUndo()` / `performWorkspaceRedo()`

8. **ข้อเสนอแนะข้อ 1 & 2**:
   - ข้อ 1 (Git baseline): commit `0b6c112` (`chore: บันทึกสถานะโปรเจกต์เวบ3 ก่อนปรับปรุง UI แท็บงานดิน (รอบ 60)`)
   - ข้อ 2 (เตือนก่อนปิดหน้าเว็บ): `js/autosave.js` เพิ่ม `markWorkspaceDirty()` / `clearWorkspaceDirtyFlag()` / `initUnsavedChangesWarning()` + listener `beforeunload`

9. **ชุดทดสอบ**: เพิ่ม `tests/check-round60.js` (48 ข้อ) — PASS 48/48 · ชุดอื่น (`smoke-test.js`, `probe-bugs.js`, `check-round58.js`, `check-round48.js`, `check-round51.js`) ผ่าน FAIL = 0

---

## รอบ 59 (Version 1.0003 · `?v=20261104a`) — ส่วนคำนวณปริมาณ: แท็บ "งานดิน" และการเชื่อมข้อมูลจากส่วนถอดแบบ

1. **เพิ่มหน้า `#quantityCalcPage` ("ส่วนคำนวณปริมาณ") และแท็บ `⛰️ งานดิน` (`#qty-calc-tab-earthwork`)**:
   - โครงสร้างเดียวกับหน้า "ส่วนอาคารประกอบ" (`#structureCalcPage`) มีแถบเมนูซ้ายพับ/กางได้ แถบหัวด้านบนพร้อมปุ่ม **🔄 ดึงค่าจากส่วนถอดแบบ**, **📋 Copy**, และ **กลับสู่ ส่วนถอดแบบ**
   - นำหลักส่วนที่ 3 (`#sectionExternalData`) จาก `canal_cross_section_V3.html` มาใส่ครบทั้งหมด:
     - กราฟรูปตัดตามยาว (`#canvasLongProfile`) และกราฟเปรียบเทียบ 2 หน้าตัด (`#canvasCompareStart`, `#canvasCompareEnd`) พร้อมตารางสรุปเปรียบเทียบพื้นที่/ปริมาตร (`#cmpBreakdownBody`)
     - ตารางคำนวณปริมาณงาน BoQ (`#boqTable`) คอลัมน์ A–U + พิกัดจุดยอดหน้าตัด 14 จุด (`P1`–`P14`) + พื้นที่ `A1`, `A2`, ระยะ `L`, และปริมาณงาน `(A1+A2)/2 × L` ครบ 8 หมวดงาน
     - แถบเครื่องมือแบ่งซอยสถานี กม. อัตโนมัติ, แบ่งจุดเปลี่ยนผ่านพื้นที่ = 0, Undo/Redo, ซ่อน/แสดงคอลัมน์, นำเข้า/ส่งออก Excel, พิมพ์ตาราง BoQ (`#printableBoqTableModal`), รายการคำนวณละเอียดพร้อมภาพประกอบขาว-ดำ (`#calcReportModal`), และตารางค่าเริ่มต้นคูส่งน้ำ U-SHAPE (`#canalDefaultsModal`)
2. **เชื่อมข้อมูลจาก "ส่วนถอดแบบ" มาใส่ในแท็บ "งานดิน" อัตโนมัติ (`syncEarthworkFromTakeoff()`)**:
   - ดึงข้อมูลจาก `channels` (ระบบคูส่งน้ำ), `dimensionRows` (มิติคูส่งน้ำ: `Type`, `B`, `D`/`H`, `TBL`, `TBR`, `SLOPE`), `ditchTypeDatabase` (ความหนากำแพง `tw`, ความหนาพื้น `tf`/`tb`), `levelRowsData` (ระดับก้นคลอง `BL`, ระดับหลังคลอง `TBL`, และความสูงอาคารลดระดับ `H`), และ `groundRowsData` / เส้นดินเดิมที่ลากบนภาพ (`NGL`)
   - คำนวณแบ่งช่วงสถานีตามจุดเปลี่ยนระดับคูส่งน้ำและจุดหักระดับดินเดิม (NGL) พร้อมสร้างโปรไฟล์ `savedNglProfilesByLine` แยกตามสายคูส่งน้ำให้อัตโนมัติเมื่อเปิดหน้า "ส่วนคำนวณปริมาณ -> งานดิน" หรือกดปุ่ม **🔄 ดึงค่าจากส่วนถอดแบบ**
3. **ชุดทดสอบอัตโนมัติ**:
   - เพิ่ม `tests/check-round59.js` (19 ข้อ) และตรวจสอบร่วมกับ `smoke-test.js`, `probe-bugs.js`, `check-round58.js`, `verify-file.js`, `check-all-encoding.js` ผ่านทั้งหมด 0 FAIL

4. **กฎโครงสร้างไฟล์สำหรับแท็บย่อยใหม่ (Modular Tab Rule)**:
   - แท็บ **งานดิน** แยกเป็นไฟล์ย่อย `js/tab-earthwork.js`
   - **กฎบังคับสำหรับรอบถัดไป**: หากมีการเพิ่มแท็บใหม่รองจากเมนูหลัก ให้แยกโค้ดของแท็บนั้นออกเป็น **1 ไฟล์ต่อ 1 แท็บ** ในโฟลเดอร์ `js/` (เช่น `js/tab-<ชื่อแท็บ>.js`) เสมอ ไม่นำไปรวมไว้ใน `js/table-core.js`
   - **การแก้ไขไฟล์หลักใน `เวบ3`**: แก้ไขทับที่ไฟล์หลักโดยตรงและปรับเลข Version (`APP_VERSION` และ `?v=...`) โดยไม่ต้องสร้างโฟลเดอร์สำรอง
