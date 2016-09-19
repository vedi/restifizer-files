'use strict';

const Bb = require('bluebird');
const fs = Bb.promisifyAll(require('fs-extra'));
const pathM = require('path');
const crypto = require('crypto');
const mmm = require('mmmagic');

const utils = require('../lib/utils');

const requireOptions = utils.requireOptions;

module.exports = {

  initialize: function(options) {
    var requiredOptions = ['uploadRoot', 'uploadPath'];
    requireOptions(options, requiredOptions);

    this.uploadRoot = options.uploadRoot + '/';
    this.uploadPath = options.uploadPath;
  },

  getStream: function (fileMeta) {
    var fileName = this.uploadRoot + fileMeta;

    var magic = Bb.promisifyAll(new mmm.Magic(mmm.MAGIC_MIME_TYPE));

    return Bb.
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

  putFile: function (path, options) {
    var fileName = this.uploadPath + '/' + this.generateFileName() + pathM.extname(path);

    return fs.moveAsync(path, this.uploadRoot + fileName)
      .then(function () {
        return fileName;
      });
  },

  replaceFile: function (fileMeta, path, options) {
    var fileName = fileMeta;
    return fs.moveAsync(path, this.uploadRoot + fileName, {clobber: true})
      .then(function () {
        return fileName;
      });
  },

  deleteFile: function (fileMeta) {
    var fileName = this.uploadRoot + fileMeta;
    return fs.unlinkAsync(fileName);
  },

  generateFileName: function() {
    var buf = crypto.randomBytes(32);
    return buf.toString('hex');
  }

};
