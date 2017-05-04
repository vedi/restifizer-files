/**
 * Created by vedi on 14/04/17.
 */

'use strict';

const Bb = require('bluebird');
const Client = require('ftp');
const path = require('path');
const mime = require('mime-types');

let client = new Client();
client = Bb.promisifyAll(client);

const utils = require('../utils');

const requireOptions = utils.requireOptions;


/**
 *
 * options:
 *
 * uploadPath
 *
 * ftp connection options:
 *
 */


class Storage {

  /**
   *
   * @param options
   * @param options.uploadPath The remote path on ftp server
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

  _connect() {
    return new Bb((resolve, reject) => {
      let serverMessage;
      client.once('greeting', (msg) => {
        serverMessage = msg;
      });
      client.once('ready', () => resolve(serverMessage));
      client.once('error', err => reject(err));
      client.connect(this.options);
    });
  }

  getStream(fileMeta) {
    const vals = {};
    const fileName = fileMeta.fileName;
    return this
      ._connect()
      .then(() => client.sizeAsync(this._fullRemoteFileName(fileName)))
      .then((size) => {
        vals.size = size;
        return client.getAsync(fileName);
      })
      .then((stream) => {
        stream.once('close', () => { client.end(); });
        return {
          contentType: mime.lookup(fileName),
          contentLength: vals.size,
          stream,
        };
      })
      .catch((e) => {
        client.end();
        throw e;
      });
  }

  _fullRemoteFileName(fileName) {
    if (this.options.uploadPath) {
      return path.join(this.options.uploadPath, fileName);
    } else {
      return fileName;
    }
  }

  putFile(frompath) {
    return this
      ._connect()
      .then(() => new Bb((resolve, reject) => {
        client.put(frompath, this._fullRemoteFileName(path.basename(frompath)),
          (err) => {
            if (err) {
              reject(err);
            }
            client.end();
            resolve(this._fullRemoteFileName(path.basename(frompath)));
          }
        );
      }))
      .catch((e) => {
        client.end();
        throw e;
      });
  }

  replaceFile(fileMeta, fromPath, options) {
    const prevRemotePath = this._fullRemoteFileName(fileMeta.fileName);
    const newRemotePath = this._fullRemoteFileName(path.basename(fromPath));
    return Bb
      .try(() => {
        if (prevRemotePath !== newRemotePath) {
          return this.deleteFile(prevRemotePath);
        }
      })
      .then(() => this.putFile(fromPath, options));
  }

  deleteFile(fileMeta) {
    return this
      ._connect()
      .then(() => Bb.fromCallback((callback) => {
        client.delete(this._fullRemoteFileName(fileMeta.fileName), callback);
      }))
      .finally(() => {
        client.end();
      });
  }
}

module.exports = Storage;
