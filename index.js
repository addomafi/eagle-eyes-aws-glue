/**
 * An Eagle Eyes module that verify if a Glue Job was running according to the registered Trigger
 *
 * license: MIT
 * author: Adauto Martins
 */
'use strict';
let AWS = require('aws-sdk');
let glue = new AWS.Glue();
let request = require('request-promise-native');
let _ = require('lodash');
var cronstrue = require('cronstrue');
var moment = require('moment-timezone');
var Promise = require("bluebird");

let eeAwsGlue = function() {
  var glue = new AWS.Glue();
  var self = this

  self._listTriggers = function() {
    return new Promise((resolve, reject) => {
      glue.getTriggers({}, function(err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
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
          console.log(err, err.stack); // an error occurred
          reject(err)
        }
        if (data) {
          var runs = _.filter(data.JobRuns, function(d) {
            d.runOver = moment().diff(moment(d.StartedOn*1000), 'minutes')
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
              jobsToCheck.push(this._getJobRuns(job.JobName, params))
            })
          }
        }
      })
      Promise.all(jobsToCheck).then(results => {
        resolve(_.filter(results, function(o) {
          return params.discardJobs.indexOf(o.name) == -1 && ((o.status === "RUNNING" && o.runOver > params.maxDuration) || (o.status != "SUCCEEDED" && o.status != "RUNNING"))
        }))
      })
    })
  })
}

module.exports = eeAwsGlue