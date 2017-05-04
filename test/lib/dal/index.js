'use strict';

const config = require('../app/config');

module.exports = {
  files: {
    testFile: {
      filePath: `${__dirname}/files/picture.jpg`,
      url: `http://localhost:${config.express.port}/api/snapshots/myFirstSnapshot/picture`,
      fileFormDataName: 'picture',
      length: 174540,
      snapshot: {
        _id: 'myFirstSnapshot',
        description: "It's my first ever snapshot!",
        tags: [
          'sky',
          'sun',
          'water',
        ],
      },
    },
    testFileLocal: {
      filePath: `${__dirname}/files/picture.jpg`,
      url: `http://localhost:${config.express.port}/api/photos/myFirstPhoto/picture`,
      fileFormDataName: 'picture',
      length: 174540,
      photo: {
        _id: 'myFirstPhoto',
        description: 'Wild nature',
        tags: [
          'first',
          'nature',
        ],
      },
    },
  },
};
