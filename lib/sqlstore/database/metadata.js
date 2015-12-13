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
                "typeName": columnMetaData.getString("TYPE_NAME"),
                "length": columnMetaData.getInt("COLUMN_SIZE"),
                "scale": columnMetaData.getInt("DECIMAL_DIGITS"),
                "radix": columnMetaData.getInt("NUM_PREC_RADIX"),
                "nullable": columnMetaData.getInt("NULLABLE") === dbMetaData.columnNullable,
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

var getIndexes = exports.getIndexes = function(dbMetaData, tableName, schemaName, isUnique) {
    var result = {};
    var indexInfo = null;
    try {
        indexInfo = dbMetaData.getIndexInfo(null, schemaName || null,
                tableName, isUnique === true, false);
        while (indexInfo.next()) {
            let indexName = indexInfo.getString("INDEX_NAME");
            let description = result[indexName] || (result[indexName] = []);
            description.columns.push({
                "column": indexInfo.getString("COLUMN_NAME"),
                "isAsc": indexInfo.getString("ASC_OR_DESC") === "A",
                "isDesc": indexInfo.getString("ASC_OR_DESC") === "D",
                "isUnique": indexInfo.getBoolean("NON_UNIQUE") === false
            });
        }
        return result;
    } finally {
        indexInfo && indexInfo.close();
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
            let tableName = tableMetaData.getString("TABLE_NAME");
            let schemaName = tableMetaData.getString("TABLE_SCHEM");
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

