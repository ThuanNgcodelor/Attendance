/**
 * ==========================================
 * Summary Engine
 * Trách nhiệm: Extract, Transform, Load (ETL) Data Marts
 * Nhóm dữ liệu LatenessResult (nhật ký theo ngày) thành các số liệu tổng hợp
 * để phục vụ cho Dashboard Looker Studio.
 * ==========================================
 */
const SummaryEngine = {

  /**
   * Tính toán và trả về 2 mảng Summary
   * @param {Object[]} results - Mảng LatenessResult từ LatenessCalculator
   * @returns {Object} { employeeSummary, departmentSummary }
   */
  build(results) {

    if (!results || results.length === 0) {
      Logger.log("SummaryEngine: Không có dữ liệu để tổng hợp.");
      return { employeeSummary: [], departmentSummary: [] };
    }

    Logger.log("SummaryEngine: Đang tổng hợp dữ liệu (Data Marts)...");

    // Dùng Map để gom nhóm
    const empMap = new Map();
    const deptMap = new Map();

    for (const r of results) {

      const monthStr = this._getMonthStr(r.date);
      if (!monthStr) continue;

      const empId = (r.employeeId || "").toString().trim();
      const deptName = (r.department || "").toString().trim();

      // ── 1. Gom nhóm theo Từng Nhân Viên (Mã NV + Tháng) ──
      const empKey = monthStr + "_" + empId;
      if (!empMap.has(empKey)) {
        empMap.set(empKey, {
          month: monthStr,
          employeeId: empId,
          employeeName: r.employeeName,
          department: deptName,
          totalCong: 0,
          totalLateCount: 0,
          totalEarlyCount: 0,
          totalLateMinutes: 0,
          totalEarlyMinutes: 0
        });
      }

      const empData = empMap.get(empKey);
      
      // Cộng dồn
      empData.totalCong += (r.congValue || 0);
      empData.totalLateMinutes += (r.lateMinutes || 0);
      empData.totalEarlyMinutes += (r.earlyMinutes || 0);
      
      // Chỉ tính là 1 lần trễ/sớm nếu số phút vượt quá ngưỡng cho phép (tái sử dụng từ LatenessCalculator.FREQUENCY_THRESHOLD_MINUTES)
      const threshold = LatenessCalculator ? LatenessCalculator.FREQUENCY_THRESHOLD_MINUTES : 5;
      if ((r.lateMinutes || 0) > threshold) empData.totalLateCount++;
      if ((r.earlyMinutes || 0) > threshold) empData.totalEarlyCount++;


      // ── 2. Gom nhóm theo Phòng Ban (Phòng ban + Tháng) ──
      const deptKey = monthStr + "_" + deptName;
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, {
          month: monthStr,
          department: deptName,
          uniqueEmployees: new Set(),
          totalCong: 0,
          totalLateCount: 0,
          totalLateMinutes: 0
        });
      }

      const deptData = deptMap.get(deptKey);
      deptData.uniqueEmployees.add(empId);
      deptData.totalCong += (r.congValue || 0);
      deptData.totalLateMinutes += (r.lateMinutes || 0);
      if ((r.lateMinutes || 0) > threshold) deptData.totalLateCount++;

    }

    // Chuyển đổi Map thành Mảng (Array) và định dạng kết quả
    const employeeSummary = Array.from(empMap.values());

    const departmentSummary = Array.from(deptMap.values()).map(d => {
      const totalEmp = d.uniqueEmployees.size;
      return {
        month: d.month,
        department: d.department,
        totalEmployees: totalEmp,
        totalCong: d.totalCong,
        totalLateCount: d.totalLateCount,
        avgLateMinutes: totalEmp > 0 ? parseFloat((d.totalLateMinutes / totalEmp).toFixed(1)) : 0
      };
    });

    Logger.log("SummaryEngine: Hoàn tất. Employee=" + employeeSummary.length + " | Department=" + departmentSummary.length);

    return {
      employeeSummary,
      departmentSummary
    };

  },

  // ─────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────

  /**
   * Lấy chuỗi định dạng "MM/yyyy" từ Date object hoặc chuỗi gốc
   */
  _getMonthStr(dateRaw) {
    if (!dateRaw) return null;
    try {
      const d = (dateRaw instanceof Date) ? dateRaw : new Date(dateRaw.toString());
      if (isNaN(d.getTime())) return null;
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "MM/yyyy");
    } catch (e) {
      return null;
    }
  }

};
