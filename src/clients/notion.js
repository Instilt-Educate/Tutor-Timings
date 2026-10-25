import { Client } from '@notionhq/client';
import 'dotenv/config';

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

/**
 * Query a Notion database, following pagination until all results are fetched
 * @param {Object} params - Parameters for notion.databases.query (without start_cursor)
 * @returns {Promise<Array>} - All result pages
 */
export async function queryAllPages(params) {
  const allRecords = [];
  let nextPageToken = undefined;

  do {
    const response = await notion.databases.query({
      ...params,
      start_cursor: nextPageToken,
    });

    allRecords.push(...response.results);
    nextPageToken = response.next_cursor;
  } while (nextPageToken);

  return allRecords;
}
