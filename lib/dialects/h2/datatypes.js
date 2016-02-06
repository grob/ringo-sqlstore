exports.integer = function(mapping) {
    var type = "int";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

exports.long = function(mapping) {
    var type = "bigint";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

exports.short = function(mapping) {
    var type = "smallint";
    if (mapping.autoIncrement === true) {
        type += " auto_increment";
    }
    return type;
};

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

exports.character = function(mapping) {
    var buf = ["char"];
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
    return "tinyint";
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

exports.binary = function(mapping) {
    var buf = ["blob"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

exports.text = function(mapping) {
    var buf = ["clob"];
    if (mapping.length) {
        buf.push("(", mapping.length, ")");
    }
    return buf.join("");
};

