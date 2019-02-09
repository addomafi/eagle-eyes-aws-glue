/**
 * An Eagle Eyes module that verify if a Glue Job was running according to the registered Trigger
 *
 * license: MIT
 * author: Adauto Martins
 * 
 */
'use strict';
let AWS = require('aws-sdk');
let glue = new AWS.Glue();
let request = require('request-promise-native');
let _ = require('lodash');
let extend = require('extend')
let cronstrue = require('cronstrue');
let moment = require('moment-timezone');
let Promise = require("bluebird");
let join = Promise.join;
let bunyan = require('bunyan');
let log = bunyan.createLogger({name: "eagle-eyes-aws-glue"});
log.level("fatal")

let eeAwsGlue = function() {
  var glue = new AWS.Glue();
  var self = this
  this._options = {
    "discardJobs": [],
    "jobThreshold": [],
    "checkInterval": 600,
    "maxDuration": 19
  };

  self._listTriggers = function() {
    return new Promise((resolve, reject) => {
      glue.getTriggers({}, function(err, data) {
        if (err) {
          log.info(`An error has occurred when calling API for job triggers, details: ${err.code} - ${err.message}`); // an error occurred
          reject(err)
        }
        resolve(data);
      });
    })
  }

  self._getJobRuns = function(name, params) {
    return new Promise((resolve, reject) => {
      glue.getJobRuns({
          JobName: name,
          MaxResults: 5
        }, function(err, data) {
        if (err) {
          log.info(`An error has occurred when calling API for job run, details: ${err.code} - ${err.message}`); // an error occurred
        }

        if (data) {
          var runs = _.filter(data.JobRuns, function(d) {
            d.runOver = moment().diff(moment(d.StartedOn), 'minutes')
            return d.runOver <= params.checkInterval
          })
          if (runs.length > 0) {
            resolve({
              name: name,
              status: runs[0].JobRunState,
              runOver: runs[0].runOver
            })
          } else {
            resolve({
              name: name,
              status: "NOK"
            })
          }
        } else {
          resolve({
            name: name,
            status: "NOK"
          })
        }
      });
    })
  }
}

/**
 * Check JOB running according to active Triggers
 *
 * - params: Parameters to check job runs
 *     . discardJobs: Array of string - A list of Jobs to bypass checking
 *     . checkInterval: Integer - A period of time in minutes where the job will be checked, for ex. if a job is scheduled to run at 03:00am and this param
 *       is specified with 60m, the check will run for this job until 04:00am.
 */
eeAwsGlue.prototype.checkJobRun = function(params) {
  var self = this;
  params = extend(true, {}, this._options, params)
  return new Promise((resolve, reject) => {
    this._listTriggers().then(triggers => {
      var filteredTriggers = _.filter(triggers.Triggers, {"State": "ACTIVATED"})
      var jobsToCheck = []
      _.each(filteredTriggers, trigger => {
        const regexCron = /cron\(([0-9*?\s]+)\)/gm;
        var cronTxt = regexCron.exec(trigger.Schedule)
        if (cronTxt) {
          var cronStr = cronTxt[1]
          var timeToRun = moment.tz(cronstrue.toString(cronStr.substring(0,cronStr.length-2)), ["At hh:mm AA"], "GMT");
          // If it was parseable and diff time is greater than 30 and less than 300
          var now = moment.tz("GMT")
          if (timeToRun.isValid() && now.diff(timeToRun, 'minutes') >= 0 && now.diff(timeToRun, 'minutes') <= params.checkInterval) {
            _.each(trigger.Actions, job => {
              jobsToCheck.push(job.JobName)
            })
          }
        }
      })
      Promise.map(jobsToCheck, function(job) {
        return self._getJobRuns(job, params);
      }, {
        concurrency: 5
      }).then(results => {
        resolve(_.filter(results, function(o) {
          var jobThreshold = _.filter(params.jobThreshold, ["key", o.name]);
          var maxDuration = params.maxDuration;
          if (jobThreshold.length > 0) {
            maxDuration = jobThreshold[0].value;
          }
          return params.discardJobs.indexOf(o.name) == -1 && ((o.status === "RUNNING" && o.runOver > maxDuration) || (o.status != "SUCCEEDED" && o.status != "RUNNING"))
        }))
      }).catch(err => {
        log.error(err)
      })
    })
  })
}

module.exports = eeAwsGlue
