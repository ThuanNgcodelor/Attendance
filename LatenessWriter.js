/**
 * ==========================================
 * Lateness Writer
 * Ghi LatenessResult[] vào Sheet "Lateness" trong HRM Database
 *
 * Layout Sheet (11 cột):
 *   Ngày | Mã NV | Họ tên | Phòng ban |
 *   Giờ vào | Giờ ra | Công |
 *   Đi trễ | Về sớm | Tần suất đi trễ | Tần suất về sớm
 *
 * Cách ghi: OVERWRITE — xóa toàn bộ và ghi lại mỗi lần chạy
 * (Để tích luỹ nhiều tháng: đổi sang Append bằng cách comment/uncomment ở hàm write())
 * ==========================================
 */
const LatenessWriter = {

  /** Số cột của Sheet Lateness */
  NUM_COLS: 11,

  /** Header row */
  HEADERS: [
    "Ngày",
    "Mã NV",
    "Họ tên",
    "Phòng ban",
    "Giờ vào",
    "Giờ ra",
    "Công",
    "Đi trễ (phút)",
    "Về sớm (phút)",
    "Tần suất đi trễ",
    "Tần suất về sớm"
  ],

  /**
   * Ghi toàn bộ LatenessResult[] vào Sheet "Lateness"
   *
   * @param {Object[]} results - Mảng LatenessResult từ LatenessCalculator
   */
  write(results) {

    if (!results || results.length === 0) {
      Logger.log("LatenessWriter: Không có dữ liệu để ghi.");
      return;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Lấy hoặc tạo Sheet "Lateness"
    let sheet = spreadsheet.getSheetByName(SHEETS.LATENESS);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEETS.LATENESS);
      Logger.log("LatenessWriter: Tạo mới Sheet \"" + SHEETS.LATENESS + "\"");
    }

    // ── OVERWRITE: Xóa toàn bộ nội dung cũ ─────────────────────────────
    sheet.clearContents();

    // Ghi header + data + format (dùng chung với writeToArchive)
    this._applySheetFormat(sheet, results);

    Logger.log("LatenessWriter: Ghi " + results.length + " dòng vào Sheet \"" + SHEETS.LATENESS + "\".");

  },

  /**
   * Tạo file Google Sheet tổng hợp và lưu vào folder "Archiver Tổng hợp"
   *
   * Tên file: "TONGHOP_<dateRange>" — VD: "TONGHOP_01-May-26 - 31-May-26"
   * File này chứa đúng 11 cột, format sạch, sẵn sàng xem trực tiếp trên Drive.
   *
   * File gốc (TCHC.xlsx, XNK.xlsx...) KHÔNG bị xóa hay di chuyển.
   *
   * @param {Object[]} results   - Mảng LatenessResult từ LatenessCalculator
   * @param {string}   dateRange - Khoảng ngày (VD: "01-May-26 - 31-May-26")
   * @param {Folder}   archiveFolder - Folder "Archiver Tổng hợp"
   */
  writeToArchive(results, dateRange, archiveFolder) {

    if (!results || results.length === 0) {
      Logger.log("LatenessWriter.writeToArchive: Không có dữ liệu để archive.");
      return;
    }

    const fileName = "TONGHOP_" + dateRange;

    Logger.log("LatenessWriter: Tạo file archive \"" + fileName + "\"...");

    // Tạo Google Spreadsheet mới
    const newSpreadsheet = SpreadsheetApp.create(fileName);
    const sheet          = newSpreadsheet.getActiveSheet();
    sheet.setName("Tổng hợp");

    // Áp dụng format và ghi data
    this._applySheetFormat(sheet, results);

    // Move file vào folder "Archiver Tổng hợp"
    const file = DriveApp.getFileById(newSpreadsheet.getId());
    archiveFolder.addFile(file);

    // Gỡ file khỏi root Drive (tránh trùng lặp)
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== archiveFolder.getId()) {
        parent.removeFile(file);
      }
    }

    Logger.log("LatenessWriter: Archive saved → \"" + fileName + "\" trong folder \"" + archiveFolder.getName() + "\".");

  },

  /**
   * Áp dụng format và ghi data vào 1 sheet bất kỳ
   * Dùng chung cho write() (Sheet Lateness) và writeToArchive() (file mới)
   *
   * @param {Sheet}    sheet   - Google Sheet object
   * @param {Object[]} results - Mảng LatenessResult
   */
  _applySheetFormat(sheet, results) {

    const tz = Session.getScriptTimeZone();

    // ── HEADER ──────────────────────────────────────────────────────────
    const headerRange = sheet.getRange(1, 1, 1, this.NUM_COLS);
    headerRange.setValues([this.HEADERS]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4a86c8");
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setBorder(true, true, true, true, true, true,
      "#000000", SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(1, 32);

    // ── DATA ─────────────────────────────────────────────────────────────
    const output = results.map(r => [
      this._formatDate(r.date, tz),
      r.employeeId,
      r.employeeName,
      r.department,
      r.checkIn,
      r.checkOut,
      r.congValue,
      r.lateMinutes,
      r.earlyMinutes,
      r.lateFrequency,
      r.earlyFrequency
    ]);

    const dataRange = sheet.getRange(2, 1, output.length, this.NUM_COLS);
    dataRange.setValues(output);
    dataRange.setVerticalAlignment("middle");
    dataRange.setBorder(true, true, true, true, true, true,
      "#cccccc", SpreadsheetApp.BorderStyle.SOLID);

    sheet.getRange(2, 1, output.length, 2).setHorizontalAlignment("center");
    sheet.getRange(2, 5, output.length, 7).setHorizontalAlignment("center");
    sheet.getRange(2, 3, output.length, 2).setHorizontalAlignment("left");

    // Tối ưu hiệu năng bằng Batch Update
    sheet.setRowHeights(2, output.length, 22);

    // ── COLUMN WIDTHS ────────────────────────────────────────────────────
    sheet.setColumnWidth(1,  105);
    sheet.setColumnWidth(2,  75);
    sheet.setColumnWidth(3,  170);
    sheet.setColumnWidth(4,  90);
    sheet.setColumnWidth(5,  75);
    sheet.setColumnWidth(6,  75);
    sheet.setColumnWidth(7,  50);
    sheet.setColumnWidth(8,  95);
    sheet.setColumnWidth(9,  95);
    sheet.setColumnWidth(10, 125);
    sheet.setColumnWidth(11, 130);

    sheet.setFrozenRows(1);

  },

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Format ngày về dạng "dd/MM/yyyy"
   * Xử lý cả Date object lẫn string
   *
   * @param {Date|string} date
   * @param {string} tz - Timezone
   * @returns {string}
   */
  _formatDate(date, tz) {

    if (!date) return "";

    try {
      const d = (date instanceof Date) ? date : new Date(date.toString());
      if (isNaN(d.getTime())) return date.toString();
      return Utilities.formatDate(d, tz || Session.getScriptTimeZone(), "dd/MM/yyyy");
    } catch (e) {
      return date.toString();
    }

  }

};

