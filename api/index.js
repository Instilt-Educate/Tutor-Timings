// ============================================================================
// IMPORTS
// ============================================================================
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import 'dotenv/config';

import { port } from '../src/config/index.js';
import * as memberService from '../src/services/memberService.js';
import * as batchService from '../src/services/batchService.js';
import * as slackService from '../src/services/slackService.js';

// ============================================================================
// CONFIGURATION
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const maxDuration = 60;

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
// ROUTES - RECORDS & CERTIFICATES
// ============================================================================

/**
 * Get the active award tiers
 */
app.get('/getAwardTiers', async (req, res) => {
  try{
    const records = await memberService.getAwardTiers();
    res.status(200).json(records);
  } catch (error){
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get records filtered by tier/hours
 */
app.get('/getRecords', async (req, res) => {
  try {
    const records = await memberService.getRecordsByTier(req.query.tier);

    if(records == null){
      return res.status(404).json({error: "Tier not found, please provide a valid key"});
    }

    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get member details
 */
app.get('/getDetails', async (req, res) => {
  try {
    const records = await memberService.getMemberDetails();
    res.setHeader("Vercel-CDN-Cache-Control", "max-age=604800");
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get accepted members
 */
app.get('/getAccepted', async (req, res) => {
  try {
    const records = await memberService.getAcceptedMembers();
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching accepted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get accepted members with email sent over 2 weeks ago
 */
app.get('/getAcceptedEmailSent', async (req, res) => {
  try {
    const records = await memberService.getAcceptedEmailSentMembers();
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching accepted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update non-compliant status
 */
app.post('/updateNonCompliant', async (req, res) => {
  try {
    await memberService.markNonCompliant(req.body.page_id);
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
  try {
    const records = await memberService.getNonCompliantMembers();
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching non-compliant records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all applicants with status "Application Received"
 */
app.get('/getApplicationReceived', async (req, res) => {
  try {
    const records = await memberService.getApplicationReceivedMembers();
    res.status(200).json(records);
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

  try {
    await memberService.moveEmailSentToActive(emailSentList);
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
  try {
    memberService.moveAcceptedToAcceptanceSent(req.body);
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
  console.log(req.body);

  const updatedPage = await memberService.submitAvailabilityTimes(req.body);

  if (updatedPage) {
    res.send(updatedPage);
  } else {
    res.status(400).send({ error: "Email not found" });
  }
});

/**
 * Issue certificates to members
 */
app.post('/issueCertificates', async (req, res) => {
  const { names, tier } = req.body;

  if (!Array.isArray(names) || typeof tier !== 'string') {
    return res.status(400).json({ error: 'Invalid request body. Expected { names: string[], tier: string }' });
  }

  try {
    const results = await memberService.issueCertificates(names, tier);

    if (results === null) {
      return res.status(404).json({ error: 'Tier not found, please provide a valid key' });
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error issuing certificates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Add "Interview Email Sent" to Status property
 */
app.post('/addInterviewStatus', async (req, res) => {
  try {
    const { name, added } = await memberService.addInterviewStatusOption();

    if (!added) {
      return res.status(200).json({ message: `"${name}" already exists` });
    }

    res.status(200).json({ message: `✅ Added "${name}" to Status property.` });
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
  try {
    const records = await memberService.getUnassignedMembers();
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching database records:', error);
    res.status(500).json({ error: 'Internal server error, please contact Tech Ops' });
  }
});

/**
 * Get active batches
 */
app.get('/getActiveBatches', async (req, res) => {
  try {
    const records = await batchService.getActiveBatchesData();
    res.status(200).json(records);
  } catch (error) {
    console.error('Error processing notion data:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    const members = await slackService.fetchSlackUsers();
    res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching Slack members:', error);
    res.status(500).json({ error: 'Internal server error while fetching Slack members' });
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
    const enriched = await slackService.enrichNotionRecordsWithSlack(notionData);
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
    const request = await slackService.sendSlackMemberDM(slack_id, message);
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
