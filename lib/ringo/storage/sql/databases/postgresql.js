var types = require("../types");
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database dialect for PostgreSQL databases
 * @class Database dialect for PostgreSQL databases
 * @returns A newly created PostgreSQL database dialect instance
 * @constructor
 */
var Dialect = function() {
    this.registerColumnType("integer", new types.ColumnType(java.sql.Types.INTEGER, "int4"));
    this.registerColumnType("long", new types.ColumnType(java.sql.Types.BIGINT, "int8"));
    this.registerColumnType("short", new types.ColumnType(java.sql.Types.SMALLINT, "int2"));
    this.registerColumnType("float", new types.ColumnType(java.sql.Types.FLOAT, "float4"));
    this.registerColumnType("double", new types.ColumnType(java.sql.Types.DOUBLE, "float8"));
    this.registerColumnType("character", new types.ColumnType(java.sql.Types.CHAR, "character", {
        "length": 1
    }));
    this.registerColumnType("string", new types.ColumnType(java.sql.Types.VARCHAR, "varchar", {
        "length": 4000
    }));
    this.registerColumnType("byte", new types.ColumnType(java.sql.Types.TINYINT, "int2"));
    this.registerColumnType("boolean", new types.ColumnType(java.sql.Types.BIT, "bool"));
    this.registerColumnType("date", new types.ColumnType(java.sql.Types.DATE, "date"));
    this.registerColumnType("time", new types.ColumnType(java.sql.Types.TIME, "time"));
    this.registerColumnType("timestamp", new types.ColumnType(java.sql.Types.TIMESTAMP, "timestamp"));
    this.registerColumnType("binary", new types.ColumnType(java.sql.Types.BINARY, "bytea"));
    this.registerColumnType("text", new types.ColumnType(java.sql.Types.LONGVARCHAR, "text"));
    
    return this;
}
// extend BaseDialect
Dialect.prototype = new BaseDialect();

/** @ignore */
Dialect.prototype.toString = function() {
    return "[Dialect PostgreSQL]";
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
    return "SELECT nextval('" + sequenceName + "')";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlLimit = function(sql, limit) {
    return sql + " LIMIT " + limit;
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlOffset = function(sql, offset) {
    return sql + " LIMIT ALL OFFSET " + offset;
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {String} sql The SQL statement to add the range restriction to
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlRange = function(sql, offset, limit) {
    return sql + " LIMIT " + limit + " OFFSET " + offset;
};


exports = new Dialect();
