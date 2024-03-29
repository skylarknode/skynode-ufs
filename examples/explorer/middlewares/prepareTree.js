'use strict';
var p = require('path')
var mm = require('micromatch')
var fs = require('fs')

var sort = require('../lib/sort.js')
var utils = require('../lib/utils.js')

var debug = require('debug')('explorer:middlewares:prepareTree')

/**
 * Prepare tree locals et validate queries 
 * @param Express app
 * @return function 
 */
function prepareTree(app) {
  var config = app.get('config');
  var cache = app.get('cache');
  var homePath = "/",
      homeRealPath = app.get("home");

  return function(req, res, next) {
    //should be an app.param
    if(!req.query.page || req.query.page < 0)
      req.query.page = 1

    req.query.page = parseInt(req.query.page)

    if(req.query.sort) {
      if(!sort.hasOwnProperty(req.query.sort)) {
        req.query.sort = null 
      }
    }

    if(!~['asc', 'desc'].indexOf(req.query.order)) {
      req.query.order = 'asc' 
    }

    if(!req.query.path)
      req.query.path = './'
    
    if(req.query.search && config.search.method !== 'native') {
      req.query.search = utils.secureString(req.query.search)
    }

    res.locals = utils.extend(res.locals, {
      search: req.query.search,
      sort: req.query.sort || '',
      order: req.query.order || '',
      page: req.query.page,
      root: homePath, //p.resolve(homePath),
      path: req.query.path, //utils.higherPath(homePath, req.query.path),
      parent: utils.higherPath(homePath, p.resolve(req.query.path, '..')),
      buildUrl: utils.buildUrl,
      extend: utils.extend,
      prettyBytes : utils.prettyBytes,
      prettyTime : utils.prettyTime,
      buildBreadcrumb : utils.buildBreadcrumb,
      isDirectory : utils.isDirectory,
      urlOptions: {
        limit: req.query.limit,
        order: req.query.order,
        sort: req.query.sort,
        page: req.query.page
      }
    })

    req.query.path = res.locals.path

    var opts = utils.extend({},
      res.locals,
      config.tree, 
      config.pagination
    )

    //@TODO refactor this:
    //- remove as a plugin
    //- archive and upload should parse their own config
    ;['remove', 'archive', 'upload'].forEach(function(e) {
      res.locals[e] = opts[e] = config[e] = {};

      var k = e == 'remove' ? 'trash' : e

        opts[e].path = p.resolve(homeRealPath, k)
    })


    res.locals.canRemove = config.remove && config.remove.method ? true : false

    if(res.locals.sort && res.locals.sort in sort)
      opts.sortMethod = sort[res.locals.sort](opts)

    if(req.query.limit) {
      opts.limit = !!parseInt(req.query.limit) ? req.query.limit : opts.limit
    }


    if(opts.cache === true) {
      opts.cache = {
        time: cache('tree:time'),
        size: cache('tree:size')
      }
    }

    req.options = opts

    //forcing accept header to rss
    if(req.query.rss && req.query.rss == 1) {
      req.headers['accept'] = 'application/rss+xml'
    }

    debug('Options: \n%o', opts)

    return next()
  }
}

module.exports = prepareTree
