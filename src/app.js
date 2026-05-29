import {
  createEventFromCommand,
  dayRange,
  filterEvents,
  findMatchingEvents,
  formatDateKey,
  formatDateTime,
  monthRange,
  normalizeCommand,
  parseVoiceCommand,
  weekRange,
} from "./calendar-core.js?v=voice-capture-1";
import { getHoliday, getMonthHolidays, hasHolidayData, HOLIDAY_SOURCE } from "./holiday-data.js";

const STORE_KEY = "voice-calendar-events-v1";
const SETTINGS_KEY = "voice-calendar-settings-v1";

const THEMES = {
  light: "浅色",
  dark: "深色",
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

const THEME_ALIASES = [
  [/浅色|亮色|白天|日间|默认/, "light"],
  [/深色|暗色|黑色|夜间|夜晚/, "dark"],
  [/春天|春季|春/, "spring"],
  [/夏天|夏季|夏/, "summer"],
  [/秋天|秋季|秋/, "autumn"],
  [/冬天|冬季|冬/, "winter"],
];

const elements = {
  micButton: document.querySelector("[data-action='toggle-voice']"),
  runButton: document.querySelector("[data-action='run-command']"),
  notificationButton: document.querySelector("[data-action='enable-notifications']"),
  themeButton: document.querySelector("[data-action='toggle-theme-menu']"),
  themeMenu: document.querySelector("#theme-menu"),
  themeButtons: document.querySelectorAll("[data-theme-option]"),
  clearButton: document.querySelector("[data-action='clear-transcript']"),
  transcript: document.querySelector("#transcript"),
  voiceStatus: document.querySelector("#voice-status"),
  supportStatus: document.querySelector("#support-status"),
  assistantLog: document.querySelector("#assistant-log"),
  eventList: document.querySelector("#event-list"),
  todayList: document.querySelector("#today-list"),
  calendarGrid: document.querySelector("#calendar-grid"),
  calendarTitle: document.querySelector("#calendar-title"),
  calendarYear: document.querySelector("#calendar-year"),
  calendarMonth: document.querySelector("#calendar-month"),
  monthHolidays: document.querySelector("#month-holidays"),
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
  "切换到春天主题",
];

let events = loadEvents();
let activeRange = dayRange(new Date(), "今天");
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let recognition = null;
let listening = false;
let lastVoiceError = "";
let toastTimer = null;
let settings = loadSettings();

init();

function init() {
  setupSpeechRecognition();
  renderCalendarControls();
  renderExamples();
  bindEvents();
  applyTheme(settings.theme || "light", { persist: false });
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
  elements.themeButton.addEventListener("click", toggleThemeMenu);
  elements.themeMenu.addEventListener("click", handleThemeMenuClick);
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".theme-switcher")) closeThemeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeThemeMenu();
  });
  elements.transcript.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleCommand(elements.transcript.value);
    }
  });
  elements.eventList.addEventListener("click", handleEventListClick);
  elements.todayList.addEventListener("click", handleEventListClick);
  elements.calendarGrid.addEventListener("click", handleCalendarClick);
  elements.calendarYear.addEventListener("change", handleCalendarSelect);
  elements.calendarMonth.addEventListener("change", handleCalendarSelect);
  document.querySelector("[data-action='previous-month']").addEventListener("click", () => moveCalendarMonth(-1));
  document.querySelector("[data-action='next-month']").addEventListener("click", () => moveCalendarMonth(1));
  document.querySelector("[data-action='go-today']").addEventListener("click", goToday);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognition);
  const microphoneSupported = Boolean(navigator.mediaDevices?.getUserMedia);
  elements.supportStatus.textContent = speechSupported
    ? microphoneSupported
      ? "浏览器语音识别已就绪"
      : "浏览器可识别语音，但无法预检麦克风"
    : "当前浏览器不支持语音识别，可使用文字命令";
  elements.micButton.disabled = !speechSupported;

  if (!speechSupported) return;

  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    listening = true;
    lastVoiceError = "";
    document.body.dataset.listening = "true";
    elements.voiceStatus.textContent = "正在听，请说出日程命令";
    elements.micButton.setAttribute("aria-pressed", "true");
    updateMicButtonLabel();
  });

  recognition.addEventListener("audiostart", () => {
    elements.voiceStatus.textContent = "麦克风已接通，正在收音";
    pulseVoiceMeter();
  });

  recognition.addEventListener("soundstart", () => {
    elements.voiceStatus.textContent = "检测到声音，正在识别";
    pulseVoiceMeter();
  });

  recognition.addEventListener("speechstart", () => {
    elements.voiceStatus.textContent = "检测到语音，请继续说";
    pulseVoiceMeter();
  });

  recognition.addEventListener("speechend", () => {
    elements.voiceStatus.textContent = "已收到语音，正在转成文字";
  });

  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    elements.transcript.value = transcript.trim();
    pulseVoiceMeter();

    const lastResult = event.results[event.results.length - 1];
    elements.voiceStatus.textContent = lastResult?.isFinal ? "识别完成，正在执行" : "正在识别语音";
    if (lastResult?.isFinal) handleCommand(elements.transcript.value);
  });

  recognition.addEventListener("error", (event) => {
    listening = false;
    document.body.dataset.listening = "false";
    elements.micButton.setAttribute("aria-pressed", "false");
    updateMicButtonLabel();
    const message = getRecognitionErrorMessage(event.error);
    lastVoiceError = message;
    elements.voiceStatus.textContent = message;
    logAssistant(message, "warning");
  });

  recognition.addEventListener("end", () => {
    listening = false;
    document.body.dataset.listening = "false";
    elements.micButton.setAttribute("aria-pressed", "false");
    updateMicButtonLabel();
    if (!lastVoiceError) {
      elements.voiceStatus.textContent = elements.transcript.value.trim() ? "待命中" : "语音识别已结束，可再次点击开始语音";
    }
  });
}

async function toggleVoice() {
  if (!recognition) return;
  if (listening) {
    recognition.stop();
    return;
  }

  try {
    elements.micButton.disabled = true;
    elements.voiceStatus.textContent = "正在请求麦克风权限";
    await ensureMicrophoneReady();
    elements.transcript.value = "";
    lastVoiceError = "";
    recognition.start();
  } catch (error) {
    const message = getMicrophoneErrorMessage(error);
    lastVoiceError = message;
    listening = false;
    document.body.dataset.listening = "false";
    elements.micButton.setAttribute("aria-pressed", "false");
    updateMicButtonLabel();
    elements.voiceStatus.textContent = message;
    logAssistant(message, "warning");
  } finally {
    elements.micButton.disabled = false;
  }
}

async function ensureMicrophoneReady() {
  if (!window.isSecureContext) {
    throw new Error("insecure-context");
  }
  if (!navigator.mediaDevices?.getUserMedia) return;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  stream.getTracks().forEach((track) => track.stop());
}

function getMicrophoneErrorMessage(error) {
  const name = error?.name || error?.message || "";
  if (name === "insecure-context") return "语音录入需要 HTTPS 或 localhost 环境。当前页面无法安全访问麦克风，可先使用文字命令。";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "麦克风权限未开启。请在浏览器地址栏允许麦克风后再点开始语音。";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "没有检测到可用麦克风。请连接或启用麦克风后再试。";
  if (name === "NotReadableError" || name === "TrackStartError") return "麦克风正被其他应用占用，关闭占用麦克风的应用后再试。";
  return `麦克风启动失败：${name || "未知错误"}。可先使用文字命令。`;
}

function getRecognitionErrorMessage(errorCode) {
  const messages = {
    "not-allowed": "麦克风权限未开启。请在浏览器地址栏允许麦克风后再点开始语音。",
    "service-not-allowed": "浏览器语音识别服务被禁用，可先使用文字命令。",
    "audio-capture": "没有采集到麦克风音频。请检查系统麦克风、浏览器权限和输入设备。",
    network: "浏览器语音识别服务连接失败。Chrome 的语音识别可能需要联网，可先使用文字命令。",
    "no-speech": "没有检测到清晰语音。请靠近麦克风，看到“正在收音”后再说一次。",
    aborted: "语音识别已停止。",
    "language-not-supported": "当前浏览器不支持中文语音识别，可先使用文字命令。",
  };
  return messages[errorCode] || `语音识别失败：${errorCode || "未知错误"}。可先使用文字命令。`;
}

function updateMicButtonLabel() {
  const label = elements.micButton.querySelector("span");
  if (label) label.textContent = listening ? "停止语音" : "开始语音";
}

function handleCommand(rawText) {
  const text = rawText.trim();
  if (!text) {
    logAssistant("请先说出或输入一条日程命令。", "warning");
    return;
  }

  const theme = parseThemeCommand(text);
  if (theme) {
    applyTheme(theme, { announce: true });
    closeThemeMenu();
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

function parseThemeCommand(text) {
  const normalized = normalizeCommand(text).replace(/\s+/g, "");
  if (!/(主题|模式|皮肤|换肤|切换|换成|调成|改成)/.test(normalized)) return null;
  const match = THEME_ALIASES.find(([pattern]) => pattern.test(normalized));
  return match?.[1] || null;
}

function toggleThemeMenu(event) {
  event.stopPropagation();
  const expanded = elements.themeButton.getAttribute("aria-expanded") === "true";
  if (expanded) {
    closeThemeMenu();
    return;
  }
  elements.themeMenu.hidden = false;
  elements.themeButton.setAttribute("aria-expanded", "true");
}

function closeThemeMenu() {
  elements.themeMenu.hidden = true;
  elements.themeButton.setAttribute("aria-expanded", "false");
}

function handleThemeMenuClick(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-theme-option]");
  if (!button) return;
  applyTheme(button.dataset.themeOption, { announce: true });
  closeThemeMenu();
}

function applyTheme(themeId, options = {}) {
  const theme = Object.prototype.hasOwnProperty.call(THEMES, themeId) ? themeId : "light";
  document.body.dataset.theme = theme;
  settings.theme = theme;
  if (options.persist !== false) saveSettings();

  elements.themeButtons.forEach((button) => {
    const active = button.dataset.themeOption === theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.themeButton.title = `当前主题：${THEMES[theme]}`;
  elements.themeButton.setAttribute("aria-label", `更换主题，当前为${THEMES[theme]}`);

  if (options.announce) {
    const message = `已切换到${THEMES[theme]}主题。`;
    logAssistant(message, "success");
    showToast(message);
    speak(message);
  }
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
  calendarCursor = new Date(new Date(event.startsAt).getFullYear(), new Date(event.startsAt).getMonth(), 1);
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
  if (activeRange.start) calendarCursor = new Date(activeRange.start.getFullYear(), activeRange.start.getMonth(), 1);
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
  calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
  render();
}

function handleCalendarSelect() {
  const year = Number(elements.calendarYear.value);
  const month = Number(elements.calendarMonth.value);
  calendarCursor = new Date(year, month, 1);
  activeRange = monthRange(calendarCursor, `${year}年${month + 1}月`);
  render();
}

function moveCalendarMonth(delta) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
  activeRange = monthRange(calendarCursor, `${calendarCursor.getFullYear()}年${calendarCursor.getMonth() + 1}月`);
  render();
}

function goToday() {
  const today = new Date();
  calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  activeRange = dayRange(today, "今天");
  render();
}

function render() {
  renderStats();
  renderCalendar();
  renderEvents();
  updateNotificationButton();
}

function renderCalendarControls() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  elements.calendarYear.innerHTML = years.map((year) => `<option value="${year}">${year}年</option>`).join("");
  elements.calendarMonth.innerHTML = Array.from({ length: 12 }, (_, index) => `<option value="${index}">${index + 1}月</option>`).join("");
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
  const rangeDate = calendarCursor || activeRange?.start || today;
  const month = monthRange(rangeDate);
  const firstVisible = weekRange(month.start).start;
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index));
  const eventCounts = events.reduce((acc, event) => {
    const key = formatDateKey(event.startsAt);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const displayYear = rangeDate.getFullYear();
  const displayMonth = rangeDate.getMonth();
  const monthHolidays = getMonthHolidays(displayYear, displayMonth);

  elements.calendarTitle.textContent = `${displayYear}年${displayMonth + 1}月`;
  elements.calendarYear.value = String(displayYear);
  elements.calendarMonth.value = String(displayMonth);

  elements.calendarGrid.innerHTML = `
    ${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span class="weekday">${day}</span>`).join("")}
    ${days.map((day) => {
      const key = formatDateKey(day);
      const holiday = getHoliday(key);
      const outside = day.getMonth() !== displayMonth;
      const isToday = key === formatDateKey(today);
      const isActive = activeRange?.type === "day" && key === formatDateKey(activeRange.start);
      const count = eventCounts[key] || 0;
      const holidayClass = holiday ? ` ${holiday.type}` : "";
      const holidayPrefix = holiday?.type === "holiday" ? "休" : "班";
      return `
        <button class="calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""} ${isActive ? "active" : ""}${holidayClass}" type="button" data-date="${key}" aria-label="${key}，${count} 条日程${holiday ? `，${holiday.name}` : ""}">
          <span class="day-number">${day.getDate()}</span>
          ${holiday ? `<strong class="holiday-badge">${holidayPrefix}</strong><small>${escapeHtml(holiday.name)}</small>` : ""}
          ${count ? `<em>${count}</em>` : ""}
        </button>
      `;
    }).join("")}
  `;

  if (!hasHolidayData(displayYear)) {
    elements.monthHolidays.innerHTML = `<p>暂未录入 ${displayYear} 年法定节假日安排。</p>`;
    return;
  }

  elements.monthHolidays.innerHTML = monthHolidays.length
    ? `<ul>${monthHolidays.map((holiday) => `<li class="${holiday.type}"><span>${holiday.dateKey.slice(5)}</span>${holiday.name}</li>`).join("")}</ul><p>来源：${HOLIDAY_SOURCE.title}</p>`
    : `<p>${displayYear}年${displayMonth + 1}月无法定节假日或调休上班日。</p>`;
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
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(events));
  } catch {
    logAssistant("浏览器暂时无法写入本地日程，当前页面仍可继续使用。", "warning");
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    logAssistant("浏览器暂时无法保存设置，本次主题切换仍会立即生效。", "warning");
  }
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
