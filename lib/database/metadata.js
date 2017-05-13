/**
 * @module database/metadata
 */

var utils = require("./utils");

/**
 * Returns the columns of a given table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The table name
 * @param {String} schemaName Optional schema name
 * @param {String} columnPattern Optional column pattern (defaults to "%")
 * @returns {Array} An array containing the column metadata
 */
exports.getColumns = function(conn, dialect, tableName, schemaName, columnPattern) {
    var result = [];
    var columnMetaData = null;
    try {
        var metaData = conn.getMetaData();
        columnMetaData = metaData.getColumns(null,
                schemaName || dialect.getDefaultSchema(conn),
                tableName, columnPattern || "%");
        while (columnMetaData.next()) {
            result.push({
                "name": columnMetaData.getString("COLUMN_NAME"),
                "type": columnMetaData.getInt("DATA_TYPE"),
                "typeName": columnMetaData.getString("TYPE_NAME"),
                "length": columnMetaData.getInt("COLUMN_SIZE"),
                "scale": columnMetaData.getInt("DECIMAL_DIGITS"),
                "radix": columnMetaData.getInt("NUM_PREC_RADIX"),
                "nullable": columnMetaData.getInt("NULLABLE") === metaData.columnNullable,
                "default": columnMetaData.getString("COLUMN_DEF"),
                "position": columnMetaData.getInt("ORDINAL_POSITION")
             });
        }
        return result;
    } finally {
        columnMetaData && columnMetaData.close();
    }
};

/**
 * Returns the primary keys of a given table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The table name
 * @param {String} schemaName Optional schema name
 * @returns {Array} An array containing the table's primary keys
 */
exports.getPrimaryKeys = function(conn, dialect, tableName, schemaName) {
    var result = [];
    var keyMetaData = null;
    try {
        keyMetaData = conn.getMetaData().getPrimaryKeys(null,
                schemaName || dialect.getDefaultSchema(conn), tableName);
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
 * Returns the indexes of a given table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The table name
 * @param {String} schemaName Optional schema name
 * @param {boolean} isUnique Limit indexes to unique ones
 * @param {boolean} approximate When true, result is allowed to reflect
 * approximate or out of date values. When false, results are requested
 * to be accurate
 * @returns {Array} An array containing the table's primary keys
 */
var getIndexes = exports.getIndexes = function(conn, dialect, tableName, schemaName, isUnique, approximate) {
    var indexes = {};
    var indexInfo = null;
    var sorting = {"A": "asc", "D": "desc"};
    try {
        indexInfo = conn.getMetaData().getIndexInfo(null,
                schemaName || dialect.getDefaultSchema(conn),
                tableName, isUnique === true, approximate === true);
        while (indexInfo.next()) {
            let indexName = indexInfo.getString("INDEX_NAME");
            let props = indexes[indexName] || (indexes[indexName] = {
                    "cardinality": indexInfo.getInt("CARDINALITY"),
                    "filter": indexInfo.getString("FILTER_CONDITION"),
                    "columns": []
                });
            props.isUnique = indexInfo.getBoolean("NON_UNIQUE") === false;
            props.columns.push({
                "name": indexInfo.getString("COLUMN_NAME"),
                "sort": sorting[indexInfo.getString("ASC_OR_DESC")] || null
            });
        }
        return indexes;
    } finally {
        indexInfo && indexInfo.close();
    }
};

/**
 * Returns an array of object, each one representing a table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} schemaName Optional schema name
 * @returns {Array} An array of objects, each one with properties
 * "schema" and "name"
 */
var getTables = exports.getTables = function(conn, dialect, schemaName) {
    var resultSet = null;
    var result = [];
    try {
        var metaData = conn.getMetaData();
        resultSet = metaData.getTables(null,
                schemaName || dialect.getDefaultSchema(conn),
                "%", ["TABLE"]);
        while (resultSet.next()) {
            result.push({
                "schema": resultSet.getString("TABLE_SCHEM"),
                "name": resultSet.getString("TABLE_NAME")
            });
        }
        return result;
    } finally {
        resultSet && resultSet.close();
    }
};

/**
 * Returns true if the database has a table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The name of the table
 * @param {String} schemaName Optional schema name
 * @returns {Boolean} True if the table exists, false otherwise
 */
exports.tableExists = function(conn, dialect, tableName, schemaName) {
    return getTables(conn, dialect, schemaName).some(function(metaData) {
        return metaData.name === tableName;
    });
};

/**
 * Returns a list of sequence names
 * @param {java.sql.Connection} conn The connection
 * @param {Dialect} dialect The dialect
 * @returns {Array} An array containing sequence names
 */
var getSequences = exports.getSequences = function(conn, dialect) {
    return utils.executeQuery(conn, dialect.getSqlQuerySequenceNames(), function(resultSet) {
        var result = [];
        while (resultSet.next()) {
            result.push({
                "name": resultSet.getString(1)
            });
        }
        return result;
    });
};

/**
 * Returns true if the sequence with the given name exists
 * @param {java.sql.Connection} conn The connection
 * @param {Dialect} dialect The dialect
 * @param {String} sequenceName The sequence name
 * @returns {Boolean} True if the sequence exists
 */
exports.sequenceExists = function(conn, dialect, sequenceName) {
    return getSequences(conn, dialect).some(function(sequence) {
        return sequence.name === sequenceName;
    });
};

/**
 * Returns true if the database has a table with the given name
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The dialect
 * @param {String} tableName The name of the table
 * @param {String} indexName The name of the index
 * @returns {Boolean} True if the index exists, false otherwise
*/
exports.indexExists = function(conn, dialect, tableName, indexName) {
    let indexes = getIndexes(conn, dialect, tableName);
    return indexes.hasOwnProperty(indexName);
};
