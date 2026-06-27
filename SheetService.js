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

  /**
   * Đọc toàn bộ dữ liệu
   */
  getValues(sheet) {

    return sheet.getDataRange().getValues();

  }

};