/**
 * @fileoverview A module for creating select result set collectors
 */
var Key = require("../key");
var constants = require("../constants");
var jdbcTypes = require("../datatypes/jdbc");

/**
 * Creates a new EntityCollector instance
 * @class Instances of this class are capable to retrieve the ID of an entity
 * from a query result set and create the appropriate entity instance (resp.
 * fetch it from the entity cache if defined).
 * @param {Mapping} mapping The entity mapping
 * @param {String} alias Optional alias for the selected entity
 * @returns A newly created EntityCollector instance
 * @constructor
 */
var EntityCollector = exports.EntityCollector = function EntityCollector(mapping, alias) {
    Object.defineProperties(this, {
        /**
         * Contains the mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1)
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
EntityCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

/**
 * Collects the entity from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {Store} store The store to operate on
 * @returns The entity
 */
EntityCollector.prototype.collect = function(resultSet, store, transaction, offset) {
    var id = this.mapping.id.dataType.get(resultSet, offset + 1);
    var key = new Key(this.mapping.type, id);
    var cacheKey = key.cacheKey;
    var useCache = store.entityCache !== null &&
            (!transaction || !transaction.containsKey(cacheKey));
    var entity = constants.LOAD_LAZY;
    if (useCache === true) {
        if (store.entityCache.containsKey(cacheKey)) {
            entity = store.entityCache.get(cacheKey);
        } else {
            store.entityCache.put(cacheKey, entity);
        }
    }
    return store.entityRegistry.getConstructor(this.mapping.type).createInstance(key, entity);
};

/**
 * Creates a new AggressiveEntityCollector instance
 * @class Instances of this class are capable to retrieve all mapped properties
 * of an entity from a query result set and create the appropriate entity instance
 * (resp. fetch it from the entity cache if defined).
 * @param {Mapping} mapping The entity mapping
 * @param {String} alias Optional alias for the selected entity
 * @returns A newly created AggressiveEntityCollector instance
 * @constructor
 */
var AggressiveEntityCollector = exports.AggressiveEntityCollector =
        function AggressiveEntityCollector(mapping, alias) {
    Object.defineProperties(this, {
        /**
         * The mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle.
         * @type Number
         */
        "columnCnt": {"value": Object.keys(mapping.columns).length, "enumerable": true}
    });
    return this;
};

/** @ignore */
AggressiveEntityCollector.prototype.toString = function() {
    return "[AggressiveEntityCollector]";
};

/**
 * Collects the entity from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {Store} store The store to operate on
 * @returns The entity
 */
AggressiveEntityCollector.prototype.collect = function(resultSet, store, transaction, offset) {
    var entity = {};
    var idMapping = this.mapping.id;
    var id = entity[idMapping.column] = idMapping.dataType.get(resultSet, offset + 1);
    var key = new Key(this.mapping.type, id);
    var cacheKey = key.cacheKey;
    var useCache = store.entityCache !== null &&
            (!transaction || !transaction.containsKey(cacheKey));
    var isCacheHit = false;
    if (useCache === true) {
        var cachedEntity = store.entityCache.get(cacheKey);
        // the stored entity could be a lazy loading one
        if (cachedEntity !== null && cachedEntity !== constants.LOAD_LAZY) {
            entity = cachedEntity;
            isCacheHit = true;
        }
    }
    if (!isCacheHit) {
        var mappings = this.mapping.mappings;
        var columnMapping, value;
        for (let idx = 1; idx < this.columnCnt; idx += 1) {
            columnMapping = mappings[idx];
            value = columnMapping.dataType.get(resultSet, offset + 1 + idx);
            entity[columnMapping.column] = value;
        }
        if (useCache === true) {
            store.entityCache.put(cacheKey, entity);
        }
    }
    return store.entityRegistry.getConstructor(this.mapping.type).createInstance(key, entity);
};

/**
 * Creates a new PropertyCollector instance
 * @class Instances of this class are capable to retrieve a single property
 * of an entity from a query result set and return it.
 * @param {Mapping} mapping The entity mapping
 * @param {String} alias Optional alias for the selected property
 * @returns A newly created PropertyCollector instance
 * @constructor
 */
var PropertyCollector = exports.PropertyCollector = function PropertyCollector(mapping, alias) {
    Object.defineProperties(this, {
        /**
         * The mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1).
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
PropertyCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

/**
 * Collects the entity property value from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {Store} store The store to operate on
 * @returns The entity property value
 */
PropertyCollector.prototype.collect = function(resultSet, store, transaction, offset) {
    return this.mapping.dataType.get(resultSet, offset + 1);
};

/**
 * Creates a new ValueCollector instance
 * @class Instances of this class are capable to retrieve a single value from a
 * query result set and return it.
 * @param {String} alias The alias for the selected value
 * @returns A newly created PropertyCollector instance
 * @constructor
 */
var ValueCollector = exports.ValueCollector = function ValueCollector(alias) {
    Object.defineProperties(this, {
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1).
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
ValueCollector.prototype.toString = function() {
    return "[ValueCollector]";
};

/**
 * Collects the value from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {Store} store The store to operate on
 * @returns The value
 */
ValueCollector.prototype.collect = function(resultSet, store, transaction, offset) {
    var metaData = resultSet.getMetaData();
    var dataType = jdbcTypes[metaData.getColumnType(offset + 1)];
    return dataType.get(resultSet, offset + 1);
};
