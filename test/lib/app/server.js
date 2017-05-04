'use strict';

const express = require('express');
const http = require('http');
const Restifizer = require('restifizer');
const config = require('./config');
const bodyParser = require('body-parser');
const multipart = require('connect-multiparty');
const mongoose = require('mongoose');

mongoose.connect(config.mongoose.connectionString, (err) => {
  if (err) {
    console.error('Cannot connect to MongoDB');
    return console.log(err);
  }

  const app = express();
  app.use(multipart());
  app.use(bodyParser.json());
  app.route('/').get((req, res) => {
    res.end('Restifizer-files test application.');
  });

  const restifizer = new Restifizer(app, {});
  restifizer.addController(require('./controllers/snapshot'));
  restifizer.addController(require('./controllers/photo'));

  const server = http.Server(app);
  server.listen(config.express.port);
  console.log('Test app server is listening on port ', config.express.port);
});
