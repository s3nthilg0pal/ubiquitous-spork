export function dateForDay(startDateISO: string, idx: number): Date {
  const [y, m, d] = startDateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + idx);
  return date;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}
