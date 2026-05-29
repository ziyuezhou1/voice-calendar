import {
  createEventFromCommand,
  dayRange,
  filterEvents,
  findMatchingEvents,
  formatDateKey,
  formatDateTime,
  monthRange,
  parseVoiceCommand,
  weekRange,
} from "./calendar-core.js";

const STORE_KEY = "voice-calendar-events-v1";
const SETTINGS_KEY = "voice-calendar-settings-v1";

const elements = {
  micButton: document.querySelector("[data-action='toggle-voice']"),
  runButton: document.querySelector("[data-action='run-command']"),
  notificationButton: document.querySelector("[data-action='enable-notifications']"),
  clearButton: document.querySelector("[data-action='clear-transcript']"),
  transcript: document.querySelector("#transcript"),
  voiceStatus: document.querySelector("#voice-status"),
  supportStatus: document.querySelector("#support-status"),
  assistantLog: document.querySelector("#assistant-log"),
  eventList: document.querySelector("#event-list"),
  todayList: document.querySelector("#today-list"),
  calendarGrid: document.querySelector("#calendar-grid"),
  rangeLabel: document.querySelector("#range-label"),
  stats: document.querySelector("#stats"),
  examples: document.querySelector("#examples"),
  toast: document.querySelector("#toast"),
  voiceMeter: document.querySelector("#voice-meter"),
};

const examples = [
  "添加明天下午三点团队周会，提前二十分钟提醒我",
  "下周五上午十点半安排产品评审",
  "半小时后提醒喝水",
  "查看今天日程",
  "查询本周安排",
  "取消明天下午三点团队周会",
];

let events = loadEvents();
let activeRange = dayRange(new Date(), "今天");
let recognition = null;
let listening = false;
let toastTimer = null;
let settings = loadSettings();

init();

function init() {
  setupSpeechRecognition();
  renderExamples();
  bindEvents();
  render();
  scheduleReminderChecks();
  logAssistant("可以直接说：添加明天下午三点团队周会，提前二十分钟提醒我。", "hint");
}

function bindEvents() {
  elements.micButton.addEventListener("click", toggleVoice);
  elements.runButton.addEventListener("click", () => handleCommand(elements.transcript.value));
  elements.clearButton.addEventListener("click", () => {
    elements.transcript.value = "";
    elements.transcript.focus();
  });
  elements.notificationButton.addEventListener("click", requestNotificationPermission);
  elements.transcript.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleCommand(elements.transcript.value);
    }
  });
  elements.eventList.addEventListener("click", handleEventListClick);
  elements.todayList.addEventListener("click", handleEventListClick);
  elements.calendarGrid.addEventListener("click", handleCalendarClick);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognition);
  elements.supportStatus.textContent = speechSupported ? "浏览器语音识别已就绪" : "当前浏览器不支持语音识别，可使用文字命令";
  elements.micButton.disabled = !speechSupported;

  if (!speechSupported) return;

  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    listening = true;
    document.body.dataset.listening = "true";
    elements.voiceStatus.textContent = "正在听，请说出日程命令";
    elements.micButton.setAttribute("aria-pressed", "true");
  });

  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    elements.transcript.value = transcript.trim();
    pulseVoiceMeter();

    const lastResult = event.results[event.results.length - 1];
    if (lastResult?.isFinal) handleCommand(elements.transcript.value);
  });

  recognition.addEventListener("error", (event) => {
    listening = false;
    document.body.dataset.listening = "false";
    elements.micButton.setAttribute("aria-pressed", "false");
    const message = event.error === "not-allowed" ? "麦克风权限未开启，可先使用文字命令。" : "这次没听清，可以再试一次。";
    elements.voiceStatus.textContent = message;
    logAssistant(message, "warning");
  });

  recognition.addEventListener("end", () => {
    listening = false;
    document.body.dataset.listening = "false";
    elements.micButton.setAttribute("aria-pressed", "false");
    elements.voiceStatus.textContent = "待命中";
  });
}

function toggleVoice() {
  if (!recognition) return;
  if (listening) {
    recognition.stop();
    return;
  }
  elements.transcript.value = "";
  recognition.start();
}

function handleCommand(rawText) {
  const text = rawText.trim();
  if (!text) {
    logAssistant("请先说出或输入一条日程命令。", "warning");
    return;
  }

  const command = parseVoiceCommand(text, { now: new Date() });
  if (command.intent === "add") {
    handleAdd(command);
    return;
  }
  if (command.intent === "delete") {
    handleDelete(command);
    return;
  }
  if (command.intent === "list") {
    handleList(command);
    return;
  }

  const fallback = "我还没理解这条命令。可以说：添加明天下午三点开会，或查看今天日程。";
  logAssistant(fallback, "warning");
  speak(fallback);
}

function handleAdd(command) {
  if (command.missing.includes("dateTime")) {
    const message = "我还缺少日期和时间。试试：添加明天下午三点团队周会。";
    logAssistant(message, "warning");
    speak(message);
    return;
  }

  const event = createEventFromCommand(command);
  events = [...events, event];
  saveEvents();
  activeRange = dayRange(new Date(event.startsAt), formatDateKey(event.startsAt));
  render();

  const reminderText = event.reminderMinutes === null ? "不提醒" : event.reminderMinutes === 0 ? "准时提醒" : `提前 ${event.reminderMinutes} 分钟提醒`;
  const assumed = command.assumedTime ? "。你没有说具体时间，我先按上午九点记录" : "";
  const message = `已添加：${event.title}，${formatDateTime(event.startsAt)}，${reminderText}${assumed}。`;
  logAssistant(message, "success");
  showToast(message);
  speak(message);
}

function handleDelete(command) {
  const matches = findMatchingEvents(events, command);
  if (!matches.length) {
    const message = "没有找到匹配的日程。可以带上日期、时间或事项名称再试一次。";
    logAssistant(message, "warning");
    speak(message);
    return;
  }

  const target = matches[0];
  events = events.filter((event) => event.id !== target.id);
  saveEvents();
  render();

  const extra = matches.length > 1 ? `另外还有 ${matches.length - 1} 条相似日程未删除。` : "";
  const message = `已删除：${target.title}，${formatDateTime(target.startsAt)}。${extra}`;
  logAssistant(message, "success");
  showToast(message);
  speak(message);
}

function handleList(command) {
  activeRange = command.range;
  const matched = filterEvents(events, activeRange);
  render();

  const message = matched.length
    ? `${activeRange.label}共有 ${matched.length} 条日程，第一条是 ${matched[0].title}，${formatDateTime(matched[0].startsAt)}。`
    : `${activeRange.label}暂无日程。`;
  logAssistant(message, "info");
  speak(message);
}

function handleEventListClick(event) {
  const button = event.target.closest("button[data-event-id]");
  if (!button) return;
  const target = events.find((item) => item.id === button.dataset.eventId);
  if (!target) return;

  events = events.filter((item) => item.id !== target.id);
  saveEvents();
  render();
  const message = `已删除：${target.title}。`;
  logAssistant(message, "success");
  speak(message);
}

function handleCalendarClick(event) {
  const dayButton = event.target.closest("button[data-date]");
  if (!dayButton) return;
  const selected = new Date(`${dayButton.dataset.date}T00:00:00`);
  activeRange = dayRange(selected, dayButton.dataset.date);
  render();
}

function render() {
  renderStats();
  renderCalendar();
  renderEvents();
  updateNotificationButton();
}

function renderStats() {
  const todayEvents = filterEvents(events, dayRange(new Date()));
  const weekEvents = filterEvents(events, weekRange(new Date()));
  const nextEvent = filterEvents(events, { type: "all" }).find((event) => new Date(event.startsAt) >= new Date());
  elements.stats.innerHTML = `
    <div><strong>${todayEvents.length}</strong><span>今天</span></div>
    <div><strong>${weekEvents.length}</strong><span>本周</span></div>
    <div><strong>${events.length}</strong><span>全部</span></div>
    <div><strong>${nextEvent ? formatTime(nextEvent.startsAt) : "--"}</strong><span>下一条</span></div>
  `;
}

function renderEvents() {
  const visible = filterEvents(events, activeRange);
  elements.rangeLabel.textContent = `${activeRange.label}日程`;
  elements.eventList.innerHTML = visible.length ? visible.map(renderEventItem).join("") : renderEmptyState("这个时间段还没有日程");

  const today = filterEvents(events, dayRange(new Date()));
  elements.todayList.innerHTML = today.length ? today.map(renderCompactEventItem).join("") : renderEmptyState("今天没有待办日程");
}

function renderEventItem(event) {
  const date = new Date(event.startsAt);
  const reminder = event.reminderMinutes === null ? "不提醒" : event.reminderMinutes === 0 ? "准时提醒" : `提前 ${event.reminderMinutes} 分钟`;
  return `
    <article class="event-item" data-testid="event-item">
      <time datetime="${event.startsAt}">
        <span>${formatMonthDay(date)}</span>
        <strong>${formatTime(date)}</strong>
      </time>
      <div class="event-body">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${reminder} · 来源：${escapeHtml(event.sourceText || "手动命令")}</p>
      </div>
      <button class="icon-button danger" type="button" data-event-id="${event.id}" aria-label="删除 ${escapeHtml(event.title)}" title="删除">
        ${iconTrash()}
      </button>
    </article>
  `;
}

function renderCompactEventItem(event) {
  return `
    <article class="compact-event">
      <time>${formatTime(event.startsAt)}</time>
      <span>${escapeHtml(event.title)}</span>
      <button class="icon-button danger small" type="button" data-event-id="${event.id}" aria-label="删除 ${escapeHtml(event.title)}" title="删除">
        ${iconTrash()}
      </button>
    </article>
  `;
}

function renderEmptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function renderCalendar() {
  const today = new Date();
  const rangeDate = activeRange?.start || today;
  const month = monthRange(rangeDate);
  const firstVisible = weekRange(month.start).start;
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index));
  const eventCounts = events.reduce((acc, event) => {
    const key = formatDateKey(event.startsAt);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  elements.calendarGrid.innerHTML = `
    ${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span class="weekday">${day}</span>`).join("")}
    ${days.map((day) => {
      const key = formatDateKey(day);
      const outside = day.getMonth() !== new Date(rangeDate).getMonth();
      const isToday = key === formatDateKey(today);
      const isActive = activeRange?.type === "day" && key === formatDateKey(activeRange.start);
      const count = eventCounts[key] || 0;
      return `
        <button class="calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""} ${isActive ? "active" : ""}" type="button" data-date="${key}" aria-label="${key}，${count} 条日程">
          <span>${day.getDate()}</span>
          ${count ? `<em>${count}</em>` : ""}
        </button>
      `;
    }).join("")}
  `;
}

function renderExamples() {
  elements.examples.innerHTML = examples
    .map((example) => `<button type="button" class="example-chip" data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`)
    .join("");
  elements.examples.addEventListener("click", (event) => {
    const chip = event.target.closest("button[data-example]");
    if (!chip) return;
    elements.transcript.value = chip.dataset.example;
    elements.transcript.focus();
  });
}

function logAssistant(message, tone = "info") {
  const item = document.createElement("li");
  item.className = `log-entry ${tone}`;
  item.innerHTML = `<span>${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span><p>${escapeHtml(message)}</p>`;
  elements.assistantLog.prepend(item);
  while (elements.assistantLog.children.length > 8) {
    elements.assistantLog.lastElementChild.remove();
  }
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    logAssistant("当前浏览器不支持系统通知，我会保留页面内提醒和语音播报。", "warning");
    return;
  }

  Notification.requestPermission().then((permission) => {
    settings.notifications = permission === "granted";
    saveSettings();
    updateNotificationButton();
    const message = permission === "granted" ? "系统通知已开启。" : "系统通知未开启，页面提醒仍会工作。";
    logAssistant(message, permission === "granted" ? "success" : "warning");
  });
}

function updateNotificationButton() {
  const supported = "Notification" in window;
  const granted = supported && Notification.permission === "granted";
  elements.notificationButton.disabled = !supported;
  elements.notificationButton.classList.toggle("active", granted);
  elements.notificationButton.title = granted ? "系统通知已开启" : "开启系统通知";
}

function scheduleReminderChecks() {
  checkReminders();
  window.setInterval(checkReminders, 15000);
}

function checkReminders() {
  const now = new Date();
  let changed = false;

  events = events.map((event) => {
    if (event.notifiedAt || event.reminderMinutes === null) return event;
    const startsAt = new Date(event.startsAt);
    const remindAt = new Date(startsAt.getTime() - event.reminderMinutes * 60000);
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60000);
    if (remindAt <= now && startsAt >= staleCutoff) {
      const message = `提醒：${event.title}，${formatDateTime(event.startsAt)}。`;
      showToast(message);
      speak(message);
      sendNotification(event, message);
      changed = true;
      return { ...event, notifiedAt: now.toISOString() };
    }
    return event;
  });

  if (changed) {
    saveEvents();
    render();
  }
}

function sendNotification(event, message) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("声历提醒", {
    body: message,
    tag: event.id,
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3600);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function pulseVoiceMeter() {
  elements.voiceMeter.animate(
    [
      { transform: "scaleY(0.72)", opacity: 0.7 },
      { transform: "scaleY(1)", opacity: 1 },
      { transform: "scaleY(0.78)", opacity: 0.75 },
    ],
    { duration: 420, easing: "ease-out" },
  );
}

function loadEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORE_KEY, JSON.stringify(events));
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function formatTime(dateLike) {
  return new Date(dateLike).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatMonthDay(dateLike) {
  const date = new Date(dateLike);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function iconTrash() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 8h10l-.7 12H7.7L7 8Z"></path>
    </svg>
  `;
}
