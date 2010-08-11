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
    
    var properties = {};
    
    Object.defineProperty(this, "definition", {
        "value": definition
    });
    
    Object.defineProperty(this, "schemaName", {
        "value": definition.schema,
        "enumerable": true
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
            return properties;
        },
        "enumerable": true
    });

    for (var propName in definition.properties) {
        var propDefinition = definition.properties[propName];
        var propMapping = null;
        if (propDefinition.type === "object") {
            propMapping = new ObjectProperty(this, propName, propDefinition);
        } else if (propDefinition.type === "collection") {
            propMapping = new CollectionProperty(this, propName, propDefinition);
        } else {
            propMapping = new PrimitiveProperty(this, propName, propDefinition);
        }
        properties[propName] = propMapping;
    }

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
    return propMapping.column;
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
    return propMapping.type;
};

/**
 * Returns the qualified table name, prefixed with an optional schema name
 * @param {Dialect} dialect The database dialect to use for quoting
 * @returns The qualified table name
 * @type String
 */
Mapping.prototype.getQualifiedTableName = function(dialect) {
    var name = dialect.quote(this.tableName);
    if (this.schemaName != null) {
        return dialect.quote(this.schemaName) + "." + name;
    }
    return name;
};

/**
 * @param name
 * @param definition
 * @returns A newly created Property instance
 * @constructor
 */
var Property = function() {
    
    return this;
};

/** @ignore */
Property.prototype.toString = function() {
    return "[Property " + this.name + "]";
};

Property.prototype.isPrimitive = function() {
    return !this.isCollection() && !this.isMappedToEntity();
};

Property.prototype.isCollection = function() {
    return this instanceof CollectionProperty;
};

Property.prototype.isMappedToEntity = function() {
    return this instanceof ObjectProperty;
};

Property.prototype.getMappedType = function() {
    if (this.isCollection() || this.isMappedToEntity()) {
        return this.definition.entity;
    }
    return null;
};


var PrimitiveProperty = function(mapping, name, definition) {

    Object.defineProperty(this, "name", {
        "value": name
    });

    Object.defineProperty(this, "definition", {
        "value": definition
    });

    Object.defineProperty(this, "type", {
        "value": definition.type
    });

    Object.defineProperty(this, "column", {
        "value": definition.column || name
    });

    Object.defineProperty(this, "nullable", {
        "value": definition.nullable !== false
    });

    Object.defineProperty(this, "default", {
        "value": definition["default"]
    });

    Object.defineProperty(this, "length", {
        "value": definition.length
    });

    Object.defineProperty(this, "precision", {
        "value": definition.precision
    });

    Object.defineProperty(this, "scale", {
        "value": definition.scale
    });

    return this;
};
// extend Property
PrimitiveProperty.prototype = new Property();


var ObjectProperty = function(mapping, name, definition) {

    Object.defineProperty(this, "name", {
        "value": name
    });

    Object.defineProperty(this, "definition", {
        "value": definition
    });

    Object.defineProperty(this, "type", {
        "value": "integer"
    });

    Object.defineProperty(this, "column", {
        "value": definition.column || name
    });

    Object.defineProperty(this, "entity", {
        "value": definition.entity
    });

    Object.defineProperty(this, "foreignProperty", {
        "value": definition.foreignProperty || "id"
    });

    return this;
};
// extend Property
ObjectProperty.prototype = new Property();

/** @ignore */
ObjectProperty.prototype.toString = function() {
    return "[Object Property " + this.name + "]";
};



var CollectionProperty = function(mapping, name, definition) {

    Object.defineProperty(this, "name", {
        "value": name
    });

    Object.defineProperty(this, "definition", {
        "value": definition
    });

    Object.defineProperty(this, "type", {
        "value": null
    });

    Object.defineProperty(this, "localProperty", {
        "value": definition.localProperty
    });

    Object.defineProperty(this, "foreignProperty", {
        "value": definition.foreignProperty || "id"
    });

    return this;
};
// extend Property
CollectionProperty.prototype = new Property();

/** @ignore */
CollectionProperty.prototype.toString = function() {
    return "[Collection Property " + this.name + "]";
};
