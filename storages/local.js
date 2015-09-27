'use strict';
/**
 * Created by vedi on 09/14/15.
 */
var
  Promise = require('bluebird'),
  fs = Promise.promisifyAll(require('fs-extra')),
  pathM = require('path'),
  crypto = require('crypto'),
  utils = require('../lib/utils'),
  requireOptions = utils.requireOptions;

module.exports = {

  initialize: function(options) {
    var requiredOptions = ['uploadRoot', 'uploadPath'];
    requireOptions(options, requiredOptions);

    this.uploadRoot = options.uploadRoot + '/';
    this.uploadPath = options.uploadPath;
  },

  getStreamAsync: function (fileMeta) {
    var fileName = this.uploadRoot + fileMeta;
    return fs.createReadStream(fileName);
  },

  putFileAsync: function (path, options) {
    var buf = crypto.randomBytes(64);
    var fileName = this.uploadPath + buf.toString('hex') + '.' + pathM.extname();

    return fs.moveAsync(path, this.uploadRoot + fileName)
      .then(function () {
        return fileName;
      });
  },

  replaceFileAsync: function (fileMeta, path, options) {
    var fileName = fileMeta;
    return fs.moveAsync(path, this.uploadRoot + fileName, {clobber: true})
      .then(function () {
        return fileName;
      });
  },

  deleteFileAsync: function (fileMeta) {
    var fileName = this.uploadRoot + fileMeta;
    return fs.unlinkAsync(fileName);
  }

};
