/**
 * Created by igor on 07.10.15.
 */

'use strict';

const RestifizerFileField = require('../../../../index.js');

const BaseFileController = RestifizerFileField.Controller.extend({
  defaultOptions: {
    enabled: true,
  },
  actions: {
    default: {
      enabled: true,
    },
  },
});

module.exports = BaseFileController;
