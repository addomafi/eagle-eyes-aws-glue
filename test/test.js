let fs = require('fs');
let assert = require('assert');
let expect = require('chai').expect;
let should = require('chai').should();
let chai = require('chai');
let chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised).should();
let _ = require('lodash');
var moment = require('moment');

let zlib = require('zlib')
let path = require('path')
let EeAwsGlue = require(path.join(__dirname, '..', 'index.js'))

var glueTriggers = JSON.parse(fs.readFileSync(path.join(__dirname, 'trigger-data.json'), 'utf8'));
var glueJobRuns = JSON.parse(fs.readFileSync(path.join(__dirname, 'job-runs-data.json'), 'utf8'));
const configTriggerTestCase = [{
  "key": "Trigger-scheduled",
  "value": 300
},{
  "key": "Trigger-scheduled-Alerta-prd",
  "value": 1
}]
const configJobTestCase = [{
  "key": "job-acrl",
  "value": 30
},{
  "key": "job-club",
  "value": 20
},{
  "key": "job-rdm",
  "value": 30
},{
  "key": "job-txn-x",
  "value": 300
}]

var AWS = require('aws-sdk-mock');
AWS.mock('Glue', 'getTriggers', function(params, callback) {
  _.forEach(glueTriggers.Triggers, trigger => {
    var config = _.filter(configTriggerTestCase, ["key", trigger.Name])
    if (config.length == 0) config = [{value: 600}]
    trigger.Schedule = `cron(${moment().subtract(config[0].value, 'minutes').format('mm')} ${moment().subtract(config[0].value, 'minutes').format('HH')} * * ? *)`
  })
  return callback(null, glueTriggers)
});

AWS.mock('Glue', 'getJobRuns', function(params, callback) {
  _.forEach(glueJobRuns.JobRuns, jobRun => {
    var config = _.filter(configJobTestCase, ["key", jobRun.JobName])
    if (config.length == 0) config = [{value: 0}]
    jobRun.StartedOn = parseInt(moment().subtract(config[0].value, 'minutes').format('x'))
  })
  if (params.JobName === "job-err") {
    return callback({
      "code": "AWS-123",
      "message": "An error has occurred",
      "retryable": false,
      "statusCode": 500,
      "time": moment().toDate(),
      "hostname": "glue.aws.com",
      "region": "us-east-1"
    }, null)
  } else {
    return callback(null, {
      JobRuns: _.filter(glueJobRuns.JobRuns, ["JobName", params.JobName])
    })
  }
});

describe('Glue Test', function(){
  var eeAwsGlue = new EeAwsGlue();

  it('should have triggers', function(){
    eeAwsGlue._listTriggers().should.eventually.have.property('Triggers');
  });

  it('should have job runs', function(){
    eeAwsGlue._getJobRuns('job-acrl',{
        "discardJobs": [],
        "checkInterval": 600,
        "maxDuration": 20
      }).should.eventually.have.property('status');
  });

  it('should have a valid check for job runs without specified params', function(){
    eeAwsGlue.checkJobRun().should.eventually.deep.equal([{name: "job-txn", status: "STOPPED", runOver: 0},
                              {name: "job-acrl", status: "RUNNING", runOver: 30},
                              {name: "job-err", status: "NOK"},
                              {name: "job-rdm", status: "RUNNING", runOver: 30},
                              {name: "job-optin", status: "FAILED", runOver: 0},
                              {name: "job-club", status: "RUNNING", runOver: 20}]);
  });

  it('should have a valid check for job runs', function(){
    eeAwsGlue.checkJobRun({
      "discardJobs": ["job-rdm"],
      "jobThreshold": [
        {"key": "job-txn-x", "value": 301}
      ],
      "checkInterval": 600,
      "maxDuration": 20
    }).should.eventually.deep.equal([{name: "job-txn", status: "STOPPED", runOver: 0},
                              {name: "job-acrl", status: "RUNNING", runOver: 30},
                              {name: "job-err", status: "NOK"},
                              {name: "job-optin", status: "FAILED", runOver: 0}]);
  });
});
