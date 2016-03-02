/**
 * @module database/schema
 */

var log = require('ringo/logging').getLogger(module.id);
var metaData = require("./metadata");
var utils = require("./utils");

/**
 * Creates a table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} schemaName Optional name of the schema to create the table in
 * @param {String} tableName The name of the table to create
 * @param {Array} columns An array containing column definitions
 * @param {Array} primaryKey An array containing the primary key columns
 */
exports.createTable = function(conn, dialect, schemaName, tableName, columns, primaryKey) {
    var buf = ["CREATE TABLE "];
    buf.push(dialect.quote(tableName, schemaName || dialect.getDefaultSchema(conn)));
    buf.push(" (");

    columns.forEach(function(mapping, idx) {
        buf.push(dialect.quote(mapping.column));
        buf.push(" ", dialect.getColumnSql(mapping));
        // null not allowed in column
        if (mapping.nullable === false) {
            buf.push(" NOT NULL");
        }
        if (mapping.unique === true) {
            buf.push(" UNIQUE");
        }
        if (idx < columns.length -1) {
            buf.push(", ");
        }
    }, this);

    // primary key
    if (primaryKey != null) {
        if (typeof(primaryKey) === "string") {
            primaryKey = [primaryKey];
        }
        buf.push(", PRIMARY KEY (");
        buf.push(primaryKey.map(function(name) {
            return dialect.quote(name);
        }).join(", "));
        buf.push(")");
    }
    buf.push(")");
    var engineType = dialect.getEngineType();
    if (engineType != null) {
        buf.push(" ENGINE=", engineType);
    }
    if (log.isDebugEnabled()) {
        log.debug("Creating table: " + buf.join(""));
    }
    return utils.executeUpdate(conn, buf.join(""));
};

/**
 * Creates a sequence
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} sequenceName The name of the sequence to create
 * @returns {Boolean} True in case the operation was successful
 */
var createSequence = exports.createSequence = function(conn, dialect, sequenceName, schemaName) {
    var buf = [
        "CREATE SEQUENCE",
        dialect.quote(sequenceName, schemaName || dialect.getDefaultSchema(conn)),
        "START WITH 1 INCREMENT BY 1"
    ];
    return utils.executeUpdate(conn, buf.join(" "));
};

/**
 * Drops the table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The name of the table
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the table was successfully dropped
 */
exports.dropTable = function(conn, dialect, tableName, schemaName) {
    return metaData.tableExists(conn, dialect, tableName, schemaName) &&
            drop(conn, dialect, "TABLE", tableName, schemaName);
};

/**
 * Drops the sequence with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} sequenceName The name of the sequence to drop
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the sequence was successfully dropped
 */
var dropSequence = exports.dropSequence = function(conn, dialect, sequenceName, schemaName) {
    return dialect.hasSequenceSupport &&
            metaData.sequenceExists(conn, dialect, sequenceName) &&
            drop(conn, dialect, "SEQUENCE", sequenceName, schemaName);
};

/**
 * Generic function for dropping database objects
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect to use
 * @param {String} typeName The type of the database object to drop
 * (eg. "TABLE", "SEQUENCE")
 * @param {String} objectName The name of the database object to drop
 * @param {String} schemaName Optional schema name
 * @ignore
 */
var drop = exports.drop = function(conn, dialect, typeName, objectName, schemaName) {
    return utils.executeUpdate(conn, "DROP " + typeName + " " +
                dialect.quote(objectName, schemaName || dialect.getDefaultSchema(conn)));
};

/**
 * Truncates the table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The name of the table to truncate
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the table was successfully truncated
 */
exports.truncateTable = function(conn, dialect, tableName, schemaName) {
    return metaData.tableExists(conn, dialect, tableName, schemaName) &&
            utils.executeUpdate(conn, "TRUNCATE TABLE " +
                    dialect.quote(tableName, schemaName));
};

/**
 * Drops and re-creates the sequence with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} sequenceName The name of the sequence
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the table was successfully truncated
 */
exports.resetSequence = function(conn, dialect, sequenceName, schemaName) {
    if (dialect.hasSequenceSupport && metaData.sequenceExists(conn, dialect, sequenceName)) {
        return dropSequence(conn, dialect, sequenceName) &&
                createSequence(conn, dialect, sequenceName, schemaName);
    }
    return false;
};
