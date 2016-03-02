/**
 * @module dialects/mysql/datatypes
 */

/**
 * The datatype definition for a column of type "integer"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.integer = function(mapping) {
    var buf = ["integer"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    if (mapping.autoIncrement === true) {
        buf.push(" auto_increment");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "long"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.long = function(mapping) {
    var buf = ["bigint"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    if (mapping.autoIncrement === true) {
        buf.push(" auto_increment");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "short"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.short = function(mapping) {
    var buf = ["smallint"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    if (mapping.autoIncrement === true) {
        buf.push(" auto_increment");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "double"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.double = function(mapping) {
    if (mapping.precision) {
        var buf = [];
        buf.push("decimal(", mapping.precision);
        if (mapping.scale) {
            buf.push(", ", mapping.scale);
        }
        buf.push(")");
        return buf.join("");
    }
    return "double";
};

/**
 * The datatype definition for a column of type "character"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.character = function(mapping) {
    var buf = ["char"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "string"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.string = function(mapping) {
    return ["varchar", "(", mapping.length || 4000, ")"].join("");
};

/**
 * The datatype definition for a column of type "byte"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.byte = function(mapping) {
    return "tinyint";
};

/**
 * The datatype definition for a column of type "boolean"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.boolean = function(mapping) {
    return "bit";
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
    return "longblob";
};

/**
 * The datatype definition for a column of type "text"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.text = function(mapping) {
    return "longtext";
};

