'use strict';
/**
 * Created by vedi on 09/14/15.
 */
var
  Promise = require('bluebird'),
  fs = Promise.promisifyAll(require('fs-extra')),
  pathM = require('path'),
  crypto = require('crypto');

module.exports = {

  initialize: function(options) {
    this.uploadPath = options.uploadPath + '/';
  },

  getFileAsync: function (fileMeta) {
    var fileName = fileMeta;
    return fs.openAsync(fileName, 'r');
  },

  putFileAsync: function (path, options) {
    var buf = crypto.randomBytes(64);
    var fileName = this.uploadPath + buf.toString('hex') + '.' + pathM.extname();

    return fs.moveAsync(path, fileName)
      .then(function () {
        return fileName;
      });
  },

  replaceFileAsync: function (fileMeta, path, options) {
    var fileName = fileMeta;
    return fs.moveAsync(path, fileName, {clobber: true})
      .then(function () {
        return fileName;
      });
  },

  deleteFileAsync: function (fileMeta) {
    var fileName = fileMeta;
    return fs.unlinkAsync(fileName);
  }

};
