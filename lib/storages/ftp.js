/**
 * Created by vedi on 14/04/17.
 */

'use strict';

const Bb = require('bluebird');
const Client = require('ftp');
const path = require('path');
const mime = require('mime-types');

const utils = require('../utils');

const requireOptions = utils.requireOptions;

class FtpStorage {

  /**
   * @param {Object} options
   * @param {string} options.uploadPath the remote path on ftp server
   * @param {string} options.separator='/' string used on the FTP server for path concatination.
   *
   * ftp connection options:
   *
   * @param {string} options.host The hostname or IP address of the FTP server. Default: 'localhost'
   * @param {number} options.port The port of the FTP server. Default: 21
   * @param {(boolean|string)} options.secure Set to true for both control and data connection
   * encryption, 'control' for control connection encryption only, or 'implicit' for implicitly
   * encrypted control connection (this mode is deprecated in modern times, but usually uses port
   * 990) Default: false
   * @param {object} options.secureOptions Additional options to be passed to tls.connect().
   * Default: (none)
   * @param {string} options.user Username for authentication. Default: 'anonymous'
   * @param {string} options.password Password for authentication. Default: 'anonymous@'
   * @param {number} options.connTimeout How long (in milliseconds) to wait for the control
   * connection to be established. Default: 10000
   * @param {number} options.pasvTimeout How long (in milliseconds) to wait for a PASV data
   * connection to be established. Default: 10000
   * @param {number} options.keepalive How often (in milliseconds) to send a 'dummy' (NOOP)
   *  command to keep the connection alive. Default: 10000
   */
  initialize(options) {
    requireOptions(options, ['host']);
    this.options = options;
  }

  _connect(scope) {
    const client = Bb.promisifyAll(new Client());
    return new Bb(
      (resolve, reject) => {
        client.once('ready', () => resolve(client));
        client.once('error', err => reject(err));
        client.connect(Object.assign({}, this.options, scope.ftpOptions));
      })
      .finally(() => {
        client.removeAllListeners();
      });
  }

  getStream(fileMeta, scope) {
    const vals = {};
    const fileName = fileMeta;
    const fullFileName = this._fullRemoteFileName(fileName, scope);
    return this
      ._connect(scope)
      .then((client) => {
        vals.client = client;
        return client.sizeAsync(fullFileName);
      })
      .then((size) => {
        vals.size = size;
        return vals.client.getAsync(fullFileName);
      })
      .then((stream) => {
        stream.once('close', () => { vals.client.end(); });
        stream.once('error', () => { vals.client.end(); });
        return {
          contentType: mime.lookup(fullFileName),
          contentLength: vals.size,
          stream,
        };
      })
      .catch((e) => {
        if (vals.client.connected) {
          vals.client.end();
        }
        throw e;
      });
  }

  _fullRemoteFileName(fileName, scope) {
    const { options } = this;
    const { ftpOptions: {
      uploadPath = options.uploadPath,
      separator = options.separator || '/',
    } = {} } = scope;
    if (uploadPath) {
      return `${uploadPath}${separator}${fileName}`;
    } else {
      return fileName;
    }
  }

  putFile(fromPath, options, scope) {
    const { fileName = path.basename(fromPath) } = options;
    const fullRemoteFileName = this._fullRemoteFileName(fileName, scope);
    let client;
    return this
      ._connect(scope)
      .then(result => Bb.fromCallback((callback) => {
        client = result;
        client.put(fromPath, fullRemoteFileName, callback);
      }))
      .then(() => fileName)
      .finally(() => {
        if (client.connected) {
          return new Bb((resolve) => {
            client.once('end', resolve);
            client.end();
          });
        }
      });
  }

  replaceFile(fileMeta, fromPath, options, scope) {
    const prevRemotePath = this._fullRemoteFileName(fileMeta, scope);
    const newRemotePath = this._fullRemoteFileName(path.basename(fromPath), scope);
    return Bb
      .try(() => {
        if (prevRemotePath !== newRemotePath) {
          return this.deleteFile(fileMeta, scope);
        }
      })
      .then(() => this.putFile(fromPath, options, scope));
  }

  deleteFile(fileMeta, scope) {
    const fileName = fileMeta;
    let client;
    return this
      ._connect(scope)
      .then(result => Bb.fromCallback((callback) => {
        client = result;
        client.delete(this._fullRemoteFileName(fileName, scope), callback);
      }))
      .catch((err) => {
        // skip "File not found"
        if (err.code !== 550) {
          throw err;
        }
      })
      .finally(() => {
        if (client.connected) {
          return new Bb((resolve) => {
            client.once('end', resolve);
            client.end();
          });
        }
      });
  }
}

module.exports = FtpStorage;
