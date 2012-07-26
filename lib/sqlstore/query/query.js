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
                if (ast === null) {
                    if (store.queryCache.containsKey(queryStr)) {
                        ast = store.queryCache.get(queryStr);
                    } else {
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
                        store.queryCache.put(queryStr, ast);
                    }
                }
                return ast;
            },
            "enumerable": false
        }
    });

    return this;
};

Query.select = function(store, queryAst, nparams) {
    var sqlGenerator = new SqlGenerator(store, queryAst.aliases, nparams);
    var collectorGenerator = new CollectorGenerator(store, queryAst.aliases);
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
