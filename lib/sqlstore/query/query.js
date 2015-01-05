/**
 * @fileoverview Provides query functionality for both SqlStore type of queries
 * and raw SQL ones.
 */
var {Parser} = require("./parser");
var {SqlGenerator} = require("./sqlgenerator");

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
    var params = selector.params.map(function(param) {
        if (typeof(param) === "string") {
            return getParameterDescription(nparams[param]);
        }
        return param;
    });
    return store.executeQuery(selector.sql, params, selector.collector);
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
    params = (params || []).map(getParameterDescription);
    return store.executeQuery(queryStr, params, function(resultSet) {
        var metaData = resultSet.getMetaData();
        var columnCnt = metaData.getColumnCount();
        var columns = new Array(columnCnt);
        for (let i=0; i<columnCnt; i+=1) {
            columns[i] = {
                "name": metaData.getColumnLabel(i + 1),
                "type": store.dialect.getJdbcType(metaData.getColumnType(i + 1))
            };
        }
        var result = [];
        while (resultSet.next()) {
            var row = {};
            columns.forEach(function(column, idx) {
                row[column.name] = column.type.get(resultSet, idx + 1);
            });
            result.push(row);
        }
        return result;
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
    var selector = (store.queryCache && store.queryCache.get(queryStr)) || null;
    if (selector === null) {
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
        selector = SqlGenerator.generate(store, ast);
        if (store.queryCache) {
            store.queryCache.put(queryStr, selector);
        }
    }
    return selector;
};

/**
* Helper function for retrieving the parameter description with the given name
* @param {Object} nparams The object containing the named parameters
* @param {String} name The name of the parameter for which to retrieve the
* description for
* @returns {Object} An object containing the properties "type" and "value". The
* former is the type of value ("string", "boolean", "long", "double",
* "timestamp" or null for null values), the latter the value passed as argument.
* @see #getParameterDescription
*/
var getParameterDescription = exports.getParameterDescription = function(value) {
    var type = null;
    if (value === undefined || value === null) {
        type = "null";
    } else if (typeof(value) === "string") {
        type = "string";
    } else if (typeof(value) === "boolean") {
        type = "boolean";
    } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
        type = (value % 1 === 0) ? "long" : "double";
    } else if (value instanceof Date) {
        type = "timestamp";
    } else if (value._key != null && value.id != null) {
        type = "long";
        value = value.id
    }
    return {
        "type": type,
        "value": value
    };
};
