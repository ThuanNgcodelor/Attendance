# HRM Attendance Engine

Phiên bản: 1.0.0 — Cập nhật: 2026-06-29  
Công nghệ: Google Apps Script (V8) + Google Sheets + Google Drive  
Repo: https://github.com/ThuanNgcodelor/Attendance

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc](#2-kiến-trúc)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Các module](#4-các-module)
5. [Luồng xử lý](#5-luồng-xử-lý)
6. [Settings Sheet](#6-settings-sheet)
7. [Trạng thái chấm công](#7-trạng-thái-chấm-công)
8. [Nhân viên ca đặc biệt](#8-nhân-viên-ca-đặc-biệt)
9. [Hướng dẫn chạy](#9-hướng-dẫn-chạy)
10. [Changelog](#10-changelog)
11. [Kế hoạch mở rộng](#11-kế-hoạch-mở-rộng)

---

## 1. Tổng quan

Đây không phải script dùng một lần. Mục tiêu là xây dựng engine nền tảng, sau này mở rộng thêm các module như Leave, OT, Payroll, KPI mà không cần viết lại.

Thiết kế theo hướng OOP / SRP: mỗi file một nhiệm vụ, config tập trung tại Settings Sheet, không hardcode giá trị trong code.

---

## 2. Kiến trúc

```
Drive
  Import/          <- kéo file .xlsx vào đây
  Archive Chấm Công/  <- file sau xử lý (8 cột sạch, có tiêu đề)
  Archive Công/       <- file bảng công (pivot theo ngày)

Apps Script
  AttendanceService   (điều phối)
    ExcelImporter     - tìm, đọc, archive file Excel
    AttendanceParser  - parse dữ liệu thô thành object
    AttendanceCalculator - tính checkin/checkout/status
    AttendanceWriter  - ghi kết quả xuống Sheet
    CongCalculator    - pivot dữ liệu dọc thành ngang, tính giá trị công
    CongWriter        - tạo file Bảng Công, lưu vào Archive Công
    Config            - đọc cấu hình từ Settings Sheet
    SheetService      - tiện ích làm việc với Sheet
    Constants         - hằng số toàn hệ thống

Google Sheets (HRM Database)
  Settings     <- cấu hình hệ thống
  Attendance   <- kết quả chấm công (9 cột)
```

---

## 3. Cấu trúc thư mục

```
AppScipts/
  Attendance/
    appsscript.json         - manifest, timezone, runtime
    Main.js                 - entry point (hàm runAttendance)
    Constants.js            - hằng số: SHEETS, STATUS
    Config.js               - đọc config từ Settings Sheet
    SheetService.js         - tiện ích Sheet
    ExcelImporter.js        - import, convert, archive file Excel
    AttendanceParser.js     - parse dữ liệu Excel thành object
    AttendanceCalculator.js - tính toán chấm công
    AttendanceWriter.js     - ghi kết quả xuống Sheet
    CongCalculator.js       - tính bảng công (pivot)
    CongWriter.js           - tạo file Bảng Công
    AttendanceService.js    - orchestrator

  docs/
    README.md
```

---

## 4. Các module

### Main.js

Entry point duy nhất được gọi từ Apps Script Editor:

```javascript
function runAttendance() {
  AttendanceService.processAttendance();
}
```

---

### Constants.js

```javascript
SHEETS.SETTINGS    = "Settings"
SHEETS.ATTENDANCE  = "Attendance"

STATUS.NORMAL         = "Đủ công"
STATUS.DEFAULT_USED   = "Chấm tự động"
STATUS.NO_CHECKIN     = "Thiếu Check In"
STATUS.NO_CHECKOUT    = "Thiếu Check Out"
STATUS.NO_ATTENDANCE  = "Không chấm công"
STATUS.EXEMPT         = "Miễn chấm công"
```

---

### Config.js

Đọc cấu hình từ Settings Sheet theo cặp Key–Value. Có cảnh báo log nếu thiếu key, có fallback cho các giá trị không bắt buộc.

| Method | Key Settings | Bắt buộc |
|---|---|---|
| `getImportFolder()` | `IMPORT_FOLDER_ID` | Có |
| `getArchiveFolder()` | `ARCHIVE_FOLDER_ID` | Có |
| `getArchiveCongFolder()` | `ARCHIVE_CONG_FOLDER_ID` | Có |
| `getCheckInStart()` | `CHECKIN_START` | Không (mặc định 04:00) |
| `getCheckInEnd()` | `CHECKIN_END` | Không (mặc định 09:00) |
| `getCheckOutStart()` | `CHECKOUT_START` | Không (mặc định 15:00) |
| `getCheckOutEnd()` | `CHECKOUT_END` | Không (mặc định 20:00) |
| `getDefaultCheckIn()` | `DEFAULT_CHECKIN` | Không (null = tắt) |
| `getDefaultCheckOut()` | `DEFAULT_CHECKOUT` | Không (null = tắt) |
| `getSpecialEmployeeIds()` | `SPECIAL_EMPLOYEE_IDS` | Không (mảng rỗng = không có) |

---

### ExcelImporter.js

| Method | Mô tả |
|---|---|
| `findAllExcelFiles()` | Tìm tất cả file .xlsx/.xlsm trong Import Folder |
| `convertToGoogleSheet(file)` | Copy sang Google Sheet tạm `TMP_<tên>` để đọc |
| `readAttendanceData(file)` | Đọc dữ liệu, trả về `{values, spreadsheetId}` |
| `formatAndArchive(id, results, name)` | Ghi 8 cột sạch, format, chuyển vào Archive Chấm Công |
| `deleteFromImport(file)` | Xóa file gốc khỏi Import (đưa vào Trash) |

---

### AttendanceParser.js

Nhận mảng 2D từ Sheet, trả về mảng `AttendanceRecord`.

Cấu trúc cột file Excel đầu vào (đọc từ dòng 3 trở đi):

| Index | Tên |
|---|---|
| row[0] | STT |
| row[1] | Mã nhân viên |
| row[2] | Tên nhân viên |
| row[3] | Phòng ban |
| row[4] | Ngày |
| row[5] | Thứ |
| row[6] | Lần chấm 1 |
| row[7] | Lần chấm 2 |
| row[8] | Lần chấm 3 |
| row[9] | Lần chấm 4 |

---

### AttendanceCalculator.js

| Method | Mô tả |
|---|---|
| `calculate(record)` | Tính 1 record, trả về AttendanceResult |
| `calculateSpecialSchedule(record)` | Tính cho nhân viên ca đặc biệt (lấy sớm nhất/muộn nhất) |
| `findFirstPunch(punches, start, end)` | Lần chấm sáng sớm nhất trong khung giờ |
| `findSecondPunch(punches, start, end)` | Lần chấm chiều muộn nhất trong khung giờ |
| `formatTime(punch)` | Chuẩn hóa về "HH:mm" — xử lý Date, số thực Excel, string |
| `buildStatus(first, second, isDefault)` | Sinh trạng thái |

Kết quả trả về:

```javascript
{
  employeeId, employeeName, department,
  date, dayOfWeek,
  firstPunch,        // "HH:mm" hoặc null
  secondPunch,       // "HH:mm" hoặc null
  status,            // giá trị từ STATUS constants
  isSpecialSchedule  // boolean
}
```

---

### AttendanceWriter.js

Ghi toàn bộ kết quả xuống sheet `Attendance` bằng `setValues()` một lần (không `appendRow` từng dòng). Sheet được xóa và ghi lại hoàn toàn mỗi lần chạy.

Output: STT | Mã NV | Tên NV | Phòng ban | Ngày | Thứ | Chấm lần 1 | Chấm lần 2 | Trạng thái

---

### CongCalculator.js

Pivot dữ liệu từ dạng dọc (mỗi nhân viên × ngày = 1 dòng) sang dạng ngang (mỗi nhân viên = 1 dòng, các ngày trải ra theo cột).

Quy tắc tính giá trị công (Option A):

| Trạng thái | Giá trị công |
|---|---|
| Đủ công / Chấm tự động | 1 |
| Thiếu Check In hoặc Check Out | 0.5 |
| Không chấm công | 0 |
| Nhân viên ca đặc biệt | 0 (luôn) |

---

### CongWriter.js

Tạo Google Sheet mới, ghi bảng công dạng pivot, format cơ bản, sau đó chuyển vào Archive Công Folder.

Layout:
- Row 1–2: trống
- Row 3: tiêu đề (merged toàn bộ)
- Row 4: STT | Mã NV | Tên NV | 1 | 2 | ... | 31 | Ngày công
- Row 5: thứ tương ứng (T.2, T.3, ..., CN)
- Row 6+: dữ liệu

Nếu `ARCHIVE_CONG_FOLDER_ID` chưa cấu hình, file vẫn được tạo nhưng nằm ở root Drive.

---

### AttendanceService.js

Orchestrator điều phối toàn bộ luồng:

1. Tìm tất cả file trong Import Folder
2. Với từng file: convert → đọc → parse → tính → gom vào `allResults`
3. Ghi `allResults` xuống sheet Attendance
4. Tạo file Bảng Công (CongCalculator + CongWriter)
5. Archive từng file chấm công, xóa gốc khỏi Import

Lỗi ở bước 4 không dừng bước 5 (try/catch độc lập).

---

## 5. Luồng xử lý

```
Import Folder
  [file_thang5.xlsx]  [file_thang6.xlsx]
          |
   findAllExcelFiles()
          |
   với từng file:
     convertToGoogleSheet()
     readAttendanceData()
     AttendanceParser
     AttendanceCalculator   <- có Default Punch, Special Schedule
     gom vào allResults
          |
   AttendanceWriter.write(allResults)
   -> Sheet Attendance (9 cột)
          |
   CongCalculator.build(allResults)
   CongWriter.write()
   -> Archive Công/ (file Bảng Công)
          |
   với từng file:
     formatAndArchive()  -> Archive Chấm Công/ (8 cột, format đẹp)
     deleteFromImport()  -> Trash
          |
   Import Folder trống
```

---

## 6. Settings Sheet

Tất cả cấu hình nằm trong sheet `Settings` của file HRM Database, dạng 2 cột: Key | Value.

| Key | Ví dụ | Ghi chú |
|---|---|---|
| `IMPORT_FOLDER_ID` | `1JtZ09...` | Bắt buộc |
| `ARCHIVE_FOLDER_ID` | `1g799c...` | Bắt buộc — Archive Chấm Công |
| `ARCHIVE_CONG_FOLDER_ID` | `1goUVL...` | Bắt buộc — Archive Công |
| `CHECKIN_START` | `04:00` | Không bắt buộc |
| `CHECKIN_END` | `09:00` | Không bắt buộc |
| `CHECKOUT_START` | `15:00` | Không bắt buộc |
| `CHECKOUT_END` | `20:00` | Không bắt buộc |
| `DEFAULT_CHECKIN` | `07:30` | Không bắt buộc — để trống = tắt |
| `DEFAULT_CHECKOUT` | `17:00` | Không bắt buộc — để trống = tắt |
| `SPECIAL_EMPLOYEE_IDS` | `105` | Không bắt buộc — nhiều NV: `105,A999` |

Lấy Folder ID: mở thư mục Drive → copy phần sau `/folders/` trong URL.

---

## 7. Trạng thái chấm công

| Trạng thái | Điều kiện |
|---|---|
| Đủ công | Có đủ 2 lần chấm thực tế |
| Chấm tự động | Có 1 lần chấm thực + 1 lần điền mặc định từ Settings |
| Thiếu Check In | Chỉ có checkout, không có DEFAULT_CHECKIN |
| Thiếu Check Out | Chỉ có checkin, không có DEFAULT_CHECKOUT |
| Không chấm công | Không có lần nào |
| Miễn chấm công | Chưa triển khai |

Default Punch hoạt động như sau:

```
Có checkout, thiếu checkin  ->  firstPunch  = DEFAULT_CHECKIN   ->  "Chấm tự động"
Có checkin, thiếu checkout  ->  secondPunch = DEFAULT_CHECKOUT  ->  "Chấm tự động"
Không có cả 2               ->  không điền default              ->  "Không chấm công"
```

---

## 8. Nhân viên ca đặc biệt

Cấu hình key `SPECIAL_EMPLOYEE_IDS` trong Settings, phân cách dấu phẩy nếu nhiều người.

Ví dụ: `105` (mã NV Trần Thị Den — lao công, giờ làm 04:xx–14:xx, khác khung giờ chuẩn).

Khác biệt so với nhân viên thông thường:
- Không lọc punch theo khung giờ CHECKIN/CHECKOUT
- Lấy punch sớm nhất làm firstPunch, muộn nhất làm secondPunch
- Không áp dụng DEFAULT_CHECKIN / DEFAULT_CHECKOUT
- Trong file Bảng Công: giá trị công luôn = 0

---

## 9. Hướng dẫn chạy

**Cài đặt lần đầu:**

```bash
git clone https://github.com/ThuanNgcodelor/Attendance.git
cd Attendance
clasp login
clasp push
```

**Quy trình hàng ngày:**

1. Xuất file Excel từ máy chấm công
2. Upload vào thư mục Import trên Drive
3. Mở Apps Script, chạy hàm `runAttendance`
4. Kiểm tra sheet Attendance
5. Kiểm tra thư mục Archive Chấm Công và Archive Công

**Cập nhật code:**

```bash
clasp push
git add .
git commit -m "mô tả thay đổi"
git push
```

---

## 10. Changelog

### v1.1.0 — 2026-06-29

- Thêm module CongCalculator + CongWriter — sinh file Bảng Công tự động sau mỗi lần xử lý
- Hỗ trợ nhân viên ca đặc biệt (SPECIAL_EMPLOYEE_IDS) — không áp dụng khung giờ chuẩn
- Thêm config: ARCHIVE_CONG_FOLDER_ID, SPECIAL_EMPLOYEE_IDS

### v1.0.0 — 2026-06-27

- Import file Excel từ Drive (.xlsx, .xlsm, .xls, Google Sheet)
- Parse, tính toán Check In / Check Out theo khung giờ cấu hình
- Ghi kết quả xuống sheet Attendance (9 cột, có Trạng thái)
- Default Punch — tự điền giờ mặc định khi thiếu 1 lần chấm
- Batch Processing — xử lý nhiều file cùng lúc
- Archive với format sạch (tiêu đề merged, border, 8 cột)
- Config trung tâm từ Settings Sheet

---

## 11. Kế hoạch mở rộng

| Module | Trạng thái |
|---|---|
| Attendance Engine | Hoàn thành |
| Bảng Công | Hoàn thành |
| Leave Engine | Chưa làm |
| OT Engine | Chưa làm |
| Payroll Engine | Chưa làm |
| KPI Engine | Chưa làm |
| Dashboard | Chưa làm |
| Trigger tự động | Chưa làm |

Cách thêm module mới (ví dụ: Leave):

```
1. LeaveParser.js     - parse dữ liệu phép
2. LeaveCalculator.js - tính toán
3. LeaveWriter.js     - ghi kết quả
4. LeaveService.js    - orchestrator
5. Thêm key config vào Settings nếu cần
6. Thêm hàm runLeave() vào Main.js
```

---

*Cập nhật Changelog và phần liên quan mỗi khi có thay đổi.*
