/* eslint-disable max-len */
/**
 * Created by vedi on 14/04/17.
 */
'use strict';

const Bb = require('bluebird');
const Client = require('ftp');
const mmm = require('mmmagic');
const path = require('path');
const mime = require('mime-types');

const magic = Bb.promisifyAll(new mmm.Magic(mmm.MAGIC_MIME_TYPE));
let client = new Client();
client = Bb.promisifyAll(client);

const utils = require('../lib/utils');

const requireOptions = utils.requireOptions;


/**
 *
 * options:
 *
 * uploadPath
 *
 * ftp connection options:
 *
 * host - string - The hostname or IP address of the FTP server. Default: 'localhost'
 * port - integer - The port of the FTP server. Default: 21
 * secure - mixed - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false
 * secureOptions - object - Additional options to be passed to tls.connect(). Default: (none)
 * user - string - Username for authentication. Default: 'anonymous'
 * password - string - Password for authentication. Default: 'anonymous@'
 * connTimeout - integer - How long (in milliseconds) to wait for the control connection to be established. Default: 10000
 * pasvTimeout - integer - How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000
 * keepalive - integer - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000
 */


module.exports = {

  initialize: function(options) {
    requireOptions(options, ['host']);
    this.options = options;
  },

  _connect: function(){
    return new Bb((resolve, reject) => {
      let serverMessage;
      client.once('greeting', (msg) => serverMessage = msg);
      client.once('ready', () => resolve(serverMessage));
      client.once('error', err => reject(err));
      client.connect(this.options);
    });
  },

  getStream: function (fileMeta) {
    const vals = {};

    let filename = fileMeta.filename;
    return this._connect()
      .then((msg) => {
        return client.sizeAsync(this._fullRemoteFileName(filename));
      })
      .then((size) => {
        vals.size = size;
        return client.getAsync(filename);
      })
      .then((stream) => {
        stream.once('close', function() { client.end(); });
        return {
          contentType: mime.lookup(filename),
          contentLength: vals.size,
          stream,
        };
      }).catch(function(e) {
        client.end();
        throw e;
      });
  },

  _fullRemoteFileName(filename) {
    if (this.options.uploadPath) return path.join(this.options.uploadPath, fileName);
    else return filename;
  },

  putFile: function (frompath, options) {
    this._connect()
      .then(function (msg) {
        return new Bb((resolve, reject) => {
          client.put(frompath, this._fullRemoteFileName(path.basename(frompath)), (err) => {
            if (err) reject(err);
            client.end();
            resolve(fileName);
          });
        });
      })
      .catch(function(e) {
        client.end();
        throw e;
      });
  },

  replaceFile: function (fileMeta, fromPath, options) {
    const prevRemotePath = this._fullRemoteFileName(fileMeta.filename);
    const newRemotePath = this._fullRemoteFileName(path.basename(frompath));
    return Bb.try(() => {
      if (prevRemotePath !== newRemotePath)
        return this.deleteFile(prevRemotePath);
    }).then(() => {
      return this.putFile(fromPath, options);
    })
  },

  deleteFile: function (fileMeta) {
    this._connect()
      .then(function (msg) {
        return new Bb((resolve, reject) => {
          client.delete(this._fullRemoteFileName(fileMeta.filename), (err) => {
            if (err) reject(err);
            client.end();
            resolve(this._fullRemoteFileName(fileMeta.filename));
          });
        });
      })
      .catch(function (e) {
        client.end();
        throw e;
      });
  }
};
