/**
 * ==========================================
 * Attendance Parser
 * Chuyển dữ liệu Excel -> AttendanceRecord
 * ==========================================
 */
const AttendanceParser = {

  /**
   * Parse toàn bộ dữ liệu
   */
  parse(values, displayValues) {

    const records = [];

    // Bỏ dòng tiêu đề
    for (let i = 2; i < values.length; i++) {

      const row = values[i];
      const displayRow = displayValues ? displayValues[i] : row;

      // Bỏ dòng rỗng
      if (!row[1]) continue;

      records.push(
        this.parseRow(row, displayRow)
      );

    }

    return records;

  },

  /**
   * Parse 1 dòng Excel
   */
  parseRow(row, displayRow) {

    return {

      stt: row[0],

      employeeId: row[1],

      employeeName: row[2],

      department: row[3],

      date: row[4], // Giữ Date object cho cột Ngày

      dayOfWeek: row[5],

      punches: this.extractPunches(row, displayRow)

    };

  },

  /**
   * Lấy tất cả lần chấm (dùng chuỗi hiển thị để tránh bug múi giờ)
   */
  extractPunches(row, displayRow) {

    const punches = [];

    for (let i = 6; i <= 9; i++) {

      if (displayRow[i]) {

        punches.push(displayRow[i]);

      }

    }

    return punches;

  }

};