/**
 * @fileoverview Provides query functionality for both SqlStore type of queries
 * and raw SQL ones.
 */
var {Parser} = require("./parser");
var {SqlGenerator} = require("./sqlgenerator");
var {createCollector} = require("./collectorgenerator");

/**
 * Returns the result of a query. This method must not be called directly,
 * use `Store.prototype.query()` instead.
 * @param {Store} store The store to operate on
 * @param {String} queryStr The query string
 * @param {Object} nparams Optional object containing named parameters referenced
 * in the query
 * @returns {Array} The query result
 * @see store#Store.prototype.query
 */
exports.query = function(store, queryStr, nparams) {
    var selector = getSelector(store, queryStr);
    var [sql, params] = selector.create(nparams, getNamedParameter);
    var collector = createCollector(store, selector.ast);
    return getResult(store, sql, params, collector);
};

/**
 * Returns the result of a raw SQL query. This method must not be called directly,
  * use `Store.prototype.sqlQuery()` instead.
 * @param {Store} store The store to operate on
 * @param {String} queryStr The query string
 * @param {Array} params Optional array containing parameters referenced
 * in the query
 * @returns {Array} The query result
 * @see store#Store.prototype.sqlQuery
 */
exports.sqlQuery = function(store, queryStr, params) {
    var parameters = (params || []).map(getParameterDescription);
    return getResult(store, queryStr, parameters, {
        "collect": function(resultSet, metaData, store) {
            var columnCnt = metaData.getColumnCount();
            var row = {};
            for (let i=1; i<=columnCnt; i+=1) {
                let columnType = store.dialect.getJdbcType(metaData.getColumnType(i));
                row[metaData.getColumnLabel(i)] = columnType.get(resultSet, i);
            }
            return row;
        }
    });
};


/**
 * Returns a selector object (containing the query AST and the SQL query
 * generator function) for a query. This method does a query cache lookup
 * first, and if it's a miss parses the query string into an AST and creates
 * the SQL query generator function.
 * @param {Store} store The store to operate on
 * @param {String} queryStr The query string
 * @type {Function}
 */
var getSelector = exports.getSelector = function(store, queryStr) {
    var selector = null;
    if (store.queryCache && store.queryCache.containsKey(queryStr)) {
        selector = store.queryCache.get(queryStr);
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
        selector = {
            "ast": ast,
            "create": SqlGenerator.createSqlFunction(store, ast)
        };
        if (store.queryCache) {
            store.queryCache.put(queryStr, selector);
        }
    }
    return selector;
};

/**
 * Helper function for executing a query and collecting the result
 * @param {Store} store The store to operate on
 * @param {String} sqlQuery The SQL query
 * @param {Array} params An array containing parameters referenced in the query
 * @param {Object} collector The collector instance responsible for collecting
 * the query results
 * @returns {Array} An array containing the query results
 */
var getResult = function(store, sqlQuery, params, collector) {
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

/**
 * Helper function for retrieving the parameter description with the given name
 * @param {Object} nparams The object containing the named parameters
 * @param {String} name The name of the parameter for which to retrieve the
 * description for
 * @returns {Object} The parameter description
 * @see #getParameterDescription
 */
var getNamedParameter = exports.getNamedParameter = function(nparams, name) {
    if (nparams[name] === undefined) {
        throw new Error("Named parameter '" + name + "' is undefined");
    }
    return getParameterDescription(nparams[name]);
};

/**
 * Returns the parameter description for the given value
 * @param {Object} value The value to retrieve the parameter description for
 * @returns {Object} An object containing the properties "type" and "value". The
 * former is the type of value ("string", "boolean", "long", "double",
 * "timestamp" or null for null values), the latter the value passed as argument.
 */
var getParameterDescription = exports.getParameterDescription = function(value) {
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