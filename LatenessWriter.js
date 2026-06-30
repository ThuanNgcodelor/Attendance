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
    // Để chuyển sang APPEND (tích luỹ nhiều tháng):
    //   1. Comment dòng sheet.clearContents() bên dưới
    //   2. Bỏ comment phần "Kiểm tra header" bên dưới
    sheet.clearContents();

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
    const tz = Session.getScriptTimeZone();

    const output = results.map(r => [
      this._formatDate(r.date, tz),  // Ngày: dd/MM/yyyy
      r.employeeId,                   // Mã NV
      r.employeeName,                 // Họ tên
      r.department,                   // Phòng ban
      r.checkIn,                      // Giờ vào ("HH:mm" hoặc 0)
      r.checkOut,                     // Giờ ra  ("HH:mm" hoặc 0)
      r.congValue,                    // Công (0 hoặc 1)
      r.lateMinutes,                  // Đi trễ (phút)
      r.earlyMinutes,                 // Về sớm (phút)
      r.lateFrequency,                // Tần suất đi trễ
      r.earlyFrequency                // Tần suất về sớm
    ]);

    const dataRange = sheet.getRange(2, 1, output.length, this.NUM_COLS);
    dataRange.setValues(output);
    dataRange.setVerticalAlignment("middle");
    dataRange.setBorder(true, true, true, true, true, true,
      "#cccccc", SpreadsheetApp.BorderStyle.SOLID);

    // Căn giữa: Ngày, Mã NV, Giờ vào/ra, Công, Đi trễ, Về sớm, Tần suất
    sheet.getRange(2, 1, output.length, 2).setHorizontalAlignment("center"); // Ngày, Mã NV
    sheet.getRange(2, 5, output.length, 7).setHorizontalAlignment("center"); // Giờ vào → Tần suất về sớm

    // Căn trái: Họ tên, Phòng ban
    sheet.getRange(2, 3, output.length, 2).setHorizontalAlignment("left");

    // Chiều cao dòng data
    for (let i = 2; i <= output.length + 1; i++) {
      sheet.setRowHeight(i, 22);
    }

    // ── COLUMN WIDTHS ────────────────────────────────────────────────────
    sheet.setColumnWidth(1,  105);  // Ngày
    sheet.setColumnWidth(2,  75);   // Mã NV
    sheet.setColumnWidth(3,  170);  // Họ tên
    sheet.setColumnWidth(4,  90);   // Phòng ban
    sheet.setColumnWidth(5,  75);   // Giờ vào
    sheet.setColumnWidth(6,  75);   // Giờ ra
    sheet.setColumnWidth(7,  50);   // Công
    sheet.setColumnWidth(8,  95);   // Đi trễ (phút)
    sheet.setColumnWidth(9,  95);   // Về sớm (phút)
    sheet.setColumnWidth(10, 125);  // Tần suất đi trễ
    sheet.setColumnWidth(11, 130);  // Tần suất về sớm

    // Freeze header row
    sheet.setFrozenRows(1);

    Logger.log("LatenessWriter: Ghi " + output.length + " dòng vào Sheet \"" + SHEETS.LATENESS + "\".");

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
