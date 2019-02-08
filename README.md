# An [Eagle Eyes](https://github.com/addomafi/eagle-eyes) module for AWS Glue [![Build Status](https://travis-ci.org/addomafi/eagle-eyes-aws-glue.svg?branch=master)](https://travis-ci.org/addomafi/eagle-eyes-aws-glue)

This module operates as an extension for Eagle Eyes to enable checking and alerting for Glue Jobs.

## Current Status

Stable.

## Installation

```sh
npm install eagle-eyes-aws-glue
```

## Features

* Alerts based on triggers and Job state validation;
* Alerts based on Job running out of time;
* Skip for alerts from a specific Job.

## Introduction

All required configuration are specified by a Glue Trigger, so to run a job checking you only need to call a method like this:

```js
// run.js
var eeAwsGlue = require('eagle-eyes-aws-glue')

eeAwsGlue.checkJobRun().then(results => {
  console.log(JSON.stringify(results));
}).catch(err => {
  console.log(err)
})
```

It will return an empty array when all jobs had succeeded or an array like this if not:

```json
[
  {
    "name": "job-txn",
    "status": "STOPPED",
    "runover": 0
  }
  {
    "name": "job-err",
    "status": "NOK"
  },
  {
    "name": "job-rdm",
    "status": "RUNNING",
    "runover": 30
  },
  {
    "name": "job-optin",
    "status": "FAILED",
    "runover": 0
  }
]
```
