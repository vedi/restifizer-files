'use strict';

var Bb = require('bluebird');
var expect = require('chai').expect;
var resolveProp = require('../../lib/prop-util').resolveProp;

module.exports = function () {
    //Send request
    this.When(/^I send (get|post|put|delete) request to handle ([^\s]+)$/, function (method, testFileSource, callback) {
        var resolvedSource = resolveProp(this.dataSource, testFileSource);
        var _this = this;
        Bb.try(function () {
            switch (method) {
                case 'get':
                    return _this.fileRestClient.getPromise(resolvedSource);
                case 'post':
                    return _this.fileRestClient.postPromise(resolvedSource);
                case 'put':
                    return _this.fileRestClient.putPromise(resolvedSource);
                case 'delete':
                    return _this.fileRestClient.delPromise(resolvedSource);
            }
        })
        .spread(function (res, body) {
            _this.res = res;
            _this.body = body;
        })
        .then(callback)
        .catch(callback.fail);
    });

    //Response status
    this.Then(/^I should get (success|fail) with code ([\d]*)$/, function (flag, code, callback) {
        expect(this.res.statusCode).to.be.equal(parseInt(code));
        callback();
    });
    this.Then(/^I get an array with length equals to ([\d]*) in response$/, function (value, callback) {
        expect(this.body.length).to.be.equal(+value);
        callback();
    });
};