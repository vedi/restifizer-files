'use strict';

const _ = require('lodash');
const RestifizerFileFieldController = require('./lib/restifizer-files');

class RestifizerFiles {
  constructor(app, options) {
    this.app = app;
    this.restifizerOptions = options || {};
  }

  createController(Controller) {
    return new Controller(_.clone(this.restifizerOptions));
  };

  addController(Controller) {
    this.bind(this.createController(Controller));
    return this;
  };

  bind(controller) {
    controller.bind(this.app);
    return this;
  };

}


RestifizerFiles.Controller = RestifizerFileFieldController;

module.exports = RestifizerFiles;
