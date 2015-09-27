'use strict';

var
  _ = require('lodash'),
  path = require('path'),
  Promise = require('bluebird'),
  HTTP_STATUSES = require('http-statuses'),

  mmm = require('mmmagic'),
  Magic = mmm.Magic,

  RestifizerScope = require('./restifizer-scope'),
  utils = require('./utils');

var
  extend = utils.extend,
  requireOptions = utils.requireOptions,
  CommonController = utils.CommonController,
  setResError = utils.setResError,
  setResOk = utils.setResOk;

function FileDataService(options) {

  _.extend(this, options);

  var requiredOptions = ['dataSource', 'path', 'fileField'];
  requireOptions(this, requiredOptions);

  this.provider = this.provider || 'gridfs';
  this._provider = require('../storages/' + this.provider);

  if (_.isFunction(this.dataSource.initialize)) {
    this.dataSource.initialize.call(this.dataSource, this);
  }
  this.initialize.apply(this, arguments);
  this._provider.initialize.call(this._provider, this);
}

_.extend(FileDataService.prototype, {

  initialize: function() {
    Promise.promisifyAll(this);
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
      .spread(function (stream, contentType) {
        if (this.postAsync) {
          this.postAsync(stream, req, res)
            .then(function() {
              return [stream, contentType];
            });
        } else {
          return [stream, contentType];
        }
      })
      .spread(function (stream, contentType) {
        if (stream) {
          var _this = this;
          res.header('Content-Type', contentType);
          stream.on('error', function (error) {
            if (_this.log) {
              _this.log.error('Stream error', error);
            } else {
              console.log('Stream error', error);
            }
          });
          stream.pipe(res);
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

  replace: function (req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.REPLACE);

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
          return this.setFileFieldAsync(fileField, model, req);
        }
      })
      .then(function(model) {
        return this.dataSource.saveAsync(model);
      })
      .then(function (model) {
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
        return this.dataSource.saveAsync(model);
      })
      .then(function (model) {
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

  getFileFieldAsync: function (fieldName, model) {
    return Promise
      .bind(this)
      .then(function () {
        var fileMeta = this.dataSource.getFieldValue(model, fieldName);
        if (fileMeta) {
          return Promise
            .bind(this)
            .then(function () {
              return this._provider.getStreamAsync(fileMeta);
            })
            .then(function (stream) {
              return [stream, fileMeta.contentType];
            });
        } else {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
      });
  },

  setFileFieldAsync: function (fieldName, model, req) {
    return Promise
      .bind(this)
      .then(function() {
        var file = req.files && req.files[fieldName];
        if (file) {
          return Promise
            .bind(this)
            .then(function () {
              var magic = new Magic(mmm.MAGIC_MIME_TYPE);
              Promise.promisifyAll(magic);
              return magic.detectFileAsync(file.path);
            })
            .then(function (mimeType) {
              var options = {mimeType: mimeType, path: file.path};
              if (this.converterAsync) {
                return this.converterAsync(options)
              } else {
                return options;
              }
            })
            .then(function (result) {
              var options = {content_type: result.mimeType};
              var fileMeta = this.dataSource.getFieldValue(model, fieldName);
              if (fileMeta) {
                return this._provider.replaceFileAsync(fileMeta, result.path, options);
              } else {
                return this._provider.putFileAsync(result.path, options);
              }
            })
            .then(function (result) {
              this.dataSource.setFieldValue(model, fieldName, result);
              return model;
            })
            ;
        } else {
          return model;
        }
      });
  },

  cleanFileField: function (fieldName, model, callback) {
    var fileMeta = this.dataSource.getFieldValue(model, fieldName);
    if (fileMeta) {
      Promise
        .bind(this)
        .then(function () {
          return this._provider.deleteFileAsync(fileMeta);
        })
        .then(function () {
          this.dataSource.setFieldValue(model, fieldName, undefined);
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

  locateModelAsync: function (req) {
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
    return Promise
      .bind(this)
      .then(function () {
        return this.buildConditionsAsync(req);
      })
      .then(function (conditions) {
        return this.dataSource.findOneAsync({filter: conditions, fields: [fileField]});
      })
      .then(function (model) {
        return [model, fileField];
      });
  },

  buildConditionsAsync: function (req) {
    return _.pick(req.params, _.keys(req.params));
  }
});

FileDataService.extend = extend;

var FileFieldController = FileDataService.extend(_.extend(CommonController, {

  supportedMethod: 'put',
  supportedMethods: null,

  constructor: function(options) {

    FileDataService.apply(this, arguments);

    _.extend(this, options);

    var requiredOptions = ['path', 'fileField'];
    requireOptions(this, requiredOptions);

    this.actions = this.actions || [];

    // init

    this.actions.default = this.actions.default || {};

    this.defaultOptions = _.assign(
      {
        enabled: true,
        method: 'get'
      },
      this.actions.default
    );

    this.restActions = {};

    this.actions.selectOne = _.defaults(this.actions.selectOne || {}, this.actions.default);
    this.restActions.selectOne = _.assign(
      {
        method: 'get',
        handler: 'selectOne',
        path: ''
      },
      this.actions.selectOne
    );

    this.actions.replace = _.defaults(this.actions.replace || {}, this.actions.default);
    this.restActions.replace = _.assign(
      {
        method: this.supportedMethods || [this.supportedMethod],
        handler: 'replace',
        path: ''
      },
      this.actions.replace
    );

    this.actions.delete = _.defaults(this.actions.delete || {}, this.actions.default);
    this.restActions.delete = _.assign(
      {
        method: 'delete',
        handler: 'delete',
        path: ''
      },
      this.actions.delete
    );

    this.actions = _.omit(this.actions, 'default', 'selectOne', 'replace', 'delete');
    _.forEach(this.actions, function (action, actionKey) {
      if (typeof(action) !== 'object') {
        // interpret it as bool
        action = {
          enabled: !!action
        };
        this.actions[actionKey] = action;
      }
      _.defaults(action, this.defaultOptions);
      action.path = action.path || actionKey;
      action.handler = action.handler || actionKey;
      action.name = actionKey;
    }, this);

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
      _.forEach(_.union(_.values(this.actions), _.values(this.restActions)), function (action) {
        try {
          if (action.enabled) {
            if (typeof(action.method) === 'string') {
              action.method = [action.method];
            }
            _.forEach(action.method, _.bind(function (method) {
              app[method](path + '/' + action.path,
                this.getAuth(action),
                function (req, res, next) {
                  _this[action.handler].apply(_this, arguments);
                },
                this.resultSender
              );
            }, this));
          }
        } catch (err) {
          if (this.log) {
            this.log.error('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
            this.log.error('Error', err);
          } else {
            console.log('Set route for action: ' + action.name + ' and path ' + path + '/' + action.path);
            console.log('Error', err);
          }

          throw err;
        }
      }, this);
    }, this));
  },
  resultSender: function(req, res) {
    res.send(res.restfulResult);
  }
}));

FileFieldController.extend = extend;
FileFieldController.ACTIONS = RestifizerScope.ACTIONS;

module.exports = FileFieldController;
