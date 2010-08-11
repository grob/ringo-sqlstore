var types = require("../types");
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database Dialect for MySQL 5.x
 * @constructor
 * @returns
 */
var Dialect = function() {

    Object.defineProperty(this, "openQuote", {"value": "`"});
    Object.defineProperty(this, "closeQuote", {"value": "`"});

    this.registerColumnType("integer", new types.ColumnType(java.sql.Types.INTEGER, "integer"));
    this.registerColumnType("long", new types.ColumnType(java.sql.Types.BIGINT, "bigint"));
    this.registerColumnType("short", new types.ColumnType(java.sql.Types.SMALLINT, "smallint"));
    this.registerColumnType("float", new types.ColumnType(java.sql.Types.FLOAT, "float"));
    this.registerColumnType("double", new types.ColumnType(java.sql.Types.DOUBLE, "double precision"));
    this.registerColumnType("character", new types.ColumnType(java.sql.Types.CHAR, "char"));
    this.registerColumnType("string", new types.ColumnType(java.sql.Types.VARCHAR, "varchar", {
        // using 4000 as limit, because the whole row size must not exceed 65535 bytes...
        "length": 4000
    }));
    this.registerColumnType("byte", new types.ColumnType(java.sql.Types.TINYINT, "tinyint"));
    this.registerColumnType("boolean", new types.ColumnType(java.sql.Types.BIT, "bit"));
    this.registerColumnType("date", new types.ColumnType(java.sql.Types.DATE, "date"));
    this.registerColumnType("time", new types.ColumnType(java.sql.Types.TIME, "time"));
    this.registerColumnType("timestamp", new types.ColumnType(java.sql.Types.TIMESTAMP, "datetime"));
    this.registerColumnType("binary", new types.ColumnType(java.sql.Types.BINARY, "longblob"));
    this.registerColumnType("text", new types.ColumnType(java.sql.Types.LONGVARCHAR, "longtext"));
    
    return this;
}
// extend BaseDialect
Dialect.prototype = new BaseDialect();

/** @ignore */
Dialect.prototype.toString = function() {
    return "[Dialect MySQL 5]";
};

/**
 * Returns the engine type to use for tables
 * @returns The engine type
 * @type String
 */
Dialect.prototype.getEngineType = function() {
    return "INNODB";
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
    // FIXME: i can't believen this is the only possibility to do an offset-only
    // query in mysql...
    return sql + " LIMIT 18446744073709551615 OFFSET " + offset;
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

Dialect.prototype.getDefaultSchema = function(conn) {
    return null;
};

exports = new Dialect();
