'use strict';

var
  util = require('util'),
  path = require('path'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  mongoose  = require('mongoose'),
  HTTP_STATUSES   = require('http-statuses'),

  mmm = require('mmmagic'),
  Magic = mmm.Magic,

  RestifizerScope = require('./restifizer-scope'),
  gridfs = require('./gridfs'),
  utils = require('./utils');

var
  extend = utils.extend,
  setProp = utils.setProp,
  requireOptions = utils.requireOptions,
  CommonController = utils.CommonController,
  setResData = utils.setResData,
  setResError = utils.setResError,
  setResOk = utils.setResOk;

function FileDataService(options) {

  _.extend(this, options);

  this.options = options;

  var requiredOptions = ['ModelClass'];
  requireOptions(this, requiredOptions);

  this.modelFieldNames = this.fields || this.getModelFieldNames(this.ModelClass);

  this.initialize.apply(this, arguments);
}

_.extend(FileDataService.prototype, {

  initialize: function() {
    Promise.promisifyAll(this);
    this.ModelClass = Promise.promisifyAll(this.ModelClass);
  },

  selectOne: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT_ONE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return [model, fileField];
        }
      })
      .spread(function (model, fileField) {
        return this.getFileFieldAsync(fileField, model);
      })
      .spread(function (file, contentType) {
        if (this.postAsync) {
          this.postAsync(file, req, res)
            .then(function() {
              return [file, contentType];
            });
        } else {
          return [file, contentType];
        }
      })
      .spread(function (file, contentType) {
        if (file) {
          res.header('Content-Type', contentType);
          file.stream(true).pipe(res);
        } else {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      }
    );
  },

  update: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.UPDATE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.setFileFieldAsync(fileField, model, req, this.converter);
        }
      })
      .then(function(model) {
        return model.saveAsync();
      })
      .spread(function (model) {
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },

  delete: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.DELETE);

    Promise
      .bind(this)
      .then(function () {
        if (this.preAsync) {
          return this.preAsync(req, res);
        }
      })
      .then(function () {
        return this.locateModelAsync(req);
      })
      .spread(function (model, fileField) {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.cleanFileField(fileField, model);
        }
      })
      .then(function(model) {
        return model.saveAsync();
      })
      .spread(function (model) {
        if (this.postAsync) {
          return this.postAsync(model, req, res);
        } else {
          return model;
        }
      })
      .then(function () {
        setResOk(res);
        next();
      })
      .catch(function (err) {
        setResError(err, res, this.log);
        next();
      });
  },

  getFileField: function (fieldName, model, callback) {
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      if (typeof(fileMeta) === 'object') {
        Promise
          .bind(this)
          .then(function () {
            return gridfs.getFileAsync(this.ModelClass.db.db, fileMeta.fileId);
          })
          .then(function (file) {
            callback(null, file, fileMeta.contentType);
          })
          .catch(function (err) {
            callback(err);
          });
      } else {
        callback(new Error('Wrong fileMeta'));
      }
    } else {
      callback(HTTP_STATUSES.NOT_FOUND.createError());
    }
  },

  setFileField: function (fieldName, model, req, converter, callback) {
    var file = req.files && req.files[fieldName];
    if (file) {
      Promise
        .bind(this)
        .then(function () {
          var magic = new Magic(mmm.MAGIC_MIME_TYPE);
          Promise.promisifyAll(magic);
          return magic.detectFileAsync(file.path);
        })
        .then(function (mimeType) {
          var options = {mimeType: mimeType, path: file.path};
          if (converter) {
            return this.converterAsync(options)
          } else {
            return options;
          }
        })
        .then(function (result) {
          var options = {content_type: result.mimeType};
          var fieldValue = this.getFieldValue(model, fieldName);
          if (fieldValue) {
            return gridfs.replaceFileAsync(this.ModelClass.db.db, fieldValue.fileId, result.path, options);
          } else {
            return gridfs.putFileAsync(this.ModelClass.db.db, result.path, options);
          }
        })
        .then(function (result) {
          var fieldValue = this.setFieldValue(model, fieldName, result);
          callback(null, model);
        })
        .catch(function (err) {
          callback(err);
        })
      ;
    } else {
      callback(null, model);
    }
  },

  cleanFileField: function (fieldName, model, callback) {
    var fileMeta = this.getFieldValue(model, fieldName);
    if (fileMeta) {
      Promise
        .bind(this)
        .then(function () {
          return gridfs.deleteFileAsync(this.ModelClass.db.db, fileMeta.fileId);
        })
        .then(function () {
          this.setFieldValue(model, fieldName, undefined);
          callback(null, model);
        })
        .catch(function (err) {
          callback(err);
        })
      ;
    } else {
      callback(HTTP_STATUSES.NOT_FOUND.createError());
    }
  },

  getModelFieldNames: function (ModelClass) {
    var paths = _.pluck(this.ModelClass.schema.paths, 'path');
    return _.filter(paths, function (fieldName) {
      return (fieldName == '_id' || fieldName.substr(0, 2) !== '__');
    })
  },

  locateModel: function (req, callback) {
    var fileField;
    if (this.fileField.type === 'function') {
      fileField = this.fileField();
    } else {
      fileField = this.fileField;
    }
    // fill params
    _.each(_.keys(req.params), function(key) {
      fileField = fileField.replace(':' + key, req.params[key]);
    });
    Promise
      .bind(this)
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        return this.ModelClass.findOneAsync(conditions, fileField);
      })
      .then(function (model) {
        callback(null, model, fileField);
      })
      .catch(function (err) {
        callback(err);
      })
  },

  buildConditions: function (req, callback) {
    return callback(null, _.pick(req.params, _.keys(req.params)));
  },

  getFieldValue: function(model, fieldName) {
    return model.get(fieldName);
  },

  setFieldValue: function(model, fieldName, value) {
    this.setProp(model, fieldName, value);
  },

  setProp: setProp
});

FileDataService.extend = extend;

var FileFieldController = FileDataService.extend(_.extend(CommonController, {

  supportedMethod: 'put',
  supportedMethods: null,

  constructor: function(options) {
    FileDataService.apply(this, arguments);

    _.extend(this, options);

    var requiredOptions = ['ModelClass', 'path'];
    requireOptions(this, requiredOptions);

    // init

    this.defaultOptions = {
      enabled: true
    };

    this.selectOneOptions = _.defaults(this.selectOneOptions  || {}, this.defaultOptions);
    this.updateOptions    = _.defaults(this.updateOptions     || {}, this.defaultOptions);
    this.deleteOptions    = _.defaults(this.deleteOptions     || {}, this.defaultOptions);
  },

  initialize: function() {
    FileDataService.prototype.initialize.apply(this, arguments);
  },

  bind: function (app) {
    var _this = this;
    if (typeof(this.path) === 'string') {
      this.path = [this.path];
    }
    _.forEach(this.path, _.bind(function (path) {
      if (this.selectOneOptions.enabled) {
        app.get(path,
          this.getAuth(this.selectOneOptions),
          function (req, res, next) {
            _this.selectOne.apply(_this, arguments);
          },
          _this.resultSender
        );
      }
      if (this.updateOptions.enabled) {
        var supportedMethods = _this.supportedMethods || [_this.supportedMethod];
        _.each(supportedMethods, function (supportedMethod) {
          app[supportedMethod.toLowerCase()](path,
            _this.getAuth(_this.updateOptions),
            function (req, res, next) {
              _this.update.apply(_this, arguments);
            },
            _this.resultSender
          );
        })
      }
      if (this.deleteOptions.enabled) {
        app.delete(path,
          this.getAuth(this.deleteOptions),
          function (req, res, next) {
            _this.delete.apply(_this, arguments);
          },
          _this.resultSender
        );
      }
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  }
}));

FileFieldController.extend = extend;
FileFieldController.ACTIONS = RestifizerScope.ACTIONS;

module.exports = FileFieldController;
