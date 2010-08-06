export("BaseDialect");

function BaseDialect() {
    var typeNameMap = {};
    var jdbcTypeNumberMap = {};

    Object.defineProperty(this, "openQuote", {"value": '"'});
    Object.defineProperty(this, "closeQuote", {"value": '"'});

    this.registerDataType = function(typeName, dataType) {
        typeNameMap[typeName] = dataType;
        jdbcTypeNumberMap[dataType.jdbcTypeNumber] = dataType;
        return;
    };

    this.getColumnType = function(name) {
        return typeNameMap[name];
    };

    this.getColumnTypeByJdbcNumber = function(number) {
        return jdbcTypeNumberMap[number];
    };
    
    return this;
};

/**
 * Returns the storage engine type. This is only needed for MySQL databases
 * @returns The storage engine type
 * @type String
 */
BaseDialect.prototype.getEngineType = function() {
    return null;
};

/**
 * Returns the string passed as argument enclosed in quotes
 * @param {String} str The string to enclose in quotes
 * @returns The string enclosed in quotes
 * @type String
 */
BaseDialect.prototype.quote = function(str) {
    return this.openQuote + str + this.closeQuote;
};

/** @ignore */
BaseDialect.prototype.toString = function() {
    return "[Dialect " + this.name + "]";
};
