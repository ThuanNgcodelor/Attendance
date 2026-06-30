/**
 * ==========================================
 * Dashboard Writer
 * Ghi kết quả Data Marts (Summary) vào các Sheet tĩnh trong HRM Database.
 * Các Sheet này đóng vai trò là cơ sở dữ liệu để Looker Studio đọc trực tiếp.
 * ==========================================
 */
const DashboardWriter = {

  EMP_SHEET_NAME: "Employee_Summary",
  DEPT_SHEET_NAME: "Department_Summary",

  EMP_HEADERS: [
    "Tháng",
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    "Tổng Công",
    "Số Lần Trễ",
    "Số Lần Sớm",
    "Tổng Phút Trễ",
    "Tổng Phút Sớm"
  ],

  DEPT_HEADERS: [
    "Tháng",
    "Phòng Ban",
    "Tổng Nhân Sự",
    "Tổng Công",
    "Tổng Số Lần Trễ",
    "Trung Bình Phút Trễ/NV"
  ],

  /**
   * Ghi toàn bộ dữ liệu Summary ra các Sheet
   * @param {Object} summaryData - { employeeSummary, departmentSummary }
   */
  write(summaryData) {

    if (!summaryData) return;

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Ghi Employee Summary
    if (summaryData.employeeSummary && summaryData.employeeSummary.length > 0) {
      this._writeEmployeeSummary(spreadsheet, summaryData.employeeSummary);
    }

    // 2. Ghi Department Summary
    if (summaryData.departmentSummary && summaryData.departmentSummary.length > 0) {
      this._writeDepartmentSummary(spreadsheet, summaryData.departmentSummary);
    }

  },

  // ─────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────

  _writeEmployeeSummary(spreadsheet, data) {
    let sheet = spreadsheet.getSheetByName(this.EMP_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(this.EMP_SHEET_NAME);
      Logger.log("DashboardWriter: Tạo mới Sheet \"" + this.EMP_SHEET_NAME + "\"");
    }

    // OVERWRITE: Xóa trắng nội dung cũ để tránh trùng lặp
    sheet.clearContents();

    const output = [this.EMP_HEADERS];
    
    // Sắp xếp theo Tháng -> Phòng Ban -> Mã NV
    data.sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      if (a.department !== b.department) return (a.department || "").localeCompare(b.department || "");
      return (a.employeeId || "").localeCompare(b.employeeId || "");
    });

    for (const r of data) {
      output.push([
        r.month,
        r.employeeId,
        r.employeeName,
        r.department,
        r.totalCong,
        r.totalLateCount,
        r.totalEarlyCount,
        r.totalLateMinutes,
        r.totalEarlyMinutes
      ]);
    }

    const dataRange = sheet.getRange(1, 1, output.length, this.EMP_HEADERS.length);
    dataRange.setValues(output);
    
    // Formatting cơ bản
    const headerRange = sheet.getRange(1, 1, 1, this.EMP_HEADERS.length);
    headerRange.setFontWeight("bold").setBackground("#4a86c8").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    
    // Căn giữa các cột số liệu
    sheet.getRange(2, 5, output.length - 1, 5).setHorizontalAlignment("center");
    
    // Tối ưu hiệu năng
    sheet.setRowHeights(2, output.length - 1, 22);

    Logger.log("DashboardWriter: Ghi " + data.length + " dòng vào " + this.EMP_SHEET_NAME);
  },

  _writeDepartmentSummary(spreadsheet, data) {
    let sheet = spreadsheet.getSheetByName(this.DEPT_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(this.DEPT_SHEET_NAME);
      Logger.log("DashboardWriter: Tạo mới Sheet \"" + this.DEPT_SHEET_NAME + "\"");
    }

    // OVERWRITE: Xóa trắng nội dung cũ
    sheet.clearContents();

    const output = [this.DEPT_HEADERS];
    
    // Sắp xếp theo Tháng -> Phòng Ban
    data.sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      return (a.department || "").localeCompare(b.department || "");
    });

    for (const r of data) {
      output.push([
        r.month,
        r.department,
        r.totalEmployees,
        r.totalCong,
        r.totalLateCount,
        r.avgLateMinutes
      ]);
    }

    const dataRange = sheet.getRange(1, 1, output.length, this.DEPT_HEADERS.length);
    dataRange.setValues(output);
    
    // Formatting cơ bản
    const headerRange = sheet.getRange(1, 1, 1, this.DEPT_HEADERS.length);
    headerRange.setFontWeight("bold").setBackground("#4a86c8").setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // Căn giữa các cột số liệu
    sheet.getRange(2, 3, output.length - 1, 4).setHorizontalAlignment("center");

    // Tối ưu hiệu năng
    sheet.setRowHeights(2, output.length - 1, 22);

    Logger.log("DashboardWriter: Ghi " + data.length + " dòng vào " + this.DEPT_SHEET_NAME);
  }

};
