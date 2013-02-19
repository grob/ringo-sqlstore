var {ColumnType} = require("../types");
var {Types} = java.sql;
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database Dialect for MySQL 5.x
 * @constructor
 * @returns
 */
var Dialect = function() {

    Object.defineProperty(this, "openQuote", {"value": "`"});
    Object.defineProperty(this, "closeQuote", {"value": "`"});

    this.registerColumnType("integer", new ColumnType(Types.INTEGER, "integer"));
    this.registerColumnType("long", new ColumnType(Types.BIGINT, "bigint"));
    this.registerColumnType("short", new ColumnType(Types.SMALLINT, "smallint"));
    this.registerColumnType("float", new ColumnType(Types.FLOAT, "float"));
    this.registerColumnType("double", new ColumnType(Types.DOUBLE, "double precision"));
    this.registerColumnType("character", new ColumnType(Types.CHAR, "char"));
    this.registerColumnType("string", new ColumnType(Types.VARCHAR, "varchar", {
        // using 4000 as limit, because the whole row size must not exceed 65535 bytes...
        "length": 4000
    }));
    this.registerColumnType("byte", new ColumnType(Types.TINYINT, "tinyint"));
    this.registerColumnType("boolean", new ColumnType(Types.BIT, "bit"));
    this.registerColumnType("date", new ColumnType(Types.DATE, "date"));
    this.registerColumnType("time", new ColumnType(Types.TIME, "time"));
    this.registerColumnType("timestamp", new ColumnType(Types.TIMESTAMP, "datetime"));
    this.registerColumnType("binary", new ColumnType(Types.BINARY, "longblob"));
    this.registerColumnType("text", new ColumnType(Types.LONGVARCHAR, "longtext"));

    return this;
};
// extend BaseDialect
Dialect.prototype = new BaseDialect();
Dialect.prototype.constructor = Dialect;

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
    // FIXME: i can't believen this is the only possibility to do an offset-only
    // query in mysql...
    sqlBuf.push(" LIMIT 18446744073709551615 OFFSET ", offset.toString());
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
