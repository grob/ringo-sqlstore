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
 * @param {StringBuffer} sqlBuf The SQL statement
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.addSqlLimit = function(sqlBuf, limit) {
    return sqlBuf.append(" LIMIT ").append(limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {StringBuffer} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.addSqlOffset = function(sqlBuf, offset) {
    // FIXME: i can't believen this is the only possibility to do an offset-only
    // query in mysql...
    return sqlBuf.append(" LIMIT 18446744073709551615 OFFSET ").append(offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {StringBuffer} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.addSqlRange = function(sqlBuf, offset, limit) {
    return sqlBuf.append(" LIMIT ").append(limit.toString()).append(" OFFSET ").append(offset.toString());
};

/**
 * Returns null
 * @param {java.sql.Connection} conn The connection to use
 * @returns null
 */
Dialect.prototype.getDefaultSchema = function(conn) {
    return null;
};

/**
 * Returns the boolean value for the value passed as argument
 * @param {Object} value The value
 * @returns The boolean value
 * @type Boolean
 */
Dialect.prototype.getBooleanValue = function(value) {
    if (!!value === true) {
        return 1;
    };
    return 0;
};

module.exports = new Dialect();
