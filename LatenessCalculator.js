/**
 * ==========================================
 * Lateness Calculator
 * Tính toán Đi Trễ / Về Sớm từ LatenessRecord[]:
 *
 *  - Công         : 1 nếu có đủ checkIn + checkOut, ngược lại = 0
 *  - Đi trễ       : max(0, checkIn  - STANDARD_CHECKIN)  tính theo phút
 *  - Về sớm       : max(0, STANDARD_CHECKOUT - checkOut) tính theo phút
 *  - Tần suất đi trễ  : tích luỹ số lần đi trễ > 5 phút của NV tính đến ngày đó
 *  - Tần suất về sớm  : tích luỹ số lần về sớm > 5 phút của NV tính đến ngày đó
 *
 * Threshold tần suất: > 5 phút mới tính là 1 lần
 * ==========================================
 */
const LatenessCalculator = {

  /** Ngưỡng phút để tính là đi trễ / về sớm (tần suất) */
  FREQUENCY_THRESHOLD_MINUTES: 5,

  /**
   * Tính toán toàn bộ LatenessRecord[] → LatenessResult[]
   *
   * @param {Object[]} records - Mảng LatenessRecord từ LatenessParser
   * @returns {Object[]} Mảng LatenessResult (đủ 11 cột output)
   */
  build(records) {

    if (!records || records.length === 0) {
      Logger.log("LatenessCalculator: Không có record nào để tính.");
      return [];
    }

    // Đọc giờ chuẩn từ Settings Sheet
    const standardIn  = Config.getStandardCheckIn();   // "07:30"
    const standardOut = Config.getStandardCheckOut();  // "16:30"

    Logger.log("LatenessCalculator: standardIn=" + standardIn + " | standardOut=" + standardOut);

    // ── BƯỚC 1: Tính Công, Đi trễ, Về sớm cho từng record ──────────────
    const computed = records.map(record => {

      const checkInStr  = this._formatTime(record.checkIn);
      const checkOutStr = this._formatTime(record.checkOut);

      // Công: 1 nếu có đủ 2 lần chấm
      const congValue = (checkInStr && checkOutStr) ? 1 : 0;

      // Đi trễ (phút): chỉ tính khi có giờ vào
      const lateMinutes = checkInStr
        ? Math.max(0, this._diffMinutes(standardIn, checkInStr))
        : 0;

      // Về sớm (phút): chỉ tính khi có giờ ra
      const earlyMinutes = checkOutStr
        ? Math.max(0, this._diffMinutes(checkOutStr, standardOut))
        : 0;

      return {
        date:          record.date,
        employeeId:    record.employeeId,
        employeeName:  record.employeeName,
        department:    record.department,
        checkIn:       checkInStr || 0,   // 0 nếu không có (Looker Studio aggregate tốt hơn empty)
        checkOut:      checkOutStr || 0,
        congValue,
        lateMinutes,
        earlyMinutes,
        lateFrequency:  0,  // sẽ tính ở bước 2
        earlyFrequency: 0   // sẽ tính ở bước 2
      };

    });

    // ── BƯỚC 2: Group theo employeeId → tính tần suất tích luỹ ─────────
    // Group
    const byEmployee = {};
    for (const item of computed) {
      const id = item.employeeId;
      if (!byEmployee[id]) byEmployee[id] = [];
      byEmployee[id].push(item);
    }

    // Với mỗi NV: sort theo date tăng dần, rồi tích luỹ tần suất
    const results = [];

    for (const empId of Object.keys(byEmployee)) {

      const rows = byEmployee[empId].sort((a, b) =>
        this._toDateMs(a.date) - this._toDateMs(b.date)
      );

      let lateCounter  = 0;
      let earlyCounter = 0;

      for (const row of rows) {

        if (row.lateMinutes  > this.FREQUENCY_THRESHOLD_MINUTES)  lateCounter++;
        if (row.earlyMinutes > this.FREQUENCY_THRESHOLD_MINUTES) earlyCounter++;

        row.lateFrequency  = lateCounter;
        row.earlyFrequency = earlyCounter;

        results.push(row);

      }

    }

    Logger.log("LatenessCalculator: Computed " + results.length + " results.");

    return results;

  },

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Tính khoảng cách phút giữa 2 chuỗi giờ "HH:mm"
   * Trả về số dương nếu timeB > timeA, âm nếu ngược lại
   * VD: _diffMinutes("07:30", "07:40") = 10
   *     _diffMinutes("16:40", "16:30") = -10
   *
   * @param {string} timeA - "HH:mm"
   * @param {string} timeB - "HH:mm"
   * @returns {number} Số phút (có thể âm)
   */
  _diffMinutes(timeA, timeB) {

    const toMin = (t) => {
      const parts = t.split(":");
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    return toMin(timeB) - toMin(timeA);

  },

  /**
   * Chuẩn hóa giá trị giờ về chuỗi "HH:mm"
   * Xử lý Date object, số thực Excel, string, time object
   *
   * @param {*} punch - Giá trị giờ
   * @returns {string|null} "HH:mm" hoặc null nếu không hợp lệ
   */
  _formatTime(punch) {

    if (!punch && punch !== 0) return null;

    // Date object
    if (punch instanceof Date) {
      const h = String(punch.getHours()).padStart(2, "0");
      const m = String(punch.getMinutes()).padStart(2, "0");
      return h + ":" + m;
    }

    // Số thực Excel (fraction of day)
    if (typeof punch === "number") {
      const totalMinutes = Math.round(punch * 24 * 60);
      const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const m = String(totalMinutes % 60).padStart(2, "0");
      return h + ":" + m;
    }

    // String
    const str = punch.toString().trim();
    if (/^\d{2}:\d{2}$/.test(str))     return str;          // HH:mm
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str.substring(0, 5); // HH:mm:ss

    return null;

  },

  /**
   * Chuyển date (Date object hoặc string) về milliseconds để so sánh
   *
   * @param {Date|string} date
   * @returns {number} Milliseconds
   */
  _toDateMs(date) {

    if (!date) return 0;

    try {
      const d = date instanceof Date ? date : new Date(date.toString());
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch (e) {
      return 0;
    }

  }

};
