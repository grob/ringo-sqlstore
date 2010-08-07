export("Mapping");

/**
 * Wrapper class for entity mapping definitions
 * @class Instances of this class wrap an entity mapping definition and
 * provide various helper getters
 * @param {Object} definition The mapping definition
 * @returns A newly created Mapping instance
 * @constructor
 */
var Mapping = function(definition) {
    
    Object.defineProperty(this, "definition", {
        "value": definition
    });
    
    Object.defineProperty(this, "tableName", {
        "value": definition.table,
        "enumerable": true
    });

    Object.defineProperty(this, "idColumnName", {
        "get": function() {
            if (definition.id != null && definition.id.column != null) {
                return definition.id.column;
            }
            return "id";
        },
        "enumerable": true
    });

    Object.defineProperty(this, "idSequenceName", {
        "get": function() {
            if (definition.id != null && definition.id.sequence != null) {
                return definition.id.sequence;
            }
            return null;
        },
        "enumerable": true
    });
    
    Object.defineProperty(this, "properties", {
        "get": function() {
            return definition.properties || {};
        },
        "enumerable": true
    });

    return this;
};

/** @ignore */
Mapping.prototype.toString = function() {
    return "[Mapping (Table: " + this.tableName + ")]";
};

/**
 * Returns true if this mapping has an ID sequence defined
 * @returns True if an ID sequence is defined, false otherwise
 * @type Boolean 
 */
Mapping.prototype.hasIdSequence = function() {
    return this.idSequenceName !== null;
};

/**
 * Returns the column name for the given property
 * @param {String} property The name of the property
 * @returns The name of the column
 * @type String
 */
Mapping.prototype.getColumnName = function(property) {
    if (property === "id") {
        return this.idColumnName;
    }
    var propMapping = this.properties[property];
    if (propMapping == null) {
        throw new Error("No mapping found for property '" + property + "'");
    }
    return propMapping.column || property;
};

/**
 * Returns the column type for the given property
 * @param {String} property The name of the property
 * @returns The column type
 * @type String
 */
Mapping.prototype.getColumnType = function(property) {
    if (property === "id") {
        return "integer";
    }
    var propMapping = this.properties[property];
    if (propMapping == null) {
        throw new Error("No mapping found for property '" + property + "'");
    }
    return propMapping.type || "string";
};
