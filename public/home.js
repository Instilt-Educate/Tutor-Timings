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

  // Parses JSON data from schedule data
  for (var day = 1; day < 8; day++) {
    var dayData = parsedData[day];

    var hourData = [];
    for (let i = 0; i < dayData.length; i++) {
      if (dayData[i]) {
        hourData.push(allTimes[i]);
      }
    }
    myObj[getDay(day - 1)] = hourData;
  }

  return myObj;
}


function hourToMilitary(hour) {
  return hour * 100;
}

function getDay(num) {
  // use an array and index
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][num];
}

async function getData(){

  const res = await fetch('https://tutor-timings.vercel.app/submitTimes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(getTimes())
  });
  if (res.status === 400){
    alert("That email does not exist in the database, please try again! Contact someone from HR if you are unsure what email you used to sign up.")
  }
  else{
    const data = await res.json();
    alert("Your availabilities have been submitted!")
    // refresh page
    window.location.reload();
  }
  
}
