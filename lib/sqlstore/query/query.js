var {Parser} = require("./parser");
var {SqlFunctionGenerator} = require("./sqlfunctiongenerator");
var {CollectorGenerator} = require("./collectorgenerator");

// FIXME: don't pass CollectorFactory as argument (and cache it) - collectors for
// collections are different to normal query collectors, and it's quite possible
// that a collection query matches a manual query - with this there's only
// one cache entry (the query is the cache key)...
var getStatement = exports.getStatement = function(store, queryStr, CollectorFactory) {
    var statement = null;
    if (store.hasQueryCache() && store.queryCache.containsKey(queryStr)) {
        statement = store.queryCache.get(queryStr);
    } else {
        var ast;
        try {
            ast = Parser.parse(queryStr);
        } catch (e) {
            // assuming this is a PEG.SyntaxError
            var strings = require('ringo/utils/strings');
            throw new Error([
                'Could not parse query.',
                '"' + queryStr + '"',
                strings.repeat(' ', parseInt(e.column, 10)) + '^',
                e.message + ' At column: ' + e.column
            ].join('\n'));
        }
        var create = ast.accept(new SqlFunctionGenerator(store, ast.aliases));
        var collectorGenerator = new CollectorFactory(store, ast.aliases);
        var collector = collectorGenerator.create(ast.select);
        statement = {
            "ast": ast,
            "create": create,
            "collector": collector
        };
        if (store.hasQueryCache()) {
            store.queryCache.put(queryStr, statement);
        }
    }
    return statement;
};

var select = exports.select = function(store, queryStr, nparams) {
    var statement = getStatement(store, queryStr, CollectorGenerator);
    var [sql, params] = statement.create(nparams, getNamedParameter);
    return sqlSelect(store, sql, params, statement.collector);
};

var sqlSelect = exports.sqlSelect = function(store, sqlQuery, params, collector) {
    return store.executeQuery(sqlQuery, params, function(resultSet, metaData) {
        var result = [];
        if (collector.constructor === Array) {
            while (resultSet.next()) {
                var obj = {};
                collector.forEach(function(collector) {
                    obj[collector.getResultPropertyName(metaData)] =
                            collector.collect(resultSet, metaData, store);
                });
                result.push(obj);
            }
        } else {
            while (resultSet.next()) {
                result.push(collector.collect(resultSet, metaData, store));
            }
        }
        return result;
    });
};

var getNamedParameter = exports.getNamedParameter = function(nparams, name) {
    if (nparams[name] === undefined) {
        throw new Error("Named parameter '" + name + "' is undefined");
    }
    var value = nparams[name];
    var type = null;
    if (value === undefined || value === null) {
        type = null;
    } else if (typeof(value) === "string") {
        type = "string";
    } else if (typeof(value) === "boolean") {
        type = "boolean";
    } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
        type = (value % 1 === 0) ? "long" : "double";
    } else if (value instanceof Date) {
        type = "timestamp";
    } else if (value._key != null && value._id != null) {
        type = "long";
        value = value._id
    }
    return {
        "type": type,
        "value": value
    }
};
