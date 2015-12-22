/**
 * @fileoverview Dialect implementation for MySQL databases
 * @extends BaseDialect
 * @see basedialect
 */
var dialect = module.exports = Object.create(require("../basedialect"), {
    "hasSequenceSupport": {"value": false, "enumerable": true},
    "dataTypes": {"value": require("./datatypes"), "enumerable": true},
    "openQuote": {"value": "`"},
    "closeQuote": {"value": "`"}
});

dialect.toString = function() {
    return "[Dialect MySQL]";
};

dialect.getEngineType = function() {
    return "INNODB";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Limit} limit The limit
 * @name addSqlLimit
 */
dialect.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.push(" LIMIT ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @name addSqlOffset
 */
dialect.addSqlOffset = function(sqlBuf, offset) {
    // FIXME: i can't believen this is the only possibility to do an offset-only
    // query in mysql...
    sqlBuf.push(" LIMIT 18446744073709551615 OFFSET ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @name addSqlRange
 */
dialect.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.push(" LIMIT ", limit.toString(), " OFFSET ", offset.toString());
};
