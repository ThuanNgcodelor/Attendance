/**
 * ==========================================
 * Attendance Writer
 * Ghi dữ liệu chấm công xuống Google Sheet
 * ==========================================
 */
const AttendanceWriter = {

  /**
   * Ghi toàn bộ kết quả chấm công xuống sheet Attendance
   * Xóa dữ liệu cũ trước khi ghi mới (overwrite mode)
   *
   * @param {Object[]} results - Danh sách kết quả từ AttendanceCalculator
   */
  write(results) {

    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEETS.ATTENDANCE);

    // Xóa dữ liệu cũ
    sheet.clearContents();

    // Header — đồng bộ với output bên dưới
    const headers = [[
      "STT",
      "Mã NV",
      "Tên nhân viên",
      "Phòng ban",
      "Ngày",
      "Thứ",
      "Chấm lần 1",
      "Chấm lần 2",
      "Trạng thái"
    ]];

    sheet.getRange(1, 1, 1, headers[0].length)
      .setValues(headers);

    // Chuẩn bị dữ liệu — ghi 1 lần bằng setValues() (hiệu năng cao)
    const output = results.map((item, index) => [

      index + 1,

      item.employeeId,

      item.employeeName,

      item.department,

      item.date,

      item.dayOfWeek,

      item.firstPunch || "",

      item.secondPunch || "",

      item.status || ""

    ]);

    if (output.length > 0) {

      sheet.getRange(
        2,
        1,
        output.length,
        output[0].length
      ).setValues(output);

    }
  }

};