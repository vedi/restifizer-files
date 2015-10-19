'use strict';
/**
 * Created by vedi on 11/21/13.
 */
var
  Promise = require('bluebird'),
  mongoose  = require('mongoose'),
  GridStore = Promise.promisifyAll(mongoose.mongo.GridStore),
  ObjectID  = mongoose.mongo.BSONPure.ObjectID;

module.exports = {

  initialize: function(options) {
    this.db = options.dataSource.ModelClass.db.db;
  },

  getStreamAsync: function (fileMeta) {
    var id = fileMeta.fileId;
    var store = new GridStore(this.db, new ObjectID(id.toString()), 'r', {root: 'fs'});
    Promise.promisifyAll(store);
    return store.openAsync().then(function (db) {
      return {
        contentType: fileMeta.contentType,
        stream: db.stream(true)
      };
    });
  },

  putFileAsync: function (path, options) {
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

  replaceFileAsync: function (fileMeta, path, options) {
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

  deleteFileAsync: function (fileMeta) {
    var id = fileMeta.fileId;
    return GridStore.unlinkAsync(this.db, id);
  }
};
