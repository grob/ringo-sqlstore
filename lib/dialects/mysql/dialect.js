/**
 * @module dialects/mysql/dialect
 * @see module:dialects/mysql/datatypes
 */

var dialect = module.exports = Object.create(require("../basedialect"), {
    /**
     * The type of this dialect ("mysql")
     * @property {String}
     * @readonly
     */
    "type": {"value": "mysql", "enumerable": true},
    /**
     * Indicates whether this dialect has sequence support (false)
     * @property {boolean}
     * @readonly
     */
    "hasSequenceSupport": {"value": false, "enumerable": true},
    /**
     * The data types available for this dialect
     * @property {module:dialects/mysql/datatypes}
     * @readonly
     */
    "dataTypes": {"value": require("./datatypes"), "enumerable": true},
    /**
     * Contains the opening quote character used to quote table and column names
     * @property {String}
     * @readonly
     */
    "openQuote": {"value": "`"},
    /**
     * Contains the closing quote character used to quote table and column names
     * @property {String}
     * @readonly
     */
    "closeQuote": {"value": "`"}
});

/** @ignore */
dialect.toString = function() {
    return "[Dialect MySQL]";
};

/**
 * Returns the storage engine type ("INNODB")
 * @returns {String} The storage engine type
 */
dialect.getEngineType = function() {
    return "INNODB";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} limit The limit
 */
dialect.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.push(" LIMIT ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} offset The offset
 */
dialect.addSqlOffset = function(sqlBuf, offset) {
    // FIXME: i can't believen this is the only possibility to do an offset-only
    // query in mysql...
    sqlBuf.push(" LIMIT 18446744073709551615 OFFSET ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} offset The offset
 * @param {Number} limit The limit
 */
dialect.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.push(" LIMIT ", limit.toString(), " OFFSET ", offset.toString());
};
