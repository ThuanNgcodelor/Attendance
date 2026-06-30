/**
 * ==========================================
 * Lateness Parser
 * Parse file Archive Chấm Công (8 cột) → LatenessRecord[]
 *
 * Cấu trúc file input (giống Archive Chấm Công):
 *   Row 1: Tiêu đề "GIỜ CHẤM CÔNG (...)"  → bỏ qua
 *   Row 2: Header (STT, Mã NV, ...)        → bỏ qua
 *   Row 3+: Data
 *
 * Cột:
 *   [0] STT | [1] Mã NV | [2] Tên NV | [3] Phòng Ban
 *   [4] Ngày | [5] Thứ | [6] Lần chấm 1 | [7] Lần chấm 2
 * ==========================================
 */
const LatenessParser = {

  /**
   * Parse toàn bộ dữ liệu từ một file
   * Bỏ 2 dòng đầu (tiêu đề + header)
   *
   * @param {Array[][]} values - Mảng 2D từ Google Sheet tạm
   * @returns {Object[]} Mảng LatenessRecord
   */
  parse(values) {

    const records = [];

    // Bỏ dòng 0 (tiêu đề) và dòng 1 (header)
    for (let i = 2; i < values.length; i++) {

      const row = values[i];

      // Bỏ dòng rỗng (kiểm tra cột Mã NV)
      if (!row[1] && row[1] !== 0) continue;

      const record = this.parseRow(row);

      if (record) records.push(record);

    }

    Logger.log("LatenessParser: Parsed " + records.length + " records.");

    return records;

  },

  /**
   * Parse 1 dòng Excel thành LatenessRecord
   *
   * @param {Array} row - Một dòng dữ liệu
   * @returns {Object|null} LatenessRecord hoặc null nếu không hợp lệ
   */
  parseRow(row) {

    const employeeId = row[1] ? row[1].toString().trim() : null;

    if (!employeeId) return null;

    return {
      employeeId:   employeeId,
      employeeName: row[2] ? row[2].toString().trim() : "",
      department:   row[3] ? row[3].toString().trim() : "",  // Phòng Ban — bạn tự điền
      date:         row[4],                                   // Date object hoặc string
      dayOfWeek:    row[5] ? row[5].toString().trim() : "",
      checkIn:      row[6] || null,                           // Giờ vào (time/string/null)
      checkOut:     row[7] || null                            // Giờ ra  (time/string/null)
    };

  }

};
