/**
 * @fileoverview A module for creating select result set collectors
 */
var {Key} = require("../key");
var storable = require("../storable");

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
EntityCollector.prototype.collect = function(resultSet, store, offset) {
    var id = this.mapping.id.jdbcType.get(resultSet, offset + 1);
    var key = new Key(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.entityCache !== null &&
            (!transaction || !transaction.containsKey(key.cacheKey));
    var entity = storable.Storable.LOAD_LAZY;
    if (useCache && store.entityCache.containsKey(key.cacheKey)) {
        entity = store.entityCache.get(key.cacheKey);
    } else {
        if (useCache) {
            store.entityCache.put(key.cacheKey, entity);
        }
    }
    return store.entityRegistry.getConstructor(this.mapping.type)
            .createInstance(key, entity);
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
AggressiveEntityCollector.prototype.collect = function(resultSet, store, offset) {
    var key = null;
    var entity = {};
    var useCache = store.entityCache !== null;
    var mappings = this.mapping.mappings;
    var isCacheHit = false;
    for (let idx = 0; idx < mappings.length; idx += 1) {
        let columnMapping = mappings[idx];
        let value = columnMapping.jdbcType.get(resultSet, offset + 1 + idx);
        if (idx === 0) {
            key = new Key(this.mapping.type, value);
            if (useCache === true) {
                let transaction = store.getTransaction();
                useCache = !transaction || !transaction.containsKey(key.cacheKey);
                if (useCache && store.entityCache.containsKey(key.cacheKey)) {
                    entity = store.entityCache.get(key.cacheKey);
                    isCacheHit = true;
                    break;
                }
            }
        }
        entity[columnMapping.column] = value;
    }
    if (isCacheHit === false && useCache === true) {
        store.entityCache.put(key.cacheKey, entity);
    }
    return store.entityRegistry.getConstructor(this.mapping.type)
            .createInstance(key, entity);
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
PropertyCollector.prototype.collect = function(resultSet, store, offset) {
    return this.mapping.jdbcType.get(resultSet, offset + 1);
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
ValueCollector.prototype.collect = function(resultSet, store, offset) {
    var metaData = resultSet.getMetaData();
    var columnType = store.dialect.getJdbcType(metaData.getColumnType(offset + 1));
    return columnType.get(resultSet, offset + 1);
};
