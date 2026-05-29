import assert from "node:assert/strict";
import {
  createEventFromCommand,
  filterEvents,
  findMatchingEvents,
  formatDateTime,
  parseVoiceCommand,
  weekRange,
} from "../src/calendar-core.js";
import { getHoliday, getHolidayMarkers, getMonthHolidays, hasHolidayData } from "../src/holiday-data.js";

const now = new Date(2026, 4, 29, 9, 20, 0);

function parse(text) {
  return parseVoiceCommand(text, { now });
}

{
  const command = parse("添加明天下午三点团队周会，提前二十分钟提醒我");
  assert.equal(command.intent, "add");
  assert.equal(command.title, "团队周会");
  assert.equal(formatDateTime(command.startsAt), "2026-05-30 15:00");
  assert.equal(command.reminderMinutes, 20);
  assert.deepEqual(command.missing, []);
}

{
  const command = parse("下周五上午十点半安排产品评审");
  assert.equal(command.intent, "add");
  assert.equal(command.title, "产品评审");
  assert.equal(formatDateTime(command.startsAt), "2026-06-05 10:30");
}

{
  const command = parse("半小时后提醒喝水");
  assert.equal(command.intent, "add");
  assert.equal(command.title, "喝水");
  assert.equal(formatDateTime(command.startsAt), "2026-05-29 09:50");
}

{
  const command = parse("6月1日上午9点提交周报，准时提醒");
  assert.equal(command.intent, "add");
  assert.equal(command.title, "提交周报");
  assert.equal(formatDateTime(command.startsAt), "2026-06-01 09:00");
  assert.equal(command.reminderMinutes, 0);
}

{
  const command = parse("30号晚上八点预约体检");
  assert.equal(command.intent, "add");
  assert.equal(command.title, "体检");
  assert.equal(formatDateTime(command.startsAt), "2026-05-30 20:00");
}

{
  const command = parse("查看本周日程");
  assert.equal(command.intent, "list");
  assert.equal(command.range.type, "week");
  assert.equal(formatDateTime(command.range.start), "2026-05-25 00:00");
}

{
  const command = parse("取消明天下午三点团队周会");
  const event = createEventFromCommand(parse("添加明天下午三点团队周会"), now);
  const matches = findMatchingEvents([event], command);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, "团队周会");
}

{
  const events = [
    createEventFromCommand(parse("添加今天上午十点晨会"), now),
    createEventFromCommand(parse("添加下周五上午十点评审"), now),
  ];
  const currentWeek = filterEvents(events, weekRange(now));
  assert.equal(currentWeek.length, 1);
  assert.equal(currentWeek[0].title, "晨会");
}

{
  assert.equal(hasHolidayData(2026), true);
  assert.deepEqual(getHoliday("2026-10-01"), { name: "国庆", type: "holiday" });
  assert.deepEqual(getHoliday("2026-10-10"), { name: "调休上班", type: "workday" });
  assert.equal(getHolidayMarkers("2026-02-14").some((holiday) => holiday.name === "情人节"), true);
  assert.equal(getHolidayMarkers("2026-04-05").some((holiday) => holiday.name === "复活节"), true);
  assert.equal(getHolidayMarkers("2026-06-21").some((holiday) => holiday.name === "父亲节"), true);
  assert.equal(getMonthHolidays(2026, 4).some((holiday) => holiday.name === "母亲节" && holiday.dateKey === "2026-05-10"), true);
  assert.equal(getMonthHolidays(2026, 10).some((holiday) => holiday.name === "感恩节" && holiday.dateKey === "2026-11-26"), true);
  assert.equal(getMonthHolidays(2026, 9).length, 10);
}

console.log("calendar-core tests passed");
