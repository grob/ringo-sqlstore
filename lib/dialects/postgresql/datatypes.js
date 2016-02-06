exports.integer = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "serial";
    }
    return "integer";
};

exports.long = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "bigserial";
    }
    return "bigint";
};

exports.short = function(mapping) {
    if (mapping.autoIncrement === true) {
        return "smallserial";
    }
    return "smallint";
};

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

exports.character = function(mapping) {
    return ["character(", mapping.length || 1, ")"].join("");
};

exports.string = function(mapping) {
    var buf = ["varchar"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.byte = function(mapping) {
    return "smallint";
};

exports.boolean = function(mapping) {
    return "boolean";
};

exports.date = function(mapping) {
    return "date";
};

exports.time = function(mapping) {
    return "time";
};

exports.timestamp = function(mapping) {
    return "timestamp";
};

exports.binary = function(mappint) {
    return "bytea";
};

exports.text = function(mapping) {
    return "text";
};

exports.json = function(mapping) {
    return "json";
};

exports.jsonb = function(mapping) {
    return "jsonb";
};