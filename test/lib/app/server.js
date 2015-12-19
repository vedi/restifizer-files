'use strict';

var express = require('express');
var http = require('http');
var Restifizer = require('restifizer');
var config = require('./config');
var bodyParser = require('body-parser');
var multipart = require('connect-multiparty');

var mongoose = require('mongoose');
mongoose.connect(config.mongoose.connectionString, function (err) {
	if (err) {
		console.error('Cannot connect to MongoDB');
		return console.log(err);
	}

	var app = express();
    app.use(multipart());
	app.use(bodyParser.json());
	app.route('/').get(function (req, res) {
		res.end('Restifizer-files test application.');
	});

	var restifizer = new Restifizer(app, {});
	restifizer.addController(require('./controllers/snapshot'));
    restifizer.addController(require('./controllers/photo'));

	var server = http.Server(app);
	server.listen(config.express.port);
	console.log('Test app server is listening on port ', config.express.port);
});