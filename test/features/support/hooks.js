'use strict';

var requestFile = require('../../lib/promised-request-file');
var fileConfig = require('../../lib/dal').files.testFile;

module.exports = function () {
	this.Before(function (callback) {
		this.fileRestClient = requestFile(fileConfig.url, fileConfig.fileFormDataName);
        callback();
	});
};