/**
 * ==========================================
 * Sheet Service
 * Làm việc với Google Spreadsheet
 * ==========================================
 */
const SheetService = {

  /**
   * Lấy Sheet đầu tiên
   */
  getFirstSheet(spreadsheet) {

    return spreadsheet.getSheets()[0];

  },

  getValues(sheet) {
    return sheet.getDataRange().getValues();
  },

  /**
   * Đọc cả dữ liệu thô (values) và dữ liệu chuỗi hiển thị (displayValues)
   * Giúp khắc phục triệt để lỗi sai lệch múi giờ đối với cột Giờ (Time)
   */
  getValuesAndDisplay(sheet) {
    const range = sheet.getDataRange();
    return {
      values: range.getValues(),
      displayValues: range.getDisplayValues()
    };
  }

};