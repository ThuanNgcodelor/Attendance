/**
 * ==========================================
 * Excel Importer
 * Chịu trách nhiệm làm việc với file Excel:
 *  - Tìm file mới nhất trong Import Folder
 *  - Convert Excel -> Google Sheet tạm
 *  - Đọc dữ liệu từ Google Sheet tạm
 *  - Ghi dữ liệu sạch + format đẹp vào TMP_ rồi Archive
 *  - Xóa file gốc khỏi Import Folder
 * ==========================================
 */
const ExcelImporter = {

  /**
   * Danh sách MimeType được hỗ trợ
   */
  SUPPORTED_MIME_TYPES: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel.sheet.macroEnabled.12",                    // .xlsm
    "application/vnd.ms-excel",                                           // .xls
    "application/vnd.google-apps.spreadsheet"                            // Google Sheet (dev/test)
  ],

  // ─────────────────────────────────────────
  // TÌM FILE
  // ─────────────────────────────────────────

  /**
   * Tìm file mới nhất trong Import Folder
   * @returns {File|null}
   */
  findLatestExcel() {

    const folder = Config.getImportFolder();

    Logger.log("Import Folder : " + folder.getName());

    let latestFile = null;
    let latestDate = null;

    for (const mimeType of this.SUPPORTED_MIME_TYPES) {

      const files = folder.getFilesByType(mimeType);

      while (files.hasNext()) {

        const file    = files.next();
        const updated = file.getLastUpdated();

        Logger.log("Found : " + file.getName() + " | " + mimeType);

        if (!latestDate || updated > latestDate) {
          latestDate = updated;
          latestFile = file;
        }

      }

    }

    if (!latestFile) {
      Logger.log("Không tìm thấy file trong Import Folder.");
    } else {
      Logger.log("Latest File : " + latestFile.getName());
    }

    return latestFile;

  },

  // ─────────────────────────────────────────
  // ĐỌC DỮ LIỆU
  // ─────────────────────────────────────────

  /**
   * Convert file -> Google Sheet tạm (TMP_)
   * @param {File} file
   * @returns {Spreadsheet}
   */
  convertToGoogleSheet(file) {

    Logger.log("Converting to Temporary Sheet : " + file.getName());

    const resource = {
      title: "TMP_" + file.getName(),
      mimeType: MimeType.GOOGLE_SHEETS
    };

    const googleSheet = Drive.Files.copy(
      resource,
      file.getId(),
      { convert: true }
    );

    Logger.log("Temporary Sheet ID : " + googleSheet.id);

    return SpreadsheetApp.openById(googleSheet.id);

  },

  /**
   * Đọc toàn bộ dữ liệu chấm công từ file
   * @param {File} file
   * @returns {{ values: Array[][], spreadsheetId: string }}
   */
  readAttendanceData(file) {

    const spreadsheet = this.convertToGoogleSheet(file);

    Logger.log("Reading Temporary Sheet : " + spreadsheet.getName());

    const sheet  = SheetService.getFirstSheet(spreadsheet);
    const values = SheetService.getValues(sheet);

    Logger.log("Total Rows Read : " + values.length);

    return {
      values,
      spreadsheetId: spreadsheet.getId()
    };

  },

  // ─────────────────────────────────────────
  // FORMAT & ARCHIVE
  // ─────────────────────────────────────────

  /**
   * Ghi dữ liệu sạch + format đẹp vào Google Sheet tạm,
   * rồi move vào Archive Folder.
   *
   * Cấu trúc:
   *  Row 1 : Tiêu đề "GIỜ CHẤM CÔNG (01-May-26 - 31-May-26)" — merge toàn bộ
   *  Row 2 : Header — STT | Mã nhân viên | Tên nhân viên | Phòng Ban | Ngày | Thứ | Lần chấm 1 | Lần chấm 2
   *  Row 3+: Dữ liệu
   *
   * @param {string}   spreadsheetId  - ID Google Sheet tạm (TMP_)
   * @param {Object[]} results        - Kết quả từ AttendanceCalculator
   * @param {string}   archiveName    - Tên file lưu trong Archive
   */
  formatAndArchive(spreadsheetId, results, archiveName) {

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet       = spreadsheet.getSheets()[0];

    // Xóa toàn bộ nội dung & format cũ
    sheet.clear();

    const NUM_COLS = 8;

    // ── ROW 1: TIÊU ĐỀ ──────────────────────────────
    const dateRange = this._buildDateRange(results);
    const title     = "GIỜ CHẤM CÔNG (" + dateRange + ")";

    const titleCell = sheet.getRange(1, 1, 1, NUM_COLS);
    titleCell.merge();
    titleCell.setValue(title);
    titleCell.setFontWeight("bold");
    titleCell.setFontSize(13);
    titleCell.setHorizontalAlignment("center");
    titleCell.setVerticalAlignment("middle");
    titleCell.setBackground("#ffffff");
    titleCell.setBorder(true, true, true, true, false, false,
      "#000000", SpreadsheetApp.BorderStyle.SOLID);

    sheet.setRowHeight(1, 30);

    // ── ROW 2: HEADER ────────────────────────────────
    const headers = [[
      "STT",
      "Mã nhân viên",
      "Tên nhân viên",
      "Phòng Ban",
      "Ngày",
      "Thứ",
      "Lần\nchấm 1",
      "Lần\nchấm 2"
    ]];

    const headerRange = sheet.getRange(2, 1, 1, NUM_COLS);
    headerRange.setValues(headers);
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setWrap(true);
    headerRange.setBackground("#f3f3f3");
    headerRange.setBorder(true, true, true, true, true, true,
      "#000000", SpreadsheetApp.BorderStyle.SOLID);

    sheet.setRowHeight(2, 36);

    // ── ROW 3+: DỮ LIỆU ─────────────────────────────
    if (results.length > 0) {

      const output = results.map((item, index) => [
        index + 1,
        item.employeeId,
        item.employeeName,
        item.department   || "",
        this._formatDate(item.date),
        item.dayOfWeek    || "",
        item.firstPunch   || "",
        item.secondPunch  || ""
      ]);

      const dataRange = sheet.getRange(3, 1, output.length, NUM_COLS);
      dataRange.setValues(output);
      dataRange.setVerticalAlignment("middle");
      dataRange.setBorder(true, true, true, true, true, true,
        "#000000", SpreadsheetApp.BorderStyle.SOLID);

      // Căn giữa: STT, Ngày, Thứ, Lần chấm 1, Lần chấm 2
      sheet.getRange(3, 1, output.length, 1).setHorizontalAlignment("center"); // STT
      sheet.getRange(3, 5, output.length, 4).setHorizontalAlignment("center"); // Ngày → Lần chấm 2

      // Đặt chiều cao mỗi dòng data
      for (let i = 3; i <= output.length + 2; i++) {
        sheet.setRowHeight(i, 24);
      }

    }

    // ── COLUMN WIDTHS ─────────────────────────────────
    sheet.setColumnWidth(1, 45);   // STT
    sheet.setColumnWidth(2, 100);  // Mã nhân viên
    sheet.setColumnWidth(3, 160);  // Tên nhân viên
    sheet.setColumnWidth(4, 130);  // Phòng Ban
    sheet.setColumnWidth(5, 100);  // Ngày
    sheet.setColumnWidth(6, 55);   // Thứ
    sheet.setColumnWidth(7, 75);   // Lần chấm 1
    sheet.setColumnWidth(8, 75);   // Lần chấm 2

    // ── ĐỔI TÊN & MOVE VÀO ARCHIVE ───────────────────
    spreadsheet.rename(archiveName);

    const archiveFolder = Config.getArchiveFolder();
    const file          = DriveApp.getFileById(spreadsheetId);

    archiveFolder.addFile(file);

    // Gỡ khỏi tất cả thư mục hiện tại (trừ Archive)
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== archiveFolder.getId()) {
        parent.removeFile(file);
      }
    }

    Logger.log("Formatted and Archived : " + archiveName);

  },

  // ─────────────────────────────────────────
  // XÓA FILE GỐC KHỎI IMPORT
  // ─────────────────────────────────────────

  /**
   * Xóa file gốc khỏi Import Folder (đưa vào Trash)
   * @param {File} file
   */
  deleteFromImport(file) {

    file.setTrashed(true);

    Logger.log("Deleted from Import : " + file.getName());

  },

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Lấy khoảng ngày từ results để hiển thị trên tiêu đề
   * @param {Object[]} results
   * @returns {string} VD: "01-May-26 - 31-May-26"
   */
  _buildDateRange(results) {

    if (!results || results.length === 0) return "";

    const tz = Session.getScriptTimeZone();

    const dates = results
      .map(r => r.date)
      .filter(d => d)
      .map(d => (d instanceof Date) ? d : new Date(d))
      .filter(d => !isNaN(d.getTime()));

    if (dates.length === 0) return "";

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const fmt = (d) => Utilities.formatDate(d, tz, "dd-MMM-yy");

    return fmt(minDate) + " - " + fmt(maxDate);

  },

  /**
   * Format ngày về dạng "dd-MMM-yy" để hiển thị trong cột Ngày
   * Xử lý cả Date object lẫn string
   * @param {Date|string} date
   * @returns {string}
   */
  _formatDate(date) {

    if (!date) return "";

    try {

      const d  = (date instanceof Date) ? date : new Date(date);
      const tz = Session.getScriptTimeZone();

      if (isNaN(d.getTime())) return date.toString();

      return Utilities.formatDate(d, tz, "dd-MMM-yy");

    } catch (e) {

      return date.toString();

    }

  }

};