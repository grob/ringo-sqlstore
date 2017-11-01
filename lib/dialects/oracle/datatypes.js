/**
 * @module dialects/oracle/datatypes
 */

/**
 * The datatype definition for a column of type "integer"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.integer = function(mapping) {
    return ["number(", mapping.length || 10, ", 0)"].join("");
};

/**
 * The datatype definition for a column of type "long"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.long = function(mapping) {
    return ["number(", mapping.length || 19, ", 0)"].join("");
};

/**
 * The datatype definition for a column of type "short"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.short = function(mapping) {
    return ["number(", mapping.length || 5, ", 0)"].join("");
};

/**
 * The datatype definition for a column of type "double"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.double = function(mapping) {
    if (mapping.precision) {
        const buf = [];
        buf.push("number(", mapping.precision);
        if (mapping.scale) {
            buf.push(", ", mapping.scale);
        }
        buf.push(")");
        return buf.join("");
    }
    return "binary_double";
};

/**
 * The datatype definition for a column of type "character"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.character = function(mapping) {
    const buf = ["char"];
    if (mapping.length) {
        buf.push("(", mapping.length, " char)");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "string"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.string = function(mapping) {
    return ["varchar2", "(", mapping.length || 4000, " char)"].join("");
};

/**
 * The datatype definition for a column of type "byte"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.byte = function(mapping) {
    return "number(3,0)";
};

/**
 * The datatype definition for a column of type "boolean"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.boolean = function(mapping) {
    return "number(1,0)";
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
    return "date";
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
    return "blob";
};

/**
 * The datatype definition for a column of type "text"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.text = function(mapping) {
    return "clob";
};

