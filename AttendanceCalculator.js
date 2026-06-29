/**
 * ==========================================
 * Attendance Calculator
 * Xử lý nghiệp vụ chấm công:
 *  - Xác định giờ vào (firstPunch)
 *  - Xác định giờ ra (secondPunch)
 *  - Sinh trạng thái (status)
 *
 * Đọc giờ chuẩn từ Config (Settings Sheet)
 * ==========================================
 */
const AttendanceCalculator = {

  /**
   * Tính chấm công cho 1 record
   *
   * @param {Object} record - AttendanceRecord từ AttendanceParser
   * @returns {Object} Kết quả chấm công
   */
  calculate(record) {

    // ── SPECIAL SCHEDULE CHECK ─────────────────────────────────────────────
    // Nếu nhân viên có ca đặc biệt → dùng logic riêng, không lọc theo khung giờ
    const specialIds = Config.getSpecialEmployeeIds();
    const isSpecial   = specialIds.some(id => id === record.employeeId.toString().trim());

    if (isSpecial) {
      return this.calculateSpecialSchedule(record);
    }
    // ──────────────────────────────────────────────────────────────────

    // Đọc giờ cấu hình từ Settings và chuẩn hóa về dạng "HH:mm"
    const checkInStart  = this.formatTime(Config.getCheckInStart())  || "04:00";
    const checkInEnd    = this.formatTime(Config.getCheckInEnd())    || "09:00";
    const checkOutStart = this.formatTime(Config.getCheckOutStart()) || "15:00";
    const checkOutEnd   = this.formatTime(Config.getCheckOutEnd())   || "20:00";

    let firstPunch  = this.findFirstPunch(record.punches, checkInStart, checkInEnd);
    let secondPunch = this.findSecondPunch(record.punches, checkOutStart, checkOutEnd);

    // ── DEFAULT PUNCH ──────────────────────────────────────────────────
    // Nếu chỉ thiếu 1 trong 2 lần chấm → tự điền giá trị mặc định từ Config
    // Điều kiện: phải có ít nhất 1 lần chấm thực tế mới áp dụng default
    let isDefaultUsed = false;

    if (!firstPunch && secondPunch) {
      // Có checkout, thiếu checkin → điền DEFAULT_CHECKIN
      const defaultCheckIn = this.formatTime(Config.getDefaultCheckIn());
      if (defaultCheckIn) {
        firstPunch    = defaultCheckIn;
        isDefaultUsed = true;
        Logger.log("Default CheckIn applied for " + record.employeeId + " | " + record.date);
      }
    }

    if (firstPunch && !secondPunch) {
      // Có checkin, thiếu checkout → điền DEFAULT_CHECKOUT
      const defaultCheckOut = this.formatTime(Config.getDefaultCheckOut());
      if (defaultCheckOut) {
        secondPunch   = defaultCheckOut;
        isDefaultUsed = true;
        Logger.log("Default CheckOut applied for " + record.employeeId + " | " + record.date);
      }
    }
    // ──────────────────────────────────────────────────────────────────

    return {

      employeeId:        record.employeeId,
      employeeName:      record.employeeName,
      department:        record.department,
      date:              record.date,
      dayOfWeek:         record.dayOfWeek,
      firstPunch:        firstPunch,
      secondPunch:       secondPunch,
      status:            this.buildStatus(firstPunch, secondPunch, isDefaultUsed),
      isSpecialSchedule: false

    };

  },

  /**
   * Tính chấm công cho nhân viên CA ĐẶC BIỆT
   *
   * Khác với calculate() chuẩn:
   *  - Không lọc theo khung giờ CHECKIN/CHECKOUT
   *  - Lấy punch sớm nhất làm firstPunch, muộn nhất làm secondPunch
   *  - Không áp dụng DEFAULT_CHECKIN / DEFAULT_CHECKOUT
   *
   * @param {Object} record
   * @returns {Object} AttendanceResult
   */
  calculateSpecialSchedule(record) {

    const times = (record.punches || [])
      .map(p => this.formatTime(p))
      .filter(t => t !== null)
      .sort(); // Sắp xếp chuỗi "HH:mm" tăng dần

    const firstPunch  = times.length > 0 ? times[0] : null;
    const secondPunch = times.length > 1 ? times[times.length - 1] : null;

    Logger.log(
      "Special Schedule: " + record.employeeId +
      " | " + record.date +
      " | punches=" + times.join(", ") +
      " | first=" + firstPunch +
      " | last=" + secondPunch
    );

    return {

      employeeId:        record.employeeId,
      employeeName:      record.employeeName,
      department:        record.department,
      date:              record.date,
      dayOfWeek:         record.dayOfWeek,
      firstPunch:        firstPunch,
      secondPunch:       secondPunch,
      status:            this.buildStatus(firstPunch, secondPunch, false),
      isSpecialSchedule: true  // Flag dùng cho CongCalculator

    };

  },

  /**
   * Lấy lần chấm sáng (Check In) sớm nhất trong khung giờ
   *
   * @param {string[]} punches - Danh sách các lần chấm
   * @param {string} start     - Giờ bắt đầu khung Check In (VD: "04:00")
   * @param {string} end       - Giờ kết thúc khung Check In (VD: "09:00")
   * @returns {string|null}
   */
  findFirstPunch(punches, start, end) {

    if (!punches || punches.length === 0) return null;

    let first = null;

    for (const punch of punches) {

      const time = this.formatTime(punch);

      if (!time) continue;

      if (time >= start && time <= end) {
        if (!first || time < first) {
          first = time;
        }
      }

    }

    return first;

  },

  /**
   * Lấy lần chấm chiều (Check Out) trễ nhất trong khung giờ
   *
   * @param {string[]} punches - Danh sách các lần chấm
   * @param {string} start     - Giờ bắt đầu khung Check Out (VD: "15:00")
   * @param {string} end       - Giờ kết thúc khung Check Out (VD: "20:00")
   * @returns {string|null}
   */
  findSecondPunch(punches, start, end) {

    if (!punches || punches.length === 0) return null;

    let last = null;

    for (const punch of punches) {

      const time = this.formatTime(punch);

      if (!time) continue;

      if (time >= start && time <= end) {
        if (!last || time > last) {
          last = time;
        }
      }

    }

    return last;

  },

  /**
   * Chuẩn hóa giá trị punch về chuỗi "HH:mm"
   * Xử lý cả trường hợp punch là Date object, số thực (từ Excel), hoặc string
   *
   * @param {*} punch - Giá trị lần chấm (Date | string | number)
   * @returns {string|null} Chuỗi giờ "HH:mm" hoặc null nếu không hợp lệ
   */
  formatTime(punch) {

    if (!punch) return null;

    // Trường hợp là Date object (Apps Script thường trả về Date)
    if (punch instanceof Date) {
      const h = String(punch.getHours()).padStart(2, "0");
      const m = String(punch.getMinutes()).padStart(2, "0");
      return h + ":" + m;
    }

    // Trường hợp là số thực từ Excel (fraction of day: 0.5 = 12:00)
    if (typeof punch === "number") {
      const totalMinutes = Math.round(punch * 24 * 60);
      const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const m = String(totalMinutes % 60).padStart(2, "0");
      return h + ":" + m;
    }

    // Trường hợp là string
    const str = punch.toString().trim();

    // Đã đúng dạng HH:mm
    if (/^\d{2}:\d{2}$/.test(str)) return str;

    // Dạng HH:mm:ss
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str.substring(0, 5);

    return null;

  },

  /**
   * Sinh trạng thái chấm công
   *
   * @param {string|null} firstPunch
   * @param {string|null} secondPunch
   * @param {boolean}     isDefaultUsed - true nếu một trong 2 lần chấm được điền mặc định
   * @returns {string} Trạng thái
   */
  buildStatus(firstPunch, secondPunch, isDefaultUsed = false) {

    if (!firstPunch && !secondPunch) return STATUS.NO_ATTENDANCE;

    if (!firstPunch)  return STATUS.NO_CHECKIN;

    if (!secondPunch) return STATUS.NO_CHECKOUT;

    if (isDefaultUsed) return STATUS.DEFAULT_USED;

    return STATUS.NORMAL;

  }

};