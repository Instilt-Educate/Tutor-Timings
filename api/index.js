import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Client } from '@notionhq/client';
import cors from 'cors';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.PORT || 3000;
const DATABASE_ID = process.env.DATABASE_ID;
const app = express();
export const maxDuration = 60;

app.use(cors());
app.use(express.json())

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const notion = new Client({ 
    auth: process.env.API_KEY,
});

const tierToHours = {
  'bronze': 50,
  'silver': 100,
  'gold': 150,
  'platinum': 200,
  'diamond': 250,
}

app.get('/getRecords', async (req, res) => {
  
  // const hour = parseInt(req.query.hour);
  const tier = req.query.tier?.toLowerCase();
  const hour = tierToHours[tier] || 0; // Default to 0 if tier is not found
  let allRecords = [];
  let nextPageToken = undefined;
  try {
      // Build filter array dynamically
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
          formula: { number: { greater_than_or_equal_to : hour } }
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
          database_id: DATABASE_ID,
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

      // remove empty records
      // allRecords = allRecords.filter(record => record.properties.Names.title[0]?.plain_text !== undefined);
      const formattedRecords = allRecords.map(record => ({
        id: record.properties.ID.unique_id.number,
        name: record.properties.Names.title[0]?.plain_text || '',
        email: record.properties.Email.email || '',
        hours: record.properties["Total Hours"].formula.number || 0,
      }));
      // formattedRecords.sort((a, b) => (a.hours > b.hours) ? 1 : -1);
      res.status(200).json(formattedRecords);
    } catch (error) {
      console.error('Error fetching database records:', error);
      res.status(500).json({ error: 'Internal server error, please contact Tech Ops' }); // Set HTTP status code to 500 (Internal Server Error) for any unexpected errors
    }
});

app.get('/getDetails', async (req, res) => {

  let allRecords = [];
  let nextPageToken = undefined;
  try {
      // Build filter array dynamically
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
        }
      ];
      do {
        const response = await notion.databases.query({
          database_id: DATABASE_ID,
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

      // remove empty records
      // allRecords = allRecords.filter(record => record.properties.Names.title[0]?.plain_text !== undefined);
      //let realFormattedRecords = [];

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
      }));
      
      res.status(200).json(formattedRecords);
    } catch (error) {
      console.error('Error fetching database records:', error);
      res.status(500).json({ error: 'Internal server error, please contact Tech Ops' }); // Set HTTP status code to 500 (Internal Server Error) for any unexpected errors
    }
});

app.get('/getAccepted', async (req, res) => {
  let allRecords = [];
  let nextPageToken = undefined;
  try {
      do {
        const response = await notion.databases.query({
          database_id: DATABASE_ID,
          start_cursor: nextPageToken,
          // filter by status Active, Unresponsive, Joined
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
      allRecords = allRecords.filter(record => record.properties.Name.title[0]?.plain_text !== undefined);
      
      const formattedRecords = allRecords.map(record => ({
        name: record.properties.Name.title[0]?.plain_text || '',
        email: record.properties.Email.email || '',
      }));
      formattedRecords.sort((a, b) => (a.name > b.name) ? 1 : -1);
      res.status(200).json(formattedRecords);

    } catch (error) {
      console.error('Error fetching accepted records:', error);
      res.status(500).json({ error: 'Internal server error' }); // Set HTTP status code to 500 (Internal Server Error) for any unexpected errors
    }
  }

)

app.post('/moveAccepted', async (req, res) => {
  const acceptedList = req.body;
  try {
    acceptedList.forEach(async (obj) => {
      const filterEmail = obj.email;
      const filterResponse = await notion.databases.query({
        database_id: DATABASE_ID,
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
      }
      else {
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
  }
  catch (error) {
    console.error('Error moving accepted records:', error);
    res.status(500).json({ error: 'Internal server error' }); // Set HTTP status code to 500 (Internal Server Error) for any unexpected errors
  }
  
});

app.post('/submitTimes', async (req, res) => {
    // get json data from req
    // send to notion
    // send back response
    const timeData = req.body;
    console.log(timeData);
    
    const SundaySlots = {multi_select: timeData.sunday.map((slot) => ({name: slot,})),};
    const MondaySlots = {multi_select: timeData.monday.map((slot) => ({name: slot,})),};
    const TuesdaySlots = {multi_select: timeData.tuesday.map((slot) => ({name: slot,})),};
    const WednesdaySlots = {multi_select: timeData.wednesday.map((slot) => ({name: slot,})),};
    const ThursdaySlots = {multi_select: timeData.thursday.map((slot) => ({name: slot,})),};
    const FridaySlots = {multi_select: timeData.friday.map((slot) => ({name: slot,})),};
    const SaturdaySlots = {multi_select: timeData.saturday.map((slot) => ({name: slot,})),};

    const filterEmail = timeData.email;

    // Check if a page with the same email already exists
    const filterResponse = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Email', 
        rich_text: {
          equals: filterEmail,
        },
      },
    });

    if (filterResponse.results.length > 0) {
      // If a page with the same email exists, update it
      const existingPageId = filterResponse.results[0].id;
      
      const updateResponse = await notion.pages.update({
        page_id: existingPageId,
        properties: {
          // Update the properties you want to change
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
    }
    else{
      res.status(400).send({error:"Email not found"});
    } 
});

app.post('/issueCertificates', async (req, res) => {
  let { names, tier } = req.body;
  if (!Array.isArray(names) || typeof tier !== 'string') {
    return res.status(400).json({ error: 'Invalid request body. Expected { names: string[], tier: string }' });
  }

  tier = tier.toLowerCase();

  const results = [];

  for (const name of names) {
    try {
      // Search for the record by name
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
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
      // Get current certificate issued values
      const currentCertificates = page.properties['Certificate Issued'].multi_select.map(opt => opt.name);
      // Add the tier if not already present
      if (!currentCertificates.includes(tier)) {
        currentCertificates.push(tier);
      }
      // Update the page
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

app.listen(port, () => {
    console.log(`Server started on port ${port}`)
});

export default app;
