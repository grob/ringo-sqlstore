exports.integer = function(mapping) {
    var buf = ["integer"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.long = function(mapping) {
    var buf = ["bigint"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.short = function(mapping) {
    var buf = ["smallint"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.float = exports.double = function(mapping) {
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

exports.character = function(mapping) {
    var buf = ["char"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.string = function(mapping) {
    return ["varchar", "(", mapping.length || 4000, ")"].join("");
};

exports.byte = function(mapping) {
    return "tinyint";
};

exports.boolean = function(mapping) {
    return "bit";
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

exports.binary = function(mapping) {
    return "longblob";
};

exports.text = function(mapping) {
    return "longtext";
};

