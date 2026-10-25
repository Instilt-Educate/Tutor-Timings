import { queryAllPages } from '../clients/notion.js';
import { Batches_Database_ID } from '../config/index.js';
import { stripEmojis } from '../utils/text.js';
import { analyzeTiming, slotToMinutes } from '../utils/timing.js';

/**
 * Fetch active batches data from Notion
 * @returns {Promise<Array>} - Array of active batch records
 */
export async function getActiveBatchesData() {
  const allRecords = await queryAllPages({
    database_id: Batches_Database_ID,
    filter: {
      "or": [
        {
          "property": "Status",
          "select": {
            "equals": "Active"
          }
        },
        {
          "property": "Status",
          "select": {
            "equals": "In Crisis"
          }
        }
      ]
    }
  });

  const formattedRecords = [];

  for (const record of allRecords) {
    const timing_string = record.properties.Timings.rich_text[0]?.plain_text || '';

    const analyzedTiming = analyzeTiming(timing_string);
    const rawBatchName = record.properties["Batch Name"].title[0]?.plain_text || '';
    const cleanBatchName = stripEmojis(rawBatchName);

    formattedRecords.push({
      id: record.id,
      batch_name: cleanBatchName,
      status: record.properties.Status.select?.name || '',
      languages: record.properties["Language Requirement"].multi_select.map(l => l.name),
      vacant_bilingual: record.properties["Vacant Bilingual Spots"].formula.number,
      vacant_native: record.properties["Vacant Native Spots"].formula.number,
      timing: timing_string || '',
      parsed_timing: analyzedTiming.sessions,
      timing_timezone: analyzedTiming.timezone,
      timing_issues: analyzedTiming.issues,
      timing_matchable: analyzedTiming.matchable,
    });
  }

  return formattedRecords;
}

/**
 * Merge a member's slots for one day into contiguous free intervals (in minutes)
 */
function mergeMemberSlots(slots) {
  const ranges = slots
    .map(slotToMinutes)
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Work out whether a batch has a spot for the member's tutor type.
 * Negative or zero vacancy counts as full; no tutor type means unknown.
 */
function getVacancy(batch, tutorType) {
  const type = (tutorType || '').toLowerCase();
  const spots = type === 'native' ? batch.vacant_native
    : type === 'bilingual' ? batch.vacant_bilingual
    : null;

  let status = 'unknown';
  if (spots !== null && spots !== undefined) status = spots > 0 ? 'available' : 'full';

  return {
    member_tutor_type: tutorType || '',
    spots_for_member: spots ?? null,
    status,
  };
}

/**
 * Match member availability with batch timings.
 * A batch session is covered when the member's free time fully contains it,
 * so a 6:30-7:30 PM session needs both the 6 PM and 7 PM slots.
 * Batches with at least one covered session are returned, with coverage details
 * so callers can decide whether to require all sessions.
 * @param {Object} availability - Member's availability object with days as keys
 * @param {Array} batches - Array of batch objects with parsed_timing
 * @param {string} [tutorType] - Member's tutor type (Native or Bilingual), used for the vacancy flag
 * @returns {Array} - Array of matching batches
 */
export function matchMemberAvailabilityWithBatches(availability, batches, tutorType = '') {
  const freeByDay = {};
  for (const [day, slots] of Object.entries(availability || {})) {
    freeByDay[day.toLowerCase()] = mergeMemberSlots(slots || []);
  }

  const matchingBatches = [];

  for (const batch of batches) {
    if (batch.timing_matchable === false) continue;

    const matchedSessions = [];
    let totalSessions = 0;

    for (const [day, slots] of Object.entries(batch.parsed_timing || {})) {
      const free = freeByDay[day.toLowerCase()] || [];

      for (const batchSlot of slots) {
        const session = slotToMinutes(batchSlot);
        if (!session) continue;

        totalSessions++;
        if (free.some(range => range.start <= session.start && range.end >= session.end)) {
          matchedSessions.push({ day, slot: batchSlot });
        }
      }
    }

    if (matchedSessions.length > 0) {
      matchingBatches.push({
        batch_id: batch.id,
        batch_name: batch.batch_name,
        status: batch.status,
        languages: batch.languages,
        vacant_bilingual: batch.vacant_bilingual,
        vacant_native: batch.vacant_native,
        vacancy: getVacancy(batch, tutorType),
        timing: batch.timing,
        coverage: {
          matched_sessions: matchedSessions.length,
          total_sessions: totalSessions,
          all_sessions_covered: matchedSessions.length === totalSessions,
          matched_slots: matchedSessions,
        },
      });
    }
  }

  return matchingBatches;
}

/**
 * Batches whose timing couldn't be read reliably, so they were never matched
 */
export function getUnmatchableBatches(batches) {
  return batches
    .filter(batch => batch.timing_matchable === false)
    .map(batch => ({
      batch_id: batch.id,
      batch_name: batch.batch_name,
      timing: batch.timing,
      issues: batch.timing_issues,
    }));
}
