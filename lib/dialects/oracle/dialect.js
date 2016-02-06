/**
 * @fileoverview Dialect implementation for Oracle databases
 * @extends BaseDialect
 * @see basedialect
 */
var dialect = module.exports = Object.create(require("../basedialect"), {
    "type": {"value": "oracle", "enumerable": true},
    "hasSequenceSupport": {"value": true, "enumerable": true},
    "dataTypes": {"value": require("./datatypes"), "enumerable": true},
    "SqlGenerator": {"value": require("./sqlgenerator"), "enumerable": true}
});

dialect.toString = function() {
    return "[Dialect Oracle]";
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 * @name getSqlNextSequenceValue
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
 * @name getSqlQuerySequences
 */
dialect.getSqlQuerySequenceNames = function() {
    return "SELECT SEQUENCE_NAME FROM USER_SEQUENCES";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Limit} limit The limit
 * @name addSqlLimit
 */
dialect.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.unshift("SELECT * FROM ( ");
    sqlBuf.push(") WHERE ROWNUM <= ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @name addSqlOffset
 */
dialect.addSqlOffset = function(sqlBuf, offset) {
    sqlBuf.unshift("SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (");
    sqlBuf.push(") r ) where rnum > ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @name addSqlRange
 */
dialect.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.unshift("SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (");
    sqlBuf.push(") r WHERE ROWNUM <= ", (offset + limit).toString());
    sqlBuf.push(") WHERE rnum > ", offset.toString());
};
