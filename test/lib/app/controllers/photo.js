/**
 * Created by igor on 09.10.15.
 */

'use strict';

const BaseFileController = require('./base.file');
const Photo = require('../models/photo');
const MongooseDataSource = require('restifizer-mongoose-ds');

module.exports = BaseFileController.extend({
  dataSource: new MongooseDataSource(Photo),
  path: '/api/photos/:_id/picture',
  fileField: 'picture',
  supportedMethods: ['post', 'put', 'get', 'del'],
  provider: 'local',
  uploadRoot: __dirname,
  uploadPath: '../../dal/files/uploaded',
});
