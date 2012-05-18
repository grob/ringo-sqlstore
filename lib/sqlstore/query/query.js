var {Parser} = require("./parser");
var {SqlGenerator} = require("./sqlgenerator");
var {createCacheKey} = require("../cache");
var {Key} = require("../key");

var Query = exports.Query = function(store, queryStr) {

    var ast = null;

    Object.defineProperties(this, {
        "store": {"value": store, "enumerable": true},
        "query": {"value": queryStr, "enumerable": true},
        "ast": {
            "get": function() {
                return ast || (ast = Parser.parse(queryStr));
            },
            "enumerable": false
        }
    });

    return this;
};

Query.select = function(store, queryAst, nparams) {
    if (queryAst.isEntityQuery() === true) {
        return Query.selectEntities(store, queryAst, nparams);
    }
    return Query.selectProperties(store, queryAst, nparams);
};

Query.selectEntities = function(store, queryAst, nparams) {
    var visitor = new SqlGenerator(store, queryAst.from.aliases, nparams);
    var sql = queryAst.accept(visitor);
    return store.executeQuery(sql, visitor.params, function(resultSet) {
        return collectEntities(visitor, queryAst, resultSet);
    });
};

Query.selectProperties = function(store, queryAst, nparams) {
    var visitor = new SqlGenerator(store, queryAst.from.aliases, nparams);
    var sql = queryAst.accept(visitor);
    return store.executeQuery(sql, visitor.params, function(resultSet) {
        return collectProperties(visitor, queryAst, resultSet);
    });
};

Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.select = function(nparams) {
    return Query.select(this.store, this.ast, nparams);
};

Query.prototype.selectProperties = function(nparams) {
    return Query.selectProperties(this.store, this.ast, nparams);
};

var collectEntities = function(visitor, queryAst, resultSet) {
    var result = [];
    var collector = createEntityCollector(visitor, queryAst, resultSet);
    while (resultSet.next()) {
        result.push(collector(resultSet));
    }
    return result;
};

var collectProperties = function(visitor, queryAst, resultSet) {
    var result = [];
    var collector = createPropertyCollector(visitor, queryAst);
    while (resultSet.next()) {
        result.push(collector(resultSet));
    }
    return result;
};

var createEntityCollector = function(visitor, queryAst, resultSet) {
    var selectEntity = queryAst.select.get(0).expression;
    var mapping = selectEntity.getEntityMapping(visitor);
    var idColumnIdx = resultSet.findColumn(mapping.id.column);
    var idColumnType = visitor.store.dialect.getType(mapping.id.type);
    var store = visitor.store;

    if (selectEntity.loadAggressive === true) {
        var metaData = resultSet.getMetaData();
        var columnCount = metaData.getColumnCount();
        return function(resultSet) {
            var id = idColumnType.get(resultSet, idColumnIdx);
            var entity = null;
            var cacheKey = createCacheKey(mapping.type, id);
            if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                entity = store.cache.get(cacheKey);
            } else {
                entity = store.createEntity(mapping, resultSet, metaData, columnCount);
            }
            return store.create(mapping.type, entity._key, entity);
        };
    } else {
        return function(resultSet) {
            var id = idColumnType.get(resultSet, idColumnIdx);
            var entity = null;
            var cacheKey = createCacheKey(mapping.type, id);
            if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                entity = store.cache.get(cacheKey);
            }
            return store.create(mapping.type, new Key(mapping.type, id), entity);
        };
    }
};

var createPropertyCollector = function(visitor, queryAst) {
    if (queryAst.select.length > 1) {
        var collectors = queryAst.select.list.map(function(selectExpr, idx) {
            var mapping = selectExpr.getPropertyMapping(visitor);
            var name = selectExpr.getResultPropertyName();
            var type = visitor.store.dialect.getType(mapping.type);
            var position = idx + 1;
            return function(resultSet, obj) {
                obj[name] = type.get(resultSet, position);
            };
        }, this);
        return function(resultSet) {
            var obj = {};
            for each (let collector in collectors) {
                collector(resultSet, obj);
            }
            return obj;
        };
    } else {
        var mapping = queryAst.select.get(0).getPropertyMapping(visitor);
        var type = visitor.store.dialect.getType(mapping.type);
        return function(resultSet) {
            return type.get(resultSet, 1);
        };
    }
};