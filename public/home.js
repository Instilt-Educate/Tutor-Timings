var script = document.createElement('script');
document.getElementsByTagName('head')[0].appendChild(script);

if(document.getElementById('submit') != null) {document.getElementById("submit").addEventListener("click", getData);
}

/*allow highlighting of each time-slot */
$(document).ready(function() {
  var $box = $('.time-box').mousedown(function() {
    $(this).toggleClass('time-box-highlight');
    var flag = $(this).hasClass('time-box-highlight');
    $box.on('mouseenter.highlight', function() {
      $(this).toggleClass('time-box-highlight', flag);
    });
  });
  $(document).mouseup(function() {
    $box.off('mouseenter.highlight')
  });
});

/* when the button is pressed, submit the person's availability to a google app scripts project */
function getTimes(name, email) {
  var name = document.getElementById("person-name").value;
  var email = document.getElementById("person-email").value;
  if (name == "" || email == "") {
      alert("Please enter your name and email!");
      return;
  }

  var myObj = {
    name: name,
    email: email,
  };

  var highlightColor = "rgb(112, 0, 0)";
  var baseColor = "rgb(220,53,69)";

  ///// Parse Schedule Data into parsedData(2D array) an array containing an array for each day of the week
  // Each day array contains whether or not the hour is highlighted with a boolean value
  var parsedData = [];
  var cols = document.getElementsByClassName("home-container-columns");
  for (var j = 0; j < cols.length; j++) {
    var column = [];
    var divArray = cols[j].getElementsByTagName("div");
    for (var i = 0; i < divArray.length; i++) {
      var color = window
        .getComputedStyle(divArray[i])
        .getPropertyValue("background-color");
      column.push(color === highlightColor);
    }
    parsedData.push(column);
    
  } //// END DATA PARSE

  const allTimes = [
    '12:00 AM - 01:00 AM', '01:00 AM - 02:00 AM', '02:00 AM - 03:00 AM', '03:00 AM - 04:00 AM',
    '04:00 AM - 05:00 AM', '05:00 AM - 06:00 AM', '06:00 AM - 07:00 AM', '07:00 AM - 08:00 AM',
    '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM', '07:00 PM - 08:00 PM',
    '08:00 PM - 09:00 PM', '09:00 PM - 10:00 PM', '10:00 PM - 11:00 PM', '11:00 PM - 12:00 AM'
  ];

  // filter out empty arrays
  parsedData = parsedData.filter((day) => day.some((hour) => hour));
  // Parses JSON data from schedule data
  for (var day = 0; day < parsedData.length; day++) {
    var dayData = parsedData[day];

    var hourData = [];
    for (let i = 0; i < dayData.length; i++) {
      if (dayData[i]) {
        hourData.push(allTimes[i]);
      }
    }
    myObj[getDay(day-1)] = hourData;
  }

  return myObj;
}


function hourToMilitary(hour) {
  return hour * 100;
}

function getDay(num) {
  if (num == 0) return "sunday";
  if (num == 1) return "monday";
  if (num == 2) return "tuesday";
  if (num == 3) return "wednesday";
  if (num == 4) return "thursday";
  if (num == 5) return "friday";
  if (num == 6) return "saturday";
}

async function getData(){
  console.log(getTimes());
  const res = await fetch('https://tutor-timings.vercel.app/submitTimes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(getTimes())
  });
  const data = await res.json();
  alert("Your availabilities have been submitted!")
  // refresh page
  window.location.reload();
}


/* READ
    sendData(data) takes in the *JSON object,
    and is sent to a google apps scripts project thats deployed as a web app via
    a post request with the JSON object in a text form in the body of the request
    The app scripts project is connected to a google sheet which takes in the JSON
    and formats it to the google sheet. 
    An nonproduction copy of the google sheet is linked:
    https://docs.google.com/spreadsheets/d/1CP3PBlQuo9TESws-w-PZQgOlwf8OucYV3HLSwrebPsI/edit?usp=sharing

        App scripts project is in the google sheet under extensions->App scripts
        Instructions for implementing a production copy of the sheet and app script 
        is laid out in the app script main file

    *JSON object in format of:
    name is string
    days of weeks contain arrays of availibity objects
    {"start":time, "end": time} where time is an integer in the military time format,
    e.g 0000 0100 0230 1230 1545 2130 2400 in IST time zone
    {
        "name": "Christopher Espitia-Alvarez",
        "monday": [
            {"start": 830,
            "end": 1130}
        ],
        "sunday": [
            {"start": 1200,
            "end": 1500},
            {"start": 1800,
            "end": 2100}
        ]
    }
*/
function sendData(data){
    var url = "https://script.google.com/macros/s/AKfycbywn01yLknTeaRDIhjGzaXtouNx6Yywx_f34hbIZuIT0bB-SYR8gWkCUNjPbwS9DGW3/exec"
    //This url is the test google app scripts project, change to the real url when there is a production app scripts made
    console.log(data);
    fetch(url, {
        redirect: "follow",
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
        },
        })
}
