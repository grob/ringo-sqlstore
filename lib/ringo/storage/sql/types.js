export(
    "ColumnType",
    "StringType",
    "IntegerType",
    "BooleanType",
    "FloatType",
    "DateType",
    "TimeType",
    "TimestampType",
    "BinaryType"
);

var ColumnType = function(jdbcType, sql, options) {

    Object.defineProperty(this, "jdbcType", {"value": jdbcType});
    Object.defineProperty(this, "sql", {"value": sql});
    Object.defineProperty(this, "options", {"value": options || {}});

    return this;
};

/** @ignore */
ColumnType.prototype.toString = function() {
    return "[ColumnType " + this.sql + "]";
};

ColumnType.prototype.getSql = function(length, precision, scale) {
    var buf = [this.sql];
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

/**
 * Returns a newly created IntegerType instance
 * @class Instances of this class represent an integer property type 
 * @returns A newly created IntegerType instance
 * @constructor
 */
function IntegerType() {

    this.get = function(resultSet, name, idx) {
        var value = resultSet.getLong(name);
        if (resultSet.wasNull()) {
            return null;
        }
        return value;
    };
    
    this.set = function(preparedStatement, value, index) {
        return preparedStatement.setLong(index, value);
    };
    
    return this;
};

/**
 * Returns a newly created FloatType instance
 * @class Instances of this class represent a float property type 
 * @returns A newly created FloatType instance
 * @constructor
 */
function FloatType() {

    this.get = function(resultSet, name, idx) {
        var value = resultSet.getDouble(name);
        if (resultSet.wasNull()) {
            return null;
        }
        return value;
    };
    
    this.set = function(preparedStatement, value, index) {
        return preparedStatement.setDouble(index, value);
    };
    
    return this;
};

/**
 * Returns a newly created StringType instance
 * @class Instances of this class represent an character property type 
 * @returns A newly created StringType instance
 * @constructor
 */
function StringType() {
    
    this.get = function(resultSet, name, idx) {
        try {
            return resultSet.getString(name);
        } catch (e) {
            var reader = resultSet.getCharacterStream(name);
            if (reader == null) {
                return null;
            }
            var out = new java.lang.StringBuffer();
            var buffer = new java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 2048);
            var read = -1;
            while ((read = reader.read(buffer)) > -1) {
                out.append(buffer, 0, read);
            }
            return out.toString();
        }
    };
    
    this.set = function(preparedStatement, value, index) {
        try {
            preparedStatement.setString(index, value);
        } catch (e) {
            var reader = new StringReader(str);
            preparedStatement.setCharacterStream(index, reader, value.length);
        }
    };
    
    return this;
};

/**
 * Returns a newly created BooleanType instance
 * @class Instances of this class represent a boolean property type 
 * @returns A newly created BooleanType instance
 * @constructor
 */
function BooleanType() {
    
    this.get = function(resultSet, name, idx) {
        return resultSet.getBoolean(name);
    };
    
    this.set = function(preparedStatement, value, index) {
        preparedStatement.setBoolean(index, value);
    };
    
    return this;
};

/**
 * Returns a newly created DateType instance
 * @class Instances of this class represent a date property type 
 * @returns A newly created DateType instance
 * @constructor
 */
function DateType() {
    
    this.get = function(resultSet, name, idx) {
        var date = resultSet.getDate(name);
        if (date !== null) {
            return new Date(date.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        var date = new java.sql.Date(value.getTime());
        return preparedStatement.setDate(index, date);
    };
    
    return this;
};

/**
 * Returns a newly created TimeType instance
 * @class Instances of this class represent a time property type 
 * @returns A newly created TimeType instance
 * @constructor
 */
function TimeType() {
    
    this.get = function(resultSet, name, idx) {
        var time = resultSet.getTime(name);
        if (time !== null) {
            return new Date(time.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        var time = new java.sql.Time(value.getTime());
        return preparedStatement.setTime(index, time);
    };
    
    return this;
};

/**
 * Returns a newly created TimestampType instance
 * @class Instances of this class represent a timestamp property type 
 * @returns A newly created TimestampType instance
 * @constructor
 */
function TimestampType() {
    
    this.get = function(resultSet, name, idx) {
        var timestamp = resultSet.getTimestamp(name);
        if (timestamp !== null) {
            return new Date(timestamp.getTime());
        }
        return null;
    };
    
    this.set = function(preparedStatement, value, index) {
        return preparedStatement.setTimestamp(index, new java.sql.Timestamp(value.getTime()));
    };
    
    return this;
};

/**
 * Returns a newly created BinaryType instance
 * @class Instances of this class represent a binary property type 
 * @returns A newly created BinaryType instance
 * @constructor
 */
function BinaryType() {

    this.get = function(resultSet, name, idx) {
        // return resultSet.getBytes(name);
        var inStream = resultSet.getBinaryStream(name);
        if (inStream == null) {
            return null;
        }
        var out = new java.io.ByteArrayOutputStream();
        var buffer = new java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 2048);
        var read = -1;
        while ((read = inStream.read(buffer)) > -1) {
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    };

    this.set = function(preparedStatement, value, index) {
        // return preparedStatement.setBytes(index, value);
        if (value.getClass().getComponentType().equals(java.lang.Byte.TYPE)) {
            try {
                preparedStatement.setBytes(index, value);
            } catch (e) {
                var buf = (new java.lang.String(value)).getBytes();
                var stream = new java.io.ByteArrayInputStream(buf);
                preparedStatement.setBinaryStream(index, stream, buf.length);
            }
        } else {
            throw new Error("Expected byte[] for binary column");
        }
    };

    return this;
};
