const express = require('express');
const path = require('path');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json())

app.use(express.static(path.join('../public')));

const notion = new Client({ 
    auth: process.env.API_KEY,
});

app.post('/submitTimes', async (req, res) => {
    // get json data from req
    // send to notion
    // send back response
    const timeData = req.body;
    console.log(timeData);
    var databaseId = "f3b4e539d8a0482eb512457311b0bd75"
    const SundaySlots = {multi_select: timeData.sunday.map((slot) => ({name: slot,})),};
    const MondaySlots = {multi_select: timeData.monday.map((slot) => ({name: slot,})),};
    const TuesdaySlots = {multi_select: timeData.tuesday.map((slot) => ({name: slot,})),};
    const WednesdaySlots = {multi_select: timeData.wednesday.map((slot) => ({name: slot,})),};
    const ThursdaySlots = {multi_select: timeData.thursday.map((slot) => ({name: slot,})),};
    const FridaySlots = {multi_select: timeData.friday.map((slot) => ({name: slot,})),};
    const SaturdaySlots = {multi_select: timeData.saturday.map((slot) => ({name: slot,})),};

    const response = await notion.pages.create({
        parent: {
            database_id: databaseId,
        },
        properties: {
            Name: {
                title: [
                {
                    text: {
                        content: timeData.name,
                    },
                },
                ],
            },
            Email: {
                rich_text: [
                {
                    text: {
                        content: timeData.email,
                    },
                },
                ]
            },
            Monday: MondaySlots,
            Tuesday: TuesdaySlots,
            Wednesday: WednesdaySlots,
            Thursday: ThursdaySlots,
            Friday: FridaySlots,
            Saturday: SaturdaySlots,
            Sunday: SundaySlots,
        },
    });
    res.send(response);
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`)
});

module.exports = app;