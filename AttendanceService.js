/**
 * =====================================
 * Attendance Service
 * Orchestrator — Điều phối toàn bộ quy trình chấm công
 *
 * Luồng BATCH (nhiều file):
 *  1. Tìm TẤT CẢ file trong Import Folder
 *  2. Với mỗi file:
 *     a. Convert -> Google Sheet tạm (TMP_)
 *     b. Parse dữ liệu -> AttendanceRecord[]
 *     c. Calculate -> AttendanceResult[]
 *     d. Gom kết quả vào allResults[]
 *  3. Ghi TOÀN BỘ allResults vào Attendance Sheet (1 lần duy nhất)
 *  4. Với mỗi file đã xử lý:
 *     a. Ghi dữ liệu sạch (8 cột) vào TMP_ -> move vào Archive
 *     b. Xóa file gốc khỏi Import Folder
 * =====================================
 */
const AttendanceService = {

  processAttendance() {

    Logger.log("=================================");
    Logger.log("Attendance Service Started");
    Logger.log("=================================");

    try {

      // 1. Tìm TẤT CẢ file trong Import Folder
      const excelFiles = ExcelImporter.findAllExcelFiles();

      if (excelFiles.length === 0) {
        throw new Error("Không tìm thấy file nào trong Import Folder. Vui lòng kiểm tra lại.");
      }

      Logger.log("Total files to process : " + excelFiles.length);

      // 2. Xử lý từng file, gom tất cả kết quả
      const allResults       = [];  // Kết quả của tất cả file
      const processedBatches = [];  // Để archive sau

      for (const excelFile of excelFiles) {

        Logger.log("---------------------------------");
        Logger.log("Processing : " + excelFile.getName());
        Logger.log("---------------------------------");

        // 2a. Đọc dữ liệu (convert -> TMP_ -> read)
        const excelData = ExcelImporter.readAttendanceData(excelFile);

        // 2b. Parse raw data -> AttendanceRecord[]
        const records = AttendanceParser.parse(excelData.values);

        Logger.log("Parsed Records : " + records.length + " | File: " + excelFile.getName());

        if (records.length === 0) {

          Logger.log("Warning: Không có dữ liệu hợp lệ trong " + excelFile.getName() + ". Bỏ qua file này.");

          // Xóa TMP_ của file lỗi để không rác Drive
          ExcelImporter.deleteFromImport(
            DriveApp.getFileById(excelData.spreadsheetId)
          );

          continue;

        }

        // 2c. Calculate -> AttendanceResult[]
        const results = records.map(record =>
          AttendanceCalculator.calculate(record)
        );

        Logger.log("Calculated Results : " + results.length + " | File: " + excelFile.getName());

        // 2d. Gom kết quả
        allResults.push(...results);

        // Lưu lại để archive ở bước 4
        processedBatches.push({
          file:          excelFile,
          spreadsheetId: excelData.spreadsheetId,
          results:       results
        });

      }

      // 3. Ghi TOÀN BỘ kết quả vào Attendance Sheet (1 lần duy nhất)
      if (allResults.length > 0) {

        AttendanceWriter.write(allResults);

        Logger.log("Attendance Sheet Updated. Total rows : " + allResults.length);

      } else {

        Logger.log("Warning: Không có kết quả nào được ghi vào Attendance Sheet.");

      }

      // 4. Archive từng file đã xử lý (Archive Chấm Công + tạo file Bảng Công riêng + xóa gốc)
      for (const batch of processedBatches) {

        Logger.log("Archiving & Building Công for : " + batch.file.getName());

        // 4a. Ghi dữ liệu sạch (8 cột) vào TMP_ rồi move vào Archive Chấm Công
        ExcelImporter.formatAndArchive(
          batch.spreadsheetId,
          batch.results,
          batch.file.getName()
        );

        // 4b. Tạo Bảng Công riêng cho file này
        try {
          const congData = CongCalculator.build(batch.results);
          if (congData) {
            // Lấy tên file gốc, bỏ đuôi .xlsx để làm tên Bảng Công
            const baseName = batch.file.getName().replace(/\.[^/.]+$/, "");
            CongWriter.write(congData, baseName);
            Logger.log("Bảng Công created : CONG_" + baseName);
          } else {
            Logger.log("CongCalculator: Không có dữ liệu để tạo Bảng Công cho " + batch.file.getName());
          }
        } catch (congError) {
          Logger.log("CongWriter Warning for " + batch.file.getName() + ": " + congError.toString());
        }

        // 4c. Xóa file gốc khỏi Import Folder
        ExcelImporter.deleteFromImport(batch.file);

      }

      Logger.log("=================================");
      Logger.log("Attendance Service Finished");
      Logger.log("Total files processed : " + processedBatches.length);
      Logger.log("Total records written  : " + allResults.length);
      Logger.log("=================================");

    } catch (error) {

      Logger.log("=================================");
      Logger.log("Attendance Service ERROR");
      Logger.log(error.toString());
      Logger.log("=================================");

      throw error;

    }

  }

};