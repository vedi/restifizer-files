'use strict';

const _ = require('lodash');
const Bb = require('bluebird');
const HTTP_STATUSES = require('http-statuses');
const mmm = require('mmmagic');

const utils = require('./utils');

const Magic = mmm.Magic;
const requireOptions = utils.requireOptions;

class FileDataService {
  constructor(options, ...other) {
    Object.assign(this, options);

    const requiredOptions = ['dataSource', 'path', 'fileField'];
    requireOptions(this, requiredOptions);

    if (this.dataSource && this.dataSource.type) {
// eslint-disable-next-line global-require,import/no-dynamic-require
      this.dataSource = require(`./data-sources/${this.dataSource.type}`)(this.dataSource.options);
      options.dataSource = this.dataSource;
    }

    this.storage = this.storage || 'gridfs';
// eslint-disable-next-line global-require,import/no-dynamic-require
    const StorageClass = require(`./storages/${this.storage}`);
    this._storage = new StorageClass();

    if (_.isFunction(this.dataSource.initialize)) {
      this.dataSource.initialize.call(this.dataSource, this);
    }
    this.initialize(options, ...other);
    this._storage.initialize(this);
  }

  initialize() {
  }

  selectOne(scope) {
    return this
      .locateModel(scope, true, true)
      .then((model) => {
        const fileFieldName = this.getFileFieldName(scope);
        return this.getFileField(fileFieldName, model, scope);
      })
      .then((fileData) => {
        scope.fileData = fileData;
        return this._handlePost(scope.fileData, scope);
      })
      .then((fileData) => {
        if (fileData.stream) {
          return fileData;
        } else {
          return Bb.reject(HTTP_STATUSES.NOT_FOUND.createError());
        }
      });
  }

  replace(scope) {
    return this
      .locateModel(scope)
      .then((model) => {
        const { body } = scope;
        scope.source = body;
        scope.model = model;
        const fileFieldName = this.getFileFieldName(scope);
        return this.setFileField(fileFieldName, model, scope);
      })
      .then(() => this.dataSource.save(scope.model))
      .then(() => this._handlePost(scope.model, scope));
  }

  'delete'(scope) {
    return this
      .locateModel(scope, true, false)
      .then((model) => {
        scope.model = model;
        const fileFieldName = this.getFileFieldName(scope);
        return this.cleanFileField(fileFieldName, model, scope);
      })
      .then(model => this.dataSource.save(model))
      .then(() => this._handlePost(scope.model, scope));
  }

  getFetchingFields(scope) {
    return [this.getFileFieldName(scope)];
  }

  getFileFieldName(scope) {
    const { params } = scope;
    let fileField;
    if (this.fileField.type === 'function') {
      fileField = this.fileField();
    } else {
      fileField = this.fileField;
    }
    // fill params
    Object.keys(params).forEach((key) => {
      fileField = fileField.replace(`:${key}`, params[key]);
    });

    return fileField;
  }

  /**
   * Get metadata of file with stream data. {contentType, contentLength, stream}
   * @param fieldName
   * @param model
   * @returns {*|Bb.<T>}
   */
  getFileField(fieldName, model, scope) {
    return Bb
      .try(() => {
        const fileMeta = this.getFileMeta(model, fieldName);
        if (fileMeta) {
          return Bb
            .try(() => this._storage.getStream(fileMeta, scope))
            .then(fileData => fileData);
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

  setFileField(fieldName, model, scope) {
    const { transport } = scope;
    return Bb
      .try(() => {
        const file = transport.getFile(fieldName, scope);
        if (file) {
          scope.file = file;
          return Bb
            .try(() => {
              const magic = new Magic(mmm.MAGIC_MIME_TYPE);
              Bb.promisifyAll(magic);
              return magic.detectFileAsync(file.path);
            })
            .then((mimeType) => {
              const options = { mimeType, scope, path: file.path };
              if (this.converter) {
                return this.converter(options);
              } else {
                return options;
              }
            })
            .then((result) => {
              const options = { content_type: result.mimeType, fileName: this.getFileName(scope) };
              const fileMeta = this.getFileMeta(model, fieldName);
              if (fileMeta) {
                return this._storage.replaceFile(fileMeta, result.path, options, scope);
              } else {
                return this._storage.putFile(result.path, options, scope);
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

  cleanFileField(fieldName, model, scope) {
    const fileMeta = this.getFileMeta(model, fieldName);
    if (fileMeta) {
      return Bb
        .try(() => this._storage.deleteFile(fileMeta, scope))
        .then(() => {
          this.setFileMeta(model, fieldName, undefined);
          return model;
        });
    } else {
      throw HTTP_STATUSES.NOT_FOUND.createError();
    }
  }

  /**
   * Perform all preparations, create query, which locates document regarding scope.req params,
   * and returns it to callback
   * @param scope scope
   * @param strict throws NOT_FOUND if no record found, default is `true`
   * @param withQueryPipe pass it through queryPipe, default is `true`
   * @returns {Promise<model>}
   */
  locateModel(scope, strict, withQueryPipe) {
    strict = strict !== undefined ? strict : true;
    withQueryPipe = withQueryPipe !== undefined ? withQueryPipe : true;
    return Bb
      .try(this._handlePre.bind(this, scope))
      .then(this.buildConditions.bind(this, scope))
      .then((filter) => {
        scope.fieldList = this.getFetchingFields(scope);
        return this.dataSource.findOne({
          filter,
          fields: scope.fieldList,
          queryPipe: (withQueryPipe && this.queryPipe) ? (query) => {
            this.queryPipe(query, scope);
          } : undefined,
        });
      })
      .then((model) => {
        if (strict && !model) {
          throw HTTP_STATUSES.NOT_FOUND.createError(
            'Cannot locate resource', { error: 'ResourceNotFound' });
        }

        return model;
      });
  }

  /**
   * Builds object to passed as condition to dataSource
   * @param scope
   * @returns {*}
   */
  buildConditions(scope) {
    const { params } = scope;
    scope.source = _.pick(params, Object.keys(params));
    return scope.source;
  }

  /**
   * Returns value, used as a fileName in storage, if it supports that.
   * @param {Object} scope
   * @returns {string | undefined} nothing or file name
   */
  getFileName(scope) {
  }

  _handlePre(scope) {
    return Bb
      .try(() => scope.transport.pre(scope))
      .then(() => {
        if (_.isFunction(this.pre)) {
          return this.pre(scope);
        } else {
          return scope;
        }
      });
  }

  _handlePost(fileData, scope) {
    return Bb
      .try(() => {
        if (_.isFunction(this.post)) {
          return Bb
            .try(this.post.bind(this, fileData, scope))
            .then((result) => {
              fileData = result;
              return result;
            });
        }
      })
      .then(() => scope.transport.post(scope))
      .then(() => fileData);
  }

}

module.exports = FileDataService;
