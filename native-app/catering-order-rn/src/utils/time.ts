export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getDateRangeStrings(
  range: 'day' | 'week' | 'month' | 'year'
): { start: string; end: string } {
  const now = new Date();
  const end = formatDate(now);
  let start: string;

  switch (range) {
    case 'day':
      start = end;
      break;
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = formatDate(d);
      break;
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      start = formatDate(d);
      break;
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      start = formatDate(d);
      break;
    }
    default:
      start = end;
  }
  return { start, end };
}

export function getTodayDateString(): string {
  return formatDate(new Date());
}

export function getWeekDateRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return { start: formatDate(monday), end: formatDate(now) };
}

export function getMonthDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end: formatDate(now) };
}