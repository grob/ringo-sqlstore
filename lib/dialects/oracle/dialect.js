/**
 * @module dialects/oracle/dialect
 * @see module:dialects/oracle/datatypes
 */

const dialect = module.exports = Object.create(require("../basedialect"), {
    /**
     * The type of this dialect ("oracle")
     * @property {String}
     * @readonly
     */
    "type": {"value": "oracle", "enumerable": true},
    /**
     * Indicates whether this dialect has sequence support (true)
     * @property {boolean}
     * @readonly
     */
    "hasSequenceSupport": {"value": true, "enumerable": true},
    /**
     * The data types available for this dialect
     * @property {module:dialects/oracle/datatypes}
     * @readonly
     */
    "dataTypes": {"value": require("./datatypes"), "enumerable": true},
    /**
     * The SQL query string generator
     * @property {module:dialects/oracle/sqlgenerator}
     */
    "SqlGenerator": {"value": require("./sqlgenerator"), "enumerable": true}
});

/** @ignore */
dialect.toString = function() {
    return "[Dialect Oracle]";
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
dialect.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT " + this.quote(sequenceName) + ".NEXTVAL FROM DUAL";
};

/**
 * Returns the SQL statement for inserting a sequence value. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
dialect.getInsertNextSequenceValue = function(sequenceName) {
    return this.quote(sequenceName) + ".NEXTVAL";
};

/**
 * Returns the SQL statement for querying sequence names
 * @returns {String} The SQL statement
 */
dialect.getSqlQuerySequenceNames = function() {
    return "SELECT SEQUENCE_NAME FROM USER_SEQUENCES";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} limit The limit
 */
dialect.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.unshift("SELECT * FROM ( ");
    sqlBuf.push(") WHERE ROWNUM <= ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} offset The offset
 */
dialect.addSqlOffset = function(sqlBuf, offset) {
    sqlBuf.unshift("SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (");
    sqlBuf.push(") r ) where rnum > ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement buffer
 * @param {Number} offset The offset
 * @param {Number} limit The limit
 */
dialect.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.unshift("SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (");
    sqlBuf.push(") r WHERE ROWNUM <= ", (offset + limit).toString());
    sqlBuf.push(") WHERE rnum > ", offset.toString());
};
