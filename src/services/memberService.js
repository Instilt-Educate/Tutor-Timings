import { notion, queryAllPages } from '../clients/notion.js';
import { Members_Database_ID, tierToHours, Award_Tiers_Database_ID } from '../config/index.js';
import { enrichNotionRecordsWithSlack } from './slackService.js';
import { getActiveBatchesData, matchMemberAvailabilityWithBatches } from './batchService.js';

const byName = (a, b) => (a.name > b.name) ? 1 : -1;
const hasName = record => record.properties.Names.title[0]?.plain_text !== undefined;

/**
 * Gets Active Award Tiers
 */
export async function getAwardTiers() {
  const allRecords = await queryAllPages({
    database_id: Award_Tiers_Database_ID,
    filter: {
      property: "Active",
      checkbox: {equals: true}
    },
    sorts: [{
      property: "Sort Order",
      direction: "ascending"
    }]
  });

  return allRecords.map(record => ({
    page_id: record.id,
    name: record.properties["Name"].title[0]?.plain_text || '',
    key: record.properties["Key"].rich_text[0]?.plain_text || '',
    min_hours: record.properties["Minimum Hours"].number,
    max_hours: record.properties["Maximum Hours"].number,           // may be null for the top tier
    sort_order: record.properties["Sort Order"].number,
  }));
}

async function getMatchingTierInfo(tier){
  const alltiers = await getAwardTiers();
  const matchingTier = alltiers.find(t => t.key?.toLowerCase() === tier)

  return matchingTier;
}

/**
 * Get records filtered by tier/hours
 * 
 * Excludes members already having an award for the tier. 
 */
export async function getRecordsByTier(tierParam) {
  const matchingTier = await getMatchingTierInfo(tierParam);
  
  if(!matchingTier) return null;

  const minHours = matchingTier.min_hours;
  const maxHours = matchingTier.max_hours;

  const conditions = [
    {
      or: [
        { property: "Status", status: { equals: "Active" } },
        { property: "Status", status: { equals: "Unresponsive" } }
      ]
    },
    {
      property: "isAdmin",
      checkbox: { equals: false }
    },
    {
      property: "Total Hours",
      formula: { number: { greater_than_or_equal_to: minHours } }
    },
    {
      property: "Certificates Awarded",
      relation: { does_not_contain: matchingTier.page_id }
    },
    {
      property: "Team",
      multi_select: { is_not_empty: true }
    }
  ];

  if(maxHours != null){
    conditions.push({
          property: "Total Hours",
          formula: { number: { less_than: maxHours } }
        });
  }

  const allRecords = await queryAllPages({
    database_id: Members_Database_ID,
    filter: {
      and: conditions
    },
    sorts: [
      {
        property: "Total Hours",
        direction: "ascending",
      },
    ],
  });

  return allRecords.map(record => ({
    id: record.properties.ID.unique_id.number,
    name: record.properties.Names.title[0]?.plain_text || '',
    email: record.properties.Email.email || '',
    hours: record.properties["Total Hours"].formula.number || 0,
  }));
}

/**
 * Get member details
 */
export async function getMemberDetails() {
  let allRecords = await queryAllPages({
    database_id: Members_Database_ID,
    filter: {
      and: [
        {
          or: [
            { property: "Status", status: { equals: "Active" } },
            { property: "Status", status: { equals: "Unresponsive" } }
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
      ]
    },
    sorts: [
      {
        property: "Total Hours",
        direction: "ascending",
      },
    ],
  });

  allRecords = allRecords.filter(record => record.properties.Names.title[0].plain_text !== undefined);

  return allRecords.map(record => ({
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
}

/**
 * Get accepted members
 */
export async function getAcceptedMembers() {
  let allRecords = await queryAllPages({
    database_id: Members_Database_ID,
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

  allRecords = allRecords.filter(hasName);

  const formattedRecords = allRecords.map(record => ({
    name: record.properties.Names.title[0]?.plain_text || '',
    email: record.properties.Email.email || '',
  }));
  formattedRecords.sort(byName);
  return formattedRecords;
}

/**
 * Get accepted members with email sent over 2 weeks ago
 */
export async function getAcceptedEmailSentMembers() {
  let two_weeks = new Date(Date(Date.now() - 12096e5)).toISOString();

  let allRecords = await queryAllPages({
    database_id: Members_Database_ID,
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

  allRecords = allRecords.filter(hasName);

  const formattedRecords = allRecords.map(record => ({
    name: record.properties.Names.title[0]?.plain_text || '',
    email: record.properties.Email.email || '',
    date: record.properties['Last edited time'] || '',
    page_id: record.id
  }));
  formattedRecords.sort(byName);
  return formattedRecords;
}

/**
 * Mark a member as non-compliant
 */
export async function markNonCompliant(pageId) {
  return notion.pages.update({
    page_id: pageId,
    properties: {
      "Non Compliant": {
        rich_text: "Non Compliant",
      }
    }
  });
}

/**
 * Get non-compliant members
 */
export async function getNonCompliantMembers() {
  let allRecords = await queryAllPages({
    database_id: Members_Database_ID,
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

  allRecords = allRecords.filter(hasName);

  const formattedRecords = allRecords.map(record => ({
    name: record.properties.Names.title[0]?.plain_text || '',
    email: record.properties.Email.email || '',
  }));
  formattedRecords.sort(byName);
  return formattedRecords;
}

/**
 * Get all applicants with status "Application Received"
 */
export async function getApplicationReceivedMembers() {
  const allRecords = await queryAllPages({
    database_id: Members_Database_ID,
    filter: {
      property: "Status",
      status: {
        equals: "Application Received"
      }
    },
  });

  const formattedRecords = allRecords.map(record => ({
    name: record.properties.Names.title[0]?.plain_text || '',
    email: record.properties.Email.email || '',
    date_applied: record.properties["Date Applied"].date?.start || '',
    last_updated: record.properties["Last Edited Time"]?.last_edited_time || '',
    page_id: record.id,
  }));
  formattedRecords.sort(byName);
  return formattedRecords;
}

/**
 * Move email sent records to Active status
 * @param {Array<string>} pageIds
 */
export async function moveEmailSentToActive(pageIds) {
  const updatePromises = [];

  for (const pageId of pageIds) {
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
}

/**
 * Move accepted records to Acceptance Sent status
 * Note: updates run in the background and are not awaited (matches prior behavior)
 */
export function moveAcceptedToAcceptanceSent(acceptedList) {
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
}

/**
 * Submit availability times for a member
 * @returns {Promise<Object|null>} - Updated page, or null if the email was not found
 */
export async function submitAvailabilityTimes(timeData) {
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

  if (filterResponse.results.length === 0) return null;

  const existingPageId = filterResponse.results[0].id;

  return notion.pages.update({
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
}

/**
 * Issue certificates of the given tier to members by linking the tier's page
 * to each member's "Certificates Awarded" relation
 * @param {Array<string>} names - Member names
 * @param {string} tierKey - Award tier key (e.g. "bronze_1")
 * @returns {Promise<Array|null>} - Per-member result entries, or null if the tier key is unknown
 */
export async function issueCertificates(names, tierKey) {
  const allTiers = await getAwardTiers();
  const matchingTier = allTiers.find(t => t.key?.toLowerCase() === tierKey.toLowerCase());

  if (!matchingTier) return null;

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
      const currentCertificateIds = page.properties['Certificates Awarded'].relation.map(rel => rel.id);

      if (!currentCertificateIds.includes(matchingTier.page_id)) {
        currentCertificateIds.push(matchingTier.page_id);
      }

      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Certificates Awarded': {
            relation: currentCertificateIds.map(id => ({ id }))
          }
        }
      });

      results.push({ name, status: 'updated' });
    } catch (error) {
      results.push({ name, status: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Add "Interview Email Sent" to Status property
 * @returns {Promise<{ name: string, added: boolean }>}
 */
export async function addInterviewStatusOption() {
  const db = await notion.databases.retrieve({ database_id: Members_Database_ID });

  const existingOptions = db.properties.Status.status.options.map(opt => ({
    name: opt.name,
    color: opt.color || 'default',
  }));

  const newOptionName = "Interview Email Sent";
  const alreadyExists = existingOptions.some(opt => opt.name === newOptionName);

  if (alreadyExists) {
    return { name: newOptionName, added: false };
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

  return { name: newOptionName, added: true };
}

/**
 * Get unassigned members with Slack data and matching batches
 */
export async function getUnassignedMembers() {
  // Step 1: Fetch unassigned members from Notion
  const allRecords = await queryAllPages({
    database_id: Members_Database_ID,
    filter: {
      and: [
        {
          or: [
            { property: "Status", status: { equals: "Active" } },
            { property: "Status", status: { equals: "Unresponsive" } },
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
  return enrichedRecords.map(member => {
    const original = formattedRecords.find(r => r.id === member.id);

    return {
      ...member,
      team: original?.team,
      cohort: original?.cohort,
      batch_status: original?.batch_status,
      availability: original?.availability,
      matching_batches: matchMemberAvailabilityWithBatches(original?.availability || {}, activeBatches),
    };
  });
}
