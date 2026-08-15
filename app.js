const CONFIG = {
  // วาง URL ที่ได้จาก Deploy > New deployment > Web app ของ Google Apps Script ที่นี่
  apiUrl: "",
  refreshEveryMs: 60_000,
  staleAfterMs: 10 * 60_000,
};

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

elements.refreshButton.addEventListener("click", loadLatest);
loadLatest();
setInterval(loadLatest, CONFIG.refreshEveryMs);
