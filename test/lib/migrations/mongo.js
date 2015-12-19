/**
 * Created by igor on 09.10.15.
 */

var mongoose = require('mongoose');
var Snapshot = require('../app/models/snapshot');
var Photo = require('../app/models/photo');
var dataToMigrate = require('../dal').files;
var config = require('../app/config').mongoose;

mongoose.connect(config.connectionString, function (err) {
    if (err) {
        return console.log('Cannot connect to MongoDB. Error: ', err);
    }
    (new Snapshot(dataToMigrate.testFile.snapshot)).save(function (err) {
        if (err) {
            return console.log('Migration. Error: ', err);
        }
        (new Photo(dataToMigrate.testFileLocal.photo)).save(function (err) {
            if (err) {
                return console.log('Migration. Error: ', err);
            }
            console.log('Migration successfully completed');
            mongoose.connection.close();
        });
    });
});