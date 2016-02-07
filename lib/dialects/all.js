/**
 * @module dialects/all
 */

/**
 * @property {module:dialects/h2/dialect}
 */
exports.h2 = require("./h2/dialect");

/**
 * @property {module:dialects/mysql/dialect}
 */
exports.mysql = require("./mysql/dialect");

/**
 * @property {module:dialects/oracle/dialect}
 */
exports.oracle = require("./oracle/dialect");

/**
 * @property {module:dialects/postgresql/dialect}
 */
exports.postgresql = require("./postgresql/dialect");