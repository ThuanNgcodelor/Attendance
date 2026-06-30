/**
 * ===============================
 * HRM Attendance System
 * Constants
 * ===============================
 */

const SHEETS = {
  DASHBOARD:  "Dashboard",
  SETTINGS:   "Settings",
  EMPLOYEES:  "Employees",
  ATTENDANCE: "Attendance",
  LATENESS:   "Lateness",   // Datasource cho Looker Studio Dashboard
  LOGS:       "Logs"
};

const FOLDERS = {
  IMPORT: "Import",
  ARCHIVE: "Archive",
  ERROR: "Error"
};

const STATUS = {
  NORMAL: "Đủ công",
  DEFAULT_USED: "Chấm tự động",  // Một trong 2 lần chấm được điền mặc định
  NO_CHECKIN: "Thiếu Check In",
  NO_CHECKOUT: "Thiếu Check Out",
  NO_ATTENDANCE: "Không chấm công",
  EXEMPT: "Miễn chấm công"
};

const STRATEGY = {
  EARLIEST: "EARLIEST",
  LATEST: "LATEST"
};