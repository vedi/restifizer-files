'use strict';

const _ = require('lodash');
const util = require('util');
const HTTP_STATUSES = require('http-statuses');

function resolveProp(obj, stringPath) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj;
}

function setProp(obj, stringPath, value) {
  stringPath = stringPath.replace(/\[(\w+)]/g, '.$1');  // convert indexes to properties
  stringPath = stringPath.replace(/^\./, '');           // strip a leading dot
  var pathArray = stringPath.split('.');
  while (pathArray.length - 1) {
    var pathItem = pathArray.shift();
    if (pathItem in obj) {
      obj = obj[pathItem];
    } else {
      return;
    }
  }
  return obj[pathArray.length ? pathArray[0] : stringPath] = value;
}

function requireOptions(options, requireOptionKeys) {
  for (var i = 0; i < requireOptionKeys.length; i++) {
    var key = requireOptionKeys[i];
    if (_.isUndefined(options[key])) {
      throw new TypeError('"' + key  + '" is required');
    }
  }
}


function setResData(res, data) {
  res.restfulResult = data;
}

function setResError(err, res, log) {
  var errorStatus,
    errorMessage,
    errorDetails;

  if (!err) {
    err = HTTP_STATUSES.INTERNAL_SERVER_ERROR.createError();
  }
  else if (!(err instanceof Error)) {
    err = new Error(err.message, err.details);
  }

  if (err.httpStatus) {
    errorStatus = err.httpStatus;
  }
  else if (err.name == 'ValidationError') {
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = err.errors;
  }
  else if (err.name == 'CastError') {
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = {};
    errorDetails[err.path] = {
      message: err.message,
      name: err.name,
      path: err.path,
      type: err.type,
      value: err.value
    };
    errorMessage = 'CastError';
  }
  else if (err.name == 'MongoError' && (err.code == 11000 || err.code == 11001)) { // E11000(1) duplicate key error index
    errorStatus = HTTP_STATUSES.BAD_REQUEST;
    errorDetails = err.err;
  }
  else if (err.name == 'VersionError') {
    errorStatus = HTTP_STATUSES.CONFLICT;
    errorDetails = err.message;
  }
  else {
    errorStatus = HTTP_STATUSES.INTERNAL_SERVER_ERROR;
  }

  errorMessage = errorMessage || err.message;
  errorDetails = errorDetails || err.errorDetails;

  res.statusCode = errorStatus.code;
  setResData(res, {error: errorStatus.message, message: errorMessage, details: errorDetails});
  if (log) {
    log.error('Error(%d): %s: %s', errorStatus.code, errorMessage, errorDetails ? errorDetails : '');
  } else {
    console.log('error: ' + 'Error(' + errorStatus.code + '): ' + errorMessage + ': ' + errorDetails ? errorDetails : '');
  }

  // extract stack data
  var data = {};

  try {
    var stacklist = err.stack.split('\n').slice(3);
    // Stack trace format :
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    var s = stacklist[0], sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
        .exec(s)
      || /at\s+()(.*):(\d*):(\d*)/gi.exec(s);
    if (sp && sp.length === 5) {
      data.method = sp[1];
      data.path = sp[2];
      data.line = sp[3];
      data.pos = sp[4];
      data.file = path.basename(data.path);
      data.stack = stacklist.join('\n');
    } else {
      data.raw = err.stack;
    }
  } catch (e) {
    if (log) {
      log.error('Error in error handler!');
    } else {
      console.log('error: ' + 'Error in error handler!');
    }
    data.raw = err.stack;
  }

  if (log) {
    log.error(data);
  } else {
    console.log('error: ' + data);
  }
}

function setResOk(res, code) {
  res.statusCode = code || HTTP_STATUSES.OK.code;
}

module.exports.resolveProp = resolveProp;
module.exports.setProp = setProp;
module.exports.requireOptions = requireOptions;
module.exports.setResData = setResData;
module.exports.setResError = setResError;
module.exports.setResOk = setResOk;
