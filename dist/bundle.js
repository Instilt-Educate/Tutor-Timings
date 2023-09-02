/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/fillData.js":
/*!*************************!*\
  !*** ./src/fillData.js ***!
  \*************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   makePage: () => (/* binding */ makePage)\n/* harmony export */ });\n/* harmony import */ var https_cdn_jsdelivr_net_npm_notionhq_client_2_2_13_esm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! https://cdn.jsdelivr.net/npm/@notionhq/client@2.2.13/+esm */ \"https://cdn.jsdelivr.net/npm/@notionhq/client@2.2.13/+esm\");\n/* harmony import */ var _home_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./home.js */ \"./src/home.js\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([https_cdn_jsdelivr_net_npm_notionhq_client_2_2_13_esm__WEBPACK_IMPORTED_MODULE_0__, _home_js__WEBPACK_IMPORTED_MODULE_1__]);\n([https_cdn_jsdelivr_net_npm_notionhq_client_2_2_13_esm__WEBPACK_IMPORTED_MODULE_0__, _home_js__WEBPACK_IMPORTED_MODULE_1__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n\r\n\r\n\r\nconst notion = new https_cdn_jsdelivr_net_npm_notionhq_client_2_2_13_esm__WEBPACK_IMPORTED_MODULE_0__[\"default\"]({ auth: undefined  });\r\n\r\nasync function makePage(){\r\n  var databaseId = \"f3b4e539d8a0482eb512457311b0bd75\"\r\n  var name = document.getElementById(\"person-name\").value;\r\n  var email = document.getElementById(\"person-email\").value;\r\n  if (name == \"\" || email == \"\") {\r\n    alert(\"Please enter your name and email!\");\r\n    return;\r\n  }\r\n  const timeData = (0,_home_js__WEBPACK_IMPORTED_MODULE_1__.getTimes)(name, email);\r\n  \r\n  console.log(timeData);\r\n  return;\r\n\r\n  const response = await notion.pages.create({\r\n    parent: {\r\n      database_id: databaseId,\r\n    },\r\n    properties: {\r\n      Name: {\r\n        title: [\r\n          {\r\n            text: {\r\n              content: \"Ayush R\",\r\n            },\r\n          },\r\n        ],\r\n      },\r\n        Sunday: {\r\n          multi_select: [\r\n            {\r\n              name: \"10:00 AM - 11:00 AM\",\r\n            },\r\n          ],\r\n        },\r\n    },\r\n  });\r\n\r\n  return response;\r\n};\r\n\r\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });\n\n//# sourceURL=webpack://tutor-timings/./src/fillData.js?");

/***/ }),

/***/ "./src/home.js":
/*!*********************!*\
  !*** ./src/home.js ***!
  \*********************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getTimes: () => (/* binding */ getTimes)\n/* harmony export */ });\n/* harmony import */ var _fillData_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./fillData.js */ \"./src/fillData.js\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_fillData_js__WEBPACK_IMPORTED_MODULE_0__]);\n_fillData_js__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\r\n\r\nvar script = document.createElement('script');\r\ndocument.getElementsByTagName('head')[0].appendChild(script);\r\n\r\nif(document.getElementById('submit') != null) {document.getElementById(\"submit\").addEventListener(\"click\", _fillData_js__WEBPACK_IMPORTED_MODULE_0__.makePage);\r\n}\r\n\r\n/*allow highlighting of each time-slot */\r\n$(document).ready(function() {\r\n  var $box = $('.time-box').mousedown(function() {\r\n    $(this).toggleClass('time-box-highlight');\r\n    var flag = $(this).hasClass('time-box-highlight');\r\n    $box.on('mouseenter.highlight', function() {\r\n      $(this).toggleClass('time-box-highlight', flag);\r\n    });\r\n  });\r\n  $(document).mouseup(function() {\r\n    $box.off('mouseenter.highlight')\r\n  });\r\n});\r\n\r\n/* when the button is pressed, submit the person's availability to a google app scripts project */\r\nfunction getTimes(name, email) {\r\n\r\n  var myObj = {\r\n    name: name,\r\n    email: email,\r\n  };\r\n\r\n  var highlightColor = \"rgb(112, 0, 0)\";\r\n  var baseColor = \"rgb(220,53,69)\";\r\n\r\n  ///// Parse Schedule Data into parsedData(2D array) an array containing an array for each day of the week\r\n  // Each day array contains whether or not the hour is highlighted with a boolean value\r\n  var parsedData = [];\r\n  var cols = document.getElementsByClassName(\"home-container-columns\");\r\n  for (var j = 0; j < cols.length; j++) {\r\n    var column = [];\r\n    var divArray = cols[j].getElementsByTagName(\"div\");\r\n    for (var i = 0; i < divArray.length; i++) {\r\n      var color = window\r\n        .getComputedStyle(divArray[i])\r\n        .getPropertyValue(\"background-color\");\r\n      column.push(color === highlightColor);\r\n    }\r\n    parsedData.push(column);\r\n  } //// END DATA PARSE\r\n\r\n  // Parses JSON data from schedule data\r\n  var currSelected, prevSelected;\r\n  for (var day = 0; day < parsedData.length; day++) {\r\n    var dayData = parsedData[day];\r\n    var jsonHourData = []; // array of {start: hour , end: hour} objects: blocks of time in a day\r\n\r\n    var jsonTime = {};\r\n    var timeString = \"\";\r\n    for (var hour = 0; hour < dayData.length; hour++) {\r\n      currSelected = dayData[hour];\r\n      prevSelected = hour > 0 && dayData[hour - 1];\r\n\r\n      if (currSelected && prevSelected && hour == 23) {\r\n        jsonTime[\"end\"] = hourToMilitary(hour + 1);\r\n      } else if (currSelected && !prevSelected) {\r\n        jsonTime[\"start\"] = hourToMilitary(hour);\r\n        if (hour == 23) {\r\n          jsonTime[\"end\"] = hourToMilitary(hour + 1);\r\n        }\r\n      } else if (!currSelected && prevSelected) {\r\n        jsonTime[\"end\"] = hourToMilitary(hour);\r\n      }\r\n      if (jsonTime[\"end\"] != null) {\r\n        console.log(jsonTime);\r\n        if (jsonTime[\"start\"] < 1200){\r\n          timeString = jsonTime[\"start\"] / 100 + \":00 AM - \"\r\n        }\r\n        else{\r\n          if (jsonTime[\"start\"] / 100 == 12){\r\n            timeString = jsonTime[\"start\"] / 100 + \":00 PM - \"\r\n          }\r\n          else{\r\n            timeString = jsonTime[\"start\"] / 100 - 12 + \":00 PM - \"\r\n          }\r\n        }\r\n        if (jsonTime[\"end\"] < 1200){\r\n          timeString += jsonTime[\"end\"] / 100 + \":00 AM\"\r\n        }\r\n        else{\r\n          if (jsonTime[\"end\"] / 100 == 12){\r\n            timeString += jsonTime[\"end\"] / 100 + \":00 PM\"\r\n          }\r\n          else{\r\n            timeString += jsonTime[\"end\"] / 100 - 12 + \":00 PM\"\r\n          }\r\n        }\r\n        jsonHourData.push(timeString);\r\n        //jsonHourData.push(jsonTime);\r\n        jsonTime = {};\r\n      }\r\n    }\r\n    myObj[getDay(day-1)] = jsonHourData;\r\n  }\r\n  const sundayInput = document.querySelector('input[name=\"Sunday\"]');\r\n  const mondayInput = document.querySelector('input[name=\"Monday\"]');\r\n  const tuesdayInput = document.querySelector('input[name=\"Tuesday\"]');\r\n  const wednesdayInput = document.querySelector('input[name=\"Wednesday\"]');\r\n  const thursdayInput = document.querySelector('input[name=\"Thursday\"]');\r\n  const fridayInput = document.querySelector('input[name=\"Friday\"]');\r\n  const saturdayInput = document.querySelector('input[name=\"Saturday\"]');\r\n  sundayInput.value = JSON.stringify(myObj.sunday);\r\n  mondayInput.value = JSON.stringify(myObj.monday);\r\n  tuesdayInput.value = JSON.stringify(myObj.tuesday);\r\n  wednesdayInput.value = JSON.stringify(myObj.wednesday);\r\n  thursdayInput.value = JSON.stringify(myObj.thursday);\r\n  fridayInput.value = JSON.stringify(myObj.friday);\r\n  saturdayInput.value = JSON.stringify(myObj.saturday);\r\n  console.log(myObj);\r\n  return myObj;\r\n  // document.getElementById(\"submitBtn\").click();\r\n\r\n // document.getElementById(\"myForm\").submit();\r\n // sendData(myObj);\r\n}\r\n\r\nfunction hourToMilitary(hour) {\r\n  return hour * 100;\r\n}\r\n\r\nfunction getDay(num) {\r\n  if (num == 0) return \"sunday\";\r\n  if (num == 1) return \"monday\";\r\n  if (num == 2) return \"tuesday\";\r\n  if (num == 3) return \"wednesday\";\r\n  if (num == 4) return \"thursday\";\r\n  if (num == 5) return \"friday\";\r\n  if (num == 6) return \"saturday\";\r\n}\r\n\r\n/* READ\r\n    sendData(data) takes in the *JSON object,\r\n    and is sent to a google apps scripts project thats deployed as a web app via\r\n    a post request with the JSON object in a text form in the body of the request\r\n    The app scripts project is connected to a google sheet which takes in the JSON\r\n    and formats it to the google sheet. \r\n    An nonproduction copy of the google sheet is linked:\r\n    https://docs.google.com/spreadsheets/d/1CP3PBlQuo9TESws-w-PZQgOlwf8OucYV3HLSwrebPsI/edit?usp=sharing\r\n\r\n        App scripts project is in the google sheet under extensions->App scripts\r\n        Instructions for implementing a production copy of the sheet and app script \r\n        is laid out in the app script main file\r\n\r\n    *JSON object in format of:\r\n    name is string\r\n    days of weeks contain arrays of availibity objects\r\n    {\"start\":time, \"end\": time} where time is an integer in the military time format,\r\n    e.g 0000 0100 0230 1230 1545 2130 2400 in IST time zone\r\n    {\r\n        \"name\": \"Christopher Espitia-Alvarez\",\r\n        \"monday\": [\r\n            {\"start\": 830,\r\n            \"end\": 1130}\r\n        ],\r\n        \"sunday\": [\r\n            {\"start\": 1200,\r\n            \"end\": 1500},\r\n            {\"start\": 1800,\r\n            \"end\": 2100}\r\n        ]\r\n    }\r\n*/\r\nfunction sendData(data){\r\n    var url = \"https://script.google.com/macros/s/AKfycbywn01yLknTeaRDIhjGzaXtouNx6Yywx_f34hbIZuIT0bB-SYR8gWkCUNjPbwS9DGW3/exec\"\r\n    //This url is the test google app scripts project, change to the real url when there is a production app scripts made\r\n    console.log(data);\r\n    fetch(url, {\r\n        redirect: \"follow\",\r\n        method: \"POST\",\r\n        body: JSON.stringify(data),\r\n        headers: {\r\n            \"Content-Type\": \"text/plain;charset=utf-8\",\r\n        },\r\n        })\r\n}\r\n\r\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });\n\n//# sourceURL=webpack://tutor-timings/./src/home.js?");

/***/ }),

/***/ "https://cdn.jsdelivr.net/npm/@notionhq/client@2.2.13/+esm":
false

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/async module */
/******/ 	(() => {
/******/ 		var webpackQueues = typeof Symbol === "function" ? Symbol("webpack queues") : "__webpack_queues__";
/******/ 		var webpackExports = typeof Symbol === "function" ? Symbol("webpack exports") : "__webpack_exports__";
/******/ 		var webpackError = typeof Symbol === "function" ? Symbol("webpack error") : "__webpack_error__";
/******/ 		var resolveQueue = (queue) => {
/******/ 			if(queue && queue.d < 1) {
/******/ 				queue.d = 1;
/******/ 				queue.forEach((fn) => (fn.r--));
/******/ 				queue.forEach((fn) => (fn.r-- ? fn.r++ : fn()));
/******/ 			}
/******/ 		}
/******/ 		var wrapDeps = (deps) => (deps.map((dep) => {
/******/ 			if(dep !== null && typeof dep === "object") {
/******/ 				if(dep[webpackQueues]) return dep;
/******/ 				if(dep.then) {
/******/ 					var queue = [];
/******/ 					queue.d = 0;
/******/ 					dep.then((r) => {
/******/ 						obj[webpackExports] = r;
/******/ 						resolveQueue(queue);
/******/ 					}, (e) => {
/******/ 						obj[webpackError] = e;
/******/ 						resolveQueue(queue);
/******/ 					});
/******/ 					var obj = {};
/******/ 					obj[webpackQueues] = (fn) => (fn(queue));
/******/ 					return obj;
/******/ 				}
/******/ 			}
/******/ 			var ret = {};
/******/ 			ret[webpackQueues] = x => {};
/******/ 			ret[webpackExports] = dep;
/******/ 			return ret;
/******/ 		}));
/******/ 		__webpack_require__.a = (module, body, hasAwait) => {
/******/ 			var queue;
/******/ 			hasAwait && ((queue = []).d = -1);
/******/ 			var depQueues = new Set();
/******/ 			var exports = module.exports;
/******/ 			var currentDeps;
/******/ 			var outerResolve;
/******/ 			var reject;
/******/ 			var promise = new Promise((resolve, rej) => {
/******/ 				reject = rej;
/******/ 				outerResolve = resolve;
/******/ 			});
/******/ 			promise[webpackExports] = exports;
/******/ 			promise[webpackQueues] = (fn) => (queue && fn(queue), depQueues.forEach(fn), promise["catch"](x => {}));
/******/ 			module.exports = promise;
/******/ 			body((deps) => {
/******/ 				currentDeps = wrapDeps(deps);
/******/ 				var fn;
/******/ 				var getResult = () => (currentDeps.map((d) => {
/******/ 					if(d[webpackError]) throw d[webpackError];
/******/ 					return d[webpackExports];
/******/ 				}))
/******/ 				var promise = new Promise((resolve) => {
/******/ 					fn = () => (resolve(getResult));
/******/ 					fn.r = 0;
/******/ 					var fnQueue = (q) => (q !== queue && !depQueues.has(q) && (depQueues.add(q), q && !q.d && (fn.r++, q.push(fn))));
/******/ 					currentDeps.map((dep) => (dep[webpackQueues](fnQueue)));
/******/ 				});
/******/ 				return fn.r ? promise : getResult();
/******/ 			}, (err) => ((err ? reject(promise[webpackError] = err) : outerResolve(exports)), resolveQueue(queue)));
/******/ 			queue && queue.d < 0 && (queue.d = 0);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/home.js");
/******/ 	
/******/ })()
;