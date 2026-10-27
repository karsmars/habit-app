export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return null;
  return parsed;
}

export function addDays(value, amount) {
  const date = parseDate(value);
  if (!date || !Number.isInteger(amount)) throw new TypeError("Expected a valid local date and whole-day offset.");
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

export function monthStart(value) {
  const date = parseDate(value);
  if (!date) throw new TypeError("Expected a valid local date.");
  date.setDate(1);
  return localDateString(date);
}

export function addMonths(value, amount) {
  const date = parseDate(value);
  if (!date || !Number.isInteger(amount)) throw new TypeError("Expected a valid local date and whole-month offset.");
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return localDateString(date);
}

export function formatDate(value, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
  const date = parseDate(value);
  if (!date) throw new TypeError("Expected a valid local date.");
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function isValidDateString(value) {
  return typeof value === "string" && parseDate(value) !== null;
}

export function daysInMonth(value) {
  const date = parseDate(value);
  if (!date) throw new TypeError("Expected a valid local date.");
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function dayOfWeek(value) {
  const date = parseDate(value);
  if (!date) throw new TypeError("Expected a valid local date.");
  return date.getDay();
}
