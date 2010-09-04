export("EntityCollector", "EntityDataCollector", "PropertyCollector");

var Cache = require("./cache").Cache;
var Key = require("./key").Key;

var EntityCollector = function(mapping, type) {
    Object.defineProperty(this, "mapping", {"value": mapping});
    Object.defineProperty(this, "type", {"value": type});
    return this;
};

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
        var cacheKey = Cache.createKey(this.type, id);
        if (store.cache.containsKey(cacheKey)) {
            result.push(store.cache.get(cacheKey));
            continue;
        }
        // cache miss, read entity values and create entity instance
        var key = new Key(this.type, id);
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
        var instance = store.create(this.type, key, entity);
        store.cache.put(cacheKey, instance);
        result.push(instance);
    }
    return result;
};

var EntityDataCollector = function(mapping, type) {
    Object.defineProperty(this, "mapping", {"value": mapping});
    Object.defineProperty(this, "type", {"value": type});
    return this;
};

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
            "value": new Key(this.type, entityData[this.mapping.id.column])
        });
        result.push(entityData);
    }
    return result;
};

var PropertyCollector = function(mapping, property) {
    Object.defineProperty(this, "mapping", {"value": mapping});
    Object.defineProperty(this, "property", {"value": property});
    return this;
};

PropertyCollector.prototype.collect = function(store, resultSet) {
    var columnType = store.dialect.getType(this.mapping[this.property].type);
    var columnName = this.mapping[this.property].column;
    var result = [];
    while (resultSet.next()) {
        result.push(columnType.get(resultSet, columnName, 1));
    }
    return result;
};
