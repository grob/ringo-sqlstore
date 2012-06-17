export("Mapping");

var log = require('ringo/logging').getLogger(module.id);
var sqlUtils = require("./util");

/**
 * The base prototype for property mappings
 * @type Object
 */
var MAPPING_BASE = {
    "isPrimitive": function() {
        return this.constructor === PrimitiveMapping;
    },
    "isCollectionMapping": function() {
        return this.constructor === CollectionMapping;
    },
    "isObjectMapping": function() {
        return this.constructor === ObjectMapping;
    },
    "getQualifiedColumnName": function(dialect, alias) {
        var name = alias || this.mapping.getQualifiedTableName(dialect);
        return name + "." + dialect.quote(this.column);
    }
};

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

    Object.defineProperties(this, {
        /**
         * The store this mapping belongs to
         * @type Store
         */
        "store": {"value": store, "enumerable": true},
        /**
         * The entity type name this mapping belongs to
         * @type String
         */
        "type": {"value": type, "enumerable": true},
        /**
         * A map containing the property mappings by property name
         * @type Object
         */
        "properties": {"value": propertyMap, "enumerable": true},
        /**
         * The ID mapping
         * @type IdMapping
         */
        "id": {"value": id, "enumerable": true},
        /**
         * A map containing the property mappings by column name
         * @type Object
         */
        "columns": {"value": columnMap, "enumerable": true},
        /**
         * The table name of this mapping, or the entity type name if not
         * specified in the mapping definition
         * @type String
         */
        "tableName": {"value": definition.table || type, "enumerable": true},
        /**
         * The schema name
         * @type String
         */
        "schemaName": {"value": definition.schema, "enumerable": true}
    });

    if (definition.properties !== undefined) {
        // convert all defined properties into their appropriate property mappings
        for each (let [propName, propDefinition] in Iterator(definition.properties)) {
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
        throw new Error("No property mapping '" + property +
                "' found in " + this.type);
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

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this IdMapping (always "id")
         * @type String
         */
        "name": {"value": "id", "enumerable": true},
        /**
         * Contains the mapping definition of this IdMapping instance
         * @type Object
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type ("long")
         * @type String
         */
        "type": {"value": "long", "enumerable": true},
        /**
         * Contains the column in which the ID is stored. Defaults to "id"
         * @type String
         */
        "column": {"value": definition.column || "id", "enumerable": true},
        /**
         * Contains the sequence this IdMapping uses
         * @type String
         */
        "sequence": {"value": definition.sequence, "enumerable": true}
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
        var sql;
        var dialect = this.mapping.store.dialect;
        var usingSequence = false;
        if (this.hasSequence() && dialect.hasSequenceSupport()) {
            // got a sequence, retrieve it's next value
            sql = dialect.getSqlNextSequenceValue(this.sequence);
            usingSequence = true;
        } else {
            // no sequence, increment the biggest id used in the table
            sql = "SELECT MAX(" + this.getQualifiedColumnName(dialect) +
                    ") FROM " + mapping.getQualifiedTableName(dialect);
        }

        var statement = null;
        var resultSet = null;
        var conn = (transaction || this.mapping.store).getConnection();
        if (log.isDebugEnabled()) {
            log.debug("Retrieving next ID for",
                    this.getQualifiedColumnName(dialect), sql);
        }
        try {
            statement = conn.createStatement();
            resultSet = statement.executeQuery(sql);
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
IdMapping.prototype = Object.create(MAPPING_BASE);
IdMapping.prototype.constructor = IdMapping;

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

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @type String
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this PrimitiveMapping instance
         * @type Object
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type
         * @type String
         */
        "type": {"value": definition.type, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @type String
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains true if null values are allowed
         * @type Boolean
         */
        "nullable": {"value": definition.nullable !== false, "enumerable": true},
        /**
         * Contains the maximum length of this property
         * @type Number
         */
        "length": {"value": definition.length, "enumerable": true},
        /**
         * Contains the precision of this property
         * @type Number
         */
        "precision": {"value": definition.precision, "enumerable": true},
        /**
         * Contains the scale of this property
         * @type Number
         */
        "scale": {"value": definition.scale, "enumerable": true}
    });

    return this;
};
PrimitiveMapping.prototype = Object.create(MAPPING_BASE);
PrimitiveMapping.prototype.constructor = PrimitiveMapping;

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

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         */
        "mapping": {"value": mapping},
        /**
         * Contains the property name of this mapping
         * @type String
         */
        "name": {"value": name},
        /**
         * Contains the mapping definition of this ObjectMapping instance
         * @type Object
         */
        "definition": {"value": definition},
        /**
         * Contains the column type
         * @type String
         */
        "type": {"value": "long"},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @type String
         */
        "column": {"value": definition.column || name},
        /**
         * Contains the type name of the mapped entity
         * @type String
         */
        "entity": {"value": definition.entity},
        /**
         * Contains the name of the mapped entity's property used as the foreign key
         * @type String
         */
        "foreignProperty": {"value": definition.foreignProperty || "id"}
    });

    return this;
};
ObjectMapping.prototype = Object.create(MAPPING_BASE);
ObjectMapping.prototype.constructor = ObjectMapping;

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
    if (typeof(definition.query) !== "string" || definition.query.length < 1) {
        throw new Error("No query specified for collection mapping '" +
                mapping.type + "." + name + "'");
    }

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         */
        "mapping": {"value": mapping},
        /**
         * Contains the property name of this mapping
         * @type String
         */
        "name": {"value": name},
        /**
         * Contains the mapping definition of this CollectionMapping instance
         * @type Object
         */
        "definition": {"value": definition},
        /**
         * Contains the column type
         * @type String
         */
        "type": {"value": null},
        /**
         * The size of a single partition. Only used if isPartitioned is true. Defaults
         * to 100.
         * @type Number
         */
        "partitionSize": {"value": definition.partitionSize || 0},
        /**
         * The collection query
         * @type String
         */
        "query": {"value": definition.query || null},
        /**
         * An optional object containing named parameters referenced in the query
         * @type Object
         */
        "params": {"value": definition.params || null}
    });

    return this;
};
CollectionMapping.prototype = Object.create(MAPPING_BASE);
CollectionMapping.prototype.constructor = CollectionMapping;

/** @ignore */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
