'use strict';

var dataSource = require('../../lib/dal');
var _ = require('lodash');

module.exports = function () {
	this.World = function World(callback) {
		this.dataSource = dataSource;	
		callback();
	};
};