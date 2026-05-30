const CN_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const WEEKDAY_ALIASES = {
  日: 0,
  天: 0,
  末: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

const INTENT_WORDS = {
  add: ["添加", "新增", "新建", "创建", "安排", "记一下", "记下", "提醒我", "帮我记", "帮我加", "加个", "加一个", "加一条", "预约"],
  delete: ["删除", "取消", "移除", "删掉", "去掉", "清除"],
  list: ["查看", "查询", "看看", "列出", "播报", "读一下", "今天有什么", "日程", "安排"],
};

const RANGE_PATTERNS = {
  today: /(今天|今日)/,
  tomorrow: /(明天|明日)/,
  week: /(本周|这周|这一周|最近一周)/,
  nextWeek: /(下周|下星期|下一周)/,
  month: /(本月|这个月|当月)/,
  all: /(全部|所有|所有日程)/,
};

export function normalizeCommand(input = "") {
  return input
    .replace(/[，。！？；、,.!?;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chineseToNumber(value) {
  if (value === undefined || value === null || value === "") return NaN;
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "半") return 0.5;

  let result = 0;
  let section = 0;
  let number = 0;
  for (const char of raw) {
    if (Object.prototype.hasOwnProperty.call(CN_DIGITS, char)) {
      number = CN_DIGITS[char];
      continue;
    }
    if (char === "十") {
      section += (number || 1) * 10;
      number = 0;
      continue;
    }
    if (char === "百") {
      section += (number || 1) * 100;
      number = 0;
      continue;
    }
    if (char === "千") {
      section += (number || 1) * 1000;
      number = 0;
    }
  }
  result = section + number;
  return Number.isFinite(result) ? result : NaN;
}

export function formatDateTime(dateLike) {
  const date = new Date(dateLike);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateKey(dateLike) {
  const date = new Date(dateLike);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function cloneDate(dateLike) {
  return new Date(new Date(dateLike).getTime());
}

function inferIntent(text) {
  const normalized = normalizeCommand(text);
  if (INTENT_WORDS.delete.some((word) => normalized.includes(word))) return "delete";
  if (INTENT_WORDS.list.some((word) => normalized.includes(word))) {
    const addOnly = INTENT_WORDS.add.some((word) => normalized.includes(word));
    if (!addOnly || /查看|查询|看看|列出|播报|读一下|今天有什么/.test(normalized)) return "list";
  }
  if (INTENT_WORDS.add.some((word) => normalized.includes(word)) || /提醒/.test(normalized)) return "add";
  return "unknown";
}

function parseRelativeDate(text, baseDate) {
  const relativeDay = text.match(/([一二两三四五六七八九十\d]+)天后/);
  if (relativeDay) {
    return { date: addDays(baseDate, chineseToNumber(relativeDay[1])), tokens: [relativeDay[0]], precision: "day" };
  }

  if (/大后天/.test(text)) return { date: addDays(baseDate, 3), tokens: ["大后天"], precision: "day" };
  if (/后天/.test(text)) return { date: addDays(baseDate, 2), tokens: ["后天"], precision: "day" };
  if (/明天|明日/.test(text)) return { date: addDays(baseDate, 1), tokens: [text.match(/明天|明日/)?.[0]], precision: "day" };
  if (/今天|今日/.test(text)) return { date: cloneDate(baseDate), tokens: [text.match(/今天|今日/)?.[0]], precision: "day" };
  return null;
}

function parseExplicitDate(text, baseDate) {
  const full = text.match(/(?:(\d{4}|[一二两三四五六七八九十百千]+)年)?\s*(\d{1,2}|[一二两三四五六七八九十]+)月\s*(\d{1,2}|[一二两三四五六七八九十]+)(?:日|号)?/);
  if (full) {
    const year = full[1] ? chineseToNumber(full[1]) : baseDate.getFullYear();
    const month = chineseToNumber(full[2]);
    const day = chineseToNumber(full[3]);
    const date = new Date(year, month - 1, day, baseDate.getHours(), baseDate.getMinutes(), 0, 0);
    return { date, tokens: [full[0]], precision: "day" };
  }

  const dayOnly = text.match(/(^|[^\d])(\d{1,2}|[一二两三四五六七八九十]+)(?:号|日)/);
  if (dayOnly) {
    const day = chineseToNumber(dayOnly[2]);
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), day, baseDate.getHours(), baseDate.getMinutes(), 0, 0);
    if (date < startOfDay(baseDate)) date.setMonth(date.getMonth() + 1);
    return { date, tokens: [dayOnly[0]], precision: "day" };
  }

  return null;
}

function parseWeekday(text, baseDate) {
  const match = text.match(/(下下周|下周|这周|本周|周|星期|礼拜)([一二三四五六日天末])/);
  if (!match) return null;

  const target = WEEKDAY_ALIASES[match[2]];
  const current = baseDate.getDay();
  let delta = target - current;
  const prefix = match[1];
  if (prefix === "下周") delta += 7;
  if (prefix === "下下周") delta += 14;
  if ((prefix === "周" || prefix === "星期" || prefix === "礼拜") && delta <= 0) delta += 7;
  if ((prefix === "这周" || prefix === "本周") && delta < 0) delta += 7;

  return { date: addDays(baseDate, delta), tokens: [match[0]], precision: "day" };
}

function parseDatePart(text, baseDate) {
  return parseRelativeDate(text, baseDate) || parseExplicitDate(text, baseDate) || parseWeekday(text, baseDate);
}

function parseRelativeTime(text, baseDate) {
  const hour = text.match(/([半一二两三四五六七八九十\d]+)个?小时后/);
  if (hour) {
    const date = cloneDate(baseDate);
    date.setMinutes(date.getMinutes() + chineseToNumber(hour[1]) * 60);
    return { date, tokens: [hour[0]], precision: "minute" };
  }

  const minute = text.match(/([半一二两三四五六七八九十\d]+)分钟后/);
  if (minute) {
    const date = cloneDate(baseDate);
    date.setMinutes(date.getMinutes() + chineseToNumber(minute[1]));
    return { date, tokens: [minute[0]], precision: "minute" };
  }

  return null;
}

function parseClockTime(text) {
  const colon = text.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚)?\s*(\d{1,2})[:：](\d{1,2})/);
  if (colon) {
    const meridiem = colon[1] || inferLooseMeridiem(text, colon.index);
    return {
      hour: applyMeridiem(Number(colon[2]), meridiem),
      minute: Number(colon[3]),
      tokens: [colon[0]],
      precision: "minute",
    };
  }

  const natural = text.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚)?\s*([零〇一二两三四五六七八九十\d]{1,3})点(?:([零〇一二两三四五六七八九十\d]{1,3})分?|半|一刻|三刻)?/);
  if (!natural) return null;

  const minuteToken = natural[3];
  let minute = 0;
  if (natural[0].includes("半")) minute = 30;
  else if (natural[0].includes("一刻")) minute = 15;
  else if (natural[0].includes("三刻")) minute = 45;
  else if (minuteToken) minute = chineseToNumber(minuteToken);

  const meridiem = natural[1] || inferLooseMeridiem(text, natural.index);

  return {
    hour: applyMeridiem(chineseToNumber(natural[2]), meridiem),
    minute,
    tokens: [natural[0]],
    precision: "minute",
  };
}

function inferLooseMeridiem(text, matchIndex = 0) {
  const before = text.slice(0, Math.max(0, matchIndex));
  const matches = before.match(/凌晨|早上|上午|中午|下午|傍晚|晚上|今晚/g);
  return matches ? matches[matches.length - 1] : "";
}

function applyMeridiem(hour, meridiem = "") {
  if (!Number.isFinite(hour)) return hour;
  if (/下午|傍晚|晚上|今晚/.test(meridiem) && hour < 12) return hour + 12;
  if (/中午/.test(meridiem) && hour < 11) return hour + 12;
  if (/凌晨/.test(meridiem) && hour === 12) return 0;
  return hour;
}

function parseReminder(text, options = {}) {
  const defaultReminderMinutes = options.defaultReminderMinutes ?? 10;
  if (/不提醒|无需提醒/.test(text)) return { reminderMinutes: null, tokens: [text.match(/不提醒|无需提醒/)?.[0]] };
  if (/准时提醒|到点提醒/.test(text)) return { reminderMinutes: 0, tokens: [text.match(/准时提醒|到点提醒/)?.[0]] };

  const relative = text.match(/提前\s*([半一二两三四五六七八九十\d]+)\s*(分钟|小时|天)(?:\s*提醒)?/);
  if (!relative) return { reminderMinutes: defaultReminderMinutes, tokens: [] };

  const amount = chineseToNumber(relative[1]);
  const unit = relative[2];
  const multiplier = unit === "小时" ? 60 : unit === "天" ? 1440 : 1;
  return { reminderMinutes: amount * multiplier, tokens: [relative[0]] };
}

function buildDateTime(text, baseDate) {
  const relativeTime = parseRelativeTime(text, baseDate);
  if (relativeTime) {
    return {
      startsAt: relativeTime.date,
      tokens: relativeTime.tokens,
      precision: relativeTime.precision,
      hasDate: true,
      hasTime: true,
      isRelativeTime: true,
    };
  }

  const datePart = parseDatePart(text, baseDate);
  const clock = parseClockTime(text);
  const startsAt = datePart ? startOfDay(datePart.date) : startOfDay(baseDate);

  if (clock) {
    startsAt.setHours(clock.hour, clock.minute, 0, 0);
    if (!datePart && startsAt <= baseDate) startsAt.setDate(startsAt.getDate() + 1);
    return {
      startsAt,
      tokens: [...(datePart?.tokens || []), ...clock.tokens],
      precision: "minute",
      hasDate: Boolean(datePart),
      hasTime: true,
    };
  }

  if (datePart) {
    startsAt.setHours(9, 0, 0, 0);
    return {
      startsAt,
      tokens: datePart.tokens,
      precision: "day",
      hasDate: true,
      hasTime: false,
    };
  }

  return { startsAt: null, tokens: [], precision: "unknown", hasDate: false, hasTime: false };
}

function removeKnownTokens(text, tokens) {
  return tokens.reduce((acc, token) => (token ? acc.replace(token, " ") : acc), text);
}

function extractTitle(text, tokens = []) {
  let title = removeKnownTokens(text, tokens);
  title = title
    .replace(/^(请|麻烦|帮我|我要|我想|给我|在|于|到时候|日历里|日历上|日历)\s*/g, " ")
    .replace(/(^|\s)(我|我的|一下)(?=\s|$)/g, " ")
    .replace(/(添加|新增|新建|创建|安排|记一下|记下|预约|提醒我|帮我记|帮我加|加个|加一个|加一条|提醒|事件|日程)/g, " ")
    .replace(/(删除|取消|移除|删掉|去掉|清除|查看|查询|看看|列出|播报|读一下)/g, " ")
    .replace(/(今天|今日|明天|明日|后天|大后天|本周|这周|下周|下下周|周[一二三四五六日天末]|星期[一二三四五六日天末]|礼拜[一二三四五六日天末])/g, " ")
    .replace(/(上午|下午|晚上|今晚|早上|中午|凌晨|傍晚)/g, " ")
    .replace(/[年月日号点分:：]/g, " ")
    .replace(/\b\d{1,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title || "未命名事项";
}

function getRange(text, baseDate) {
  const now = new Date(baseDate);
  if (RANGE_PATTERNS.tomorrow.test(text)) return dayRange(addDays(now, 1), "明天");
  if (RANGE_PATTERNS.today.test(text)) return dayRange(now, "今天");
  if (RANGE_PATTERNS.nextWeek.test(text)) return weekRange(addDays(now, 7), "下周");
  if (RANGE_PATTERNS.week.test(text)) return weekRange(now, "本周");
  if (RANGE_PATTERNS.month.test(text)) return monthRange(now, "本月");
  if (RANGE_PATTERNS.all.test(text)) return { type: "all", label: "全部", start: null, end: null };

  const datePart = parseDatePart(text, now);
  if (datePart) return dayRange(datePart.date, formatDateKey(datePart.date));
  return dayRange(now, "今天");
}

export function dayRange(dateLike, label = "当天") {
  const start = startOfDay(dateLike);
  const end = addDays(start, 1);
  return { type: "day", label, start, end };
}

export function weekRange(dateLike, label = "本周") {
  const date = startOfDay(dateLike);
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = addDays(date, -mondayOffset);
  const end = addDays(start, 7);
  return { type: "week", label, start, end };
}

export function monthRange(dateLike, label = "本月") {
  const date = new Date(dateLike);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { type: "month", label, start, end };
}

export function parseVoiceCommand(input, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const text = normalizeCommand(input);
  const intent = inferIntent(text);

  if (!text) {
    return { intent: "unknown", rawText: input, normalizedText: text, confidence: 0, missing: ["command"] };
  }

  if (intent === "list") {
    const range = getRange(text, now);
    return { intent, rawText: input, normalizedText: text, range, confidence: 0.86, missing: [] };
  }

  if (intent === "delete") {
    const dateTime = buildDateTime(text, now);
    const title = extractTitle(text, dateTime.tokens);
    return {
      intent,
      rawText: input,
      normalizedText: text,
      title,
      startsAt: dateTime.startsAt,
      hasDate: dateTime.hasDate,
      hasTime: dateTime.hasTime,
      confidence: title === "未命名事项" && !dateTime.startsAt ? 0.45 : 0.76,
      missing: [],
    };
  }

  if (intent === "add") {
    const dateTime = buildDateTime(text, now);
    const reminder = parseReminder(text, { defaultReminderMinutes: dateTime.isRelativeTime ? 0 : 10 });
    const title = extractTitle(text, [...dateTime.tokens, ...reminder.tokens]);
    const missing = [];
    if (!dateTime.startsAt) missing.push("dateTime");
    return {
      intent,
      rawText: input,
      normalizedText: text,
      title,
      startsAt: dateTime.startsAt,
      reminderMinutes: reminder.reminderMinutes,
      hasDate: dateTime.hasDate,
      hasTime: dateTime.hasTime,
      assumedTime: dateTime.hasDate && !dateTime.hasTime ? "09:00" : null,
      confidence: missing.length ? 0.48 : dateTime.hasTime ? 0.9 : 0.72,
      missing,
    };
  }

  return {
    intent: "unknown",
    rawText: input,
    normalizedText: text,
    confidence: 0.25,
    missing: ["intent"],
  };
}

export function createEventFromCommand(command, now = new Date()) {
  if (command.intent !== "add" || command.missing?.length) {
    throw new Error("Cannot create event from incomplete command");
  }

  return {
    id: cryptoSafeId(),
    title: command.title,
    startsAt: command.startsAt.toISOString(),
    reminderMinutes: command.reminderMinutes,
    sourceText: command.rawText,
    createdAt: new Date(now).toISOString(),
    notifiedAt: null,
  };
}

export function filterEvents(events, range) {
  const sorted = [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  if (!range || range.type === "all") return sorted;
  return sorted.filter((event) => {
    const startsAt = new Date(event.startsAt);
    return startsAt >= range.start && startsAt < range.end;
  });
}

export function findMatchingEvents(events, command) {
  const normalizedTitle = command.title === "未命名事项" ? "" : compact(command.title);
  return events
    .map((event) => {
      let score = 0;
      const eventDate = new Date(event.startsAt);
      const eventTitle = compact(event.title);
      const target = command.startsAt ? new Date(command.startsAt) : null;

      if (target && command.hasDate && formatDateKey(eventDate) !== formatDateKey(target)) {
        return { event, score: 0 };
      }

      if (normalizedTitle && (eventTitle.includes(normalizedTitle) || normalizedTitle.includes(eventTitle))) score += 4;
      if (target) {
        if (formatDateKey(eventDate) === formatDateKey(target)) score += 3;
        const minuteDiff = Math.abs(eventDate.getTime() - target.getTime()) / 60000;
        if (minuteDiff <= 10) score += 4;
        else if (minuteDiff <= 120) score += 1;
      }

      return { event, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.event);
}

function compact(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
