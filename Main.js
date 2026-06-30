function runAttendance() {
  AttendanceService.processAttendance();
}

/**
 * Entry point cho pipeline Lateness (Đi Trễ / Về Sớm)
 * Chạy độc lập với runAttendance()
 *
 * Yêu cầu trước khi chạy:
 *  1. Thêm key LATENESS_FOLDER_ID vào Settings Sheet
 *  2. Thêm key STANDARD_CHECKIN  = "07:30" vào Settings Sheet
 *  3. Thêm key STANDARD_CHECKOUT = "16:30" vào Settings Sheet
 *  4. Upload file (TCHC.xlsx, XNK.xlsx...) vào Lateness Folder
 *     (đảm bảo cột D đã điền tên Phòng Ban)
 */
function runLateness() {
  LatenessService.processLateness();
}