/**
 * @module mapping
 */
const dataTypes = require("../datatypes/all");
const IdMapping = require("./id");
const PrimitiveMapping = require("./primitive");
const ObjectMapping = require("./object");
const CollectionMapping = require("./collection");

/**
 * Constructs a new Mapping instance
 * @class Instances of this class represent an entity mapping definition.
 * @param {String} type The entity type this mapping belongs to
 * @param {String} tableName The database table name
 * @param {String} schemaName The database schema of the table
 * @constructor
 */
var Mapping = module.exports = function(type, tableName, schemaName) {

    Object.defineProperties(this, {
        /**
         * The entity type name this mapping belongs to
         * @name Mapping#type
         * @property {String}
         * @readonly
         */
        "type": {"value": type, "enumerable": true},
        /**
         * A map containing the property mappings by property name
         * @name {Object} Mapping#properties
         * @property {Object}
         * @readonly
         */
        "properties": {"value": {}, "enumerable": true},
        /**
         * The ID mapping
         * @name Mapping#id
         * @property {IdMapping}
         */
        "id": {"value": null, "writable": true, "enumerable": true},
        /**
         * A map containing the property mappings by column name
         * @name Mapping#columns
         * @property {Object}
         * @readonly
         */
        "columns": {"value": {}, "enumerable": true},
        /**
         * The table name of this mapping, or the entity type name if not
         * specified in the mapping definition
         * @name Mapping#tableName
         * @property {String}
         * @readonly
         */
        "tableName": {"value": tableName || type, "enumerable": true},
        /**
         * The schema name
         * @name Mapping#schemaName
         * @property {String}
         * @readonly
         */
        "schemaName": {"value": schemaName, "enumerable": true},
        /**
         * A list of all non-collection property mappings, including id
         * @name Mapping#mappings
         * @property {Array}
         * @readonly
         */
        "mappings": {"value": [], "enumerable": true},
        /**
         * A list of all mapped collections
         * @name Mapping#collections
         * @property {Array}
         * @readonly
         */
        "collections": {"value": [], "enumerable": true},
        /**
         * An object containing indexes to create
         * @type Object
         */
        "indexes": {"value": null, "writable": true, "enumerable": true},
        /**
         * An object containing sql statements used with this mapping
         * @name Mapping#sql
         * @property {Object}
         * @readonly
         */
        "sql": {"value": {}, "enumerable": true}
    });

    return this;
};

/**
 * Factory method for creating new Mapping instances
 * @param {Dialect} dialect The database dialect to use
 * @param {String} type The entity type
 * @param {Object} definition The mapping definition
 * @returns {Mapping} The mapping
 * @name Mapping.create
 */
Mapping.create = function(dialect, type, definition) {
    var mapping = new Mapping(type, definition.table, definition.schema);
    mapping.indexes = definition.indexes || null;
    mapping.addIdMapping(dialect, definition.id || {});
    for each (let [propertyName, propertyDefinition] in Iterator(definition.properties)) {
        // allow simple property definitions with just data type
        if (typeof propertyDefinition === "string") {
            if (!dataTypes.hasOwnProperty(propertyDefinition)) {
                throw new Error("Data type of " + propertyName + " is invalid");
            }
            mapping.addPrimitiveProperty(propertyName, {"type": propertyDefinition});
        } else if (propertyDefinition.type === "object") {
            mapping.addObjectProperty(propertyName, propertyDefinition);
        } else if (propertyDefinition.type === "collection") {
            mapping.addCollectionProperty(propertyName, propertyDefinition);
        } else {
            mapping.addPrimitiveProperty(propertyName, propertyDefinition);
        }
    }
    mapping.sql.exists = dialect.getExistsSql(mapping);
    mapping.sql.get = dialect.getSelectSql(mapping);
    mapping.sql.insert = dialect.getInsertSql(mapping);
    mapping.sql.update = dialect.getUpdateSql(mapping);
    mapping.sql.remove = dialect.getRemoveSql(mapping);
    return mapping;
};

/**
 * Adds an ID property to this mapping
 * @param {Dialect} dialect The database dialect
 * @param {Object} definition The ID mapping definition
 * @name Mapping#addIdMapping
 */
Mapping.prototype.addIdMapping = function(dialect, definition) {
    if (!definition.autoIncrement) {
        definition.autoIncrement = !definition.sequence || !dialect.hasSequenceSupport;
    }
    var mapping = this.id = new IdMapping(this, dataTypes.long, definition);
    this.columns[mapping.name] = mapping;
    this.mappings.push(mapping);
};

/**
 * Adds a primitive property to this mapping
 * @param {String} name The name of the property
 * @param {Object} definition The property mapping definition
 * @name Mapping#addPrimitiveProperty
 */
Mapping.prototype.addPrimitiveProperty = function(name, definition) {
    if (typeof(definition.type) !== "string" || definition.type.length === 0) {
        throw new Error("Missing or invalid data type for " + name);
    } else if (!dataTypes.hasOwnProperty(definition.type)) {
        throw new Error("Data type of " + name + " is invalid");
    }
    var mapping = new PrimitiveMapping(this, name,
            definition, dataTypes[definition.type]);
    this.columns[mapping.column] = mapping;
    this.mappings.push(mapping);
    this.properties[name] = mapping;
};

/**
 * Adds a property mapped to an entity to this mapping
 * @param {String} name The name of the property
 * @param {Object} definition The property mapping definition
 * @name Mapping#addObjectProperty
 */
Mapping.prototype.addObjectProperty = function(name, definition) {
    var mapping = new ObjectMapping(this, name, definition, dataTypes.long);
    this.columns[mapping.column] = mapping;
    this.mappings.push(mapping);
    this.properties[name] = mapping;
};

/**
 * Adds a property containing a collection to this mapping
 * @param {String} name The name of the property
 * @param {Object} definition The property mapping definition
 * @name Mapping#addCollectionProperty
 */
Mapping.prototype.addCollectionProperty = function(name, definition) {
    var mapping = new CollectionMapping(this, name, definition);
    this.collections.push(mapping);
    this.properties[name] = mapping;
};

/**
 * @name Mapping#toString
 * @ignore
 */
Mapping.prototype.toString = function() {
    return "[Mapping (Table: " + this.tableName + ")]";
};

/**
 * Returns the mapping for the given property name
 * @param {String} property The property name to return the mapping for
 * @returns {PrimitiveMapping|ObjectMapping|CollectionMapping} The property mapping
 * @name Mapping#getMapping
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
 * Returns true if this mapping has a selectable property (this includes
 * the ID and all properties except mapped collections) with
 * the given name.
 * @param {String} property The name of the property
 * @returns {boolean} True if this mapping has a selectable property
 * @name Mapping#hasSelectableProperty
 */
Mapping.prototype.hasSelectableProperty = function(property) {
    return property === this.id.name ||
            (this.properties.hasOwnProperty(property) &&
            this.properties[property].isCollectionMapping === false);
};
