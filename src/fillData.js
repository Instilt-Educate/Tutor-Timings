import { Client } from '@notionhq/client'
import { getTimes } from './home.js';

const notion = new Client({ 
  auth: process.env.API_KEY,
  fetch: 'https://corsproxy.io/'
});

async function makePage(){
  var databaseId = "f3b4e539d8a0482eb512457311b0bd75"
  var name = document.getElementById("person-name").value;
  var email = document.getElementById("person-email").value;
  if (name == "" || email == "") {
    alert("Please enter your name and email!");
    return;
  }
  const timeData = getTimes(name, email);
  
  console.log(timeData);

  const response = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: 'AYUSH TEST',
            },
          },
        ],
      },
        Sunday: {
          multi_select: [
            {
              name: "10:00 AM - 11:00 AM",
            },
            {
              name: "11:00 AM - 12:00 PM",
            },
            {
              name: "12:00 PM - 1:00 PM",
            }

          ],
        },
    },
  });


  return response;
};

export { makePage };