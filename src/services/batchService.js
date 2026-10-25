import { queryAllPages } from '../clients/notion.js';
import { Batches_Database_ID } from '../config/index.js';
import { stripEmojis } from '../utils/text.js';
import { parseAndNormalizeTiming } from '../utils/timing.js';

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

    let days = timing_string.match(/\b(mon(day)?s?|tue(sday)?s?|wed(nesday)?s?|thu(rsday)?s?|fri(day)?s?|sat(urday)?s?|sun(day)?s?)/gi);

    let pattern = /\b[0-9]{1,2}(:[0-9]{2})?(\s?((a\.?m\.?)|(p\.?m\.?)))?(\s*(-|to)\s*)?[0-9]{1,2}(:[0-9]{2})?(\s?((a\.?m\.?)|(p\.?m\.?)))?/gi;
    let times = timing_string.match(pattern);

    const parsedTiming = parseAndNormalizeTiming(timing_string);
    const rawBatchName = record.properties["Batch Name"].title[0]?.plain_text || '';
    const cleanBatchName = stripEmojis(rawBatchName);

    formattedRecords.push({
      id: record.id,
      batch_name: cleanBatchName,
      status: record.properties.Status.select?.name || '',
      language: record.properties["Language Requirement"].multi_select[0]?.name || '',
      vacant_bilingual: record.properties["Vacant Bilingual Spots"].formula.number,
      vacant_native: record.properties["Vacant Native Spots"].formula.number,
      timing: timing_string || '',
      days: days || [],
      times: times || [],
      parsed_timing: parsedTiming,
    });
  }

  return formattedRecords;
}

/**
 * Match member availability with batch timings
 * @param {Object} availability - Member's availability object with days as keys
 * @param {Array} batches - Array of batch objects with parsed_timing
 * @returns {Array} - Array of matching batches
 */
export function matchMemberAvailabilityWithBatches(availability, batches) {
  const matchingBatches = [];

  for (const batch of batches) {
    const batchTiming = batch.parsed_timing || {};
    let hasMatch = false;

    // Check if member's availability overlaps with batch timing
    for (const [day, slots] of Object.entries(batchTiming)) {
      const dayLower = day.toLowerCase();
      const memberSlots = availability[dayLower] || [];

      // Check if any batch slot matches any member slot
      for (const batchSlot of slots) {
        if (memberSlots.includes(batchSlot)) {
          hasMatch = true;
          break;
        }
      }

      if (hasMatch) break;
    }

    if (hasMatch) {
      matchingBatches.push({
        batch_id: batch.id,
        batch_name: batch.batch_name,
        status: batch.status,
        language: batch.language,
        vacant_bilingual: batch.vacant_bilingual,
        vacant_native: batch.vacant_native,
        timing: batch.timing,
      });
    }
  }

  return matchingBatches;
}
