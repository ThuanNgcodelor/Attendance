/**
 * Helper.js
 * Các hàm tiện ích dùng chung cho Web App
 */

/**
 * Nhúng nội dung của một file HTML khác (CSS, JS) vào file hiện tại
 * Dùng trong template scriptlet: <?!= include('FileName') ?>
 * 
 * @param {string} filename - Tên file HTML cần nhúng (không kèm đuôi .html)
 * @returns {string} Nội dung text của file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lấy URL của Web App đang chạy
 * Hỗ trợ sau này khi cần tạo các link điều hướng
 * 
 * @returns {string} URL Web App
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}
