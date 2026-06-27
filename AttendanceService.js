/**
 * =====================================
 * Attendance Service
 * Orchestrator — Điều phối toàn bộ quy trình chấm công
 *
 * Luồng:
 *  1. Tìm file trong Import Folder
 *  2. Convert -> Google Sheet tạm (TMP_)
 *  3. Parse dữ liệu -> AttendanceRecord[]
 *  4. Calculate -> AttendanceResult[]
 *  5. Ghi vào sheet Attendance (có cột Trạng thái)
 *  6. Ghi dữ liệu sạch (8 cột) vào TMP_ rồi move vào Archive
 *  7. Xóa file gốc khỏi Import Folder
 * =====================================
 */
const AttendanceService = {

  processAttendance() {
    try {

      // 1. Tìm file trong Import Folder
      const excelFile = ExcelImporter.findLatestExcel();

      if (!excelFile) {
        throw new Error("Không tìm thấy file (.xlsx / .xlsm / Google Sheet) trong Import Folder. Vui lòng kiểm tra lại.");
      }

      // 2. Đọc dữ liệu (convert sang TMP_ rồi đọc)
      const excelData = ExcelImporter.readAttendanceData(excelFile);

      // 3. Parse raw data -> AttendanceRecord[]
      const records = AttendanceParser.parse(excelData.values);

      if (records.length === 0) {
        throw new Error("Không có dữ liệu hợp lệ trong file. Vui lòng kiểm tra cấu trúc file Excel.");
      }

      // 4. Calculate -> AttendanceResult[]
      const results = records.map(record =>
        AttendanceCalculator.calculate(record)
      );
      // 5. Ghi vào sheet Attendance (đầy đủ 9 cột, có Trạng thái)
      AttendanceWriter.write(results);

      // 6. Ghi dữ liệu sạch (8 cột, không có Trạng thái) vào TMP_
      //    rồi move TMP_ vào Archive Folder
      ExcelImporter.formatAndArchive(
        excelData.spreadsheetId,
        results,
        excelFile.getName()
      );

      // 7. Xóa file gốc khỏi Import Folder
      ExcelImporter.deleteFromImport(excelFile);

      Logger.log("=================================");
      Logger.log("Attendance Service Finished");
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