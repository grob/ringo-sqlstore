var dialect = module.exports = Object.create(require("../basedialect"), {
    "hasSequenceSupport": {"value": true, "enumerable": true},
    "dataTypes": {"value": require("./datatypes"), "enumerable": true}
});

dialect.toString = function() {
    return "[Dialect H2]";
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 * @name getSqlNextSequenceValue
 */
dialect.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT NEXT VALUE FOR " + this.quote(sequenceName);
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
    sqlBuf.push(" LIMIT -1 OFFSET ", offset.toString());
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