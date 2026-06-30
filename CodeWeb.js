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
 * API tiếp nhận file Excel từ Frontend, lưu vào Import Folder,
 * thực hiện xử lý chấm công và trả về các link kết quả.
 * 
 * @param {string} fileName - Tên file gốc (VD: "Cong thu nghiem.xlsx")
 * @param {string} base64Data - Dữ liệu file mã hóa base64 từ client
 * @returns {Object} Đường dẫn các file kết quả và thư mục lưu trữ
 */
function uploadAndProcessFile(fileName, base64Data) {
  try {
    Logger.log("API uploadAndProcessFile: Bắt đầu tiếp nhận file: " + fileName);
    
    // 1. Decode base64 và tạo Blob file Excel
    const decodedBytes = Utilities.base64Decode(base64Data);
    const contentType = getMimeTypeFromFileName(fileName);
    const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
    
    // 2. Lưu file vào Import Folder
    const importFolder = Config.getImportFolder();
    const uploadedFile = importFolder.createFile(blob);
    Logger.log("API uploadAndProcessFile: Đã lưu file vào Import Folder, ID: " + uploadedFile.getId());
    
    // 3. Kích hoạt toàn bộ luồng xử lý Backend chấm công
    AttendanceService.processAttendance();
    Logger.log("API uploadAndProcessFile: Backend xử lý thành công.");
    
    // 4. Lấy URL của thư mục lưu trữ
    const archiveFolder = Config.getArchiveFolder();      // Thư mục Archive Chấm Công
    const archiveCongFolder = Config.getArchiveCongFolder();  // Thư mục Archive Công
    
    // 5. Tìm file Bảng Công mới tạo nhất trong thư mục Archive Công để trả về link trực tiếp
    const latestCongFileUrl = getLatestFileInFolder(archiveCongFolder);
    
    return {
      success: true,
      congFileUrl: latestCongFileUrl,
      archiveCongFolderUrl: archiveCongFolder.getUrl(),
      archiveFolderUrl: archiveFolder.getUrl()
    };
    
  } catch (error) {
    Logger.log("API uploadAndProcessFile ERROR: " + error.toString());
    throw new Error(error.message || error.toString());
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

