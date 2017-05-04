/**
 * Created by igor on 09.10.15.
 */

const mongoose = require('mongoose');
const Snapshot = require('../app/models/snapshot');
const Photo = require('../app/models/photo');
const dataToMigrate = require('../dal').files;
const config = require('../app/config').mongoose;

mongoose.connect(config.connectionString, (err) => {
  if (err) {
    return console.log('Cannot connect to MongoDB. Error: ', err);
  }
  (new Snapshot(dataToMigrate.testFile.snapshot)).save((err) => {
    if (err) {
      return console.log('Migration. Error: ', err);
    }
    (new Photo(dataToMigrate.testFileLocal.photo)).save((err) => {
      if (err) {
        return console.log('Migration. Error: ', err);
      }
      console.log('Migration successfully completed');
      mongoose.connection.close();
    });
  });
});
