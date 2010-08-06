var dataTypes = require("./types");
var BaseDialect = require("./basedialect").BaseDialect;

/**
 * Database Dialect for H2 databases
 * @constructor
 * @returns
 */
var Dialect = function() {
    this.registerDataType("integer", new dataTypes.IntegerType("integer"));
    this.registerDataType("long", new dataTypes.LongType("bigint"));
    this.registerDataType("short", new dataTypes.ShortType("smallint"));
    this.registerDataType("float", new dataTypes.FloatType("float"));
    this.registerDataType("double", new dataTypes.DoubleType("double"));
    this.registerDataType("character", new dataTypes.CharacterType("char"));
    this.registerDataType("string", new dataTypes.StringType("varchar", {
        // using 4000 as limit, because the whole row size must not exceed 65535 bytes...
        "length": 4000
    }));
    this.registerDataType("byte", new dataTypes.ByteType("tinyint"));
    this.registerDataType("boolean", new dataTypes.BooleanType("boolean"));
    this.registerDataType("date", new dataTypes.DateType("date"));
    this.registerDataType("time", new dataTypes.TimeType("time"));
    this.registerDataType("timestamp", new dataTypes.TimestampType("timestamp"));
    this.registerDataType("binary", new dataTypes.BinaryType("blob"));
    this.registerDataType("text", new dataTypes.TextType("longvarchar"));
    
    return this;
}
// extend BaseDialect
Dialect.prototype = new BaseDialect();

/**
 * Returns true
 * @returns True
 * @type Boolean
 */
Dialect.prototype.hasSequenceSupport = function() {
    return true;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence
 * @param {String} sequenceName The name of the sequence
 * @returns The SQL statement
 * @type String
 */
Dialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "SELECT NEXT VALUE FOR " + this.quote(sequenceName);
};

exports = new Dialect();
