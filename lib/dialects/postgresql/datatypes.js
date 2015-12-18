exports.integer = function(mapping) {
    return "integer";
};

exports.long = function(mapping) {
    return "bigint";
};

exports.short = function(mapping) {
    return "smallint";
};

exports.float = exports.double = function(mapping) {
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
    var buf = ["character"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
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
