'use strict';

const Bb = require('bluebird');
const fs = Bb.promisifyAll(require('fs-extra'));
const pathM = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

const utils = require('../utils');

const requireOptions = utils.requireOptions;

class LocalStorage {
  initialize(options) {
    const requiredOptions = ['uploadRoot', 'uploadPath'];
    requireOptions(options, requiredOptions);

    this.uploadRoot = `${options.uploadRoot}/`;
    this.uploadPath = options.uploadPath;
  }

  getStream(fileMeta) {
    const fileName = this.uploadRoot + fileMeta;

    return Bb
      .join(
        fs.statAsync(fileName),
        mime.lookup(fileName)
      )
      .spread((stats, mimeType) => {
        const fileSizeInBytes = stats.size;

        return {
          contentLength: fileSizeInBytes,
          contentType: mimeType,
          stream: fs.createReadStream(fileName),
        };
      });
  }

  putFile(path) {
    const fileName = `${this.uploadPath}/${this.generateFileName()}${pathM.extname(path)}`;

    return fs
      .moveAsync(path, this.uploadRoot + fileName)
      .then(() => fileName);
  }

  replaceFile(fileMeta, path) {
    const fileName = fileMeta;
    return fs
      .moveAsync(path, this.uploadRoot + fileName, { clobber: true })
      .then(() => fileName);
  }

  deleteFile(fileMeta) {
    const fileName = this.uploadRoot + fileMeta;
    return fs.unlinkAsync(fileName);
  }

  generateFileName() {
    const buf = crypto.randomBytes(32);
    return buf.toString('hex');
  }
}

module.exports = LocalStorage;
