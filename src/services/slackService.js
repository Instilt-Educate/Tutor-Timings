import { slack } from '../clients/slack.js';
import { normalizeForMatch } from '../utils/text.js';

/**
 * Fetch Slack users from Slack API and return mapped results
 */
export async function fetchSlackUsers() {
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
 * Enrich Notion records with Slack data by matching email or name
 * @param {Array} notionRecords - Array of objects with { email, name, id, ... }
 * @returns {Promise<Array>} - Array of enriched records with Slack data
 */
export async function enrichNotionRecordsWithSlack(notionRecords) {
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
 * Send a direct message to a Slack member
 */
export async function sendSlackMemberDM(slackId, message) {
  const { channel } = await slack.conversations.open({ users: slackId });

  return slack.chat.postMessage({
    channel: channel.id,
    text: message,
  });
}
