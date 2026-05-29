export const HOLIDAY_SOURCE = {
  title: "国务院办公厅关于2026年部分节假日安排的通知",
  url: "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
  publishedAt: "2025-11-04",
};

export const INTERNATIONAL_HOLIDAY_SOURCE = {
  title: "国际节日采用固定公历日期与通行规则计算",
  note: "母亲节按5月第二个星期日，父亲节按6月第三个星期日，感恩节按11月第四个星期四，复活节按西方复活节算法计算。",
};

const HOLIDAYS_2026 = {
  "2026-01-01": { name: "元旦", type: "holiday" },
  "2026-01-02": { name: "元旦", type: "holiday" },
  "2026-01-03": { name: "元旦", type: "holiday" },
  "2026-01-04": { name: "调休上班", type: "workday" },
  "2026-02-14": { name: "调休上班", type: "workday" },
  "2026-02-15": { name: "春节", type: "holiday" },
  "2026-02-16": { name: "春节", type: "holiday" },
  "2026-02-17": { name: "春节", type: "holiday" },
  "2026-02-18": { name: "春节", type: "holiday" },
  "2026-02-19": { name: "春节", type: "holiday" },
  "2026-02-20": { name: "春节", type: "holiday" },
  "2026-02-21": { name: "春节", type: "holiday" },
  "2026-02-22": { name: "春节", type: "holiday" },
  "2026-02-23": { name: "春节", type: "holiday" },
  "2026-02-28": { name: "调休上班", type: "workday" },
  "2026-04-04": { name: "清明", type: "holiday" },
  "2026-04-05": { name: "清明", type: "holiday" },
  "2026-04-06": { name: "清明", type: "holiday" },
  "2026-05-01": { name: "劳动节", type: "holiday" },
  "2026-05-02": { name: "劳动节", type: "holiday" },
  "2026-05-03": { name: "劳动节", type: "holiday" },
  "2026-05-04": { name: "劳动节", type: "holiday" },
  "2026-05-05": { name: "劳动节", type: "holiday" },
  "2026-05-09": { name: "调休上班", type: "workday" },
  "2026-06-19": { name: "端午", type: "holiday" },
  "2026-06-20": { name: "端午", type: "holiday" },
  "2026-06-21": { name: "端午", type: "holiday" },
  "2026-09-20": { name: "调休上班", type: "workday" },
  "2026-09-25": { name: "中秋", type: "holiday" },
  "2026-09-26": { name: "中秋", type: "holiday" },
  "2026-09-27": { name: "中秋", type: "holiday" },
  "2026-10-01": { name: "国庆", type: "holiday" },
  "2026-10-02": { name: "国庆", type: "holiday" },
  "2026-10-03": { name: "国庆", type: "holiday" },
  "2026-10-04": { name: "国庆", type: "holiday" },
  "2026-10-05": { name: "国庆", type: "holiday" },
  "2026-10-06": { name: "国庆", type: "holiday" },
  "2026-10-07": { name: "国庆", type: "holiday" },
  "2026-10-10": { name: "调休上班", type: "workday" },
};

export const HOLIDAY_DATA = {
  2026: HOLIDAYS_2026,
};

const INTERNATIONAL_FIXED_DAYS = [
  { month: 2, day: 14, name: "情人节" },
  { month: 3, day: 8, name: "国际妇女节" },
  { month: 3, day: 15, name: "国际消费者权益日" },
  { month: 3, day: 20, name: "国际幸福日" },
  { month: 4, day: 1, name: "愚人节" },
  { month: 4, day: 7, name: "世界卫生日" },
  { month: 4, day: 22, name: "世界地球日" },
  { month: 5, day: 1, name: "国际劳动节" },
  { month: 5, day: 12, name: "国际护士节" },
  { month: 6, day: 1, name: "国际儿童节" },
  { month: 6, day: 5, name: "世界环境日" },
  { month: 7, day: 11, name: "世界人口日" },
  { month: 8, day: 12, name: "国际青年节" },
  { month: 9, day: 21, name: "国际和平日" },
  { month: 10, day: 24, name: "联合国日" },
  { month: 10, day: 31, name: "万圣夜" },
  { month: 12, day: 24, name: "平安夜" },
  { month: 12, day: 25, name: "圣诞节" },
];

export function getHoliday(dateKey) {
  const holiday = getHolidayMarkers(dateKey)[0];
  return holiday ? { name: holiday.name, type: holiday.type } : null;
}

export function getHolidayMarkers(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const statutory = HOLIDAY_DATA[year]?.[dateKey];
  const markers = statutory ? [{ ...statutory, scope: "china" }] : [];
  const international = getInternationalHolidays(year)[dateKey] || [];
  return [...markers, ...international];
}

export function getMonthHolidays(year, monthIndex) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const statutory = Object.entries(HOLIDAY_DATA[year] || {})
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .map(([dateKey, holiday]) => ({ dateKey, ...holiday, scope: "china" }));
  const international = Object.entries(getInternationalHolidays(year))
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .flatMap(([dateKey, holidays]) => holidays.map((holiday) => ({ dateKey, ...holiday })));

  return [...statutory, ...international]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function hasHolidayData(year) {
  return Number.isInteger(Number(year));
}

export function hasStatutoryHolidayData(year) {
  return Boolean(HOLIDAY_DATA[year]);
}

function getInternationalHolidays(year) {
  const holidays = {};
  const add = (date, name) => {
    const dateKey = toDateKey(date);
    holidays[dateKey] = holidays[dateKey] || [];
    if (!holidays[dateKey].some((holiday) => holiday.name === name)) {
      holidays[dateKey].push({ name, type: "international", scope: "international" });
    }
  };

  INTERNATIONAL_FIXED_DAYS.forEach((holiday) => {
    add(new Date(year, holiday.month - 1, holiday.day), holiday.name);
  });

  add(nthWeekdayOfMonth(year, 4, 0, 2), "母亲节");
  add(nthWeekdayOfMonth(year, 5, 0, 3), "父亲节");
  add(nthWeekdayOfMonth(year, 10, 4, 4), "感恩节");
  add(getWesternEasterDate(year), "复活节");

  return holidays;
}

function nthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(1 + offset + (occurrence - 1) * 7);
  return date;
}

function getWesternEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
