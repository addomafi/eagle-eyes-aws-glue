#!/usr/bin/env node

var path = require('path')
let EeAwsGlue = require(path.join(__dirname, '..', 'index.js'))
var eeAwsGlue = new EeAwsGlue()

eeAwsGlue.checkJobRun({
  "discardJobs": [],
  "checkInterval": 690,
  "maxDuration": 20
}).then(results => {
  console.log(JSON.stringify(results));
}).catch(err => {
  console.log(err)
});
