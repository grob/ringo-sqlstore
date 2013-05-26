/**
 * @fileoverview Provides a Mapping constructor representing the mapping
 * definition of an entity defined within a store.
 */
var log = require('ringo/logging').getLogger(module.id);
var sqlUtils = require("./util");

/**
 * The base prototype for property mappings
 * @type Object
 * @ignore
 */
var MAPPING_BASE = {
    /**
     * Returns true if this mapping is an instance of PrimitiveMapping
     * @returns {Boolean} True if a primitive mapping, false otherwise
     * @name Mapping.prototype.isPrimitive
     */
    "isPrimitive": function() {
        return this.constructor === PrimitiveMapping;
    },
    /**
     * Returns true if this mapping is an instance of CollectionMapping
     * @returns {Boolean} True if a collection mapping, false otherwise
     * @name Mapping.prototype.isCollectionMapping
     */
    "isCollectionMapping": function() {
        return this.constructor === CollectionMapping;
    },
    /**
     * Returns true if this mapping is an instance of ObjectMapping
     * @returns {Boolean} True if an object mapping, false otherwise
     * @name Mapping.prototype.isObjectMapping
     */
    "isObjectMapping": function() {
        return this.constructor === ObjectMapping;
    },
    /**
     * Returns the qualified column name of this mapping in the form
     * `<TABLE_NAME|ALIAS>.<COLUMN_NAME>`.
     * @returns {String} The qualified column name of this mapping
     * @name Mapping.prototype.isPrimitive
     */
    "getQualifiedColumnName": function(dialect, alias) {
        var name = alias || this.mapping.getQualifiedTableName(dialect);
        return name + "." + dialect.quote(this.column);
    }
};

/**
 * Constructs a new Mapping instance
 * @class Instances of this class represent an entity mapping definition.
 * @param {String} type The entity type this mapping belongs to
 * @param {Object} definition The mapping definition
 * @returns A newly created Mapping instance
 * @constructor
 */
var Mapping = exports.Mapping = function(store, type, definition) {

    var id = new IdMapping(this, definition.id,
            store.dialect.getType(IdMapping.TYPE));
    var propertyMap = {};
    var columnMap = {};
    columnMap[id.column] = id;

    Object.defineProperties(this, {
        /**
         * The store this mapping belongs to
         * @type Store
         * @see store
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
                propMapping = new ObjectMapping(this, propName, propDefinition,
                        store.dialect.getType(ObjectMapping.TYPE));
                columnMap[propMapping.column] = propMapping;
            } else if (propDefinition.type === "collection") {
                propMapping = new CollectionMapping(this, propName,
                        propDefinition, null);
            } else {
                propMapping = new PrimitiveMapping(this, propName,
                        propDefinition, store.dialect.getType(propDefinition.type));
                columnMap[propMapping.column] = propMapping;
            }
            propertyMap[propName] = propMapping;
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
 * @param {String} property The property name to return the mapping for
 * @returns {PrimitiveMapping|ObjectMapping|CollectionMapping} The property mapping
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
 * @returns {String} The name of the column
 */
Mapping.prototype.getColumnName = function(property) {
    return this.getMapping(property).column;
};

/**
 * Returns the qualified column name, prefixed with the table name. Both
 * the column and the table name are enclosed in database specific quotes.
 * @param {String} property The name of the property
 * @param {Dialect} dialect The database dialect to use for quoting
 * @returns {String} The qualified column name
 */
Mapping.prototype.getQualifiedColumnName = function(property, dialect) {
    return this.getMapping(property).getQualifiedColumnName(dialect);
};

/**
 * Returns the column type for the given property
 * @param {String} property The name of the property
 * @returns {String} The column type
 */
Mapping.prototype.getColumnType = function(property) {
    return this.getMapping(property).type;
};

/**
 * Returns the qualified table name, prefixed with an optional schema name.
 * Both the table and schema name are enclosed in database specific quotes.
 * @param {Dialect} dialect The database dialect to use for quoting
 * @returns {String} The qualified table name
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
 * @param {Type} jdbcType The JDBC type of this ID mapping
 * @returns A newly created IdMapping instance
 * @constructor
 * @see types#IntegerType
 * @ignore
 */
var IdMapping = function(mapping, definition, jdbcType) {

    var idCounter = 0;
    if (definition == null) {
        definition = {};
    }

    /** @ignore */
    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this IdMapping (always "id")
         * @type String
         * @ignore
         */
        "name": {"value": "id", "enumerable": true},
        /**
         * Contains the mapping definition of this IdMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type (IdMapping.TYPE)
         * @type String
         * @ignore
         */
        "type": {"value": IdMapping.TYPE, "enumerable": true},
        /**
         * Contains the JDBC column type
         * @type Type
         * @see types#IntegerType
         * @ignore
         */
        "jdbcType": {"value": jdbcType, "enumerable": true},
        /**
         * Contains the column in which the ID is stored. Defaults to "id"
         * @type String
         * @ignore
         */
        "column": {"value": definition.column || "id", "enumerable": true},
        /**
         * Contains the name of the sequence this IdMapping uses
         * @type String
         * @ignore
         */
        "sequence": {"value": definition.sequence, "enumerable": true}
    });

    /**
     * Generates a new id for the given type, by either using a defined sequence
     * or incrementing the max-ID from the table for the given type. If no sequence
     * is specified or the database doesn't support sequences, this method utilizes
     * an internal ID counter and returns either the max-ID from the table or
     * the value of the internal counter, whichever is higher.
     * @param {String} transaction Optional transaction to use for querying
     * @returns {Number} The next unused id
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
            statement && statement.close(); // closes resultSet too
            if (conn != null && !transaction) {
                conn.close();
            }
        }
    }, idCounter);

    return this;
};

/** @ignore */
IdMapping.prototype = Object.create(MAPPING_BASE);
/** @ignore */
IdMapping.prototype.constructor = IdMapping;

/**
 * The data type for ID columns ("long")
 * @type {String} The data type
 * @ignore
 */
IdMapping.TYPE = "long";

/** @ignore */
IdMapping.prototype.toString = function() {
    return "[ID mapping " + this.name + "]";
};

/**
 * Returns true if this ID has a sequence defined
 * @returns {Boolean} True if a sequence is defined, false otherwise
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
 * @param {Type} jdbcType The JDBC type of this mapping
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 * @see types
 * @ignore
 */
var PrimitiveMapping = function(mapping, name, definition, jdbcType) {

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @type String
         * @ignore
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this PrimitiveMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type
         * @type String
         * @ignore
         */
        "type": {"value": definition.type, "enumerable": true},
        /**
         * Contains the JDBC column type
         * @type Type
         * @see types
         * @ignore
         */
        "jdbcType": {"value": jdbcType, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @type String
         * @ignore
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains true if null values are allowed
         * @type Boolean
         * @ignore
         */
        "nullable": {"value": definition.nullable !== false, "enumerable": true},
        /**
         * Contains the maximum length of this property
         * @type Number
         * @ignore
         */
        "length": {"value": definition.length, "enumerable": true},
        /**
         * Contains the precision of this property
         * @type Number
         * @ignore
         */
        "precision": {"value": definition.precision, "enumerable": true},
        /**
         * Contains the scale of this property
         * @type Number
         * @ignore
         */
        "scale": {"value": definition.scale, "enumerable": true}
    });

    return this;
};

/** @ignore */
PrimitiveMapping.prototype = Object.create(MAPPING_BASE);
/** @ignore */
PrimitiveMapping.prototype.constructor = PrimitiveMapping;

/** @ignore */
PrimitiveMapping.prototype.toString = function() {
    return "[Primitive Mapping " + this.name + "]";
};


/**
 * Returns a newly created ObjectMapping instance
 * @class Instances of this class represent a storable mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @param {Type} jdbcType The JDBC type of this ID mapping
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 * @see types
 * @ignore
 */
var ObjectMapping = function(mapping, name, definition, jdbcType) {

    // argument checks
    if (typeof(definition.entity) !== "string" || definition.entity.length < 1) {
        throw new Error("No entity specified for object mapping '" +
                mapping.type + "." + name + "'");
    }

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @type String
         * @ignore
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this ObjectMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type
         * @type String
         * @ignore
         */
        "type": {"value": ObjectMapping.TYPE, "enumerable": true},
        /**
         * Contains the JDBC column type
         * @type Type
         * @ignore
         */
        "jdbcType": {"value": jdbcType, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @type String
         * @ignore
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains the type name of the mapped entity
         * @type String
         * @ignore
         */
        "entity": {"value": definition.entity, "enumerable": true},
        /**
         * Contains the name of the mapped entity's property used as the foreign key
         * @type String
         * @ignore
         */
        "foreignProperty": {"value": definition.foreignProperty || "id", "enumerable": true}
    });

    return this;
};

/** @ignore */
ObjectMapping.prototype = Object.create(MAPPING_BASE);
/** @ignore */
ObjectMapping.prototype.constructor = ObjectMapping;

/**
 * The data type for object mapping columns
 * @type {String} The data type ("long")
 * @ignore
 */
ObjectMapping.TYPE = "long";

/** @ignore */
ObjectMapping.prototype.toString = function() {
    return "[Object Mapping " + this.name + "]";
};


/**
 * Returns a newly created CollectionMapping instance
 * @class Instances of this class represent a collection mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 * @ignore
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
         * @see Mapping
         * @ignore
         */
        "mapping": {"value": mapping},
        /**
         * Contains the property name of this mapping
         * @type String
         * @ignore
         */
        "name": {"value": name},
        /**
         * Contains the mapping definition of this CollectionMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition},
        /**
         * Contains the column type (null)
         * @type String
         * @ignore
         */
        "type": {"value": null},
        /**
         * Contains the JDBC column type
         * @type null
         * @ignore
         */
        "jdbcType": {"value": null, "enumerable": true},
        /**
         * The size of a single partition. If greater than zero the storable
         * defined by this mapping will contain a PartitionedCollection.
         * @type Number
         * @ignore
         */
        "partitionSize": {"value": definition.partitionSize || 0},
        /**
         * The collection query string
         * @type String
         * @ignore
         */
        "query": {"value": definition.query || null},
        /**
         * An optional object containing named parameters referenced in the query
         * @type Object
         * @ignore
         */
        "params": {"value": definition.params || null}
    });

    return this;
};

/** @ignore */
CollectionMapping.prototype = Object.create(MAPPING_BASE);
/** @ignore */
CollectionMapping.prototype.constructor = CollectionMapping;

/** @ignore */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
