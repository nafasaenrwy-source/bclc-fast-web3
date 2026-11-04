var selectedGroundPoint = (typeof window !== "undefined" && window.selectedGroundPoint) ? window.selectedGroundPoint : null;
var draggingGroundPoint = (typeof window !== "undefined" && window.draggingGroundPoint) ? window.draggingGroundPoint : null;
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const magCanvas = document.getElementById('magnifier');
const magCtx = magCanvas.getContext('2d');
const fileLoader = document.getElementById('fileLoader');
const zoomBox = document.getElementById('zoomBox');
const fileStatusDisplay = document.getElementById('fileStatusDisplay');
const thumbnailsSidebar = document.getElementById('pdfThumbnailsSidebar');
const magnifierBox = document.getElementById('magnifierBox');
const magnifierDragBar = document.getElementById('magnifierDragBar');

let isMagnifierOpen = false;
let currentRenderToken = 0; // ป้องกัน render PDF เก่าทับใหม่เมื่อเปลี่ยนหน้าเร็ว ๆ
let isSidebarCollapsed = false;

var activeMediaViewTab = "pdf";

// เก็บข้อมูล PDF และรูปภาพแยกจากกัน เพื่อเวลาสลับกลับไปแท็บ PDF จะไม่ติดรูปภาพที่อัปโหลดในแท็บรูปตัดตามยาว
var savedPdfPageImageSrc = "";
var savedPdfFileName = "";
var savedLongImageSrc = "";
var savedLongImageFileName = "";

// สถานะแถวข้อมูลที่เลือกสำหรับแสดงรูปตัดขวาง (แท็บที่ 3)
var activeCrossSectionState = {
  channelId: 1,
  km: 0,
  rowIndex: 0,
  sourceTab: "dropdown"
};

// ซูมและแพนสำหรับแท็บส่วนแสดงรูปตัดขวาง (ตามหลักการวาดรูปจากไฟล์ที่แนบ)
var crossSectionZoom = 1.0;
var crossSectionMinZoom = 0.25;
var crossSectionMaxZoom = 8.0;
var crossSectionBaseW = 920;
var crossSectionBaseH = 540;
var crossSectionPanX = 0;
var crossSectionPanY = 0;
var crossSectionStartPanX = 0;
var crossSectionStartPanY = 0;

// สถานะการแสดงเลเยอร์ของส่วนแสดงรูปตัดขวาง
var crossSectionLayerVisibility = {
  showDims: true,
  showWidths: true,
  showAreas: true,
  showAreaStripping: true,
  showAreaExcavation: true,
  showAreaCompacted: true,
  showAreaManual: true,
  showSummaryTable: true
};

// สถานะการแสดงเลเยอร์ต่าง ๆ บนแคนวาส (เปิดค่าเริ่มต้นทุกตัว)
var overlayVisibility = {
  cropFrames: true,
  groundLine: true,
  levelLine: true,
  elevationLabels: true,
  structures: true,
  slopeLabels: true
};

// รอบ 41: สถานะการแสดงเลเยอร์ "แยกต่อแท็บ" — แท็บ PDF กับแท็บรูปตัดตามยาว ไม่เกี่ยวข้องกัน
//   overlayVisibility → ใช้กับแท็บ PDF (แสดงไฟล์ PDF) เป็นหลัก
//   overlayVisibilityImage → ใช้กับแท็บรูปตัดตามยาว
//   overlayVisibilityDraw → ใช้กับแท็บรูปตัดขวาง
//   refPointsVisible → ปุ่มแสดง/ซ่อนจุด P1 P2 (แยกต่อแท็บด้วย)
var overlayVisibilityImage = {
  cropFrames: true,
  groundLine: true,
  levelLine: true,
  elevationLabels: true,
  structures: true,
  slopeLabels: true
};
var overlayVisibilityDraw = {
  cropFrames: true,
  groundLine: true,
  levelLine: true,
  elevationLabels: true,
  structures: true,
  slopeLabels: true
};
// จุดอ้างอิง P1/P2 แยกต่อแท็บ (pdf / image / draw)
var refPointsVisibility = { pdf: true, image: true, draw: true };

// รอบ 41: ดึงสถานะการแสดงเลเยอร์ของแท็บที่กำลังดูอยู่
function getOverlayVisibilityForCurrentTab() {
  const tab = (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'pdf';
  if (tab === 'image') return overlayVisibilityImage;
  if (tab === 'draw') return overlayVisibilityDraw;
  return overlayVisibility;
}

// รอบ 41: สลับการแสดง/ซ่อนเลเยอร์ของแท็บที่กำลังดูอยู่ (ปุ่มแต่ละแท็บไม่กระทบกัน)
function toggleOverlayVisibilityForCurrentTab(key) {
  if (!key) return;
  const vis = getOverlayVisibilityForCurrentTab();
  if (!(key in vis)) return;
  vis[key] = !vis[key];
  syncOverlayToggleButtonsUI();
  redraw();
}

// รอบ 41: สลับการแสดง/ซ่อนจุด P1 P2 ของแท็บที่กำลังดูอยู่
function toggleRefPointsVisibility() {
  const tab = (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'pdf';
  if (!refPointsVisibility.hasOwnProperty(tab)) refPointsVisibility[tab] = true;
  refPointsVisibility[tab] = !refPointsVisibility[tab];
  syncOverlayToggleButtonsUI();
  redraw();
}

// รายการกรอบรูปที่ตีไว้จาก PDF / รูปภาพ
var pdfCropFrames = [];
var activeCropFrameIndex = -1;

// สถานะการทำงานของ AI และการตั้งค่า AI (ตามรูปที่ 2)
var isAiReading = false;
var aiTimerInterval = null;
var aiStartTimeMs = 0;

// รอบ 31: ค่าเริ่มต้นเปลี่ยนจาก "gpt-6-astra" (ไม่ใช่ชื่อโมเดลจริงของ OpenAI) เป็น "gpt-4o"
//   gpt-4o อ่านรูปได้ (vision) และมีให้ใช้งานทั่วไป
var AI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
var AI_DEFAULT_MODEL = "gpt-4o";

var aiCurrentSettings = {
  baseUrl: AI_DEFAULT_BASE_URL,
  model: AI_DEFAULT_MODEL,
  quality: "1400",
  apiKey: ""
};

function getThumbnailsListEl() {
  return document.getElementById("pdfThumbnailsList") || thumbnailsSidebar;
}

function getLeftThumbnailsSidebarEl() {
  return document.getElementById("leftThumbnailsSidebar");
}

// รอบ 44: บริบทหน้าปัจจุบันที่ใช้แสดงแท็ปชื่อเมนูในแถบหัว (ให้แสดงได้ทุกหน้า ไม่ใช่เฉพาะส่วนถอดแบบ)
// รอบ 58: รอบ 46 ได้ลบแถบ breadcrumb (headerMainTabName / headerSubTabName / headerBreadcrumbSep)
//   ออกจาก index.html แล้ว → ตัดส่วนที่แตะ DOM ของ breadcrumb ออก เหลือไว้เฉพาะการอัปเดตชื่อ/ที่อยู่โครงการ
let currentHeaderMainTitle = null;
let currentHeaderSubTitle = null;

function updateTopHeaderBanner(mainTitleOverride, subTitleOverride) {
  const projNameEl = document.getElementById("headerProjectName");
  const projLocEl = document.getElementById("headerProjectLocation");

  if (mainTitleOverride !== undefined) currentHeaderMainTitle = mainTitleOverride;
  if (subTitleOverride !== undefined) currentHeaderSubTitle = (subTitleOverride || '');

  if (projNameEl && typeof projectPlanData !== "undefined" && projectPlanData) {
    projNameEl.textContent = projectPlanData.name || "ไม่ได้ระบุชื่อโครงการ";
  }
  if (projLocEl && typeof projectPlanData !== "undefined" && projectPlanData) {
    projLocEl.textContent = "📍 " + (projectPlanData.location || "ไม่ได้ระบุสถานที่");
  }

  // รอบ 60: ซิงก์ชื่อโครงการ/ที่อยู่ไปยังแถบหัวของแท็บ "ส่วนคำนวณปริมาณ" ด้วย
  const qtyNameEl = document.getElementById("qtyHeaderProjectName");
  const qtyLocEl = document.getElementById("qtyHeaderProjectLocation");
  if (qtyNameEl && typeof projectPlanData !== "undefined" && projectPlanData) {
    qtyNameEl.textContent = projectPlanData.name || "ไม่ได้ระบุชื่อโครงการ";
  }
  if (qtyLocEl && typeof projectPlanData !== "undefined" && projectPlanData) {
    qtyLocEl.textContent = "📍 " + (projectPlanData.location || "ไม่ได้ระบุสถานที่");
  }
}

// ส่วนแสดงไฟล์ PDF ถ้าไม่ได้อัปโหลดไฟล์ ไม่ต้องแสดงอะไร (ซ่อนกล่องข้อความเสมอ)
function updatePdfEmptyUploadPromptVisibility() {
  const promptEl = document.getElementById("pdfEmptyUploadPrompt");
  if (promptEl) {
    promptEl.style.display = "none";
  }
}

function syncSideControlPanelByMediaTab() {
  const pdfGrp = document.getElementById("sidePdfButtonsGroup");
  const imgGrp = document.getElementById("sideImageButtonsGroup");
  const drawGrp = document.getElementById("sideDrawButtonsGroup");
  const sharedGrp = document.getElementById("sideSharedDisplayButtons");
  const aiSec = document.getElementById("sideImageAiSection");
  const leftSide = getLeftThumbnailsSidebarEl();
  const rotateBtn = document.getElementById("btn-rotate-cw");
  const clearAllBtn = document.getElementById("btn-side-clear-all-objects");
  const rotateDiv = document.getElementById("sideRotateDivider");
  const fileBar = document.getElementById("viewportFileNameBar");
  const topToolbar = document.querySelector(".top-toolbar-bar");

  if (topToolbar) {
    topToolbar.classList.remove("active-tab-pdf", "active-tab-image", "active-tab-draw");
    topToolbar.classList.add("active-tab-" + activeMediaViewTab);
  }

  if (activeMediaViewTab === "image") {
    if (pdfGrp) pdfGrp.style.display = "none";
    if (imgGrp) imgGrp.style.display = "flex";
    if (drawGrp) drawGrp.style.display = "none";
    if (sharedGrp) sharedGrp.style.display = "flex";
    if (aiSec) aiSec.style.display = "none";
    if (leftSide) leftSide.style.display = "flex";
    if (rotateBtn) rotateBtn.style.display = "";
    if (clearAllBtn) clearAllBtn.style.display = "";
    if (rotateDiv) rotateDiv.style.display = "";
    if (fileBar) fileBar.style.display = "flex";
    // รอบ 41: ปุ่มจุด P1 P2 (แท็บรูปตัดตามยาว)
    const refImgBtn = document.getElementById("btn-toggle-ref-points-image");
    if (refImgBtn) refImgBtn.style.display = "";
    const refPdfBtn = document.getElementById("btn-toggle-ref-points-pdf");
    if (refPdfBtn) refPdfBtn.style.display = "none";
  } else if (activeMediaViewTab === "draw") {
    if (pdfGrp) pdfGrp.style.display = "none";
    if (imgGrp) imgGrp.style.display = "none";
    if (drawGrp) drawGrp.style.display = "flex";
    if (sharedGrp) sharedGrp.style.display = "none";
    if (aiSec) aiSec.style.display = "none";
    if (leftSide) leftSide.style.display = "none";
    if (rotateBtn) rotateBtn.style.display = "none";
    if (clearAllBtn) clearAllBtn.style.display = "none";
    if (rotateDiv) rotateDiv.style.display = "none";
    if (fileBar) fileBar.style.display = "none";
    // รอบ 41: ปุ่มจุด P1 P2 (ไม่มีในแท็บรูปตัดขวาง)
    const refImgBtn2 = document.getElementById("btn-toggle-ref-points-image");
    if (refImgBtn2) refImgBtn2.style.display = "none";
    const refPdfBtn2 = document.getElementById("btn-toggle-ref-points-pdf");
    if (refPdfBtn2) refPdfBtn2.style.display = "none";
    if (typeof syncCrossSectionSelectorsUI === "function") syncCrossSectionSelectorsUI();
  } else {
    if (pdfGrp) pdfGrp.style.display = "flex";
    if (imgGrp) imgGrp.style.display = "none";
    if (drawGrp) drawGrp.style.display = "none";
    if (sharedGrp) sharedGrp.style.display = "flex";
    if (aiSec) aiSec.style.display = "none";
    if (leftSide) leftSide.style.display = "flex";
    if (rotateBtn) rotateBtn.style.display = "";
    if (clearAllBtn) clearAllBtn.style.display = "";
    if (rotateDiv) rotateDiv.style.display = "";
    const hasRealPdf = !!(pdfDoc && savedPdfPageImageSrc);
    if (fileBar) fileBar.style.display = hasRealPdf ? "flex" : "none";
    // รอบ 41: ปุ่มจุด P1 P2 (แท็บ PDF)
    const refPdfBtn3 = document.getElementById("btn-toggle-ref-points-pdf");
    if (refPdfBtn3) refPdfBtn3.style.display = "";
    const refImgBtn3 = document.getElementById("btn-toggle-ref-points-image");
    if (refImgBtn3) refImgBtn3.style.display = "none";
  }
  syncOverlayToggleButtonsUI();
  updatePdfEmptyUploadPromptVisibility();
}

function syncOverlayToggleButtonsUI() {
  const mapIds = {
    cropFrames: "btn-toggle-crop-frames",
    groundLine: "btn-toggle-ground-line",
    levelLine: "btn-toggle-level-line",
    elevationLabels: "btn-toggle-elev-labels",
    structures: "btn-toggle-structures",
    slopeLabels: "btn-toggle-slope-labels"
  };
  // รอบ 41: ใช้สถานะของแท็บที่กำลังดูอยู่ (แต่ละแท็บแยกกัน)
  const vis = (typeof getOverlayVisibilityForCurrentTab === 'function')
    ? getOverlayVisibilityForCurrentTab()
    : overlayVisibility;
  Object.keys(mapIds).forEach(k => {
    const btn = document.getElementById(mapIds[k]);
    if (btn) btn.classList.toggle("active", vis[k] !== false);
  });
  const cropBtn = document.getElementById("btn-side-crop-pdf");
  if (cropBtn) cropBtn.classList.toggle("active-mode", currentMode === "crop_pdf");
  // รอบ 41: ปุ่มแสดง/ซ่อนจุด P1 P2 (แยกปุ่มต่อแท็บ แต่สถานะแยกต่อแท็บด้วย)
  const refBtnIds = ["btn-toggle-ref-points", "btn-toggle-ref-points-pdf", "btn-toggle-ref-points-image"];
  const tab = (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'pdf';
  const on = (typeof refPointsVisibility !== 'undefined' && refPointsVisibility) ? (refPointsVisibility[tab] !== false) : true;
  refBtnIds.forEach(id => {
    const refBtn = document.getElementById(id);
    if (!refBtn) return;
    refBtn.classList.toggle("active", on);
    if (refBtn.dataset) refBtn.dataset.state = on ? 'on' : 'off';
  });
  syncPdfCropSaveButtonUI();
}

// รอบ 35: ปุ่มฝั่ง PDF เป็นปุ่มสองสถานะ
//   - ปกติ: "✂️ ตีกรอบรูป" (กดแล้วเข้าโหมดลากตีกรอบ)
//   - ในโหมดตีกรอบ: "💾 บันทึก กรอบรูป" (กดแล้วบันทึกและกลับไปโหมดปกติ)
function syncPdfCropSaveButtonUI() {
  const btn = document.getElementById("btn-side-save-frames");
  if (!btn) return;
  const inCropMode = (currentMode === "crop_pdf");
  const cropLabel = "✂️ ตีกรอบรูป";
  const saveLabel = "💾 บันทึก กรอบรูป";
  const nextLabel = inCropMode ? saveLabel : cropLabel;
  if (String(btn.textContent || '').trim() !== nextLabel) {
    btn.textContent = nextLabel;
  }
  if (btn.dataset) btn.dataset.state = inCropMode ? "crop" : "idle";
  if (btn.classList && typeof btn.classList.toggle === 'function') {
    btn.classList.toggle("active-mode", inCropMode);
  }
  if (typeof btn.setAttribute === 'function') {
    btn.setAttribute("title", inCropMode
      ? "บันทึกกรอบรูปที่ตีไว้ แล้วกลับไปโหมดปกติ"
      : "ลากตีกรอบรูปบนหน้า PDF");
  }
}

// ปุ่มฝั่ง PDF: สลับระหว่างโหมด "ตีกรอบรูป" กับ "บันทึก กรอบรูป"
function togglePdfFrameCropButton() {
  if (currentMode === "crop_pdf") {
    saveCropFramesData();
    return;
  }
  if (activeMediaViewTab !== "pdf") {
    switchMediaViewTab("pdf");
  }
  overlayVisibility.cropFrames = true;
  prevStepMode = "pan";
  setMode("crop_pdf");
  syncOverlayToggleButtonsUI();
  if (!pdfDoc && (!img || !img.src)) {
    if (typeof uiToast === "function") {
      uiToast("สลับไปยังแท็บ ส่วนแสดงไฟล์ PDF แล้ว — กรุณาอัปโหลดไฟล์ PDF เพื่อลากตีกรอบ", "info");
    }
    return;
  }
  if (typeof uiToast === "function") {
    const nextIdx = pdfCropFrames.length + 1;
    uiToast(`โหมดตีกรอบใน PDF: ลากเมาส์ตีกรอบได้หลายกรอบต่อเนื่อง (เริ่มที่ รูปภาพ ${nextIdx}) แล้วกด "💾 บันทึก กรอบรูป"`, "info");
  }
}

function toggleOverlayVisibility(key) {
  if (!key || !(key in overlayVisibility)) return;
  overlayVisibility[key] = !overlayVisibility[key];
  syncOverlayToggleButtonsUI();
  redraw();
}

function renumberLongitudinalItems() {
  pdfCropFrames.forEach((fr, idx) => {
    fr.index = idx + 1;
    // รอบ 35: ถ้าผู้ใช้ตั้งชื่อเองไว้แล้ว (เช่น ชื่อคูที่ AI อ่านได้) ให้คงไว้ ไม่ตั้งใหม่
    if (!fr._customName) fr.name = `รูปภาพ ${idx + 1}`;
  });
}

// รอบ 35: ตั้งชื่อรูปภาพตาม "ชื่อคูที่ AI อ่านได้" ให้ทั้งในส่วน PDF และส่วนแสดงรูปตัดตามยาว
//   frameId = id ของกรอบ · ditchName = ชื่อคูที่อ่านได้ (เช่น "01") · canalName = ชื่อคลอง (ถ้ามี)
//   ผลลัพธ์: "คูส่งน้ำ 01" (หรือ "คลอง X / คูส่งน้ำ 01")
function applyAiFrameName(frameId, ditchName, canalName) {
  if (!frameId) return null;
  const dn = String(ditchName || '').trim();
  if (!dn || dn === '-') return null;
  const cn = String(canalName || '').trim();
  const label = cn && cn !== '-' ? `${cn} / คูส่งน้ำ ${dn}` : `คูส่งน้ำ ${dn}`;
  let changed = false;
  (typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames) ? pdfCropFrames : []).forEach(fr => {
    if (!fr || fr.id !== frameId) return;
    fr.name = label;
    fr._customName = true;
    changed = true;
  });
  // ชุดข้อมูลที่ผูกกับกรอบนี้ → อัปเดตชื่ออ้างอิงด้วย
  (typeof channels !== 'undefined' && Array.isArray(channels) ? channels : []).forEach(ch => {
    if (ch && ch._frameId === frameId) ch._frameName = label;
  });
  if (changed && typeof generateImageThumbnail === 'function') {
    try { generateImageThumbnail(); } catch (_) {}
  }
  if (changed && typeof updateFileStatusDisplay === 'function') {
    try { updateFileStatusDisplay(); } catch (_) {}
  }
  return changed ? label : null;
}

function deleteLongitudinalItem(idx, e) {
  if (e && typeof e.stopPropagation === "function") {
    e.stopPropagation();
  }
  if (idx < 0 || idx >= pdfCropFrames.length) return;
  const removed = pdfCropFrames.splice(idx, 1)[0];
  renumberLongitudinalItems();
  // รอบ 30: ลบการเขียน localStorage "bclc_saved_crop_frames" ทิ้ง — เดิมเขียนแต่ไม่มีโค้ดอ่านกลับ
  //   (ไม่เก็บ dataUrl จึงไม่มีประโยชน์) ตอนนี้กรอบรูปถูกบันทึกลงไฟล์ JSON โปรเจกต์แทน
  if (removed && removed.id && typeof aiRefPoints !== 'undefined' && aiRefPoints) {
    delete aiRefPoints[removed.id];
    if (typeof aiLabels !== 'undefined' && aiLabels) delete aiLabels[removed.id];
  }

  if (pdfCropFrames.length === 0) {
    activeCropFrameIndex = -1;
    savedLongImageSrc = "";
    savedLongImageFileName = "";
    if (activeMediaViewTab === "image") {
      isPDF = false;
      currentFileName = "";
      img = new Image();
      canvas.width = 600;
      canvas.height = 400;
      canvas.style.width = "600px";
      canvas.style.height = "400px";
      generateImageThumbnail();
      updateFileStatusDisplay();
      updateSideControlStatus();
      redraw();
    } else {
      redraw();
    }
  } else {
    if (activeCropFrameIndex >= pdfCropFrames.length) {
      activeCropFrameIndex = pdfCropFrames.length - 1;
    } else if (activeCropFrameIndex > idx) {
      activeCropFrameIndex--;
    } else if (activeCropFrameIndex < 0) {
      activeCropFrameIndex = 0;
    }
    if (activeMediaViewTab === "image") {
      selectCroppedFrameThumbnail(activeCropFrameIndex);
      generateImageThumbnail();
    } else {
      redraw();
    }
  }
  if (typeof uiToast === "function" && removed) {
    uiToast(`ลบ "${removed.name}" เรียบร้อยแล้ว`, "info");
  }
}

function triggerPdfUpload() {
  switchMediaViewTab("pdf");
  if (fileLoader) {
    fileLoader.setAttribute("accept", "application/pdf,.pdf");
    fileLoader.removeAttribute("multiple");
    fileLoader.value = "";
    fileLoader.click();
  }
}

function triggerImageUpload() {
  switchMediaViewTab("image");
  if (fileLoader) {
    fileLoader.setAttribute("accept", "image/*");
    fileLoader.setAttribute("multiple", "multiple");
    fileLoader.value = "";
    fileLoader.click();
  }
}

function startPdfCropFrameMode() {
  // เมื่อกดปุ่ม "✂️ ตีกรอบใน PDF" ให้สลับไปที่แท็บส่วนแสดงไฟล์ PDF ทันที และเปิดโหมดตีกรอบได้หลายกรอบต่อเนื่อง
  if (activeMediaViewTab !== "pdf") {
    switchMediaViewTab("pdf");
  }
  overlayVisibility.cropFrames = true;
  prevStepMode = "pan";
  setMode("crop_pdf");
  syncOverlayToggleButtonsUI();

  if (!pdfDoc && (!img || !img.src)) {
    if (typeof uiToast === "function") {
      uiToast("สลับไปยังแท็บ ส่วนแสดงไฟล์ PDF แล้ว — กรุณาอัปโหลดไฟล์ PDF เพื่อลากตีกรอบ", "info");
    }
    return;
  }
  if (typeof uiToast === "function") {
    const nextIdx = pdfCropFrames.length + 1;
    uiToast(`โหมดตีกรอบใน PDF: ลากเมาส์ตีกรอบได้หลายกรอบต่อเนื่อง (เริ่มที่ รูปภาพ ${nextIdx}) แล้วกด "💾 บันทึก กรอบรูป"`, "info");
  }
}

function finalizePdfCropFrameBox(x1, y1, x2, y2) {
  const left = Math.max(0, Math.min(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const boxW = Math.abs(x2 - x1);
  const boxH = Math.abs(y2 - y1);

  if (boxW <= 10 || boxH <= 10 || !img || !img.src) {
    // ยังคงอยู่ในโหมดตีกรอบใน PDF เพื่อให้ลากใหม่ได้ต่อเนื่อง
    if (activeMediaViewTab === "pdf") {
      setMode("crop_pdf");
    } else {
      setMode("pan");
    }
    syncOverlayToggleButtonsUI();
    return;
  }

  let croppedDataUrl = img.src;
  let cropImgW = img.width;
  let cropImgH = img.height;
  try {
    const scale = (typeof imgScale === "number" && imgScale > 0) ? imgScale : 1;
    const sx = Math.max(0, Math.round(left / scale));
    const sy = Math.max(0, Math.round(top / scale));
    const sw = Math.max(1, Math.min(img.width - sx, Math.round(boxW / scale)));
    const sh = Math.max(1, Math.min(img.height - sy, Math.round(boxH / scale)));

    const offCanvas = document.createElement("canvas");
    offCanvas.width = sw;
    offCanvas.height = sh;
    const offCtx = offCanvas.getContext("2d");
    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    croppedDataUrl = offCanvas.toDataURL("image/png");
    cropImgW = sw;
    cropImgH = sh;
  } catch (_) {}

  const idx = pdfCropFrames.length + 1;
  const fullW = (img.width * imgScale) || 1;
  const fullH = (img.height * imgScale) || 1;
  const frameObj = {
    id: "frame_" + Date.now() + "_" + idx,
    index: idx,
    source: "pdf_crop",
    pageNum: isPDF ? (pageNum || 1) : 1,
    x: left,
    y: top,
    w: boxW,
    h: boxH,
    normX: left / fullW,
    normY: top / fullH,
    normW: boxW / fullW,
    normH: boxH / fullH,
    // รอบ 30: พิกัดอ้างอิงของกรอบ — ใช้แปลงพิกัดสัดส่วน 0..1 ของ AI กลับเป็นพิกัดภาพเต็ม
    //   imgWidth/imgHeight = ขนาด pixel จริงของ dataUrl (ก่อนย่อ)
    //   _cropImgScale = สเกลของภาพหน้า PDF ตอนตีกรอบ (ต้องเก็บไว้ เพราะ imgScale เปลี่ยนตอนซูม)
    imgWidth: cropImgW,
    imgHeight: cropImgH,
    _cropImgScale: (typeof imgScale === "number" && imgScale > 0) ? imgScale : 1,
    name: `รูปภาพ ${idx}`,
    dataUrl: croppedDataUrl
  };
  pdfCropFrames.push(frameObj);
  activeCropFrameIndex = pdfCropFrames.length - 1;
  savedLongImageSrc = croppedDataUrl;
  savedLongImageFileName = frameObj.name;
  overlayVisibility.cropFrames = true;

  // คงโหมด crop_pdf ไว้เพื่อให้ผู้ใช้ลากตีกรอบถัดไปได้หลายกรอบต่อเนื่องบนหน้า PDF
  setMode("crop_pdf");
  syncOverlayToggleButtonsUI();
  redraw();
  if (typeof uiToast === "function") {
    uiToast(`ตีกรอบ "${frameObj.name}" แล้ว — ลากตีกรอบเพิ่มต่อได้ หรือกด "💾 บันทึก กรอบรูป"`, "success");
  }
}

function saveCropFramesData() {
  const pdfFramesCount = pdfCropFrames.filter(f => f && f.source === "pdf_crop").length;
  if (pdfCropFrames.length === 0 || (pdfFramesCount === 0 && (!img || !img.src))) {
    if (!pdfDoc && (!img || !img.src)) {
      alert("กรุณาอัปโหลดไฟล์ PDF และลากตีกรอบก่อนกดบันทึกกรอบรูป");
    } else {
      setMode("crop_pdf");
      syncOverlayToggleButtonsUI();
      alert("กรุณาลากเมาส์ตีกรอบบนหน้า PDF ก่อนกดบันทึกกรอบรูป");
    }
    return;
  }
  // รอบ 30: ลบการเขียน localStorage "bclc_saved_crop_frames" ทิ้ง — เดิมเขียนแต่ไม่มีโค้ดอ่านกลับ
  //   ตอนนี้กรอบรูปถูกบันทึกลงไฟล์ JSON โปรเจกต์ (saveProjectJSON) แทน

  // บันทึกและเปิดแสดงกรอบรูปไว้ในแท็บส่วนแสดงไฟล์ PDF แล้วสลับกลับมาแท็บส่วนแสดงรูปตัดตามยาวโดยอัตโนมัติ
  overlayVisibility.cropFrames = true;
  setMode("pan");
  syncOverlayToggleButtonsUI();
  redraw();

  if (activeCropFrameIndex < 0 || activeCropFrameIndex >= pdfCropFrames.length) {
    activeCropFrameIndex = pdfCropFrames.length - 1;
  }
  switchMediaViewTab("image");
  alert(`บันทึกกรอบรูปเรียบร้อยแล้ว และเรียงต่อในส่วนแสดงรูปตัดตามยาว (รวม ${pdfCropFrames.length} รูปภาพ)`);
}

// ===== ระบบตั้งค่า AI Popup Modal (ตามรูปที่ 2) =====
// รอบ 35: ยกเลิกการบังคับเปลี่ยนชื่อโมเดล "gpt-6-astra" เป็น "gpt-4o" และยกเลิกข้อความแจ้งเตือนในหน้าตั้งค่า AI
function loadAiSettingsFromStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("bclc_ai_settings_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          aiCurrentSettings.baseUrl = parsed.baseUrl || AI_DEFAULT_BASE_URL;
          const savedModel = String(parsed.model || "").trim();
          aiCurrentSettings.model = savedModel || AI_DEFAULT_MODEL;
          aiCurrentSettings.quality = String(parsed.quality || "1400");
          aiCurrentSettings.apiKey = parsed.apiKey || "";
        }
      } else {
        const legacyKey = localStorage.getItem("bclc_ai_api_key");
        if (legacyKey) aiCurrentSettings.apiKey = legacyKey;
      }
    }
  } catch (_) {}
  return aiCurrentSettings;
}

function getStoredAiPresetsHistory() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("bclc_ai_presets_history_v2");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr;
        }
      }
    }
  } catch (_) {}
  return [];
}

function saveStoredAiPresetsHistory(list) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bclc_ai_presets_history_v2", JSON.stringify(list.slice(0, 8)));
    }
  } catch (_) {}
}

function getStoredAiApiKey() {
  loadAiSettingsFromStorage();
  return aiCurrentSettings.apiKey || "";
}

function selectAiReadQuality(pxVal) {
  const q = String(pxVal || "1400");
  aiCurrentSettings.quality = q;
  ["1400", "2400", "3500"].forEach(val => {
    const btn = document.getElementById("aiQualityOpt" + val);
    if (btn) btn.classList.toggle("selected", val === q);
  });
}

function toggleAiApiKeyVisibility() {
  const input = document.getElementById("aiInputApiKey");
  const eyeBtn = document.getElementById("aiToggleKeyVisibilityBtn");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    if (eyeBtn) eyeBtn.textContent = "🙈";
  } else {
    input.type = "password";
    if (eyeBtn) eyeBtn.textContent = "👁";
  }
}

function renderAiSavedPresetsList() {
  const listEl = document.getElementById("aiSavedPresetsList");
  if (!listEl) return;
  const presets = getStoredAiPresetsHistory();
  if (!presets || presets.length === 0) {
    listEl.innerHTML = '<div class="ai-history-empty">ยังไม่มีค่าที่บันทึกไว้ ค่าที่เคยกรอกจะถูกเก็บไว้ให้กลับมาใช้ได้เอง</div>';
    return;
  }
  listEl.innerHTML = "";
  presets.forEach((p, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ai-preset-chip";
    const qLabel = p.quality === "3500" ? "3500px" : (p.quality === "2400" ? "2400px" : "1400px");
    const maskedKey = p.apiKey ? (" · " + p.apiKey.slice(0, 5) + "***") : "";
    chip.textContent = `${p.model || AI_DEFAULT_MODEL} (${qLabel})${maskedKey}`;
    chip.title = `Base URL: ${p.baseUrl || AI_DEFAULT_BASE_URL}
Model: ${p.model || AI_DEFAULT_MODEL}
Quality: ${qLabel}`;
    chip.onclick = () => applySavedAiPreset(idx);
    listEl.appendChild(chip);
  });
}

function applySavedAiPreset(idx) {
  const presets = getStoredAiPresetsHistory();
  const p = presets[idx];
  if (!p) return;
  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const modelEl = document.getElementById("aiInputModel");
  const keyEl = document.getElementById("aiInputApiKey");
  if (baseUrlEl) baseUrlEl.value = p.baseUrl || AI_DEFAULT_BASE_URL;
  if (modelEl) modelEl.value = p.model || AI_DEFAULT_MODEL;
  if (keyEl) keyEl.value = p.apiKey || "";
  selectAiReadQuality(p.quality || "1400");
  showAiTestFeedback(`โหลดค่าที่เคยใช้ (${p.model || AI_DEFAULT_MODEL} · ${p.quality || "1400"}px) เรียบร้อยแล้ว`, "ok");
}

// รอบ 31: ดูรายชื่อโมเดลที่ใช้ได้จริงจาก API (GET {base}/models)
//   ช่วยแก้ปัญหา "ใส่ชื่อโมเดลผิด" เช่น gpt-6-astra ที่อาจไม่มีจริง
async function fetchAvailableAiModels() {
  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const keyEl = document.getElementById("aiInputApiKey");
  const modelEl = document.getElementById("aiInputModel");
  const listEl = document.getElementById("aiModelsList");
  const btn = document.getElementById("aiFetchModelsBtn");

  const baseUrl = (baseUrlEl && baseUrlEl.value.trim()) ? baseUrlEl.value.trim().replace(/\/+$/, "") : AI_DEFAULT_BASE_URL;
  const apiKey = (keyEl && keyEl.value.trim()) ? keyEl.value.trim() : "";

  if (!apiKey) {
    showAiTestFeedback("กรุณากรอก API key ก่อนดูรายชื่อโมเดล", "err");
    return;
  }
  if (!listEl) return;

  if (btn) { btn.disabled = true; btn.textContent = "⏳ กำลังโหลด..."; }
  listEl.style.display = "block";
  listEl.innerHTML = '<div class="ai-models-empty">กำลังดึงรายชื่อโมเดล...</div>';

  try {
    const res = await fetch(baseUrl + "/models", {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      let detail = "";
      try { detail = await res.text(); } catch (_) {}
      const friendly = (typeof describeAiApiError === "function")
        ? describeAiApiError(res.status, detail, (modelEl && modelEl.value) || "", baseUrl)
        : `API error ${res.status}`;
      listEl.innerHTML = `<div class="ai-models-empty" style="color:#991b1b">❌ ${escapeHtml(friendly)}</div>`;
      return;
    }

    const data = await res.json();
    const ids = (data && Array.isArray(data.data)) ? data.data.map(m => m && m.id).filter(Boolean) : [];

    if (ids.length === 0) {
      listEl.innerHTML = '<div class="ai-models-empty">ไม่พบโมเดลในรายการ (บางเจ้าไม่เปิด /models)</div>';
      return;
    }

    // เรียง: โมเดลที่มี vision (อ่านรูปได้) และ gpt มาก่อน
    ids.sort((a, b) => {
      const score = (s) => {
        const t = String(s).toLowerCase();
        let n = 0;
        if (t.includes('gpt-4o')) n += 10;
        else if (t.includes('gpt-4.1')) n += 9;
        else if (t.includes('gpt-5')) n += 8;
        else if (t.includes('gpt-4')) n += 7;
        else if (t.includes('vision')) n += 6;
        else if (t.includes('gpt')) n += 5;
        else if (t.includes('claude')) n += 4;
        else if (t.includes('gemini')) n += 3;
        return n;
      };
      return score(b) - score(a);
    });

    const current = (modelEl && modelEl.value.trim()) || "";
    const items = ids.map(id => {
      const sel = (id === current) ? ' style="background:#dcfce7;font-weight:bold"' : '';
      return `<button type="button" class="ai-model-item" data-model="${escapeHtml(id)}"${sel}>${escapeHtml(id)}</button>`;
    }).join('');

    listEl.innerHTML = `<div class="ai-models-title">พบ ${ids.length} โมเดล (คลิกเพื่อเลือก)</div>
      <div class="ai-models-items">${items}</div>`;

    listEl.querySelectorAll(".ai-model-item").forEach(btn2 => {
      btn2.onclick = () => {
        const mid = btn2.getAttribute("data-model");
        if (modelEl) modelEl.value = mid;
        listEl.querySelectorAll(".ai-model-item").forEach(x => { x.style.background = ""; x.style.fontWeight = ""; });
        btn2.style.background = "#dcfce7";
        btn2.style.fontWeight = "bold";
        showAiTestFeedback(`เลือกโมเดล: ${mid} (กด "🔌 ทดสอบการเชื่อมต่อ" เพื่อยืนยัน)`, "ok");
      };
    });
  } catch (e) {
    listEl.innerHTML = `<div class="ai-models-empty" style="color:#991b1b">❌ ติดต่อเซิร์ฟเวอร์ไม่ได้: ${escapeHtml((e && e.message) ? e.message : String(e))}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔄 ดูโมเดล"; }
  }
}

function showAiTestFeedback(msg, statusType) {
  const fb = document.getElementById("aiConnectionTestFeedback");
  if (!fb) return;
  if (!msg) {
    fb.style.display = "none";
    fb.textContent = "";
    return;
  }
  fb.style.display = "block";
  fb.className = "ai-test-feedback" + (statusType ? " " + statusType : "");
  fb.textContent = msg;
}

function openAiApiSettingsModal() {
  loadAiSettingsFromStorage();
  const overlay = document.getElementById("aiSettingsModalOverlay");
  if (!overlay) return;

  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const modelEl = document.getElementById("aiInputModel");
  const keyEl = document.getElementById("aiInputApiKey");
  const eyeBtn = document.getElementById("aiToggleKeyVisibilityBtn");

  if (baseUrlEl) baseUrlEl.value = aiCurrentSettings.baseUrl || AI_DEFAULT_BASE_URL;
  if (modelEl) modelEl.value = aiCurrentSettings.model || AI_DEFAULT_MODEL;
  if (keyEl) {
    keyEl.type = "password";
    keyEl.value = aiCurrentSettings.apiKey || "";
  }
  if (eyeBtn) eyeBtn.textContent = "👁";

  selectAiReadQuality(aiCurrentSettings.quality || "1400");
  renderAiSavedPresetsList();

  showAiTestFeedback("", "");

  overlay.classList.add("show");
}

function closeAiApiSettingsModal() {
  const overlay = document.getElementById("aiSettingsModalOverlay");
  if (overlay) overlay.classList.remove("show");
}

function handleAiModalBackdropClick(e) {
  const overlay = document.getElementById("aiSettingsModalOverlay");
  if (e && e.target === overlay) {
    closeAiApiSettingsModal();
  }
}

function saveAiSettingsFromModal() {
  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const modelEl = document.getElementById("aiInputModel");
  const keyEl = document.getElementById("aiInputApiKey");

  const baseUrl = (baseUrlEl && baseUrlEl.value.trim()) ? baseUrlEl.value.trim() : AI_DEFAULT_BASE_URL;
  const model = (modelEl && modelEl.value.trim()) ? modelEl.value.trim() : AI_DEFAULT_MODEL;
  const apiKey = (keyEl && keyEl.value.trim()) ? keyEl.value.trim() : "";
  const quality = aiCurrentSettings.quality || "1400";

  aiCurrentSettings = { baseUrl, model, quality, apiKey };

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bclc_ai_settings_v2", JSON.stringify(aiCurrentSettings));
      localStorage.setItem("bclc_ai_api_key", apiKey);
    }
  } catch (_) {}

  let history = getStoredAiPresetsHistory();
  history = history.filter(item => !(item.baseUrl === baseUrl && item.model === model && item.quality === quality));
  history.unshift({ baseUrl, model, quality, apiKey, savedAt: Date.now() });
  saveStoredAiPresetsHistory(history);
  renderAiSavedPresetsList();

  updateAiWorkingStatusUI(
    apiKey ? `พร้อมใช้ (${model})` : "บันทึกการตั้งค่าแล้ว",
    document.getElementById("aiStatusFrameText") ? document.getElementById("aiStatusFrameText").textContent : "-",
    0,
    false
  );
  showAiTestFeedback(`บันทึกการตั้งค่า (${model} · ${quality}px) เรียบร้อยแล้ว`, "ok");
  if (typeof uiToast === "function") {
    uiToast("บันทึกการตั้งค่า AI เรียบร้อยแล้ว", "success");
  }
}

function clearAiSettingsConfig() {
  aiCurrentSettings = {
    baseUrl: AI_DEFAULT_BASE_URL,
    model: AI_DEFAULT_MODEL,
    quality: "1400",
    apiKey: ""
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("bclc_ai_settings_v2");
      localStorage.removeItem("bclc_ai_api_key");
      localStorage.removeItem("bclc_ai_presets_history_v2");
    }
  } catch (_) {}

  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const modelEl = document.getElementById("aiInputModel");
  const keyEl = document.getElementById("aiInputApiKey");
  if (baseUrlEl) baseUrlEl.value = AI_DEFAULT_BASE_URL;
  if (modelEl) modelEl.value = AI_DEFAULT_MODEL;
  if (keyEl) keyEl.value = "";
  selectAiReadQuality("1400");
  renderAiSavedPresetsList();
  showAiTestFeedback("ล้างการตั้งค่ากลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว", "");
  updateAiWorkingStatusUI("พร้อมทำงาน", "-", 0, false);
}

async function testAiConnectionConfig() {
  const baseUrlEl = document.getElementById("aiInputBaseUrl");
  const modelEl = document.getElementById("aiInputModel");
  const keyEl = document.getElementById("aiInputApiKey");

  const baseUrl = (baseUrlEl && baseUrlEl.value.trim()) ? baseUrlEl.value.trim().replace(/\/+$/, "") : AI_DEFAULT_BASE_URL;
  const model = (modelEl && modelEl.value.trim()) ? modelEl.value.trim() : AI_DEFAULT_MODEL;
  const apiKey = (keyEl && keyEl.value.trim()) ? keyEl.value.trim() : "";

  if (!apiKey) {
    showAiTestFeedback("กรุณากรอก API key ก่อนทดสอบการเชื่อมต่อ", "err");
    return;
  }

  showAiTestFeedback(`กำลังทดสอบการเชื่อมต่อไปยัง ${baseUrl} (Model: ${model})...`, "");
  const endpoint = baseUrl + "/chat/completions";

  // รอบ 30: ทดสอบโดยยิง chat จริง (ข้อความเล็ก ๆ ไม่ต้องส่งรูป)
  //   เดิมแค่ยิง GET /models → ผ่านแม้บัญชีไม่ active / โมเดลไม่มีอยู่จริง
  //   → ตอนนี้เช็คทั้ง key, สิทธิ์ใช้โมเดล และสถานะบัญชี/โควตา
  // รอบ 31: โมเดลรุ่นใหม่ (gpt-5, o3 ฯลฯ) ไม่รองรับ "max_tokens" ต้องใช้
  //   "max_completion_tokens" → ถ้าเจอ error เรื่อง param ลองสลับแล้วยิงซ้ำอัตโนมัติ
  const buildBody = (tokenField) => {
    const body = { model: model, messages: [{ role: "user", content: "ping" }] };
    if (tokenField) body[tokenField] = 16;
    return body;
  };

  try {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(buildBody("max_tokens"))
    });

    // ถ้า error เรื่อง max_tokens → ลองใหม่ด้วย max_completion_tokens
    if (!res.ok && res.status === 400) {
      let peek = "";
      try { peek = await res.clone().text(); } catch (_) {}
      if (/max_tokens|max_completion_tokens|unsupported.*parameter/i.test(peek)) {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify(buildBody("max_completion_tokens"))
        });
      }
    }

    if (res.ok) {
      showAiTestFeedback(`เชื่อมต่อสำเร็จ! (${baseUrl} · ${model} พร้อมใช้งาน)`, "ok");
      return;
    }

    // ไม่สำเร็จ → แปลง error เป็นภาษาไทยที่บอกทางแก้ (ใช้ตัวแปลงเดียวกับตอนอ่านรูป)
    let detail = "";
    try { detail = await res.text(); } catch (_) {}
    const friendly = (typeof describeAiApiError === "function")
      ? describeAiApiError(res.status, detail, model, baseUrl)
      : `API error ${res.status}${detail ? ': ' + detail.slice(0, 300) : ''}`;
    showAiTestFeedback("❌ ทดสอบไม่ผ่าน\n\n" + friendly, "err");
    return;
  } catch (e) {
    // ติดต่อเซิร์ฟเวอร์ไม่ได้เลย (CORS / เน็ต / URL ผิด)
    showAiTestFeedback(
      "❌ ติดต่อเซิร์ฟเวอร์ไม่ได้\n\n" +
      `ปลายทาง: ${endpoint}\n` +
      `สาเหตุ: ${(e && e.message) ? e.message : String(e)}\n\n` +
      "• ตรวจว่า Base URL ถูกต้อง (ต้องเป็น https:// และลงท้ายด้วย /v1)\n" +
      "• ผู้ให้บริการบางเจ้าไม่เปิด CORS จากเบราว์เซอร์ → ใช้งานจากเครื่องที่เปิด CORS ได้",
      "err"
    );
    return;
  }
}

function updateThumbnailElapsedTimeUI(frameIdx, elapsedSec) {
  if (typeof pdfCropFrames !== "undefined" && Array.isArray(pdfCropFrames) && pdfCropFrames[frameIdx]) {
    pdfCropFrames[frameIdx].aiElapsedSec = Number(elapsedSec);
  }
  const card = document.getElementById("thumb-crop-" + (frameIdx + 1));
  if (!card) return;
  let timeSpan = card.querySelector(".thumb-ai-time");
  if (!timeSpan) {
    const label = card.querySelector(".thumbnail-label");
    if (label) {
      timeSpan = document.createElement("span");
      timeSpan.className = "thumb-ai-time";
      label.appendChild(timeSpan);
    }
  }
  if (timeSpan && elapsedSec !== undefined && elapsedSec !== null && !isNaN(Number(elapsedSec))) {
    timeSpan.textContent = `${Number(elapsedSec).toFixed(1)}s`;
    timeSpan.style.display = "inline-block";
  }
}

function updateAiWorkingStatusUI(stateText, frameText, elapsedSec, isRunning) {
  const boxEl = document.getElementById("aiWorkingStatusBox");
  const stEl = document.getElementById("aiStatusStateText");
  const frEl = document.getElementById("aiStatusFrameText");
  const tmEl = document.getElementById("aiStatusTimeText");

  if (boxEl) {
    boxEl.classList.toggle("running", !!isRunning);
    // แสดงหน้าต่างสถานะการทำงานเฉพาะตอนที่กำลังรันอ่านกรอบเท่านั้น
    boxEl.style.display = isRunning ? "flex" : "none";
  }
  if (stEl && stateText !== undefined) stEl.textContent = stateText;
  if (frEl && frameText !== undefined) frEl.textContent = frameText;
  if (tmEl && elapsedSec !== undefined && elapsedSec !== null) {
    tmEl.textContent = `${Number(elapsedSec).toFixed(1)} วินาที`;
  }
}

async function aiReadCurrentFrame() {
  if (isAiReading) {
    alert("AI กำลังทำงานอยู่ กรุณารอสักครู่");
    return false;
  }
  if ((!img || !img.src) && pdfCropFrames.length === 0) {
    alert("กรุณาอัปโหลดรูปภาพ หรือตีกรอบใน PDF ก่อนสั่ง AI อ่านข้อมูล");
    return false;
  }

  isAiReading = true;
  const total = pdfCropFrames.length > 0 ? pdfCropFrames.length : 1;
  const curIdx = (pdfCropFrames.length > 0 && activeCropFrameIndex >= 0 && activeCropFrameIndex < pdfCropFrames.length)
    ? activeCropFrameIndex
    : 0;
  const targetFrame = pdfCropFrames[curIdx] || {
    id: "current_image",
    name: currentFileName || "รูปภาพปัจจุบัน",
    dataUrl: img ? img.src : "",
    imgWidth: (img && img.width) ? img.width : 0,
    imgHeight: (img && img.height) ? img.height : 0
  };
  const frameLabel = `กรอบที่ ${curIdx + 1}/${total} (${targetFrame.name})`;

  // รอบ 42: ลงทะเบียนงานนี้ใน "คิวงาน AI" ก่อนเริ่มอ่าน (ถ้าอ่านไม่สำเร็จจะค้างไว้ให้ทำต่อได้)
  if (typeof addAiCreditQueueItem === 'function') {
    addAiCreditQueueItem(targetFrame.id, targetFrame.name, 'running', '');
  }

  aiStartTimeMs = Date.now();
  if (aiTimerInterval) clearInterval(aiTimerInterval);
  updateAiWorkingStatusUI("กำลังอ่านข้อมูล...", frameLabel, 0.0, true);
  updateThumbnailElapsedTimeUI(curIdx, 0.0);

  aiTimerInterval = setInterval(() => {
    const sec = (Date.now() - aiStartTimeMs) / 1000;
    updateAiWorkingStatusUI("กำลังอ่านข้อมูล...", frameLabel, sec, true);
    updateThumbnailElapsedTimeUI(curIdx, sec);
  }, 100);

  // รอบ 30: เรียก AI จริงผ่าน ai-reader.js (อ่านค่าเป็น JSON ตามโครงสร้างที่แอปนำเข้าได้)
  let result = null;
  let errorMsg = null;
  try {
    result = await aiReadFrameData({
      frameId: targetFrame.id,
      name: targetFrame.name,
      dataUrl: targetFrame.dataUrl,
      frameWidth: targetFrame.imgWidth,
      frameHeight: targetFrame.imgHeight
    });
    // สร้าง overlay (ป้าย/เส้นระดับ/เส้นดินเดิม) + จุดอ้างอิง P1/P2
    buildAiOverlayFromResult(result, {
      frameId: targetFrame.id,
      frameWidth: targetFrame.imgWidth,
      frameHeight: targetFrame.imgHeight
    });
    // รอบ 34: เมื่ออ่านค่าเสร็จให้เซฟค่าลงตารางอัตโนมัติทันที และผูกชุดข้อมูลกับรูปภาพนี้
    if (typeof applyAiResultsToTables === 'function') {
      applyAiResultsToTables([result], { matchExisting: true });
    }
    // รอบ 35: เปลี่ยนชื่อรูปภาพเป็น "ชื่อคูที่อ่านได้" (ทั้งส่วน PDF และส่วนแสดงรูปตัดตามยาว)
    if (result && Array.isArray(result.channels) && result.channels.length > 0) {
      const ch0 = result.channels[0];
      if (typeof applyAiFrameName === 'function') {
        applyAiFrameName(targetFrame.id, ch0.ditch, ch0.canal);
      }
    }
    let matchedChId = (typeof activeChannelId !== 'undefined') ? activeChannelId : 1;
    if (typeof channels !== 'undefined' && Array.isArray(channels)) {
      const byFrame = channels.find(c => c && c._frameId === targetFrame.id);
      if (byFrame) {
        matchedChId = byFrame.id;
        activeChannelId = matchedChId;
      }
    }
    applyAiRefPointsToGroupState({
      frameId: targetFrame.id,
      frameWidth: targetFrame.imgWidth,
      frameHeight: targetFrame.imgHeight
    }, matchedChId);
    if (typeof drawGroundFromTable === 'function') {
      try { drawGroundFromTable(matchedChId, true); } catch (_) {}
    }
    if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
    // เก็บผลอ่านแยกตามกรอบรูป (อัปเดตกรอบเดิมหรือเพิ่มใหม่)
    if (typeof aiLastResults !== 'undefined' && Array.isArray(aiLastResults) && aiLastResults.length > 0) {
      const existIdx = aiLastResults.findIndex(r => r && r.frameId === result.frameId);
      if (existIdx >= 0) aiLastResults[existIdx] = result;
      else aiLastResults.push(result);
    } else {
      aiLastResults = [result];
    }
    if (typeof renderAiResultTab === 'function') renderAiResultTab(aiLastResults);
    if (typeof syncOverlayToggleButtonsUI === 'function') syncOverlayToggleButtonsUI();
  } catch (e) {
    errorMsg = (e && e.message) ? e.message : String(e);
    console.warn('AI อ่านข้อมูลไม่สำเร็จ:', e);
  }

  if (aiTimerInterval) {
    clearInterval(aiTimerInterval);
    aiTimerInterval = null;
  }
  const finalSec = Math.max(0.1, (Date.now() - aiStartTimeMs) / 1000);
  isAiReading = false;
  targetFrame.aiElapsedSec = Number(finalSec.toFixed(1));
  if (result) result.elapsedSec = targetFrame.aiElapsedSec;
  updateThumbnailElapsedTimeUI(curIdx, targetFrame.aiElapsedSec);
  if (typeof renderAiResultTab === 'function' && typeof aiLastResults !== 'undefined') {
    renderAiResultTab(aiLastResults);
  }
  if (errorMsg) {
    updateAiWorkingStatusUI("อ่านไม่สำเร็จ", frameLabel, finalSec, false);
    // รอบ 42: งานที่อ่านไม่สำเร็จ → ค้างไว้ในคิว เพื่อทำต่อได้เมื่อมีเครดิตเพิ่ม
    if (typeof updateAiCreditQueueItem === 'function') {
      updateAiCreditQueueItem(targetFrame.id, targetFrame.name, 'failed', errorMsg);
    }
    alert(`AI อ่านข้อมูล ${frameLabel} ไม่สำเร็จ:\n\n${errorMsg}`);
  } else {
    updateAiWorkingStatusUI("อ่านเสร็จสิ้น", frameLabel, finalSec, false);
    // รอบ 42: อ่านสำเร็จ → ลบออกจากคิว
    if (typeof removeAiCreditQueueItem === 'function') {
      removeAiCreditQueueItem(targetFrame.id, targetFrame.name);
    }
    alert(`AI อ่านข้อมูล ${frameLabel} เสร็จเรียบร้อย (ใช้เวลา ${finalSec.toFixed(1)} วินาที)\nดูผลที่แท็บ "🤖 ผลอ่าน AI" แล้วกดนำเข้าได้เลย`);
  }
  if (typeof redraw === 'function') redraw();
  return !errorMsg;
}

async function aiReadAllFrames() {
  if (isAiReading) {
    alert("AI กำลังทำงานอยู่ กรุณารอสักครู่");
    return;
  }
  if ((!img || !img.src) && pdfCropFrames.length === 0) {
    alert("กรุณาอัปโหลดรูปภาพ หรือตีกรอบใน PDF ก่อนสั่ง AI อ่านทุกกรอบ");
    return;
  }

  const framesToRead = pdfCropFrames.length > 0
    ? pdfCropFrames
    : [{
      id: "current_image",
      name: currentFileName || "รูปภาพที่ 1",
      dataUrl: img ? img.src : "",
      imgWidth: (img && img.width) ? img.width : 0,
      imgHeight: (img && img.height) ? img.height : 0
    }];

  isAiReading = true;
  const total = framesToRead.length;
  aiStartTimeMs = Date.now();
  if (aiTimerInterval) clearInterval(aiTimerInterval);

  let currentReadingLabel = `กรอบที่ 1/${total}`;
  let currentReadingIdx = 0;
  let currentFrameStartMs = Date.now();
  updateAiWorkingStatusUI("กำลังอ่านทุกกรอบ...", currentReadingLabel, 0.0, true);

  aiTimerInterval = setInterval(() => {
    const secTotal = (Date.now() - aiStartTimeMs) / 1000;
    const secFrame = (Date.now() - currentFrameStartMs) / 1000;
    updateAiWorkingStatusUI("กำลังอ่านทุกกรอบ...", currentReadingLabel, secTotal, true);
    updateThumbnailElapsedTimeUI(currentReadingIdx, secFrame);
  }, 100);

  // รอบ 30: อ่านทุกกรอบจริง และเก็บผลไว้ให้นำเข้าในแท็บ "🤖 ผลอ่าน AI"
  const allResults = [];
  const failedFrames = [];
  for (let i = 0; i < total; i++) {
    const fr = framesToRead[i];
    currentReadingIdx = i;
    currentFrameStartMs = Date.now();
    currentReadingLabel = `กรอบที่ ${i + 1}/${total} (${fr.name || ("#" + (i + 1))})`;
    const secNow = (Date.now() - aiStartTimeMs) / 1000;
    updateAiWorkingStatusUI("กำลังอ่านทุกกรอบ...", currentReadingLabel, secNow, true);
    updateThumbnailElapsedTimeUI(i, 0.0);
    // รอบ 42: ลงทะเบียนงานในคิว AI (ถ้าอ่านไม่สำเร็จจะค้างไว้ให้ทำต่อได้เมื่อมีเครดิต)
    if (typeof addAiCreditQueueItem === 'function') {
      addAiCreditQueueItem(fr.id, fr.name, 'running', '');
    }
    try {
      const result = await aiReadFrameData({
        frameId: fr.id,
        name: fr.name,
        dataUrl: fr.dataUrl,
        frameWidth: fr.imgWidth,
        frameHeight: fr.imgHeight
      });
      const frameElapsed = Math.max(0.1, (Date.now() - currentFrameStartMs) / 1000);
      fr.aiElapsedSec = Number(frameElapsed.toFixed(1));
      if (result) result.elapsedSec = fr.aiElapsedSec;
      updateThumbnailElapsedTimeUI(i, fr.aiElapsedSec);
      buildAiOverlayFromResult(result, {
        frameId: fr.id,
        frameWidth: fr.imgWidth,
        frameHeight: fr.imgHeight
      });
      allResults.push(result);
      // รอบ 42: อ่านสำเร็จ → ลบออกจากคิว
      if (typeof removeAiCreditQueueItem === 'function') {
        removeAiCreditQueueItem(fr.id, fr.name);
      }
    } catch (e) {
      const frameElapsed = Math.max(0.1, (Date.now() - currentFrameStartMs) / 1000);
      fr.aiElapsedSec = Number(frameElapsed.toFixed(1));
      updateThumbnailElapsedTimeUI(i, fr.aiElapsedSec);
      failedFrames.push(`${fr.name || ("#" + (i + 1))}: ${(e && e.message) ? e.message : e}`);
      console.warn('AI อ่านกรอบไม่สำเร็จ:', fr.name, e);
      // รอบ 42: อ่านไม่สำเร็จ → ค้างไว้ในคิว
      if (typeof updateAiCreditQueueItem === 'function') {
        updateAiCreditQueueItem(fr.id, fr.name, 'failed', (e && e.message) ? e.message : String(e));
      }
    }
  }

  // รอบ 34: เมื่ออ่านค่าเสร็จให้เซฟค่าลงตารางอัตโนมัติทันทีทุกชุดข้อมูลภาพ
  if (allResults.length > 0 && typeof applyAiResultsToTables === 'function') {
    applyAiResultsToTables(allResults, { matchExisting: true });
    allResults.forEach((res, ri) => {
      const fr = framesToRead.find(f => f && f.id === res.frameId) || framesToRead[ri];
      const ch = (typeof channels !== 'undefined' && Array.isArray(channels))
        ? (channels.find(c => c && c._frameId === res.frameId) || channels[ri])
        : null;
      // รอบ 35: เปลี่ยนชื่อรูปภาพเป็น "ชื่อคูที่อ่านได้"
      if (res && Array.isArray(res.channels) && res.channels.length > 0 && fr) {
        if (typeof applyAiFrameName === 'function') {
          applyAiFrameName(fr.id, res.channels[0].ditch, res.channels[0].canal);
        }
      }
      if (fr && typeof applyAiRefPointsToGroupState === 'function') {
        applyAiRefPointsToGroupState({
          frameId: fr.id,
          frameWidth: fr.imgWidth,
          frameHeight: fr.imgHeight
        }, ch ? ch.id : undefined);
      }
      if (ch && typeof drawGroundFromTable === 'function') {
        try { drawGroundFromTable(ch.id, true); } catch (_) {}
      }
    });
    if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
  }
  aiLastResults = allResults;
  if (typeof renderAiResultTab === 'function') renderAiResultTab(aiLastResults);
  if (typeof syncOverlayToggleButtonsUI === 'function') syncOverlayToggleButtonsUI();

  if (aiTimerInterval) {
    clearInterval(aiTimerInterval);
    aiTimerInterval = null;
  }
  const finalSec = Math.max(0.1, (Date.now() - aiStartTimeMs) / 1000);
  isAiReading = false;
  updateAiWorkingStatusUI(
    failedFrames.length ? "อ่านเสร็จสิ้น (มีบางกรอบไม่สำเร็จ)" : "อ่านครบทุกกรอบแล้ว",
    `ครบ ${total - failedFrames.length}/${total} กรอบ`, finalSec, false);

  let msg = `AI อ่านข้อมูล ${total - failedFrames.length}/${total} กรอบเรียบร้อยแล้ว (ใช้เวลารวม ${finalSec.toFixed(1)} วินาที)`;
  if (failedFrames.length) {
    msg += `\n\nกรอบที่อ่านไม่สำเร็จ:\n- ${failedFrames.join('\n- ')}`;
  }
  msg += `\n\nดูผลที่แท็บ "🤖 ผลอ่าน AI" แล้วกดนำเข้าได้เลย`;
  alert(msg);
  if (typeof redraw === 'function') redraw();
}

function updateSideControlStatus() {
  // รอบ 35: ลบการ์ดสถานะ (โหมด / ชุดข้อมูล / ซูม) ออกจากแท็บขวาแล้ว
  if (thumbnailsSidebar) {
    thumbnailsSidebar.style.display = "flex";
  }
  syncSideControlPanelByMediaTab();
}

// ===== ฟังก์ชันสลับ 3 แท็บย่อย: 1. ส่วนแสดงไฟล์ PDF / 2. ส่วนแสดงรูปตัดตามยาว / 3. ส่วนแสดงรูปตัดตามขวาง =====

function updateCrossSectionCanvasSize() {
  const baseW = Math.max(680, (viewport && viewport.clientWidth > 100) ? (viewport.clientWidth - 12) : 920);
  const baseH = Math.max(420, (viewport && viewport.clientHeight > 100) ? (viewport.clientHeight - 12) : 540);
  crossSectionBaseW = baseW;
  crossSectionBaseH = baseH;
  if (typeof crossSectionZoom !== "number" || !isFinite(crossSectionZoom) || crossSectionZoom < crossSectionMinZoom) {
    crossSectionZoom = 1.0;
  }
  if (crossSectionZoom > crossSectionMaxZoom) {
    crossSectionZoom = crossSectionMaxZoom;
  }
  const logicalW = Math.round(crossSectionBaseW);
  const logicalH = Math.round(crossSectionBaseH);
  renderDPR = computeRenderDPR(logicalW, logicalH);
  canvas.width = Math.round(logicalW * renderDPR);
  canvas.height = Math.round(logicalH * renderDPR);
  canvas.style.width = logicalW + "px";
  canvas.style.height = logicalH + "px";
}

// รอบ 41: เก็บภาพวาด (เส้นดินเดิม / เส้นระดับ / ป้ายข้อมูล) แยกต่อแท็บ
//   เพื่อไม่ให้ภาพที่วาดในแท็บรูปตัดตามยาว ไปโผล่ในแท็บ PDF (และกลับกัน)
var mediaDrawingStateByTab = {
  pdf: { manualGroundLinePoints: [], tableGroundLinePoints: [], canalLevelDrawingLines: [], canvasLabels: [] },
  image: { manualGroundLinePoints: [], tableGroundLinePoints: [], canalLevelDrawingLines: [], canvasLabels: [] }
};

// บันทึกภาพวาดของแท็บปัจจุบันลงช่องเก็บของแท็บนั้น (ก่อนสลับแท็บ)
function saveDrawingStateForTab(tabKey) {
  const targetKey = (tabKey === 'draw') ? 'image' : tabKey;
  if (!targetKey || (targetKey !== 'pdf' && targetKey !== 'image')) return;
  if (typeof mediaDrawingStateByTab === 'undefined') return;
  mediaDrawingStateByTab[targetKey] = {
    manualGroundLinePoints: (typeof manualGroundLinePoints !== 'undefined' && Array.isArray(manualGroundLinePoints)) ? manualGroundLinePoints.slice() : [],
    tableGroundLinePoints: (typeof tableGroundLinePoints !== 'undefined' && Array.isArray(tableGroundLinePoints)) ? tableGroundLinePoints.slice() : [],
    canalLevelDrawingLines: (typeof canalLevelDrawingLines !== 'undefined' && Array.isArray(canalLevelDrawingLines)) ? canalLevelDrawingLines.slice() : [],
    canvasLabels: (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) ? canvasLabels.slice() : []
  };
}

// โหลดภาพวาดของแท็บที่กำลังจะสลับเข้ามา (เพื่อไม่ให้ภาพวาดของแท็บอื่นโผล่)
function restoreDrawingStateForTab(tabKey) {
  const targetKey = (tabKey === 'draw') ? 'image' : tabKey;
  if (!targetKey || (targetKey !== 'pdf' && targetKey !== 'image')) return;
  if (typeof mediaDrawingStateByTab === 'undefined') return;
  const st = mediaDrawingStateByTab[targetKey];
  if (!st) return;
  if (typeof manualGroundLinePoints !== 'undefined') manualGroundLinePoints = st.manualGroundLinePoints.slice();
  if (typeof tableGroundLinePoints !== 'undefined') tableGroundLinePoints = st.tableGroundLinePoints.slice();
  if (typeof canalLevelDrawingLines !== 'undefined') canalLevelDrawingLines = st.canalLevelDrawingLines.slice();
  if (typeof canvasLabels !== 'undefined') canvasLabels = st.canvasLabels.slice();
}

// รอบ 41: บันทึกภาพวาดปัจจุบันลงช่องเก็บของแท็บที่กำลังดูอยู่ (เรียกหลังวาดเส้นเสร็จ)
function syncDrawingStateToCurrentTab() {
  const tab = (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'image';
  saveDrawingStateForTab(tab);
}

// รอบ 41: สลับแท็บ → บันทึกภาพวาดแท็บเดิม แล้วโหลดภาพวาดของแท็บใหม่ (แยกกันจริง ๆ)
function switchMediaViewTab(tabKey) {
  // รอบ 41: เก็บภาพวาดของแท็บเดิมก่อนเปลี่ยน (ป้องกันภาพวาดข้ามแท็บ)
  if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab && activeMediaViewTab !== tabKey) {
    saveDrawingStateForTab(activeMediaViewTab);
  }
  activeMediaViewTab = tabKey;
  // รอบ 41: โหลดภาพวาดของแท็บใหม่ (ถ้ามี) — แท็บ PDF เริ่มต้นไม่มีภาพวาด
  restoreDrawingStateForTab(tabKey);
  ["pdf", "image", "draw"].forEach(k => {
    const btn = document.getElementById("media-tab-" + k);
    if (btn) btn.classList.toggle("active", k === tabKey);
  });

  if (fileLoader) {
    if (tabKey === "pdf") {
      fileLoader.setAttribute("accept", "application/pdf,.pdf");
      fileLoader.removeAttribute("multiple");
    } else if (tabKey === "image") {
      fileLoader.setAttribute("accept", "image/*");
      fileLoader.setAttribute("multiple", "multiple");
    } else {
      fileLoader.setAttribute("accept", "image/*,application/pdf");
    }
  }

  const thumbHeader = document.getElementById("sideThumbnailsHeader");
  if (thumbHeader) {
    if (tabKey === "pdf") thumbHeader.textContent = "📄 หน้า PDF ย่อย";
    else if (tabKey === "image") thumbHeader.textContent = "🖼️ รูปภาพย่อย";
    else thumbHeader.textContent = "📐 ส่วนแสดงรูปตัดขวาง";
  }

  if (tabKey === "pdf") {
    // ส่วนแสดงไฟล์ PDF: ถ้าไม่ได้อัปโหลดไฟล์ PDF ไม่ต้องแสดงอะไร และถ้าเคยอัปโหลดรูปภาพในแท็บอื่น เมื่อกลับมาที่แท็บ PDF ต้องรีเซ็ตเป็นหน้าว่างเหมือนเริ่มต้น
    if (pdfDoc && savedPdfPageImageSrc) {
      isPDF = true;
      currentFileName = savedPdfFileName || currentFileName;
      img = new Image();
      img.onload = () => {
        updateFileStatusDisplay();
        generateThumbnails();
        fitImageToViewportWithPadding(true);
        updateSideControlStatus();
        redraw();
        centerImageInViewport();
      };
      img.src = savedPdfPageImageSrc;
    } else {
      isPDF = false;
      currentFileName = "";
      img = new Image();
      canvas.width = 600;
      canvas.height = 400;
      canvas.style.width = "600px";
      canvas.style.height = "400px";
      const listEl = getThumbnailsListEl();
      if (listEl) listEl.innerHTML = "";
      updateFileStatusDisplay();
      updateSideControlStatus();
      redraw();
    }
    return;
  }

  if (tabKey === "image") {
    // ออกจากโหมดตีกรอบ PDF เมื่อสลับมาแท็บส่วนแสดงรูปตัดตามยาว
    if (currentMode === "crop_pdf") {
      setMode("pan");
    }
    if (pdfCropFrames.length > 0) {
      if (activeCropFrameIndex < 0 || activeCropFrameIndex >= pdfCropFrames.length) {
        activeCropFrameIndex = pdfCropFrames.length - 1;
      }
      // รอบ 30: ใช้ฟังก์ชันร่วมกับ auto-restore ตอนโหลดไฟล์
      loadCropFrameIntoViewer(activeCropFrameIndex);
    } else if (savedLongImageSrc) {
      // กรณีมีรูปภาพค้างอยู่แต่ยังไม่อยู่ในรายการ ให้สร้างเป็น รูปภาพ 1 อัตโนมัติ
      pdfCropFrames.push({
        id: "upload_" + Date.now() + "_1",
        index: 1,
        source: "upload",
        name: "รูปภาพ 1",
        dataUrl: savedLongImageSrc
      });
      activeCropFrameIndex = 0;
      isPDF = false;
      currentFileName = "รูปภาพ 1";
      img = new Image();
      img.onload = () => {
        updateFileStatusDisplay();
        generateImageThumbnail();
        fitImageToViewportWithPadding();
        updateSideControlStatus();
        redraw();
        centerImageInViewport();
      };
      img.src = savedLongImageSrc;
    } else {
      isPDF = false;
      currentFileName = "";
      img = new Image();
      canvas.width = 600;
      canvas.height = 400;
      canvas.style.width = "600px";
      canvas.style.height = "400px";
      generateImageThumbnail();
      updateFileStatusDisplay();
      updateSideControlStatus();
      redraw();
    }
    return;
  }

  if (tabKey === "draw") {
    if (typeof syncTableInputsToChannels === "function") {
      try { syncTableInputsToChannels(); } catch (_) {}
    }
    crossSectionZoom = 1.0;
    crossSectionPanX = 0;
    crossSectionPanY = 0;
    updateCrossSectionCanvasSize();
    if (typeof syncCrossSectionSelectorsUI === "function") syncCrossSectionSelectorsUI();
    updateSideControlStatus();
    redraw();
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    return;
  }
}

// ===== รอบ 34: ซิงก์ 2 ทางระหว่าง "รูปภาพย่อย" กับ "ชุดข้อมูลคูส่งน้ำ" =====
var _isSyncingFrameChannel = false;

function syncChannelSelectionFromFrame(frameIdx) {
  if (_isSyncingFrameChannel) return;
  if (typeof pdfCropFrames === "undefined" || !Array.isArray(pdfCropFrames)) return;
  const fr = pdfCropFrames[frameIdx];
  if (!fr || typeof channels === "undefined" || !Array.isArray(channels) || channels.length === 0) return;

  let targetCh = channels.find(c => c && ((fr.id && c._frameId === fr.id) || (fr.name && c._frameName === fr.name)));
  if (!targetCh && frameIdx >= 0 && frameIdx < channels.length) {
    targetCh = channels[frameIdx];
  }
  if (!targetCh) return;

  _isSyncingFrameChannel = true;
  try {
    activeChannelId = targetCh.id;
    if (typeof activeCrossSectionState !== "undefined" && activeCrossSectionState) {
      activeCrossSectionState.channelId = targetCh.id;
    }
    // ซิงก์จุด P1/P2 ของชุดข้อมูลนี้มาแสดงบนรูปและแถบเครื่องมือ
    const grpKey = "ground_ch_" + targetCh.id;
    const grp = (typeof groundGroupState !== "undefined" && groundGroupState) ? groundGroupState[grpKey] : null;
    if (grp && (grp.p1Ref || grp.p2Ref)) {
      if (grp.p1Ref) refPixels.p1 = { x: grp.p1Ref.x, y: grp.p1Ref.y };
      if (grp.p2Ref) refPixels.p2 = { x: grp.p2Ref.x, y: grp.p2Ref.y };
    } else if (typeof aiRefPoints !== "undefined" && aiRefPoints && fr.id && aiRefPoints[fr.id]) {
      if (typeof applyAiRefPointsToGroupState === "function") {
        applyAiRefPointsToGroupState({ frameId: fr.id, frameWidth: fr.imgWidth, frameHeight: fr.imgHeight }, targetCh.id);
      }
    }
    if (typeof updateTable === "function") updateTable();
    if (typeof updateSideControlStatus === "function") updateSideControlStatus();
  } finally {
    _isSyncingFrameChannel = false;
  }
}

function syncFrameSelectionFromChannel(channelId) {
  if (_isSyncingFrameChannel) return;
  if (typeof pdfCropFrames === "undefined" || !Array.isArray(pdfCropFrames) || pdfCropFrames.length === 0) return;
  if (typeof channels === "undefined" || !Array.isArray(channels)) return;

  const chIdx = channels.findIndex(c => c && c.id === channelId);
  if (chIdx < 0) return;
  const ch = channels[chIdx];

  let frameIdx = pdfCropFrames.findIndex(f => f && ((ch._frameId && f.id === ch._frameId) || (ch._frameName && f.name === ch._frameName)));
  if (frameIdx < 0 && chIdx < pdfCropFrames.length) {
    frameIdx = chIdx;
  }
  if (frameIdx < 0 || frameIdx === activeCropFrameIndex) return;

  _isSyncingFrameChannel = true;
  try {
    selectCroppedFrameThumbnail(frameIdx);
  } finally {
    _isSyncingFrameChannel = false;
  }
}

// ===== ดรอปลิสต์เลือก คลองส่งน้ำ/คูส่งน้ำ และ กม. คูส่งน้ำ สำหรับแท็บส่วนแสดงรูปตัดขวาง (ข้อ 3, 4, 5, 6) =====

function parseKmNumeric(val) {
  if (val === "" || val === null || val === undefined) return NaN;
  if (typeof val === "number") return isFinite(val) ? val : NaN;
  const s = String(val).trim();
  if (!s) return NaN;
  if (typeof parseKmInput === "function") {
    const p = parseKmInput(s);
    if (p !== "" && p !== null && p !== undefined) {
      const n = parseFloat(p);
      if (isFinite(n)) return n;
    }
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

// ซิงก์ค่าที่ผู้ใช้กำลังพิมพ์ค้างอยู่ในตารางด้านล่างเข้าตัวแปรข้อมูลโดยตรง (ไม่เรียก redraw ซ้ำซ้อน)
function readLiveTableInputsForCrossSection() {
  if (typeof document === "undefined" || !document.querySelectorAll) return;
  try {
    if (typeof currentTab !== "undefined") {
      if (currentTab === "ditch" && typeof channels !== "undefined" && Array.isArray(channels)) {
        const inputs = document.querySelectorAll("#dataTable input.table-input");
        inputs.forEach(input => {
          const chIdx = parseInt(input.getAttribute("data-ch"), 10);
          const c = parseInt(input.getAttribute("data-col"), 10);
          if (isNaN(chIdx) || !channels[chIdx]) return;
          const val = input.value;
          if (c === 0) channels[chIdx].canal = val;
          else if (c === 1) channels[chIdx].ditch = val;
          else if (c === 2) channels[chIdx].totalArea = val;
          else if (c === 3) channels[chIdx].waterArea = val;
        });
      } else if (currentTab === "dimension" && typeof dimensionRows !== "undefined" && Array.isArray(dimensionRows)) {
        const inputs = document.querySelectorAll("#dimensionTableBody input.table-input:not([readonly]), #dimensionTableBody input.combobox-input:not([readonly]), #dimensionTableBody select.table-select:not([disabled])");
        inputs.forEach(input => {
          const rIdx = parseInt(input.getAttribute("data-row"), 10);
          const field = input.getAttribute("data-field");
          if (isNaN(rIdx) || !dimensionRows[rIdx] || !field) return;
          const val = input.value;
          if (field === "kmStart" || field === "kmEnd") {
            const k = parseKmNumeric(val);
            dimensionRows[rIdx][field] = isNaN(k) ? "" : k;
          } else if (["q", "slope", "b", "d", "tbl", "tbr"].includes(field)) {
            const num = parseFloat(val);
            dimensionRows[rIdx][field] = isNaN(num) ? "" : num;
          } else {
            dimensionRows[rIdx][field] = val;
          }
        });
      } else if (currentTab === "level" && typeof levelRowsData !== "undefined" && Array.isArray(levelRowsData)) {
        const inputs = document.querySelectorAll("#levelTableBody input.table-input:not([readonly]), #levelTableBody select.table-select:not([disabled])");
        inputs.forEach(input => {
          const rIdx = parseInt(input.getAttribute("data-row"), 10);
          const field = input.getAttribute("data-field");
          if (isNaN(rIdx) || !levelRowsData[rIdx] || !field) return;
          const val = input.value;
          if (field === "customKmStart" || field === "customKmEnd") {
            const k = parseKmNumeric(val);
            levelRowsData[rIdx][field] = isNaN(k) ? "" : k;
          } else if (field === "h") {
            const num = parseFloat(val);
            levelRowsData[rIdx].h = isNaN(num) ? 0.00 : num;
          } else {
            levelRowsData[rIdx][field] = val;
          }
        });
      } else if (currentTab === "ground" && typeof groundRowsData !== "undefined" && Array.isArray(groundRowsData)) {
        const inputs = document.querySelectorAll("#groundTableBody input.table-input:not([readonly])");
        inputs.forEach(input => {
          const gIdx = parseInt(input.getAttribute("data-row"), 10);
          const field = input.getAttribute("data-field");
          if (isNaN(gIdx) || !groundRowsData[gIdx] || !field) return;
          const val = input.value;
          if (field === "km") {
            const k = parseKmNumeric(val);
            groundRowsData[gIdx].km = isNaN(k) ? "" : k;
          } else if (field === "groundElevation") {
            const num = parseFloat(val);
            groundRowsData[gIdx].groundElevation = isNaN(num) ? "" : num.toFixed(2);
          }
        });
      }
    }
  } catch (_) {}
}

// รวมรายการ กม. จากแท็บระดับดินเดิม (groundRowsData) และแท็บระดับคูส่งน้ำ (levelRowsData) เข้าด้วยกัน
function getCombinedKmsForChannel(chId) {
  readLiveTableInputsForCrossSection();
  const targetChId = (chId !== undefined && chId !== null && !isNaN(Number(chId)))
    ? Number(chId)
    : ((typeof activeCrossSectionState !== "undefined" && activeCrossSectionState && activeCrossSectionState.channelId) || activeChannelId || (channels[0] ? channels[0].id : 1));

  const rawKms = [];
  const dimItem = (typeof dimensionRows !== "undefined" && Array.isArray(dimensionRows))
    ? dimensionRows.find(d => d && d.channelId === targetChId)
    : null;

  // 1) ดึง กม. จากแท็บระดับดินเดิม (groundRowsData)
  if (typeof groundRowsData !== "undefined" && Array.isArray(groundRowsData)) {
    groundRowsData.forEach(g => {
      if (!g || g.channelId !== targetChId) return;
      const k = parseKmNumeric(g.km);
      if (!isNaN(k)) rawKms.push(k);
    });
  }

  // 2) ดึง กม. เริ่มต้นและสิ้นสุดจากแท็บระดับคูส่งน้ำ (levelRowsData)
  if (typeof levelRowsData !== "undefined" && Array.isArray(levelRowsData)) {
    const chanLvls = levelRowsData.filter(l => l && l.channelId === targetChId);
    chanLvls.forEach((l, idx) => {
      const ksRaw = (idx === 0 && (l.customKmStart === "" || l.customKmStart === undefined))
        ? ((dimItem && dimItem.kmStart !== undefined) ? dimItem.kmStart : 0)
        : l.customKmStart;
      const keRaw = (l.customKmEnd !== "" && l.customKmEnd !== undefined)
        ? l.customKmEnd
        : (typeof getChannelKmEnd === "function" ? getChannelKmEnd(targetChId) : (dimItem ? dimItem.kmEnd : ""));
      const ks = parseKmNumeric(ksRaw);
      const ke = parseKmNumeric(keRaw);
      if (!isNaN(ks)) rawKms.push(ks);
      if (!isNaN(ke)) rawKms.push(ke);
    });
  }

  // 3) ดึง กม. จากแท็บมิติคูส่งน้ำ (กรณีมีหลายช่วงมิติ)
  if (typeof dimensionRows !== "undefined" && Array.isArray(dimensionRows)) {
    dimensionRows.forEach(d => {
      if (!d || d.channelId !== targetChId) return;
      const ks = parseKmNumeric(d.kmStart);
      const ke = parseKmNumeric(d.kmEnd);
      if (!isNaN(ks)) rawKms.push(ks);
      if (!isNaN(ke)) rawKms.push(ke);
    });
  }

  // 4) ดึง กม. จากจุดเส้นดินเดิมที่ลากไว้บนภาพ (ถ้ามี)
  const extraPts = ((typeof tableGroundLinePoints !== "undefined" && Array.isArray(tableGroundLinePoints) && tableGroundLinePoints.length > 0)
    ? tableGroundLinePoints
    : ((typeof manualGroundLinePoints !== "undefined" && Array.isArray(manualGroundLinePoints)) ? manualGroundLinePoints : []));
  extraPts.forEach(pt => {
    if (pt && pt.channelId === targetChId && typeof pt.xData === "number" && isFinite(pt.xData)) {
      rawKms.push(pt.xData);
    }
  });

  if (rawKms.length === 0) rawKms.push(0);

  rawKms.sort((a, b) => a - b);
  const uniqueKms = [];
  rawKms.forEach(k => {
    if (uniqueKms.length === 0 || Math.abs(k - uniqueKms[uniqueKms.length - 1]) >= 0.001) {
      uniqueKms.push(Number(k.toFixed(3)));
    }
  });
  return uniqueKms;
}

function formatCrossSectionKmOption(kmVal) {
  if (typeof kmHasDecimal === "function" && kmHasDecimal(kmVal) && typeof formatKmDisplayDecimal === "function") {
    return formatKmDisplayDecimal(kmVal);
  }
  if (typeof formatKmDisplay === "function") {
    return formatKmDisplay(kmVal) || "0+000";
  }
  return String(kmVal);
}

function syncCrossSectionSelectorsUI() {
  const chSelect = document.getElementById("crossSectionChannelSelect");
  const kmSelect = document.getElementById("crossSectionKmSelect");

  if (typeof channels === "undefined" || !Array.isArray(channels) || channels.length === 0) return;

  let chId = (activeCrossSectionState && activeCrossSectionState.channelId) || activeChannelId || channels[0].id;
  if (!channels.some(c => c && c.id === chId)) {
    chId = channels[0].id;
  }
  if (activeCrossSectionState) activeCrossSectionState.channelId = chId;

  if (chSelect) {
    let chHtml = "";
    const chSigParts = [];
    channels.forEach(ch => {
      if (!ch) return;
      const label = `${ch.canal || "คลอง"} / คู ${ch.ditch || "-"}`;
      chSigParts.push(`${ch.id}:${label}`);
      chHtml += `<option value="${ch.id}">${escapeHtml(label)}</option>`;
    });
    const chSig = chSigParts.join("|");
    if (chSelect.getAttribute("data-ch-sig") !== chSig || chSelect.children.length === 0) {
      chSelect.innerHTML = chHtml;
      chSelect.setAttribute("data-ch-sig", chSig);
    }
    chSelect.value = String(chId);
  }

  const kms = getCombinedKmsForChannel(chId);
  let curKm = (activeCrossSectionState && !isNaN(parseKmNumeric(activeCrossSectionState.km)))
    ? parseKmNumeric(activeCrossSectionState.km)
    : (kms[0] || 0);

  let matchedKm = kms.find(k => Math.abs(k - curKm) < 0.001);
  if (matchedKm === undefined) {
    matchedKm = kms.reduce((best, k) => (Math.abs(k - curKm) < Math.abs(best - curKm) ? k : best), kms[0] || 0);
  }
  if (activeCrossSectionState) activeCrossSectionState.km = matchedKm;

  if (kmSelect) {
    let kmHtml = "";
    const kmSig = kms.map(k => String(k)).join("|");
    kms.forEach(k => {
      const lbl = `กม. ${formatCrossSectionKmOption(k)}`;
      kmHtml += `<option value="${k}">${escapeHtml(lbl)}</option>`;
    });
    if (kmSelect.getAttribute("data-km-sig") !== kmSig || kmSelect.children.length === 0) {
      kmSelect.innerHTML = kmHtml;
      kmSelect.setAttribute("data-km-sig", kmSig);
    }
    kmSelect.value = String(matchedKm);
  }

  const layerBtnMap = {
    showDims: "btn-toggle-cs-dims",
    showWidths: "btn-toggle-cs-widths",
    showAreas: "btn-toggle-cs-areas",
    showAreaStripping: "btn-toggle-cs-area-strip",
    showAreaExcavation: "btn-toggle-cs-area-excav",
    showAreaCompacted: "btn-toggle-cs-area-compacted",
    showAreaManual: "btn-toggle-cs-area-manual",
    showSummaryTable: "btn-toggle-cs-table"
  };
  Object.keys(layerBtnMap).forEach(k => {
    const btn = document.getElementById(layerBtnMap[k]);
    if (btn && typeof crossSectionLayerVisibility !== "undefined") {
      btn.classList.toggle("active", crossSectionLayerVisibility[k] !== false);
    }
  });
}

function onCrossSectionChannelSelectChange(val) {
  readLiveTableInputsForCrossSection();
  const chId = parseInt(val, 10);
  if (isNaN(chId)) return;
  activeChannelId = chId;
  activeCrossSectionState.channelId = chId;
  const kms = getCombinedKmsForChannel(chId);
  activeCrossSectionState.km = kms.length > 0 ? kms[0] : 0;
  activeCrossSectionState.sourceTab = "dropdown";
  syncCrossSectionSelectorsUI();
  if (typeof syncFrameSelectionFromChannel === "function") {
    syncFrameSelectionFromChannel(chId);
  }
  resetCrossSectionView();
}

function onCrossSectionKmSelectChange(val) {
  readLiveTableInputsForCrossSection();
  const kmNum = parseKmNumeric(val);
  if (isNaN(kmNum)) return;
  activeCrossSectionState.km = kmNum;
  activeCrossSectionState.sourceTab = "dropdown";
  syncCrossSectionSelectorsUI();
  redraw();
}

function stepCrossSectionKm(deltaIndex) {
  readLiveTableInputsForCrossSection();
  const chId = (activeCrossSectionState && activeCrossSectionState.channelId) || activeChannelId || (channels[0] ? channels[0].id : 1);
  const kms = getCombinedKmsForChannel(chId);
  if (!kms || kms.length === 0) return;
  const curKm = (activeCrossSectionState && !isNaN(parseKmNumeric(activeCrossSectionState.km))) ? parseKmNumeric(activeCrossSectionState.km) : kms[0];
  let curIdx = kms.findIndex(k => Math.abs(k - curKm) < 0.001);
  if (curIdx < 0) curIdx = 0;
  const nextIdx = Math.max(0, Math.min(kms.length - 1, curIdx + deltaIndex));
  activeCrossSectionState.km = kms[nextIdx];
  activeCrossSectionState.sourceTab = "dropdown";
  syncCrossSectionSelectorsUI();
  redraw();
}

function onCrossSectionKmSelectKeyDown(e) {
  if (!e) return;
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    stepCrossSectionKm(-1);
  } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    e.preventDefault();
    stepCrossSectionKm(1);
  }
}

function toggleCrossSectionLayer(key) {
  if (!key || typeof crossSectionLayerVisibility === "undefined") return;
  if (key === "showAreas") {
    const nextVal = !(crossSectionLayerVisibility.showAreas !== false);
    crossSectionLayerVisibility.showAreas = nextVal;
    crossSectionLayerVisibility.showAreaStripping = nextVal;
    crossSectionLayerVisibility.showAreaExcavation = nextVal;
    crossSectionLayerVisibility.showAreaCompacted = nextVal;
    crossSectionLayerVisibility.showAreaManual = nextVal;
  } else if (key in crossSectionLayerVisibility) {
    crossSectionLayerVisibility[key] = !crossSectionLayerVisibility[key];
    crossSectionLayerVisibility.showAreas = Boolean(
      crossSectionLayerVisibility.showAreaStripping ||
      crossSectionLayerVisibility.showAreaExcavation ||
      crossSectionLayerVisibility.showAreaCompacted ||
      crossSectionLayerVisibility.showAreaManual
    );
  } else {
    return;
  }
  syncCrossSectionSelectorsUI();
  redraw();
}

function resetCrossSectionView() {
  crossSectionZoom = 1.0;
  crossSectionPanX = 0;
  crossSectionPanY = 0;
  updateCrossSectionCanvasSize();
  redraw();
}

// รองรับการกดลูกศรขึ้น-ลงบนคีย์บอร์ดเมื่ออยู่ในแท็บส่วนแสดงรูปตัดขวาง (เมื่อไม่ได้โฟกัสอยู่ในตารางด้านล่าง)
window.addEventListener("keydown", (e) => {
  if (typeof activeMediaViewTab === "undefined" || activeMediaViewTab !== "draw") return;
  if (!e || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  const tgt = e.target;
  if (tgt && tgt.id === "crossSectionKmSelect") return; // จัดการใน onCrossSectionKmSelectKeyDown แล้ว
  if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT")) return;
  e.preventDefault();
  stepCrossSectionKm(e.key === "ArrowUp" ? -1 : 1);
});

// ===== อัปเดตแถวข้อมูลที่เลือกจากตารางด้านล่างเพื่อเปลี่ยนค่าระดับ/มิติ/กม. ของรูปตัดขวาง =====
function onTableRowInteractionForCrossSection(targetEl) {
  if (!targetEl) return;
  readLiveTableInputsForCrossSection();
  // ข้ามการเปลี่ยน กม. หากคลิกปุ่มย่อ/ขยาย ปุ่มล็อก/แก้ไข หรือแถบเครื่องมือ P1/P2
  if (targetEl.closest && (
    targetEl.closest(".ground-toolbar-row") ||
    targetEl.closest(".btn-collapse-rows") ||
    targetEl.closest(".btn-lock-toggle") ||
    targetEl.closest(".km-btn-group")
  )) {
    if (typeof activeMediaViewTab !== "undefined" && activeMediaViewTab === "draw" && typeof redraw === "function") {
      redraw();
    }
    return;
  }

  const tr = targetEl.closest ? targetEl.closest("tr") : null;
  if (!tr) return;
  const rAttr = targetEl.getAttribute ? targetEl.getAttribute("data-row") : null;
  const chAttr = targetEl.getAttribute ? targetEl.getAttribute("data-ch") : null;
  const fieldAttr = targetEl.getAttribute ? (targetEl.getAttribute("data-field") || "") : "";
  const colAttr = targetEl.getAttribute ? parseInt(targetEl.getAttribute("data-col"), 10) : NaN;
  let rIdx = rAttr !== null ? parseInt(rAttr, 10) : NaN;

  if (isNaN(rIdx)) {
    const anyWithRow = tr.querySelector("[data-row]");
    if (anyWithRow) rIdx = parseInt(anyWithRow.getAttribute("data-row"), 10);
  }
  let chIdx = chAttr !== null ? parseInt(chAttr, 10) : NaN;
  if (isNaN(chIdx)) {
    const anyWithCh = tr.querySelector("[data-ch]");
    if (anyWithCh) chIdx = parseInt(anyWithCh.getAttribute("data-ch"), 10);
  }

  const prevChId = (activeCrossSectionState && activeCrossSectionState.channelId) || activeChannelId;

  if (currentTab === "ditch" && !isNaN(chIdx) && channels[chIdx]) {
    activeChannelId = channels[chIdx].id;
    activeCrossSectionState.channelId = activeChannelId;
    activeCrossSectionState.sourceTab = "ditch";
  } else if (currentTab === "dimension" && !isNaN(rIdx) && dimensionRows[rIdx]) {
    const row = dimensionRows[rIdx];
    const chChanged = (row.channelId !== prevChId);
    activeChannelId = row.channelId;
    activeCrossSectionState.channelId = row.channelId;
    activeCrossSectionState.rowIndex = rIdx;
    activeCrossSectionState.sourceTab = "dimension";
    if (fieldAttr === "kmEnd" || colAttr === 3) {
      const ke = parseKmNumeric(row.kmEnd);
      if (!isNaN(ke)) activeCrossSectionState.km = ke;
    } else if (fieldAttr === "kmStart" || colAttr === 2 || chChanged) {
      const ks = parseKmNumeric(row.kmStart);
      if (!isNaN(ks)) activeCrossSectionState.km = ks;
    }
  } else if (currentTab === "ground" && !isNaN(rIdx) && groundRowsData[rIdx]) {
    const row = groundRowsData[rIdx];
    activeChannelId = row.channelId;
    const gKm = parseKmNumeric(row.km);
    activeCrossSectionState = {
      channelId: row.channelId,
      km: !isNaN(gKm) ? gKm : (activeCrossSectionState.km || 0),
      rowIndex: rIdx,
      sourceTab: "ground"
    };
  } else if (currentTab === "level" && !isNaN(rIdx) && levelRowsData[rIdx]) {
    const row = levelRowsData[rIdx];
    const chChanged = (row.channelId !== prevChId);
    activeChannelId = row.channelId;
    activeCrossSectionState.channelId = row.channelId;
    activeCrossSectionState.rowIndex = rIdx;
    activeCrossSectionState.sourceTab = "level";
    if (fieldAttr === "customKmEnd" || fieldAttr === "bl2" || fieldAttr === "tbl2" || colAttr === 9 || colAttr === 10 || colAttr === 11) {
      const keRaw = (row.customKmEnd !== "" && row.customKmEnd !== undefined)
        ? row.customKmEnd
        : (typeof getChannelKmEnd === "function" ? getChannelKmEnd(row.channelId) : "");
      const ke = parseKmNumeric(keRaw);
      if (!isNaN(ke)) activeCrossSectionState.km = ke;
    } else if (fieldAttr === "customKmStart" || fieldAttr === "bl1" || fieldAttr === "tbl1" || colAttr === 5 || colAttr === 7 || colAttr === 8 || chChanged) {
      const ks = parseKmNumeric(row.customKmStart);
      if (!isNaN(ks)) activeCrossSectionState.km = ks;
    }
  } else if (currentTab === "structure" && !isNaN(rIdx) && structureRowsData[rIdx]) {
    const row = structureRowsData[rIdx];
    activeChannelId = row.channelId;
    const sKm = parseKmNumeric(row.km);
    activeCrossSectionState = {
      channelId: row.channelId,
      km: !isNaN(sKm) ? sKm : (activeCrossSectionState.km || 0),
      rowIndex: rIdx,
      sourceTab: "structure"
    };
  } else if (currentTab === "attachment" && !isNaN(rIdx) && attachmentRowsData[rIdx]) {
    const row = attachmentRowsData[rIdx];
    activeChannelId = row.channelId;
    const aKm = parseKmNumeric(row.km);
    activeCrossSectionState = {
      channelId: row.channelId,
      km: !isNaN(aKm) ? aKm : (activeCrossSectionState.km || 0),
      rowIndex: rIdx,
      sourceTab: "attachment"
    };
  }

  if (typeof syncCrossSectionSelectorsUI === "function") {
    syncCrossSectionSelectorsUI();
  }
  if (typeof syncFrameSelectionFromChannel === "function" && typeof activeChannelId !== "undefined") {
    syncFrameSelectionFromChannel(activeChannelId);
  }
  if (typeof updateSideControlStatus === "function") updateSideControlStatus();
  if (typeof redraw === "function") {
    redraw();
  }
}

// คำนวณพารามิเตอร์และค่าระดับของรูปตัดขวางจาก กม. ที่ผู้ใช้เลือก (ถ้าค่าไหนไม่มีในตารางให้คำนวณ Interpolate อัตโนมัติ)
function computeCrossSectionParams() {
  readLiveTableInputsForCrossSection();
  const chId = (activeCrossSectionState && activeCrossSectionState.channelId) || activeChannelId || (channels[0] ? channels[0].id : 1);
  const chObj = (typeof getChannelById === "function" ? getChannelById(chId) : null) || channels[0] || { canal: "คลอง", ditch: "01" };
  const srcTab = (activeCrossSectionState && activeCrossSectionState.sourceTab) ? activeCrossSectionState.sourceTab : "dropdown";
  const rIdx = (activeCrossSectionState && typeof activeCrossSectionState.rowIndex === "number") ? activeCrossSectionState.rowIndex : 0;
  let kmVal = (activeCrossSectionState && !isNaN(parseKmNumeric(activeCrossSectionState.km)))
    ? parseKmNumeric(activeCrossSectionState.km)
    : 0;

  // 1. หาแถวมิติคูส่งน้ำ (dimensionRows) ที่ครอบคลุม kmVal
  const chanDims = (dimensionRows || []).filter(d => d && d.channelId === chId);
  let dimRow = chanDims.find((d, idx) => {
    const ks = !isNaN(parseKmNumeric(d.kmStart)) ? parseKmNumeric(d.kmStart) : 0;
    const keParsed = parseKmNumeric(d.kmEnd);
    const ke = !isNaN(keParsed) ? keParsed : Infinity;
    if (idx < chanDims.length - 1) return kmVal >= ks - 1e-4 && kmVal < ke - 1e-4;
    return kmVal >= ks - 1e-4 && kmVal <= ke + 1e-4;
  }) || chanDims[0] || { b: 0.35, d: 0.36, type: "VU1", tbl: 0.50, tbr: 0.50, q: 0.03, slope: 4000, kmStart: 0, kmEnd: 100 };

  // 2. สร้างช่วงระดับคูส่งน้ำ (levelRowsData) พร้อมคำนวณค่าที่ยังไม่ได้กดคำนวณในตารางให้อัตโนมัติ
  const chanLvls = (levelRowsData || []).filter(l => l && l.channelId === chId);
  const resolvedIntervals = [];
  let prevKe = !isNaN(parseKmNumeric(dimRow.kmStart)) ? parseKmNumeric(dimRow.kmStart) : 0;
  let prevBl2 = NaN;

  chanLvls.forEach((l, idx) => {
    const ksRaw = (idx === 0 && (l.customKmStart === "" || l.customKmStart === undefined))
      ? (dimRow.kmStart !== undefined ? dimRow.kmStart : 0)
      : l.customKmStart;
    const ksParsed = parseKmNumeric(ksRaw);
    const ks = !isNaN(ksParsed) ? ksParsed : prevKe;

    const keRaw = (l.customKmEnd !== "" && l.customKmEnd !== undefined)
      ? l.customKmEnd
      : (typeof getChannelKmEnd === "function" ? getChannelKmEnd(chId) : "");
    const keParsed = parseKmNumeric(keRaw);
    const dimKeParsed = parseKmNumeric(dimRow.kmEnd);
    const ke = !isNaN(keParsed) ? keParsed : (!isNaN(dimKeParsed) ? dimKeParsed : Math.max(ks + 100, 100));

    const rType = (l.isDynamicRow && l.customType) ? l.customType : (dimRow.type || l.customType || "VU1");
    const rSlope = parseFloat((l.isDynamicRow && l.customSlope !== "" && l.customSlope !== undefined) ? l.customSlope : (dimRow.slope || l.customSlope)) || 4000;
    const hDrop = parseFloat(l.h) || 0;

    let bl1 = parseFloat(l.bl1);
    let bl1FromTable = !isNaN(bl1);
    if (isNaN(bl1) && idx > 0 && !isNaN(prevBl2)) {
      bl1 = prevBl2 - hDrop;
    }

    let bl2 = parseFloat(l.bl2);
    let bl2FromTable = !isNaN(bl2);
    if (isNaN(bl2) && !isNaN(bl1)) {
      bl2 = bl1 - Math.abs(ke - ks) / rSlope;
    } else if (isNaN(bl1) && !isNaN(bl2)) {
      bl1 = bl2 + Math.abs(ke - ks) / rSlope;
    }

    prevKe = ke;
    prevBl2 = bl2;

    resolvedIntervals.push({
      rawRow: l,
      ks,
      ke,
      rType,
      rSlope,
      hDrop,
      bl1,
      bl2,
      bl1FromTable,
      bl2FromTable,
      tbl1: parseFloat(l.tbl1),
      tbl2: parseFloat(l.tbl2)
    });
  });

  // เลือกช่วงระดับคูส่งน้ำที่ครอบคลุม kmVal
  let matchedIv = resolvedIntervals.find((iv, idx) => {
    if (idx < resolvedIntervals.length - 1) {
      return kmVal >= iv.ks - 1e-4 && kmVal < iv.ke - 1e-4;
    }
    return kmVal >= iv.ks - 1e-4 && kmVal <= iv.ke + 1e-4;
  }) || resolvedIntervals[0] || null;

  const typeName = (matchedIv && matchedIv.rType) ? matchedIv.rType : (dimRow.type || "VU1");
  const typeEntry = (typeof ditchTypeDatabase !== "undefined" ? ditchTypeDatabase.find(t => t && t.type === typeName) : null)
    || { type: typeName, b: 0.35, h: 0.50, tw: 0.10, tf: 0.10 };

  const B = (matchedIv && matchedIv.rawRow && matchedIv.rawRow.isDynamicRow && matchedIv.rType !== dimRow.type && !isNaN(parseFloat(typeEntry.b)))
    ? parseFloat(typeEntry.b)
    : ((!isNaN(parseFloat(dimRow.b)) && parseFloat(dimRow.b) > 0) ? parseFloat(dimRow.b) : (parseFloat(typeEntry.b) || 0.35));
  const H = (!isNaN(parseFloat(typeEntry.h)) && parseFloat(typeEntry.h) > 0) ? parseFloat(typeEntry.h) : 0.50;
  const D1Raw = (!isNaN(parseFloat(dimRow.d)) && parseFloat(dimRow.d) > 0) ? parseFloat(dimRow.d) : Math.max(0.20, Number((H - 0.14).toFixed(2)));
  const D1 = Math.min(H, Math.max(0.05, D1Raw));
  const tw = (typeof getDitchTypeThickness === "function") ? getDitchTypeThickness(typeEntry, "tw") : (parseFloat(typeEntry.tw) || 0.10);
  const tf = (typeof getDitchTypeThickness === "function") ? getDitchTypeThickness(typeEntry, "tf") : (parseFloat(typeEntry.tf) || 0.10);
  const tblWidth = (!isNaN(parseFloat(dimRow.tbl)) && parseFloat(dimRow.tbl) >= 0) ? parseFloat(dimRow.tbl) : 0.50;
  const tbrWidth = (!isNaN(parseFloat(dimRow.tbr)) && parseFloat(dimRow.tbr) >= 0) ? parseFloat(dimRow.tbr) : 0.50;
  const slopeVal = (matchedIv && matchedIv.rSlope) ? matchedIv.rSlope : (parseFloat(dimRow.slope) || 4000);

  // 3. หาระดับดินเดิม (groundElev / NGL) จากแท็บระดับดินเดิม — ถ้าไม่มีค่าตรง กม. ให้คำนวณ Interpolate อัตโนมัติ
  const chanGndsRaw = (groundRowsData || []).filter(g =>
    g && g.channelId === chId &&
    !isNaN(parseKmNumeric(g.km)) &&
    g.groundElevation !== "" && g.groundElevation !== null && g.groundElevation !== undefined && !isNaN(parseFloat(g.groundElevation))
  );
  // เรียงตาม กม. และหากมีหลายแถวที่ กม. เดียวกัน ให้ใช้แถวที่มีข้อมูลจริงล่าสุด (ไม่ใช่แถวขอบเขตว่าง)
  const sortedGMap = new Map();
  chanGndsRaw.forEach(g => {
    const kKey = Number(parseKmNumeric(g.km).toFixed(3));
    if (!sortedGMap.has(kKey) || !g.isBoundary) {
      sortedGMap.set(kKey, { km: kKey, groundElevation: parseFloat(g.groundElevation) });
    }
  });
  const sortedG = Array.from(sortedGMap.values()).sort((a, b) => a.km - b.km);

  let groundElev = NaN;
  let isGroundInterpolated = false;

  if (sortedG.length > 0) {
    const exactG = sortedG.find(g => Math.abs(g.km - kmVal) < 0.001);
    if (exactG) {
      groundElev = exactG.groundElevation;
      isGroundInterpolated = false;
    } else if (sortedG.length === 1) {
      const k0 = sortedG[0].km;
      const e0 = sortedG[0].groundElevation;
      groundElev = e0 - ((kmVal - k0) / slopeVal);
      isGroundInterpolated = true;
    } else {
      isGroundInterpolated = true;
      const firstKm = sortedG[0].km;
      const lastKm = sortedG[sortedG.length - 1].km;
      if (kmVal <= firstKm) {
        groundElev = sortedG[0].groundElevation;
      } else if (kmVal >= lastKm) {
        groundElev = sortedG[sortedG.length - 1].groundElevation;
      } else {
        for (let i = 0; i < sortedG.length - 1; i++) {
          const kA = sortedG[i].km;
          const kB = sortedG[i + 1].km;
          const eA = sortedG[i].groundElevation;
          const eB = sortedG[i + 1].groundElevation;
          if (kmVal >= kA && kmVal <= kB) {
            groundElev = (Math.abs(kB - kA) < 1e-6) ? eA : (eA + ((kmVal - kA) / (kB - kA)) * (eB - eA));
            break;
          }
        }
      }
    }
  } else {
    // สำรองจากจุดเส้นดินเดิมที่ลากไว้บนภาพหากยังไม่กดคำนวณลงตาราง
    const linePts = ((tableGroundLinePoints && tableGroundLinePoints.length > 0) ? tableGroundLinePoints : (manualGroundLinePoints || []))
      .filter(pt => pt && pt.channelId === chId && typeof pt.xData === "number" && typeof pt.yData === "number")
      .sort((a, b) => a.xData - b.xData);
    if (linePts.length > 0) {
      isGroundInterpolated = true;
      if (kmVal <= linePts[0].xData) groundElev = linePts[0].yData;
      else if (kmVal >= linePts[linePts.length - 1].xData) groundElev = linePts[linePts.length - 1].yData;
      else {
        for (let i = 0; i < linePts.length - 1; i++) {
          const pA = linePts[i], pB = linePts[i + 1];
          if (kmVal >= pA.xData && kmVal <= pB.xData) {
            groundElev = (Math.abs(pB.xData - pA.xData) < 1e-6) ? pA.yData : (pA.yData + ((kmVal - pA.xData) / (pB.xData - pA.xData)) * (pB.yData - pA.yData));
            break;
          }
        }
      }
    }
  }

  // 4. คำนวณระดับท้องคู (blElev) และระดับหลังคลอง (tblElev) ที่ kmVal — ถ้าไม่มีตรงจุดให้คำนวณ Interpolate อัตโนมัติ
  let blElev = NaN;
  let isLevelInterpolated = false;

  if (matchedIv) {
    const { ks, ke, bl1, bl2, rSlope, bl1FromTable, bl2FromTable } = matchedIv;
    if (Math.abs(kmVal - ks) < 0.001 && !isNaN(bl1)) {
      blElev = bl1;
      isLevelInterpolated = !bl1FromTable;
    } else if (Math.abs(kmVal - ke) < 0.001 && !isNaN(bl2)) {
      blElev = bl2;
      isLevelInterpolated = !bl2FromTable;
    } else if (!isNaN(bl1) && !isNaN(bl2) && ke > ks) {
      const ratio = Math.max(0, Math.min(1, (kmVal - ks) / (ke - ks)));
      blElev = bl1 + ratio * (bl2 - bl1);
      isLevelInterpolated = true;
    } else if (!isNaN(bl1)) {
      blElev = bl1 - Math.max(0, kmVal - ks) / rSlope;
      isLevelInterpolated = true;
    } else if (!isNaN(bl2)) {
      blElev = bl2 + Math.max(0, ke - kmVal) / rSlope;
      isLevelInterpolated = true;
    }
  }

  // สำรองจากเส้นระดับที่วาดไว้หากตารางระดับคูส่งน้ำยังว่าง
  if (isNaN(blElev) && typeof canalLevelDrawingLines !== "undefined" && Array.isArray(canalLevelDrawingLines)) {
    const blLines = canalLevelDrawingLines.filter(l => l && l.channelId === chId && l.type === "BL" && !isNaN(parseFloat(l.v1)) && !isNaN(parseFloat(l.v2)));
    for (let i = 0; i < blLines.length; i++) {
      const ln = blLines[i];
      const k1 = parseFloat(ln.km1) || 0;
      const k2 = parseFloat(ln.km2) || 0;
      if (kmVal >= Math.min(k1, k2) - 1e-4 && kmVal <= Math.max(k1, k2) + 1e-4) {
        const v1 = parseFloat(ln.v1);
        const v2 = parseFloat(ln.v2);
        blElev = Math.abs(k2 - k1) < 1e-6 ? v1 : (v1 + ((kmVal - k1) / (k2 - k1)) * (v2 - v1));
        isLevelInterpolated = true;
        break;
      }
    }
  }

  const hasAnyLevelData = resolvedIntervals.some(iv => !isNaN(iv.bl1) || !isNaN(iv.bl2)) || !isNaN(blElev);

  if (isNaN(blElev)) {
    // อ้างอิงจากค่าระดับดินเดิม ณ จุดเริ่มต้นของสาย (คงที่ ไม่กระโดดตาม groundElev ของแต่ละ กม.)
    const firstKm = sortedG.length > 0 ? sortedG[0].km : (!isNaN(parseKmNumeric(dimRow.kmStart)) ? parseKmNumeric(dimRow.kmStart) : 0);
    const startRefBl = sortedG.length > 0 ? (sortedG[0].groundElevation + 0.340) : 100.000;
    blElev = startRefBl - ((kmVal - firstKm) / slopeVal);
    isLevelInterpolated = true;
  }

  if (isNaN(groundElev)) {
    // อ้างอิงจากค่าระดับ BL. ณ จุดเริ่มต้นของสาย (ไม่ผูกติดกับ blElev ราย กม. เพื่อให้เปลี่ยน กม. แล้วเห็นความต่างของระดับขุด/ถมชัดเจน)
    const firstIv = resolvedIntervals.find(iv => !isNaN(iv.bl1) || !isNaN(iv.bl2));
    const firstKm = firstIv ? firstIv.ks : (!isNaN(parseKmNumeric(dimRow.kmStart)) ? parseKmNumeric(dimRow.kmStart) : 0);
    const firstBl = firstIv ? (!isNaN(firstIv.bl1) ? firstIv.bl1 : firstIv.bl2) : 100.000;
    if (hasAnyLevelData) {
      groundElev = firstBl - 0.340;
    } else {
      // กรณีเริ่มต้นที่ยังไม่ได้กรอกตัวเลขทั้งสองตาราง ให้จำลองความลาดดินเดิมตามระยะ กม. เพื่อให้ทดลองเปลี่ยน กม. แล้วรูปเปลี่ยนตามระยะทันที
      groundElev = (firstBl - 0.340) - ((kmVal - firstKm) * 0.0020);
    }
    isGroundInterpolated = true;
  }

  const tblElev = blElev + H;
  const wlElev = blElev + D1;

  return {
    channelId: chId,
    canalName: chObj.canal || "คลอง",
    ditchName: chObj.ditch || "01",
    km: kmVal,
    kmFormatted: formatCrossSectionKmOption(kmVal),
    typeName,
    B,
    H,
    D1,
    tw,
    tf,
    leanThk: 0.05,
    bermW: 0.30,
    stripDepth: 0.30,
    tblWidth,
    tbrWidth,
    blElev,
    tblElev,
    wlElev,
    groundElev,
    slopeVal,
    isGroundInterpolated,
    isLevelInterpolated,
    sourceTab: srcTab,
    rowIndex: rIdx
  };
}

// ===== คำนวณเรขาคณิต True Scale 1:1 และจุด Node 1-14 ตามหลักการจากไฟล์ที่แนบ (canal_cross_section.html) =====
function intersectSlope1to1WithLevel(x0, z0, targetZ, dirX) {
  const dz = Math.abs(targetZ - z0);
  return {
    x: x0 + dirX * dz,
    z: targetZ,
    slopeRatio: 1.0
  };
}

function calcCrossSectionPolygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    if (!p1 || !p2) return 0;
    sum += (p1.x * p2.elev - p2.x * p1.elev);
  }
  return Math.abs(sum) / 2;
}

// ===== รอบ 43: ปัดเศษแบบเครื่องคิดเลขกดมือ (ยกหลักการจาก "ส่วนที่ 1" ของเวบแนบ canal_cross_section_V2.html) =====
//   ระดับ/ระยะ = ทศนิยม 2 ตำแหน่ง · พื้นที่ = ทศนิยม 3 ตำแหน่ง · ปัดทีละขั้นตอนตามลำดับกดเครื่องคิดเลขมือ
const CS_ROUND_ELEV = 2;
const CS_ROUND_LEN = 2;
const CS_ROUND_AREA = 3;

function csRoundCalc(val, digits) {
  const num = Number(val);
  if (!isFinite(num)) return 0;
  const factor = Math.pow(10, digits);
  const scaled = num * factor;
  // เติม epsilon เล็กน้อยกันปัญหา 1.005 * 100 = 100.49999999999999
  const adjusted = (scaled >= 0)
    ? Math.floor(scaled + 0.5 + 1e-9)
    : Math.ceil(scaled - 0.5 - 1e-9);
  return adjusted / factor;
}
function csRoundElev(val) { return csRoundCalc(val, CS_ROUND_ELEV); }
function csRoundLen(val) { return csRoundCalc(val, CS_ROUND_LEN); }
function csRoundArea(val) { return csRoundCalc(val, CS_ROUND_AREA); }

// พื้นที่หลายเหลี่ยมด้วยสูตรพิกัดจุดยอด (Surveyor's Area Formula)
//   ⚠️ พิกัด X ต้องเป็นค่าเต็มความแม่นยำ (ไม่ปัด) แล้วค่อยปัดผลลัพธ์ทีละขั้นตอน
//      เพราะการปัด X_BOTTOM_STEP (เช่น 0.575) จะทำให้ตัวเลขพื้นที่/ความกว้างเพี้ยนจาก PDF
//   ⚠️ คืน "ค่าดิบ" (ยังไม่ปัดทศนิยม 3 ตำแหน่ง) เพื่อให้ผลรวมคำนวณจากค่าดิบได้
//      (PDF อ้างอิงเช่น ½×(0.95+0.30)×0.65 = 0.40625 → ฝั่งเดียว 0.406 · รวม 0.813)
//      ถ้าปัดย่อยก่อนแล้วบวกกัน จะได้ 0.812 ซึ่งไม่ตรง PDF
function csCalcPolygonAreaRaw(pts) {
  if (!pts || pts.length < 3) return 0;
  let sumForward = 0;
  let sumBackward = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    if (!p1 || !p2) return 0;
    const x1 = Number(p1.x), y1 = Number(p1.elev);
    const x2 = Number(p2.x), y2 = Number(p2.elev);
    // ปัดผลคูณที่ 6 ตำแหน่ง (กันความคลาดเคลื่อนทศนิยมลอย) แล้วปัดผลรวมที่ 6 ตำแหน่ง
    sumForward = csRoundCalc(sumForward + csRoundCalc(x1 * y2, 6), 6);
    sumBackward = csRoundCalc(sumBackward + csRoundCalc(x2 * y1, 6), 6);
  }
  const diff = csRoundCalc(Math.abs(sumForward - sumBackward), 6);
  return csRoundCalc(diff / 2, 6);
}
function csCalcPolygonArea(pts) {
  return csRoundArea(csCalcPolygonAreaRaw(pts));
}

// รอบ 43: ตัด "จุดซ้ำติดกัน" ออกจาก polygon (แก้บั๊ก #7)
//   กรณีพิเศษที่ NGL == ระดับหลังคลอง (EL.TR) พอดี → จุด 1 ซ้ำกับจุด 2 และจุด 14 ซ้ำกับจุด 13
//   ทำให้เส้นขอบดินเดิม (earth polygon) เป็น "หัวแหลม" สูงศูนย์และเส้นขอบตัดกัน
//   → ตัดจุดซ้ำออก ทำให้เส้นขอบเป็นเส้นตรงสะอาด ไม่มีรอยต่อ/เส้นบางเบา
function csDedupePolygonPoints(pts) {
  if (!pts || pts.length < 3) return pts;
  const out = [];
  for (const pt of pts) {
    if (!pt) continue;
    const prev = out.length ? out[out.length - 1] : null;
    // จุดซ้ำติดกัน (เทียบด้วยค่าที่ปัดทศนิยม 6 ตำแหน่ง) → ข้าม
    if (prev && Math.abs(prev.x - pt.x) < 1e-6 && Math.abs(prev.elev - pt.elev) < 1e-6) continue;
    out.push(pt);
  }
  // จุดสุดท้ายซ้ำกับจุดแรก → ตัดทิ้ง
  while (out.length >= 3) {
    const first = out[0], last = out[out.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.elev - last.elev) < 1e-6) out.pop();
    else break;
  }
  return out;
}

// ===== รอบ 43: เอนจินเรขาคณิตรูปตัดขวาง (U-SHAPE) ตามหลักการ "ส่วนที่ 1" =====
//   - ปัดเศษทุกขั้นตอนแบบเครื่องคิดเลขกดมือ
//   - รองรับ "กรณีพิเศษ" (คันดินกว้างเกินจุดตัดเส้นลาด 1:1) → ย้าย Node 1/2/6/7 และ 9/13/14 ของฝั่งนั้น
//   - ชุด Node ของแต่ละพื้นที่งานดินเปลี่ยนตามกรณี (nodesStrippingStr ฯลฯ)
//   - วัดความกว้าง 6-9 / 1-14 ที่ระดับเดียวกันเสมอ (แก้บั๊กวัดเฉียงคนละระดับ)
//   - พื้นที่คอนกรีต/รองพื้น คิดจากสูตร (gross - inner) และ (กว้างรวม x หนา) ไม่ใช่ shoelace
function computeCrossSectionGeometry(p) {
  const SUBBASE_T = p.leanThk || 0.05;
  const BOTTOM_STEP = p.bermW || 0.30;
  const EXTEND_NGL = 1.00;

  // ตรวจว่ามีค่าระดับดินเดิม (NGL) จริงหรือไม่ — ถ้าไม่มี จะไม่คำนวณพื้นที่งานดิน
  const hasValidNgl = !isNaN(Number(p.groundElev)) && isFinite(Number(p.groundElev));

  const paramInvert = csRoundElev(p.blElev);
  // รอบ 43: บังคับขอบเขตพารามิเตอร์ (แก้บั๊ก #3) — กันค่าผิดปกติจากไฟล์นำเข้า/โปรเจกต์เก่า
  //   (ช่องกรอกในแท็บมิติคูส่งน้ำถูกบังคับขอบเขตแล้วที่ updateDimensionField)
  const csClamp = (v, lo, hi, dflt) => {
    const n = Number(v);
    if (!isFinite(n)) return dflt;
    return Math.min(hi, Math.max(lo, n));
  };
  const paramB = csRoundLen(csClamp(p.B, 0.10, 10.00, 0.35));
  const paramH = csRoundLen(csClamp(p.H, 0.10, 10.00, 0.50));
  const paramTBL = csRoundLen(csClamp(p.tblWidth, 0.10, 10.00, 0.50));
  const paramTBR = csRoundLen(csClamp(p.tbrWidth, 0.10, 10.00, 0.50));
  const paramWallT = csRoundLen(csClamp(p.tw, 0.01, 2.00, 0.10));
  const paramBaseT = csRoundLen(csClamp(p.tf, 0.01, 2.00, 0.10));
  const paramSubbaseT = csRoundLen(csClamp(SUBBASE_T, 0.00, 1.00, 0.05));
  const paramTopsoil = csRoundLen(csClamp(p.stripDepth !== undefined ? p.stripDepth : 0.30, 0.00, 2.00, 0.30));
  const ngl = hasValidNgl ? csRoundElev(p.groundElev) : paramInvert;

  const ELEV_CANAL_INVERT = paramInvert;
  const ELEV_SUBBASE_TOP = csRoundElev(ELEV_CANAL_INVERT - paramBaseT);
  const ELEV_SUBBASE_BOT = csRoundElev(ELEV_SUBBASE_TOP - paramSubbaseT);
  const ELEV_TOP_RIM = csRoundElev(ELEV_CANAL_INVERT + paramH);
  const ELEV_BOTTOM_OUTLINE = csRoundElev(Math.min(ELEV_SUBBASE_BOT, ngl - paramTopsoil) - 0.55);

  // ⚠️ พิกัด X เก็บเป็นค่าเต็มความแม่นยำ (ไม่ปัด) เพื่อให้พื้นที่/ความกว้างตรงกับ PDF
  //    (การปัด X_BOTTOM_STEP ที่ 0.575 จะทำให้ตัวเลขเพี้ยน) — ปัดเฉพาะผลลัพธ์ที่แสดงผล
  const X_INNER_WALL = paramB / 2;
  const X_OUTER_WALL = X_INNER_WALL + paramWallT;
  const X_SUBBASE_OUTER = X_OUTER_WALL;
  const X_BOTTOM_STEP = X_SUBBASE_OUTER + BOTTOM_STEP;
  const X_BERM_LEFT = X_OUTER_WALL + paramTBL;
  const X_BERM_RIGHT = X_OUTER_WALL + paramTBR;

  const isHighNGL = ngl >= ELEV_TOP_RIM;
  const xOuterFillLeft = X_BERM_LEFT + Math.max(0, ELEV_TOP_RIM - ngl);
  const xOuterFillRight = X_BERM_RIGHT + Math.max(0, ELEV_TOP_RIM - ngl);
  const xInnerCut = X_BOTTOM_STEP + Math.abs(ngl - ELEV_SUBBASE_BOT);

  const topsoilElev = csRoundElev(ngl - paramTopsoil);
  const xTopsoilInner = Math.max(0, xInnerCut - paramTopsoil);

  // จุดตัดเส้นลาด 1:1 (เส้นสีเหลือง) กับระดับหลังคลอง และเงื่อนไข "กรณีพิเศษ"
  const xIntersectYellowAtRim = X_BOTTOM_STEP + (ELEV_TOP_RIM - ELEV_SUBBASE_BOT);
  const dist63AtRim = Math.abs(xIntersectYellowAtRim - X_OUTER_WALL);
  const isLeftSpecial = isHighNGL && (paramTBL > dist63AtRim);
  const isRightSpecial = isHighNGL && (paramTBR > dist63AtRim);

  let p1, p14, p2, p13;
  const p3 = { x: -X_OUTER_WALL, elev: ELEV_TOP_RIM };
  const p12 = { x: X_OUTER_WALL, elev: ELEV_TOP_RIM };
  const p4 = { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT };
  const p5 = { x: -X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT };
  const p10 = { x: X_BOTTOM_STEP, elev: ELEV_SUBBASE_BOT };
  const p11 = { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT };

  if (isHighNGL) {
    // --- ฝั่งซ้าย ---
    if (isLeftSpecial) {
      p2 = { x: -X_BERM_LEFT, elev: ELEV_TOP_RIM };
      p6 = { x: -xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
      const dxLeft = ngl - ELEV_TOP_RIM;
      p1 = { x: -(X_BERM_LEFT + dxLeft), elev: ngl };
      if (topsoilElev <= ELEV_TOP_RIM) {
        p7 = { x: -xTopsoilInner, elev: topsoilElev };
      } else {
        p7 = { x: -(X_BERM_LEFT + (topsoilElev - ELEV_TOP_RIM)), elev: topsoilElev };
      }
    } else {
      p2 = { x: -xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
      p6 = { x: -xInnerCut, elev: ngl };
      p1 = null;
      p7 = { x: -xTopsoilInner, elev: topsoilElev };
    }
    // --- ฝั่งขวา ---
    if (isRightSpecial) {
      p13 = { x: X_BERM_RIGHT, elev: ELEV_TOP_RIM };
      p9 = { x: xIntersectYellowAtRim, elev: ELEV_TOP_RIM };
      const dxRight = ngl - ELEV_TOP_RIM;
      p14 = { x: X_BERM_RIGHT + dxRight, elev: ngl };
      if (topsoilElev <= ELEV_TOP_RIM) {
        p8 = { x: xTopsoilInner, elev: topsoilElev };
      } else {
        p8 = { x: X_BERM_RIGHT + (topsoilElev - ELEV_TOP_RIM), elev: topsoilElev };
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

  const activeOuterXLeft = (ngl < ELEV_TOP_RIM)
    ? Math.max(xOuterFillLeft, xInnerCut)
    : (isLeftSpecial && p1 ? Math.max(Math.abs(p1.x), xInnerCut) : xInnerCut);
  const activeOuterXRight = (ngl < ELEV_TOP_RIM)
    ? Math.max(xOuterFillRight, xInnerCut)
    : (isRightSpecial && p14 ? Math.max(Math.abs(p14.x), xInnerCut) : xInnerCut);
  const outerGroundXLeft = activeOuterXLeft + EXTEND_NGL;
  const outerGroundXRight = activeOuterXRight + EXTEND_NGL;

  // --- สถานะประเภทงาน (เกณฑ์: ระดับลอกหน้าดิน เทียบระดับท้องรองพื้น) ---
  let statusText = 'งานกึ่งขุดกึ่งถม (Partial)';
  let statusType = 'partial';
  if (topsoilElev > ELEV_SUBBASE_BOT) {
    statusText = 'งานขุดดินลึก (Cut)';
    statusType = 'cut';
  } else if (topsoilElev < ELEV_SUBBASE_BOT) {
    statusText = 'งานถมดินสูง (Fill)';
    statusType = 'fill';
  }

  // --- พื้นที่งานดินแต่ละหมวด (ชุด Node เปลี่ยนตามกรณีพิเศษ) ---
  // A. ขุดลอกหน้าดิน (หนา dt)
  let polyStripping = [];
  let stripNodesLeft = '';
  let stripNodesRight = '';
  if (isLeftSpecial && p1) {
    if (topsoilElev <= ELEV_TOP_RIM) { polyStripping.push(p1, p2, p6, p7); stripNodesLeft = '1-2-6-7'; }
    else { polyStripping.push(p1, p7); stripNodesLeft = '1-7'; }
  } else {
    polyStripping.push(p6, p7);
    stripNodesLeft = '6-7';
  }
  if (isRightSpecial && p14) {
    if (topsoilElev <= ELEV_TOP_RIM) { polyStripping.push(p8, p9, p13, p14); stripNodesRight = '8-9-13-14'; }
    else { polyStripping.push(p8, p14); stripNodesRight = '8-14'; }
  } else {
    polyStripping.push(p8, p9);
    stripNodesRight = '8-9';
  }
  const nodesStrippingStr = `${stripNodesLeft}-${stripNodesRight}`;
  // รอบ 43: ตัดจุดซ้ำติดกัน (แก้บั๊ก #7) — เมื่อ NGL == ระดับหลังคลองพอดี จุด 1==2 และ 14==13
  polyStripping = csDedupePolygonPoints(polyStripping);
  const areaStripping = (paramTopsoil > 0 && hasValidNgl) ? csCalcPolygonArea(polyStripping) : 0;

  // B. ดินถมบดอัดแน่น 85%
  let polyCompacted = [];
  let nodesCompactedStr = '-';
  if (topsoilElev <= ELEV_SUBBASE_BOT) {
    if (isLeftSpecial) { polyCompacted.push(p5, p7); }
    else { polyCompacted.push(p5, p6, p7); }
    if (isRightSpecial) { polyCompacted.push(p8, p10); }
    else { polyCompacted.push(p8, p9, p10); }
    nodesCompactedStr = (isLeftSpecial || isRightSpecial) ? '5-7-8-10' : '5-6-7-8-9-10';
  }
  polyCompacted = csDedupePolygonPoints(polyCompacted);
  const areaCompacted = (topsoilElev <= ELEV_SUBBASE_BOT) ? csCalcPolygonArea(polyCompacted) : 0;

  // C. ดินขุด
  let polyExcavation = [];
  let nodesExcavationStr = '-';
  if (topsoilElev > ELEV_SUBBASE_BOT) {
    let excLeft = '5-7';
    let excRight = '8-10';
    if (isLeftSpecial && topsoilElev > ELEV_TOP_RIM) { polyExcavation.push(p5, p6, p2, p7); excLeft = '5-6-2-7'; }
    else { polyExcavation.push(p5, p7); }
    if (isRightSpecial && topsoilElev > ELEV_TOP_RIM) { polyExcavation.push(p8, p13, p9, p10); excRight = '8-13-9-10'; }
    else { polyExcavation.push(p8, p10); }
    nodesExcavationStr = `${excLeft}-${excRight}`;
  }
  polyExcavation = csDedupePolygonPoints(polyExcavation);
  const areaExcavation = (topsoilElev > ELEV_SUBBASE_BOT) ? csCalcPolygonArea(polyExcavation) : 0;

  // D. ดินถมด้วยแรงคน (ซ้าย / ขวา)
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
  //   รอบ 43: ผลรวมคิดจาก "ค่าดิบ" ของซ้าย+ขวา แล้วค่อยปัดทีเดียว (ตรงกับ PDF)
  //     เช่น กรณี 1: ฝั่งละ 0.40625 → รวมดิบ 0.8125 → ปัด 0.813 (ไม่ใช่ 0.406+0.406 = 0.812)
  polyManualLeft = csDedupePolygonPoints(polyManualLeft);
  polyManualRight = csDedupePolygonPoints(polyManualRight);
  const areaManualLeftRaw = csCalcPolygonAreaRaw(polyManualLeft);
  const areaManualRightRaw = csCalcPolygonAreaRaw(polyManualRight);
  const areaManualLeft = csRoundArea(areaManualLeftRaw);
  const areaManualRight = csRoundArea(areaManualRightRaw);
  const areaManualTotal = csRoundArea(areaManualLeftRaw + areaManualRightRaw);

  // --- คอนกรีตหยาบรองพื้น + U-Section คิดจากสูตร (ไม่ใช่ shoelace) ---
  const subbasePts = [
    { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT },
    { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_BOT },
    { x: X_SUBBASE_OUTER, elev: ELEV_SUBBASE_TOP },
    { x: -X_SUBBASE_OUTER, elev: ELEV_SUBBASE_TOP }
  ];
  //   พื้นที่คอนกรีต = (B + 2·t_w) × (H + t_b) − B×H  (สูตรกดเครื่องคิดเลขมือ)
  //   พื้นที่คอนกรีตหยาบรองพื้น = (B + 2·t_w) × t_s
  const outerWidthRect = csRoundLen(paramB + csRoundLen(2 * paramWallT));
  const outerHeightRect = csRoundLen(paramH + paramBaseT);
  const grossConcreteArea = csRoundArea(outerWidthRect * outerHeightRect);
  const innerWaterwayArea = csRoundArea(paramB * paramH);
  const areaConcrete = csRoundArea(grossConcreteArea - innerWaterwayArea);
  const areaSubbase = (paramSubbaseT > 0) ? csRoundArea(outerWidthRect * paramSubbaseT) : 0;

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

  // --- ความกว้าง: วัดที่ระดับเดียวกันเสมอ (แก้บั๊กวัดเฉียงคนละระดับ) ---
  //   "จุดบนระดับดินเดิม (NGL)" จริงของแต่ละฝั่ง:
  //     - งานถม (NGL ต่ำกว่าหลังคลอง) : จุด 6 / 9 อยู่ที่ระดับ NGL แล้ว → วัด 6-9 ได้ตรง
  //     - งานขุดปกติ                : จุด 6 / 9 อยู่ที่ระดับ NGL เช่นกัน
  //     - งานขุดกรณีพิเศษ            : จุด 6 / 9 ถูกย้ายไประดับหลังคลอง → ต้องใช้จุด 1 / 14 ที่ระดับ NGL
  const pLeftAtNgl = isHighNGL ? (p1 ? p1 : p6) : p6;
  const pRightAtNgl = isHighNGL ? (p14 ? p14 : p9) : p9;
  //   6-9 : ความกว้างขุดลอกหน้าดิน วัดที่ระดับ NGL
  const width69 = hasValidNgl ? csRoundLen(Math.abs(pRightAtNgl.x - pLeftAtNgl.x)) : 0;
  //   1-14 : ความกว้างคันดินด้านล่าง
  //     - งานถม                 : วัดระหว่างจุด 1 / 14 (ท้ายถม) ที่ระดับ NGL
  //     - งานขุดกรณีพิเศษ      : วัดระหว่างจุดบนระดับ NGL (เท่ากับ 6-9)
  //     - งานขุดปกติ (ไม่มีจุด 1/14) : ไม่มีค่า
  const leftOuterTopPt = p1 ? p1 : p2;
  const rightOuterTopPt = p14 ? p14 : p13;
  const width114 = !hasValidNgl ? 0
    : (p1 && p14)
      ? csRoundLen(Math.abs(p14.x - p1.x))
      : (isHighNGL ? width69 : 0);
  const width213 = csRoundLen(Math.abs(p13.x - p2.x));

  return {
    SUBBASE_T,
    BOTTOM_STEP,
    EXTEND_NGL,
    paramInvert,
    paramB,
    paramH,
    paramTBL,
    paramTBR,
    paramWallT,
    paramBaseT,
    paramTopsoil,
    ngl,
    ELEV_CANAL_INVERT,
    ELEV_SUBBASE_TOP,
    ELEV_SUBBASE_BOT,
    ELEV_TOP_RIM,
    ELEV_BOTTOM_OUTLINE,
    X_INNER_WALL,
    X_OUTER_WALL,
    X_SUBBASE_OUTER,
    X_BOTTOM_STEP,
    X_BERM_LEFT,
    X_BERM_RIGHT,
    isHighNGL,
    isLeftSpecial,
    isRightSpecial,
    hasNgl: hasValidNgl,
    statusText: hasValidNgl ? statusText : 'รอค่าระดับ NGL (-)',
    statusType: hasValidNgl ? statusType : 'missing_ngl',
    xOuterFillLeft,
    xOuterFillRight,
    xInnerCut,
    topsoilElev,
    xTopsoilInner,
    activeOuterXLeft,
    activeOuterXRight,
    outerGroundXLeft,
    outerGroundXRight,
    nodes: { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14 },
    nodeLabels: {
      nodesStrippingStr: hasValidNgl ? nodesStrippingStr : '-',
      nodesCompactedStr: hasValidNgl ? nodesCompactedStr : '-',
      nodesExcavationStr: hasValidNgl ? nodesExcavationStr : '-',
      nodesManualLeftStr: hasValidNgl ? nodesManualLeftStr : '-',
      nodesManualRightStr: hasValidNgl ? nodesManualRightStr : '-'
    },
    polyStripping,
    polyCompacted,
    polyExcavation,
    polyManualLeft,
    polyManualRight,
    subbasePts,
    concretePts,
    areaStripping,
    areaCompacted,
    areaExcavation,
    areaManualLeft,
    areaManualRight,
    areaManualTotal,
    areaSubbase,
    areaConcrete,
    width69,
    width114,
    width213,
    leftOuterTopPt,
    rightOuterTopPt
  };
}

// วาดรูปตัดขวางตามหลักการวาดรูปจากไฟล์ที่แนบ (canal_cross_section.html) บนพื้นหลังสีขาว
function drawCrossSectionDiagram(ctx, logicalW, logicalH) {
  const p = computeCrossSectionParams();
  const g = computeCrossSectionGeometry(p);
  const _csVis = (typeof crossSectionLayerVisibility !== "undefined" && crossSectionLayerVisibility) ? crossSectionLayerVisibility : {};

  const showDims = _csVis.showDims !== false;
  const showWidths = _csVis.showWidths !== false;
  const showAreaStripping = _csVis.showAreaStripping !== false && _csVis.showAreas !== false;
  const showAreaExcavation = _csVis.showAreaExcavation !== false && _csVis.showAreas !== false;
  const showAreaCompacted = _csVis.showAreaCompacted !== false && _csVis.showAreas !== false;
  const showAreaManual = _csVis.showAreaManual !== false && _csVis.showAreas !== false;
  const showSummaryTable = _csVis.showSummaryTable !== false;

  const {
    SUBBASE_T, BOTTOM_STEP,
    paramB, paramH, paramTBL, paramTBR, paramWallT, paramBaseT, paramTopsoil, ngl,
    ELEV_CANAL_INVERT, ELEV_SUBBASE_TOP, ELEV_SUBBASE_BOT, ELEV_TOP_RIM, ELEV_BOTTOM_OUTLINE,
    X_INNER_WALL, X_OUTER_WALL, X_SUBBASE_OUTER, X_BOTTOM_STEP, X_BERM_LEFT, X_BERM_RIGHT,
    isHighNGL, isLeftSpecial, isRightSpecial, hasNgl, statusText, statusType,
    xInnerCut, topsoilElev, xTopsoilInner,
    activeOuterXLeft, activeOuterXRight, outerGroundXLeft, outerGroundXRight,
    nodes, nodeLabels, polyStripping, polyCompacted, polyExcavation, polyManualLeft, polyManualRight,
    subbasePts, concretePts,
    areaStripping, areaCompacted, areaExcavation, areaManualLeft, areaManualRight, areaManualTotal,
    areaSubbase, areaConcrete, width69, width114, width213, leftOuterTopPt, rightOuterTopPt
  } = g;
  const { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14 } = nodes;

  ctx.save();
  // พื้นหลังสีขาว (#ffffff) ตามที่ผู้ใช้กำหนด
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);

  // คำนวณสเกล True Scale 1:1 และตำแหน่งกึ่งกลางเหมือนไฟล์แนบ
  const maxElevInSection = Math.max(ngl, ELEV_TOP_RIM);
  const clTopElev = maxElevInSection + 0.45;
  const spanX = Math.max(4.8, (outerGroundXLeft + outerGroundXRight) * 1.15);
  const spanY = Math.max(3.6, (clTopElev - ELEV_BOTTOM_OUTLINE) * 1.35);
  const baseScale = Math.min(logicalW / spanX, logicalH / spanY);
  const scale = baseScale * (typeof crossSectionZoom === "number" && isFinite(crossSectionZoom) ? crossSectionZoom : 1.0);
  const centerElev = ELEV_CANAL_INVERT + paramH * 0.05;
  const panX = (logicalW * 0.5) + (typeof crossSectionPanX === "number" ? crossSectionPanX : 0);
  const panY = (logicalH * 0.5) + centerElev * scale + (typeof crossSectionPanY === "number" ? crossSectionPanY : 0);

  function toScreen(x, elev) {
    return {
      x: panX + x * scale,
      y: panY - elev * scale
    };
  }

  function drawLine(pt1, pt2, color, width, strokeStyle) {
    const s1 = toScreen(pt1.x, pt1.elev);
    const s2 = toScreen(pt2.x, pt2.elev);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(strokeStyle || []);
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.strokeStyle = color || "#475569";
    ctx.lineWidth = width || 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawNodePoint(x, elev, fillColor, label) {
    const pt = toScreen(x, elev);
    const rx = Math.round(pt.x);
    const ry = Math.round(pt.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fillStyle = fillColor || "#f59e0b";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (label) {
      ctx.font = '700 13px "Sarabun", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.lineWidth = 3;
      ctx.strokeText(label, rx, ry - 16);
      ctx.fillStyle = "#15803d";
      ctx.fillText(label, rx, ry - 16);
    }
    ctx.restore();
  }

  function fillCustomPolygon(points, fillColor, strokeColor) {
    if (!points || points.length < 3) return;
    ctx.save();
    ctx.beginPath();
    const s0 = toScreen(points[0].x, points[0].elev);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < points.length; i++) {
      if (!points[i]) continue;
      const s = toScreen(points[i].x, points[i].elev);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAreaLabelOnCanvas(pts, label, areaVal, color) {
    if (!pts || pts.length < 3 || areaVal <= 0.0001) return;
    let cx = 0, cy = 0, validCount = 0;
    for (let i = 0; i < pts.length; i++) {
      if (!pts[i]) continue;
      cx += pts[i].x;
      cy += pts[i].elev;
      validCount++;
    }
    if (validCount < 3) return;
    cx /= validCount;
    cy /= validCount;
    const s = toScreen(cx, cy);
    const rx = Math.round(s.x);
    const ry = Math.round(s.y);
    ctx.save();
    ctx.font = '700 12px "Sarabun", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const txt = `${areaVal.toFixed(3)} m²`;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 3;
    ctx.strokeText(txt, rx, ry);
    ctx.fillStyle = color;
    ctx.fillText(txt, rx, ry);
    ctx.restore();
  }

  function drawArrowHead(x, y, angle, size, color) {
    const sz = size || 6;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.55);
    ctx.lineTo(-sz, sz * 0.55);
    ctx.closePath();
    ctx.fillStyle = color || "#0284c7";
    ctx.fill();
    ctx.restore();
  }

  function drawPillText(text, sx, sy, textColor, bgColor, borderColor) {
    ctx.save();
    ctx.font = '600 12px "Sarabun", Arial, sans-serif';
    let textW = text.length * 6.5;
    try {
      const m = ctx.measureText(text);
      if (m && m.width > 0) textW = m.width;
    } catch (_) {}
    const padX = 8;
    const w = Math.ceil(textW) + padX * 2;
    const h = 22;
    const rx = Math.round(sx);
    const ry = Math.round(sy);
    const x0 = Math.round(rx - w / 2) + 0.5;
    const y0 = Math.round(ry - h / 2) + 0.5;

    ctx.fillStyle = bgColor || "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = borderColor || "#0284c7";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x0, y0, w, h, 5);
    } else {
      ctx.rect(x0, y0, w, h);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor || "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rx, ry + 0.5);
    ctx.restore();
  }

  function drawHorizDim(x1, x2, elevOrigin1, elevOrigin2, offsetPx, labelText, color) {
    const clr = color || "#0284c7";
    const pA = toScreen(x1, elevOrigin1);
    const pB = toScreen(x2, elevOrigin2);
    const x1r = Math.round(pA.x) + 0.5;
    const x2r = Math.round(pB.x) + 0.5;
    const yDim = Math.round(Math.min(pA.y, pB.y) + offsetPx) + 0.5;
    ctx.save();
    ctx.strokeStyle = clr;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1r, Math.round(pA.y));
    ctx.lineTo(x1r, yDim);
    ctx.moveTo(x2r, Math.round(pB.y));
    ctx.lineTo(x2r, yDim);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1r, yDim);
    ctx.lineTo(x2r, yDim);
    ctx.stroke();
    ctx.restore();

    if (Math.abs(x2r - x1r) > 14) {
      const dir = x2r >= x1r ? 0 : Math.PI;
      drawArrowHead(x2r, yDim, dir, 5.5, clr);
      drawArrowHead(x1r, yDim, dir + Math.PI, 5.5, clr);
    }
    drawPillText(labelText, (x1r + x2r) / 2, yDim, "#0f172a", "rgba(255, 255, 255, 0.95)", clr);
  }

  function drawVertDim(xOrigin, elev1, elev2, offsetPx, labelText, color) {
    const clr = color || "#0284c7";
    const pA = toScreen(xOrigin, elev1);
    const pB = toScreen(xOrigin, elev2);
    const y1r = Math.round(pA.y) + 0.5;
    const y2r = Math.round(pB.y) + 0.5;
    const xDim = Math.round(pA.x + offsetPx) + 0.5;
    ctx.save();
    ctx.strokeStyle = clr;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(pA.x), y1r);
    ctx.lineTo(xDim, y1r);
    ctx.moveTo(Math.round(pB.x), y2r);
    ctx.lineTo(xDim, y2r);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xDim, y1r);
    ctx.lineTo(xDim, y2r);
    ctx.stroke();
    ctx.restore();

    if (Math.abs(y2r - y1r) > 14) {
      const dir = y2r >= y1r ? Math.PI / 2 : -Math.PI / 2;
      drawArrowHead(xDim, y2r, dir, 5.5, clr);
      drawArrowHead(xDim, y1r, dir + Math.PI, 5.5, clr);
    }
    drawPillText(labelText, xDim, (y1r + y2r) / 2, "#0f172a", "rgba(255, 255, 255, 0.95)", clr);
  }

  // 1. Earth Solid Fill Polygon (พื้นที่ดินเดิมสีเทาอ่อนสะอาดตาบนพื้นหลังขาว)
  //    รองรับ "กรณีพิเศษ" (คันดินกว้างเกินจุดตัด) → เส้นขอบดินเดิมเบนตาม Node 1/2/6/7 และ 9/13/14 ของฝั่งนั้น
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
  // รอบ 43: ตัดจุดซ้ำติดกันออก (แก้บั๊ก #7 — หัวแหลม/เส้นขอบตัดกันเมื่อ NGL == ระดับหลังคลองพอดี)
  const fullEarthPoly = csDedupePolygonPoints([...rightEarthPoly, ...leftEarthPoly]);
  fillCustomPolygon(fullEarthPoly, "#f1f5f9", "#94a3b8");

  // 2. ระบายสีพื้นที่ตาม 4 ปุ่มสีพื้นที่ (ขุดลอก / ดินขุด / ดินถม 85 / ดินถมแรงคน) และตัวเลขพื้นที่ (ขึ้นกับปุ่มตารางแสดงค่าพื้นที่ด้วย)
  // A. ขุดลอกหน้าดิน (6-7-8-9)
  if (showAreaStripping && areaStripping > 0) {
    fillCustomPolygon(polyStripping, "rgba(245, 158, 11, 0.28)", "rgba(217, 119, 6, 0.85)");
    if (showSummaryTable) drawAreaLabelOnCanvas(polyStripping, "ลอกหน้าดิน", areaStripping, "#b45309");
  }
  // B. ดินถมบดอัดแน่น 85% (5-6-7-8-9-10)
  if (showAreaCompacted && topsoilElev <= ELEV_SUBBASE_BOT && areaCompacted > 0) {
    fillCustomPolygon(polyCompacted, "rgba(20, 184, 166, 0.28)", "rgba(13, 148, 136, 0.85)");
    if (showSummaryTable) drawAreaLabelOnCanvas(polyCompacted, "บดอัด 85%", areaCompacted, "#0f766e");
  }
  // C. ดินขุด (5-7-8-10)
  if (showAreaExcavation && topsoilElev > ELEV_SUBBASE_BOT && areaExcavation > 0) {
    fillCustomPolygon(polyExcavation, "rgba(249, 115, 22, 0.30)", "rgba(234, 88, 12, 0.85)");
    if (showSummaryTable) drawAreaLabelOnCanvas(polyExcavation, "ดินขุด", areaExcavation, "#c2410c");
  }
  // D. ดินถมด้วยแรงคน (ซ้าย & ขวา)
  if (showAreaManual) {
    fillCustomPolygon(polyManualLeft, "rgba(168, 85, 247, 0.26)", "rgba(147, 51, 234, 0.85)");
    fillCustomPolygon(polyManualRight, "rgba(168, 85, 247, 0.26)", "rgba(147, 51, 234, 0.85)");
    if (showSummaryTable) {
      drawAreaLabelOnCanvas(polyManualLeft, "ถมซ้าย", areaManualLeft, "#6b21a8");
      drawAreaLabelOnCanvas(polyManualRight, "ถมขวา", areaManualRight, "#6b21a8");
    }
  }

  // 3. โครงสร้างคอนกรีตหยาบรองพื้น (0.05m) และรางคอนกรีต U-Section
  fillCustomPolygon(subbasePts, "rgba(56, 189, 248, 0.38)", "#0284c7");
  fillCustomPolygon(concretePts, "#cbd5e1", "#0284c7");

  // เส้นชานพัก 0.30 m และลาดดิน 1:1 สีเหลืองเข้ม
  //   (ในกรณีพิเศษ จุด 6/9 อยู่ที่ระดับหลังคลอง จึงวาดเส้น 5-6 และ 10-9 ต่อเนื่องเหมือนเดิม)
  drawLine(p4, p5, "#ca8a04", 2.5);
  drawLine(p11, p10, "#ca8a04", 2.5);
  drawLine(p5, p6, "#ca8a04", 2.5);
  drawLine(p10, p9, "#ca8a04", 2.5);

  // เส้นลาดคันดินสีแดง (3-2 และ 12-13) + เส้นถมดินแรงคน (2-1 / 13-14)
  drawLine(p3, p2, "#dc2626", 2.5);
  drawLine(p12, p13, "#dc2626", 2.5);
  if (p1) drawLine(p2, p1, "#dc2626", 2.5);
  if (p14) drawLine(p13, p14, "#dc2626", 2.5);

  // เส้นระดับดินเดิม (NGL) สีเขียว — วาดเป็นเส้นเดียวต่อเนื่องที่ระดับ NGL จริงของแต่ละฝั่ง
  const nglSpanLeft = p1 ? p1 : p6;
  const nglSpanRight = p14 ? p14 : p9;
  drawLine(nglSpanLeft, nglSpanRight, "#059669", 2, [6, 4]);
  drawLine({ x: -outerGroundXLeft, elev: ngl }, { x: nglSpanLeft.x, elev: ngl }, "#059669", 2.5);
  drawLine({ x: nglSpanRight.x, elev: ngl }, { x: outerGroundXRight, elev: ngl }, "#059669", 2.5);

  const sNglRight = toScreen(outerGroundXRight, ngl);
  ctx.save();
  ctx.font = '700 13px "Sarabun", Arial, sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const nglText = `NGL (${ngl >= 0 ? "+" : ""}${ngl.toFixed(3)} m)`;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 3;
  ctx.strokeText(nglText, Math.round(sNglRight.x) - 4, Math.round(sNglRight.y) - 6);
  ctx.fillStyle = "#047857";
  ctx.fillText(nglText, Math.round(sNglRight.x) - 4, Math.round(sNglRight.y) - 6);
  ctx.restore();

  // เส้นขุดลอกหน้าดินสีน้ำตาล (ตามกรณีพิเศษ)
  const topsoilDashPattern = (topsoilElev > ELEV_SUBBASE_BOT) ? [6, 4] : [];
  if (isLeftSpecial && p1) {
    if (topsoilElev > ELEV_TOP_RIM) drawLine(p1, p7, "#b45309", 2, topsoilDashPattern);
    else drawLine(p6, p7, "#b45309", 2, topsoilDashPattern);
  } else {
    drawLine(p6, p7, "#b45309", 2, topsoilDashPattern);
  }
  if (isRightSpecial && p14) {
    if (topsoilElev > ELEV_TOP_RIM) drawLine(p14, p8, "#b45309", 2, topsoilDashPattern);
    else drawLine(p9, p8, "#b45309", 2, topsoilDashPattern);
  } else {
    drawLine(p9, p8, "#b45309", 2, topsoilDashPattern);
  }
  drawLine(p7, p8, "#b45309", 2, topsoilDashPattern);

  // 4. วาดจุด Node 1-14 พร้อมตัวเลขกำกับ (แสดง/ซ่อนตามปุ่ม "ตารางแสดงค่าพื้นที่")
  if (showSummaryTable) {
    if (p1) drawNodePoint(p1.x, p1.elev, "#f59e0b", "1");
    drawNodePoint(p2.x, p2.elev, (isHighNGL && !isLeftSpecial) ? "#dc2626" : "#16a34a", "2");
    drawNodePoint(p3.x, p3.elev, "#16a34a", "3");
    drawNodePoint(p4.x, p4.elev, "#16a34a", "4");
    drawNodePoint(p5.x, p5.elev, "#16a34a", "5");
    drawNodePoint(p6.x, p6.elev, "#16a34a", "6");
    drawNodePoint(p7.x, p7.elev, "#f59e0b", "7");
    drawNodePoint(p8.x, p8.elev, "#f59e0b", "8");
    drawNodePoint(p9.x, p9.elev, "#16a34a", "9");
    drawNodePoint(p10.x, p10.elev, "#16a34a", "10");
    drawNodePoint(p11.x, p11.elev, "#16a34a", "11");
    drawNodePoint(p12.x, p12.elev, "#16a34a", "12");
    drawNodePoint(p13.x, p13.elev, (isHighNGL && !isRightSpecial) ? "#dc2626" : "#16a34a", "13");
    if (p14) drawNodePoint(p14.x, p14.elev, "#f59e0b", "14");
  }

  // 5. เส้นแนวศูนย์กลาง (CL คูส่งน้ำ)
  drawLine({ x: 0, elev: ELEV_SUBBASE_BOT - 0.5 }, { x: 0, elev: clTopElev }, "#dc2626", 1.5, [6, 4]);
  const topCL = toScreen(0, clTopElev);
  ctx.save();
  ctx.font = '700 13px "Sarabun", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 3;
  ctx.strokeText("CL คูส่งน้ำ", Math.round(topCL.x), Math.round(topCL.y) - 8);
  ctx.fillStyle = "#dc2626";
  ctx.fillText("CL คูส่งน้ำ", Math.round(topCL.x), Math.round(topCL.y) - 8);
  ctx.restore();

  // 6. มิติโครงสร้างและงานดิน (Structural & Earthwork Dimensions Overlay)
  if (showDims) {
    drawHorizDim(-X_INNER_WALL, X_INNER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -34, `B = ${paramB.toFixed(2)} m`, "#0284c7");
    drawHorizDim(-X_OUTER_WALL, -X_INNER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -62, `หนา ${paramWallT.toFixed(2)}`, "#2563eb");
    drawHorizDim(X_INNER_WALL, X_OUTER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -62, `หนา ${paramWallT.toFixed(2)}`, "#2563eb");
    if (!isHighNGL || isLeftSpecial) {
      drawHorizDim(-X_BERM_LEFT, -X_OUTER_WALL, ELEV_TOP_RIM, ELEV_TOP_RIM, -34, `TBL = ${paramTBL.toFixed(2)} m`, "#dc2626");
    }
    if (!isHighNGL || isRightSpecial) {
      drawHorizDim(X_OUTER_WALL, X_BERM_RIGHT, ELEV_TOP_RIM, ELEV_TOP_RIM, -34, `TBR = ${paramTBR.toFixed(2)} m`, "#dc2626");
    }
    drawVertDim(X_INNER_WALL, ELEV_CANAL_INVERT, ELEV_TOP_RIM, -38, `H = ${paramH.toFixed(2)} m`, "#0284c7");
    drawVertDim(X_OUTER_WALL, ELEV_SUBBASE_TOP, ELEV_CANAL_INVERT, 52, `พื้น ${paramBaseT.toFixed(2)} m`, "#2563eb");
    drawVertDim(X_OUTER_WALL, ELEV_SUBBASE_BOT, ELEV_SUBBASE_TOP, 126, `หยาบ ${SUBBASE_T.toFixed(2)} m`, "#0369a1");
    drawHorizDim(p4.x, p5.x, ELEV_SUBBASE_BOT, ELEV_SUBBASE_BOT, 26, `ชานพัก ${BOTTOM_STEP.toFixed(2)} m`, "#b45309");
    drawHorizDim(p11.x, p10.x, ELEV_SUBBASE_BOT, ELEV_SUBBASE_BOT, 26, `ชานพัก ${BOTTOM_STEP.toFixed(2)} m`, "#b45309");
    if (paramTopsoil > 0) {
      drawVertDim(p8.x, topsoilElev, ngl, 54, `ลอกดิน ${paramTopsoil.toFixed(2)} m`, "#d97706");
    }
    const sInvert = toScreen(0, ELEV_CANAL_INVERT);
    drawPillText(`ท้องคู (BL.) +${ELEV_CANAL_INVERT.toFixed(3)} m`, sInvert.x, sInvert.y - 12, "#0369a1", "rgba(240, 249, 255, 0.96)", "#0284c7");
    const sRim = toScreen(0, ELEV_TOP_RIM);
    drawPillText(`หลังคลอง +${ELEV_TOP_RIM.toFixed(3)} m`, sRim.x, sRim.y - 88, "#1e293b", "rgba(248, 250, 252, 0.96)", "#475569");
    const sSubBot = toScreen(0, ELEV_SUBBASE_BOT);
    drawPillText(`ท้องรองพื้น +${ELEV_SUBBASE_BOT.toFixed(3)} m`, sSubBot.x, sSubBot.y + 18, "#0369a1", "rgba(240, 249, 255, 0.96)", "#0284c7");
  }

  // 7. ความกว้างขุดลอกหน้าดิน (จุด 6-9) และความกว้างคันดินด้านล่าง (จุด 1-14) ด้านล่างรูป
  if (showWidths) {
    const sBottomOutline = toScreen(0, ELEV_BOTTOM_OUTLINE);
    const sLowestActive = toScreen(0, Math.min(ELEV_SUBBASE_BOT, topsoilElev, ngl));
    const baseBottomY = Math.max(sBottomOutline.y, sLowestActive.y + 45);
    const yDim69 = Math.round(baseBottomY + 28) + 0.5;
    const yDim114 = Math.round(baseBottomY + 62) + 0.5;

    function drawBottomWidthDim(ptLeft, ptRight, yDimScreen, labelText, color) {
      const s1 = toScreen(ptLeft.x, ptLeft.elev);
      const s2 = toScreen(ptRight.x, ptRight.elev);
      const x1r = Math.round(s1.x) + 0.5;
      const x2r = Math.round(s2.x) + 0.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x1r, Math.round(s1.y));
      ctx.lineTo(x1r, yDimScreen);
      ctx.moveTo(x2r, Math.round(s2.y));
      ctx.lineTo(x2r, yDimScreen);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1r, yDimScreen);
      ctx.lineTo(x2r, yDimScreen);
      ctx.stroke();
      ctx.restore();

      if (Math.abs(x2r - x1r) > 14) {
        const dir = x2r >= x1r ? 0 : Math.PI;
        drawArrowHead(x2r, yDimScreen, dir, 5.5, color);
        drawArrowHead(x1r, yDimScreen, dir + Math.PI, 5.5, color);
      }
      drawPillText(labelText, (x1r + x2r) / 2, yDimScreen, "#0f172a", "rgba(255, 255, 255, 0.96)", color);
    }

    // ความกว้าง 6-9 : วัดที่ระดับ NGL จริงของแต่ละฝั่ง (ใช้จุด 1/14 เมื่อมีกรณีพิเศษ)
    const dimLeftPt = (isHighNGL && p1) ? p1 : p6;
    const dimRightPt = (isHighNGL && p14) ? p14 : p9;
    drawBottomWidthDim(dimLeftPt, dimRightPt, yDim69, `ความกว้างขุดลอกหน้าดิน (6-9) = ${width69.toFixed(2)} m`, "#db2777");
    if (p1 || p14) {
      const lblLeft = p1 ? "1" : "2";
      const lblRight = p14 ? "14" : "13";
      drawBottomWidthDim(leftOuterTopPt, rightOuterTopPt, yDim114, `ความกว้างคันดินด้านล่าง (${lblLeft}-${lblRight}) = ${width114.toFixed(2)} m`, "#e11d48");
    } else {
      drawBottomWidthDim(p2, p13, yDim114, `ความกว้างคันดินด้านล่าง (ไม่มีจุด 1-14 | ช่วง 2-13 = ${width213.toFixed(2)} m)`, "#e11d48");
    }
  }

  // 8. ตารางแสดงค่าพื้นที่ (Area Summary Card) มุมซ้ายบน (ปรับธีมสว่างให้เข้ากับพื้นหลังสีขาว)
  if (showSummaryTable) {
    const cardX = 10;
    const cardY = 12;
    const cardW = 292;
    const rowH = 18;
    const rows = [
      { dot: "#f59e0b", name: "ขุดลอกหน้าดิน", node: nodeLabels.nodesStrippingStr, val: areaStripping.toFixed(3), clr: "#b45309" },
      { dot: "#14b8a6", name: "ดินถมบดอัดแน่น 85%", node: nodeLabels.nodesCompactedStr, val: areaCompacted.toFixed(3), clr: "#0f766e" },
      { dot: "#f97316", name: "ดินขุด", node: nodeLabels.nodesExcavationStr, val: areaExcavation.toFixed(3), clr: "#c2410c" },
      { dot: "#a855f7", name: "ดินถมด้วยแรงคน (ซ้าย)", node: nodeLabels.nodesManualLeftStr, val: areaManualLeft.toFixed(3), clr: "#7e22ce" },
      { dot: "#a855f7", name: "ดินถมด้วยแรงคน (ขวา)", node: nodeLabels.nodesManualRightStr, val: areaManualRight.toFixed(3), clr: "#7e22ce" },
      { dot: "", name: "รวมดินถมด้วยแรงคน", node: "-", val: areaManualTotal.toFixed(3), clr: "#6b21a8", bold: true },
      { dot: "#0284c7", name: "โครงสร้างคอนกรีต", node: "U-Section", val: areaConcrete.toFixed(3), clr: "#0369a1" },
      { dot: "#38bdf8", name: `คอนกรีตหยาบรองพื้น (${SUBBASE_T.toFixed(2)}m)`, node: "4-11", val: areaSubbase.toFixed(3), clr: "#0284c7" },
      { dot: "#db2777", name: "ความกว้างขุดลอกหน้าดิน", node: "6-9", val: `${width69.toFixed(2)} m`, clr: "#be185d", bold: true },
      { dot: "#e11d48", name: "ความกว้างคันดินด้านล่าง", node: "1-14", val: (p1 || p14) ? `${width114.toFixed(2)} m` : "- (ขุดลึก)", clr: "#be123c", bold: true }
    ];
    const cardH = 68 + rows.length * rowH;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(cardX, cardY, cardW, cardH, 10);
    else ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 11.5px "Sarabun", Arial, sans-serif';
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.fillText(`ตารางแสดงค่าพื้นที่ (กม. ${p.kmFormatted})`, cardX + 10, cardY + 18);
    ctx.font = '400 10.5px "Sarabun", Arial, sans-serif';
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.fillText("หน่วย: ตร.ม. (m²)", cardX + cardW - 10, cardY + 18);

    // สถานะประเภทงาน: เกณฑ์จากระดับลอกหน้าดิน (topsoilElev) เทียบระดับท้องรองพื้น (แก้บั๊กป้ายไม่ตรงกับปริมาณงานจริง)
    const statusStr = statusText;
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(cardX + 8, cardY + 25, cardW - 16, 18);
    ctx.font = '600 10.5px "Sarabun", Arial, sans-serif';
    ctx.fillStyle = (statusType === "cut") ? "#b45309" : (statusType === "fill") ? "#047857" : "#0369a1";
    ctx.textAlign = "left";
    ctx.fillText(statusStr, cardX + 12, cardY + 37);
    ctx.fillStyle = "#047857";
    ctx.textAlign = "right";
    ctx.fillText(`BL. +${ELEV_CANAL_INVERT.toFixed(2)} | NGL +${ngl.toFixed(2)}`, cardX + cardW - 12, cardY + 37);

    // Table header
    const thY = cardY + 56;
    ctx.font = '600 10.5px "Sarabun", Arial, sans-serif';
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText("รายการพื้นที่", cardX + 10, thY);
    ctx.textAlign = "center";
    ctx.fillText("จุด Node", cardX + 178, thY);
    ctx.textAlign = "right";
    ctx.fillText("พื้นที่ (m²)", cardX + cardW - 10, thY);

    rows.forEach((r, idx) => {
      const ry = cardY + 73 + idx * rowH;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cardX + 8, ry - 12);
      ctx.lineTo(cardX + cardW - 8, ry - 12);
      ctx.stroke();

      if (r.dot) {
        ctx.beginPath();
        ctx.arc(cardX + 14, ry - 3.5, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = r.dot;
        ctx.fill();
      }
      ctx.font = (r.bold ? "700 " : "500 ") + '11px "Sarabun", Arial, sans-serif';
      ctx.fillStyle = r.bold ? r.clr : "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText(r.name, cardX + 22, ry);

      ctx.font = '400 10px "Sarabun", Arial, sans-serif';
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(r.node, cardX + 178, ry);

      ctx.font = '700 11px "Sarabun", Arial, sans-serif';
      ctx.fillStyle = r.clr;
      ctx.textAlign = "right";
      ctx.fillText(r.val, cardX + cardW - 10, ry);
    });
    ctx.restore();
  }

  if (typeof window !== "undefined") {
    window.__lastCrossSectionParams = p;
    window.__lastCrossSectionLayerState = { showDims, showWidths, showAreaStripping, showAreaExcavation, showAreaCompacted, showAreaManual, showSummaryTable, nodesDrawn: showSummaryTable };
    window.__lastCrossSectionGeometry = g;
    window.__lastCrossSectionScale = { scaleX: scale, scaleY: scale, ratio: 1.0 };
    window.__lastCrossSectionFrame = { frameX: 0, frameY: 0, frameW: logicalW, frameH: logicalH, drawAreaH: logicalH, footerH: 0 };
    window.__lastCrossSectionTextBoxes = [];
    window.__lastCrossSectionSegments = [];
    window.__lastCrossSectionCollisionCount = 0;
  }

  ctx.restore();
}

// รอบ 30: โหลดกรอบรูปเข้า canvas (ใช้ร่วมกันทั้งคลิก thumbnail, สลับแท็บ และ auto-restore ตอนโหลดไฟล์)
//   → รวบโค้ดที่เคยซ้ำ 3 จุด ให้เป็นที่เดียว
async function loadCropFrameIntoViewer(idx) {
  const fr = pdfCropFrames[idx];
  if (!fr || !fr.dataUrl) return false;
  activeCropFrameIndex = idx;
  savedLongImageSrc = fr.dataUrl;
  savedLongImageFileName = fr.name || `รูปภาพ ${idx + 1}`;
  isPDF = false;
  currentFileName = savedLongImageFileName;

  await new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      img = im;
      updateFileStatusDisplay();
      generateImageThumbnail();
      fitImageToViewportWithPadding(true);
      if (typeof resyncCanvasLabelsForActiveFrame === "function") resyncCanvasLabelsForActiveFrame();
      if (typeof syncChannelSelectionFromFrame === "function") syncChannelSelectionFromFrame(idx);
      updateSideControlStatus();
      redraw();
      centerImageInViewport();
      resolve(true);
    };
    im.onerror = () => resolve(false);
    im.src = fr.dataUrl;
  });
  return true;
}

function selectCroppedFrameThumbnail(idx) {
  const fr = pdfCropFrames[idx];
  if (!fr || !fr.dataUrl) return;
  activeCropFrameIndex = idx;
  savedLongImageSrc = fr.dataUrl;
  savedLongImageFileName = fr.name || `รูปภาพ ${idx + 1}`;
  document.querySelectorAll("#pdfThumbnailsList .thumbnail-card").forEach((c, i) => {
    c.classList.toggle("active", i === idx);
  });
  updateAiWorkingStatusUI("พร้อมอ่านกรอบนี้", `${fr.name} (${idx + 1}/${pdfCropFrames.length})`, 0.0, false);
  if (typeof syncChannelSelectionFromFrame === "function") syncChannelSelectionFromFrame(idx);

  if (activeMediaViewTab === "image") {
    isPDF = false;
    currentFileName = savedLongImageFileName;
    img = new Image();
    img.onload = () => {
      updateFileStatusDisplay();
      fitImageToViewportWithPadding(true);
      if (typeof resyncCanvasLabelsForActiveFrame === "function") resyncCanvasLabelsForActiveFrame();
      updateSideControlStatus();
      redraw();
      centerImageInViewport();
    };
    img.src = fr.dataUrl;
  }
}

function generateImageThumbnail() {
  const listEl = getThumbnailsListEl();
  if (!listEl) return;
  const leftSide = getLeftThumbnailsSidebarEl();
  if (leftSide && activeMediaViewTab !== "draw") leftSide.style.display = "flex";
  if (thumbnailsSidebar) thumbnailsSidebar.style.display = "flex";
  listEl.innerHTML = "";

  if (pdfCropFrames.length === 0 && savedLongImageSrc && activeMediaViewTab === "image") {
    pdfCropFrames.push({
      id: "upload_" + Date.now() + "_1",
      index: 1,
      source: "upload",
      name: "รูปภาพ 1",
      dataUrl: savedLongImageSrc
    });
    activeCropFrameIndex = 0;
  }

  if (pdfCropFrames.length > 0 && activeMediaViewTab === "image") {
    renumberLongitudinalItems();
    if (activeCropFrameIndex < 0 || activeCropFrameIndex >= pdfCropFrames.length) {
      activeCropFrameIndex = 0;
    }
    pdfCropFrames.forEach((fr, idx) => {
      const card = document.createElement("div");
      card.className = "thumbnail-card square-thumb" + (activeCropFrameIndex === idx ? " active" : "");
      card.id = "thumb-crop-" + (idx + 1);
      card.onclick = () => selectCroppedFrameThumbnail(idx);

      const squareBox = document.createElement("div");
      squareBox.className = "thumb-square-box";

      const thumbImg = document.createElement("img");
      thumbImg.className = "thumb-img-preview";
      thumbImg.src = fr.dataUrl || (img ? img.src : "");
      thumbImg.alt = fr.name || ("รูปภาพ " + (idx + 1));
      squareBox.appendChild(thumbImg);

      card.appendChild(squareBox);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "thumb-delete-btn";
      delBtn.title = `ลบ ${fr.name || ("รูปภาพ " + (idx + 1))}`;
      delBtn.innerText = "✕";
      delBtn.onclick = (e) => deleteLongitudinalItem(idx, e);
      card.appendChild(delBtn);

      const label = document.createElement("div");
      label.className = "thumbnail-label";
      const nameSpan = document.createElement("span");
      nameSpan.className = "thumb-name-text";
      nameSpan.innerText = fr.name || ("รูปภาพ " + (idx + 1));
      label.appendChild(nameSpan);
      const timeSpan = document.createElement("span");
      timeSpan.className = "thumb-ai-time";
      if (fr.aiElapsedSec !== undefined && fr.aiElapsedSec !== null && !isNaN(Number(fr.aiElapsedSec))) {
        timeSpan.innerText = `${Number(fr.aiElapsedSec).toFixed(1)}s`;
        timeSpan.style.display = "inline-block";
      } else {
        timeSpan.style.display = "none";
      }
      label.appendChild(timeSpan);
      card.appendChild(label);

      listEl.appendChild(card);
    });
    return;
  }

  listEl.innerHTML = '<div class="thumb-empty-hint">ยังไม่มีรูปภาพย่อย</div>';
}


let isDraggingMag = false;
let magDragStartX = 0, magDragStartY = 0;

// ===== HiDPI / Canvas Resolution : แก้ภาพเบลอบนจอความละเอียดสูง =====
const MAG_SIZE = 234;          // ขนาดแว่นขยายจริงบนจอ (logical px) ต้องตรงกับ CSS #magnifier
const MAX_RENDER_DPR = 2;      // เพดาน devicePixelRatio ที่ยอมให้เรนเดอร์ (กันหน่วยความจำบวม)
const MAX_CANVAS_DIM = 8192;   // เพดานด้านยาวของ bitmap canvas

let renderDPR = 1;             // ค่า DPR ที่ใช้จริงกับ canvas หลัก (อัปเดตใน updateCanvasSize)

function getDeviceDPR() {
  return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
}

function computeRenderDPR(logicalW, logicalH) {
  let dpr = getDeviceDPR();
  // ⚠️ เพดาน bitmap ของ canvas: ถ้าซูมลึกจนด้านยาวเกิน MAX_CANVAS_DIM ต้องลด dpr ลง "ต่ำกว่า 1" ได้
  //    (ภาพจะนุ่มขึ้นแต่ยังแสดงถูกตำแหน่ง — ดีกว่าปล่อยให้ canvas ใหญ่เกินเพดานเบราว์เซอร์แล้วจอว่าง)
  if (logicalW > 0) dpr = Math.min(dpr, MAX_CANVAS_DIM / logicalW);
  if (logicalH > 0) dpr = Math.min(dpr, MAX_CANVAS_DIM / logicalH);
  return Math.max(0.05, dpr);        // เพดานล่าง กัน bitmap เล็กเกินจนภาพหาย
}

function applyMagnifierCanvasResolution() {
  const dpr = getDeviceDPR();
  magCanvas.width = MAG_SIZE * dpr;
  magCanvas.height = MAG_SIZE * dpr;
  magCanvas.style.width = MAG_SIZE + 'px';
  magCanvas.style.height = MAG_SIZE + 'px';
}
applyMagnifierCanvasResolution();

magnifierDragBar.addEventListener('mousedown', (e) => {
  isDraggingMag = true;
  magDragStartX = e.clientX - magnifierBox.offsetLeft;
  magDragStartY = e.clientY - magnifierBox.offsetTop;
  document.body.style.userSelect = 'none';
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingMag) return;
  let newLeft = e.clientX - magDragStartX;
  let newTop = e.clientY - magDragStartY;
  
  newLeft = Math.max(10, Math.min(window.innerWidth - magnifierBox.offsetWidth - 20, newLeft));
  newTop = Math.max(10, Math.min(window.innerHeight - magnifierBox.offsetHeight - 20, newTop));

  magnifierBox.style.left = `${newLeft}px`;
  magnifierBox.style.top = `${newTop}px`;
});

window.addEventListener('mouseup', () => {
  if (isDraggingMag) {
    isDraggingMag = false;
    document.body.style.userSelect = '';
  }
});

let isPanning = false;
let isZoomWindow = false;
let startX, startY, scrollLeft, scrollTop;
let mouseDownX = 0, mouseDownY = 0;
let hasMovedMouse = false;
let zoomStartX = 0, zoomStartY = 0;
let suppressNextCanvasClick = false; // กลืนคลิกที่เบราว์เซอร์ยิงตามหลังการซูม win (กัน P1/P2 กระโดด)

// ===== การหมุนภาพ =====
// ปุ่ม "หมุนภาพ" กดแต่ละครั้ง = หมุน 90° ตามเข็มนาฬิกา โดยใช้ "จุดศูนย์กลางรูปปัจจุบัน" เป็นจุดหมุน
//   กดครั้งที่ 1 -> 90° · ครั้งที่ 2 -> 180° · ครั้งที่ 3 -> 270° · ครั้งที่ 4 -> กลับมา 0°
//   (มีผลเหมือน "หมุนกลับ" ด้วย เพราะวนครบ 4 ครั้งจะกลับสู่แนวเดิม)
// ปุ่ม Reset ซูม จะรีเซ็ตการหมุนกลับเป็น 0° ด้วย
let imageRotation = 0;

function rotateImageView() {
  if (!img.src || !img.width || !img.height) {
    alert('ยังไม่มีภาพให้หมุน — กรุณาอัปโหลดไฟล์ก่อน');
    return;
  }
  const oldLogicalW = img.width * imgScale;
  const oldLogicalH = img.height * imgScale;

  if (imageRotation === 0) {
    imageRotation = (imageRotation + 90) % 360;
    syncRotationButtonLabel();
    // หมุนภาพจริง (การถอดรหัสเป็นแบบ async) → ต้องหมุนพิกัด overlay + fit + วาดใหม่ "หลังภาพพร้อมใช้"
    applyRotationToImage(90, () => {
      rotateOverlayPixels(90, oldLogicalW, oldLogicalH);
      if (!isPDF && typeof generateImageThumbnail === 'function') generateImageThumbnail();
      fitImageToViewportWithPadding();
      redraw();
      centerImageInViewport();
    });
  } else {
    // หมุนกลับสู่แนวเดิม (0°)
    const delta = -imageRotation;
    imageRotation = 0;
    syncRotationButtonLabel();
    applyRotationToImage(delta, () => {
      rotateOverlayPixels(delta, oldLogicalW, oldLogicalH);
      if (!isPDF && typeof generateImageThumbnail === 'function') generateImageThumbnail();
      fitImageToViewportWithPadding();
      redraw();
      centerImageInViewport();
    });
  }
}

// หมุนพิกัดของ overlay ทั้งหมด (P1/P2 · เส้นดินเดิม · เส้นระดับ) ให้ตามการหมุนภาพ
//   w,h = ขนาดพิกัดที่มองเห็น (logical px) ของภาพ "ก่อนหมุน"
//   สูตรเดียวกับ applyRotationToImage(): 90° → (h-y, x) · 180° → (w-x, h-y) · 270° → (y, w-x)
//   (จากนั้น fitImageToViewportWithPadding() จะ scale พิกัดเหล่านี้ต่อให้เองผ่าน scaleOverlayPixels)
function rotateOverlayPixels(deltaDeg, w, h) {
  let deg = ((deltaDeg % 360) + 360) % 360;
  if (deg === 0) return;
  const map = (x, y) => {
    if (deg === 90) return { x: h - y, y: x };
    if (deg === 180) return { x: w - x, y: h - y };
    return { x: y, y: w - x };      // 270°
  };
  const rotatedRefs = new Set();
  ['p1', 'p2'].forEach(k => {
    if (refPixels[k] && !rotatedRefs.has(refPixels[k])) {
      rotatedRefs.add(refPixels[k]);
      let p = map(refPixels[k].x, refPixels[k].y);
      refPixels[k].x = p.x; refPixels[k].y = p.y;
    }
  });
  if (typeof groundGroupState !== 'undefined' && groundGroupState) {
    Object.values(groundGroupState).forEach(grp => {
      if (!grp) return;
      ['p1Ref', 'p2Ref'].forEach(rk => {
        if (grp[rk] && !rotatedRefs.has(grp[rk])) {
          rotatedRefs.add(grp[rk]);
          let p = map(grp[rk].x, grp[rk].y);
          grp[rk].x = p.x; grp[rk].y = p.y;
        }
      });
    });
  }
  manualGroundLinePoints.forEach(pt => { let p = map(pt.x, pt.y); pt.x = p.x; pt.y = p.y; });
  tableGroundLinePoints.forEach(pt => { let p = map(pt.x, pt.y); pt.x = p.x; pt.y = p.y; });
  canalLevelDrawingLines.forEach(l => {
    let a = map(l.x1, l.y1), b = map(l.x2, l.y2);
    l.x1 = a.x; l.y1 = a.y; l.x2 = b.x; l.y2 = b.y;
  });
  // รอบ 30: หมุนป้ายข้อมูลบนภาพตามภาพ + หมุนมุมของป้ายอาคารให้ยังอ่านได้
  const normMap = (nx, ny) => {
    if (deg === 90) return { x: 1 - ny, y: nx };
    if (deg === 180) return { x: 1 - nx, y: 1 - ny };
    return { x: ny, y: 1 - nx };
  };
  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
    canvasLabels.forEach(l => {
      if (!l) return;
      if (typeof l.x === 'number' && typeof l.y === 'number') {
        let p = map(l.x, l.y);
        l.x = p.x; l.y = p.y;
      }
      if (typeof l.x2 === 'number' && typeof l.y2 === 'number') {
        let p2 = map(l.x2, l.y2);
        l.x2 = p2.x; l.y2 = p2.y;
      }
      if (typeof l.normX === 'number' && typeof l.normY === 'number') {
        let np = normMap(l.normX, l.normY);
        l.normX = np.x; l.normY = np.y;
      }
      if (typeof l.normX2 === 'number' && typeof l.normY2 === 'number') {
        let np2 = normMap(l.normX2, l.normY2);
        l.normX2 = np2.x; l.normY2 = np2.y;
      }
      if (typeof l.angle === 'number') {
        l.angle = ((l.angle + deltaDeg) % 360 + 360) % 360;
      }
    });
  }
}

// หมุนภาพ element ปัจจุบันไป delta องศา (บวก = ตามเข็มนาฬิกา) รอบจุดศูนย์กลางภาพ
//   onDone = เรียกเมื่อ "ภาพที่หมุนแล้วพร้อมใช้" (ถอดรหัสเสร็จ) — ผู้เรียกต้อง fit/redraw ในจังหวะนั้น
function applyRotationToImage(deltaDeg, onDone) {
  if (!img.src || !img.width || !img.height) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  let deg = ((deltaDeg % 360) + 360) % 360;
  if (deg === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  let srcW = img.width, srcH = img.height;
  let rad = deg * Math.PI / 180;
  let cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  let outW = Math.round(srcW * cos + srcH * sin);
  let outH = Math.round(srcW * sin + srcH * cos);

  let tmp = document.createElement('canvas');
  tmp.width = outW;
  tmp.height = outH;
  let tctx = tmp.getContext('2d');
  // ย้ายจุดกำเนิดไปกึ่งกลางภาพใหม่ แล้วหมุนรอบจุดนั้น = ใช้ศูนย์กลางรูปเป็นจุดหมุน
  tctx.translate(outW / 2, outH / 2);
  tctx.rotate(rad);
  tctx.drawImage(img, -srcW / 2, -srcH / 2);

  // ⚠️ ห้ามตั้ง img = rotImg ก่อนภาพถอดรหัสเสร็จ (width/height เป็น 0 → fit/redraw เพี้ยน)
  //    และต้อง "วาดใหม่หลัง onload" ไม่งั้นภาพที่หมุนแล้วไม่ขึ้นบนจอ
  let rotImg = new Image();
  rotImg.onload = () => {
    img = rotImg;
    if (typeof onDone === 'function') onDone();
  };
  rotImg.src = tmp.toDataURL('image/png');
}

// ภาพที่โหลดใหม่ (อัปโหลด/เปลี่ยนหน้า PDF) ให้หมุนตามมุมสะสมล่าสุด แล้วค่อย fit/วาด
function applyPendingRotationToImage(onDone) {
  if (!img.src || !img.width || !img.height || imageRotation === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  applyRotationToImage(imageRotation, onDone);
}

// แสดงสถานะหมุนปัจจุบันบนปุ่ม (หมุน 90° / หมุนกลับ)
function syncRotationButtonLabel() {
  const btn = document.getElementById('btn-rotate-cw');
  if (btn) btn.textContent = (imageRotation === 0) ? '🔄 หมุน 90°' : '🔄 หมุนกลับ';
}

function resetImageRotation(onDone) {
  if (imageRotation === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  const oldLogicalW = img.width * imgScale;
  const oldLogicalH = img.height * imgScale;
  const delta = -imageRotation;
  imageRotation = 0;
  syncRotationButtonLabel();
  applyRotationToImage(delta, () => {
    rotateOverlayPixels(delta, oldLogicalW, oldLogicalH);
    if (typeof onDone === 'function') onDone();
  });
}

const MAG_ZOOM = 2.5;
const DEFAULT_CURSOR_COLOR = '#ff0000';

function renderDevBadge() {
  const devBadge = document.getElementById('devBadge');
  if (!devBadge) return;
  const ver = (typeof APP_VERSION !== 'undefined' && APP_VERSION) ? APP_VERSION : '1.0001';
  if (isSidebarCollapsed) {
    devBadge.innerHTML = `<div class="dev-badge-line1">สจจ.2</div><div class="dev-badge-version" id="devBadgeVersion">Version ${ver}</div>`;
  } else {
    devBadge.innerHTML = `<div class="dev-badge-line1">💻 พัฒนาโดย สจจ.2</div><div class="dev-badge-version" id="devBadgeVersion">Version ${ver}</div>`;
  }
}

function toggleSidebar() {
  isSidebarCollapsed = !isSidebarCollapsed;
  const sb = document.getElementById('sidebarLeft');
  const toggleBtn = sb.querySelector('.sidebar-toggle-btn');

  if (isSidebarCollapsed) {
    sb.classList.add('collapsed');
    toggleBtn.innerText = '▶';
  } else {
    sb.classList.remove('collapsed');
    toggleBtn.innerText = '◀';
  }
  renderDevBadge();
}

// รอบ 46: ย่อ/ขยายแท็บขวามือให้เหลือแถบเล็กๆ ได้
function toggleRightSidebar(forceCollapsed) {
  const rsb = document.getElementById('pdfThumbnailsSidebar');
  const btn = document.getElementById('rightSidebarToggleBtn');
  if (!rsb) return;
  const shouldCollapse = (typeof forceCollapsed === 'boolean') ? forceCollapsed : !rsb.classList.contains('collapsed');
  rsb.classList.toggle('collapsed', shouldCollapse);
  if (btn) {
    btn.textContent = shouldCollapse ? '◀' : '▶';
    btn.title = shouldCollapse ? 'ขยายแถบเครื่องมือขวา' : 'ย่อแถบเครื่องมือขวาให้เหลือแถบเล็กๆ';
  }
  if (typeof fitImageToViewportWithPadding === 'function') {
    try { fitImageToViewportWithPadding(); } catch (_) {}
  }
  if (typeof redraw === 'function') {
    try { redraw(); } catch (_) {}
  }
}

function switchMainMenu(menuKey, el) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (el && el.classList) el.classList.add('active');

  const center = document.getElementById('centerContent');
  const blank = document.getElementById('blankPageView');
  const subMenu = document.getElementById('subEstimateMenu');
  const structCalcPage = document.getElementById('structureCalcPage');
  if (structCalcPage) structCalcPage.style.display = 'none';
  const qtyCalcPage = document.getElementById('quantityCalcPage');
  if (qtyCalcPage) qtyCalcPage.style.display = 'none';

  if (menuKey === 'estimate') {
    if (subMenu) subMenu.style.display = 'flex';
    center.style.display = 'none';
    blank.style.display = 'none';
    const projectPage = document.getElementById('projectPlanPage');
    if (projectPage) projectPage.style.display = 'none';
    if (typeof renderEstimateSummaryPage === 'function') renderEstimateSummaryPage();
    const summaryPage = document.getElementById('estimateSummaryPage');
    if (summaryPage) summaryPage.style.display = 'block';
    updateTopHeaderBanner('📊 ประมาณการ', null);
  } else if (menuKey === 'project') {
    subMenu.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'none';
    const summaryPage = document.getElementById('estimateSummaryPage');
    if (summaryPage) summaryPage.style.display = 'none';
    if (typeof renderProjectPlanPage === 'function') renderProjectPlanPage();
    const projectPage = document.getElementById('projectPlanPage');
    if (projectPage) projectPage.style.display = 'block';
    updateTopHeaderBanner('📋 แผนงานโครงการ', null);
  } else if (menuKey === 'setting') {
    // รอบ 46 (ข้อ 7): เมนู Setting ซ้ายมือ ตัดขาดไม่เกี่ยวกับแท็บ setting ในตารางส่วนถอดแบบ
    subMenu.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'flex';
    const titleEl = document.getElementById('blankPageTitle');
    if (titleEl) titleEl.innerText = 'Setting (ตั้งค่าระบบหลัก)';
    const summaryPage = document.getElementById('estimateSummaryPage');
    if (summaryPage) summaryPage.style.display = 'none';
    const projectPage = document.getElementById('projectPlanPage');
    if (projectPage) projectPage.style.display = 'none';
    updateTopHeaderBanner('⚙️ Setting', null);
  } else {
    subMenu.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'flex';
    document.getElementById('blankPageTitle').innerText = el.querySelector('.nav-text').innerText;
    // ซ่อน summary และ project page เมื่อเปลี่ยนเป็นเมนูอื่น (แผนที่, จัดซื้อ, เรียกเก็บ)
    const summaryPage = document.getElementById('estimateSummaryPage');
    if (summaryPage) summaryPage.style.display = 'none';
    const projectPage = document.getElementById('projectPlanPage');
    if (projectPage) projectPage.style.display = 'none';
    // รอบ 44: แท็ปชื่อเมนูในแถบหัว (หน้าว่าง — ไม่มีแท็บย่อย)
    const mainIcon = el.querySelector('.nav-icon');
    const mainText = el.querySelector('.nav-text');
    updateTopHeaderBanner(
      ((mainIcon ? mainIcon.textContent + ' ' : '') + (mainText ? mainText.textContent : '')).trim(),
      null
    );
  }
}

function switchSubMenu(subKey, el) {
  document.querySelectorAll('.sub-nav-item').forEach(item => item.classList.remove('active'));
  if (el && el.classList) el.classList.add('active');

  const center = document.getElementById('centerContent');
  const blank = document.getElementById('blankPageView');
  const summaryPage = document.getElementById('estimateSummaryPage');
  if (summaryPage) summaryPage.style.display = 'none';
  const projectPage = document.getElementById('projectPlanPage');
  if (projectPage) projectPage.style.display = 'none';
  const structCalcPage = document.getElementById('structureCalcPage');
  const qtyCalcPage = document.getElementById('quantityCalcPage');

  if (subKey === 'takeoff') {
    if (structCalcPage) structCalcPage.style.display = 'none';
    if (qtyCalcPage) qtyCalcPage.style.display = 'none';
    center.style.display = 'flex';
    blank.style.display = 'none';
    if (typeof currentTab !== 'undefined' && (currentTab === 'setting-type' || currentTab === 'setting-structure')) {
      if (typeof switchTableTab === 'function') switchTableTab('ditch');
    }
    updateTopHeaderBanner('📊 ประมาณการ', '✏️ ส่วนถอดแบบ');
  } else if (subKey === 'quantity') {
    // รอบ 59: เมนูย่อย "ส่วนคำนวณปริมาณ" แสดงหน้าแท็บ "งานดิน" (ส่วนที่ 3 ของ canal_cross_section_V3.html + ดึงค่าจากส่วนถอดแบบ)
    if (structCalcPage) structCalcPage.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'none';
    if (qtyCalcPage) qtyCalcPage.style.display = 'flex';
    if (typeof switchQuantityCalcTab === 'function') {
      const targetQtyTab = (typeof quantityCalcActiveTab === 'string' && quantityCalcActiveTab) ? quantityCalcActiveTab : 'earthwork';
      switchQuantityCalcTab(targetQtyTab);
    }
    updateTopHeaderBanner('📊 ประมาณการ', '📐 ส่วนคำนวณปริมาณ');
  } else if (subKey === 'structure-calc') {
    // รอบ 52: เมนูย่อย "ส่วนอาคารประกอบ" แสดงหน้าตั้งค่า Typeคูส่งน้ำ / Typeอาคารประกอบ พร้อมแถบแท็บซ้ายมือที่ย่อ-ขยายได้
    if (qtyCalcPage) qtyCalcPage.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'none';
    if (structCalcPage) structCalcPage.style.display = 'flex';
    if (typeof switchStructureCalcTab === 'function') {
      const targetSub = (typeof structureCalcActiveTab === 'string' && structureCalcActiveTab) ? structureCalcActiveTab : 'setting-type';
      switchStructureCalcTab(targetSub);
    }
    updateTopHeaderBanner('📊 ประมาณการ', '🏛️ ส่วนอาคารประกอบ');
  } else {
    if (structCalcPage) structCalcPage.style.display = 'none';
    if (qtyCalcPage) qtyCalcPage.style.display = 'none';
    center.style.display = 'none';
    blank.style.display = 'flex';
    const subTextEl = el && el.querySelector ? el.querySelector('.sub-nav-text') : null;
    if (subTextEl && document.getElementById('blankPageTitle')) {
      document.getElementById('blankPageTitle').innerText = subTextEl.innerText;
    }
    // รอบ 44: แท็ปชื่อเมนูในแถบหัว (เมนูย่อยของประมาณการ)
    const subIcon = el && el.querySelector ? el.querySelector('.sub-nav-icon') : null;
    const subText = el && el.querySelector ? el.querySelector('.sub-nav-text') : null;
    updateTopHeaderBanner(
      '📊 ประมาณการ',
      ((subIcon ? subIcon.textContent + ' ' : '') + (subText ? subText.textContent : '')).trim()
    );
  }
}

// ฟังก์ชัน returnToTakeoff ถูกย้ายไปอยู่ใน js/table-core.js (เพื่อให้เรียกได้แม้ canvas-viewer.js ยังโหลดไม่เสร็จ)

function toggleFloatingMagnifier() {
  isMagnifierOpen = !isMagnifierOpen;
  const btn = document.getElementById('btn-toggle-magnifier');
  if (isMagnifierOpen) {
    magnifierBox.style.display = 'block';
    btn.classList.add('active');
  } else {
    magnifierBox.style.display = 'none';
    btn.classList.remove('active');
  }
}

function toggleLockZoom() {
  isZoomLocked = !isZoomLocked;
  const btn = document.getElementById('btn-lockzoom');
  if (isZoomLocked) {
    btn.classList.add('locked-state');
    btn.innerText = '🔒 ล็อกซูม';
    btn.title = 'ซูมถูกล็อกอยู่ (ล้อเลื่อนเมาส์จะไม่เปลี่ยนขนาดซูม)';
  } else {
    btn.classList.remove('locked-state');
    btn.innerText = '🔓 ล็อกซูม';
    btn.title = 'ล็อก/ปลดล็อกการซูมด้วยล้อเลื่อนเมาส์';
  }
}

// ===== ระบบแจ้งเตือน / กล่องยืนยันที่สร้างในหน้าเว็บ =====
// ทำไมต้องมี: เมื่อเปิดเว็บผ่านพรีวิวแบบ sandbox (iframe ที่ไม่มี allow-modals)
// เบราว์เซอร์จะ "บล็อก" alert() และ confirm() เงียบ ๆ → ผู้ใช้ไม่เห็นข้อความและ confirm คืนค่า false
const uiToastStack = document.getElementById('uiToastStack');
const uiConfirmOverlay = document.getElementById('uiConfirmOverlay');
const uiConfirmMessage = document.getElementById('uiConfirmMessage');
const uiConfirmOkBtn = document.getElementById('uiConfirmOkBtn');
const uiConfirmCancelBtn = document.getElementById('uiConfirmCancelBtn');
const uiConfirmInput = document.getElementById('uiConfirmInput');

function removeUiToast(box) {
  if (!box || !box.parentNode) return;
  box.classList.add('ui-toast-hide');
  setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
}

function uiToast(message, type) {
  if (!uiToastStack) return;
  let text = (message === null || message === undefined) ? '' : String(message);

  if (!type || type === 'auto') {
    if (/ไม่สามารถ|กรุณา|ข้อผิดพลาด|ห้าม|ล้มเหลว|ไม่พบ/.test(text)) type = 'error';
    else if (/สำเร็จ|เรียบร้อย/.test(text)) type = 'success';
    else type = 'info';
  }

  const box = document.createElement('div');
  box.className = `ui-toast ui-toast-${type}`;
  box.textContent = text;
  box.title = 'คลิกเพื่อปิด';
  box.addEventListener('click', () => removeUiToast(box));
  uiToastStack.appendChild(box);
  setTimeout(() => removeUiToast(box), type === 'error' ? 6000 : 3500);
}

// ให้ alert() ที่มีอยู่ทั้งหมดในโปรเจกต์แสดงเป็นข้อความในหน้าเว็บแทน (ไม่ต้องแก้ทุก call-site)
window.alert = function (message) { uiToast(message, 'auto'); };

let uiConfirmOpen = false;
function uiConfirm(message, onOk, opts) {
  opts = opts || {};

  // ถ้าไม่มี DOM ของกล่องยืนยัน ให้ทำงานต่อทันทีเพื่อไม่ให้ฟังก์ชันต้นทางค้าง
  if (!uiConfirmOverlay) {
    if (typeof onOk === 'function') onOk();
    return;
  }
  if (uiConfirmOpen) {
    // ถ้ากล่องเปิดอยู่แล้ว ให้แจ้งยกเลิกกลับไป เพื่อไม่ให้ผู้เรียกที่รอผลค้าง
    if (typeof opts.onCancel === 'function') opts.onCancel();
    return;
  }

  uiConfirmMessage.textContent = (message === null || message === undefined) ? '' : String(message);
  uiConfirmOkBtn.textContent = opts.okText || 'ยืนยัน';
  uiConfirmCancelBtn.textContent = opts.cancelText || 'ยกเลิก';
  uiConfirmOkBtn.classList.toggle('ui-modal-danger', opts.danger === true);

  // โหมดกรอกข้อความ (ใช้แทน prompt ของเบราว์เซอร์ที่ถูกบล็อกในพรีวิว sandbox)
  if (opts.showInput && uiConfirmInput) {
    uiConfirmInput.style.display = 'block';
    uiConfirmInput.value = (opts.inputValue === undefined || opts.inputValue === null) ? '' : String(opts.inputValue);
  } else if (uiConfirmInput) {
    uiConfirmInput.style.display = 'none';
    uiConfirmInput.value = '';
  }

  uiConfirmOverlay.classList.add('show');
  uiConfirmOpen = true;

  if (opts.showInput && uiConfirmInput) {
    uiConfirmInput.focus();
    uiConfirmInput.select();
  } else {
    if (typeof uiConfirmOkBtn.focus === 'function') uiConfirmOkBtn.focus();
  }

  function closeDialog() {
    uiConfirmOverlay.classList.remove('show');
    uiConfirmOpen = false;
    uiConfirmOkBtn.removeEventListener('click', handleOk);
    uiConfirmCancelBtn.removeEventListener('click', handleCancel);
    uiConfirmOverlay.removeEventListener('mousedown', handleOverlayClick);
    document.removeEventListener('keydown', handleKeyDown);
  }
  function handleOk() {
    closeDialog();
    if (typeof onOk === 'function') onOk();
  }
  function handleCancel() {
    closeDialog();
    if (typeof opts.onCancel === 'function') opts.onCancel();
  }
  function handleOverlayClick(e) {
    if (e.target === uiConfirmOverlay) handleCancel();
  }
  function handleKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
    else if (e.key === 'Enter') { e.preventDefault(); handleOk(); }
  }

  uiConfirmOkBtn.addEventListener('click', handleOk);
  uiConfirmCancelBtn.addEventListener('click', handleCancel);
  uiConfirmOverlay.addEventListener('mousedown', handleOverlayClick);
  document.addEventListener('keydown', handleKeyDown);
}

// ใช้แทน prompt(): คืนค่าเป็น Promise (ข้อความที่กรอก หรือ null ถ้ายกเลิก)
function uiPrompt(message, defaultValue, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => { if (settled) return; settled = true; resolve(val); };

    if (!uiConfirmOverlay || !uiConfirmInput) {
      // ไม่มี DOM ของกล่องกรอก → ใช้ค่าเริ่มต้นแทน เพื่อให้การบันทึกยังดำเนินต่อได้
      finish(defaultValue === undefined || defaultValue === null ? '' : String(defaultValue));
      return;
    }

    uiConfirm(message, function () {
      const val = uiConfirmInput.value;
      uiConfirmInput.value = '';
      finish(val);
    }, {
      okText: opts.okText || 'ตกลง',
      cancelText: opts.cancelText || 'ยกเลิก',
      danger: opts.danger === true,
      showInput: true,
      inputValue: defaultValue,
      onCancel: function () { finish(null); }
    });
  });
}

function clearOnlyDrawingLines() {
  let hasManual = manualGroundLinePoints.length > 0;
  let hasTable = tableGroundLinePoints.length > 0;
  let hasCanal = canalLevelDrawingLines.length > 0;

  if (!hasManual && !hasTable && !hasCanal) {
    // อาจเหลือแค่พิกเซลเส้นค้างบนจอ (ข้อมูลถูกล้างไปแล้ว) — ต้องยืนยัน+redraw เพื่อล้างให้ด้วย
    console.warn('clearOnlyDrawingLines: ไม่พบข้อมูลเส้นวาด (จะล้างพิกเซลที่ค้างบนจอให้)');
  }

  uiConfirm(
    'ต้องการลบเส้นวาดทั้งหมดบนรูปภาพออกใช่หรือไม่?\n(จุดอ้างอิง P1, P2 และข้อมูลในตารางจะไม่ถูกลบ)',
    function () {
      try {
        manualGroundLinePoints = [];
        tableGroundLinePoints = [];
        canalLevelDrawingLines = [];
      } catch (err) {
        console.error('clearOnlyDrawingLines ล้มเหลวบางส่วน:', err);
      } finally {
        // รอบ 41: ล้างเฉพาะภาพวาดของแท็บที่กำลังดูอยู่ (ไม่กระทบแท็บอื่น)
        if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
        redraw(); // ล้างจอเสมอ แม้เกิดข้อผิดพลาดกลางทาง
      }
    },
    { danger: true, okText: 'ลบเส้น' }
  );
}

// รอบ 49: ปุ่ม "ลบวัตถุทั้งหมด" ใต้ปุ่ม หมุน 90° (ทั้งส่วน PDF และส่วนรูปตัดตามยาว)
function clearAllCanvasObjects() {
  const doClear = function () {
    try {
      manualGroundLinePoints = [];
      tableGroundLinePoints = [];
      canalLevelDrawingLines = [];
      if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
        canvasLabels = [];
      }
      if (typeof refPixels !== 'undefined' && refPixels) {
        refPixels.p1 = null;
        refPixels.p2 = null;
      }
      if (typeof groundGroupState !== 'undefined' && groundGroupState) {
        Object.values(groundGroupState).forEach(grp => {
          if (grp) {
            delete grp.p1Ref;
            delete grp.p2Ref;
          }
        });
      }
      if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'pdf' && typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames)) {
        pdfCropFrames = pdfCropFrames.filter(fr => fr && fr.source && fr.source !== 'pdf_crop');
      }
    } catch (err) {
      console.error('clearAllCanvasObjects error:', err);
    } finally {
      if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
      redraw();
    }
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm(
      'ต้องการลบวัตถุที่วาดทั้งหมดบนหน้านี้ใช่หรือไม่?\n(ข้อมูลตัวเลขในตารางจะไม่ถูกลบ)',
      doClear,
      { danger: true, okText: 'ลบวัตถุทั้งหมด' }
    );
  } else {
    doClear();
  }
}

function getRedPlusCursor() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path stroke="${encodeURIComponent(DEFAULT_CURSOR_COLOR)}" stroke-width="2" d="M12 2v20M2 12h20"/></svg>`;
  return `url('data:image/svg+xml;utf8,${svg}') 12 12, crosshair`;
}

function getAddPointCursor() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="9" fill="rgba(253,126,20,0.22)" stroke="%23e65100" stroke-width="2"/><path stroke="%23e65100" stroke-width="2.2" d="M14 8v12M8 14h12"/></svg>`;
  return `url('data:image/svg+xml;utf8,${svg}') 14 14, copy`;
}

function applyRedCursor() {
  if (currentMode === 'zoomwindow') {
    canvas.style.cursor = 'nwse-resize';
  } else if (currentMode === 'p1' || currentMode === 'p2' || currentMode === 'data' || currentMode === 'crop_pdf') {
    canvas.style.cursor = getRedPlusCursor();
  } else if (currentMode === 'add_ground_pt') {
    canvas.style.cursor = getAddPointCursor();
  } else {
    canvas.style.cursor = 'default';
  }
}
applyRedCursor();

function updateFileStatusDisplay() {
  if (typeof updatePdfEmptyUploadPromptVisibility === 'function') {
    updatePdfEmptyUploadPromptVisibility();
  }
  if (activeMediaViewTab === 'image' && pdfCropFrames.length > 0) {
    const curIdx = (activeCropFrameIndex >= 0 && activeCropFrameIndex < pdfCropFrames.length) ? activeCropFrameIndex : 0;
    const curItem = pdfCropFrames[curIdx];
    const itemName = (curItem && curItem.name) ? curItem.name : (`รูปภาพ ${curIdx + 1}`);
    fileStatusDisplay.innerText = `${itemName} : รูปที่ ${curIdx + 1} / ${pdfCropFrames.length}`;
    return;
  }
  if (!currentFileName) {
    fileStatusDisplay.innerText = 'ยังไม่ได้เลือกไฟล์';
    return;
  }
  if (isPDF) {
    fileStatusDisplay.innerText = `${currentFileName} : หน้า ${pageNum} / ${totalPages}`;
  } else {
    fileStatusDisplay.innerText = `${currentFileName} : หน้า 1 / 1`;
  }
}

const resizerBar = document.getElementById('resizerBar');
const bottomPanel = document.getElementById('bottomTablePanel');
const centerContent = document.getElementById('centerContent');
let isResizing = false;

resizerBar.addEventListener('mousedown', (e) => {
  isResizing = true;
  resizerBar.classList.add('dragging');
  document.body.style.cursor = 'ns-resize';
});

window.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const centerRect = centerContent.getBoundingClientRect();
  const pointerRelativeY = e.clientY - centerRect.top;
  const newBottomHeight = centerRect.height - pointerRelativeY;

  if (newBottomHeight >= 80 && newBottomHeight <= (centerRect.height - 150)) {
    bottomPanel.style.height = `${newBottomHeight}px`;
  }
});

window.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizerBar.classList.remove('dragging');
    document.body.style.cursor = 'default';
  }
});

// รอบ 40: โหลดภาพใหม่ → เก็บ P1/P2 ของชุดข้อมูลไว้ (ไม่ล้างทิ้ง)
//   เดิม: img.onload ล้าง refPixels ทุกครั้ง → จุด P1/P2 ที่เพิ่งตั้งหายทันทีเมื่อสลับแท็บ/เปลี่ยนหน้า PDF
//   แก้: เก็บพิกัดเดิมไว้ก่อน แล้วคืนค่ากลับหลังภาพพร้อม (พิกัดของชุดข้อมูลคงอยู่ใน groundGroupState อยู่แล้ว)
let pendingRefPixelsRestore = null;

img.onload = () => {
  // รอบ 40: ไม่ล้างจุดอ้างอิงทิ้ง — ใช้ค่าเดิมที่ค้างไว้ (ถ้ามี)
  if (pendingRefPixelsRestore) {
    refPixels = pendingRefPixelsRestore;
    pendingRefPixelsRestore = null;
  } else {
    refPixels = { p1: null, p2: null };
  }
  manualGroundLinePoints = [];
  tableGroundLinePoints = [];
  canalLevelDrawingLines = [];
  updateTable();
  fitImageToViewportWithPadding();
  redraw();
  centerImageInViewport();
};

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (currentMode === 'data') {
    if (manualGroundLinePoints.length > 0) {
      let defaultChId = (typeof channels !== 'undefined' && channels[0]) ? channels[0].id : 1;
      for (let i = manualGroundLinePoints.length - 1; i >= 0; i--) {
        let ptCh = manualGroundLinePoints[i].channelId;
        if (ptCh === activeChannelId || (ptCh === undefined && activeChannelId === defaultChId)) {
          manualGroundLinePoints.splice(i, 1);
          redraw();
          break;
        }
      }
    }
  }
});

function toggleZoomWindow() {
  if (currentMode === 'zoomwindow') {
    setMode(prevStepMode || 'pan');
  } else {
    prevStepMode = currentMode;
    setMode('zoomwindow');
  }
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.footer-box-right button.btn-calib-p, .footer-box-right button.btn-step3-inline, .btn-ground-pt-add').forEach(btn => btn.classList.remove('active'));
  const btnZoomWindow = document.getElementById('btn-zoomwindow');
  
  if (mode === 'p1' && document.getElementById('btn-p1')) document.getElementById('btn-p1').classList.add('active');
  if (mode === 'p2' && document.getElementById('btn-p2')) document.getElementById('btn-p2').classList.add('active');
  if (mode === 'data' && document.getElementById('btn-data')) document.getElementById('btn-data').classList.add('active');

  if (mode === 'zoomwindow') {
    if (btnZoomWindow) btnZoomWindow.classList.add('active');
    canvas.classList.add('zoom-window');
    canvas.style.cursor = 'nwse-resize';
  } else {
    if (btnZoomWindow) btnZoomWindow.classList.remove('active');
    canvas.classList.remove('zoom-window');
    applyRedCursor();
  }
  if (typeof updateSideControlStatus === 'function') updateSideControlStatus();
}

function startDataMode() {
  setMode('data');
  redraw();
}

function readFileAsDataUrlPromise(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (ev) => resolve(ev.target.result);
    r.onerror = (err) => reject(err);
    r.readAsDataURL(f);
  });
}

// รอบ 30: อ่านขนาด pixel จริงของ dataUrl (ใช้บันทึก imgWidth/imgHeight ของกรอบรูป)
function getImagePixelSize(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return reject(new Error("no dataUrl"));
    const im = new Image();
    im.onload = () => resolve({ width: im.width, height: im.height });
    im.onerror = (e) => reject(e || new Error("load image failed"));
    im.src = dataUrl;
  });
}

fileLoader.addEventListener('change', async (e) => {
  const filesList = Array.from(e.target.files || []);
  const file = filesList[0];
  if (!file) return;

  if (filesList.every(f => f.size === 0)) {
    alert('ไม่สามารถเปิดไฟล์นี้ได้: ไฟล์มีขนาด 0 ไบต์ (ไฟล์ว่างเปล่า)');
    e.target.value = '';
    return;
  }

  currentFileName = file.name;

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    isPDF = true;
    savedPdfFileName = file.name;
    thumbnailsSidebar.style.display = 'flex';
    ["pdf", "image", "draw"].forEach(k => { const b = document.getElementById("media-tab-" + k); if (b) b.classList.toggle("active", k === "pdf"); });
    activeMediaViewTab = "pdf";
    const th = document.getElementById("sideThumbnailsHeader"); if (th) th.textContent = "📄 หน้า PDF ย่อย";
    if (typeof pdfjsLib === 'undefined') {
      alert('โหลดไลบรารีอ่าน PDF (pdf.js) ไม่สำเร็จ — กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วรีเฟรชหน้าเว็บ (Ctrl+F5)');
      return;
    }
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result);
      // เก็บ base64 ของ PDF ฉบับเต็มไว้ในตัวแปร global เพื่อใช้ตอนบันทึก JSON
      // แปลงเป็น base64 data URL เพื่อเก็บใน JSON ได้ง่าย
      try {
        let bin = '';
        const bytes = new Uint8Array(this.result);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        pdfFileDataUrl = 'data:application/pdf;base64,' + btoa(bin);
      } catch (e) {
        console.warn('แปลง PDF เป็น base64 ล้มเหลว:', e);
        pdfFileDataUrl = null;
      }
      try {
        // ⚠️ isEvalSupported:false = ปิดทางโจมตี CVE-2024-4367 (pdf.js ≤ 4.1.392 รัน JS จาก PDF ที่ประสงค์ร้ายได้)
        //    ตามคำแนะนำของ advisory: https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq
        pdfDoc = await pdfjsLib.getDocument({ data: typedarray, isEvalSupported: false }).promise;
        totalPages = pdfDoc.numPages;
        pageNum = 1;
        updateFileStatusDisplay();
        await renderPDFPage(pageNum);
        generateThumbnails();
        syncSideControlPanelByMediaTab();
      } catch (err) {
        alert('ไม่สามารถเปิดไฟล์ PDF นี้ได้: ' + err.message);
      }
    };
    fileReader.readAsArrayBuffer(file);
  } else {
    isPDF = false;
    if (thumbnailsSidebar) thumbnailsSidebar.style.display = 'flex';
    if (activeMediaViewTab === 'pdf' || activeMediaViewTab === 'draw') {
      ["pdf", "image", "draw"].forEach(k => {
        const btn = document.getElementById("media-tab-" + k);
        if (btn) btn.classList.toggle("active", k === "image");
      });
      activeMediaViewTab = "image";
      const thumbHeader = document.getElementById("sideThumbnailsHeader");
      if (thumbHeader) thumbHeader.textContent = "🖼️ รูปภาพย่อย";
    }

    const validImageFiles = filesList.filter(f => f && f.size > 0 && !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')));
    let lastAddedIdx = -1;
    for (let i = 0; i < validImageFiles.length; i++) {
      try {
        const dataUrl = await readFileAsDataUrlPromise(validImageFiles[i]);
        const nextNum = pdfCropFrames.length + 1;
        const itemObj = {
          id: "upload_" + Date.now() + "_" + i + "_" + nextNum,
          index: nextNum,
          source: "upload",
          name: `รูปภาพ ${nextNum}`,
          dataUrl: dataUrl
        };
        // รอบ 30: จำขนาด pixel จริงของรูปที่อัปโหลด เพื่อแปลงพิกัดสัดส่วน 0..1 ของ AI ได้ตรง
        try {
          const dim = await getImagePixelSize(dataUrl);
          itemObj.imgWidth = dim.width;
          itemObj.imgHeight = dim.height;
        } catch (_) {}
        pdfCropFrames.push(itemObj);
        lastAddedIdx = pdfCropFrames.length - 1;
      } catch (_) {}
    }

    if (lastAddedIdx >= 0) {
      activeCropFrameIndex = lastAddedIdx;
      const latestItem = pdfCropFrames[activeCropFrameIndex];
      savedLongImageSrc = latestItem.dataUrl;
      savedLongImageFileName = latestItem.name;
      currentFileName = latestItem.name;

      img = new Image();
      img.onload = () => {
        // รอบ 40: เก็บจุดอ้างอิงไว้ (ไม่ล้างทิ้ง) — จุด P1/P2 อยู่ใน groundGroupState ของแต่ละชุดอยู่แล้ว
        if (pendingRefPixelsRestore) {
          refPixels = pendingRefPixelsRestore;
          pendingRefPixelsRestore = null;
        }
        manualGroundLinePoints = [];
        tableGroundLinePoints = [];
        canalLevelDrawingLines = [];
        applyPendingRotationToImage(() => {
          savedLongImageSrc = img.src;
          latestItem.dataUrl = img.src;
          generateImageThumbnail();
          updateFileStatusDisplay();
          updateTable();
          fitImageToViewportWithPadding();
          updateSideControlStatus();
          redraw();
          centerImageInViewport();
        });
      };
      img.src = latestItem.dataUrl;
    }
  }
  e.target.value = '';
});

async function generateThumbnails() {
  if (!pdfDoc) return;
  const listEl = getThumbnailsListEl();
  if (!listEl) return;
  const leftSide = getLeftThumbnailsSidebarEl();
  if (leftSide) leftSide.style.display = 'flex';
  if (thumbnailsSidebar) thumbnailsSidebar.style.display = 'flex';
  if (typeof updatePdfEmptyUploadPromptVisibility === 'function') updatePdfEmptyUploadPromptVisibility();
  listEl.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const card = document.createElement('div');
    card.className = `thumbnail-card ${i === pageNum ? 'active' : ''}`;
    card.id = `thumb-page-${i}`;
    card.onclick = async () => {
      if (pageNum !== i) {
        pageNum = i;
        try { await renderPDFPage(pageNum); } catch (e) { console.warn('render page', i, 'failed:', e); }
      }
    };

    const thumbCanvas = document.createElement('canvas');
    card.appendChild(thumbCanvas);

    const label = document.createElement('div');
    label.className = 'thumbnail-label';
    label.innerText = `หน้า ${i}`;
    card.appendChild(label);

    listEl.appendChild(card);

    pdfDoc.getPage(i).then(page => {
      const thumbViewport = page.getViewport({ scale: 0.15 });
      thumbCanvas.width = thumbViewport.width;
      thumbCanvas.height = thumbViewport.height;
      const renderContext = {
        canvasContext: thumbCanvas.getContext('2d'),
        viewport: thumbViewport
      };
      const renderTask = page.render(renderContext);
      if (renderTask && renderTask.promise) {
        return renderTask.promise;
      }
    }).catch(err => {
      // ถ้า PDF หน้าใดหน้าหนึ่งเสีย → หน้าอื่นยังแสดงได้ + แจ้งผู้ใช้ (เดิมเงียบ)
      console.warn('โหลด thumbnail หน้า', i, 'ไม่สำเร็จ:', err);
    });
  }
}

function updateThumbnailActiveState() {
  const allThumbs = document.querySelectorAll('.thumbnail-card');
  allThumbs.forEach(t => t.classList.remove('active'));
  const currentThumb = document.getElementById(`thumb-page-${pageNum}`);
  if (currentThumb) {
    currentThumb.classList.add('active');
    currentThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function renderPDFPage(num) {
  if (!pdfDoc) return;
  // ใช้ token กัน race: ถ้า user เปลี่ยนหน้าเร็ว ๆ render เก่าจะถูก abort (ไม่ทับภาพใหม่)
  const myToken = ++currentRenderToken;
  const page = await pdfDoc.getPage(num);
  if (myToken !== currentRenderToken) return; // มี render ใหม่กว่า → ยกเลิก
  const viewportPDF = page.getViewport({ scale: 2.0 });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = viewportPDF.width;
  tempCanvas.height = viewportPDF.height;
  const tempCtx = tempCanvas.getContext('2d');

  await page.render({ canvasContext: tempCtx, viewport: viewportPDF }).promise;
  if (myToken !== currentRenderToken) return; // มี render ใหม่กว่า → ยกเลิก

  updateFileStatusDisplay();
  updateThumbnailActiveState();
  // ปุ่ม หน้าก่อน/หน้าถัดไป ถูกถอดออกตามคำสั่ง — เปลี่ยนหน้าจากแถบรูปย่อด้านขวาแทน

  return new Promise((resolve) => {
    img.onload = () => {
      if (myToken !== currentRenderToken) { resolve(); return; } // มี render ใหม่กว่า → ยกเลิก
      // รอบ 40: เก็บจุดอ้างอิงไว้ (ไม่ล้างทิ้ง) — จุด P1/P2 อยู่ใน groundGroupState ของแต่ละชุดอยู่แล้ว
      if (pendingRefPixelsRestore) {
        refPixels = pendingRefPixelsRestore;
        pendingRefPixelsRestore = null;
      }
      manualGroundLinePoints = [];
      tableGroundLinePoints = [];
      canalLevelDrawingLines = [];
      // ให้การหมุนสะสมมีผลกับหน้า PDF ทุกหน้า (เดิมเปลี่ยนหน้าแล้วมุมหมุนหาย)
      applyPendingRotationToImage(() => {
        updateTable();
        fitImageToViewportWithPadding();
        redraw();
        centerImageInViewport();
        resolve();
      });
    };
    img.onerror = () => { resolve(); };
    const pageDataUrl = tempCanvas.toDataURL('image/png');
    savedPdfPageImageSrc = pageDataUrl;
    img.src = pageDataUrl;
  });
}

function fitImageToViewportWithPadding(skipOverlayScale) {
  if (!img.src || !img.width || !img.height) return;
  const padding = 38; 
  const availableWidth = Math.max(100, (viewport ? viewport.clientWidth : 800) - padding);
  const availableHeight = Math.max(100, (viewport ? viewport.clientHeight : 500) - padding);

  const scaleX = availableWidth / img.width;
  const scaleY = availableHeight / img.height;

  const oldScale = imgScale;
  imgScale = Math.min(scaleX, scaleY);
  updateCanvasSize(skipOverlayScale ? imgScale : oldScale);
}

function changePage(dir) {
  if (!isPDF) return;
  const newPage = pageNum + dir;
  if (newPage >= 1 && newPage <= totalPages) {
    pageNum = newPage;
    try { renderPDFPage(newPage).catch(e => console.warn('changePage:', e)); } catch (_) {}
  }
}

// ปรับพิกัดพิกเซลของ overlay ทั้งหมดเมื่อสเกลภาพเปลี่ยน (แก้เส้น/จุดเพี้ยนหลังซูม)
function scaleOverlayPixels(ratio) {
  if (!ratio || ratio === 1 || !isFinite(ratio)) return;

  // 1) จุดอ้างอิง P1, P2 (รวมที่เก็บแยกตามชุดข้อมูลใน groundGroupState)
  const scaledRefs = new Set();
  ['p1', 'p2'].forEach(k => {
    if (refPixels[k] && !scaledRefs.has(refPixels[k])) {
      scaledRefs.add(refPixels[k]);
      refPixels[k].x *= ratio;
      refPixels[k].y *= ratio;
    }
  });
  if (typeof groundGroupState !== 'undefined' && groundGroupState) {
    Object.values(groundGroupState).forEach(grp => {
      if (!grp) return;
      ['p1Ref', 'p2Ref'].forEach(rk => {
        if (grp[rk] && !scaledRefs.has(grp[rk])) {
          scaledRefs.add(grp[rk]);
          grp[rk].x *= ratio;
          grp[rk].y *= ratio;
        }
      });
    });
  }

  // 2) เส้นดินเดิมที่ลากสดบนภาพ (สีฟ้า)
  manualGroundLinePoints.forEach(p => { p.x *= ratio; p.y *= ratio; });

  // 3) เส้นดินเดิมที่วาดจากข้อมูลตาราง (สีส้ม)
  tableGroundLinePoints.forEach(p => { p.x *= ratio; p.y *= ratio; });

  // 4) เส้นระดับ BL / TBL
  canalLevelDrawingLines.forEach(l => {
    l.x1 *= ratio; l.y1 *= ratio; l.x2 *= ratio; l.y2 *= ratio;
  });

  // 5) กรอบรูปที่ตีไว้บน PDF (ปรับสเกลเฉพาะเมื่ออยู่บนแท็บ PDF และมีพิกัดกรอบ)
  if (activeMediaViewTab === 'pdf' && typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames)) {
    pdfCropFrames.forEach(f => {
      if (typeof f.x === 'number' && typeof f.w === 'number') {
        f.x *= ratio; f.y *= ratio; f.w *= ratio; f.h *= ratio;
      }
    });
  }

  // 6) รอบ 30 / รอบ 49: ป้ายข้อมูลบนภาพ (Label Layer) — ต้อง scale ตามภาพด้วยทั้งแท็บ PDF และรูปตัดตามยาว
  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
    const curFrameId = (typeof getCurrentDisplayedFrameId === 'function') ? getCurrentDisplayedFrameId() : null;
    canvasLabels.forEach(l => {
      if (!l || (l.frameId && curFrameId && l.frameId !== curFrameId)) return;
      if (typeof l.x === 'number') l.x *= ratio;
      if (typeof l.y === 'number') l.y *= ratio;
      if (typeof l.x2 === 'number') l.x2 *= ratio;
      if (typeof l.y2 === 'number') l.y2 *= ratio;
    });
  }
}

function updateCanvasSize(oldScale) {
  if (!img.src || !img.width) return;
  if (oldScale === undefined || !oldScale) oldScale = imgScale;

  // A: รักษาตำแหน่งเส้น/จุดให้ตรงกับภาพเมื่อสเกลเปลี่ยน
  const ratio = imgScale / oldScale;
  if (ratio !== 1) scaleOverlayPixels(ratio);

  // B: เรนเดอร์ที่ความละเอียดจริงของจอ (logical size คงเดิมด้วย style)
  const logicalW = img.width * imgScale;
  const logicalH = img.height * imgScale;
  renderDPR = computeRenderDPR(logicalW, logicalH);

  let bw = Math.round(logicalW * renderDPR);
  let bh = Math.round(logicalH * renderDPR);
  if (bw > MAX_CANVAS_DIM || bh > MAX_CANVAS_DIM) {
    // กันเหนียว: ลดความละเอียดลงอีกให้ไม่เกินเพดาน แล้วใช้ค่านั้นเป็นตัวแปลงพิกัด (ให้ตรงกับ bitmap จริง)
    let shrink = Math.min(MAX_CANVAS_DIM / bw, MAX_CANVAS_DIM / bh);
    renderDPR = renderDPR * shrink;
    bw = Math.round(logicalW * renderDPR);
    bh = Math.round(logicalH * renderDPR);
  }
  canvas.width = bw;
  canvas.height = bh;
  canvas.style.width = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
  if (typeof updateSideControlStatus === 'function') updateSideControlStatus();
}

function centerImageInViewport() {
  setTimeout(() => {
    const logicalW = img.width * imgScale;
    const logicalH = img.height * imgScale;
    viewport.scrollLeft = (logicalW - viewport.clientWidth) / 2;
    viewport.scrollTop = (logicalH - viewport.clientHeight) / 2;
  }, 10);
}

// อัปเดตความละเอียดเมื่อย้ายจอ / เปลี่ยนค่า scaling ของระบบ
let lastDeviceDPR = getDeviceDPR();
window.addEventListener('resize', () => {
  const dpr = getDeviceDPR();
  if (dpr === lastDeviceDPR) return;
  lastDeviceDPR = dpr;
  applyMagnifierCanvasResolution();
  if (!img.src) return;
  updateCanvasSize(imgScale); // ratio = 1 → ปรับเฉพาะความละเอียด bitmap
  redraw();
});

viewport.addEventListener('wheel', (e) => {
  if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'draw') {
    e.preventDefault();
    if (isZoomLocked) return;
    const oldZoom = (typeof crossSectionZoom === "number" && isFinite(crossSectionZoom)) ? crossSectionZoom : 1.0;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    let newZoom = Math.max(crossSectionMinZoom, Math.min(crossSectionMaxZoom, oldZoom * zoomFactor));
    if (Math.abs(newZoom - oldZoom) < 1e-4) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = (crossSectionBaseW || 800) * 0.5;
    const cy = (crossSectionBaseH || 500) * 0.5;
    const ratio = newZoom / oldZoom;
    crossSectionPanX = (mouseX - cx) - ((mouseX - cx) - crossSectionPanX) * ratio;
    crossSectionPanY = (mouseY - cy) - ((mouseY - cy) - crossSectionPanY) * ratio;
    crossSectionZoom = newZoom;
    redraw();
    return;
  }
  if (!img.src) return;
  e.preventDefault();
  if (isZoomLocked) return;

  const oldScale = imgScale;
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  let newScale = oldScale * zoomFactor;
  newScale = Math.max(0.05, Math.min(20.0, newScale));

  if (newScale === oldScale) return;

  const rect = viewport.getBoundingClientRect();
  const mouseXInViewport = e.clientX - rect.left;
  const mouseYInViewport = e.clientY - rect.top;

  const contentX = mouseXInViewport + viewport.scrollLeft;
  const contentY = mouseYInViewport + viewport.scrollTop;

  imgScale = newScale;
  updateCanvasSize(oldScale);
  redraw();

  viewport.scrollLeft = (contentX * (newScale / oldScale)) - mouseXInViewport;
  viewport.scrollTop = (contentY * (newScale / oldScale)) - mouseYInViewport;
}, { passive: false });

function resetZoom() {
  if (!img.src) return;
  // รีเซ็ตการหมุนกลับเป็น 0° ด้วย (ต้อง fit/วาดใหม่ "หลังภาพที่หมุนกลับพร้อมใช้")
  resetImageRotation(() => {
    fitImageToViewportWithPadding();
    redraw();
    centerImageInViewport();
  });
}

function isChannelDrawingHidden(chId) {
  if (chId === undefined || chId === null) return false;
  if (typeof groundGroupState === 'undefined') return false;
  let grp = groundGroupState['ground_ch_' + chId];
  return grp ? grp.showDrawing === false : false;
}

function getChannelDisplayName(chId) {
  let ch = (typeof getChannelById === 'function') ? getChannelById(chId) : null;
  if (!ch) return `ชุดข้อมูล #${chId}`;
  return `${ch.canal || 'คลอง'} / ${ch.ditch || '-'}`;
}

function getActiveUnlockedGroundChannelIds() {
  if (typeof groundGroupState === 'undefined') return [];
  let unlocked = [];
  Object.keys(groundGroupState).forEach(k => {
    if (k.startsWith('ground_ch_') && groundGroupState[k] && groundGroupState[k].locked === false) {
      let id = parseInt(k.replace('ground_ch_', ''), 10);
      if (!isNaN(id)) unlocked.push(id);
    }
  });
  return unlocked;
}

function findHitTableGroundPoint(x, y) {
  if (!tableGroundLinePoints || tableGroundLinePoints.length === 0) return null;
  const hitRadius = 9;
  let bestPt = null;
  let bestDist = hitRadius;
  // ให้ความสำคัญกับจุดของชุดข้อมูลที่กำลังแก้ไข (activeChannelId) ก่อนหากจุดทับกัน
  const sortedPts = [...tableGroundLinePoints].sort((a, b) => {
    const aAct = (a.channelId === activeChannelId) ? 0 : 1;
    const bAct = (b.channelId === activeChannelId) ? 0 : 1;
    return aAct - bAct;
  });
  for (const p of sortedPts) {
    if (isChannelDrawingHidden(p.channelId)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestDist) {
      bestDist = d;
      bestPt = p;
    }
  }
  return bestPt;
}

function distToSegmentLogical(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function findNearestCalculatedLineChannel(x, y) {
  if (!tableGroundLinePoints || tableGroundLinePoints.length === 0) return null;
  const byChan = {};
  tableGroundLinePoints.forEach(p => {
    if (isChannelDrawingHidden(p.channelId)) return;
    const cid = p.channelId;
    if (!byChan[cid]) byChan[cid] = [];
    byChan[cid].push(p);
  });
  let nearestCh = null;
  let minDist = Infinity;
  Object.keys(byChan).forEach(cidKey => {
    const pts = [...byChan[cidKey]].sort((a, b) => a.xData - b.xData);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegmentLogical(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < minDist) {
        minDist = d;
        nearestCh = Number(cidKey);
      }
    }
  });
  if (nearestCh === null) return null;
  return { channelId: nearestCh, dist: minDist };
}

function getChannelCalibParams(cIdx) {
  let grpKey = 'ground_ch_' + cIdx;
  // รอบ 40 / รอบ 51: ใช้จุดอ้างอิงเฉพาะของสายนั้น (ห้ามดึง refPixels ของสายแรกไปวาดสายอื่น)
  let p1Ref, p2Ref;
  if (typeof getChannelRefPoints === 'function') {
    const refs = getChannelRefPoints(cIdx);
    p1Ref = refs.p1Ref; p2Ref = refs.p2Ref;
  } else {
    p1Ref = (typeof getChannelRef === 'function') ? getChannelRef(grpKey, 'p1Ref') : null;
    p2Ref = (typeof getChannelRef === 'function') ? getChannelRef(grpKey, 'p2Ref') : null;
  }
  if (!p1Ref || !p2Ref) return null;

  let x1Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p1Km') : NaN);
  let y1Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p1Elev') : NaN);
  let x2Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p2Km') : NaN);
  let y2Val = parseFloat((typeof getChannelP1P2 === 'function') ? getChannelP1P2(grpKey, 'p2Elev') : NaN);

  if (isNaN(x1Val) && document.getElementById('p1XVal')) x1Val = parseFloat(document.getElementById('p1XVal').value);
  if (isNaN(y1Val) && document.getElementById('p1YVal')) y1Val = parseFloat(document.getElementById('p1YVal').value);
  if (isNaN(x2Val) && document.getElementById('p2XVal')) x2Val = parseFloat(document.getElementById('p2XVal').value);
  if (isNaN(y2Val) && document.getElementById('p2YVal')) y2Val = parseFloat(document.getElementById('p2YVal').value);

  if (isNaN(x1Val) || isNaN(y1Val) || isNaN(x2Val) || isNaN(y2Val)) return null;
  if (p2Ref.x === p1Ref.x || p2Ref.y === p1Ref.y || x2Val === x1Val || y2Val === y1Val) return null;

  return { p1Ref, p2Ref, x1Val, y1Val, x2Val, y2Val };
}

function findHitPdfCropDeleteBtn(x, y) {
  if (activeMediaViewTab !== 'pdf') return -1;
  if (typeof overlayVisibility !== 'undefined' && overlayVisibility && overlayVisibility.cropFrames === false) return -1;
  if (typeof pdfCropFrames === 'undefined' || !Array.isArray(pdfCropFrames) || pdfCropFrames.length === 0) return -1;
  for (let i = pdfCropFrames.length - 1; i >= 0; i--) {
    const fr = pdfCropFrames[i];
    if (!fr || (fr.source && fr.source !== 'pdf_crop')) continue;
    if (isPDF && fr.pageNum && fr.pageNum !== pageNum) continue;
    if (fr._delBtnHit) {
      const d = Math.hypot(x - fr._delBtnHit.cx, y - fr._delBtnHit.cy);
      if (d <= fr._delBtnHit.r) return i;
    }
  }
  return -1;
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  mouseDownX = e.pageX;
  mouseDownY = e.pageY;
  hasMovedMouse = false;
  suppressNextCanvasClick = false;

  if (e.button === 0) {
    const hitCropDelIdx = findHitPdfCropDeleteBtn(e.offsetX, e.offsetY);
    if (hitCropDelIdx !== -1) {
      e.preventDefault();
      suppressNextCanvasClick = true;
      deleteLongitudinalItem(hitCropDelIdx, e);
      return;
    }
  }

  // รอบ 30 / รอบ 50: คลิกเลือกและจับป้ายข้อมูลบนภาพเพื่อลากย้าย (เช็คก่อนจุดดินเดิมและการแพนภาพ)
  if (e.button === 0 && activeMediaViewTab !== 'draw' && currentMode !== 'crop_pdf' && currentMode !== 'zoomwindow') {
    const hitLabel = findHitCanvasLabel(e.offsetX, e.offsetY);
    if (hitLabel) {
      e.preventDefault();
      suppressNextCanvasClick = true;
      window.selectedCanvasLabel = hitLabel;
      draggingCanvasLabel = {
        label: hitLabel,
        id: hitLabel.id || null,
        dx: e.offsetX - hitLabel.x,
        dy: e.offsetY - hitLabel.y,
        moved: false
      };
      canvas.style.cursor = 'move';
      redraw();
      return;
    } else {
      window.selectedCanvasLabel = null;
    }
  }

  if (e.button === 0 && currentMode === 'pan' && currentTab === 'ground') {
    const hitPt = findHitTableGroundPoint(e.offsetX, e.offsetY);
    if (hitPt) {
      const hitChId = hitPt.channelId;
      const hitGrpKey = 'ground_ch_' + hitChId;
      const isHitLocked = (typeof groundGroupState === 'undefined' || !groundGroupState[hitGrpKey] || groundGroupState[hitGrpKey].locked !== false);

      // ตรวจสอบว่าเส้นที่แก้ไขตรงกับชุดข้อมูลที่กำลังเปิดแก้ไขหรือไม่
      if (hitChId !== activeChannelId) {
        const unlockedIds = getActiveUnlockedGroundChannelIds();
        if (unlockedIds.length > 0 && !unlockedIds.includes(hitChId)) {
          alert(`เส้นที่คลิกเป็นของ "${getChannelDisplayName(hitChId)}" ไม่ตรงกับชุดข้อมูลที่กำลังแก้ไข ("${getChannelDisplayName(activeChannelId)}")`);
          suppressNextCanvasClick = true;
          return;
        }
        if (isHitLocked) {
          alert(`เส้นของ "${getChannelDisplayName(hitChId)}" ถูกล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ของชุดข้อมูลนั้นก่อนแก้ไขเส้น`);
          suppressNextCanvasClick = true;
          return;
        }
        // หากชุดข้อมูลนั้นเปิดแก้ไขอยู่แล้ว ให้สลับ activeChannelId มาที่ชุดนั้น
        activeChannelId = hitChId;
      } else if (isHitLocked) {
        alert(`ชุดข้อมูล "${getChannelDisplayName(hitChId)}" ถูกล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ก่อนเลือกหรือลากจุดบนเส้น`);
        suppressNextCanvasClick = true;
        return;
      }

      selectedGroundPoint = { channelId: hitChId, gIdx: hitPt.gIdx };
      draggingGroundPoint = { channelId: hitChId, gIdx: hitPt.gIdx, pointObj: hitPt };
      canvas.style.cursor = 'move';
      suppressNextCanvasClick = true;
      redraw();
      return;
    }

    // หากคลิกโดนแนวเส้นที่คำนวณของชุดข้อมูลอื่นที่ไม่ตรงกับชุดที่กำลังแก้ไข ให้แจ้งเตือน
    const nearLine = findNearestCalculatedLineChannel(e.offsetX, e.offsetY);
    if (nearLine && nearLine.dist <= 6 && nearLine.channelId !== activeChannelId) {
      alert(`เส้นที่คลิกเป็นของ "${getChannelDisplayName(nearLine.channelId)}" ไม่ตรงกับชุดข้อมูลที่กำลังแก้ไข ("${getChannelDisplayName(activeChannelId)}")`);
      suppressNextCanvasClick = true;
      return;
    }
  }

  if (e.button === 1 || (e.button === 0 && currentMode !== 'zoomwindow' && currentMode !== 'crop_pdf')) {
    isPanning = true;
    startX = e.pageX - viewport.offsetLeft;
    startY = e.pageY - viewport.offsetTop;
    scrollLeft = viewport.scrollLeft;
    scrollTop = viewport.scrollTop;
    crossSectionStartPanX = typeof crossSectionPanX === "number" ? crossSectionPanX : 0;
    crossSectionStartPanY = typeof crossSectionPanY === "number" ? crossSectionPanY : 0;
  } else if (e.button === 0 && (currentMode === 'zoomwindow' || currentMode === 'crop_pdf')) {
    isZoomWindow = true;
    zoomStartX = e.offsetX;
    zoomStartY = e.offsetY;

    zoomBox.style.left = (canvas.offsetLeft + zoomStartX) + 'px';
    zoomBox.style.top = (canvas.offsetTop + zoomStartY) + 'px';
    zoomBox.style.width = '0px';
    zoomBox.style.height = '0px';
    zoomBox.style.display = 'block';
  }
});

window.addEventListener('mouseup', (e) => {
  // รอบ 30: จบการลากป้ายข้อมูลบนภาพ
  if (draggingCanvasLabel) {
    const moved = draggingCanvasLabel.moved;
    draggingCanvasLabel = null;
    canvas.style.cursor = 'default';
    if (moved) {
      if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
      // บันทึกตำแหน่งป้ายไว้ในไฟล์โปรเจกต์ (canvasLabels ถูกบันทึกใน saveProjectJSON)
      redraw();
    }
    suppressNextCanvasClick = true;
    return;
  }

  if (draggingGroundPoint) {
    const chId = draggingGroundPoint.channelId;
    const draggedRow = groundRowsData[draggingGroundPoint.gIdx];
    draggingGroundPoint = null;

    // จัดเรียงลำดับ กม. ของแถวภายในชุดข้อมูลนั้นใหม่หลังลากเสร็จ
    const chRows = groundRowsData.filter(r => r.channelId === chId);
    if (chRows.length > 2) {
      const firstRow = chRows[0];
      const lastRow = chRows[chRows.length - 1];
      const midRows = chRows.slice(1, chRows.length - 1).sort((a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0));
      const sortedChRows = [firstRow, ...midRows, lastRow];
      let ptr = 0;
      for (let i = 0; i < groundRowsData.length; i++) {
        if (groundRowsData[i].channelId === chId) {
          groundRowsData[i] = sortedChRows[ptr++];
        }
      }
    }
    if (draggedRow) {
      const newGIdx = groundRowsData.indexOf(draggedRow);
      if (newGIdx !== -1) {
        selectedGroundPoint = { channelId: chId, gIdx: newGIdx };
      }
    }
    if (typeof updateTable === 'function') updateTable();
    if (typeof autoUpdateGroundDrawingLine === 'function') autoUpdateGroundDrawingLine(chId);
    applyRedCursor();
    return;
  }

  if (isPanning) {
    isPanning = false;
    canvas.classList.remove('panning');
  }

  if (isZoomWindow) {
    isZoomWindow = false;
    zoomBox.style.display = 'none';
    // การซูม win / ตีกรอบ ถือเป็น "ลาก" — คลิกที่เบราว์เซอร์ยิงตามหลังต้องไม่ถูกนำไปวางจุด P1/P2
    suppressNextCanvasClick = true;

        const zoomEndX = e.target === canvas ? e.offsetX : zoomStartX;
        const zoomEndY = e.target === canvas ? e.offsetY : zoomStartY;

        if (currentMode === 'crop_pdf') {
          finalizePdfCropFrameBox(zoomStartX, zoomStartY, zoomEndX, zoomEndY);
          return;
        }

        const boxW = Math.abs(zoomEndX - zoomStartX);
        const boxH = Math.abs(zoomEndY - zoomStartY);

        if (boxW > 8 && boxH > 8) {
          const centerX = (zoomStartX + zoomEndX) / 2;
          const centerY = (zoomStartY + zoomEndY) / 2;
          const scaleX = viewport.clientWidth / boxW;
          const scaleY = viewport.clientHeight / boxH;
          const factor = Math.min(scaleX, scaleY);

          const oldScale = imgScale;
          let newScale = oldScale * factor;
          newScale = Math.max(0.05, Math.min(20.0, newScale));

          imgScale = newScale;
          updateCanvasSize(oldScale);
          redraw();

          viewport.scrollLeft = (centerX * (newScale / oldScale)) - (viewport.clientWidth / 2);
          viewport.scrollTop = (centerY * (newScale / oldScale)) - (viewport.clientHeight / 2);
        }
        setMode(prevStepMode || 'pan');
      }
    });

canvas.addEventListener('mousemove', (e) => {
  // รอบ 30: ลากย้ายป้ายข้อมูลบนภาพ (ต้องเช็คก่อนจุดดินเดิม)
  if (draggingCanvasLabel && draggingCanvasLabel.label) {
    e.preventDefault();
    const l = draggingCanvasLabel.label;
    l.x = e.offsetX - draggingCanvasLabel.dx;
    l.y = e.offsetY - draggingCanvasLabel.dy;
    const lw = (img && img.width && imgScale > 0) ? (img.width * imgScale) : 0;
    const lh = (img && img.height && imgScale > 0) ? (img.height * imgScale) : 0;
    if (lw > 0 && lh > 0) {
      l.normX = l.x / lw;
      l.normY = l.y / lh;
    }
    l._userMoved = true;
    draggingCanvasLabel.moved = true;
    canvas.style.cursor = 'move';
    redraw();
    return;
  }

  if (draggingGroundPoint) {
    e.preventDefault();
    const chId = draggingGroundPoint.channelId;
    const gIdx = draggingGroundPoint.gIdx;
    const row = groundRowsData[gIdx];
    const cal = getChannelCalibParams(chId);
    if (row && row.channelId === chId && cal) {
      const { p1Ref, p2Ref, x1Val, y1Val, x2Val, y2Val } = cal;
      let xData = x1Val + ((e.offsetX - p1Ref.x) / (p2Ref.x - p1Ref.x)) * (x2Val - x1Val);
      let yData = y1Val + ((e.offsetY - p1Ref.y) / (p2Ref.y - p1Ref.y)) * (y2Val - y1Val);

      let dimItem = (typeof dimensionRows !== 'undefined') ? dimensionRows.find(d => d.channelId === chId) : null;
      let kStart = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
      let kEndRaw = (typeof getChannelKmEnd === 'function') ? getChannelKmEnd(chId) : null;
      let kEnd = (kEndRaw !== "" && kEndRaw !== undefined && kEndRaw !== null && !isNaN(parseFloat(kEndRaw))) ? parseFloat(kEndRaw) : kStart;
      let kMin = Math.min(kStart, kEnd);
      let kMax = Math.max(kStart, kEnd);

      if (row.isBoundary) {
        // จุดขอบเขตเริ่มต้น/สิ้นสุดล็อกค่า กม. ไว้ ปรับได้เฉพาะระดับดินเดิม
        xData = parseFloat(row.km);
      } else {
        xData = Math.round(Math.max(kMin, Math.min(kMax, xData)));
        row.km = xData;
      }
      row.groundElevation = Number(yData).toFixed(2);

      let px = p1Ref.x + ((xData - x1Val) / (x2Val - x1Val)) * (p2Ref.x - p1Ref.x);
      let py = p1Ref.y + ((parseFloat(row.groundElevation) - y1Val) / (y2Val - y1Val)) * (p2Ref.y - p1Ref.y);
      draggingGroundPoint.pointObj.x = px;
      draggingGroundPoint.pointObj.y = py;
      draggingGroundPoint.pointObj.xData = xData;
      draggingGroundPoint.pointObj.yData = parseFloat(row.groundElevation);
      canvas.style.cursor = 'move';
      redraw();
    }
    return;
  }

  if (isPanning) {
    const moveDist = Math.hypot(e.pageX - mouseDownX, e.pageY - mouseDownY);
    if (moveDist > 4) {
      hasMovedMouse = true;
      canvas.classList.add('panning');
    }
    e.preventDefault();
    if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'draw') {
      crossSectionPanX = crossSectionStartPanX + (e.pageX - mouseDownX);
      crossSectionPanY = crossSectionStartPanY + (e.pageY - mouseDownY);
      redraw();
      return;
    }
    const x = e.pageX - viewport.offsetLeft;
    const y = e.pageY - viewport.offsetTop;
    viewport.scrollLeft = scrollLeft - (x - startX);
    viewport.scrollTop = scrollTop - (y - startY);
    return;
  }

  if (isZoomWindow) {
    const currentX = e.offsetX;
    const currentY = e.offsetY;
    const left = Math.min(zoomStartX, currentX);
    const top = Math.min(zoomStartY, currentY);
    const width = Math.abs(currentX - zoomStartX);
    const height = Math.abs(currentY - zoomStartY);

    zoomBox.style.left = (canvas.offsetLeft + left) + 'px';
    zoomBox.style.top = (canvas.offsetTop + top) + 'px';
    zoomBox.style.width = width + 'px';
    zoomBox.style.height = height + 'px';
    return;
  }

  // เปลี่ยนเมาส์เป็น pointer เมื่อชี้ปุ่มกากบาท (✕) ท้ายชื่อกรอบรูปบนหน้า PDF หรือเป็น move เมื่อชี้ป้ายข้อมูลที่ลากย้ายได้
  if (activeMediaViewTab === 'pdf' && findHitPdfCropDeleteBtn(e.offsetX, e.offsetY) !== -1) {
    canvas.style.cursor = 'pointer';
  } else if (activeMediaViewTab !== 'draw' && currentMode !== 'crop_pdf' && currentMode !== 'zoomwindow' && findHitCanvasLabel(e.offsetX, e.offsetY)) {
    canvas.style.cursor = 'move';
  } else if (currentMode === 'pan' && currentTab === 'ground') {
    const hitPt = findHitTableGroundPoint(e.offsetX, e.offsetY);
    if (hitPt) {
      const grpKey = 'ground_ch_' + hitPt.channelId;
      const isUnlocked = (typeof groundGroupState !== 'undefined' && groundGroupState[grpKey] && groundGroupState[grpKey].locked === false);
      canvas.style.cursor = (hitPt.channelId === activeChannelId && isUnlocked) ? 'move' : 'not-allowed';
    } else {
      applyRedCursor();
    }
  } else {
    applyRedCursor();
  }

  if (img.src && isMagnifierOpen) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const magDpr = getDeviceDPR();
    const srcDpr = renderDPR || 1;

    magCtx.setTransform(1, 0, 0, 1, 0, 0);
    magCtx.clearRect(0, 0, magCanvas.width, magCanvas.height);
    magCtx.setTransform(magDpr, 0, 0, magDpr, 0, 0);

    const sourceW = MAG_SIZE / MAG_ZOOM;
    const sourceH = MAG_SIZE / MAG_ZOOM;
    const sourceX = mouseX - sourceW / 2;
    const sourceY = mouseY - sourceH / 2;

    // ต้นทางอ่านจาก bitmap ของ canvas หลัก (ต้องคูณ srcDpr) ปลายทางเป็นพิกัด logical
    magCtx.drawImage(
      canvas,
      sourceX * srcDpr, sourceY * srcDpr, sourceW * srcDpr, sourceH * srcDpr,
      0, 0, MAG_SIZE, MAG_SIZE
    );

    magCtx.strokeStyle = DEFAULT_CURSOR_COLOR;
    magCtx.lineWidth = 1.0;
    magCtx.beginPath();
    magCtx.moveTo(Math.floor(MAG_SIZE / 2) + 0.5, 0);
    magCtx.lineTo(Math.floor(MAG_SIZE / 2) + 0.5, MAG_SIZE);
    magCtx.moveTo(0, Math.floor(MAG_SIZE / 2) + 0.5);
    magCtx.lineTo(MAG_SIZE, Math.floor(MAG_SIZE / 2) + 0.5);
    magCtx.stroke();
  }
});

canvas.addEventListener('click', (e) => {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }
  if (e.button !== 0 || hasMovedMouse || currentMode === 'pan' || currentMode === 'zoomwindow') return;
  const x = e.offsetX;
  const y = e.offsetY;

  if (currentMode === 'p1' || currentMode === 'p2') {
    refPixels[currentMode] = { x, y };
    // รอบ 31: บันทึก P1/P2 ลง groundGroupState ของ active channel (เพื่อให้ P1/P2 ประจำแต่ละชุด)
    if (typeof activeChannelId !== 'undefined' && activeChannelId !== null && typeof groundGroupState !== 'undefined') {
      let grpKey = 'ground_ch_' + activeChannelId;
      if (groundGroupState[grpKey] === undefined) {
        groundGroupState[grpKey] = { locked: true, collapsed: true };
      }
      let refKey = (currentMode === 'p1') ? 'p1Ref' : 'p2Ref';
      groundGroupState[grpKey][refKey] = { x: x, y: y };
    }
    // รอบ 49 / รอบ 50: ปุ่ม "กำหนด P1,P2" ให้คลิกกำหนด P1 แล้วสลับเป็น P2 ต่อเนื่องในคราวเดียวทันที และเมื่อครบ P2 ให้วาดเส้นดินเดิมของสายนั้นทันที
    const finishedP2 = (currentMode === 'p2');
    if (currentMode === 'p1') {
      setMode('p2');
    } else if (currentMode === 'p2') {
      setMode('pan');
    }
    if (finishedP2 && typeof activeChannelId !== 'undefined' && activeChannelId !== null) {
      let grpKeyDone = 'ground_ch_' + activeChannelId;
      if (typeof groundGroupState !== 'undefined' && groundGroupState[grpKeyDone]) {
        if (groundGroupState[grpKeyDone].showDrawing === undefined) {
          groundGroupState[grpKeyDone].showDrawing = true;
        }
      }
      if (typeof drawGroundFromTable === 'function') {
        drawGroundFromTable(activeChannelId, true);
      }
    }
    // sync ค่า refPixels ลง toolbar (เพื่อไม่ให้ flow อื่นพัง)
    if (typeof updateTable === 'function') updateTable();
    redraw();
  } else if (currentMode === 'add_ground_pt') {
    let grpKey = 'ground_ch_' + activeChannelId;
    if (typeof groundGroupState !== 'undefined' && groundGroupState[grpKey] && groundGroupState[grpKey].locked !== false) {
      alert('ชุดข้อมูลนี้ล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ก่อนเพิ่มจุด');
      setMode('pan');
      return;
    }

    // ตรวจสอบว่าคลิกบนเส้นของชุดข้อมูลอื่นหรือไม่
    const nearLine = findNearestCalculatedLineChannel(x, y);
    if (nearLine && nearLine.channelId !== activeChannelId && nearLine.dist <= 10) {
      alert(`เส้นที่คลิกเป็นของ "${getChannelDisplayName(nearLine.channelId)}" ไม่ตรงกับชุดข้อมูลที่กำลังแก้ไข ("${getChannelDisplayName(activeChannelId)}")`);
      return;
    }

    const cal = getChannelCalibParams(activeChannelId);
    if (!cal) {
      alert('กรุณากำหนดจุด P1 และ P2 ของชุดข้อมูลนี้ให้ครบถ้วนก่อนเพิ่มจุด');
      setMode('pan');
      return;
    }
    const { p1Ref, p2Ref, x1Val, y1Val, x2Val, y2Val } = cal;
    let xData = x1Val + ((x - p1Ref.x) / (p2Ref.x - p1Ref.x)) * (x2Val - x1Val);
    let yData = y1Val + ((y - p1Ref.y) / (p2Ref.y - p1Ref.y)) * (y2Val - y1Val);

    let dimItem = (typeof dimensionRows !== 'undefined') ? dimensionRows.find(d => d.channelId === activeChannelId) : null;
    let kStart = (dimItem && dimItem.kmStart !== undefined) ? parseFloat(dimItem.kmStart) || 0 : 0;
    let kEndRaw = (typeof getChannelKmEnd === 'function') ? getChannelKmEnd(activeChannelId) : null;
    let kEnd = (kEndRaw !== "" && kEndRaw !== undefined && kEndRaw !== null && !isNaN(parseFloat(kEndRaw))) ? parseFloat(kEndRaw) : null;

    if (kEnd === null) {
      alert('กรุณากรอก กม.สิ้นสุด ในแท็บมิติคูส่งน้ำก่อนเพิ่มจุด');
      return;
    }
    let kMin = Math.min(kStart, kEnd);
    let kMax = Math.max(kStart, kEnd);

    if (xData <= kMin || xData >= kMax) {
      alert(`จุดที่เพิ่มต้องอยู่ในช่วง กม. ของชุดข้อมูลนี้ (${formatKmDisplay(kMin)} ถึง ${formatKmDisplay(kMax)})`);
      return;
    }

    let newRow = {
      channelId: activeChannelId,
      isDynamicRow: true,
      isBoundary: false,
      km: Math.round(xData),
      groundElevation: Number(yData).toFixed(2)
    };

    const chRows = groundRowsData.filter(r => r.channelId === activeChannelId);
    if (chRows.length >= 2) {
      const firstRow = chRows[0];
      const lastRow = chRows[chRows.length - 1];
      const midRows = [...chRows.slice(1, chRows.length - 1), newRow].sort((a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0));
      const newChRows = [firstRow, ...midRows, lastRow];
      const rebuilt = [];
      let inserted = false;
      for (let i = 0; i < groundRowsData.length; i++) {
        if (groundRowsData[i].channelId === activeChannelId) {
          if (!inserted) {
            rebuilt.push(...newChRows);
            inserted = true;
          }
        } else {
          rebuilt.push(groundRowsData[i]);
        }
      }
      groundRowsData = rebuilt;
    } else {
      groundRowsData.push(newRow);
    }

    const newGIdx = groundRowsData.indexOf(newRow);
    selectedGroundPoint = newGIdx !== -1 ? { channelId: activeChannelId, gIdx: newGIdx } : null;
    setMode('pan');
    if (typeof updateTable === 'function') updateTable();
    if (typeof autoUpdateGroundDrawingLine === 'function') autoUpdateGroundDrawingLine(activeChannelId);
  } else if (currentMode === 'data') {
    let grpKey = 'ground_ch_' + activeChannelId;
    if (typeof groundGroupState !== 'undefined' && groundGroupState[grpKey] && groundGroupState[grpKey].locked !== false) {
      alert('ชุดข้อมูลนี้ล็อกอยู่ กรุณากดปุ่ม "✔ แก้ไข" ก่อนลากเส้นดินเดิม');
      setMode('pan');
      return;
    }
    // รอบ 40: ใช้จุดอ้างอิงของชุดข้อมูลที่กำลังแก้ไข (ไม่ใช่ refPixels กลาง)
    //   เดิมใช้ refPixels → สลับชุดข้อมูลแล้วลากเส้นดินเดิมด้วยจุดของชุดเก่า → เส้นผิดตำแหน่ง
    const _cal = getChannelCalibParams(activeChannelId);
    if (!_cal) {
      alert('กรุณากำหนดจุด P1 และ P2 ของชุดข้อมูลนี้ก่อนลากเส้นดินเดิม');
      return;
    }
    const _p1 = _cal.p1Ref, _p2 = _cal.p2Ref;
    const x1Val = _cal.x1Val, y1Val = _cal.y1Val, x2Val = _cal.x2Val, y2Val = _cal.y2Val;

    const pixelDx = _p2.x - _p1.x;
    const pixelDy = _p2.y - _p1.y;
    const coordDx = x2Val - x1Val;
    const coordDy = y2Val - y1Val;

    if (pixelDx === 0 || coordDx === 0) {
      alert('ไม่สามารถคำนวณจุดได้: จุด P1 และ P2 อยู่ในแนวแกน X เดียวกัน (หารด้วยศูนย์)');
      return;
    }
    if (pixelDy === 0 || coordDy === 0) {
      alert('ไม่สามารถคำนวณจุดได้: จุด P1 และ P2 อยู่ในแนวแกน Y เดียวกัน (หารด้วยศูนย์)');
      return;
    }

    let xData = x1Val + ((x - _p1.x) / pixelDx) * coordDx;
    let yData = y1Val + ((y - _p1.y) / pixelDy) * coordDy;

    let currentChannel = getChannelById(activeChannelId);
    if (currentChannel && currentChannel.rows && currentChannel.rows.length >= 2) {
      let validPoints = currentChannel.rows.filter(r => r.data.x !== "" && !isNaN(r.data.x));
      if (validPoints.length >= 2) {
        let minX = Math.min(...validPoints.map(r => parseFloat(r.data.x)));
        let maxX = Math.max(...validPoints.map(r => parseFloat(r.data.x)));
        if (minX !== maxX) {
          if (xData < minX) xData = minX;
          if (xData > maxX) xData = maxX;
        }
      }
    }

    let pixelX = _p1.x + ((xData - x1Val) / coordDx) * pixelDx;

    manualGroundLinePoints.push({
      x: pixelX,
      y: y,
      xData: xData,
      yData: yData,
      channelId: activeChannelId
    });
    manualGroundLinePoints.sort((a, b) => {
      let chA = a.channelId !== undefined ? a.channelId : 0;
      let chB = b.channelId !== undefined ? b.channelId : 0;
      if (chA !== chB) return chA - chB;
      return a.xData - b.xData;
    });
    // รอบ 41: บันทึกภาพวาดลงช่องของแท็บที่กำลังดูอยู่
    if (typeof syncDrawingStateToCurrentTab === 'function') syncDrawingStateToCurrentTab();
    redraw();
  }
});

function redraw() {
  const dpr = renderDPR || 1;

  // ล้างด้วย transform ตรง (พิกัด bitmap) แล้วกลับมาใช้พิกัด logical สำหรับวาดเส้นทั้งหมด
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // แท็บ 3: ส่วนแสดงรูปตัดตามขวาง -> วาดรูปตัดตามขวางตามแถวข้อมูล
  if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'draw') {
    const logicalW = Math.round(canvas.width / dpr) || 800;
    const logicalH = Math.round(canvas.height / dpr) || 500;
    try {
      drawCrossSectionDiagram(ctx, logicalW, logicalH);
    } catch (err) {
      console.error('[drawCrossSectionDiagram error]', err);
    }
    return;
  }

  // แท็บ 1: ส่วนแสดงไฟล์ PDF -> ถ้ายังไม่ได้อัปโหลดไฟล์ PDF และไม่มีภาพของแท็บนี้ ไม่ต้องแสดงอะไร (หน้าว่าง)
  if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'pdf' && !pdfDoc && (!img || !img.src)) {
    return;
  }

  const logicalW = img.width * imgScale;
  const logicalH = img.height * imgScale;

  if (img.src && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, logicalW, logicalH);
  }

  // รอบ 31 / รอบ 49: helper ตรวจว่า channel นั้น "ซ่อน" การวาดเส้นดินเดิมและจุด P1/P2 หรือไม่
  function _isChannelHidden(chId) {
    if (chId === undefined || chId === null) return false;
    if (typeof groundGroupState === 'undefined') return false;
    let grpKey = 'ground_ch_' + chId;
    let grp = groundGroupState[grpKey];
    if (!grp) return false;
    return grp.showDrawing === false;
  }

  // รอบ 49: helper ตรวจว่า channel นั้น "ซ่อน" เส้นระดับ (แท็บระดับคูส่งน้ำ) หรือไม่
  function _isLevelChannelHidden(chId) {
    if (chId === undefined || chId === null) return false;
    if (typeof levelGroupState !== 'undefined' && levelGroupState) {
      let lGrp = levelGroupState['ch_' + chId];
      if (lGrp && typeof lGrp.showLevelLines === 'boolean') {
        return lGrp.showLevelLines === false;
      }
    }
    return _isChannelHidden(chId);
  }

  // รอบ 34 / รอบ 49: แสดงจุด P1 และ P2 แยกแสดงแต่ละสายตามสถานะปุ่ม "แสดงเส้นดินเดิม/ซ่อนเส้นดินเดิม" ของสายนั้น
  const curFrameIdForRef = (typeof getCurrentDisplayedFrameId === 'function') ? getCurrentDisplayedFrameId() : null;
  const activeChId = (typeof activeChannelId !== 'undefined' && activeChannelId !== null) ? activeChannelId : 1;
  const aiRp = (curFrameIdForRef && typeof aiRefPoints !== 'undefined' && aiRefPoints) ? aiRefPoints[curFrameIdForRef] : null;

  // รอบ 41: ปุ่มแสดง/ซ่อนจุด P1 P2 (แยกต่อแท็บ — ไม่กระทบแท็บอื่น)
  const _refTabKey = (typeof activeMediaViewTab !== 'undefined') ? activeMediaViewTab : 'pdf';
  const _showRefPoints = (typeof refPointsVisibility !== 'undefined' && refPointsVisibility)
    ? (refPointsVisibility[_refTabKey] !== false)
    : true;

  if (_showRefPoints) {
    const chIdsToDrawRef = [];
    if (typeof channels !== 'undefined' && Array.isArray(channels) && channels.length > 0) {
      channels.forEach(ch => { if (ch && ch.id !== undefined) chIdsToDrawRef.push(ch.id); });
    }
    if (!chIdsToDrawRef.includes(activeChId)) chIdsToDrawRef.push(activeChId);

    const drawnRefCoords = new Set();
    chIdsToDrawRef.forEach(chId => {
      // รอบ 49: ถ้าสายนี้ปิด "ซ่อนเส้นดินเดิม" ให้ซ่อนจุด P1, P2 ของสายนี้ด้วย
      if (_isChannelHidden(chId)) return;
      const grp = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState['ground_ch_' + chId] : null;
      const isAct = (Number(chId) === Number(activeChId));
      ['p1', 'p2'].forEach(key => {
        let pt = (grp && grp[key + 'Ref']) ? grp[key + 'Ref'] : null;
        if (!pt && isAct) pt = refPixels[key];
        if (!pt && isAct && aiRp && aiRp[key] && logicalW > 0 && logicalH > 0) {
          pt = { x: aiRp[key].x * logicalW, y: aiRp[key].y * logicalH };
        }
        if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return;
        const coordSig = `${key}_${Math.round(pt.x)}_${Math.round(pt.y)}`;
        if (drawnRefCoords.has(coordSig)) return;
        drawnRefCoords.add(coordSig);

        let kmVal = (grp && grp[key + 'Km'] !== undefined && grp[key + 'Km'] !== '') ? grp[key + 'Km'] : (isAct && aiRp && aiRp[key] ? aiRp[key].km : '');
        let elevVal = (grp && grp[key + 'Elev'] !== undefined && grp[key + 'Elev'] !== '') ? grp[key + 'Elev'] : (isAct && aiRp && aiRp[key] ? aiRp[key].elev : '');
        const kmStr = (kmVal !== '' && kmVal !== null && kmVal !== undefined && !isNaN(Number(kmVal)))
          ? ((typeof formatKmDisplay === 'function') ? formatKmDisplay(Number(kmVal)) : String(kmVal))
          : '';
        const elevStr = (elevVal !== '' && elevVal !== null && elevVal !== undefined && !isNaN(Number(elevVal)))
          ? ('+' + Number(elevVal).toFixed(2))
          : '';
        const badgeText = (kmStr || elevStr)
          ? `${key.toUpperCase()} (${[kmStr ? 'กม.' + kmStr : '', elevStr].filter(Boolean).join(', ')})`
          : key.toUpperCase();

        ctx.save();
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px Arial';
        let tw = badgeText.length * 6.5;
        try {
          const m = ctx.measureText(badgeText);
          if (m && m.width > 0) tw = m.width;
        } catch (_) {}
        const bx = (key === 'p2' && pt.x > logicalW * 0.75) ? (pt.x - tw - 14) : (pt.x + 8);
        const by = pt.y - 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(bx - 3, by - 9, tw + 6, 16);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 3, by - 9, tw + 6, 16);
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx, by - 1);
        ctx.restore();
      });
    });
  }   // รอบ 41 / รอบ 49: จบการวาดจุด P1/P2 แยกตามสาย

  // รอบ 41: ใช้สถานะการแสดงเลเยอร์ของแท็บที่กำลังดูอยู่ (แต่ละแท็บแยกกัน)
  const _vis = (typeof getOverlayVisibilityForCurrentTab === 'function')
    ? getOverlayVisibilityForCurrentTab()
    : ((typeof overlayVisibility !== 'undefined' && overlayVisibility) ? overlayVisibility : {});

  // 0. วาดกรอบรูปที่ตีไว้บนหน้า PDF (แสดงในแท็บส่วนแสดงไฟล์ PDF เมื่อเปิด "แสดงกรอบรูป")
  if (activeMediaViewTab === 'pdf' && _vis.cropFrames !== false && typeof pdfCropFrames !== 'undefined' && pdfCropFrames.length > 0) {
    ctx.save();
    pdfCropFrames.forEach((fr, idx) => {
      if (fr.source && fr.source !== 'pdf_crop') return;
      if (typeof fr.w !== 'number' || fr.w <= 0) return;
      if (isPDF && fr.pageNum && fr.pageNum !== pageNum) return;

      let rx = fr.x, ry = fr.y, rw = fr.w, rh = fr.h;
      if (typeof fr.normX === 'number' && logicalW > 0 && logicalH > 0) {
        rx = fr.normX * logicalW;
        ry = fr.normY * logicalH;
        rw = fr.normW * logicalW;
        rh = fr.normH * logicalH;
        fr.x = rx; fr.y = ry; fr.w = rw; fr.h = rh;
      }

      ctx.strokeStyle = '#6f42c1';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(111, 66, 193, 0.10)';
      ctx.fillRect(rx, ry, rw, rh);

      ctx.setLineDash([]);
      const labelStr = fr.name || ('รูปภาพ ' + (idx + 1));
      const textX = rx + 4;
      const textY = Math.max(16, ry - 6);
      ctx.fillStyle = '#6f42c1';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(labelStr, textX, textY);

      // วาดเครื่องหมายกากบาท (✕) ที่ท้ายชื่อกรอบเพื่อลบกรอบนั้น (ตามรูปที่ 1)
      let textW = labelStr.length * 7.5;
      try {
        if (typeof ctx.measureText === 'function') {
          const m = ctx.measureText(labelStr);
          if (m && m.width > 0) textW = m.width;
        }
      } catch (_) {}
      const delCx = textX + textW + 12;
      const delCy = textY - 4;
      const delR = 8;
      fr._delBtnHit = { cx: delCx, cy: delCy, r: delR + 3 };

      ctx.beginPath();
      ctx.arc(delCx, delCy, delR, 0, Math.PI * 2);
      // รอบ 32: เปลี่ยนจากสีแดงเป็นสีเทา (ตามที่ผู้ใช้ขอ)
      ctx.fillStyle = '#6b7280';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.moveTo(delCx - 3.2, delCy - 3.2);
      ctx.lineTo(delCx + 3.2, delCy + 3.2);
      ctx.moveTo(delCx + 3.2, delCy - 3.2);
      ctx.lineTo(delCx - 3.2, delCy + 3.2);
      ctx.stroke();
    });
    ctx.restore();
  }

  // กรองเส้น manualGroundLinePoints ตาม showDrawing และแยกวาดคนละเส้นตาม channelId (ไม่ให้ลากเชื่อมข้ามชุดข้อมูล)
  let _visibleManual = manualGroundLinePoints.filter(p => !_isChannelHidden(p.channelId));
  if (_vis.groundLine !== false && _visibleManual.length > 0) {
    let manualByChan = {};
    _visibleManual.forEach(p => {
      let key = p.channelId !== undefined ? p.channelId : '__default__';
      if (!manualByChan[key]) manualByChan[key] = [];
      manualByChan[key].push(p);
    });

    ctx.save();
    ctx.strokeStyle = '#0dcaf0';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    Object.values(manualByChan).forEach(pts => {
      pts.sort((a, b) => a.xData - b.xData);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    });
    ctx.restore();

    _visibleManual.forEach(dp => {
      ctx.fillStyle = '#0dcaf0';
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
      // ในรูป เส้นดินเดิมไม่ต้องแสดงค่าระดับ
    });
  }

  // รอบ 50 / รอบ 51: สร้างจุดใน tableGroundLinePoints เฉพาะสายที่ผู้ใช้กำหนด p1Ref และ p2Ref ของสายนั้นไว้แล้วเท่านั้น (ป้องกันไม่ให้วาดเส้นดินเดิมของสายอื่นซ้อนขึ้นมาในรูปเดียว)
  if (_vis.groundLine !== false && typeof groundRowsData !== 'undefined' && Array.isArray(groundRowsData) && typeof channels !== 'undefined' && Array.isArray(channels)) {
    channels.forEach(ch => {
      if (!ch || ch.id === undefined || _isChannelHidden(ch.id)) return;
      const gGrp = (typeof groundGroupState !== 'undefined' && groundGroupState) ? groundGroupState['ground_ch_' + ch.id] : null;
      if (!gGrp || !gGrp.p1Ref || !gGrp.p2Ref) return;
      const hasPts = Array.isArray(tableGroundLinePoints) && tableGroundLinePoints.some(p => p && Number(p.channelId) === Number(ch.id));
      if (hasPts) return;
      const cal = getChannelCalibParams(ch.id);
      if (!cal) return;
      const validRows = [];
      groundRowsData.forEach((r, gIdx) => {
        if (!r || Number(r.channelId) !== Number(ch.id)) return;
        const kmP = (typeof parseKmInput === 'function' && String(r.km).includes('+')) ? parseKmInput(r.km) : parseFloat(r.km);
        const elP = parseFloat(r.groundElevation);
        if (r.km !== '' && !isNaN(kmP) && r.groundElevation !== '' && !isNaN(elP)) {
          validRows.push({ r, gIdx, kmP, elP });
        }
      });
      if (validRows.length >= 2) {
        const chPts = validRows.map(({ r, gIdx, kmP, elP }) => ({
          x: cal.p1Ref.x + ((kmP - cal.x1Val) / (cal.x2Val - cal.x1Val)) * (cal.p2Ref.x - cal.p1Ref.x),
          y: cal.p1Ref.y + ((elP - cal.y1Val) / (cal.y2Val - cal.y1Val)) * (cal.p2Ref.y - cal.p1Ref.y),
          xData: kmP,
          yData: elP,
          channelId: ch.id,
          gIdx: gIdx,
          isBoundary: !!r.isBoundary
        })).sort((a, b) => a.xData - b.xData);
        tableGroundLinePoints = (Array.isArray(tableGroundLinePoints) ? tableGroundLinePoints : []).concat(chPts);
      }
    });
  }

  // รอบ 51: หากมีสายที่ตั้งจุด p1Ref/p2Ref แล้ว ให้แสดงเฉพาะเส้นดินเดิมของสายที่มี p1Ref และ p2Ref ของตัวเองจริง ๆ เท่านั้น (ป้องกันเส้นของสายอื่นที่ยังไม่ได้กำหนด P1/P2 โผล่ซ้อนขึ้นมาในรูปเดียว)
  const _anyChanHasOwnRef = (typeof groundGroupState !== 'undefined' && groundGroupState) &&
    Object.values(groundGroupState).some(g => g && g.p1Ref && g.p2Ref);
  if (_anyChanHasOwnRef && Array.isArray(tableGroundLinePoints)) {
    tableGroundLinePoints = tableGroundLinePoints.filter(p => {
      if (!p || p.channelId === undefined || p.channelId === null) return false;
      const g = groundGroupState['ground_ch_' + p.channelId];
      return !!(g && g.p1Ref && g.p2Ref);
    });
  }

  // กรอง tableGroundLinePoints ตาม showDrawing และแยกวาดคนละเส้นตาม channelId
  let _visibleTable = tableGroundLinePoints.filter(p => !_isChannelHidden(p.channelId));
  if (_vis.groundLine !== false && _visibleTable.length > 0) {
    let tableByChan = {};
    _visibleTable.forEach(p => {
      let key = p.channelId !== undefined ? p.channelId : '__default__';
      if (!tableByChan[key]) tableByChan[key] = [];
      tableByChan[key].push(p);
    });

    ctx.save();
    ctx.strokeStyle = '#fd7e14';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([3, 2]);
    Object.values(tableByChan).forEach(pts => {
      pts.sort((a, b) => a.xData - b.xData);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    });
    ctx.restore();

    _visibleTable.forEach(dp => {
      const isSelected = (typeof selectedGroundPoint !== 'undefined' && selectedGroundPoint && selectedGroundPoint.channelId === dp.channelId && selectedGroundPoint.gIdx === dp.gIdx);
      ctx.save();
      ctx.fillStyle = isSelected ? '#dc3545' : '#fd7e14';
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, isSelected ? 6.0 : 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffeb3b' : '#ffffff';
      ctx.lineWidth = isSelected ? 2.2 : 1.2;
      ctx.stroke();
      // ในรูป เส้นดินเดิมไม่ต้องแสดงค่าระดับ
      ctx.restore();
    });
  }

  // รอบ 31/34/49: กรอง canalLevelDrawingLines ตามสถานะแสดงเส้นระดับของแต่ละสาย
  let _visibleCanal = canalLevelDrawingLines.filter(l => !_isLevelChannelHidden(l.channelId));
  if (_vis.levelLine !== false && _visibleCanal.length > 0) {
    const hasMovableLvlLabels = (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) &&
      canvasLabels.some(l => l && l.fromLevelTable);
    ctx.save();
    _visibleCanal.forEach(line => {
      const lineColor = line.type === 'TBL' ? '#28a745' : (line.color || '#0056b3');
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = line.type === 'BL' ? 2.5 : 2.0;
      ctx.setLineDash(line.type === 'BL' ? [] : [4, 2]);
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = lineColor;
      ctx.font = 'bold 10px Arial';
      ctx.fillText(`${line.type}`, (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2 - 4);

      if (!hasMovableLvlLabels && _vis.elevationLabels !== false) {
        if (line.y1Val !== undefined && !isNaN(line.y1Val)) {
          ctx.fillText(Number(line.y1Val).toFixed(2), line.x1 + 4, line.y1 - 4);
        }
        if (line.y2Val !== undefined && !isNaN(line.y2Val)) {
          ctx.fillText(Number(line.y2Val).toFixed(2), line.x2 - 24, line.y2 - 4);
        }
      }

      if (!hasMovableLvlLabels && _vis.slopeLabels !== false && line.type === 'BL') {
        let slopeVal = line.slope;
        if (!slopeVal && typeof dimensionRows !== 'undefined') {
          let dimObj = dimensionRows.find(d => d.channelId === line.channelId);
          if (dimObj && dimObj.slope) slopeVal = dimObj.slope;
        }
        if (slopeVal) {
          ctx.font = 'bold 10px Arial';
          ctx.fillStyle = '#0d6efd';
          ctx.fillText(`S 1:${slopeVal}`, (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2 - 14);
        }
      }
    });
    ctx.restore();
  }

  // รอบ 49: ซิงก์ป้ายอาคารประกอบจากตารางเข้าสู่ canvasLabels โดยแสดงแนวดิ่ง (angle: -90),
  //         ถ้าอยู่ กม. เดียวกันให้รวมอยู่ในป้ายเดียวกัน และสามารถลากย้ายตำแหน่งได้
  const hasAiStructureLabelsOnFrame = (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) &&
    canvasLabels.some(l => l && l.kind === 'structure' && !l.fromStructureTable && (!l.frameId || !curFrameIdForRef || l.frameId === curFrameIdForRef));
  if (typeof canvasLabels !== 'undefined' && Array.isArray(canvasLabels)) {
    const prevStructMap = {};
    canvasLabels.forEach(l => {
      if (l && l.fromStructureTable && l.id) prevStructMap[l.id] = l;
    });
    canvasLabels = canvasLabels.filter(l => !(l && l.fromStructureTable));

    if (_vis.structures !== false && !hasAiStructureLabelsOnFrame && typeof structureRowsData !== 'undefined' && Array.isArray(structureRowsData)) {
      const groupedByChanKm = new Map();
      structureRowsData.forEach(s => {
        if (!s || !s.name || s.name === '-ไม่มี-' || s.km === '' || s.km === undefined || _isChannelHidden(s.channelId)) return;
        // รอบ 52: แสดงข้อมูลอาคารทุกแถวในตารางรวมถึงแถวแรกที่ กม. 0 (เช่น อาคารท่อส่งน้ำเข้านา (เดิม))
        if (typeof isStructureLabelsVisible === 'function') {
          let structKey = 'struct_ch_' + s.channelId;
          if (!isStructureLabelsVisible(structKey)) return;
        }
        const cal = getChannelCalibParams(s.channelId);
        if (!cal) return;
        const kmVal = parseFloat(s.km);
        if (isNaN(kmVal)) return;
        const kmRound = Math.round(kmVal * 100) / 100;
        const gKey = `${s.channelId}_${kmRound}`;
        if (!groupedByChanKm.has(gKey)) {
          groupedByChanKm.set(gKey, { channelId: s.channelId, kmVal: kmVal, kmRound: kmRound, cal: cal, rows: [] });
        }
        groupedByChanKm.get(gKey).rows.push(s);
      });

      groupedByChanKm.forEach((grp) => {
        const { channelId, kmVal, kmRound, cal, rows } = grp;
        const sx = cal.p1Ref.x + ((kmVal - cal.x1Val) / (cal.x2Val - cal.x1Val)) * (cal.p2Ref.x - cal.p1Ref.x);
        // รอบ 52: ขยับตำแหน่งป้ายอาคารให้เลื่อนขึ้นไปเหนือเส้นตารางสุดท้าย (topGridY) ไปอีก 1 ช่องค่าระดับ (oneElevGridPx)
        const topGridY = Math.min(cal.p1Ref.y, cal.p2Ref.y);
        const elevSpan = Math.max(1, Math.abs(cal.y2Val - cal.y1Val));
        const oneElevGridPx = Math.abs(cal.p2Ref.y - cal.p1Ref.y) / elevSpan;
        const sy = Math.max(10, topGridY - oneElevGridPx - 10);
        const kmLabel = (typeof kmHasDecimal === 'function' && kmHasDecimal(kmVal) && typeof formatKmDisplayDecimal === 'function')
          ? ('กม. ' + formatKmDisplayDecimal(kmVal))
          : ((typeof formatKmDisplay === 'function') ? ('กม. ' + formatKmDisplay(kmVal)) : ('กม. ' + kmVal));
        const itemLines = rows.map(r => (typeof computeStructureItemName === 'function') ? computeStructureItemName(r, channelId) : r.name);
        const combinedText = [kmLabel, ...itemLines].join('\n');
        const lblId = `tbl_struct_${channelId}_${kmRound}`;
        const prev = prevStructMap[lblId];
        if (prev) {
          // รอบ 50: ใช้ object เดิมเสมอ (ห้ามสร้างใหม่ทับขณะกำลังคลิกหรือลากเมาส์ เพราะจะทำให้ draggingCanvasLabel.label หลุดจากการอ้างอิง)
          prev.text = combinedText;
          prev.frameId = curFrameIdForRef || '';
          prev.angle = -90;
          prev.align = 'left';
          const isBeingDragged = (typeof draggingCanvasLabel !== 'undefined' && draggingCanvasLabel && (draggingCanvasLabel.label === prev || draggingCanvasLabel.id === lblId));
          if (!prev._userMoved && !isBeingDragged) {
            prev.x = sx;
            prev.y = sy;
            if (logicalW > 0 && logicalH > 0) {
              prev.normX = sx / logicalW;
              prev.normY = sy / logicalH;
            }
          }
          canvasLabels.push(prev);
        } else {
          canvasLabels.push({
            id: lblId,
            frameId: curFrameIdForRef || '',
            kind: 'structure',
            fromStructureTable: true,
            channelId: channelId,
            km: kmVal,
            text: combinedText,
            x: sx,
            y: sy,
            normX: logicalW > 0 ? (sx / logicalW) : undefined,
            normY: logicalH > 0 ? (sy / logicalH) : undefined,
            angle: -90,
            align: 'left',
            color: '#6f42c1',
            bgColor: 'rgba(255,255,255,0.90)',
            _userMoved: false
          });
        }
      });
    }
  }

  // รอบ 30: Label Layer — วาดป้ายข้อมูลที่ผู้ใช้จับย้ายได้ (ป้ายระดับดิน, ป้ายอาคารที่หมุนตามข้อความในรูป)
  drawCanvasLabels(ctx);
}

// รอบ 30: id ของกรอบรูปที่กำลังแสดงอยู่ตอนนี้ (ใช้กรองป้ายให้แสดงเฉพาะเฟรมของตัวเอง)
function getCurrentDisplayedFrameId() {
  if (typeof activeMediaViewTab !== 'undefined' && activeMediaViewTab === 'image') {
    if (typeof pdfCropFrames !== 'undefined' && Array.isArray(pdfCropFrames)
      && typeof activeCropFrameIndex !== 'undefined'
      && activeCropFrameIndex >= 0 && activeCropFrameIndex < pdfCropFrames.length) {
      const fr = pdfCropFrames[activeCropFrameIndex];
      return (fr && fr.id) ? fr.id : null;
    }
    return '__current_image__';
  }
  return null;   // แท็บ PDF → ไม่แสดงป้ายของกรอบ
}

// ===== รอบ 30: Label Layer =====
// ป้ายข้อมูลบนภาพ — ผู้ใช้จับย้ายได้, บันทึกตำแหน่งลงไฟล์ JSON ได้
//   kind: 'station' | 'elev' | 'structure' | 'slope' | 'level' | 'p1' | 'p2'
//   x, y   = พิกัดหน้าจอ (logical px)
//   angle  = มุม (องศา) สำหรับหมุนป้ายอาคารให้ตรงกับทิศข้อความในรูป
function drawCanvasLabels(c) {
  if (typeof canvasLabels === 'undefined' || !Array.isArray(canvasLabels) || canvasLabels.length === 0) return;
  if (activeMediaViewTab === 'draw') return;   // แท็บภาพวาดไม่ต้องวาดป้ายทับ
  if (!c) return;

  // รอบ 30: แสดงเฉพาะป้ายของกรอบที่กำลังดูอยู่ (ป้ายที่ผู้ใช้สร้างเองไม่มี frameId → แสดงทั้งหมด)
  const curFrameId = getCurrentDisplayedFrameId();
  // รอบ 41: ใช้สถานะของแท็บที่กำลังดูอยู่ (แต่ละแท็บแยกกัน)
  const _vis = (typeof getOverlayVisibilityForCurrentTab === 'function')
    ? getOverlayVisibilityForCurrentTab()
    : ((typeof overlayVisibility !== 'undefined' && overlayVisibility) ? overlayVisibility : {});

  c.save();

  // ── 1) เส้นดินเดิมที่ AI อ่านได้ (kind: 'ground', สีส้ม #fd7e14) ──
  if (_vis.groundLine !== false) {
    canvasLabels.forEach(l => {
      if (!l || l.kind !== 'ground' || l.hidden) return;
      if (typeof l.x !== 'number' || typeof l.y !== 'number') return;
      if (l.frameId && curFrameId && l.frameId !== curFrameId) return;
      const x2 = (typeof l.x2 === 'number') ? l.x2 : l.x;
      const y2 = (typeof l.y2 === 'number') ? l.y2 : l.y;
      c.strokeStyle = l.color || '#fd7e14';
      c.lineWidth = 2.4;
      c.setLineDash([4, 2]);
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(x2, y2);
      c.stroke();
      c.setLineDash([]);
      l._hitBox = { cx: l.x, cy: l.y, w: 0, h: 0 };
    });
  }

  // ── 2) เส้นระดับที่ AI อ่านได้ (kind: 'level', สีละเส้น: BL = #0056b3, TBL = #28a745, ไม่มีจุดกลมปลายเส้น) ──
  if (_vis.levelLine !== false) {
    canvasLabels.forEach(l => {
      if (!l || l.kind !== 'level' || l.hidden) return;
      if (typeof l.x !== 'number' || typeof l.y !== 'number') return;
      if (l.frameId && curFrameId && l.frameId !== curFrameId) return;
      const x2 = (typeof l.x2 === 'number') ? l.x2 : l.x;
      const y2 = (typeof l.y2 === 'number') ? l.y2 : l.y;
      c.strokeStyle = l.color || ((l.levelType === 'TBL') ? '#28a745' : '#0056b3');
      c.lineWidth = (l.levelType === 'TBL') ? 2.0 : 2.5;
      c.setLineDash((l.levelType === 'TBL') ? [4, 2] : []);
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(x2, y2);
      c.stroke();
      c.setLineDash([]);
      l._hitBox = { cx: l.x, cy: l.y, w: 0, h: 0 };   // เส้นไม่ใช่เป้าหมายลาก
    });
  }

  // ── 3) เรียงลำดับป้ายให้ป้าย 3 ระดับ (kind === 'elev') วาดอยู่ท้ายสุด (บนสุด) ──
  const orderedLabels = canvasLabels.slice().sort((a, b) => {
    const ka = (a && a.kind === 'elev') ? 1 : 0;
    const kb = (b && b.kind === 'elev') ? 1 : 0;
    return ka - kb;
  });

  // รอบ 49: เมื่อซูมเข้า (imgScale > 1) ขนาดตัวอักษรและกล่องป้ายไม่ลดขนาดลง (ขยายตามสัดส่วนซูมขั้นต่ำ >= 1)
  const zoomLabelScale = (typeof imgScale === 'number' && isFinite(imgScale) && imgScale > 1)
    ? Math.min(2.5, imgScale)
    : 1;

  orderedLabels.forEach(l => {
    if (!l || !l.text) return;
    if (l.hidden) return;
    if (l.kind === 'level' || l.kind === 'ground') return;   // วาดเส้นไปแล้ว
    // รอบ 49: ถ้าป้ายผูกกับสายที่ซ่อนเส้นระดับอยู่ ให้ซ่อนป้ายด้วย
    if (l.fromLevelTable && l.channelId !== undefined && typeof levelGroupState !== 'undefined' && levelGroupState) {
      const lGrp = levelGroupState['ch_' + l.channelId];
      if (lGrp && lGrp.showLevelLines === false) { l._hitBox = null; return; }
    }
    if (l.fromStructureTable && l.channelId !== undefined && typeof isStructureLabelsVisible === 'function') {
      if (!isStructureLabelsVisible('struct_ch_' + l.channelId)) { l._hitBox = null; return; }
    }
    // รอบ 34: ผูกสถานะปุ่มแสดงแท็บขวาให้ตรงกับสิ่งที่แสดงในรูป
    if (l.kind === 'elev' && _vis.elevationLabels === false) { l._hitBox = null; return; }
    if ((l.kind === 'structure' || l.kind === 'station' || l.kind === 'h') && _vis.structures === false) { l._hitBox = null; return; }
    if (l.kind === 'slope' && _vis.slopeLabels === false) { l._hitBox = null; return; }
    if (typeof l.x !== 'number' || typeof l.y !== 'number') return;
    // รอบ 30: แสดงเฉพาะป้ายของกรอบที่กำลังดูอยู่ (ป้ายที่ผู้ใช้สร้างเองไม่มี frameId → แสดงทั้งหมด)
    if (l.frameId && curFrameId && l.frameId !== curFrameId) return;

    const angle = (typeof l.angle === 'number') ? l.angle : 0;
    const color = l.color || '#111827';
    const isDragging = (typeof draggingCanvasLabel !== 'undefined' && draggingCanvasLabel && (draggingCanvasLabel.label === l || (l.id && draggingCanvasLabel.id === l.id))) ||
      (typeof window !== 'undefined' && window.selectedCanvasLabel && (window.selectedCanvasLabel === l || (l.id && window.selectedCanvasLabel.id === l.id)));

    c.save();
    c.translate(l.x, l.y);
    if (angle) c.rotate(angle * Math.PI / 180);

    // พื้นหลังกล่องป้าย
    // รอบ 32 / รอบ 49: ป้ายที่รวมกลุ่มแล้วมีหลายบรรทัด (คั่นด้วย "\n") → วาดเป็นกล่องเดียวหลายบรรทัด และเมื่อซูมเข้าขนาดไม่ลดขนาด
    const basePx = (l.bold === false) ? 10 : 11;
    const fontPx = Math.max(basePx, Math.round(basePx * zoomLabelScale));
    c.font = (l.bold === false ? '' : 'bold ') + fontPx + 'px Arial';
    const lines = String(l.text).split('\n');
    const lineH = Math.max(13, Math.round(13 * zoomLabelScale));
    let textW = 0;
    try {
      lines.forEach(t => {
        const m = c.measureText(t);
        if (m && m.width > textW) textW = m.width;
      });
    } catch (_) {}
    if (!textW) textW = Math.max.apply(null, lines.map(t => t.length * (6.5 * zoomLabelScale)));

    const padX = Math.max(4, Math.round(4 * zoomLabelScale));
    const padY = Math.max(2, Math.round(2 * zoomLabelScale));
    const boxW = textW + padX * 2;
    const boxH = lines.length * lineH + padY * 2;

    const isElevBox = (l.kind === 'elev');
    const isStructureBox = (l.kind === 'structure' || l.kind === 'station' || l.kind === 'h');

    // จุดที่ 3: ป้ายของ 3 ระดับ (isElevBox) ให้อยู่หลังค่าระดับ (ชิดซ้ายเริ่มจาก l.x ไปทางขวา)
    // และให้บรรทัดแรก (i = 0) อยู่ในระดับความสูงเท่ากับแถวแรกเสมอ (ty = 0 ที่ l.y)
    const boxLeft = isElevBox ? 0 : (-boxW / 2);
    const boxTop = isElevBox ? (-lineH / 2 - padY) : (-boxH / 2);

    c.fillStyle = l.bgColor || 'rgba(255,255,255,0.88)';
    c.fillRect(boxLeft, boxTop, boxW, boxH);
    if (isDragging) {
      c.strokeStyle = '#2563eb';
      c.lineWidth = 1.6;
      c.setLineDash([3, 2]);
      c.strokeRect(boxLeft, boxTop, boxW, boxH);
      c.setLineDash([]);
    }

    c.textAlign = (isStructureBox || isElevBox) ? 'left' : 'center';
    c.textBaseline = 'middle';
    const textX = isElevBox ? padX : (isStructureBox ? (-boxW / 2 + padX) : 0);

    // วาดแต่ละบรรทัด (ข้อความแรกอยู่บนสุด)
    lines.forEach((t, i) => {
      const ty = isElevBox ? (lineH * i) : (-boxH / 2 + padY + lineH * i + lineH / 2);
      const trimmed = String(t || '').trim();
      if (isStructureBox) {
        if (/^(?:กม\.?\s*)?\d+\s*\+\s*\d+/i.test(trimmed) || /^กม\./i.test(trimmed)) {
          c.fillStyle = '#0d47a1'; // สีน้ำเงินเข้มสำหรับ กม.
        } else if (/^h\s*=/i.test(trimmed)) {
          c.fillStyle = '#dc2626'; // สีแดงสำหรับค่า H
        } else {
          c.fillStyle = '#6f42c1'; // สีม่วงสำหรับชื่ออาคาร
        }
      } else if (isElevBox) {
        if (/^[SE]\d+/i.test(trimmed)) {
          c.fillStyle = '#111827'; // หัวป้าย S1/E1, S2/E2
        } else if (/^TBL\b/i.test(trimmed)) {
          c.fillStyle = '#28a745'; // สีเขียวสำหรับ TBL
        } else if (/^BL\b/i.test(trimmed)) {
          c.fillStyle = '#0056b3'; // สีน้ำเงินสำหรับ BL
        } else {
          c.fillStyle = color;
        }
      } else {
        c.fillStyle = color;
      }
      c.fillText(t, textX, ty);
    });
    c.restore();

    // บันทึกขอบเขตกล่องไว้ ใช้ hit-test ตอนคลิก/ลาก
    l._hitBox = {
      cx: isElevBox ? (l.x + boxW / 2) : l.x,
      cy: isElevBox ? (l.y + ((lines.length - 1) * lineH) / 2) : l.y,
      w: boxW,
      h: boxH
    };
  });
  c.restore();
}

// รอบ 30: หาป้ายที่ผู้ใช้คลิก/ลาก (hit-test)
//   ใช้ _hitBox ที่วาดไว้ตอน redraw (ถ้ายังไม่ได้วาด → คำนวณคร่าว ๆ จากข้อความ)
// ปรับพิกัดหน้าจอของป้ายในกรอบปัจจุบันให้ตรงกับขนาดภาพที่แสดงอยู่ (ใช้เมื่อโหลดกรอบรูปหรือกู้จาก JSON)
function resyncCanvasLabelsForActiveFrame() {
  if (typeof canvasLabels === 'undefined' || !Array.isArray(canvasLabels) || canvasLabels.length === 0) return;
  const lw = (typeof img !== 'undefined' && img && img.width && typeof imgScale === 'number' && imgScale > 0) ? (img.width * imgScale) : 0;
  const lh = (typeof img !== 'undefined' && img && img.height && typeof imgScale === 'number' && imgScale > 0) ? (img.height * imgScale) : 0;
  if (lw <= 0 || lh <= 0) return;
  const curFrameId = getCurrentDisplayedFrameId();
  canvasLabels.forEach(l => {
    if (!l) return;
    if (l.frameId && curFrameId && l.frameId !== curFrameId) return;
    if (typeof l.normX === 'number' && typeof l.normY === 'number') {
      l.x = l.normX * lw;
      l.y = l.normY * lh;
    }
    if (typeof l.normX2 === 'number' && typeof l.normY2 === 'number') {
      l.x2 = l.normX2 * lw;
      l.y2 = l.normY2 * lh;
    }
  });
}

function findHitCanvasLabel(x, y) {
  if (typeof canvasLabels === 'undefined' || !Array.isArray(canvasLabels)) return null;
  const curFrameId = getCurrentDisplayedFrameId();
  // วนจากป้ายบนสุด (ที่วาดทีหลัง) ลงมา
  for (let i = canvasLabels.length - 1; i >= 0; i--) {
    const l = canvasLabels[i];
    if (!l || l.hidden || l._hitBox === null || l.kind === 'level' || l.kind === 'ground') continue;   // เส้นระดับลากไม่ได้ และป้ายที่ซ่อนอยู่ไม่รับคลิก
    if (typeof l.x !== 'number' || typeof l.y !== 'number') continue;
    // รอบ 30: จับได้เฉพาะป้ายของเฟรมที่กำลังดูอยู่
    if (l.frameId && curFrameId && l.frameId !== curFrameId) return;
    const lines = String(l.text || '').split('\n');
    const maxLen = Math.max.apply(null, lines.map(t => t.length));
    let w = ((l._hitBox && l._hitBox.w) ? l._hitBox.w : (maxLen * 6.5 + 8)) + 8;
    let h = ((l._hitBox && l._hitBox.h) ? l._hitBox.h : (lines.length * 13 + 4)) + 8;
    const hcx = (l._hitBox && typeof l._hitBox.cx === 'number') ? l._hitBox.cx : l.x;
    const hcy = (l._hitBox && typeof l._hitBox.cy === 'number') ? l._hitBox.cy : l.y;
    let dx = x - hcx;
    let dy = y - hcy;
    const angle = (typeof l.angle === 'number') ? l.angle : 0;
    if (angle) {
      const rad = -angle * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }
    if (dx >= -w / 2 && dx <= w / 2 && dy >= -h / 2 && dy <= h / 2) {
      return l;
    }
  }
  return null;
}

// ===== Global error handler =====
// ถ้า runtime error เกิดขึ้นในเบราว์เซอร์จริง (ไม่ใช่ในเทสต์) → แสดง toast แทนที่จะเงียบ
//   ไม่แสดงในโหมดเทสต์ (ถ้า uiToast ไม่ถูก inject) เพื่อไม่ให้ test noisy
if (typeof uiToast === 'function') {
  window.addEventListener('error', (e) => {
    try {
      const msg = (e && e.message) ? String(e.message) : '';
      // ข้าม "Script error." ที่เกิดจาก cross-origin CDN / Web Worker / file:// script masking หรือ ResizeObserver
      if (!msg || msg === 'Script error.' || /Script error\.?|ResizeObserver/i.test(msg)) {
        console.warn('[ignored cross-origin/script error event]', msg);
        return;
      }
      if (!e.error && !e.lineno) {
        console.warn('[ignored resource/masked error event]', msg);
        return;
      }
      uiToast('⚠ เกิดข้อผิดพลาด: ' + msg, 'error');
      console.error('[global error]', e.error || msg);
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try {
      let reason = e && e.reason;
      let msg = (reason && reason.message) ? String(reason.message) : String(reason || '');
      if (!msg || /Script error|RenderingCancelledException|Worker/i.test(msg)) {
        console.warn('[ignored unhandledrejection]', msg);
        return;
      }
      uiToast('⚠ คำขอล้มเหลว: ' + msg, 'error');
      console.error('[unhandledrejection]', reason);
    } catch (_) {}
  });
}