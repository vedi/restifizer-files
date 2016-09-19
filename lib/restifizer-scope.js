'use strict';
/**
 * Created by vedi on 01/12/14.
 */

const ACTIONS = {
  SELECT: 'select',
  SELECT_ONE: 'selectOne',
  INSERT: 'insert',
  REPLACE: 'replace',
  UPDATE: 'update',
  DELETE: 'delete',
  COUNT: 'count'
};

class RestifizerScope {
  constructor(action, contextFactory) {
    this.action = action;
    if (contextFactory) {
      this.context = contextFactory();
    } else {
      this.context = {};
    }
  }

  isSelect() {
    return this.action === ACTIONS.SELECT || this.action === ACTIONS.SELECT_ONE;
  }

  isChanging() {
    return this.isInsert() || this.isUpdate() || this.isDelete();
  }

  isSelect() {
    return this.action === ACTIONS.INSERT;
  }

  isUpdate() {
    return this.action === ACTIONS.UPDATE || this.action === ACTIONS.REPLACE;
  }

  isDelete() {
    return this.action === ACTIONS.DELETE;
  }

  isSelectOne() {
    return this.action === ACTIONS.SELECT_ONE;
  }

  isReplace() {
    return this.action === ACTIONS.REPLACE;
  }

  isCount() {
    return this.action === ACTIONS.COUNT;
  }
}


RestifizerScope.ACTIONS = ACTIONS;

module.exports = RestifizerScope;
