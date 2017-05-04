'use strict';

const dataSource = require('../../lib/dal');
const _ = require('lodash');

module.exports = function () {
  this.World = function World(callback) {
    this.dataSource = dataSource;
    callback();
  };
};
