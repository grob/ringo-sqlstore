exports.integer = function(mapping) {
    return ["number(", mapping.length || 10, ", 0)"].join("");
};

exports.short = function(mapping) {
    return ["number(", mapping.length || 5, ", 0)"].join("");
};

exports.long = function(mapping) {
    return ["number(", mapping.length || 19, ", 0)"].join("");
};

exports.double = function(mapping) {
    if (mapping.precision) {
        var buf = [];
        buf.push("number(", mapping.precision);
        if (mapping.scale) {
            buf.push(", ", mapping.scale);
        }
        buf.push(")");
        return buf.join("");
    }
    return "binary_double";
};

exports.character = function(mapping) {
    var buf = ["char"];
    if (mapping.length) {
        buf.push("(", mapping.length, " char)");
    }
    return buf.join("");
};

exports.string = function(mapping) {
    return ["varchar2", "(", mapping.length || 4000, " char)"].join("");
};

exports.byte = function(mapping) {
    return "number(3,0)";
};

exports.boolean = function(mapping) {
    return "number(1,0)";
};

exports.date = function(mapping) {
    return "date";
};

exports.time = function(mapping) {
    return "date";
};

exports.timestamp = function(mapping) {
    return "timestamp";
};

exports.binary = function(mapping) {
    return "blob";
};

exports.text = function(mapping) {
    return "clob";
};

