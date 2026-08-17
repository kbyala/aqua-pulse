const CONFIG = window.AQUA_CONFIG;

const metricRules = {
  ph: { min: 0, max: 14, good: (v) => v >= 6.5 && v <= 8.5 },
  turbidity: { min: 0, max: 10, good: (v) => v <= 5 },
  tds: { min: 0, max: 1_000, good: (v) => v <= 500 },
  pressure: { min: 0, max: 8, good: () => true, neutral: true },
};

const elements = {
  overallStatus: document.querySelector("#overall-status"),
  overallMessage: document.querySelector("#overall-message"),
  statusOrb: document.querySelector("#status-orb"),
  updatedAt: document.querySelector("#updated-at"),
  refreshButton: document.querySelector("#refresh-button"),
  deviceStatus: document.querySelector("#device-status"),
  wifiValue: document.querySelector("#wifi-value"),
};

const publicChart = document.querySelector("#public-history-chart");
const publicChartEmpty = document.querySelector("#public-chart-empty");
const publicChartTitle = document.querySelector("#public-chart-title");
const publicChartNote = document.querySelector("#public-chart-note");
let comparisonSeries = { primary:[], compare:[] };
let activeTrend = "ph";
let publicResizeFrame;

const publicMetrics = {
  ph: { label:"pH", unit:"", color:"#0f766e", reference:[6.5,8.5] },
  turbidity: { label:"ความขุ่น", unit:"NTU", color:"#0f766e", reference:[5] },
  tds: { label:"TDS", unit:"ppm", color:"#0f766e", reference:[500] },
  pressure: { label:"แรงดันน้ำ", unit:"bar", color:"#0f766e", reference:[] },
};

function isFiniteReading(value) {
  return Number.isFinite(Number(value));
}

function formatNumber(value, digits = 2) {
  if (!isFiniteReading(value)) return "—";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits }).format(Number(value));
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value) {
  const date = parseTimestamp(value);
  if (!date) return "ไม่ทราบเวลาอัปเดต";
  return `อัปเดต ${new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date)} น.`;
}

function bangkokDateValue(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Asia/Bangkok" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part)=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shortThaiDate(value) {
  const date = new Date(`${value}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", { day:"numeric", month:"short", year:"2-digit", timeZone:"Asia/Bangkok" }).format(date);
}

function minuteInBangkok(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", hourCycle:"h23", timeZone:"Asia/Bangkok" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part)=>[part.type,part.value]));
  return Number(values.hour)*60+Number(values.minute);
}

async function fetchDay(dateValue) {
  const url = new URL(CONFIG.apiUrl);
  url.searchParams.set("action","history"); url.searchParams.set("from",dateValue); url.searchParams.set("to",dateValue); url.searchParams.set("limit","500");
  const response = await fetch(url,{cache:"no-store"});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if(!payload.success||!Array.isArray(payload.rows)) throw new Error(payload.error||"ไม่พบข้อมูลย้อนหลัง");
  return payload.rows;
}

function drawPublicChart() {
  const metric=publicMetrics[activeTrend];
  const makePoints=(rows)=>rows.map((row)=>({minute:minuteInBangkok(row.timestamp),value:Number(row[activeTrend])})).filter((point)=>Number.isFinite(point.minute)&&Number.isFinite(point.value)).sort((a,b)=>a.minute-b.minute);
  const primary=makePoints(comparisonSeries.primary); const compare=makePoints(comparisonSeries.compare); const all=[...primary,...compare];
  publicChartTitle.textContent=`กราฟ ${metric.label}`; publicChartEmpty.hidden=all.length>0;
  const rect=publicChart.getBoundingClientRect(); const ratio=Math.min(window.devicePixelRatio||1,2);
  publicChart.width=Math.max(1,Math.round(rect.width*ratio)); publicChart.height=Math.max(1,Math.round(rect.height*ratio));
  const context=publicChart.getContext("2d"); context.setTransform(ratio,0,0,ratio,0,0); context.clearRect(0,0,rect.width,rect.height); if(!all.length)return;
  const padding={top:18,right:18,bottom:42,left:58}; const width=rect.width-padding.left-padding.right; const height=rect.height-padding.top-padding.bottom;
  const values=all.map((point)=>point.value).concat(metric.reference); let min=Math.min(...values); let max=Math.max(...values); const span=Math.max(max-min,Math.abs(max)*.15,1); min=Math.max(0,min-span*.12); max+=span*.12;
  const x=(minute)=>padding.left+(minute/1439)*width; const y=(value)=>padding.top+(max-value)/(max-min)*height;
  context.font='12px "IBM Plex Sans Thai",sans-serif'; context.strokeStyle="#e2e9e6"; context.fillStyle="#627572"; context.lineWidth=1;
  for(let index=0;index<=4;index+=1){const value=max-(max-min)*(index/4);const position=padding.top+height*(index/4);context.beginPath();context.moveTo(padding.left,position);context.lineTo(rect.width-padding.right,position);context.stroke();context.fillText(formatNumber(value,1),5,position+4);}
  metric.reference.forEach((value)=>{context.save();context.setLineDash([5,5]);context.strokeStyle="#bda96b";context.beginPath();context.moveTo(padding.left,y(value));context.lineTo(rect.width-padding.right,y(value));context.stroke();context.restore();});
  const drawLine=(points,color)=>{if(!points.length)return;context.strokeStyle=color;context.lineWidth=2.5;context.lineJoin="round";context.beginPath();points.forEach((point,index)=>{if(index===0)context.moveTo(x(point.minute),y(point.value));else context.lineTo(x(point.minute),y(point.value));});context.stroke();};
  drawLine(primary,"#0f766e"); drawLine(compare,"#d18522");
  context.fillStyle="#627572";context.textAlign="center";[0,360,720,1080,1439].forEach((minute)=>context.fillText(minute===1439?"24:00":`${String(Math.floor(minute/60)).padStart(2,"0")}:00`,x(minute),rect.height-13));context.textAlign="start";
}

async function loadComparison() {
  if(!CONFIG.apiUrl)return;
  const primaryDate=document.querySelector("#primary-date").value; const compareDate=document.querySelector("#compare-date").value;
  if(!primaryDate||!compareDate)return;
  publicChartNote.textContent="กำลังโหลดข้อมูลย้อนหลัง…";
  try { const [primary,compare]=await Promise.all([fetchDay(primaryDate),fetchDay(compareDate)]); comparisonSeries={primary,compare}; document.querySelector("#primary-legend").textContent=shortThaiDate(primaryDate); document.querySelector("#compare-legend").textContent=shortThaiDate(compareDate); publicChartNote.textContent=`${primary.length} รายการ เทียบกับ ${compare.length} รายการ`; drawPublicChart(); }
  catch(error){comparisonSeries={primary:[],compare:[]};publicChartNote.textContent=`โหลดกราฟไม่สำเร็จ: ${error.message}`;drawPublicChart();}
}

function setMetric(name, value) {
  const rule = metricRules[name];
  const card = document.querySelector(`[data-metric="${name}"]`);
  const state = card.querySelector(".metric-state");
  const marker = document.querySelector(`#${name}-marker`);
  document.querySelector(`#${name}-value`).textContent = formatNumber(value, name === "tds" ? 1 : 2);
  card.classList.remove("good", "warning", "danger");

  if (!isFiniteReading(value)) {
    state.textContent = "ไม่มีข้อมูล";
    marker.style.left = "0%";
    return "unknown";
  }

  const number = Number(value);
  const percent = Math.max(1, Math.min(99, ((number - rule.min) / (rule.max - rule.min)) * 100));
  marker.style.left = `${percent}%`;

  if (rule.neutral) {
    state.textContent = number === 0 ? "ไม่มีแรงดัน" : "ข้อมูลระบบ";
    card.classList.add(number === 0 ? "warning" : "good");
    return number === 0 ? "warning" : "neutral";
  }

  const validSensorRange =
    (name !== "ph" || (number >= 0 && number <= 14)) &&
    (name !== "turbidity" || number <= 5_000) &&
    (name !== "tds" || number <= 5_000);

  if (!validSensorRange) {
    state.textContent = "ค่าผิดปกติ";
    card.classList.add("danger");
    return "danger";
  }

  const good = rule.good(number);
  state.textContent = good ? "อยู่ในช่วงอ้างอิง" : "ควรเฝ้าระวัง";
  card.classList.add(good ? "good" : "warning");
  return good ? "good" : "warning";
}

function renderReading(reading) {
  const states = [
    setMetric("ph", reading.ph),
    setMetric("turbidity", reading.turbidity),
    setMetric("tds", reading.tds),
    setMetric("pressure", reading.pressure),
  ];

  const timestamp = parseTimestamp(reading.timestamp);
  const stale = !timestamp || Date.now() - timestamp.getTime() > CONFIG.staleAfterMs;
  const disconnected = String(reading.deviceStatus).toLowerCase() !== "online";

  elements.statusOrb.className = "status-orb";
  if (stale || disconnected) {
    elements.overallStatus.textContent = "ข้อมูลอาจไม่เป็นปัจจุบัน";
    elements.overallMessage.textContent = "สถานีไม่ได้ส่งข้อมูลใหม่ตามเวลาที่คาดไว้ กรุณาตรวจสอบอีกครั้งภายหลัง";
    elements.statusOrb.classList.add("danger");
  } else if (states.includes("danger") || states.includes("warning")) {
    elements.overallStatus.textContent = "มีค่าที่ควรเฝ้าระวัง";
    elements.overallMessage.textContent = "ค่าที่วัดได้บางรายการอยู่นอกช่วงอ้างอิง ผู้ดูแลควรตรวจสอบสถานการณ์";
    elements.statusOrb.classList.add("warning");
  } else {
    elements.overallStatus.textContent = "ค่าที่วัดได้อยู่ในช่วงอ้างอิง";
    elements.overallMessage.textContent = "ยังไม่พบค่าที่อยู่นอกช่วงอ้างอิงจากการตรวจวัดล่าสุด";
    elements.statusOrb.classList.add("good");
  }

  elements.updatedAt.textContent = formatTimestamp(reading.timestamp);
  elements.deviceStatus.textContent = disconnected ? "ออฟไลน์" : "ออนไลน์";
  elements.wifiValue.textContent = formatNumber(reading.wifiRssi, 0);
}

function renderUnavailable(message = "ไม่สามารถเชื่อมต่อข้อมูลจากสถานีได้ในขณะนี้") {
  elements.overallStatus.textContent = "ยังไม่มีข้อมูลล่าสุด";
  elements.overallMessage.textContent = message;
  elements.statusOrb.className = "status-orb danger";
  elements.updatedAt.textContent = "โปรดลองอัปเดตอีกครั้ง";
}

async function loadLatest() {
  if (!CONFIG.apiUrl) {
    renderUnavailable("ยังไม่ได้ตั้งค่า URL ของ Google Apps Script สำหรับเว็บไซต์นี้");
    return;
  }

  elements.refreshButton.disabled = true;
  try {
    const url = new URL(CONFIG.apiUrl);
    url.searchParams.set("action", "latest");
    url.searchParams.set("_", Date.now().toString());
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.success || !payload.latest) throw new Error(payload.error || "No latest reading");
    renderReading(payload.latest);
  } catch (error) {
    console.error("Aqua Pulse API error:", error);
    renderUnavailable();
  } finally {
    elements.refreshButton.disabled = false;
  }
}

const todayBangkok=bangkokDateValue(new Date()); const yesterdayBangkok=bangkokDateValue(new Date(Date.now()-86400000));
document.querySelector("#primary-date").value=todayBangkok; document.querySelector("#compare-date").value=yesterdayBangkok;
document.querySelector("#compare-form").addEventListener("submit",(event)=>{event.preventDefault();loadComparison();});
document.querySelectorAll(".trend-tab").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll(".trend-tab").forEach((item)=>item.classList.remove("active"));button.classList.add("active");activeTrend=button.dataset.trend;drawPublicChart();}));
window.addEventListener("resize",()=>{cancelAnimationFrame(publicResizeFrame);publicResizeFrame=requestAnimationFrame(drawPublicChart);});
elements.refreshButton.addEventListener("click",()=>{loadLatest();loadComparison();});
loadLatest();
loadComparison();
setInterval(loadLatest, CONFIG.refreshEveryMs);
