var types = require("../types");
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database dialect for H2 databases
 * @class Database dialect for H2 databases
 * @returns A newly created H2 database dialect instance
 * @constructor
 */
var Dialect = function() {
    this.registerColumnType("integer", new types.ColumnType(java.sql.Types.INTEGER, "integer"));
    this.registerColumnType("long", new types.ColumnType(java.sql.Types.BIGINT, "bigint"));
    this.registerColumnType("short", new types.ColumnType(java.sql.Types.SMALLINT, "smallint"));
    this.registerColumnType("float", new types.ColumnType(java.sql.Types.FLOAT, "float"));
    this.registerColumnType("double", new types.ColumnType(java.sql.Types.DOUBLE, "double"));
    this.registerColumnType("character", new types.ColumnType(java.sql.Types.CHAR, "char"));
    this.registerColumnType("string", new types.ColumnType(java.sql.Types.VARCHAR, "varchar", {
        "length": 4000
    }));
    this.registerColumnType("byte", new types.ColumnType(java.sql.Types.TINYINT, "tinyint"));
    this.registerColumnType("boolean", new types.ColumnType(java.sql.Types.BIT, "boolean"));
    this.registerColumnType("date", new types.ColumnType(java.sql.Types.DATE, "date"));
    this.registerColumnType("time", new types.ColumnType(java.sql.Types.TIME, "time"));
    this.registerColumnType("timestamp", new types.ColumnType(java.sql.Types.TIMESTAMP, "timestamp"));
    this.registerColumnType("binary", new types.ColumnType(java.sql.Types.BINARY, "blob"));
    this.registerColumnType("text", new types.ColumnType(java.sql.Types.LONGVARCHAR, "clob"));

    return this;
};
// extend BaseDialect
Dialect.prototype = new BaseDialect();

/** @ignore */
Dialect.prototype.toString = function() {
    return "[Dialect H2]";
};

/**
 * Returns true
 * @returns True
 * @type Boolean
 */
Dialect.prototype.hasSequenceSupport = function() {
    return true;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT NEXT VALUE FOR " + this.quote(sequenceName);
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Limit} limit The limit
 */
Dialect.prototype.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.push(" LIMIT ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 */
Dialect.prototype.addSqlOffset = function(sqlBuf, offset) {
    sqlBuf.push(" LIMIT -1 OFFSET ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 */
Dialect.prototype.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.push(" LIMIT ", limit.toString(), " OFFSET ", offset.toString());
};


module.exports = new Dialect();
