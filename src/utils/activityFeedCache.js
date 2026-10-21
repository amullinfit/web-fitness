// Stage 5D: shared activity feed range cache. Consumers are migrated separately.
// All dates are ISO calendar dates (inclusive); never use UTC date parsing for display.
const DAY = 86400000;
const parseDay = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid calendar date');
  const n = Date.parse(s + 'T00:00:00Z');
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== s) throw new Error('Invalid calendar date');
  return n / DAY;
};
const dayString = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const intervals = [];
const inflight = new Map();
const records = new Map();
const listeners = new Set();
let revision = 0;
const notify = () => { revision++; listeners.forEach((fn) => fn()); };
const combine = (items) => {
  const sorted = items.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
};
const subtract = (start, end, covered) => {
  let remaining = [[start, end]];
  for (const [a, b] of covered) {
    remaining = remaining.flatMap(([x, y]) =>
      b < x || a > y ? [[x, y]] : [
        ...(x < a ? [[x, a - 1]] : []),
        ...(b < y ? [[b + 1, y]] : []),
      ]);
  }
  return remaining;
};
const allCoverage = () => combine([...intervals, ...[...inflight.values()].map((x) => x.range)]);
const fetchWindow = async (a, b) => {
  const key = a + ':' + b;
  if (inflight.has(key)) return inflight.get(key).promise;
  const promise = (async () => {
    const url = '/api/val-activity-feed?start=' + dayString(a) + '&end=' + dayString(b);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Activity feed HTTP ' + response.status);
    const body = await response.json();
    if (!Array.isArray(body.records) || !body.diagnostics) throw new Error('Invalid activity feed response');
    for (const record of body.records) {
      if (record?.key) records.set(record.key, record);
    }
    // Only healthy responses count as complete coverage. Incomplete records remain usable.
    if (body.diagnostics.success === true) {
      intervals.splice(0, intervals.length, ...combine([...intervals, [a, b]]));
    }
    notify();
    return body;
  })();
  inflight.set(key, { range: [a, b], promise });
  notify();
  try { return await promise; }
  finally { inflight.delete(key); notify(); }
};
export const activityFeedCache = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot() { return revision; },
  getRecords(start, end) {
    const a = parseDay(start), b = parseDay(end);
    return [...records.values()].filter((r) => {
      if (!r.date) return false;
      const d = parseDay(r.date);
      return d >= a && d <= b;
    }).sort((x, y) => x.date.localeCompare(y.date) || x.key.localeCompare(y.key));
  },
  getCoverage() { return intervals.map(([a, b]) => [dayString(a), dayString(b)]); },
  async ensureDirectional(start, end) {
    const a = parseDay(start), b = parseDay(end);
    if (b < a) throw new Error('Reversed activity feed range');
    const coverage = allCoverage();
    if (!coverage.length) return this.ensure(start, end, 28);
    const low = coverage[0][0], high = coverage[coverage.length - 1][1];
    const tasks = [];
    if (a < low) {
      const blocks = Math.ceil((low - a) / 28);
      tasks.push(this.ensure(dayString(low - blocks * 28), dayString(low - 1), 28));
    }
    if (b > high) {
      const blocks = Math.ceil((b - high) / 28);
      tasks.push(this.ensure(dayString(high + 1), dayString(high + blocks * 28), 28));
    }
    // Disjoint or incomplete ranges may exist between cached windows.
    tasks.push(this.ensure(start, end, 28));
    await Promise.all(tasks);
  },
  async ensure(start, end, batchDays = 28) {
    const a = parseDay(start), b = parseDay(end);
    if (b < a) throw new Error('Reversed activity feed range');
    const pending = [...inflight.values()].filter((x) => x.range[0] <= b && x.range[1] >= a).map((x) => x.promise);
    const missing = subtract(a, b, allCoverage());
    const jobs = [];
    for (const [x, y] of missing) {
      for (let from = x; from <= y; from += batchDays) {
        const to = Math.min(y, from + batchDays - 1);
        jobs.push(fetchWindow(from, to));
      }
    }
    await Promise.all([...pending, ...jobs]);
    // An overlapping in-flight request may fail or be incomplete; caller can retry.
  },
  invalidate(start, end) {
    const a = parseDay(start), b = parseDay(end);
    intervals.splice(0, intervals.length, ...intervals.flatMap(([u, v]) => subtract(u, v, [[a, b]])));
    for (const [key, record] of records) {
      if (record.date && record.date >= start && record.date <= end) records.delete(key);
    }
    notify();
  },
};
