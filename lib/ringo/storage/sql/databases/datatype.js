export("DataType");

/**
 * @constructor
 */
var DataType = function(name, jdbcTypeNumber, jdbcTypeName, sqlTypeName, getter, setter, options) {
    
    Object.defineProperty(this, "name", {
        "get": function() {
            return name;
        }
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "get": function() {
            return jdbcTypeNumber;
        }
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "get": function() {
            return jdbcTypeName;
        }
    });

    Object.defineProperty(this, "sqlTypeName", {
        "get": function() {
            return sqlTypeName;
        }
    });
    
    Object.defineProperty(this, "options", {
        "get": function() {
            return options || {};
        }
    });
    
    this.get = function(resultSet, columnName) {
        return getter(resultSet, columnName);
    };
    
    /**
     * @param {Number} columnIdx The 1-based column index
     */
    this.set = function(preparedStatement, value, columnIdx) {
        return setter(preparedStatement, value, columnIdx);
    };
    
    return this;
};

DataType.prototype.toString = function() {
    return ["[DataType ", this.jdbcTypeName, " -> ", this.jdbcTypeNumber, " (SQL: ", this.sqlTypeName, ")]"].join("");
};

DataType.prototype.getSql = function(length, precision, scale) {
    var buf = [this.sqlTypeName];
    if (length != null || this.options.length != null) {
        buf.push("(", length || this.options.length, ")");
    }
    if (precision != null || this.options.precision != null) {
        buf.push("(", precision || this.options.precision);
        if (scale != null || this.options.scale != null) {
            buf.push(scale || this.options.scale);
        }
        buf.push(")");
    }
    return buf.join("");
};

/**
 * FIXME: this should be defined in datatype registry, me thinks
 * @returns
 */
DataType.prototype.needsQuotes = function() {
    switch (this.jdbcTypeNumber) {
        case java.sql.Types.CHAR:
        case java.sql.Types.VARCHAR:
        case java.sql.Types.LONGVARCHAR:
        case java.sql.Types.BINARY:
        case java.sql.Types.VARBINARY:
        case java.sql.Types.LONGVARBINARY:
        case java.sql.Types.DATE:
        case java.sql.Types.TIME:
        case java.sql.Types.TIMESTAMP:
           return true;
        default:
           return false;
     }
};

/**
 * FIXME: this is needed by datatype get/set methods too...
 * @returns
 */
DataType.prototype.quote = function(str) {
    if (str.charAt(0) !== openQuote) {
        return openQuote + str + closeQuote;
    }
    return str;
};
