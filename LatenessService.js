/**
 * ==========================================
 * Lateness Service
 * Orchestrator — Điều phối pipeline tính Đi Trễ / Về Sớm
 *
 * Pipeline (độc lập với AttendanceService):
 *  1. Tìm TẤT CẢ file trong Lateness Folder (LATENESS_FOLDER_ID)
 *  2. Với mỗi file:
 *     a. Convert → Google Sheet tạm (TMP_)
 *     b. Parse dữ liệu → LatenessRecord[]
 *     c. Gom vào allRecords[]
 *  3. Tính toán LatenessCalculator.build(allRecords) → LatenessResult[]
 *  4. Ghi toàn bộ kết quả vào Sheet "Lateness" (LatenessWriter)
 *  5. Xóa các Google Sheet tạm (TMP_) khỏi Drive
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

        // 2b. Parse → LatenessRecord[]
        const records = LatenessParser.parse(excelData.values);

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

        // 4. Ghi Sheet "Lateness"
        LatenessWriter.write(results);

        Logger.log("Sheet \"Lateness\" updated. Total rows : " + results.length);

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

  }

};
