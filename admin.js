const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";
const SESSION_KEY = "aqua_admin_session";
const config = window.AQUA_CONFIG;
let memorySession = false;

const loginView = document.querySelector("#login-view");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const historyBody = document.querySelector("#history-body");
const notice = document.querySelector("#data-notice");
const summary = document.querySelector("#result-summary");

function showDashboard() {
  loginView.hidden = true;
  dashboard.hidden = false;
  loadHistory();
}

function showLogin() {
  dashboard.hidden = true;
  loginView.hidden = false;
}

function saveSession() {
  memorySession = true;
  try {
    sessionStorage.setItem(SESSION_KEY, "active");
  } catch (error) {
    console.info("Session storage is unavailable; using an in-memory session.");
  }
}

function clearSession() {
  memorySession = false;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.info("Session storage is unavailable.");
  }
}

function hasSession() {
  if (memorySession) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "active";
  } catch (error) {
    return false;
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    saveSession();
    loginError.textContent = "";
    showDashboard();
  } else {
    loginError.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  clearSession();
  loginForm.reset();
  showLogin();
});

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits }).format(number) : "—";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "—");
  return new Intl.DateTimeFormat("th-TH", { dateStyle:"medium", timeStyle:"medium", timeZone:"Asia/Bangkok" }).format(date);
}

function renderRows(rows) {
  historyBody.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7; cell.textContent = "ไม่พบข้อมูลในช่วงเวลาที่เลือก"; row.append(cell); historyBody.append(row); return;
  }
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const values = [formatDate(item.timestamp), `${formatNumber(item.pressure)} bar`, formatNumber(item.ph), `${formatNumber(item.tds,1)} ppm`, `${formatNumber(item.turbidity,1)} NTU`, `${formatNumber(item.wifiRssi,0)} dBm`];
    values.forEach((value) => { const td=document.createElement("td"); td.textContent=value; tr.append(td); });
    const statusCell=document.createElement("td"); const pill=document.createElement("span");
    pill.className=`status-pill ${String(item.deviceStatus).toLowerCase()==="online"?"":"offline"}`; pill.textContent=String(item.deviceStatus||"unknown"); statusCell.append(pill); tr.append(statusCell); historyBody.append(tr);
  });
}

async function loadHistory() {
  if (!config.apiUrl) { notice.className="notice error"; notice.textContent="ยังไม่ได้ตั้งค่า URL ของ Google Apps Script ใน config.js"; summary.textContent="ไม่สามารถโหลดข้อมูลได้"; return; }
  notice.className="notice"; notice.textContent="กำลังโหลดข้อมูล…";
  try {
    const url=new URL(config.apiUrl); url.searchParams.set("action","history"); url.searchParams.set("limit",document.querySelector("#limit").value);
    const from=document.querySelector("#from-date").value; const to=document.querySelector("#to-date").value;
    if(from) url.searchParams.set("from",from); if(to) url.searchParams.set("to",to);
    const response=await fetch(url,{cache:"no-store"}); if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload=await response.json(); if(!payload.success||!Array.isArray(payload.rows)) throw new Error(payload.error||"API ไม่รองรับข้อมูลย้อนหลัง");
    renderRows(payload.rows); notice.textContent=`โหลดสำเร็จ ${payload.rows.length} รายการ`; summary.textContent=`แสดง ${payload.rows.length} รายการล่าสุด`;
  } catch(error) { notice.className="notice error"; notice.textContent=`โหลดข้อมูลไม่สำเร็จ: ${error.message}`; summary.textContent="เกิดข้อผิดพลาดในการเชื่อมต่อ"; }
}

document.querySelector("#filter-form").addEventListener("submit",(event)=>{event.preventDefault();loadHistory();});
document.querySelector("#reload-button").addEventListener("click",loadHistory);
document.querySelector("#clear-filter").addEventListener("click",()=>{document.querySelector("#filter-form").reset();document.querySelector("#limit").value="100";loadHistory();});

if (hasSession()) showDashboard(); else showLogin();
