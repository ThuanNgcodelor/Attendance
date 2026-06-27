/**
 * ===========================
 * Config Service
 * Đọc cấu hình từ Sheet Settings
 * ===========================
 */
const Config = {

  /**
   * Lấy giá trị theo Key từ sheet Settings
   * Ví dụ: Config.get("IMPORT_FOLDER_ID")
   *
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {

    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEETS.SETTINGS);

    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        return values[i][1];
      }
    }

    Logger.log("Config Warning: Không tìm thấy key [" + key + "] trong Settings.");
    return null;

  },

  // ─── FOLDER ───────────────────────────────

  /**
   * Trả về Import Folder
   * @returns {Folder}
   */
  getImportFolder() {
    const folderId = this.get("IMPORT_FOLDER_ID");
    if (!folderId) throw new Error("Config: IMPORT_FOLDER_ID chưa được cấu hình trong Settings.");
    return DriveApp.getFolderById(folderId);
  },

  /**
   * Trả về Archive Folder
   * @returns {Folder}
   */
  getArchiveFolder() {
    const folderId = this.get("ARCHIVE_FOLDER_ID");
    if (!folderId) throw new Error("Config: ARCHIVE_FOLDER_ID chưa được cấu hình trong Settings.");
    return DriveApp.getFolderById(folderId);
  },

  // ─── KHUNG GIỜ CHECKIN / CHECKOUT ────────

  /**
   * Giờ bắt đầu khung Check In (VD: "04:00")
   * @returns {string}
   */
  getCheckInStart() {
    return this.get("CHECKIN_START") || "04:00";
  },

  /**
   * Giờ kết thúc khung Check In (VD: "09:00")
   * @returns {string}
   */
  getCheckInEnd() {
    return this.get("CHECKIN_END") || "09:00";
  },

  /**
   * Giờ bắt đầu khung Check Out (VD: "15:00")
   * @returns {string}
   */
  getCheckOutStart() {
    return this.get("CHECKOUT_START") || "15:00";
  },

  /**
   * Giờ kết thúc khung Check Out (VD: "20:00")
   * @returns {string}
   */
  getCheckOutEnd() {
    return this.get("CHECKOUT_END") || "20:00";
  },

  // ─── GIỜ MẶC ĐỊNH (DEFAULT PUNCH) ────────

  /**
   * Giờ Check In mặc định — tự điền khi nhân viên có checkout nhưng không có checkin
   * Cấu hình trong Settings: DEFAULT_CHECKIN = "07:30"
   * Trả về null nếu chưa cấu hình (tính năng tắt)
   *
   * @returns {string|null}
   */
  getDefaultCheckIn() {
    return this.get("DEFAULT_CHECKIN") || null;
  },

  /**
   * Giờ Check Out mặc định — tự điền khi nhân viên có checkin nhưng không có checkout
   * Cấu hình trong Settings: DEFAULT_CHECKOUT = "17:00"
   * Trả về null nếu chưa cấu hình (tính năng tắt)
   *
   * @returns {string|null}
   */
  getDefaultCheckOut() {
    return this.get("DEFAULT_CHECKOUT") || null;
  }

};