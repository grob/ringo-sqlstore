export("Mapping");

var types = require("./types");

/**
 * Wrapper class for entity mapping definitions
 * @class Instances of this class wrap an entity mapping definition and
 * provide various helper getters
 * @param {Object} definition The mapping definition
 * @returns A newly created Mapping instance
 * @constructor
 */
var Mapping = function(store, definition) {
    
    var id = new IdMapping(this, definition.id);
    var propertyMap = {};
    var columnMap = {};
    columnMap[id.column] = id;
    
    Object.defineProperty(this, "store", {
        "value": store
    });
    
    Object.defineProperty(this, "properties", {
        "value": propertyMap
    });

    Object.defineProperty(this, "id", {
        "value": id
    });

    Object.defineProperty(this, "columns", {
        "value": columnMap
    });

    Object.defineProperty(this, "tableName", {
        "value": definition.table,
        "enumerable": true
    });

    Object.defineProperty(this, "schemaName", {
        "value": definition.schema,
        "enumerable": true
    });

    // convert all defined properties into their appropriate property mapping instances
    for (var propName in definition.properties) {
        var propDefinition = definition.properties[propName];
        var propMapping = null;
        if (propDefinition.type === "object") {
            propMapping = new ObjectMapping(this, propName, propDefinition);
        } else if (propDefinition.type === "collection") {
            propMapping = new CollectionMapping(this, propName, propDefinition);
        } else {
            propMapping = new PrimitiveMapping(this, propName, propDefinition);
        }
        propertyMap[propName] = propMapping;
        columnMap[propMapping.column] = propMapping;
    }

    return this;
};

/** @ignore */
Mapping.prototype.toString = function() {
    return "[Mapping (Table: " + this.tableName + ")]";
};

/**
 * Returns the mapping for the given property name 
 * @param {String} property The property name
 * @returns The property mapping
 * @type PrimitiveMapping | ObjectMapping | CollectionMapping
 */
Mapping.prototype.getMapping = function(property) {
    if (property === "id") {
        return this.id;
    }
    var propMapping = this.properties[property];
    if (propMapping == null) {
        throw new Error("No mapping found for property '" + property + "'");
    }
    return propMapping;
};

/**
 * Returns the column name for the given property
 * @param {String} property The name of the property
 * @returns The name of the column
 * @type String
 */
Mapping.prototype.getColumnName = function(property) {
    return this.getMapping(property).column;
};

/**
 * Returns the column type for the given property
 * @param {String} property The name of the property
 * @returns The column type
 * @type String
 */
Mapping.prototype.getColumnType = function(columnName) {
    return this.getMapping(property).getColumnType();
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
 * Decorates the mapping object with several methods common to all types
 * of property mappings
 * @param {Object} obj The Object to decorate
 * @returns The decorated mapping
 */
var decorate = function(proto) {

    proto.isPrimitive = function() {
        return !this.isCollectionMapping() && !this.isObjectMapping();
    };

    proto.isCollectionMapping = function() {
        return this instanceof CollectionMapping;
    };

    proto.isObjectMapping = function() {
        return this instanceof ObjectMapping;
    };

    proto.getMappedType = function() {
        if (!this.isPrimitive()) {
            return this.entity;
        }
        return null;
    };

    proto.getColumnType = function() {
        return this.mapping.store.dialect.getType(this.type);
    };
};


/**
 * @param mapping
 * @param definition
 * @returns
 * @constructor
 */
var IdMapping = function(mapping, definition) {

    if (definition == null) {
        definition = {};
    }
    
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    Object.defineProperty(this, "name", {
        "value": "id"
    });

    Object.defineProperty(this, "definition", {
        "value": definition
    });

    Object.defineProperty(this, "type", {
        "value": "long"
    });

    Object.defineProperty(this, "column", {
        "value": definition.column || this.name
    });

    Object.defineProperty(this, "sequence", {
        "value": definition.sequence
    });

    return this;
};
decorate(IdMapping.prototype);

/** @ignore */
IdMapping.prototype.toString = function() {
    return "[ID mapping " + this.name + "]";
};

/**
 * Returns true if this ID has a sequence defined
 * @returns True if a sequence is defined, false otherwise
 * @type Boolean 
 */
IdMapping.prototype.hasSequence = function() {
    return this.definition.sequence != null;
};


/**
 * @param mapping
 * @param name
 * @param definition
 * @returns
 * @constructor
 */
var PrimitiveMapping = function(mapping, name, definition) {

    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

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
decorate(PrimitiveMapping.prototype);

/** @ignore */
PrimitiveMapping.prototype.toString = function() {
    return "[Primitive Mapping " + this.name + "]";
};


/**
 * @param mapping
 * @param name
 * @param definition
 * @returns
 * @constructor
 */
var ObjectMapping = function(mapping, name, definition) {

    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

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
decorate(ObjectMapping.prototype);

/** @ignore */
ObjectMapping.prototype.toString = function() {
    return "[Object Mapping " + this.name + "]";
};


/**
 * @param mapping
 * @param name
 * @param definition
 * @returns
 * @constructor
 */
var CollectionMapping = function(mapping, name, definition) {

    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    Object.defineProperty(this, "name", {
        "value": name
    });

    Object.defineProperty(this, "definition", {
        "value": definition
    });

    Object.defineProperty(this, "type", {
        "value": null
    });

    Object.defineProperty(this, "entity", {
        "value": definition.entity
    });

    Object.defineProperty(this, "localProperty", {
        "value": definition.localProperty
    });

    Object.defineProperty(this, "foreignProperty", {
        "value": definition.foreignProperty || "id"
    });

    return this;
};
decorate(CollectionMapping.prototype);

/** @ignore */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
