/**
 * ==========================================
 * Lateness Service
 * Orchestrator — Điều phối pipeline tính Đi Trễ / Về Sớm
 *
 * Pipeline (độc lập với AttendanceService):
 *  1. Tìm TẤT CẢ file trong Lateness Folder (LATENESS_FOLDER_ID)
 *  2. Với mỗi file: Convert → TMP_ → Parse → Gom allRecords[]
 *  3. Tính toán: LatenessCalculator.build(allRecords) → LatenessResult[]
 *  4. Ghi vào Sheet "Lateness" trong HRM Database (datasource Looker Studio)
 *  5. Tạo file Google Sheet tổng hợp → lưu vào folder "Archiver Tổng hợp"
 *  6. Xóa các Google Sheet tạm (TMP_) khỏi Drive
 *     (File gốc TCHC.xlsx... được GIỮ NGUYÊN trong Lateness Folder)
 *
 * Entry point: runLateness() trong Main.js
 * ==========================================
 */
const LatenessService = {

  processLateness() {

    Logger.log("=================================");
    Logger.log("Lateness Service Started");
    Logger.log("=================================");

    try {

      // 1. Tìm tất cả file trong Lateness Folder
      const latenessFolder = Config.getLatenessFolder();
      const excelFiles = ExcelImporter.findAllExcelFilesInFolder(latenessFolder);

      if (excelFiles.length === 0) {
        throw new Error(
          "Không tìm thấy file nào trong Lateness Folder. " +
          "Vui lòng upload file (TCHC.xlsx, XNK.xlsx...) vào đúng thư mục."
        );
      }

      Logger.log("Total Lateness files : " + excelFiles.length);

      // 2. Đọc + parse từng file, gom tất cả records
      const allRecords = [];
      const tmpIds     = [];  // ID các Google Sheet tạm để xóa sau

      for (const excelFile of excelFiles) {

        Logger.log("---------------------------------");
        Logger.log("Processing Lateness File : " + excelFile.getName());
        Logger.log("---------------------------------");

        // 2a. Convert → TMP_ Google Sheet
        const excelData = ExcelImporter.readAttendanceData(excelFile);
        tmpIds.push(excelData.spreadsheetId);

        // 2b. Parse → LatenessRecord[] (Truyền cả mảng hiển thị)
        const records = LatenessParser.parse(excelData.values, excelData.displayValues);

        Logger.log("Parsed : " + records.length + " records | " + excelFile.getName());

        if (records.length === 0) {
          Logger.log("Warning: Không có dữ liệu hợp lệ trong " + excelFile.getName() + ". Bỏ qua.");
          continue;
        }

        // 2c. Gom
        allRecords.push(...records);

      }

      Logger.log("Total records from all files : " + allRecords.length);

      // 3. Tính toán
      if (allRecords.length > 0) {

        const results = LatenessCalculator.build(allRecords);

        // 4. Ghi Sheet "Lateness" trong HRM Database (datasource cho Looker Studio)
        LatenessWriter.write(results);
        Logger.log("Sheet \"Lateness\" updated. Total rows : " + results.length);

        // 5. Tạo file Google Sheet tổng hợp → lưu vào folder "Archiver Tổng hợp"
        try {

          const archiveFolder = Config.getLatenessArchiveFolder();
          const dateRange     = this._buildDateRange(results);
          LatenessWriter.writeToArchive(results, dateRange, archiveFolder);

        } catch (archiveError) {
          // Không dừng toàn bộ nếu archive lỗi — chỉ log cảnh báo
          Logger.log("Warning (Archive): " + archiveError.toString());
        }

      } else {

        Logger.log("Warning: Không có record nào hợp lệ từ tất cả các file. Sheet Lateness không được cập nhật.");

      }

      // 5. Xóa Google Sheet tạm (TMP_)
      for (const tmpId of tmpIds) {
        try {
          DriveApp.getFileById(tmpId).setTrashed(true);
          Logger.log("Deleted TMP sheet : " + tmpId);
        } catch (e) {
          Logger.log("Warning: Không xóa được TMP sheet " + tmpId + " : " + e.toString());
        }
      }

      Logger.log("=================================");
      Logger.log("Lateness Service Finished");
      Logger.log("Files processed : " + excelFiles.length);
      Logger.log("Records written : " + allRecords.length);
      Logger.log("=================================");

    } catch (error) {

      Logger.log("=================================");
      Logger.log("Lateness Service ERROR");
      Logger.log(error.toString());
      Logger.log("=================================");

      throw error;

    }

  },

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Tính khoảng ngày từ LatenessResult[] để đặt tên file archive
   * VD: "01-May-26 - 31-May-26"
   *
   * @param {Object[]} results - Mảng LatenessResult
   * @returns {string}
   */
  _buildDateRange(results) {

    if (!results || results.length === 0) return "TONGHOP";

    const tz = Session.getScriptTimeZone();

    const dates = results
      .map(r => r.date)
      .filter(d => d)
      .map(d => (d instanceof Date) ? d : new Date(d.toString()))
      .filter(d => !isNaN(d.getTime()));

    if (dates.length === 0) return "TONGHOP";

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const fmt = d => Utilities.formatDate(d, tz, "dd-MMM-yy");

    return fmt(minDate) + " - " + fmt(maxDate);

  }

};
