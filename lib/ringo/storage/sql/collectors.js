export("EntityCollector", "EntityDataCollector", "PropertyCollector");

var Cache = require("./cache").Cache;
var Key = require("./key").Key;

/**
 * Creates a new EntityCollector instance
 * @class Instances of this class can convert an SQL ResultSet into an array
 * of entity instances, utilizing the store's object cache.
 * @param {Mapping} mapping The mapping to use
 * @returns A newly created EntityCollector instance
 * @constructor
 */
var EntityCollector = function(mapping) {
    
    /**
     * Contains the mapping of this collector
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    return this;
};

/** @ignore */
EntityCollector.prototype.toString = function() {
    return "[EntityCollector '" + this.mapping.type + "']";
};

/**
 * Converts the SQL result set into an array of entity instances
 * @param {Store} store The store
 * @param {java.sql.ResultSet} resultSet The result set to convert
 * @returns An array containing (optionally lazily loaded entities)
 * @type Array
 */
EntityCollector.prototype.collect = function(store, resultSet) {
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    var result = [];
    while (resultSet.next()) {
        // first fetch id from result set and do a cache lookup
        var idColumnIdx = resultSet.findColumn(this.mapping.id.column);
        var idColumnType = store.dialect.getType(this.mapping.id.type);
        var idColumnName = this.mapping.id.column;
        var id = idColumnType.get(resultSet, idColumnName, idColumnIdx);
        var cacheKey = Cache.createKey(this.mapping.type, id);
        if (store.cache.containsKey(cacheKey)) {
            result.push(store.cache.get(cacheKey));
            continue;
        }
        // cache miss, read entity values and create instance
        var key = new Key(this.mapping.type, id);
        var entity = null;
        if (columnCount > 1) {
            entity = {};
            entity[idColumnName] = id;
            for (var i=1; i<=columnCount; i+=1) {
                if (i === idColumnIdx) {
                    continue;
                }
                var columnName = metaData.getColumnName(i);
                var propMapping = this.mapping.columns[columnName];
                if (propMapping == null) {
                    // unmapped column, ignore
                    continue;
                }
                var columnType = store.dialect.getType(propMapping.type);
                entity[columnName] = columnType.get(resultSet, columnName, i);
            }
            Object.defineProperty(entity, "_key", {
                "value": key
            });
        }
        var instance = store.create(this.mapping.type, key, entity);
        store.cache.put(cacheKey, instance);
        result.push(instance);
    }
    return result;
};

/**
 * Creates a new EntityDataCollector instance
 * @class Instances of this class convert an SQL ResultSet into an array
 * of plain entity data objects.
 * @param {Mapping} mapping The mapping to use
 * @returns A newly created EntityDataCollector instance
 * @constructor
 */
var EntityDataCollector = function(mapping) {
    
    /**
     * Contains the mapping of this collector
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });

    return this;
};

/** @ignore */
EntityDataCollector.prototype.toString = function() {
    return "[EntityDataCollector '" + this.mapping.type + "']";
};

/**
 * Converts the SQL result set into an array of entity data objects
 * @param {Store} store The store
 * @param {java.sql.ResultSet} resultSet The result set to convert
 * @returns An array containing entity data objects
 * @type Array
 */
EntityDataCollector.prototype.collect = function(store, resultSet) {
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    var result = [];
    while (resultSet.next()) {
        var entityData = {};
        for (var i=1; i<=columnCount; i+=1) {
            var columnName = metaData.getColumnName(i);
            var propMapping = this.mapping.columns[columnName];
            if (propMapping == null) {
                // unmapped column, ignore
                continue;
            }
            var columnType = store.dialect.getType(propMapping.type);
            entityData[columnName] = columnType.get(resultSet, columnName, i);
        }
        // store the key in the entity - this is needed by getProperties method
        Object.defineProperty(entityData, "_key", {
            "value": new Key(this.mapping.type, entityData[this.mapping.id.column])
        });
        result.push(entityData);
    }
    return result;
};

/**
 * Creates a new PropertyCollector instance
 * @class Instances of this class convert an SQL ResultSet into an array
 * of property values.
 * @param {Mapping} mapping The mapping to use
 * @param {String} property The property name to extract
 * @returns A newly created PropertyCollector instance
 * @constructor
 */
var PropertyCollector = function(mapping, property) {
    
    /**
     * Contains the mapping of this collector
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": mapping
    });
    
    /**
     * Contains the property name this collector will extract
     * @type String
     */
    Object.defineProperty(this, "property", {
        "value": property
    });

    return this;
};

/** @ignore */
PropertyCollector.prototype.toString = function() {
    return "[PropertyCollector '" + this.property + "']";
};

/**
 * Converts the SQL result set into an array of property values
 * @param {Store} store The store
 * @param {java.sql.ResultSet} resultSet The result set to convert
 * @returns An array containing property values
 * @type Array
 */
PropertyCollector.prototype.collect = function(store, resultSet) {
    var columnType = store.dialect.getType(this.mapping[this.property].type);
    var columnName = this.mapping[this.property].column;
    var result = [];
    while (resultSet.next()) {
        result.push(columnType.get(resultSet, columnName, 1));
    }
    return result;
};
