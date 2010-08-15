var types = require("../types");
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database Dialect for H2 databases
 * @constructor
 * @returns
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
}
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
    return sql + " LIMIT 0 OFFSET " + offset;
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
