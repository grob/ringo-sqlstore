/**
 * @module dialects/basedialect
 * @typedef {Object} Dialect
 */

/**
 * The SQL query string generator
 * @property {SqlGenerator}
 */
exports.SqlGenerator = require("../query/sqlgenerator");

/**
 * Contains the opening quote character used to quote table and column names
 * @property {String}
 */
exports.openQuote = '"';
/**
 * Contains the closing quote character used to quote table and column names
 * @property {String}
 */
exports.closeQuote = '"';

/**
 * Returns the SQL string to use for creating a column within a table
 * @param {Mapping} mapping The mapping
 * @returns {String} The SQL string
 */
exports.getColumnSql = function(mapping) {
    if (!this.hasOwnProperty("dataTypes") || this.dataTypes === undefined) {
        throw new Error("No data types defined for dialect");
    }
    const dataType = this.dataTypes[mapping.type];
    if (typeof(dataType) !== "function") {
        throw new Error("Missing or invalid dialect data type " + mapping.type);
    }
    return dataType(mapping);
};

/**
 * Returns the storage engine type. This is only needed for MySQL databases.
 * Defaults to null
 * @returns {String} The storage engine type
 */
exports.getEngineType = function() {
    return null;
};

/**
 * Returns the string passed as argument enclosed in quotes
 * @param {String} str The string to enclose in quotes
 * @param {String} prefix Optional prefix which is also quoted
 * @returns {String} The string enclosed in quotes
 */
exports.quote = function(str, prefix) {
    const buf = [];
    if (typeof(prefix) === "string" && prefix.length > 0) {
        buf.push(this.openQuote, prefix, this.closeQuote, ".");
    }
    buf.push(this.openQuote, str, this.closeQuote);
    return buf.join("");
};

/** @ignore */
exports.toString = function() {
    return "[BaseDialect]";
};

/**
 * True if the underlying database supports sequences. Dialect
 * implementations should override this. Defaults to false.
 * @property {Boolean}
 */
exports.hasSequenceSupport = false;

/**
 * Returns the SQL statement for retrieving the next value of a sequence. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
exports.getSqlNextSequenceValue = function(sequenceName) {
    throw new Error("No sequence support");
};

/**
 * Returns the SQL statement for inserting a sequence value. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns {String} The SQL statement
 */
exports.getInsertNextSequenceValue = function(sequenceName) {
    throw new Error("No sequence support");
};

/**
 * Returns the SQL statement for querying sequence names
 * @returns {String} The SQL statement
 */
exports.getSqlQuerySequenceNames = function() {
    throw new Error("No sequence support");
};

/**
 * Extends the SQL statement passed as argument with a limit restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Number} limit The limit
 * @returns {String} The SQL statement
 */
exports.addSqlLimit = function(sql, limit) {
    throw new Error("Limit not implemented");
};

/**
 * Extends the SQL statement passed as argument with an offset restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns {String} The SQL statement
 */
exports.addSqlOffset = function(sql, offset) {
    throw new Error("Offset not implemented");
};

/**
 * Extends the SQL statement passed as argument with a range restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the range restriction to
 * @param {Number} offset The offset
 * @param {Number} limit The limit
 * @returns {String} The SQL statement
 */
exports.addSqlRange = function(sql, offset, limit) {
    throw new Error("Range not implemented");
};

/**
 * Returns the name of the default schema. Dialect implementations can override this.
 * @param {java.sql.Connection} conn The connection to use
 * @returns {String} The name of the default schema
 */
exports.getDefaultSchema = function(conn) {
    return conn.getSchema();
};

/**
 * Returns the SQL statement to use for updating a single record
 * @param {Mapping} mapping The entity mapping to use
 * @returns {String} The SQL statement
 */
exports.getUpdateSql = function(mapping) {
    const buf = ["UPDATE ", this.quote(mapping.tableName, mapping.schemaName), " SET "];
    const max = mapping.mappings.length;
    // start at idx 1 to skip the id mapping
    for (let idx=1; idx<max; idx+=1) {
        let propMapping = mapping.mappings[idx];
        if (idx > 1) {
            buf.push(", ");
        }
        buf.push(this.quote(propMapping.column), " = ?");
    }
    buf.push(" WHERE ", this.quote(mapping.id.column), " = ?");
    return buf.join("");
};

/**
 * Returns the SQL statement to use for inserting a single record
 * @param {Mapping} mapping The entity mapping to use
 * @returns {String} The SQL statement
 */
exports.getInsertSql = function(mapping) {
    const buf = ["INSERT INTO ", this.quote(mapping.tableName, mapping.schemaName),
            " (", this.quote(mapping.id.column)];
    const values = new Array(mapping.mappings);
    if (mapping.id.sequence && this.hasSequenceSupport) {
        values[0] = this.getInsertNextSequenceValue(mapping.id.sequence);
    } else {
        values[0] = "DEFAULT";
    }
    const max = mapping.mappings.length;
    if (max > 0) {
        buf.push(", ");
    }
    for (let idx = 1; idx < max; idx += 1) {
        let propMapping = mapping.mappings[idx];
        if (idx > 1) {
            buf.push(", ");
        }
        buf.push(this.quote(propMapping.column));
        values[idx] = "?";
    }
    buf.push(") VALUES (", values.join(", "), ")");
    return buf.join("");
};

/**
 * Returns the SQL statement to use for retrieving a single record
 * @param {Mapping} mapping The entity mapping to use
 * @returns {String} The SQL statement
 */
exports.getSelectSql = function(mapping) {
    return [
        "SELECT",
        mapping.mappings.map(function(propMapping) {
            return this.quote(propMapping.column);
        }, this).join(", "),
        "FROM",
        this.quote(mapping.tableName, mapping.schemaName),
        " WHERE",
        this.quote(mapping.id.column), "= ?"
    ].join(" ");
};

/**
 * Returns the SQL statement to use for checking the existence of a record
 * @param {Mapping} mapping The entity mapping to use
 * @returns {String} The SQL statement
 */
exports.getExistsSql = function(mapping) {
    return [
        "SELECT 1 FROM ", this.quote(mapping.tableName, mapping.schemaName),
        " WHERE ", this.quote(mapping.id.column), " = ?"
    ].join(" ");
};

/**
 * Returns the SQL statement to use for removing a single record
 * @param {Mapping} mapping The entity mapping to use
 * @returns {String} The SQL statement
 */
exports.getRemoveSql = function(mapping) {
    return [
        "DELETE FROM", this.quote(mapping.tableName, mapping.schemaName),
        "WHERE", this.quote(mapping.id.column), "= ?"
    ].join(" ");
};