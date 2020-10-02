/**
 * Created by vedi on 11/21/13.
 */

'use strict';

const Bb = require('bluebird');
const mongoose = require('mongoose');

const GridStore = Bb.promisifyAll(mongoose.mongo.GridStore);
const ObjectID = mongoose.mongo.ObjectID;

class GridFsStorage {

  initialize(options) {
    this.db = options.dataSource.ModelClass.db.db;
  }

  getStream(fileMeta) {
    const id = fileMeta.fileId;
    const store = new GridStore(this.db, new ObjectID(id.toString()), 'r', { root: 'fs' });
    Bb.promisifyAll(store);
    return store.openAsync().then(db => ({
      contentType: fileMeta.contentType,
      contentLength: db.stream(true).totalBytesToRead,
      stream: db.stream(true),
      GridFile: db
    }));
  }

  putFile(path, options) {
    const { fileName, ...rest } = options;
    options = rest || {};
    const gridStore = Bb
      .promisifyAll(new GridStore(this.db, new ObjectID(), fileName, 'w', options));

    return Bb
      .try(() => gridStore.openAsync())
      .then(() => gridStore.writeFileAsync(path))
      .then(doc => ({
        contentType: doc.contentType,
        fileName: doc.filename,
        fileId: doc.fileId,
        root: doc.root,
        uploadDate: doc.uploadDate,
      }));
  }

  replaceFile(fileMeta, path, options) {
    const id = fileMeta.fileId;
    const { fileName, ...rest } = options;

    return Bb
      .bind(this)
      .then(() => {
        options = rest || {};
        options.root = 'fs';
        const store = Bb.promisifyAll(new GridStore(this.db, id, fileName, 'w', options));
        return store.openAsync();
      })
      .then(store => store.rewindAsync())
      .then(gridStore => gridStore.writeFileAsync(path))
      .then(doc => ({
        contentType: doc.contentType,
        fileName: doc.filename,
        fileId: doc.fileId,
        root: doc.root,
        uploadDate: doc.uploadDate,
      }))
      ;
  }

  deleteFile(fileMeta) {
    const id = fileMeta.fileId;
    return GridStore.unlinkAsync(this.db, id);
  }
}

module.exports = GridFsStorage;
