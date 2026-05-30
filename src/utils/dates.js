const WEEKDAY = [0, 6]; // Sunday=0, Saturday=6

function isWeekend(date) {
  return WEEKDAY.includes(date.getDay());
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  // Handle YYYY-MM-DD without timezone shift
  const parts = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }
  return new Date(str);
}

export function today() {
  return toISODate(new Date());
}

export function addBusinessDays(dateStr, days) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d.getTime())) return dateStr;
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    d.setDate(d.getDate() + direction);
    if (!isWeekend(d)) remaining--;
  }
  return toISODate(d);
}

export function diffBusinessDays(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  let count = 0;
  const direction = e >= s ? 1 : -1;
  const cursor = new Date(s);
  while (toISODate(cursor) !== toISODate(e)) {
    cursor.setDate(cursor.getDate() + direction);
    if (!isWeekend(cursor)) count += direction;
  }
  return count;
}

export function weekOf(dateStr) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d.getTime())) return null;
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return toISODate(monday);
}

export function weeksInRange(start, end) {
  const startMonday = weekOf(start);
  const endMonday = weekOf(end);
  if (!startMonday || !endMonday) return [];
  const weeks = [];
  const cursor = parseDate(startMonday);
  const endDate = parseDate(endMonday);
  while (cursor <= endDate) {
    weeks.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  const due = parseDate(dueDateStr);
  if (!due || isNaN(due.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

export function isoWeekNumber(dateStr) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d.getTime())) return null;
  // ISO week: week containing first Thursday of year
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  const day = jan4.getDay() || 7; // Mon=1 ... Sun=7
  startOfWeek1.setDate(jan4.getDate() - (day - 1));
  const diff = d - startOfWeek1;
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (weekNum < 1) {
    return isoWeekNumber(toISODate(new Date(d.getFullYear() - 1, 11, 31)));
  }
  if (weekNum > 52) {
    const nextJan4 = new Date(d.getFullYear() + 1, 0, 4);
    const nextDay = nextJan4.getDay() || 7;
    const startOfNextWeek1 = new Date(nextJan4);
    startOfNextWeek1.setDate(nextJan4.getDate() - (nextDay - 1));
    if (d >= startOfNextWeek1) return 1;
  }
  return weekNum;
}
