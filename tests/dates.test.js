import test from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, daysInMonth, dayOfWeek, formatDate, isValidDateString, localDateString, monthStart, parseDate } from "../js/dates.js";

test("local date formatting and validation avoid UTC date shifts", () => {
  const local = new Date(2026, 9, 27, 0, 15);
  assert.equal(localDateString(local), "2026-10-27");
  assert.equal(isValidDateString("2024-02-29"), true);
  assert.equal(isValidDateString("2025-02-29"), false);
  assert.equal(parseDate("2026-13-01"), null);
});

test("calendar helpers handle month boundaries and leap years", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(monthStart("2026-03-25"), "2026-03-01");
  assert.equal(addMonths("2026-03-25", -1), "2026-02-01");
  assert.equal(daysInMonth("2024-02-01"), 29);
  assert.equal(dayOfWeek("2026-03-01"), 0);
  assert.equal(formatDate("2026-03-01", { month: "numeric", day: "numeric" }), "3/1");
});
