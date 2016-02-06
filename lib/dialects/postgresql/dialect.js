var dialect = module.exports = Object.create(require("../basedialect"), {
    "type": {"value": "postgresql", "enumerable": true},
    "hasSequenceSupport": {"value": true, "enumerable": true},
    "dataTypes": {"value": require("./datatypes"), "enumerable": true}
});

dialect.toString = function() {
    return "[Dialect PostgreSQL]";
};

dialect.dataTypes = require("./datatypes");

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 * @name getSqlNextSequenceValue
 */
dialect.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT nextval('" + this.quote(sequenceName) + "')";
};

/**
 * Returns the SQL statement for inserting a sequence value. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
dialect.getInsertNextSequenceValue = function(sequenceName) {
    return "nextval('" + this.quote(sequenceName) + "')";
};

/**
 * Returns the SQL statement for querying sequence names
 * @returns {String} The SQL statement
 * @name getSqlQuerySequences
 */
dialect.getSqlQuerySequenceNames = function() {
    return "SELECT RELNAME AS NAME FROM PG_CLASS WHERE RELKIND='S'";
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
    sqlBuf.push(" LIMIT ALL OFFSET ", offset.toString());
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
