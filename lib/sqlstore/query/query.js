var {Parser} = require("./parser");
var {createCacheKey} = require("../cache");
var {Key} = require("../key");

var Query = exports.Query = function(store, queryStr) {

    var ast = null;

    Object.defineProperties(this, {
        "store": {"value": store, "enumerable": false},
        "query": {"value": queryStr, "enumerable": true},
        "ast": {"get": function() {
            if (ast === null) {
                ast = Parser.parse(queryStr);
            }
            return ast;
        }, "enumerable": false}
    });

    return this;
};

Query.select = function(store, queryAst, nparams, params) {
    if (queryAst.isEntityQuery() === true) {
        return Query.selectEntities(store, queryAst, nparams, params);
    }
    return Query.selectProperties(store, queryAst, nparams, params);
};

Query.selectEntities = function(store, queryAst, nparams, params) {
    var sql = queryAst.toSql(store, nparams, params);
    return store.executeQuery(sql, params, function(resultSet) {
        return collectEntities(store, queryAst, resultSet);
    });
};

Query.selectProperties = function(store, queryAst, nparams, params) {
    var sql = queryAst.toSql(store, nparams, params);
    return store.executeQuery(sql, params, function(resultSet) {
        return collectProperties(store, queryAst, resultSet);
    });
};

Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.select = function(nparams) {
    return Query.select(this.store, this.ast, nparams, []);
};

Query.prototype.selectProperties = function(nparams) {
    return Query.selectProperties(this.store, this.ast, nparams, []);
};

var collectEntities = function(store, select, resultSet) {
    var result = [];
    var selectEntity = select.select.list[0];
    var mapping = store.getEntityMapping(selectEntity.entity);
    var idColumnIdx = resultSet.findColumn(mapping.id.column);
    var idColumnType = store.dialect.getType(mapping.id.type);
    // FIXME: don't need this for lazily loaded entities
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    while (resultSet.next()) {
        var id = idColumnType.get(resultSet, idColumnIdx);
        var entity = null;
        var cacheKey = createCacheKey(mapping.type, id);
        if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
            entity = store.cache.get(cacheKey);
        } else if (selectEntity.loadAggressive === true) {
            entity = store.createEntity(mapping, resultSet, metaData, columnCount);
        }
        var key = (entity !== null) ? entity._key : new Key(mapping.type, id);
        result.push(store.create(mapping.type, key, entity));
    }
    return result;
};

var collectProperties = function(store, select, resultSet) {
    var result = [];
    var mappings = select.select.list.map(function(ident, idx) {
        var mapping = store.getEntityMapping(ident.entity);
        var propMapping = mapping.getMapping(ident.property);
        return {
            "name": propMapping.name,
            "type": store.dialect.getType(propMapping.type),
            "position": idx + 1
        };
    });
    while (resultSet.next()) {
        var obj = {};
        for each (let mapping in mappings) {
            obj[mapping.name] = mapping.type.get(resultSet, mapping.position);
        }
        result.push(obj);
    }
    return result;
};
