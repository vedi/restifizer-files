/**
 * Created by vedi on 10/09/16.
 */

'use strict';

class ExpressTransport {

  constructor(options) {
    this.transportName = 'express';
    this.app = options.app;
    this.compatibilityMode = options.compatibilityMode;
  }

  pre(scope) {
    return scope;
  }

  post(scope) {
    if (scope.collection) {
      this._addLinkHeaders(scope.pagination, scope.collection.length, scope);
    }
  }

  getQ(scope) {
    return scope.transportData.req.query.q;
  }

  getBody(scope) {
    return scope.transportData.req.body;
  }

  getParams(scope) {
    return scope.transportData.req.params;
  }

  getQuery(scope) {
    return scope.transportData.req.query;
  }

  getFields(scope) {
    const fields = scope.transportData.req.query.fields;
    return fields ? fields.split(',') : undefined;
  }

  getFilter(scope) {
    const filter = scope.transportData.req.query.filter;
    return filter ? JSON.parse(filter) : undefined;
  }

  getOrderBy(scope) {
    const orderBy = scope.transportData.req.query.orderBy;
    return orderBy ? JSON.parse(orderBy) : undefined;
  }

  getPagination(scope) {
    const req = scope.transportData.req;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.perPage || req.query.per_page, 10);

    return {
      page,
      limit,
    };
  }

  /**
   * Returns handler for authentication.
   * @param action
   * @returns function to handle
   */
  getAuth(action) {
    return function (req, res, callback) {
      callback();
    };
  }

  addRoute(controller, method, paths, action, handlerFn) {
    paths.forEach((path) => {
      this.app[method](`${path}/${action.path}`,
        this.getAuth(action),
        (req, res) => {
          const scope = action.createScope(controller, this);

          scope.transportData.req = req;
          scope.transportData.res = res;

          if (this.compatibilityMode) {
            scope.req = req;
            scope.res = res;
          }

          handlerFn(scope);
        }
      );
    });
  }

  setResData(data, scope, statusCode) {
    const transportData = scope.transportData;
    const res = transportData.res;

    if (typeof data !== 'undefined') {
      if (transportData.req.method.toLowerCase() !== 'head') {
        scope.restfulResult = data;
        res.restfulResult = data; // we need a way to get it from res
      }
    }

    res.statusCode = statusCode;
  }

  sendResult(result, scope) {
    result = result || scope.restfulResult;
    scope.transportData.res.send(result);
  }

  getFile(fieldName, scope) {
    const { transportData: { req } } = scope;
    return req.files && req.files[fieldName];
  }

  sendStream(streamData, scope) {
    let bufferSize = 1024 * 1024;
    const {transportData: {res, req}} = scope;
    const {GridFile} = streamData;

    if (req.headers['range']) {
      let parts = req.headers['range'].replace(/bytes=/, "").split("-");
      let partialStart = parts[0];
      let partialEnd = parts[1];
      let start = partialStart ? parseInt(partialStart, 10) : 0;
      let end = partialEnd ? parseInt(partialEnd, 10) : GridFile.length - 1;
      let chunkSize = (end - start) + 1;

      if (chunkSize === 1) {
        start = 0;
        partialEnd = false;
      }
      if (!partialEnd) {
        if (((GridFile.length - 1) - start) < (bufferSize)) {
          end = GridFile.length - 1;
        } else {
          end = start + (bufferSize);
        }
        chunkSize = (end - start) + 1;
      }
      res.writeHead(206, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + GridFile.length,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': GridFile.contentType
      });

      GridFile.seek(start, function () {
        const stream = GridFile.stream(true);
        let bufferIdx = 0;
        let bufferAvail = 0;
        let range = (end - start) + 1;
        const totalBytesWanted = (end - start) + 1;
        let totalBytesWritten = 0;

        stream.on('data', function (buff) {
          bufferAvail += buff.length;
          if (bufferAvail < range) {
            if (bufferAvail > 0) {
              res.write(buff);
              totalBytesWritten += buff.length;
              range -= buff.length;
              bufferIdx += buff.length;
              bufferAvail -= buff.length;
            }
          } else {
            if (bufferAvail > 0) {
              let buffer = buff.slice(0, range);

              res.write(buffer);
              totalBytesWritten += buffer.length;
              bufferIdx += range;
              bufferAvail -= range;
            }
          }
          if (totalBytesWritten >= totalBytesWanted) {
            totalBytesWritten = 0;
            GridFile.close();
            res.end();
            this.destroy();
          }
        });
      });
    } else {
      res.header('Content-Type', GridFile.contentType);
      res.header('Content-Length', GridFile.length);
      let stream = GridFile.stream(true);
      stream.pipe(res);
    }
  }

  _addLinkHeaders(pagination, currentLength, scope) {
    const transportData = scope.transportData;
    const page = pagination.page;
    const limit = pagination.limit;
    const initialUrl = transportData.req.url;
    const cleanedUrl = initialUrl
      .replace(`perPage=${limit}`, '')
      .replace(`page=${page}`, '')
      .replace('&&', '&')
      .replace('&&', '&')
      .replace('?&', '?');

    const fullURL = `${transportData.req.protocol}://${transportData.req.get('host')}${cleanedUrl}`;
    const links = {};
    // add prev
    if (page > 1) {
      let prevLink = `${fullURL}&page=${page - 1}&perPage=${limit}`;
      prevLink = prevLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.prev = prevLink;
    }
    if (currentLength >= limit) {
      let nextLink = `${fullURL}&page=${page + 1}&perPage=${limit}`;
      nextLink = nextLink
        .replace('&&', '&')
        .replace('?&', '?');
      links.next = nextLink;
    }
    transportData.res.links(links);
  }
}

module.exports = ExpressTransport;
