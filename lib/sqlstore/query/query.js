var {Parser} = require("./parser");
var {SqlGenerator} = require("./sqlgenerator");
var {CollectorGenerator} = require("./collectorgenerator");

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
    var sqlGenerator = new SqlGenerator(store, queryAst.from.aliases, nparams);
    var collectorGenerator = new CollectorGenerator(store, queryAst.from.aliases);
    var sql = queryAst.accept(sqlGenerator);
    var collector = queryAst.select.accept(collectorGenerator);
    var result = store.executeQuery(sql, sqlGenerator.params, function(resultSet) {
        var result = [];
        if (collector.constructor === Array) {
            while (resultSet.next()) {
                var obj = {};
                collector.forEach(function(spec) {
                    obj[spec.property] = spec.collector.collect(resultSet);
                });
                result.push(obj);
            }
        } else {
            while (resultSet.next()) {
                result.push(collector.collect(resultSet));
            }
        }
        return result;
    });
    return result;
};

Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.select = function(nparams) {
    return Query.select(this.store, this.ast, nparams);
};
