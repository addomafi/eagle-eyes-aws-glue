#!/usr/bin/env node

var path = require('path')
let EeAwsGlue = require(path.join(__dirname, '..', 'index.js'))
var eeAwsGlue = new EeAwsGlue()

eeAwsGlue.checkJobRun({
  "discardJobs": [],
  "jobThreshold": [
    {"key": "siebel_refined_process_tb_loy_txn_acrl-prd", "value": 720}
  ],
  "checkInterval": 780,
  "maxDuration": 20
}).then(results => {
  console.log(JSON.stringify(results));
}).catch(err => {
  console.log(err)
});
