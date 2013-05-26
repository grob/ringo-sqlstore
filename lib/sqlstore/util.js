/**
 * @fileoverview A module providing various RDBMS related utility functions
 */

var log = require('ringo/logging').getLogger(module.id);

/**
 * Creates a table
 * @param {Store} store The store to create the table for
 * @param {String} tableName The name of the table to create
 * @param {Array} columns An array containing column definitions
 * @param {Array} primaryKey An array containing the primary key columns
 * @param {String} engineType Optional engine type, solely for mysql databases
 */
var createTable = exports.createTable = function(conn, dialect, schemaName, tableName, columns, primaryKey) {
    var sqlBuf = new java.lang.StringBuilder("CREATE TABLE ");
    // FIXME: there's mapping.getQualifiedTableName() ...
    if (schemaName != null) {
        sqlBuf.append(dialect.quote(schemaName)).append(".");
    }
    sqlBuf.append(dialect.quote(tableName));
    sqlBuf.append(" (");

    columns.forEach(function(column, idx) {
        var columnType = dialect.getColumnType(column.type);
        if (!columnType) {
            throw new Error("Unknown column type " + column.type);
        }
        sqlBuf.append(dialect.quote(column.column));
        sqlBuf.append(" ").append(columnType.getSql(column.length, column.precision, column.scale));
        // null not allowed in column
        if (column.nullable === false) {
            sqlBuf.append(" NOT NULL");
        }
        if (idx < columns.length -1) {
            sqlBuf.append(", ");
        }
    }, this);

    // primary key
    if (primaryKey != null) {
        if (typeof(primaryKey) === "string") {
            primaryKey = [primaryKey];
        }
        sqlBuf.append(", PRIMARY KEY (");
        sqlBuf.append(primaryKey.map(function(name) {
            return dialect.quote(name);
        }).join(", ")).append(")");
    }
    sqlBuf.append(")");
    var engineType = dialect.getEngineType();
    if (engineType != null) {
        sqlBuf.append(" ENGINE=").append(engineType);
    }
    if (log.isDebugEnabled()) {
        log.debug("Creating table: " + sqlBuf.toString());
    }

    var statement = null;
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        statement.executeUpdate(sqlBuf.toString());
    } finally {
        statement && statement.close();
    }
    return;
};

/**
 * Creates a sequence
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} schemaName Optional schema name
 * @param {String} sequenceName The name of the sequence to create
 */
var createSequence = exports.createSequence = function(conn, dialect, schemaName, sequenceName) {
    var sqlBuf = new java.lang.StringBuilder("CREATE SEQUENCE ");
    if (schemaName != null) {
        sqlBuf.append(dialect.quote(schemaName)).append(".");
    }
    sqlBuf.append(dialect.quote(sequenceName));
    sqlBuf.append(" START WITH 1 INCREMENT BY 1");
    if (log.isDebugEnabled()) {
        log.debug("Creating sequence: " + sqlBuf.toString());
    }
    var statement = null;
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        statement.executeUpdate(sqlBuf.toString());
    } finally {
        statement && statement.close();
    }
    return
};

/**
 * Returns the columns of a given table
 * @param {java.sql.DatabaseMetadata} dbMetaData The database metadata
 * @param {String} tablePattern Optional table name pattern (defaults to "%")
 * @param {String} schemaPattern Optional schema name pattern (defaults to "%")
 * @param {String} columnPattern Optional column name pattern (defaults to "%")
 * @returns {Array} An array containing the column metadata
 */
var getColumns = exports.getColumns = function(dbMetaData, tablePattern, schemaPattern, columnPattern) {
    var result = [];
    var columnMetaData = null;
    try {
        columnMetaData = dbMetaData.getColumns(null, schemaPattern || "%",
                tablePattern || "%", columnPattern || "%");
        while (columnMetaData.next()) {
            result.push({
                "name": columnMetaData.getString("COLUMN_NAME"),
                "type": columnMetaData.getInt("DATA_TYPE"),
                "length": columnMetaData.getInt("COLUMN_SIZE"),
                "nullable": (columnMetaData.getInt("NULLABLE") == dbMetaData.typeNoNulls) ? false : true,
                "default": columnMetaData.getString("COLUMN_DEF"),
                "precision": columnMetaData.getInt("DECIMAL_DIGITS"),
                "scale": columnMetaData.getInt("NUM_PREC_RADIX")
             });
        }
        return result;
    } finally {
        columnMetaData && columnMetaData.close();
    }
};

/**
 * Returns the primary keys of a given table
 * @param {java.sql.DatabaseMetadata} dbMetaData The database metadata
 * @param {String} tableName The name of the table
 * @param {String} schemaName Optional schema name
 * @returns {Array} An array containing the table's primary keys
 */
var getPrimaryKeys = exports.getPrimaryKeys = function(dbMetaData, tableName, schemaName) {
    var result = [];
    var keyMetaData = null;
    try {
        keyMetaData = dbMetaData.getPrimaryKeys(null, schemaName || null, tableName);
        while (keyMetaData.next()) {
            result.push({
                "name": keyMetaData.getString("COLUMN_NAME"),
                "sequenceNumber": keyMetaData.getShort("KEY_SEQ"),
                "primaryKeyName": keyMetaData.getString("PK_NAME")
            });
        }
        return result;
    } finally {
        keyMetaData && keyMetaData.close();
    }
};

/**
 * Returns the tables for the connection passed as argument
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} schemaName Optional schema name
 * @param {String} tableName Optional table name
 * @returns {Array} The tables
 */
var getTables = exports.getTables = function(conn, schemaName, tableName) {
    var result = [];
    var metaData = null;
    var tableMetaData = null;
    try {
        metaData = conn.getMetaData();
        tableMetaData = metaData.getTables(null, schemaName || "%", tableName || "%", ["TABLE"]);
        while (tableMetaData.next()) {
            var tableName = tableMetaData.getString("TABLE_NAME");
            var schemaName = tableMetaData.getString("TABLE_SCHEM");
            result.push({
                "name": tableName,
                "schema": schemaName,
                "catalog": tableMetaData.getString("TABLE_CAT"),
                "type": tableMetaData.getString("TABLE_TYPE"),
                "columns": getColumns(metaData, tableName, schemaName),
                "primaryKeys": getPrimaryKeys(metaData, tableName, schemaName)
            });
        }
        return result;
    } finally {
        tableMetaData && tableMetaData.close();
    }
};

/**
 * Returns true if the database has a table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} tableName The name of the table
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the table exists, false otherwise
 */
var tableExists = exports.tableExists = function(conn, tableName, schemaName) {
    var tableMetaData = null;
    try {
        var metaData = conn.getMetaData();
        tableMetaData = metaData.getTables(null, schemaName || "%", tableName || "%", ["TABLE"]);
        while (tableMetaData.next()) {
            if (tableMetaData.getString("TABLE_NAME").toLowerCase() === tableName.toLowerCase()) {
                return true;
            }
        }
    } finally {
        tableMetaData && tableMetaData.close();
    }
    return false;
};

/**
 * Drops the table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} tableName The name of the table
 * @param {String} schemaName Optional schema name
 */
var dropTable = exports.dropTable = function(conn, dialect, tableName, schemaName) {
    return drop(conn, dialect, "TABLE", tableName, schemaName);
};

/**
 * Drops the sequence with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} sequenceName The name of the sequence to drop
 * @param {String} schemaName Optional schema name
 */
var dropSequence = exports.dropSequence = function(conn, dialect, sequenceName, schemaName) {
    return drop(conn, dialect, "SEQUENCE", sequenceName, schemaName);
};

/**
 * Generic function for dropping database objects
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} typeName The type of the database object to drop
 * (eg. "TABLE", "SEQUENCE")
 * @param {String} objectName The name of the database object to drop
 * @param {String} schemaName Optional schema name
 * @ignore
 */
var drop = exports.drop = function(conn, dialect, typeName, objectName, schemaName) {
    var sqlBuf = new java.lang.StringBuilder("DROP ");
    sqlBuf.append(typeName).append(" ");
    if (schemaName != null) {
        sqlBuf.append(dialect.quote(schemaName)).append(".");
    }
    sqlBuf.append(dialect.quote(objectName));
    if (log.isDebugEnabled()) {
        log.debug("Dropping:", sqlBuf.toString());
    }
    var statement = null;
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        statement.execute(sqlBuf.toString());
    } finally {
        statement && statement.close();
    }
    return;
};