/**
 * =====================================
 * Cong Writer
 * Tạo file Bảng Công và lưu vào Archive Công Folder
 *
 * Layout:
 *   Row 1-2: Trống
 *   Row 3:   Tiêu đề "BẢNG THỐNG KÊ CHẤM CÔNG (CÔNG)" (merged)
 *   Row 4:   STT | Mã NV | Tên NV | 1 | 2 | ... | 31 | Ngày công
 *   Row 5:   (merged) |   (merged) | (merged) | T.6 | T.7 | ... | CN | (merged)
 *   Row 6+:  Dữ liệu
 * =====================================
 */
const CongWriter = {

  // ISO day (1=Mon...7=Sun) → Tên thứ tiếng Việt
  DAY_ABBREV: {
    1: "T.2",
    2: "T.3",
    3: "T.4",
    4: "T.5",
    5: "T.6",
    6: "T.7",
    7: "CN"
  },

  /**
   * Tạo Google Sheet Bảng Công, ghi dữ liệu, archive vào Drive
   *
   * @param {Object} congData   - Từ CongCalculator.build()
   * @param {string} sourceName - Tên dùng đặt tên file output
   */
  write(congData, sourceName) {

    if (!congData || !congData.rows || congData.rows.length === 0) {
      Logger.log("CongWriter: Không có dữ liệu để ghi.");
      return;
    }

    const tz = Session.getScriptTimeZone();
    const { dates, rows } = congData;

    const NUM_FIXED = 3;                         // STT | Mã NV | Tên NV
    const NUM_DATE = dates.length;
    const TOTAL_COLS = NUM_FIXED + NUM_DATE + 1;  // +1 cho cột Ngày công

    // Các dòng offset
    const ROW_TITLE = 3;  // Tiêu đề
    const ROW_DAYNUM = 4;  // Số ngày (1, 2, ..., 31)
    const ROW_DAYNAME = 5;  // Tên thứ (T.2, T.3, ..., CN)
    const ROW_DATA = 6;  // Dữ liệu bắt đầu

    // 1. Tạo Google Sheet mới
    const fileName = "CONG_" + sourceName;
    const spreadsheet = SpreadsheetApp.create(fileName);
    const sheet = spreadsheet.getSheets()[0];
    sheet.setName("Công");
    sheet.clearContents();

    Logger.log("CongWriter: Tạo file → " + fileName);

    // ── ROW 1-2: TRỐNG ──────────────────────────────────────────────
    sheet.setRowHeight(1, 8);
    sheet.setRowHeight(2, 8);

    // ── ROW 3: TIÊU ĐỀ ──────────────────────────────────────────────
    // Chỉ merge 3 cột đầu (A-C) để tránh text tràn sang các cột ngày
    const titleRange = sheet.getRange(ROW_TITLE, 1, 1, NUM_FIXED);
    titleRange.merge();
    titleRange.setValue("BẢNG THỐNG KÊ CHẤM CÔNG (CÔNG)");
    titleRange.setFontWeight("bold");
    titleRange.setFontSize(13);
    titleRange.setHorizontalAlignment("left");
    titleRange.setVerticalAlignment("middle");
    titleRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    sheet.setRowHeight(ROW_TITLE, 30);

    // ── ROW 4: HEADER — SỐ NGÀY ─────────────────────────────────────
    const headerRow4 = ["STT", "Mã nhân viên", "Tên nhân viên"];

    for (let i = 0; i < dates.length; i++) {
      const dayNum = parseInt(Utilities.formatDate(dates[i], tz, "d"), 10);
      headerRow4.push(dayNum);
    }
    headerRow4.push("Ngày\ncông");

    const header4Range = sheet.getRange(ROW_DAYNUM, 1, 1, TOTAL_COLS);
    header4Range.setValues([headerRow4]);
    header4Range.setFontWeight("bold");
    header4Range.setHorizontalAlignment("center");
    header4Range.setVerticalAlignment("middle");
    header4Range.setWrap(true);
    header4Range.setBorder(true, true, true, true, true, true);
    sheet.setRowHeight(ROW_DAYNUM, 24);

    // ── ROW 5: HEADER — TÊN THỨ ─────────────────────────────────────
    const headerRow5 = ["", "", ""];

    for (let i = 0; i < dates.length; i++) {
      // "u" = ISO day of week: 1=Mon...7=Sun
      const isoDay = parseInt(Utilities.formatDate(dates[i], tz, "u"), 10);
      headerRow5.push(this.DAY_ABBREV[isoDay] || "?");
    }
    headerRow5.push("");

    const header5Range = sheet.getRange(ROW_DAYNAME, 1, 1, TOTAL_COLS);
    header5Range.setValues([headerRow5]);
    header5Range.setFontWeight("bold");
    header5Range.setHorizontalAlignment("center");
    header5Range.setVerticalAlignment("middle");
    header5Range.setBorder(true, true, true, true, true, true);
    sheet.setRowHeight(ROW_DAYNAME, 18);

    // ── MERGE DỌC CÁC CỘT CỐ ĐỊNH (rows 4-5) ───────────────────────
    // STT, Mã NV, Tên NV và Ngày công: merge 2 dòng header để gọn
    sheet.getRange(ROW_DAYNUM, 1, 2, 1).merge();           // STT
    sheet.getRange(ROW_DAYNUM, 2, 2, 1).merge();           // Mã NV
    sheet.getRange(ROW_DAYNUM, 3, 2, 1).merge();           // Tên NV
    sheet.getRange(ROW_DAYNUM, TOTAL_COLS, 2, 1).merge();  // Ngày công

    // ── DATA ROWS ────────────────────────────────────────────────────
    if (rows.length > 0) {

      const output = rows.map(row => [
        row.stt,
        row.employeeId,
        row.employeeName,
        ...row.dailyValues,
        row.total
      ]);

      const dataRange = sheet.getRange(ROW_DATA, 1, output.length, TOTAL_COLS);
      dataRange.setValues(output);
      dataRange.setVerticalAlignment("middle");
      dataRange.setBorder(true, true, true, true, true, true);

      // Căn giữa: STT, các cột ngày, và cột Ngày công
      sheet.getRange(ROW_DATA, 1, output.length, 1)
        .setHorizontalAlignment("center");
      sheet.getRange(ROW_DATA, NUM_FIXED + 1, output.length, NUM_DATE + 1)
        .setHorizontalAlignment("center");

      sheet.setRowHeights(ROW_DATA, output.length, 20);

    }

    // ── XÓA CỘT / DÒNG THỪA ─────────────────────────────────────────
    // Xóa cột dư vượt quá TOTAL_COLS để tránh title text overflow
    const maxCols = sheet.getMaxColumns();
    if (maxCols > TOTAL_COLS) {
      sheet.deleteColumns(TOTAL_COLS + 1, maxCols - TOTAL_COLS);
    }

    // Xóa dòng dư vượt quá dòng data cuối cùng
    const lastDataRow = ROW_DATA + (rows.length > 0 ? rows.length : 0);
    const maxRows = sheet.getMaxRows();
    if (maxRows > lastDataRow) {
      sheet.deleteRows(lastDataRow + 1, maxRows - lastDataRow);
    }

    // ── COLUMN WIDTHS ────────────────────────────────────────────────
    sheet.setColumnWidth(1, 45);   // STT
    sheet.setColumnWidth(2, 105);  // Mã NV
    sheet.setColumnWidth(3, 160);  // Tên NV

    for (let i = NUM_FIXED + 1; i <= NUM_FIXED + NUM_DATE; i++) {
      sheet.setColumnWidth(i, 32); // Cột ngày
    }

    sheet.setColumnWidth(TOTAL_COLS, 65); // Ngày công

    // ── FREEZE ──────────────────────────────────────────────────────
    // Freeze 5 dòng (2 trống + tiêu đề + 2 header)
    // Không freeze cột — Row 3 là merged cell toàn bộ, sẽ gây lỗi
    sheet.setFrozenRows(ROW_DAYNAME);

    // ── MOVE VÀO ARCHIVE CÔNG FOLDER ────────────────────────────────
    const file = DriveApp.getFileById(spreadsheet.getId());

    try {

      const archiveCongFolder = Config.getArchiveCongFolder();
      archiveCongFolder.addFile(file);

      const parents = file.getParents();
      while (parents.hasNext()) {
        const parent = parents.next();
        if (parent.getId() !== archiveCongFolder.getId()) {
          try { parent.removeFile(file); } catch (e) { /* ignore */ }
        }
      }

      Logger.log("CongWriter: Archived → Archive Công / " + fileName);

    } catch (e) {

      Logger.log("CongWriter Warning: " + e.message);
      Logger.log("CongWriter: File đã tạo nhưng nằm ở root Drive (chưa archive).");

    }

  }

};
