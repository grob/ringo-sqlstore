/**
 * @module dialects/h2/datatypes
 */

/**
 * The datatype definition for a column of type "integer"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.integer = function(mapping) {
    let type = "int";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

/**
 * The datatype definition for a column of type "long"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.long = function(mapping) {
    let type = "bigint";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

/**
 * The datatype definition for a column of type "short"
 * @param {IdMapping|PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.short = function(mapping) {
    let type = "smallint";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

/**
 * The datatype definition for a column of type "double"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.double = function(mapping) {
    if (mapping.precision) {
        const buf = [];
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
    const buf = ["char"];
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
    const buf = ["varchar"];
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
    return "tinyint";
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
    const buf = ["blob"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

/**
 * The datatype definition for a column of type "text"
 * @param {PrimitiveMapping} mapping The mapping
 * @returns {string} The datatype definition
 */
exports.text = function(mapping) {
    const buf = ["clob"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

