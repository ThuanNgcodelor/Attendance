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

      // 4. Tạo file Bảng Công (Archive Công Folder)
      // ── Bọn trong try/catch riêng: lỗi Công không dừng bước archive chấm công ──
      if (allResults.length > 0) {

        try {

          Logger.log("---------------------------------");
          Logger.log("Building Bảng Công...");

          const congData = CongCalculator.build(allResults);

          if (congData) {

            // Đặt tên file theo khoảng ngày
            const congName = congData.dateRange; // VD: "01-May-26 - 31-May-26"

            CongWriter.write(congData, congName);

            Logger.log("Bảng Công created : CONG_" + congName);

          } else {

            Logger.log("CongCalculator: Không có dữ liệu để tạo Bảng Công.");

          }

        } catch (congError) {

          // Không dừng toàn bộ — chỉ log cảnh báo
          Logger.log("CongWriter Warning: " + congError.toString());

        }

      }

      // 5. Archive từng file đã xử lý (Archive Chấm Công + xóa gốc)
      for (const batch of processedBatches) {

        Logger.log("Archiving : " + batch.file.getName());

        // 5a. Ghi dữ liệu sạch (8 cột) vào TMP_ rồi move vào Archive Chấm Công
        ExcelImporter.formatAndArchive(
          batch.spreadsheetId,
          batch.results,
          batch.file.getName()
        );

        // 5b. Xóa file gốc khỏi Import Folder
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