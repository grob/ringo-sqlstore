/**
 * @fileoverview Basic database dialect implementation. This class is extended
 * by the different DB-specific dialect implementations.
 */
var types = require("./types");

/**
 * Creates a new base dialect
 * @class Instances of this class represent a base database dialect, containing
 * mappings from JDBC types to column data types
 * @returns A newly created BaseDialect instance
 * @constructor
 * @see databases/h2
 * @see databases/mysql5
 * @see databases/postgresql
 * @see databases/oracle
 */
var BaseDialect = exports.BaseDialect = function() {
    var jdbcTypeMap = {};
    var columnTypes = {};

    Object.defineProperties(this, {
        /**
         * Contains the opening quote character used to quote table and column names
         * @type String
         */
        "openQuote": {"value": '"'},
        /**
         * Contains the closing quote character used to quote table and column names
         * @type String
         */
        "closeQuote": {"value": '"'}
    });

    /**
     * Registers a column data type for the given JDBC type number
     * @param {Number} jdbcTypeNumber The JDBC type number
     * @param {Object} dataType The data type to register
     */
    this.registerJdbcType = function(jdbcTypeNumber, dataType) {
        jdbcTypeMap[jdbcTypeNumber] = dataType;
        return;
    };

    /**
     * Registers a column type for the given internal type name
     * @param {String} typeName The internal type name
     * @param {ColumnType} columnType The column type to register
     */
    this.registerColumnType = function(typeName, columnType) {
        columnTypes[typeName] = columnType;
        return;
    };

    /**
     * Returns the column type for the given internal type name
     * @param {String} name The internal type name
     * @returns {ColumnType} The column type
     */
    this.getColumnType = function(name) {
        var columnType = columnTypes[name];
        if (columnType == null) {
            throw new Error("Column type " + name + " not defined");
        }
        return columnType;
    };

    /**
     * Returns the data type for the given JDBC type number
     * @param {Number} number The JDBC type number
     * @returns {Type} The data type
     */
    this.getJdbcType = function(number) {
        var jdbcType = jdbcTypeMap[number];
        if (jdbcType == null) {
            throw new Error("JDBC type " + number + " not defined");
        }
        return jdbcType;
    };

    /**
     * @param {String} name The name of the type as defined in the database dialect
     * @returns {Type} The data type
     */
    this.getType = function(name) {
        var columnType = this.getColumnType(name);
        return this.getJdbcType(columnType.jdbcType);
    };

    // register data types for JDBC types
    this.registerJdbcType(java.sql.Types.BIGINT, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.BINARY, new types.BinaryType());
    this.registerJdbcType(java.sql.Types.BIT, new types.BooleanType());
    this.registerJdbcType(java.sql.Types.BOOLEAN, new types.BooleanType());
    this.registerJdbcType(java.sql.Types.CHAR, new types.StringType());
    this.registerJdbcType(java.sql.Types.DATE, new types.DateType());
    this.registerJdbcType(java.sql.Types.DOUBLE, new types.FloatType());
    this.registerJdbcType(java.sql.Types.FLOAT, new types.FloatType());
    this.registerJdbcType(java.sql.Types.INTEGER, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.SMALLINT, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.TINYINT, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.TIME, new types.TimeType());
    this.registerJdbcType(java.sql.Types.TIMESTAMP, new types.TimestampType());
    this.registerJdbcType(java.sql.Types.VARCHAR, new types.StringType());
    this.registerJdbcType(java.sql.Types.VARBINARY, new types.BinaryType());
    this.registerJdbcType(java.sql.Types.LONGVARCHAR, new types.StringType());
    this.registerJdbcType(java.sql.Types.LONGVARBINARY, new types.BinaryType());
    this.registerJdbcType(java.sql.Types.NUMERIC, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.DECIMAL, new types.IntegerType());
    this.registerJdbcType(java.sql.Types.BLOB, new types.BinaryType());
    this.registerJdbcType(java.sql.Types.CLOB, new types.StringType());

    return this;
};

/**
 * Returns the storage engine type. This is only needed for MySQL databases
 * @returns The storage engine type
 * @type String
 */
BaseDialect.prototype.getEngineType = function() {
    return null;
};

/**
 * Returns the string passed as argument enclosed in quotes
 * @param {String} str The string to enclose in quotes
 * @returns {String} The string enclosed in quotes
 */
BaseDialect.prototype.quote = function(str) {
    return this.openQuote + str + this.closeQuote;
};

/** @ignore */
BaseDialect.prototype.toString = function() {
    return "[BaseDialect]";
};

/**
 * Returns true if the underlying database supports sequences. Dialect
 * implementations should override this. Defaults to false.
 * @returns {Boolean} True if the database supports sequences, false otherwise
 */
BaseDialect.prototype.hasSequenceSupport = function() {
    return false;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
BaseDialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Limit} limit The limit
 * @returns {String} The SQL statement
 */
BaseDialect.prototype.addSqlLimit = function(sql, limit) {
    throw new Error("Limit not implemented");
};

/**
 * Extends the SQL statement passed as argument with an offset restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns {String} The SQL statement
 */
BaseDialect.prototype.addSqlOffset = function(sql, offset) {
    throw new Error("Offset not implemented");
};

/**
 * Extends the SQL statement passed as argument with a range restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the range restriction to
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @returns {String} The SQL statement
 */
BaseDialect.prototype.addSqlRange = function(sql, offset, limit) {
    throw new Error("Range not implemented");
};

/**
 * Returns the name of the default schema. Dialect implementations can override this.
 * @param {java.sql.Connection} conn The connection to use
 * @returns {String} The name of the default schema
 */
BaseDialect.prototype.getDefaultSchema = function(conn) {
    return null;
};

/**
 * Returns the boolean value for the value passed as argument
 * @param {Object} value The value
 * @returns {Boolean} The boolean value
 */
BaseDialect.prototype.getBooleanValue = function(value) {
    return !!value;
};

