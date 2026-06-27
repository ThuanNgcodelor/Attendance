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
  parse(values) {

    const records = [];

    // Bỏ dòng tiêu đề
    for (let i = 2; i < values.length; i++) {

      const row = values[i];

      // Bỏ dòng rỗng
      if (!row[1]) continue;

      records.push(
        this.parseRow(row)
      );

    }

    return records;

  },

  /**
   * Parse 1 dòng Excel
   */
  parseRow(row) {

    return {

      stt: row[0],

      employeeId: row[1],

      employeeName: row[2],

      department: row[3],

      date: row[4],

      dayOfWeek: row[5],

      punches: this.extractPunches(row)

    };

  },

  /**
   * Lấy tất cả lần chấm
   */
  extractPunches(row) {

    const punches = [];

    for (let i = 6; i <= 9; i++) {

      if (row[i]) {

        punches.push(row[i]);

      }

    }

    return punches;

  }

};