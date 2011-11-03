export("Mapping");

var types = require("./types");
var log = require('ringo/logging').getLogger(module.id);
var sqlUtils = require("./util");

/**
 * Wrapper class for entity mapping definitions
 * @class Instances of this class wrap an entity mapping definition and
 * provide various helper getters
 * @param {String} type The entity type this mapping belongs to
 * @param {Object} definition The mapping definition
 * @returns A newly created Mapping instance
 * @constructor
 */
var Mapping = function(store, type, definition) {
    
    var id = new IdMapping(this, definition.id);
    var propertyMap = {};
    var columnMap = {};
    columnMap[id.column] = id;
    
    /**
     * The store this mapping belongs to
     * @type Store
     */
    Object.defineProperty(this, "store", {
        "value": store
    });

    /**
     * The entity type name this mapping belongs to
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": type
    });

    /**
     * A map containing the property mappings by property name
     * @type Object
     */
    Object.defineProperty(this, "properties", {
        "value": propertyMap
    });

    /**
     * The ID mapping
     * @type IdMapping
     */
    Object.defineProperty(this, "id", {
        "value": id
    });

    /**
     * A map containing the property mappings by column name
     * @type Object
     */
    Object.defineProperty(this, "columns", {
        "value": columnMap
    });

    /**
     * The table name of this mapping, or the entity type name if not
     * specified in the mapping definition
     * @type String
     */
    Object.defineProperty(this, "tableName", {
        "value": definition.table || type,
        "enumerable": true
    });

    /**
     * The schema name
     * @type String
     */
    Object.defineProperty(this, "schemaName", {
        "value": definition.schema,
        "enumerable": true
    });
    
    /**
     * The schema name
     * @type String
     */
    Object.defineProperty(this, "engine", {
        "value": definition.engine,
        "enumerable": true
    });

    // convert all defined properties into their appropriate property mapping instances
    for (var propName in definition.properties) {
        var propDefinition = definition.properties[propName];
        var propMapping = null;
        if (typeof propDefinition === "string") {
            propDefinition = {"type": propDefinition};
        }
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
 * Returns the qualified column name, prefixed with the table name
 * @param {String} property The name of the property
 * @param {Dialect} dialect The database dialect to use for quoting
 * @returns The qualified column name
 * @type String
 */
Mapping.prototype.getQualifiedColumnName = function(property, dialect) {
    return this.getMapping(property).getQualifiedColumnName(dialect);
};

/**
 * Returns the column type for the given property
 * @param {String} property The name of the property
 * @returns The column type
 * @type String
 */
Mapping.prototype.getColumnType = function(property) {
    return this.getMapping(property).type;
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
var decoratePrototype = function(proto) {

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

    proto.getQualifiedColumnName = function(dialect) {
        var name = this.mapping.getQualifiedTableName(dialect);
        return name + "." + dialect.quote(this.column);
    };

};


/**
 * Returns a newly created IdMapping instance
 * @class Instances of this class represent an ID mapping
 * @param {Mapping} mapping The parent mapping
 * @param {Object} definition The ID mapping definition
 * @returns A newly created IdMapping instance
 * @constructor
 */
var IdMapping = function(mapping, definition) {

    var idCounter = 0;
    if (definition == null) {
        definition = {};
    }

    /**
     * Contains the parent mapping
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    /**
     * Contains the property name of this IdMapping (always "id")
     * @type String
     */
    Object.defineProperty(this, "name", {
        "value": "id"
    });

    /**
     * Contains the mapping definition of this IdMapping instance
     * @type Object 
     */
    Object.defineProperty(this, "definition", {
        "value": definition
    });

    /**
     * Contains the column type ("long")
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": "long"
    });

    /**
     * Contains the column in which the ID is stored. Defaults to "id"
     * @type String
     */
    Object.defineProperty(this, "column", {
        "value": definition.column || this.name
    });

    /**
     * Contains the sequence this IdMapping uses
     * @type String
     */
    Object.defineProperty(this, "sequence", {
        "value": definition.sequence
    });

    /**
     * Generates a new id for the given type, by either using a defined sequence
     * or incrementing the max-ID from the table for the given type. If no sequence
     * is specified or the database doesn't support sequences, this method utilizes
     * an internal ID counter and returns either the max-ID from the table or
     * the value of the internal counter, whichever is higher.
     * @param {String} transaction Optional transaction
     * @returns The next unused id
     * @type Number
     */
    this.getNextId = sync(function(transaction) {
        var sqlBuf = new java.lang.StringBuffer();
        var dialect = this.mapping.store.dialect;
        var usingSequence = false;
        if (this.hasSequence() && dialect.hasSequenceSupport()) {
            // got a sequence, retrieve it's next value
            sqlBuf.append(dialect.getSqlNextSequenceValue(this.sequence));
            usingSequence = true;
        } else {
            // no sequence, increment the biggest id used in the table
            sqlBuf.append("SELECT MAX(");
            sqlBuf.append(this.getQualifiedColumnName(dialect));
            sqlBuf.append(") FROM ");
            sqlBuf.append(mapping.getQualifiedTableName(dialect));
        }

        var statement = null;
        var resultSet = null;
        var conn = (transaction || this.mapping.store).getConnection();
        log.debug("Retrieving next ID for", this.getQualifiedColumnName(dialect),
                sqlBuf.toString());
        try {
            statement = conn.createStatement();
            resultSet = statement.executeQuery(sqlBuf.toString());
            resultSet.next();
            var nextId = resultSet.getLong(1);
            if (!usingSequence) {
                nextId = idCounter = Math.max(idCounter + 1, nextId + 1);
            }
            return nextId;
        } finally {
            sqlUtils.close(resultSet);
            sqlUtils.close(statement);
            if (conn != null && !transaction) {
                sqlUtils.close(conn);
            }
        }
    }, idCounter);

    return this;
};
decoratePrototype(IdMapping.prototype);

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
 * Returns a newly created PrimitiveMapping instance
 * @class Instances of this class represent a primitive value mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 */
var PrimitiveMapping = function(mapping, name, definition) {

    /**
     * Contains the parent mapping
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    /**
     * Contains the property name of this mapping
     * @type String
     */
    Object.defineProperty(this, "name", {
        "value": name
    });

    /**
     * Contains the mapping definition of this PrimitiveMapping instance
     * @type Object 
     */
    Object.defineProperty(this, "definition", {
        "value": definition
    });

    /**
     * Contains the column type
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": definition.type
    });

    /**
     * Contains the column in which the value of this property mapping is stored
     * @type String
     */
    Object.defineProperty(this, "column", {
        "value": definition.column || name
    });

    /**
     * Contains true if null values are allowed
     * @type Boolean
     */
    Object.defineProperty(this, "nullable", {
        "value": definition.nullable !== false
    });

    /**
     * Contains the maximum length of this property
     * @type Number
     */
    Object.defineProperty(this, "length", {
        "value": definition.length
    });

    /**
     * Contains the precision of this property
     * @type Number
     */
    Object.defineProperty(this, "precision", {
        "value": definition.precision
    });

    /**
     * Contains the scale of this property
     * @type Number
     */
    Object.defineProperty(this, "scale", {
        "value": definition.scale
    });

    return this;
};
decoratePrototype(PrimitiveMapping.prototype);

/** @ignore */
PrimitiveMapping.prototype.toString = function() {
    return "[Primitive Mapping " + this.name + "]";
};


/**
 * Returns 
 * @param mapping
 * @param name
 * @param definition
 * @returns
 * @constructor
 */
var ObjectMapping = function(mapping, name, definition) {

    // argument checks
    if (typeof(definition.entity) !== "string" || definition.entity.length < 1) {
        throw new Error("No entity specified for object mapping '" +
                mapping.type + "." + name + "'");
    }

    /**
     * Contains the parent mapping
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    /**
     * Contains the property name of this mapping
     * @type String
     */
    Object.defineProperty(this, "name", {
        "value": name
    });

    /**
     * Contains the mapping definition of this ObjectMapping instance
     * @type Object 
     */
    Object.defineProperty(this, "definition", {
        "value": definition
    });

    /**
     * Contains the column type
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": "long"
    });

    /**
     * Contains the column in which the value of this property mapping is stored
     * @type String
     */
    Object.defineProperty(this, "column", {
        "value": definition.column || name
    });

    /**
     * Contains the type name of the mapped entity
     * @type String
     */
    Object.defineProperty(this, "entity", {
        "value": definition.entity
    });

    /**
     * Contains the name of the mapped entity's property used as the foreign key
     * @type String
     */
    Object.defineProperty(this, "foreignProperty", {
        "value": definition.foreignProperty || "id"
    });
    
    return this;
};
decoratePrototype(ObjectMapping.prototype);

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

    // argument checks
    if (typeof(definition.entity) !== "string" || definition.entity.length < 1) {
        throw new Error("No entity specified for collection mapping '" +
                mapping.type + "." + name + "'");
    }

    /**
     * Contains the parent mapping
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    /**
     * Contains the property name of this mapping
     * @type String
     */
    Object.defineProperty(this, "name", {
        "value": name
    });

    /**
     * Contains the mapping definition of this CollectionMapping instance
     * @type Object 
     */
    Object.defineProperty(this, "definition", {
        "value": definition
    });

    /**
     * Contains the column type
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": null
    });

    /**
     * Contains the type name of the mapped entities
     * @type String
     */
    Object.defineProperty(this, "entity", {
        "value": definition.entity
    });

    /**
     * Contains the name of the joined entity
     * @type String 
     */
    Object.defineProperty(this, "through", {
        "value": definition.through || null
    });
    
    /**
     * Contains the join predicate
     * @type String
     */
    Object.defineProperty(this, "join", {
        "value": definition.join || null
    });
    
    /**
     * Contains the name of the property of the entity owning this collection
     * used as a local key value. Defaults to "id".
     * @type String
     */
    Object.defineProperty(this, "localProperty", {
        "value": definition.localProperty || "id"
    });

    /**
     * Contains the name of the property of the mapped entity used as the foreign
     * key value
     * @type String
     */
    Object.defineProperty(this, "foreignProperty", {
        "value": definition.foreignProperty || null
    });

    /**
     * True if this collection is partitioned
     * @type Boolean
     */
    Object.defineProperty(this, "isPartitioned", {
        "value": definition.isPartitioned === true
    });

    /**
     * The size of a single partition. Only used if isPartitioned is true. Defaults
     * to 100.
     * @type Number
     */
    Object.defineProperty(this, "partitionSize", {
        "value": definition.partitionSize || 100
    });

    /**
     * True if the entities in this collection are aggressively loaded. Defaults
     * to false
     * @type Boolean
     */
    Object.defineProperty(this, "loadAggressive", {
        "value": definition.loadAggressive === true
    });

    /**
     * The "order by" expression
     * @type String
     */
    Object.defineProperty(this, "orderBy", {
        "value": definition.orderBy || null
    });
    
    /**
     * The collection size limit
     * @type Number
     */
    Object.defineProperty(this, "limit", {
        "value": definition.limit || null
    });

    /**
     * The collection filter
     * @type String
     */
    Object.defineProperty(this, "filter", {
        "value": definition.filter || null
    });

    return this;
};
decoratePrototype(CollectionMapping.prototype);

/** @ignore */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
