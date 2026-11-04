// ===== js/tab-project.js =====
// รอบ 46: แท็บ "แผนงานโครงการ" อยู่หน้าสุดของแถบแท็บตารางด้านล่าง และซิงก์กับหน้าเมนูแผนงานโครงการ / ประมาณการ

function updateProjectPlanField(field, val) {
  projectPlanData[field] = val;
  if (typeof updateTopHeaderBanner === "function") updateTopHeaderBanner();
  const summaryPage = document.getElementById("estimateSummaryPage");
  if (summaryPage && summaryPage.style && summaryPage.style.display !== "none" && typeof renderEstimateSummaryPage === "function") {
    renderEstimateSummaryPage();
  }
}

function renderProjectTab() {
  const container = document.getElementById("tableContainer");
  if (!container) return;
  const p = (typeof projectPlanData !== "undefined" && projectPlanData) ? projectPlanData : { name: "", location: "", description: "" };
  container.innerHTML = `
    <table class="project-tab-table" style="width: 100%; max-width: 960px; margin: 6px auto;">
      <thead>
        <tr>
          <th style="width: 240px;">หัวข้อข้อมูลโครงการ</th>
          <th>รายละเอียด</th>
        </tr>
      </thead>
      <tbody id="projectTableBody">
        <tr>
          <td style="text-align: left; font-weight: bold; padding: 6px 10px;">📋 ชื่อแผนงาน / โครงการ</td>
          <td style="padding: 4px 8px;">
            <input type="text" id="projTabName" class="table-input editable" data-row="0" data-col="1" data-field="name" style="text-align: left; padding: 5px 8px;" value="${escapeHtml(p.name || '')}" placeholder="ระบุชื่อแผนงาน / โครงการ" onchange="updateProjectPlanField('name', this.value)">
          </td>
        </tr>
        <tr>
          <td style="text-align: left; font-weight: bold; padding: 6px 10px;">📍 ที่อยู่ / สถานที่ดำเนินโครงการ</td>
          <td style="padding: 4px 8px;">
            <input type="text" id="projTabLoc" class="table-input editable" data-row="1" data-col="1" data-field="location" style="text-align: left; padding: 5px 8px;" value="${escapeHtml(p.location || '')}" placeholder="ระบุตำบล อำเภอ จังหวัด" onchange="updateProjectPlanField('location', this.value)">
          </td>
        </tr>
        <tr>
          <td style="text-align: left; font-weight: bold; padding: 6px 10px;">📝 รายละเอียดโครงการ</td>
          <td style="padding: 4px 8px;">
            <input type="text" id="projTabDesc" class="table-input editable" data-row="2" data-col="1" data-field="description" style="text-align: left; padding: 5px 8px;" value="${escapeHtml(p.description || '')}" placeholder="ระบุวัตถุประสงค์และรายละเอียดโครงการ" onchange="updateProjectPlanField('description', this.value)">
          </td>
        </tr>
      </tbody>
    </table>
  `;
}
