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
    if (schemaName != null) {
        sqlBuf.append(dialect.quote(schemaName)).append(".");
    }
    sqlBuf.append(dialect.quote(tableName));
    sqlBuf.append(" (");

    columns.forEach(function(mapping, idx) {
        sqlBuf.append(dialect.quote(mapping.column));
        sqlBuf.append(" ").append(dialect.getColumnSql(mapping));
        // null not allowed in column
        if (mapping.nullable === false) {
            sqlBuf.append(" NOT NULL");
        }
        if (mapping.unique === true) {
            sqlBuf.append(" UNIQUE");
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
};

/**
 * Creates a sequence
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} schemaName Optional schema name
 * @param {String} sequenceName The name of the sequence to create
 */
var createSequence = exports.createSequence = function(conn, dialect, sequenceName, schemaName) {
    var sql = "CREATE SEQUENCE " + dialect.quote(sequenceName, schemaName) +
            " START WITH 1 INCREMENT BY 1";
    if (log.isDebugEnabled()) {
        log.debug("Creating sequence: " + sql);
    }
    var statement = null;
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        statement.executeUpdate(sql);
    } finally {
        statement && statement.close();
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
    var sql = "DROP " + typeName + " " + dialect.quote(objectName, schemaName);
    if (log.isDebugEnabled()) {
        log.debug("Dropping:", sql);
    }
    var statement = null;
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        statement.execute(sql);
    } finally {
        statement && statement.close();
    }
};
