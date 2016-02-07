/**
 * @module dialects/postgresql/datatypes
 */

/**
 * The datatype definition for a column of type "integer"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.integer = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "serial";
    }
    return "integer";
};

/**
 * The datatype definition for a column of type "long"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.long = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "bigserial";
    }
    return "bigint";
};

/**
 * The datatype definition for a column of type "short"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.short = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "smallserial";
    }
    return "smallint";
};

/**
 * The datatype definition for a column of type "double"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.double = function(mapping) {
    if (mapping.precision) {
        var buf = [];
        buf.push("numeric(", mapping.precision);
        if (mapping.scale) {
            buf.push(", ", mapping.scale);
        }
        buf.push(")");
        return buf.join("");
    }
    return "float8";
};

/**
 * The datatype definition for a column of type "character"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.character = function(mapping) {
    return ["character(", mapping.length || 1, ")"].join("");
};

/**
 * The datatype definition for a column of type "string"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.string = function(mapping) {
    var buf = ["varchar"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "byte"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.byte = function(mapping) {
    return "smallint";
};

/**
 * The datatype definition for a column of type "boolean"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.boolean = function(mapping) {
    return "boolean";
};

/**
 * The datatype definition for a column of type "date"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.date = function(mapping) {
    return "date";
};

/**
 * The datatype definition for a column of type "time"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.time = function(mapping) {
    return "time";
};

/**
 * The datatype definition for a column of type "timestamp"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.timestamp = function(mapping) {
    return "timestamp";
};

/**
 * The datatype definition for a column of type "binary"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.binary = function(mapping) {
    return "bytea";
};

/**
 * The datatype definition for a column of type "text"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.text = function(mapping) {
    return "text";
};

/**
 * The datatype definition for a column of type "json"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.json = function(mapping) {
    return "json";
};

/**
 * The datatype definition for a column of type "jsonb"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.jsonb = function(mapping) {
    return "jsonb";
};