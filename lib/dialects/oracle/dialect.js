/**
 * @fileoverview Dialect implementation for Oracle databases
 * @extends BaseDialect
 * @see basedialect
 */
var dialect = module.exports = Object.create(require("../basedialect"), {
    "hasSequenceSupport": {"value": true, "enumerable": true},
    "dataTypes": {"value": require("./datatypes"), "enumerable": true}
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

/**
 * Returns the default schema for the connection passed as argument
 * @param {java.sql.Connection} conn The connection to use
 * @returns {String} The name of the default schema
 * @name getDefaultSchema
 */
dialect.getDefaultSchema = function(conn) {
    var metaData = conn.getMetaData();
    return metaData.getUserName().toUpperCase();
};
