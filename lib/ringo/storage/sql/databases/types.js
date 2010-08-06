export(
    "IntegerType",
    "LongType",
    "ShortType",
    "FloatType",
    "DoubleType",
    "CharacterType",
    "StringType",
    "ByteType",
    "BooleanType",
    "DateType",
    "TimeType",
    "TimestampType",
    "BinaryType",
    "TextType"
);

/**
 * @class Base class for all other types
 * @returns A newly created PropertyType instance
 * @constructor
 */
function PropertyType() {

    Object.defineProperty(this, "openQuote", {"value": "'"});
    Object.defineProperty(this, "closeQuote", {"value": "'"});

    this.get = function(resultSet, name) {
        throw new Error("Missing implementation");
    };
    
    this.set = function(preparedStatement, value, index) {
        throw new Error("Missing implementation");
    };

    this.needsQuotes = function() {
        return false;
    };
    
    return this;
};

/**
 * Returns the string passed as argument enclosed in quotes
 */
PropertyType.prototype.quote = function(str) {
    if (str.charAt(0) !== this.openQuote) {
        return this.openQuote + str + this.closeQuote;
    }
    return str;
};

PropertyType.prototype.getSql = function(length, precision, scale) {
    var buf = [this.sqlTypeName];
    if (length != null || this.options.length != null) {
        buf.push("(", length || this.options.length, ")");
    }
    if (precision != null || this.options.precision != null) {
        buf.push("(", precision || this.options.precision);
        if (scale != null || this.options.scale != null) {
            buf.push(", ", scale || this.options.scale);
        }
        buf.push(")");
    }
    return buf.join("");
};

var decorate = function(obj) {
    Object.defineProperty(obj, "name", {
        "get": function() {
            return name;
        },
        "enumerable": true,
    });
};
    
    
/**
 * Returns a newly created IntegerType instance
 * @class Instances of this class represent an integer property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created IntegerType instance
 * @constructor
 */
function IntegerType(sqlTypeName, options) {

    Object.defineProperty(this, "name", {
        "value": "integer",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "INTEGER",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });
    
    this.get = function(resultSet, name) {
        return resultSet.getLong(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setLong(index, value);
    };
    
    return this;
};
// extend PropertyType
IntegerType.prototype = new PropertyType();

/**
 * Returns a newly created LongType instance
 * @class Instances of this class represent a long property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created LongType instance
 * @constructor
 */
function LongType(sqlTypeName, options) {

    Object.defineProperty(this, "name", {
        "value": "long",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "BIGINT",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });
    
    this.get = function(resultSet, name) {
        return resultSet.getLong(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setLong(index, value);
    };
    
    return this;
};
// extend PropertyType
LongType.prototype = new PropertyType();

/**
 * Returns a newly created ShortType instance
 * @class Instances of this class represent a short integer property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created SmallIntType instance
 * @constructor
 */
function ShortType(sqlTypeName, options) {

    Object.defineProperty(this, "name", {
        "value": "short",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "SMALLINT",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });
    
    this.get = function(resultSet, name) {
        return resultSet.getLong(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setLong(index, value);
    };
    
    return this;
};
// extend PropertyType
ShortType.prototype = new PropertyType();

/**
 * Returns a newly created FloatType instance
 * @class Instances of this class represent a float property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created FloatType instance
 * @constructor
 */
function FloatType(sqlTypeName, options) {

    Object.defineProperty(this, "name", {
        "value": "float",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "FLOAT",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });
    
    this.get = function(resultSet, name) {
        return resultSet.getDouble(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setDouble(index, value);
    };
    
    return this;
};
// extend PropertyType
FloatType.prototype = new PropertyType();

/**
 * Returns a newly created DoubleType instance
 * @class Instances of this class represent a double property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created DoubleType instance
 * @constructor
 */
function DoubleType(sqlTypeName, options) {

    Object.defineProperty(this, "name", {
        "value": "double",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "DOUBLE",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });
    
    this.get = function(resultSet, name) {
        return resultSet.getDouble(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setDouble(index, value);
    };
    
    return this;
};
// extend PropertyType
DoubleType.prototype = new PropertyType();

/**
 * Returns a newly created CharacterType instance
 * @class Instances of this class represent an character property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created CharacterType instance
 * @constructor
 */
function CharacterType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "character",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "CHAR",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.needsQuotes = function() {
        return true;
    };
    
    this.get = function(resultSet, name) {
        return resultSet.getString(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setString(index, value);
    };
    
    return this;
};
// extend PropertyType
CharacterType.prototype = new PropertyType();

/**
 * Returns a newly created StringType instance
 * @class Instances of this class represent a string property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created StringType instance
 * @constructor
 */
function StringType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "string",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "VARCHAR",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.needsQuotes = function() {
        return true;
    };
    
    this.get = function(resultSet, name) {
        return resultSet.getString(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setString(index, value);
    };
    
    return this;
};
// extend PropertyType
StringType.prototype = new PropertyType();

/**
 * Returns a newly created ByteType instance
 * @class Instances of this class represent a byte property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created ByteType instance
 * @constructor
 */
function ByteType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "byte",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "TINYINT",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.get = function(resultSet, name) {
        return resultSet.getLong(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setLong(index, value);
    };
    
    return this;
};
// extend PropertyType
ByteType.prototype = new PropertyType();

/**
 * Returns a newly created BooleanType instance
 * @class Instances of this class represent a boolean property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created BooleanType instance
 * @constructor
 */
function BooleanType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "boolean",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "BIT",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.get = function(resultSet, name) {
        return resultSet.getBoolean(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setBoolean(index, value);
    };
    
    return this;
};
// extend PropertyType
BooleanType.prototype = new PropertyType();

/**
 * Returns a newly created DateType instance
 * @class Instances of this class represent a date property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created DateType instance
 * @constructor
 */
function DateType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "date",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "DATE",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.get = function(resultSet, name) {
        var date = resultSet.getDate(name);
        if (date != null) {
            return new Date(date.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setDate(index, value);
    };
    
    return this;
};
// extend PropertyType
DateType.prototype = new PropertyType();

/**
 * Returns a newly created TimeType instance
 * @class Instances of this class represent a time property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created TimeType instance
 * @constructor
 */
function TimeType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "time",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "TIME",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.get = function(resultSet, name) {
        var time = resultSet.getDate(name);
        if (time != null) {
            return new Date(time.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setTime(index, value);
    };
    
    return this;
};
// extend PropertyType
TimeType.prototype = new PropertyType();

/**
 * Returns a newly created TimestampType instance
 * @class Instances of this class represent a timestamp property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created TimestampType instance
 * @constructor
 */
function TimestampType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "timestamp",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "TIMESTAMP",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.get = function(resultSet, name) {
        var timestamp = resultSet.getTimestamp(name);
        if (timestamp != null) {
            return new Date(timestamp.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setTimestamp(index, new java.sql.Timestamp(value.getTime()));
    };
    
    return this;
};
// extend PropertyType
TimestampType.prototype = new PropertyType();

/**
 * Returns a newly created BinaryType instance
 * @class Instances of this class represent a binary property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created BinaryType instance
 * @constructor
 */
function BinaryType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "binary",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "BLOB",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.needsQuotes = function() {
        return true;
    };

    this.get = function(resultSet, name) {
        return resultSet.getString(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setString(index, value);
    };
    
    return this;
};
// extend PropertyType
BinaryType.prototype = new PropertyType();

/**
 * Returns a newly created TextType instance
 * @class Instances of this class represent a text property type 
 * @param {String} sqlTypeName The name of the database column type
 * @param {Object} options Optional column type options
 * @returns A newly created TextType instance
 * @constructor
 */
function TextType(sqlTypeName, options) {
    
    Object.defineProperty(this, "name", {
        "value": "text",
        "enumerable": true,
    });

    Object.defineProperty(this, "sqlTypeName", {
        "value": sqlTypeName,
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeName", {
        "value": "LONGVARCHAR",
        "enumerable": true,
    });
    
    Object.defineProperty(this, "jdbcTypeNumber", {
        "value": java.sql.Types[this.jdbcTypeName],
        "enumerable": true,
    });
    
    Object.defineProperty(this, "options", {
        "value": options || {},
        "enumerable": true,
    });

    this.needsQuotes = function() {
        return true;
    };

    this.get = function(resultSet, name) {
        return resultSet.getString(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setString(index, value);
    };
    
    return this;
};
// extend PropertyType
TextType.prototype = new PropertyType();
