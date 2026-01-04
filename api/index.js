// ============================================================================
// IMPORTS
// ============================================================================
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import 'dotenv/config';
import { WebClient } from '@slack/web-api';
import { Client } from '@notionhq/client';

// ============================================================================
// CONFIGURATION
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.PORT || 3000;
const Members_Database_ID = process.env.MEMBERS_DATABASE_ID;
const Batches_Database_ID = process.env.BATCHES_DATABASE_ID;

export const maxDuration = 60;

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================
const notion = new Client({ 
  auth: process.env.NOTION_API_KEY,
});

const slack = new WebClient(process.env.SLACK_TOKEN);

// ============================================================================
// CONSTANTS
// ============================================================================
const tierToHours = {
  'bronze': 50,
  'silver': 100,
  'gold': 150,
  'platinum': 200,
  'diamond': 250,
};

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();

app.use(cors());
app.use(express.json({ limit: '1000mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch Slack users from Slack API and return mapped results
 */
async function fetchSlackUsers() {
  const slackApiUrl = process.env.SLACK_API_URL;
  const slackToken = process.env.SLACK_TOKEN;

  if (!slackApiUrl || !slackToken) {
    throw new Error('Missing Slack API configuration (SLACK_API_URL or SLACK_TOKEN)');
  }

  const response = await fetch(`${slackApiUrl}users.list`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${slackToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.ok) {
    throw new Error(`Slack API request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  const members = data.members.map(member => ({
    id: member.id,
    name: member.real_name || member.name,
    display_name: member.profile.display_name,
    email: member.profile.email || null,
    image: member.profile.image_192 || null,
  }));

  return members;
}

/**
 * Normalize a string for matching: remove diacritics, remove non-alphanumerics,
 * collapse whitespace and lowercase
 */
function normalizeForMatch(input) {
  if (!input) return '';
  const noDiacritics = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strip emojis and other non-standard characters from a string
 */
function stripEmojis(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{200D}]/gu, '')            // Zero Width Joiner
    .trim();
}

/**
 * Enrich Notion records with Slack data by matching email or name
 * @param {Array} notionRecords - Array of objects with { email, name, id, ... }
 * @returns {Promise<Array>} - Array of enriched records with Slack data
 */
async function enrichNotionRecordsWithSlack(notionRecords) {
  if (!Array.isArray(notionRecords)) {
    throw new Error('notionRecords must be an array');
  }

  const simplified = notionRecords.map(item => ({
    email: item.email || '',
    name: item.name || '',
    id: item.id || null,
  }));

  let slackMembers = [];
  try {
    slackMembers = await fetchSlackUsers();
  } catch (err) {
    console.error('Error fetching slack members:', err);
  }

  const enriched = simplified.map(item => {
    const itemEmail = item.email || '';
    const itemName = item.name || '';

    let match = slackMembers.find(m => m.email && itemEmail && m.email.toLowerCase() === itemEmail.toLowerCase());
    let matchType = match ? 'email' : null;

    if (!match && itemName) {
      const normItemName = normalizeForMatch(itemName);
      match = slackMembers.find(m => {
        const candidateName = (m.name || m.display_name || '');
        const normCandidate = normalizeForMatch(candidateName);
        return normCandidate && normItemName && (
          normCandidate === normItemName ||
          normCandidate.indexOf(normItemName) !== -1 ||
          normItemName.indexOf(normCandidate) !== -1
        );
      });
      if (match) matchType = 'name';
    }

    return {
      email: itemEmail,
      name: itemName,
      id: item.id || null,
      slack_found: !!match,
      slack_id: match?.id || null,
      slack_name: match?.name || match?.display_name || null,
      slack_match_type: matchType,
    };
  });

  return enriched;
}

/**
 * Fetch active batches data from Notion
 * @returns {Promise<Array>} - Array of active batch records
 */
async function getActiveBatchesData() {
  let allRecords = [];
  let nextPageToken = undefined;

  do {
    const response = await notion.databases.query({
      database_id: Batches_Database_ID,
      start_cursor: nextPageToken,
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

    allRecords.push(...response.results);
    nextPageToken = response.next_cursor;
  } while (nextPageToken);

  const formattedRecords = [];

  for (const record of allRecords) {
    const timing_string = record.properties.Timings.rich_text[0]?.plain_text || '';
    const split_timing = timing_string.split(" ");

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
function matchMemberAvailabilityWithBatches(availability, batches) {
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
function parseAndNormalizeTiming(timingString) {
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

// ============================================================================
// ROUTES - RECORDS & CERTIFICATES
// ============================================================================

/**
 * Get records filtered by tier/hours
 */
app.get('/getRecords', async (req, res) => {
  const tier = req.query.tier?.toLowerCase();
  const hour = tierToHours[tier] || 0;
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    const filterArray = [
      {
        or: [
          {
            property: "Status",
            status: { equals: "Active" }
          },
          {
            property: "Status",
            status: { equals: "Unresponsive" }
          }
        ]
      },
      {
        property: "isAdmin",
        checkbox: { equals: false }
      },
      {
        property: "Total Hours",
        formula: { number: { greater_than_or_equal_to: hour } }
      },
      {
        property: "Total Hours",
        formula: { number: { less_than: tier === 'diamond' ? 1000000 : hour + 50 } }
      },
      {
        property: "Certificate Issued",
        multi_select: { does_not_contain: hour.toString() }
      },
      {
        property: "Team",
        multi_select: { is_not_empty: true }
      }
    ];

    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          and: filterArray
        },
        sorts: [
          {
            property: "Total Hours",
            direction: "ascending",
          },
        ],
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    const formattedRecords = allRecords.map(record => ({
      id: record.properties.ID.unique_id.number,
      name: record.properties.Names.title[0]?.plain_text || '',
      email: record.properties.Email.email || '',
      hours: record.properties["Total Hours"].formula.number || 0,
    }));

    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get member details
 */
app.get('/getDetails', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    const filterArray = [
      {
        or: [
          {
            property: "Status",
            status: { equals: "Active" }
          },
          {
            property: "Status",
            status: { equals: "Unresponsive" }
          }
        ]
      },
      {
        property: "Team",
        multi_select: { is_not_empty: true }
      },
      {
        property: "image",
        url: { is_not_empty: true }
      }
    ];

    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          and: filterArray
        },
        sorts: [
          {
            property: "Total Hours",
            direction: "ascending",
          },
        ],
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    allRecords = allRecords.filter(record => record.properties.Names.title[0].plain_text !== undefined);
    
    const formattedRecords = allRecords.map(record => ({
      id: record.properties.ID.unique_id.number,
      name: record.properties.Names.title[0]?.plain_text.trim() || '',
      email: record.properties.Email.email || '',
      team: record.properties.Team.multi_select[0].name ?? '',
      position: record.properties.Position.multi_select[0]?.name ?? null,
      location: record.properties.City.select?.name ?
        `${record.properties.City.select?.name}, ${record.properties.Country.select?.name}`
        :
        `${record.properties.Country.select?.name}`,
      image: (record.properties.image.url) ? record.properties.image.url.split("/view")[0].replace("/file/d/", "/thumbnail?id=") : '',
      cohort: record.properties.Cohort.select?.name,
    }));

    res.setHeader("Vercel-CDN-Cache-Control", "max-age=604800");
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get accepted members
 */
app.get('/getAccepted', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          or: [
            {
              property: "Status",
              status: {
                equals: "Accepted"
              },
            },
            {
              property: "Status",
              status: {
                equals: "Accepted / Pending Email"
              }
            }
          ],
        },
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    allRecords = allRecords.filter(record => record.properties.Names.title[0]?.plain_text !== undefined);

    const formattedRecords = allRecords.map(record => ({
      name: record.properties.Names.title[0]?.plain_text || '',
      email: record.properties.Email.email || '',
    }));
    formattedRecords.sort((a, b) => (a.name > b.name) ? 1 : -1);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching accepted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get accepted members with email sent over 2 weeks ago
 */
app.get('/getAcceptedEmailSent', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;
  let two_weeks = new Date(Date(Date.now() - 12096e5)).toISOString();

  try {
    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          and: [
            {
              property: "Status",
              status: {
                equals: "Acceptance Sent"
              },
            },
            {
              property: "Last edited time",
              "date": {
                on_or_before: two_weeks
              }
            }
          ],
        },
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    allRecords = allRecords.filter(record => record.properties.Names.title[0]?.plain_text !== undefined);

    const formattedRecords = allRecords.map(record => ({
      name: record.properties.Names.title[0]?.plain_text || '',
      email: record.properties.Email.email || '',
      date: record.properties['Last edited time'] || '',
      page_id: record.id
    }));
    formattedRecords.sort((a, b) => (a.name > b.name) ? 1 : -1);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching accepted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update non-compliant status
 */
app.post('/updateNonCompliant', async (req, res) => {
  const person = req.body;

  try {
    const updateResponse = await notion.pages.update({
      page_id: person.page_id,
      properties: {
        "Non Compliant": {
          rich_text: "Non Compliant",
        }
      }
    });
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating non-compliant status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get non-compliant members
 */
app.get('/getNonCompliant', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          and: [
            {
              property: "Non Compliant",
              rich_text: {
                is_not_empty: true,
              },
            },
            {
              property: "Status",
              status: {
                equals: "Application Email Sent",
              },
            }
          ],
        },
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    allRecords = allRecords.filter(record => record.properties.Names.title[0]?.plain_text !== undefined);

    const formattedRecords = allRecords.map(record => ({
      name: record.properties.Names.title[0]?.plain_text || '',
      email: record.properties.Email.email || '',
    }));
    formattedRecords.sort((a, b) => (a.name > b.name) ? 1 : -1);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching non-compliant records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all applicants with status "Application Received"
 */
app.get('/getApplicationReceived', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          property: "Status",
          status: {
            equals: "Application Received"
          }
        },
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    const formattedRecords = allRecords.map(record => ({
      name: record.properties.Names.title[0]?.plain_text || '',
      email: record.properties.Email.email || '',
      date_applied: record.properties["Date Applied"].date?.start || '',
      last_updated: record.properties["Last Edited Time"]?.last_edited_time || '',
      page_id: record.id,
    }));
    formattedRecords.sort((a, b) => (a.name > b.name) ? 1 : -1);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error fetching application received records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ROUTES - STATUS UPDATES
// ============================================================================

/**
 * Move email sent records to Active status
 * Expects: req.body = ["page-id-1", "page-id-2", ...]
 */
app.post('/moveEmailSent', async (req, res) => {
  const emailSentList = req.body;

  if (!Array.isArray(emailSentList) || emailSentList.length === 0) {
    return res.status(400).json({ error: 'Request body must be a non-empty array of page IDs.' });
  }

  const updatePromises = [];

  try {
    for (const pageId of emailSentList) {
      if (typeof pageId !== 'string' || pageId.trim() === '') {
        console.warn(`Invalid page ID: ${pageId}`);
        continue;
      }

      const updatePromise = notion.pages.update({
        page_id: pageId,
        properties: {
          Status: {
            status: {
              name: 'Active',
            },
          },
        },
      });
      updatePromises.push(updatePromise);
    }

    await Promise.all(updatePromises);
    return res.status(200).json({ message: 'Email Sent records moved successfully' });
  } catch (error) {
    console.error('Error moving Email Sent records:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Move accepted records to Acceptance Sent status
 */
app.post('/moveAccepted', async (req, res) => {
  const acceptedList = req.body;

  try {
    acceptedList.forEach(async (obj) => {
      const filterEmail = obj.email;
      const filterResponse = await notion.databases.query({
        database_id: Members_Database_ID,
        filter: {
          property: 'Email',
          rich_text: {
            equals: filterEmail,
          },
        },
      });
      record = filterResponse.results[0];
      if (record.properties.Status.status.name !== "Accepted / Pending Email") {
        console.log(`Record ${obj.name} already moved`);
      } else {
        const existingPageId = record.id;
        const updateResponse = await notion.pages.update({
          page_id: existingPageId,
          properties: {
            Status: {
              status: {
                name: 'Acceptance Sent',
              },
            },
          },
        });
      }
    });
    res.status(200).json({ message: 'Accepted records moved successfully' });
  } catch (error) {
    console.error('Error moving accepted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Submit availability times
 */
app.post('/submitTimes', async (req, res) => {
  const timeData = req.body;
  console.log(timeData);

  const SundaySlots = { multi_select: timeData.sunday.map((slot) => ({ name: slot })) };
  const MondaySlots = { multi_select: timeData.monday.map((slot) => ({ name: slot })) };
  const TuesdaySlots = { multi_select: timeData.tuesday.map((slot) => ({ name: slot })) };
  const WednesdaySlots = { multi_select: timeData.wednesday.map((slot) => ({ name: slot })) };
  const ThursdaySlots = { multi_select: timeData.thursday.map((slot) => ({ name: slot })) };
  const FridaySlots = { multi_select: timeData.friday.map((slot) => ({ name: slot })) };
  const SaturdaySlots = { multi_select: timeData.saturday.map((slot) => ({ name: slot })) };

  const filterEmail = timeData.email;

  const filterResponse = await notion.databases.query({
    database_id: Members_Database_ID,
    filter: {
      property: 'Email',
      rich_text: {
        equals: filterEmail,
      },
    },
  });

  if (filterResponse.results.length > 0) {
    const existingPageId = filterResponse.results[0].id;

    const updateResponse = await notion.pages.update({
      page_id: existingPageId,
      properties: {
        Monday: MondaySlots,
        Tuesday: TuesdaySlots,
        Wednesday: WednesdaySlots,
        Thursday: ThursdaySlots,
        Friday: FridaySlots,
        Saturday: SaturdaySlots,
        Sunday: SundaySlots,
      },
    });

    res.send(updateResponse);
  } else {
    res.status(400).send({ error: "Email not found" });
  }
});

/**
 * Issue certificates to members
 */
app.post('/issueCertificates', async (req, res) => {
  let { names, tier } = req.body;

  if (!Array.isArray(names) || typeof tier !== 'string') {
    return res.status(400).json({ error: 'Invalid request body. Expected { names: string[], tier: string }' });
  }

  tier = tier.toLowerCase();
  const results = [];

  for (const name of names) {
    try {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        filter: {
          property: 'Names',
          title: {
            equals: name
          }
        }
      });

      if (response.results.length === 0) {
        results.push({ name, status: 'not found' });
        continue;
      }

      const page = response.results[0];
      const pageId = page.id;
      const currentCertificates = page.properties['Certificate Issued'].multi_select.map(opt => opt.name);

      if (!currentCertificates.includes(tier)) {
        currentCertificates.push(tier);
      }

      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Certificate Issued': {
            multi_select: currentCertificates.map(name => ({ name }))
          }
        }
      });

      results.push({ name, status: 'updated' });
    } catch (error) {
      results.push({ name, status: 'error', error: error.message });
    }
  }

  res.status(200).json({ results });
});

/**
 * Add "Interview Email Sent" to Status property
 */
app.post('/addInterviewStatus', async (req, res) => {
  try {
    const db = await notion.databases.retrieve({ database_id: Members_Database_ID });

    const existingOptions = db.properties.Status.status.options.map(opt => ({
      name: opt.name,
      color: opt.color || 'default',
    }));

    const newOptionName = "Interview Email Sent";
    const alreadyExists = existingOptions.some(opt => opt.name === newOptionName);

    if (alreadyExists) {
      return res.status(200).json({ message: `"${newOptionName}" already exists` });
    }

    existingOptions.push({ name: newOptionName, color: "orange" });

    await notion.databases.update({
      database_id: Members_Database_ID,
      properties: {
        Status: {
          status: {
            options: existingOptions,
          },
        },
      },
    });

    res.status(200).json({ message: `✅ Added "${newOptionName}" to Status property.` });
  } catch (error) {
    console.error("Error adding new status option:", error);
    res.status(500).json({ error: "Failed to add new Status option", details: error.message });
  }
});

// ============================================================================
// ROUTES - MEMBERS & BATCHES
// ============================================================================

/**
 * Get unassigned members with Slack data and matching batches
 */
app.get('/getUnassignedMembers', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;

  try {
    // Step 1: Fetch unassigned members from Notion
    do {
      const response = await notion.databases.query({
        database_id: Members_Database_ID,
        start_cursor: nextPageToken,
        filter: {
          and: [
            {
              or: [
                {
                  property: "Status",
                  status: { equals: "Active" },
                },
                {
                  property: "Status",
                  status: { equals: "Unresponsive" },
                },
              ],
            },
            {
              property: "Batch Status",
              status: { equals: "Unassigned" },
            },
            {
              property: "isAdmin",
              checkbox: { equals: false },
            },
          ],
        }
      });

      allRecords.push(...response.results);
      nextPageToken = response.next_cursor;
    } while (nextPageToken);

    const formattedRecords = allRecords.map(record => ({
      id: record.id,
      name: record.properties.Names.title[0]?.plain_text.trim() || '',
      email: record.properties.Email.email || '',
      team: record.properties.Team.multi_select[0]?.name ?? '',
      cohort: record.properties.Cohort.select?.name,
      batch_status: record.properties["Batch Status"].status.name || '',
      availability: {
        monday: record.properties.Monday.multi_select.map(slot => slot.name) || [],
        tuesday: record.properties.Tuesday.multi_select.map(slot => slot.name) || [],
        wednesday: record.properties.Wednesday.multi_select.map(slot => slot.name) || [],
        thursday: record.properties.Thursday.multi_select.map(slot => slot.name) || [],
        friday: record.properties.Friday.multi_select.map(slot => slot.name) || [],
        saturday: record.properties.Saturday.multi_select.map(slot => slot.name) || [],
        sunday: record.properties.Sunday.multi_select.map(slot => slot.name) || [],
      }
    }));

    // Step 2: Enrich with Slack data
    const enrichedRecords = await enrichNotionRecordsWithSlack(formattedRecords);

    // Step 3: Fetch active batches
    const activeBatches = await getActiveBatchesData();

    // Step 4: Match each member with compatible batches
    const finalRecords = enrichedRecords.map(member => {
      const matchingBatches = matchMemberAvailabilityWithBatches(
        formattedRecords.find(r => r.id === member.id)?.availability || {},
        activeBatches
      );

      return {
        ...member,
        team: formattedRecords.find(r => r.id === member.id)?.team,
        cohort: formattedRecords.find(r => r.id === member.id)?.cohort,
        batch_status: formattedRecords.find(r => r.id === member.id)?.batch_status,
        availability: formattedRecords.find(r => r.id === member.id)?.availability,
        matching_batches: matchingBatches,
      };
    });

    res.status(200).json(finalRecords);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

// ============================================================================
// ROUTES - SLACK INTEGRATION
// ============================================================================

/**
 * Get all Slack members
 */
app.get('/getSlackMembers', async (req, res) => {
  try {
    const members = await fetchSlackUsers();
    res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching Slack members:', error);
    res.status(500).json({ error: 'Internal server error while fetching Slack members' });
  }
});

/**
 * Get active batches
 */
app.get('/getActiveBatches', async (req, res) => {
  try {
    const formattedRecords = await getActiveBatchesData();
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error('Error processing notion data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Accept notion-like records in the body and return enriched with Slack data
 */
app.post('/getSlackMembersFromNotion', async (req, res) => {
  const notionData = req.body;

  if (!Array.isArray(notionData)) {
    return res.status(400).json({ error: 'Request body must be an array of notion records (formattedRecords style).' });
  }

  try {
    const enriched = await enrichNotionRecordsWithSlack(notionData);
    res.status(200).json(enriched);
  } catch (error) {
    console.error('Error processing notion data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Send direct message to a Slack member
 */
app.post('/sendSlackMemberDM', async (req, res) => {
  const { slack_id, message } = req.body;

  if (!slack_id || !message) {
    return res.status(400).json({ error: 'Request body must contain slack_id and message.' });
  }

  try {
    const { channel } = await slack.conversations.open({ users: slack_id });

    const request = await slack.chat.postMessage({
      channel: "U084VM2EEDV",
      text: message,
    });

    res.status(200).json({ message: 'Message sent successfully.', request });
  } catch (error) {
    console.error('Error sending Slack DM:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

// ============================================================================
// EXPORTS
// ============================================================================

export default app;
