// เพิ่มโค้ดส่วนนี้ในโปรเจกต์ Google Apps Script เดิม
// จากนั้นแก้ doGet ให้เรียก getHistory_(e) เมื่อ action === 'history'

function getHistory_(e) {
  const sheet = getSensorSheet_();
  prepareSheet_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ success: true, rows: [], count: 0 });

  const requestedLimit = Number(e.parameter.limit || 100);
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 500);
  const from = e.parameter.from ? new Date(e.parameter.from + 'T00:00:00+07:00') : null;
  const to = e.parameter.to ? new Date(e.parameter.to + 'T23:59:59+07:00') : null;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  const rows = values
    .filter(function(row) {
      const timestamp = row[0] instanceof Date ? row[0] : new Date(row[0]);
      if (isNaN(timestamp.getTime())) return false;
      return (!from || timestamp >= from) && (!to || timestamp <= to);
    })
    .slice(-limit)
    .reverse()
    .map(rowToJson_);

  return json_({ success: true, rows: rows, count: rows.length });
}

// วางเงื่อนไขนี้ใน doGet หลังส่วน health และก่อนส่วน latest:
// if (action === 'history') return getHistory_(e);
