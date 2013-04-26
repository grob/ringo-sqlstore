var {createCacheKey} = require("../cache");
var {Key} = require("../key");
var {Normalizer} = require("./normalizer");

exports.createCollector = function(store, ast) {
    if (ast.select.list.length === 1) {
        return getCollector(store, ast.aliases, ast.select.get(0), 1);
    }
    var offset = 1;
    return ast.select.list.map(function(selectExpression) {
        var collector = getCollector(store, ast.aliases, selectExpression, offset);
        offset += collector.columnCnt;
        return collector;
    }, this);
};

var getEntityMapping = function(store, aliases, name) {
    return store.getEntityMapping(aliases[name] || name);
};

var getPropertyMapping = function(store, aliases, name, property) {
    return getEntityMapping(store, aliases, name).getMapping(property);
};

var getCollector = function(store, aliases, selectExpression, offset) {
    var node = selectExpression.expression;
    if (node.constructor.name === "SelectEntity") {
        return new AggressiveEntityCollector(getEntityMapping(store, aliases, node.name),
                offset, selectExpression.alias);
    } else if (node.constructor.name === "Ident") {
        if (node.property === null) {
            return new EntityCollector(getEntityMapping(store, aliases, node.entity),
                    offset, selectExpression.alias);
        }
        return new PropertyCollector(getPropertyMapping(store, aliases, node.entity, node.property),
                offset, selectExpression.alias);
    }
    return new ValueCollector(offset, selectExpression.alias ||
                selectExpression.accept(new Normalizer()));
};

var EntityCollector = function EntityCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnIdx": {"value": columnIdx, "enumerable": true},
        "alias": {"value": alias, "enumerable": true},
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

EntityCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

EntityCollector.prototype.collect = function(resultSet, metaData, store) {
    var id = this.mapping.id.jdbcType.get(resultSet, this.columnIdx);
    var cacheKey = createCacheKey(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.hasEntityCache() &&
            (!transaction || !transaction.containsKey(cacheKey));
    var key = null;
    var entity = null;
    if (useCache && store.entityCache.containsKey(cacheKey)) {
        [key, entity] = store.entityCache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        if (useCache) {
            store.entityCache.put(cacheKey, [key, entity]);
        }
    }
    return store.create(this.mapping.type, key, entity);
};

EntityCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.type;
};

var AggressiveEntityCollector = function AggressiveEntityCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnIdx": {"value": columnIdx, "enumerable": true},
        "alias": {"value": alias, "enumerable": true},
        "columnCnt": {"value": Object.keys(mapping.columns).length, "enumerable": true}
    });
    return this;
};

AggressiveEntityCollector.prototype.toString = function() {
    return "[AggressiveEntityCollector]";
};

AggressiveEntityCollector.prototype.collect = function(resultSet, metaData, store) {
    var id = this.mapping.id.jdbcType.get(resultSet, this.columnIdx);
    var cacheKey = createCacheKey(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.hasEntityCache() &&
            (!transaction || !transaction.containsKey(cacheKey));
    var key = null;
    var entity = null;
    if (useCache && store.entityCache.containsKey(cacheKey)) {
        [key, entity] = store.entityCache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        entity = {};
        var columnIdx = this.columnIdx;
        for each (let propMapping in this.mapping.columns) {
            entity[propMapping.column] = propMapping.jdbcType.get(resultSet, columnIdx++);
        }
        if (useCache) {
            store.entityCache.put(cacheKey, [key, entity]);
        }
    }
    return store.create(this.mapping.type, key, entity);
};

AggressiveEntityCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.type;
};

var PropertyCollector = function PropertyCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnIdx": {"value": columnIdx, "enumerable": true},
        "alias": {"value": alias, "enumerable": true},
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

PropertyCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

PropertyCollector.prototype.collect = function(resultSet, metaData, store) {
    return this.mapping.jdbcType.get(resultSet, this.columnIdx);
};

PropertyCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.mapping.type + "." + this.mapping.name;
};


var ValueCollector = function ValueCollector(columnIdx, alias) {
    Object.defineProperties(this, {
        "columnIdx": {"value": columnIdx, "enumerable": true},
        "alias": {"value": alias, "enumerable": true},
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

ValueCollector.prototype.toString = function() {
    return "[ValueCollector]";
};

ValueCollector.prototype.collect = function(resultSet, metaData, store) {
    var columnType = store.dialect.getJdbcType(metaData.getColumnType(this.columnIdx));
    return columnType.get(resultSet, this.columnIdx);
};

ValueCollector.prototype.getResultPropertyName = function(metaData) {
    return this.alias;
};