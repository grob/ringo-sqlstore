/**
 * @module dialects/postgresql/dialect
 * @see module:dialects/postgresql/datatypes
 */

var dialect = module.exports = Object.create(require("../basedialect"), {
    /**
     * The type of this dialect ("postgresql")
     * @property {String}
     * @readonly
     */
    "type": {"value": "postgresql", "enumerable": true},
    /**
     * Indicates whether this dialect has sequence support (true)
     * @property {boolean}
     * @readonly
     */
    "hasSequenceSupport": {"value": true, "enumerable": true},
    /**
     * The data types available for this dialect
     * @property {module:dialects/postgresql/datatypes}
     * @readonly
     */
    "dataTypes": {"value": require("./datatypes"), "enumerable": true}
});

/** @ignore */
dialect.toString = function() {
    return "[Dialect PostgreSQL]";
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
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
 */
dialect.getSqlQuerySequenceNames = function() {
    return "SELECT RELNAME AS NAME FROM PG_CLASS WHERE RELKIND='S'";
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
    sqlBuf.push(" LIMIT ALL OFFSET ", offset.toString());
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
