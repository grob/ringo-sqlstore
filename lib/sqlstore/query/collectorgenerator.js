var {createCacheKey} = require("../cache");
var {Key} = require("../key");
var ast = require("./ast");
var {Normalizer} = require("./normalizer");

var CollectorGenerator = exports.CollectorGenerator = function(store, aliases) {
    Object.defineProperties(this, {
        "store": {"value": store, "enumerable": true},
        "aliases": {"value": aliases || {}, "enumerable": true}
    });
    return this;
};

CollectorGenerator.prototype.toString = function() {
    return "[CollectorGenerator]";
};

CollectorGenerator.prototype.getEntityMapping = function(name) {
    return this.store.getEntityMapping(this.aliases[name] || name);
};

CollectorGenerator.prototype.getPropertyMapping = function(name, property) {
    return this.getEntityMapping(name).getMapping(property);
};

CollectorGenerator.prototype.create = function(selectClause) {
    if (selectClause.list.length === 1) {
        return this.createCollector(selectClause.get(0), 1);
    }
    var offset = 1;
    return selectClause.list.map(function(selectExpression) {
        var collector = this.createCollector(selectExpression, offset);
        offset += collector.columnCnt;
        return collector;
    }, this);
};

CollectorGenerator.prototype.createCollector = function(selectExpression, columnIdx) {
    var node = selectExpression.expression;
    if (node instanceof ast.SelectEntity) {
        return new AggressiveEntityCollector(this.getEntityMapping(node.name),
                columnIdx, selectExpression.alias);
    } else if (node instanceof ast.Ident) {
        if (node.property === null) {
            return new EntityCollector(this.getEntityMapping(node.entity),
                    columnIdx, selectExpression.alias);
        }
        return new PropertyCollector(this.getPropertyMapping(node.entity, node.property),
                columnIdx, selectExpression.alias);
    }
    return new ValueCollector(columnIdx, selectExpression.alias ||
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
    var columnType = store.dialect.getType(this.mapping.id.type);
    var id = columnType.get(resultSet, this.columnIdx);
    var cacheKey = createCacheKey(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.isCacheEnabled() &&
            (!transaction || !transaction.containsKey(cacheKey));
    var key = null;
    var entity = null;
    if (useCache && store.cache.containsKey(cacheKey)) {
        [key, entity] = store.cache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        if (useCache) {
            store.cache.put(cacheKey, [key, entity]);
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
    var columnType = store.dialect.getType(this.mapping.id.type);
    var id = columnType.get(resultSet, this.columnIdx);
    var cacheKey = createCacheKey(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.isCacheEnabled() &&
            (!transaction || !transaction.containsKey(cacheKey));
    var key = null;
    var entity = null;
    if (useCache && store.cache.containsKey(cacheKey)) {
        [key, entity] = store.cache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        entity = {};
        var columnIdx = this.columnIdx;
        for each (let propMapping in this.mapping.columns) {
            columnType = store.dialect.getType(propMapping.type);
            entity[propMapping.column] = columnType.get(resultSet, columnIdx++);
        }
        if (useCache) {
            store.cache.put(cacheKey, [key, entity]);
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
    var columnType = store.dialect.getType(this.mapping.type);
    return columnType.get(resultSet, this.columnIdx);
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