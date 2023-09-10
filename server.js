const express = require('express');
const makePage = require('./public/fillData.js');
const port = process.env.PORT || 3000;

const app = express();

app.use(express.static('public'));

app.get('/submitTimes', (req, res) => {
    // get json data from req
    // send to notion
    // send back response
    const data = req.body;
    console.log(data);
    const response = makePage(data);
    res.send(response);
     
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`)
});