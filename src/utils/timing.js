/**
 * Normalize time format
 */
function normalizeTime(rawTime) {
  rawTime = rawTime.replace(/\s*to\s*/i, " - ");

  const parts = rawTime.split(/\s*-\s*/);
  if (parts.length !== 2) return rawTime;

  const normalizePart = (part, ampmHint) => {
    let match = part.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return part;

    let [, hour, minute, ampm] = match;
    minute = minute || "00";

    if (!ampm && ampmHint) ampm = ampmHint;

    hour = parseInt(hour, 10);

    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;

    hour = hour.toString().padStart(2, "0");
    minute = minute.padStart(2, "0");

    ampm = (ampm || "PM").toUpperCase();

    return `${hour}:${minute} ${ampm}`;
  };

  const startAmpmMatch = parts[0].match(/(am|pm)/i);
  const endAmpmMatch = parts[1].match(/(am|pm)/i);

  const start = normalizePart(parts[0], startAmpmMatch ? startAmpmMatch[0] : endAmpmMatch ? endAmpmMatch[0] : null);
  const end = normalizePart(parts[1], endAmpmMatch ? endAmpmMatch[0] : startAmpmMatch ? startAmpmMatch[0] : null);

  return `${start} - ${end}`;
}

/**
 * Parse and normalize timing string
 */
export function parseAndNormalizeTiming(timingString) {
  const dayPattern = /\b(mon(day)?s?|tue(sday)?s?|wed(nesday)?s?|thu(rsday)?s?|fri(day)?s?|sat(urday)?s?|sun(day)?s?)\b/gi;

  const hour = "\\d{1,2}";
  const minute = "(?::\\d{2})?";
  const meridiem = "\\s?(?:a\\.m\\.|p\\.m\\.|am|pm)?";
  const separator = "\\s*(?:-|to)\\s*";

  const singleTime = `${hour}${minute}${meridiem}`;
  const timeRange = `${singleTime}${separator}${singleTime}`;
  const timePattern = new RegExp(`${timeRange}|${singleTime}`, "gi");

  const rawDays = timingString.match(dayPattern) || [];
  const rawTimes = timingString.match(timePattern) || [];

  const normalizedDays = rawDays.map(d => {
    const lower = d.toLowerCase();
    if (lower.startsWith("mon")) return "Monday";
    if (lower.startsWith("tue")) return "Tuesday";
    if (lower.startsWith("wed")) return "Wednesday";
    if (lower.startsWith("thu")) return "Thursday";
    if (lower.startsWith("fri")) return "Friday";
    if (lower.startsWith("sat")) return "Saturday";
    if (lower.startsWith("sun")) return "Sunday";
    return null;
  }).filter(Boolean);

  const result = {};
  normalizedDays.forEach((day, i) => {
    const rawTime = rawTimes[i] || rawTimes[0];
    if (rawTime) {
      const normalized = normalizeTime(rawTime);
      if (!result[day]) result[day] = [];
      result[day].push(normalized);
    }
  });

  return result;
}
