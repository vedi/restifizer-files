'use strict';

const config = require('../../lib/app/config').mongoose;
const mongoose = require('mongoose');

module.exports = function () {
  this.registerHandler('AfterFeatures', (event, callback) => {
	    mongoose.connect(config.connectionString, (err) => {
      if (err) {
        console.log(`\n\nCannot connect to MongoDB!\nError: ${err}`);
        return callback();
      }
      mongoose.connection.db.dropDatabase((err, result) => {
        if (err) {
          console.log(`\n\nCannot drop MongoDB test database!\nError: ${err}`);
        } else {
          console.log('\n\nMongoDB test database successfully removed.');
        }
        callback();
      });
    });
  });
};
