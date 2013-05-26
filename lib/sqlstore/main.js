/**
 * @fileoverview The main module of SqlStore
 */

/**
 * The Store constructor
 * @type {Function}
 * @see store
 */
exports.Store = require("./store").Store;

/**
 * The Cache constructor
 * @type {Function}
 * @see cache
 */
exports.Cache = require("./cache").Cache;

/**
 * The ConnectionPool constructor
 * @type {Function}
 * @see connection/pool
 */
exports.ConnectionPool = require('./connection/pool').ConnectionPool;