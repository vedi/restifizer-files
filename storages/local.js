'use strict';
/**
 * Created by vedi on 09/14/15.
 */
var
  Promise = require('bluebird'),
  fs = Promise.promisifyAll(require('fs-extra')),
  pathM = require('path'),
  crypto = require('crypto'),
  mmm = require('mmmagic'),
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

    var magic = Promise.promisifyAll(new mmm.Magic(mmm.MAGIC_MIME_TYPE));

    return Promise.
      all([
        fs.statAsync(fileName),
        magic.detectFileAsync(fileName)
      ]).
      spread(function (stats, mimeType) {
        var fileSizeInBytes = stats['size'];

        return {
          contentLength: fileSizeInBytes,
          contentType: mimeType,
          stream: fs.createReadStream(fileName)
        };
      });

  },

  putFileAsync: function (path, options) {
    var fileName = this.uploadPath + '/' + this.generateFileName() + pathM.extname(path);

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
  },

  generateFileName: function() {
    var buf = crypto.randomBytes(32);
    return buf.toString('hex');
  }

};
