var types = require("../types");
var BaseDialect = require("../basedialect").BaseDialect;

/**
 * Database Dialect for Oracle databases
 * @constructor
 * @returns
 */
var Dialect = function() {
    this.registerColumnType("integer", new types.ColumnType(java.sql.Types.INTEGER, "number(10,0)"));
    this.registerColumnType("long", new types.ColumnType(java.sql.Types.BIGINT, "number(19,0)"));
    this.registerColumnType("short", new types.ColumnType(java.sql.Types.SMALLINT, "number(5,0)"));
    this.registerColumnType("float", new types.ColumnType(java.sql.Types.FLOAT, "float"));
    this.registerColumnType("double", new types.ColumnType(java.sql.Types.DOUBLE, "double precision"));
    this.registerColumnType("character", new types.ColumnType(java.sql.Types.CHAR, "char(1 char)"));
    this.registerColumnType("string", new types.ColumnType(java.sql.Types.VARCHAR, "varchar2", {
        "length": 4000
    }));
    this.registerColumnType("byte", new types.ColumnType(java.sql.Types.TINYINT, "number(3,0)"));
    this.registerColumnType("boolean", new types.ColumnType(java.sql.Types.BIT, "number(1,0)"));
    this.registerColumnType("date", new types.ColumnType(java.sql.Types.DATE, "date"));
    this.registerColumnType("time", new types.ColumnType(java.sql.Types.TIME, "date"));
    this.registerColumnType("timestamp", new types.ColumnType(java.sql.Types.TIMESTAMP, "timestamp"));
    this.registerColumnType("binary", new types.ColumnType(java.sql.Types.BINARY, "blob"));
    this.registerColumnType("text", new types.ColumnType(java.sql.Types.LONGVARCHAR, "clob"));

    return this;
}
// extend BaseDialect
Dialect.prototype = new BaseDialect();

/** @ignore */
Dialect.prototype.toString = function() {
    return "[Dialect Oracle]";
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
    return "SELECT " + this.quote(sequenceName) + ".NEXTVAL FROM DUAL";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlLimit = function(sql, limit) {
    return "SELECT * FROM ( " + sql + ") WHERE ROWNUM <= " + limit;
};

/**
 * Extends the SQL statement passed as argument with an offset restriction
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlOffset = function(sql, offset) {
    return "SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (" + sql +
             ") r ) where rnum > " + offset;
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
    return "SELECT * FROM (SELECT r.*, ROWNUM rnum FROM (" + sql +
             ") r WHERE ROWNUM <= " + (offset + limit) +
             ") WHERE rnum > " + offset;
};

Dialect.prototype.getDefaultSchema = function(conn) {
    var metaData = conn.getMetaData();
    var userName = metaData.getUserName();
    var schemas = null;
    try {
        schemas = metaData.getSchemas(null, userName);
        if (schemas.next()) {
            return schemas.getString(1);
        }
    } finally {
        if (schemas != null) {
            schemas.close();
        }
    }
    return null;
};

exports = new Dialect();
