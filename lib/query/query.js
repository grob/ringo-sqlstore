/**
 * @fileoverview Provides query functionality for both SqlStore type of queries
 * and raw SQL ones.
 */
const Parser = require("./parser");
const jdbcTypes = require("../datatypes/jdbc");
const dataTypes = require("../datatypes/all");
const statements = require("../database/statements");

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
    const selector = getSelector(store, queryStr);
    const params = selector.params.map(function(param) {
        if (typeof(param) === "string") {
            return getParameterDescription(nparams[param]);
        }
        return param;
    });
    return statements.query(store, selector.sql, params, selector.collector);
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
    return statements.query(store, queryStr, params, function(resultSet) {
        const metaData = resultSet.getMetaData();
        const columnCnt = metaData.getColumnCount();
        const columns = new Array(columnCnt);
        for (let i=0; i<columnCnt; i+=1) {
            columns[i] = {
                "name": metaData.getColumnLabel(i + 1),
                "dataType": jdbcTypes[metaData.getColumnType(i + 1)]
            };
        }
        const result = [];
        while (resultSet.next()) {
            let row = {};
            columns.forEach(function(column, idx) {
                row[column.name] = column.dataType.get(resultSet, idx + 1);
            });
            result.push(row);
        }
        return result;
    });
};


/**
 * Creates a collector function for the collectors passed as argument
 * @param {Array} collectors The collectors
 * @returns {Function} The collector function
 */
const createCollector = exports.createCollector = function(collectors) {
    if (collectors.length > 1) {
        return function(resultSet, store) {
            const result = [];
            const transaction = store.getTransaction();
            while (resultSet.next()) {
                let obj = {};
                let offset = 0;
                collectors.forEach(function(collector) {
                    obj[collector.alias] = collector.collect(resultSet, store,
                            transaction, offset);
                    offset += collector.columnCnt;
                });
                result.push(obj);
            }
            return result;
        };
    }
    const collector = collectors[0];
    return function(resultSet, store) {
        const result = [];
        const transaction = store.getTransaction();
        while (resultSet.next()) {
            result.push(collector.collect(resultSet, store, transaction, 0));
        }
        return result;
    };
};

/**
 * Convenience method for creating the sql query string and the parameters used therein.
 * @param {Store} store The store to operate on
 * @param {Node} ast The query AST
 * @returns {Object} An object containing three properties: "ast" (the query AST),
 * "sql" (the SQL query string) and "params" (an Array containing the parameters
 * used in the query string)
 */
const createSelector = exports.createSelector = function(store, ast) {
    const generator = new store.dialect.SqlGenerator(store, ast.aliases);
    const sql = ast.accept(generator);
    const collector = createCollector(generator.collectors);
    return {
        "sql": sql,
        "entities": ast.from.list.map(function(node) {
            return node.name;
        }),
        "collector": collector,
        "params": generator.params
    };
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
const getSelector = exports.getSelector = function(store, queryStr) {
    let selector = (store.queryCache && store.queryCache.get(queryStr)) || null;
    if (selector === null) {
        let ast;
        try {
            ast = Parser.parse(queryStr);
        } catch (e if e.name == "SyntaxError") {
            const strings = require('ringo/utils/strings');
            throw new Error([
                'Could not parse query.',
                '"' + queryStr + '"',
                strings.repeat(' ', e.location.start.column) + '^',
                e.message + ' At column: ' + e.location.start.column
            ].join('\n'));
        }
        selector = createSelector(store, ast);
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
const getParameterDescription = exports.getParameterDescription = function(value) {
    let dataType = null;
    if (value === undefined || value === null) {
        dataType = dataTypes.null;
    } else if (Number.isFinite(value)) {
        dataType = (value % 1 === 0) ? dataTypes.long : dataTypes.double;
    } else if (typeof(value) === "string") {
        dataType = dataTypes.string;
    } else if (typeof(value) === "boolean") {
        dataType = dataTypes.boolean;
    } else if (value instanceof Date) {
        dataType = dataTypes.timestamp;
    } else if (value._key != null && value.id != null) {
        dataType = dataTypes.long;
        value = value.id
    }
    return {
        "dataType": dataType,
        "value": value
    };
};
