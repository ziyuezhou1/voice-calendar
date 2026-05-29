export const HOLIDAY_SOURCE = {
  title: "国务院办公厅关于2026年部分节假日安排的通知",
  url: "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
  publishedAt: "2025-11-04",
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

export function getHoliday(dateKey) {
  const year = dateKey.slice(0, 4);
  return HOLIDAY_DATA[year]?.[dateKey] || null;
}

export function getMonthHolidays(year, monthIndex) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  return Object.entries(HOLIDAY_DATA[year] || {})
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .map(([dateKey, holiday]) => ({ dateKey, ...holiday }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function hasHolidayData(year) {
  return Boolean(HOLIDAY_DATA[year]);
}
