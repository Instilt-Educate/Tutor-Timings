const DAY_NAMES = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

const TIMEZONE_PATTERN = /\b(IST|UTC|GMT(?:\s?[+-]\s?\d{1,2}(?::?\d{2})?)?|[ECMP][SD]T|BST|CEST|CET|EEST|EET|EAT|WAT|CAT|SAST|SGT|PKT|NPT|AEST|AEDT|JST|KST)\b/gi;

/**
 * Normalize a time range like "7 to 8pm" to "07:00 PM - 08:00 PM".
 * Returns null when the AM/PM can't be determined or the range can't be read.
 */
function normalizeTime(rawTime) {
  const parts = rawTime.replace(/\s*to\s*/i, " - ").split(/\s*-\s*/);
  if (parts.length !== 2) return null;

  const read = (part) => {
    const match = part.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (!match) return null;
    const [, hour, minute, ampm] = match;
    return {
      hour: parseInt(hour, 10),
      minute: parseInt(minute || "0", 10),
      ampm: ampm ? (ampm[0].toLowerCase() === "a" ? "AM" : "PM") : null,
    };
  };

  const start = read(parts[0]);
  const end = read(parts[1]);
  if (!start || !end) return null;
  if (start.minute > 59 || end.minute > 59) return null;

  // 24-hour times (13-23) carry their own meridiem
  for (const t of [start, end]) {
    if (t.hour > 12 && t.hour < 24 && !t.ampm) {
      t.hour -= 12;
      t.ampm = "PM";
    }
    if (t.hour > 23) return null;
  }

  // A meridiem on only one side applies to both, e.g. "7-8pm"
  if (!start.ampm && !end.ampm) return null;
  const inheritedStart = !start.ampm;
  if (!start.ampm) start.ampm = end.ampm;
  if (!end.ampm) end.ampm = start.ampm;

  // "11-1pm" means 11 AM - 1 PM, not 11 PM - 1 PM
  if (inheritedStart && start.ampm === "PM" && (start.hour % 12) > (end.hour % 12)) {
    start.ampm = "AM";
  }

  const format = (t) => {
    const hour = t.hour === 0 ? 12 : t.hour;
    return `${String(hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} ${t.ampm}`;
  };

  return `${format(start)} - ${format(end)}`;
}

/**
 * Parse a free-text timing string.
 * @returns {{sessions: Object, timezone: string|null, issues: string[], matchable: boolean}}
 *   sessions maps day -> normalized slots; issues explains anything that makes
 *   the timing unreliable; matchable is false when it must not be used for matching.
 */
export function analyzeTiming(timingString) {
  const dayPattern = /\b(mon(day)?s?|tue(sday)?s?|wed(nesday)?s?|thu(rsday)?s?|fri(day)?s?|sat(urday)?s?|sun(day)?s?)\b/gi;

  const hour = "\\d{1,2}";
  const minute = "(?::\\d{2})?";
  const meridiem = "\\s?(?:a\\.m\\.|p\\.m\\.|am|pm)?";
  const separator = "\\s*(?:-|to)\\s*";

  const singleTime = `${hour}${minute}${meridiem}`;
  const timeRange = `${singleTime}${separator}${singleTime}`;
  const timePattern = new RegExp(`${timeRange}|${singleTime}`, "gi");

  const text = timingString || "";
  const issues = [];
  const sessions = {};

  const zones = [...new Set((text.match(TIMEZONE_PATTERN) || []).map(z => z.toUpperCase()))];
  const timezone = zones.length ? zones.join("/") : null;
  if (zones.length && (zones.length > 1 || zones[0] !== "IST")) {
    issues.push(`non_ist_timezone:${timezone}`);
  }

  const rawDays = text.match(dayPattern) || [];
  const rawTimes = text.match(timePattern) || [];

  const days = rawDays
    .map(d => DAY_NAMES.find(([prefix]) => d.toLowerCase().startsWith(prefix))?.[1])
    .filter(Boolean);

  if (days.length === 0) issues.push("no_days");
  if (rawTimes.length === 0) issues.push("no_times");
  if (rawTimes.length > 1 && rawTimes.length !== days.length) issues.push("days_times_mismatch");

  if (days.length && rawTimes.length) {
    days.forEach((day, i) => {
      const normalized = normalizeTime(rawTimes[i] || rawTimes[0]);
      if (!normalized) {
        issues.push(`unreadable_time:${day}`);
        return;
      }
      if (!sessions[day]) sessions[day] = [];
      sessions[day].push(normalized);
    });
  }

  return {
    sessions,
    timezone,
    issues: [...new Set(issues)],
    matchable: issues.length === 0 && Object.keys(sessions).length > 0,
  };
}

/**
 * Convert a normalized slot like "06:30 PM - 07:30 PM" to minutes since midnight.
 * A range ending at or before its start (e.g. "11:00 PM - 12:00 AM") runs past midnight.
 * @returns {{start: number, end: number}|null}
 */
export function slotToMinutes(slot) {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(slot || '');
  if (!match) return null;

  const toMinutes = (h, m, ampm) => {
    let hour = parseInt(h, 10) % 12;
    if (ampm.toUpperCase() === 'PM') hour += 12;
    return hour * 60 + parseInt(m, 10);
  };

  const start = toMinutes(match[1], match[2], match[3]);
  let end = toMinutes(match[4], match[5], match[6]);
  if (end <= start) end += 24 * 60;

  return { start, end };
}

/**
 * Parse and normalize timing string
 * @returns {Object} day -> normalized slots
 */
export function parseAndNormalizeTiming(timingString) {
  return analyzeTiming(timingString).sessions;
}
