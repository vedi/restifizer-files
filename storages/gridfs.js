/**
 * Created by vedi on 11/21/13.
 */
'use strict';

const Promise = require('bluebird');
const mongoose = require('mongoose');

const GridStore = Promise.promisifyAll(mongoose.mongo.GridStore);
const ObjectID = mongoose.mongo.ObjectID;

module.exports = {

  initialize: function(options) {
    this.db = options.dataSource.ModelClass.db.db;
  },

  getStream: function (fileMeta) {
    var id = fileMeta.fileId;
    var store = new GridStore(this.db, new ObjectID(id.toString()), 'r', {root: 'fs'});
    Promise.promisifyAll(store);
    return store.openAsync().then(function (db) {
      return {
        contentType: fileMeta.contentType,
        contentLength: db.stream(true).totalBytesToRead,
        stream: db.stream(true)
      };
    });
  },

  putFile: function (path, options) {
    var gridStore = Promise.promisifyAll(new GridStore(this.db, new ObjectID(), 'w', options));

    return Promise
      .try(function () {
        return gridStore.openAsync();
      })
      .then(function () {
        return gridStore.writeFileAsync(path);
      })
      .then(function (doc) {
        return {
          contentType: doc.contentType,
          fileName: doc.filename,
          fileId: doc.fileId,
          root: doc.root,
          uploadDate: doc.uploadDate
        };
      });
  },

  replaceFile: function (fileMeta, path, options) {
    var id = fileMeta.fileId;

    return Promise
      .bind(this)
      .then(function () {
        options = options || {};
        options.root = 'fs';
        var store = Promise.promisifyAll(new GridStore(this.db, id, 'w', options));
        return store.openAsync();
      })
      .then(function (store) {
        return store.rewindAsync();
      })
      .then(function (gridStore) {
        return gridStore.writeFileAsync(path);
      })
      .then(function(doc) {
        return {
          contentType:  doc.contentType,
          fileName:     doc.filename,
          fileId:       doc.fileId,
          root:         doc.root,
          uploadDate:   doc.uploadDate
        };
      })
      ;
  },

  deleteFile: function (fileMeta) {
    var id = fileMeta.fileId;
    return GridStore.unlinkAsync(this.db, id);
  }
};
