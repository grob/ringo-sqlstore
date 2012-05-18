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
    var selectEntity = queryAst.select.get(0).expression;
    var mapping = selectEntity.getEntityMapping(visitor);
    var idColumnIdx = resultSet.findColumn(mapping.id.column);
    var idColumnType = visitor.store.dialect.getType(mapping.id.type);
    var metaData, columnCount;
    if (selectEntity.loadAggressive === true) {
        metaData = resultSet.getMetaData();
        columnCount = metaData.getColumnCount();
    }
    while (resultSet.next()) {
        var id = idColumnType.get(resultSet, idColumnIdx);
        var entity = null;
        var cacheKey = createCacheKey(mapping.type, id);
        if (visitor.store.isCacheEnabled() && visitor.store.cache.containsKey(cacheKey)) {
            entity = visitor.store.cache.get(cacheKey);
        } else if (selectEntity.loadAggressive === true) {
            entity = visitor.store.createEntity(mapping, resultSet, metaData, columnCount);
        }
        var key = (entity !== null) ? entity._key : new Key(mapping.type, id);
        result.push(visitor.store.create(mapping.type, key, entity));
    }
    return result;
};

var collectProperties = function(visitor, queryAst, resultSet) {
    var result = [];
    var mappings = queryAst.select.list.map(function(selectExpr, idx) {
        var mapping = selectExpr.getPropertyMapping(visitor);
        return {
            "name": selectExpr.getResultPropertyName(),
            "type": visitor.store.dialect.getType(mapping.type),
            "position": idx + 1
        };
    }, this);
    while (resultSet.next()) {
        var obj = {};
        for each (let value in mappings) {
            obj[value.name] = value.type.get(resultSet, value.position);
        }
        result.push(obj);
    }
    return result;
};