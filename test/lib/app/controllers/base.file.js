/**
 * Created by igor on 07.10.15.
 */
'use strict';

var RestifizerFileField = require('../../../../index.js');

var BaseFileController = RestifizerFileField.Controller.extend({
    defaultOptions: {
        enabled: true
    },
    actions: {
        'default': {
            enabled: true
        }
    }
});

module.exports = BaseFileController;