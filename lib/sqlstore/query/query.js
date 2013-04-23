var {Parser} = require("./parser");
var {SqlFunctionGenerator} = require("./sqlfunctiongenerator");
var {CollectorGenerator} = require("./collectorgenerator");

var getParameterDescription = function(nparams, name) {
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

var Query = exports.Query = function(store, queryStr) {

    var generator = null;

    Object.defineProperties(this, {
        "store": {"value": store, "enumerable": true},
        "query": {"value": queryStr, "enumerable": true},
        "generator": {
            "get": function() {
                if (generator === null) {
                    if (store.hasQueryCache() && store.queryCache.containsKey(queryStr)) {
                        generator = store.queryCache.get(queryStr);
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
                        generator = ast.accept(new SqlFunctionGenerator(store, ast.aliases));
                        if (store.hasQueryCache()) {
                            store.queryCache.put(queryStr, generator);
                        }
                    }
                }
                return generator;
            },
            "enumerable": false
        }
    });

    return this;
};

Query.select = function(store, generator, nparams) {
    // console.log(generator.compile.toSource());
    var [sql, params] = generator.compile(nparams, getParameterDescription);
    var collectorGenerator = new CollectorGenerator(store, generator.aliases);
//    console.log("\t=> SQL", sql);
//    console.log("\t=> PARAMS", params);
    var collector = collectorGenerator.create(generator.select);
    var result = store.executeQuery(sql, params, function(resultSet, metaData) {
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
    return result;
};

Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.select = function(nparams) {
    return Query.select(this.store, this.generator, nparams);
};
