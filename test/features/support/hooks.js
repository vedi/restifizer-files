'use strict';

const requestFile = require('../../lib/promised-request-file');
const fileConfig = require('../../lib/dal').files.testFile;

module.exports = function () {
  this.Before(function (callback) {
    this.fileRestClient = requestFile(fileConfig.url, fileConfig.fileFormDataName);
    callback();
  });
};
