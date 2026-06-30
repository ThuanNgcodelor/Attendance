/**
 * CodeWeb.js
 * Điểm tiếp nhận yêu cầu (Entry Point) của Web Application
 */

/**
 * Hàm tiếp nhận yêu cầu GET từ trình duyệt
 * Render giao diện chính Index.html
 * 
 * @param {Object} e - Event object từ GAS Web App
 * @returns {HtmlOutput} Giao diện HTML được cấu hình responsive và tiêu đề
 */
function doGet(e) {
  // Tạo template từ file Index.html
  const template = HtmlService.createTemplateFromFile('Index');
  
  // Render template và thiết lập các thông số hiển thị
  return template.evaluate()
    .setTitle('HRM Attendance System')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, shrink-to-fit=no');
}

/**
 * API cho Tab "Xử lý Chấm Công" — gọi từ Script.html (runAttendanceUI)
 * Chạy toàn bộ pipeline Attendance và trả về các link kết quả.
 *
 * @returns {Object} Đường dẫn các file kết quả và thư mục lưu trữ
 */
function runAttendanceWeb() {
  try {
    Logger.log("API runAttendanceWeb: Bắt đầu xử lý Chấm Công...");
    
    // Kích hoạt toàn bộ luồng xử lý Backend chấm công
    AttendanceService.processAttendance();
    Logger.log("API runAttendanceWeb: Backend xử lý thành công.");
    
    // Lấy URL của thư mục lưu trữ
    const archiveFolder = Config.getArchiveFolder();      // Thư mục Archive Chấm Công
    const archiveCongFolder = Config.getArchiveCongFolder();  // Thư mục Archive Công
    
    // Tìm file Bảng Công mới tạo nhất trong thư mục Archive Công để trả về link trực tiếp
    const latestCongFileUrl = getLatestFileInFolder(archiveCongFolder);
    
    return {
      success: true,
      congFileUrl: latestCongFileUrl,
      archiveCongFolderUrl: archiveCongFolder.getUrl(),
      archiveFolderUrl: archiveFolder.getUrl()
    };
    
  } catch (error) {
    Logger.log("API runAttendanceWeb ERROR: " + error.toString());
    throw new Error(error.message || error.toString());
  }
}

/**
 * Xóa toàn bộ file trong thư mục Import trước khi upload file mới.
 */
function clearImportFolder() {
  try {
    const folder = Config.getImportFolder();
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext()) {
      files.next().setTrashed(true);
      count++;
    }
    Logger.log(`API clearImportFolder: Đã xóa ${count} file cũ.`);
    return true;
  } catch (error) {
    Logger.log("API clearImportFolder ERROR: " + error.toString());
    throw new Error("Không thể làm sạch thư mục Import: " + error.message);
  }
}

/**
 * API tiếp nhận 1 file Chấm Công từ Frontend và lưu vào Import Folder.
 * 
 * @param {string} fileName - Tên file gốc
 * @param {string} base64Data - Dữ liệu file mã hóa base64 từ client
 */
function uploadFileToImportFolder(fileName, base64Data) {
  try {
    Logger.log("API uploadFileToImportFolder: Đang lưu file " + fileName);
    const decodedBytes = Utilities.base64Decode(base64Data);
    const contentType = getMimeTypeFromFileName(fileName);
    const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
    
    const folder = Config.getImportFolder();
    folder.createFile(blob);
    
    return true;
  } catch (error) {
    Logger.log("API uploadFileToImportFolder ERROR: " + error.toString());
    throw new Error("Lỗi khi tải file " + fileName + ": " + error.message);
  }
}

/**
 * Tìm file được chỉnh sửa mới nhất trong một thư mục
 * 
 * @param {Folder} folder - Thư mục Drive
 * @returns {string|null} URL của file hoặc null nếu thư mục trống
 */
function getLatestFileInFolder(folder) {
  const files = folder.getFiles();
  let latestFile = null;
  let latestTime = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const lastUpdated = file.getLastUpdated().getTime();
    if (lastUpdated > latestTime) {
      latestTime = lastUpdated;
      latestFile = file;
    }
  }
  
  return latestFile ? latestFile.getUrl() : null;
}

/**
 * Trả về MimeType phù hợp với đuôi file
 * 
 * @param {string} fileName
 * @returns {string} MimeType
 */
function getMimeTypeFromFileName(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xlsm': return 'application/vnd.ms-excel.sheet.macroEnabled.12';
    case 'xls':  return 'application/vnd.ms-excel';
    default:     return 'application/octet-stream';
  }
}

/**
 * API cho Tab "Đi Trễ / Về Sớm" — gọi từ Script.html (runLatenessUI)
 * Chạy toàn bộ pipeline Lateness và trả về các link kết quả.
 *
 * @returns {Object} { latenessSheetUrl, archiveFileUrl, archiveFolderUrl, totalRows }
 */
function runLatenessWeb() {
  try {
    Logger.log("API runLatenessWeb: Started.");

    // Chạy pipeline Lateness
    LatenessService.processLateness();

    // Lấy URL Sheet "Lateness" trong HRM Database
    const spreadsheet    = SpreadsheetApp.getActiveSpreadsheet();
    const latenessSheet  = spreadsheet.getSheetByName(SHEETS.LATENESS);
    const latenessSheetUrl = latenessSheet
      ? spreadsheet.getUrl() + "#gid=" + latenessSheet.getSheetId()
      : spreadsheet.getUrl();

    const totalRows = latenessSheet
      ? Math.max(0, latenessSheet.getLastRow() - 1) // trừ header
      : 0;

    // Lấy URL folder và file mới nhất trong Archiver Tổng hợp
    const archiveFolder    = Config.getLatenessArchiveFolder();
    const archiveFileUrl   = getLatestFileInFolder(archiveFolder);
    const archiveFolderUrl = archiveFolder.getUrl();

    Logger.log("API runLatenessWeb: Done. Rows=" + totalRows);

    return {
      success:          true,
      latenessSheetUrl: latenessSheetUrl,
      archiveFileUrl:   archiveFileUrl,
      archiveFolderUrl: archiveFolderUrl,
      totalRows:        totalRows
    };

  } catch (error) {
    Logger.log("API runLatenessWeb ERROR: " + error.toString());
    throw new Error(error.message || error.toString());
  }
}

/**
 * Xóa toàn bộ file trong thư mục Lateness trước khi upload file mới.
 */
function clearLatenessFolder() {
  try {
    const folder = Config.getLatenessFolder();
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext()) {
      files.next().setTrashed(true);
      count++;
    }
    Logger.log(`API clearLatenessFolder: Đã xóa ${count} file cũ.`);
    return true;
  } catch (error) {
    Logger.log("API clearLatenessFolder ERROR: " + error.toString());
    throw new Error("Không thể làm sạch thư mục Lateness: " + error.message);
  }
}

/**
 * API tiếp nhận 1 file Lateness từ Frontend và lưu vào Lateness Folder.
 * 
 * @param {string} fileName - Tên file gốc
 * @param {string} base64Data - Dữ liệu file mã hóa base64 từ client
 */
function uploadFileToLatenessFolder(fileName, base64Data) {
  try {
    Logger.log("API uploadFileToLatenessFolder: Đang lưu file " + fileName);
    const decodedBytes = Utilities.base64Decode(base64Data);
    const contentType = getMimeTypeFromFileName(fileName);
    const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
    
    const folder = Config.getLatenessFolder();
    folder.createFile(blob);
    
    return true;
  } catch (error) {
    Logger.log("API uploadFileToLatenessFolder ERROR: " + error.toString());
    throw new Error("Lỗi khi tải file " + fileName + ": " + error.message);
  }
}

