var types = require("./types");

export("BaseDialect");

function BaseDialect() {
    var jdbcTypeMap = {};
    var columnTypes = {};

    Object.defineProperty(this, "openQuote", {"value": '"'});
    Object.defineProperty(this, "closeQuote", {"value": '"'});

    this.registerJdbcType = function(jdbcTypeNumber, dataType) {
        jdbcTypeMap[jdbcTypeNumber] = dataType;
    };

    this.registerColumnType = function(typeName, columnType) {
        columnTypes[typeName] = columnType;
        return;
    };

    this.getColumnType = function(name) {
        var columnType = columnTypes[name];
        if (columnType == null) {
            throw new Error("Column type " + name + " not defined");
        }
        return columnType;
    };

    this.getJdbcType = function(number) {
        var jdbcType = jdbcTypeMap[number];
        if (jdbcType == null) {
            throw new Error("JDBC type " + number + " not defined");
        }
        return jdbcType;
    };

    /**
     * @param {String} name The name of the type as defined in the database dialect
     * @returns The type
     * @type Type
     */
    this.getType = function(name) {
        var columnType = this.getColumnType(name);
        return this.getJdbcType(columnType.jdbcType);
    };

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
 * @returns The string enclosed in quotes
 * @type String
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
 * implementations should override this.
 * @returns True if the database supports sequences, false otherwise
 * @type Boolean
 */
BaseDialect.prototype.hasSequenceSupport = function() {
    return false;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlLimit = function(sql, limit) {
    throw new Error("Limit not implemented");
};

/**
 * Extends the SQL statement passed as argument with an offset restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlOffset = function(sql, offset) {
    throw new Error("Offset not implemented");
};

/**
 * Extends the SQL statement passed as argument with a range restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the range restriction to
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlRange = function(sql, offset, limit) {
    throw new Error("Range not implemented");
};

BaseDialect.prototype.getDefaultSchema = function(conn) {
    return null;
};
