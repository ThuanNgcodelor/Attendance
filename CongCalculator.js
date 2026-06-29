/**
 * =====================================
 * Cong Calculator
 * Tính bảng Công từ danh sách AttendanceResult:
 *  - Group theo nhân viên
 *  - Pivot: dọc (ngày/nhân viên) → ngang (nhân viên/ngày)
 *  - Tính giá trị công: 1 | 0.5 | 0
 *  - Nhân viên ca đặc biệt (isSpecialSchedule) luôn = 0
 * =====================================
 */
const CongCalculator = {

  /**
   * Tạo dữ liệu bảng Công từ danh sách AttendanceResult
   *
   * @param {Object[]} results - Mảng AttendanceResult từ AttendanceCalculator
   * @returns {{ dates: Date[], rows: Object[], dateRange: string } | null}
   */
  build(results) {

    if (!results || results.length === 0) {
      Logger.log("CongCalculator: Không có kết quả để tính.");
      return null;
    }

    const tz = Session.getScriptTimeZone();

    // 1. Lấy tất cả dates unique, sort tăng dần
    const dateKeyMap = {};
    for (const r of results) {
      const key = this._dateKey(r.date, tz);
      if (!dateKeyMap[key]) {
        dateKeyMap[key] = r.date instanceof Date ? r.date : new Date(r.date.toString());
      }
    }

    const dates = Object.values(dateKeyMap).sort((a, b) => a.getTime() - b.getTime());

    Logger.log("CongCalculator: Total unique dates = " + dates.length);

    // 2. Lấy danh sách nhân viên theo thứ tự xuất hiện (giữ nguyên thứ tự)
    const employeeMap = {};
    const employeeOrder = [];
    for (const r of results) {
      const empId = r.employeeId.toString().trim();
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employeeId:        r.employeeId,
          employeeName:      r.employeeName,
          isSpecialSchedule: r.isSpecialSchedule || false
        };
        employeeOrder.push(empId);
      }
    }

    Logger.log("CongCalculator: Total employees = " + employeeOrder.length);

    // 3. Build lookup: "employeeId|dateKey" → AttendanceResult
    const lookup = {};
    for (const r of results) {
      const empId = r.employeeId.toString().trim();
      const key   = empId + "|" + this._dateKey(r.date, tz);
      lookup[key] = r;
    }

    // 4. Build pivot rows
    const rows = employeeOrder.map((empId, idx) => {

      const emp       = employeeMap[empId];
      const isSpecial = emp.isSpecialSchedule;

      const dailyValues = dates.map(date => {

        // Nhân viên ca đặc biệt → luôn 0 trong bảng Công
        if (isSpecial) return 0;

        const key    = empId + "|" + this._dateKey(date, tz);
        const result = lookup[key];

        if (!result) return 0;

        return this._getWorkValue(result);

      });

      const total = Math.round(dailyValues.reduce((sum, v) => sum + v, 0) * 100) / 100;

      return {
        stt:          idx + 1,
        employeeId:   emp.employeeId,
        employeeName: emp.employeeName,
        isSpecial:    isSpecial,
        dailyValues:  dailyValues,
        total:        total
      };

    });

    // 5. Tạo chuỗi khoảng thời gian
    const fmt       = d => Utilities.formatDate(d, tz, "dd-MMM-yy");
    const dateRange = fmt(dates[0]) + " - " + fmt(dates[dates.length - 1]);

    Logger.log("CongCalculator: dateRange = " + dateRange);

    return { dates, rows, dateRange };

  },

  /**
   * Tính giá trị công từ trạng thái chấm công
   * Option A (đơn giản):
   *  - Đủ công (cả 2 lần chấm hoặc chấm tự động) = 1
   *  - Nửa công (thiếu 1 trong 2 lần) = 0.5
   *  - Không chấm = 0
   *
   * @param {Object} result - AttendanceResult
   * @returns {number} 0 | 0.5 | 1
   */
  _getWorkValue(result) {

    if (!result) return 0;

    switch (result.status) {
      case STATUS.NORMAL:
      case STATUS.DEFAULT_USED:
      case STATUS.EXEMPT:
        return 1;

      case STATUS.NO_CHECKIN:
      case STATUS.NO_CHECKOUT:
        return 0.5;

      default:
        return 0; // NO_ATTENDANCE
    }

  },

  /**
   * Tạo date key dạng "yyyy-MM-dd" theo timezone script
   * Xử lý cả Date object lẫn string
   *
   * @param {Date|string} date
   * @param {string} tz - Timezone (VD: "Asia/Ho_Chi_Minh")
   * @returns {string}
   */
  _dateKey(date, tz) {

    if (!date) return "";

    try {
      const d = date instanceof Date ? date : new Date(date.toString());
      return Utilities.formatDate(d, tz || Session.getScriptTimeZone(), "yyyy-MM-dd");
    } catch (e) {
      return date.toString();
    }

  }

};
