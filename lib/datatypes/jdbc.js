var {Types} = java.sql;
var dataTypes = require("./all");

/**
 * Mappings from JDBC type codes to sqlstore data types. This is
 * used for plain sql queries and to collect result values. All
 * queries returning a mapped entity property use the type information
 * stored in the mapping definition.
 */

// exports[Types.ARRAY] = dataTypes.array;
exports[Types.BIGINT] = dataTypes.long;
exports[Types.BINARY] = dataTypes.binary;
exports[Types.BIT] = dataTypes.boolean;
exports[Types.BLOB] = dataTypes.binary;
exports[Types.BOOLEAN] = dataTypes.boolean;
exports[Types.CHAR] = dataTypes.string;
exports[Types.CLOB] = dataTypes.string;
// exports[Types.DATALINK] = dataTypes.dataLink;
exports[Types.DATE] = dataTypes.date;
exports[Types.DECIMAL] = dataTypes.double;
// exports[Types.DISTINCT] = dataTypes.distinct;
exports[Types.DOUBLE] = dataTypes.double;
exports[Types.FLOAT] = dataTypes.float;
exports[Types.INTEGER] = dataTypes.integer;
// exports[Types.JAVA_OBJECT] = dataTypes.javaObject;
// exports[Types.LONGNVARCHAR] = dataTypes.nString;
exports[Types.LONGVARBINARY] = dataTypes.binary;
exports[Types.LONGVARCHAR] = dataTypes.string;
// exports[Types.NCHAR] = dataTypes.nString;
// exports[Types.NCLOB] = dataTypes.nClob;
exports[Types.NULL] = dataTypes.null;
exports[Types.NUMERIC] = dataTypes.double;
// exports[TYPES.NVARCHAR] = dataTypes.nString;
// exports[TYPES.OTHER] = dataTypes.javaObject;
// exports[TYPES.REAL] = dataTypes.real;
// exports[TYPES.ROWID] = dataTypes.rowId;
exports[Types.SMALLINT] = dataTypes.short;
exports[Types.TIME] = dataTypes.time;
// exports[Types.TIME_WITH_TIMEZONE] = dataTypes.timestamp;
exports[Types.TIMESTAMP] = dataTypes.timestamp;
exports[Types.TINYINT] = dataTypes.short;
exports[Types.VARBINARY] = dataTypes.binary;
exports[Types.VARCHAR] = dataTypes.string;
