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
const chartCanvas = document.querySelector("#history-chart");
const chartEmpty = document.querySelector("#chart-empty");
const chartTitle = document.querySelector("#chart-title");
const chartDescription = document.querySelector("#chart-description");
let historyRows = [];
let activeChart = "ph";

const chartMetrics = {
  ph: { label:"pH", unit:"", color:"#0f766e", reference:[6.5,8.5], description:"แสดงการเปลี่ยนแปลงของค่า pH จากข้อมูลที่เลือก" },
  turbidity: { label:"ความขุ่น", unit:"NTU", color:"#c26a22", reference:[5], description:"แสดงความขุ่นของน้ำ หน่วย NTU" },
  tds: { label:"TDS", unit:"ppm", color:"#326ea8", reference:[500], description:"แสดงปริมาณสารละลายในน้ำ หน่วย ppm" },
  pressure: { label:"แรงดันน้ำ", unit:"bar", color:"#7655a6", reference:[], description:"แสดงแรงดันในระบบน้ำ หน่วย bar" },
};

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

function drawChart() {
  const metric = chartMetrics[activeChart];
  const points = historyRows
    .map((row) => ({ date:new Date(row.timestamp), value:Number(row[activeChart]) }))
    .filter((point) => !Number.isNaN(point.date.getTime()) && Number.isFinite(point.value))
    .sort((a,b) => a.date-b.date);

  chartTitle.textContent = `กราฟ ${metric.label}`;
  chartDescription.textContent = metric.description;
  chartEmpty.hidden = points.length > 0;
  const rect = chartCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  chartCanvas.width = Math.max(1, Math.round(rect.width * ratio));
  chartCanvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = chartCanvas.getContext("2d");
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,rect.width,rect.height);
  if (!points.length) return;

  const padding = { top:18, right:18, bottom:42, left:58 };
  const width = rect.width-padding.left-padding.right;
  const height = rect.height-padding.top-padding.bottom;
  const values = points.map((point) => point.value).concat(metric.reference);
  let min = Math.min(...values); let max = Math.max(...values);
  const span = Math.max(max-min, Math.abs(max)*0.15, 1);
  min = Math.max(0,min-span*0.12); max += span*0.12;
  const x = (index) => padding.left + (points.length===1 ? width/2 : index/(points.length-1)*width);
  const y = (value) => padding.top + (max-value)/(max-min)*height;

  context.font = '12px "IBM Plex Sans Thai", sans-serif';
  context.fillStyle = "#627572"; context.strokeStyle = "#e2e9e6"; context.lineWidth = 1;
  for (let index=0; index<=4; index+=1) {
    const value=max-(max-min)*(index/4); const position=padding.top+height*(index/4);
    context.beginPath(); context.moveTo(padding.left,position); context.lineTo(rect.width-padding.right,position); context.stroke();
    context.fillText(formatNumber(value,1),6,position+4);
  }

  metric.reference.forEach((value,index) => {
    context.save(); context.setLineDash([5,5]); context.strokeStyle="#d18522"; context.beginPath(); context.moveTo(padding.left,y(value)); context.lineTo(rect.width-padding.right,y(value)); context.stroke(); context.restore();
    if (index===0) { context.fillStyle="#9a651c"; context.fillText(`เกณฑ์ ${formatNumber(value,1)} ${metric.unit}`,padding.left+6,y(value)-7); }
  });

  context.strokeStyle=metric.color; context.lineWidth=2.5; context.lineJoin="round"; context.beginPath();
  points.forEach((point,index) => { if(index===0) context.moveTo(x(index),y(point.value)); else context.lineTo(x(index),y(point.value)); }); context.stroke();
  if (points.length<=100) { context.fillStyle=metric.color; points.forEach((point,index)=>{context.beginPath();context.arc(x(index),y(point.value),2.5,0,Math.PI*2);context.fill();}); }

  const labelIndexes=[0,Math.floor((points.length-1)/2),points.length-1].filter((value,index,array)=>array.indexOf(value)===index);
  context.fillStyle="#627572"; context.textAlign="center";
  labelIndexes.forEach((index)=>{const label=new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Bangkok"}).format(points[index].date);context.fillText(label,x(index),rect.height-13);});
  context.textAlign="start";
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
    historyRows = payload.rows;
    renderRows(historyRows); drawChart(); notice.textContent=`โหลดสำเร็จ ${payload.rows.length} รายการ`; summary.textContent=`แสดง ${payload.rows.length} รายการล่าสุด`;
  } catch(error) { notice.className="notice error"; notice.textContent=`โหลดข้อมูลไม่สำเร็จ: ${error.message}`; summary.textContent="เกิดข้อผิดพลาดในการเชื่อมต่อ"; }
}

document.querySelector("#filter-form").addEventListener("submit",(event)=>{event.preventDefault();loadHistory();});
document.querySelector("#reload-button").addEventListener("click",loadHistory);
document.querySelector("#clear-filter").addEventListener("click",()=>{document.querySelector("#filter-form").reset();document.querySelector("#limit").value="100";loadHistory();});
document.querySelectorAll(".chart-tab").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll(".chart-tab").forEach((item)=>item.classList.remove("active"));button.classList.add("active");activeChart=button.dataset.chart;drawChart();}));
let resizeFrame;
window.addEventListener("resize",()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawChart);});

if (hasSession()) showDashboard(); else showLogin();
