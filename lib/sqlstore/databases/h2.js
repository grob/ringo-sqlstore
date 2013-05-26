/**
 * @fileoverview Dialect implementation for H2 databases
 * @extends BaseDialect
 * @see basedialect
 */
var {ColumnType} = require("../types");
var {Types} = java.sql;
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database dialect for H2 databases
 * @class Database dialect for H2 databases
 * @returns A newly created H2 database dialect instance
 * @constructor
 */
var Dialect = function() {
    this.registerColumnType("integer", new ColumnType(Types.INTEGER, "integer"));
    this.registerColumnType("long", new ColumnType(Types.BIGINT, "bigint"));
    this.registerColumnType("short", new ColumnType(Types.SMALLINT, "smallint"));
    this.registerColumnType("float", new ColumnType(Types.FLOAT, "float"));
    this.registerColumnType("double", new ColumnType(Types.DOUBLE, "double"));
    this.registerColumnType("character", new ColumnType(Types.CHAR, "char"));
    this.registerColumnType("string", new ColumnType(Types.VARCHAR, "varchar", {
        "length": 4000
    }));
    this.registerColumnType("byte", new ColumnType(Types.TINYINT, "tinyint"));
    this.registerColumnType("boolean", new ColumnType(Types.BIT, "boolean"));
    this.registerColumnType("date", new ColumnType(Types.DATE, "date"));
    this.registerColumnType("time", new ColumnType(Types.TIME, "time"));
    this.registerColumnType("timestamp", new ColumnType(Types.TIMESTAMP, "timestamp"));
    this.registerColumnType("binary", new ColumnType(Types.BINARY, "blob"));
    this.registerColumnType("text", new ColumnType(Types.LONGVARCHAR, "clob"));

    return this;
};
// extend BaseDialect
Dialect.prototype = new BaseDialect();
Dialect.prototype.constructor = Dialect;

/** @ignore */
Dialect.prototype.toString = function() {
    return "[Dialect H2]";
};

/**
 * Returns true
 * @returns {Boolean} True
 * @name hasSequenceSupport
 */
Dialect.prototype.hasSequenceSupport = function() {
    return true;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 * @name getSqlNextSequenceValue
 */
Dialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT NEXT VALUE FOR " + this.quote(sequenceName);
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Limit} limit The limit
 * @name addSqlLimit
 */
Dialect.prototype.addSqlLimit = function(sqlBuf, limit) {
    sqlBuf.push(" LIMIT ", limit.toString());
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @name addSqlOffset
 */
Dialect.prototype.addSqlOffset = function(sqlBuf, offset) {
    sqlBuf.push(" LIMIT -1 OFFSET ", offset.toString());
};

/**
 * Extends the SQL statement passed as argument with a range restriction
 * @param {Array} sqlBuf The SQL statement
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @name addSqlRange
 */
Dialect.prototype.addSqlRange = function(sqlBuf, offset, limit) {
    sqlBuf.push(" LIMIT ", limit.toString(), " OFFSET ", offset.toString());
};

module.exports = new Dialect();
