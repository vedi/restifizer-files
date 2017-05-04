/**
 * Created by igor on 07.10.15.
 */

'use strict';

const request = require('request');
const fs = require('fs');
const Bb = require('bluebird');

module.exports = function (url, fileFormDataName) {
  const defaultUrl = url;
  const defaultFFDName = fileFormDataName;
  const reqParams = function (data) {
    const reqParam = {
      url: data.url || defaultUrl,
      formData: {},
    };
    const ffdn = data.fileFormDataName || defaultFFDName;
    reqParam.formData[ffdn] = fs.createReadStream(data.filePath);
    reqParam.formData.fileFormDataName = ffdn;
    return reqParam;
  };

  return {
    postPromise(data) {
      return Bb.fromNode((callback) => {
        request.post(reqParams(data), callback);
      });
    },
    putPromise(data) {
      return Bb.fromNode((callback) => {
        request.put(reqParams(data), callback);
      });
    },
    delPromise(data) {
      return Bb.fromNode((callback) => {
        request.del(data && data.url || defaultUrl, callback);
      });
    },
    getPromise(data) {
      return Bb.fromNode((callback) => {
        request.get(data && data.url || defaultUrl, callback);
      });
    },
  };
};
