# Aqua Pulse

หน้าเว็บสาธารณะสำหรับรายงานข้อมูลเฝ้าระวังคุณภาพน้ำจากสถานีชุมชน

## เชื่อมต่อ Google Apps Script

1. Deploy Google Apps Script ของโครงการเป็น Web app โดยอนุญาตให้ผู้เข้าชมเว็บไซต์เรียกอ่านได้
2. คัดลอก URL ที่ลงท้ายด้วย `/exec`
3. เปิด `app.js` แล้ววาง URL ใน `CONFIG.apiUrl`
4. เปิด `index.html` หรือเผยแพร่ repository ผ่าน GitHub Pages

เว็บไซต์เรียก `?action=latest` ทุก 60 วินาทีและไม่ใช้ API key สำหรับการอ่าน ค่า API key ใน Apps Script ใช้เฉพาะอุปกรณ์ที่ส่งข้อมูลด้วย POST เท่านั้น

> ไฟล์ต้นฉบับ `gs.rtf` ถูกกันออกจาก Git เนื่องจากมี API key สำหรับอุปกรณ์ ควรย้าย key ไปเก็บใน Script Properties และเปลี่ยน key เดิมก่อนนำสคริปต์ขึ้น repository
