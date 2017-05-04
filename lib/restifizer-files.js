/**
 * Created by vedi on 02/10/16.
 */

'use strict';

const _ = require('lodash');
const FileController = require('./file-controller');
const ExpressTransport = require('./transports/express.transport');

class RestifizerFiles {
  constructor(options) {
    this.restifizerOptions = options || {};
  }

  createController(Controller) {
    return new Controller(_.clone(this.restifizerOptions));
  }

  addController(Controller) {
    this.bind(this.createController(Controller));
    return this;
  }

  bind(controller) {
    controller.bind();
    return this;
  }
}


RestifizerFiles.Controller = FileController;
RestifizerFiles.ExpressTransport = ExpressTransport;

module.exports = RestifizerFiles;
