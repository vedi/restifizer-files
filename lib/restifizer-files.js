'use strict';

const _ = require('lodash');
const Bb = require('bluebird');
const HTTP_STATUSES = require('http-statuses');
const mmm = require('mmmagic');

const RestifizerScope = require('./restifizer-scope');
const utils = require('./utils');

const Magic = mmm.Magic;
const requireOptions = utils.requireOptions;
const setResError = utils.setResError;
const setResOk = utils.setResOk;

class FileDataService {
  constructor(options) {

    Object.assign(this, options);

    const requiredOptions = ['dataSource', 'path', 'fileField'];
    requireOptions(this, requiredOptions);

    this.provider = this.provider || 'gridfs';
// eslint-disable-next-line global-require,import/no-dynamic-require
    this._provider = require(`../storages/${this.provider}`);

    if (_.isFunction(this.dataSource.initialize)) {
      this.dataSource.initialize.call(this.dataSource, this);
    }
    this.initialize.apply(this, arguments);
    this._provider.initialize.call(this._provider, this);
  }

  initialize() {
  }

  selectOne(req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.SELECT_ONE);

    Bb
      .try(() => {
        if (this.pre) {
          return this.pre(req, res);
        }
      })
      .then(() => {
        return this.locateModel(req);
      })
      .spread((model, fileField) => {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return [model, fileField];
        }
      })
      .spread((model, fileField) => {
        return this.getFileField(fileField, model);
      })
      .then((fileData) => {
        if (this.post) {
          return this.post(fileData, req, res);
        } else {
          return fileData;
        }
      })
      .then((fileData) => {
        if (fileData.stream) {
          res.header('Content-Type', fileData.contentType);
          res.header('Content-Length', fileData.contentLength);
          fileData.stream.on('error', (error) => {
            if (this.log) {
              this.log.error('Stream error', error);
            } else {
              console.log('Stream error', error);
            }
          });
          fileData.stream.pipe(res);
        } else {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
      })
      .catch((err) => {
        setResError(err, res, this.log);
        next();
      });
  }

  replace(req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.REPLACE);

    Bb
      .bind(this)
      .then(() => {
        if (this.pre) {
          return this.pre(req, res);
        }
      })
      .then(() => this.locateModel(req))
      .spread((model, fileField) => {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.setFileField(fileField, model, req);
        }
      })
      .then((model) => this.dataSource.save(model))
      .then((model) => {
        if (this.post) {
          return this.post(model, req, res);
        } else {
          return model;
        }
      })
      .then(() => {
        setResOk(res);
        next();
      })
      .catch((err) => {
        setResError(err, res, this.log);
        next();
      });
  }

  delete(req, res, next) {
    req.restifizer = new RestifizerScope(RestifizerScope.ACTIONS.DELETE);

    Bb
      .try(() => {
        if (this.pre) {
          return this.pre(req, res);
        }
      })
      .then(() => this.locateModel(req))
      .spread((model, fileField) => {
        if (!model) {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        } else {
          return this.cleanFileField(fileField, model);
        }
      })
      .then((model) => this.dataSource.save(model))
      .then((model) => {
        if (this.post) {
          return this.post(model, req, res);
        } else {
          return model;
        }
      })
      .then(() => {
        setResOk(res, HTTP_STATUSES.NO_CONTENT.code);
        next();
      })
      .catch((err) => {
        setResError(err, res, this.log);
        next();
      });
  }

  /**
   * Get metadata of file with stream data. {contentType, contentLength, stream}
   * @param fieldName
   * @param model
   * @returns {*|Bb.<T>}
   */
  getFileField(fieldName, model) {
    return Bb
      .try(() => {
        const fileMeta = this.getFileMeta(model, fieldName);
        if (fileMeta) {
          return Bb
            .try(() => this._provider.getStream(fileMeta))
            .then((fileData) => fileData);
        } else {
          throw HTTP_STATUSES.NOT_FOUND.createError();
        }
      });
  }

  getFileMeta(model, fieldName) {
    return this.dataSource.getFieldValue(model, fieldName);
  }

  setFileMeta(model, fieldName, result) {
    this.dataSource.setFieldValue(model, fieldName, result);
  }

  setFileField(fieldName, model, req) {
    return Bb
      .try(() => {
        const file = req.files && req.files[fieldName];
        if (file) {
          return Bb
            .try(() => {
              const magic = new Magic(mmm.MAGIC_MIME_TYPE);
              Bb.promisifyAll(magic);
              return magic.detectFileAsync(file.path);
            })
            .then((mimeType) => {
              const options = { mimeType, path: file.path };
              if (this.converter) {
                return this.converter(options);
              } else {
                return options;
              }
            })
            .then((result) => {
              var options = {content_type: result.mimeType};
              var fileMeta = this.getFileMeta(model, fieldName);
              if (fileMeta) {
                return this._provider.replaceFile(fileMeta, result.path, options);
              } else {
                return this._provider.putFile(result.path, options);
              }
            })
            .then((result) => {
              this.setFileMeta(model, fieldName, result);
              return model;
            });
        } else {
          return model;
        }
      });
  }

  cleanFileField(fieldName, model) {
    var fileMeta = this.getFileMeta(model, fieldName);
    if (fileMeta) {
      return Bb
        .try(() => {
          return this._provider.deleteFile(fileMeta);
        })
        .then(() => {
          this.setFileMeta(model, fieldName, result);
          return model;
        });
    } else {
      throw HTTP_STATUSES.NOT_FOUND.createError();
    }
  }

  locateModel(req) {
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
    return Bb
      .try(() => {
        return this.buildConditions(req);
      })
      .then((conditions) => {
        return this.dataSource.findOne({filter: conditions, fields: [fileField]});
      })
      .then((model) => {
        return [model, fileField];
      });
  }

  buildConditions(req) {
    return _.pick(req.params, _.keys(req.params));
  }
}

class FileFieldController extends FileDataService {
  constructor(options) {

    super(options);

    this.supportedMethod = 'put'; // TODO: It's too general name, and confusing
    this.supportedMethods = null;
    Object.assign(this, options);

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

  }

  initialize() {
    super.initialize();
  }

  bind(app) {
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
  }

  resultSender(req, res) {
    res.send(res.restfulResult);
  }

  getAuth(options) {
    return function(req, res, callback) {
      callback();
    };
  }
}

FileFieldController.ACTIONS = RestifizerScope.ACTIONS;

module.exports = FileFieldController;

