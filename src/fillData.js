import { Client } from '@notionhq/client'
import { getTimes } from './home.js';

const notion = new Client({ auth: process.env.API_KEY  });

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
  return;

  const response = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: "Ayush R",
            },
          },
        ],
      },
        Sunday: {
          multi_select: [
            {
              name: "10:00 AM - 11:00 AM",
            },
          ],
        },
    },
  });

  return response;
};

export { makePage };