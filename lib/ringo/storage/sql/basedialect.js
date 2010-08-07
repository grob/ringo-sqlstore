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

/**
 * Returns true if the underlying database supports sequences. Dialect
 * implementations should override this.
 * @returns True if the database supports sequences, false otherwise
 * @type Boolean
 */
BaseDialect.prototype.hasSequenceSupport = function() {
    return false;
};

/**
 * Returns the SQL statement for retrieving the next value of a sequence. Dialect
 * implementations should override this.
 * @param {String} sequenceName The name of the sequence
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlNextSequenceValue = function(sequenceName) {
    return "";
};

/**
 * Extends the SQL statement passed as argument with a limit restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the limit restriction to
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlLimit = function(sql, limit) {
    throw new Error("Limit not implemented");
};

/**
 * Extends the SQL statement passed as argument with an offset restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the offset restriction to
 * @param {Number} offset The offset
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlOffset = function(sql, offset) {
    throw new Error("Offset not implemented");
};

/**
 * Extends the SQL statement passed as argument with a range restriction. Dialect
 * implementations should override this.
 * @param {String} sql The SQL statement to add the range restriction to
 * @param {Number} offset The offset
 * @param {Limit} limit The limit
 * @returns The SQL statement
 * @type String
 */
BaseDialect.prototype.getSqlRange = function(sql, offset, limit) {
    throw new Error("Range not implemented");
};
