export("Query");

var Key = require("./key").Key;
var Cache = require("./cache").Cache;
var log = require('ringo/logging').getLogger(module.id);

const EQUAL = "=";
const GREATER_THAN = ">";
const GREATER_THAN_OR_EQUALS = ">=";
const LESS_THAN = "<";
const LESS_THAN_OR_EQUALS = "<=";
const ORDER_ASC = "asc";
const ORDER_DESC = "desc";

/**
 * Creates a new Query instance
 * @class Instances of this class represent a database query
 * @param {Store} store The store to operate on
 * @param {String} type The entity type to query
 * @returns A newly created Query instance
 * @constructor
 */
var Query = function(store, type) {

    var clauses = [];
    var orders = [];
    var offset = 0;
    var limit = 0;

    /**
     * Contains the store of this query
     * @type Store
     */
    Object.defineProperty(this, "store", {
        "value": store,
        "enumerable": false
    });
    
    /**
     * Contains the entity type of this query
     * @type String
     */
    Object.defineProperty(this, "type", {
        "value": type,
        "enumerable": false
    });

    /**
     * Contains the clauses of this query
     * @type Array
     */
    Object.defineProperty(this, "clauses", {
        "value": clauses,
        "enumerable": false
    });

    /**
     * Contains the order clauses of this query
     * @type Array
     */
    Object.defineProperty(this, "orders", {
        "value": orders,
        "enumerable": false
    });

    /**
     * Sets an optional result limit
     * @param {Number} value The result limit
     */
    this.setLimit = function(value) {
        return limit = value;
    };

    /**
     * Returns the result limit, or zero if none is defined
     * @returns The result limit
     * @type Number
     */
    this.getLimit = function() {
        return limit;
    };

    /**
     * Sets an optional result offset
     * @param {Number} value The result offset
     */
    this.setOffset = function(value) {
        return offset = value;
    };
    
    /**
     * Returns the result offset, or zero if none is defined
     * @returns The result offset
     * @type Number
     */
    this.getOffset = function() {
        return offset;
    };

    return this;
};

/** @ignore */
Query.prototype.toString = function() {
    return "[Query]";
};

/**
 * Returns the SQL statement represented by this query
 * @returns The SQL statement to use for querying
 * @type String
 */
Query.prototype.toSql = function(aggressive) {
    var store = this.store;
    var mapping = store.getEntityMapping(this.type);
    var sqlBuf = new java.lang.StringBuffer("SELECT ");
    if (aggressive === true) {
        sqlBuf.append("*");
    } else {
        sqlBuf.append(store.dialect.quote(mapping.id.column));
    }
    sqlBuf.append(" FROM ");
    sqlBuf.append(store.dialect.quote(mapping.tableName));
    if (this.clauses.length > 0) {
        sqlBuf.append(" WHERE ");
        sqlBuf.append(this.clauses.map(function(clause) {
            return clause.toSql(store, mapping);
        }).join(" AND "));
    }
    // orders
    if (this.orders.length > 0) {
        sqlBuf.append(" ORDER BY ").append(this.orders.map(function(order) {
            return order.toSql(store, mapping);
        }).join(", "));
    }
    // offset/limit
    if (this.getOffset() > 0 && this.getLimit() !== 0) {
        return store.dialect.getSqlRange(sqlBuf.toString(), this.getOffset(), this.getLimit());
    } else if (this.getOffset() > 0) {
        return store.dialect.getSqlOffset(sqlBuf.toString(), this.getOffset());
    } else if (this.getLimit() !== 0) {
        return store.dialect.getSqlLimit(sqlBuf.toString(), this.getLimit());
    }
    return sqlBuf.toString();
};

/**
 * Executes this query
 * @param {Boolean} aggressive If true the entities are loaded including their
 * properties. Defaults to lazy loading.
 * @returns The result array containing entities matching the query
 * @type Array
 */
Query.prototype.select = function(aggressive) {
    var store = this.store;
    var type = this.type;
    var sql = this.toSql(aggressive);
    log.debug("Retrieving entities:", sql);
    var mapping = store.getEntityMapping(this.type);
    var result = store.executeQuery(sql, mapping).map(function(entity) {
        var id = entity[mapping.id.column];
        var cacheKey = Cache.createKey(type, id);
        if (store.cache.containsKey(cacheKey)) {
            return store.cache.get(cacheKey);
        }
        var key = new Key(type, id);
        var obj = null;
        if (aggressive === true) {
            Object.defineProperty(entity, "_key", {
                value: key
            });
            obj = store.create(type, key, entity);
        } else {
            obj = store.create(type, key, null);
        }
        store.cache.put(cacheKey, obj);
        return obj;
    });
    return result;
};

/**
 * Adds an "equals"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value
 * @returns The query
 * @type Query
 */
Query.prototype.equals = function(property, value) {
    this.clauses.push(new OperatorClause(EQUAL, property, value));
    return this;
};

/**
 * Adds a "greater than"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value
 * @returns The query
 * @type Query
 */
Query.prototype.greater = function(property, value) {
    this.clauses.push(new OperatorClause(GREATER_THAN, property, value));
    return this;
};

/**
 * Adds a "greater than or equals"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value
 * @returns The query
 * @type Query
 */
Query.prototype.greaterEquals = function(property, value) {
    this.clauses.push(new OperatorClause(GREATER_THAN_OR_EQUALS, property, value));
    return this;
};

/**
 * Adds a "less than"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value
 * @returns The query
 * @type Query
 */
Query.prototype.less = function(property, value) {
    this.clauses.push(new OperatorClause(LESS_THAN, property, value));
    return this;
};

/**
 * Adds a "less than or equals"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value
 * @returns The query
 * @type Query
 */
Query.prototype.lessEquals = function(property, value) {
    this.clauses.push(new OperatorClause(LESS_THAN_OR_EQUALS, property, value));
    return this;
};

/**
 * Adds an "order by"-clause to this query
 * @param {String} expression The order-by expression following the schema
 * "COLUMN_NAME[ asc[ending]|desc[ending]]"
 * @returns The query
 * @type Query
 */
Query.prototype.orderBy = function(expression) {
    if (/^\w+\s+desc(ending)?$/i.test(expression) === true) {
        this.orders.push(new OrderClause(expression.substring(0, expression.indexOf(" ")), ORDER_DESC));
    } else {
        this.orders.push(new OrderClause(expression, ORDER_ASC));
    }
    return this;
};

/**
 * Sets the result limit of this query
 * @param {Number} limit The result limit
 * @returns The query
 * @type Query
 */
Query.prototype.limit = function(limit) {
    this.setLimit(limit);
    return this;
};

/**
 * Sets the result offset of this query
 * @param {Number} offset The result offset
 * @returns The query
 * @type Query
 */
Query.prototype.offset = function(offset) {
    this.setOffset(offset);
    return this;
};

/**
 * Sets a result range for this query
 * @param {Number} limit The result limit
 * @param {Number} offset The result offset
 * @returns The query
 * @type Query
 */
Query.prototype.range = function(from, to) {
    this.setOffset(from);
    this.setLimit(to - from);
    return this;
};

/**
 * Creates a new operator clause
 * @private
 */
var OperatorClause = function(operator, property, value) {
    
    this.toSql = function(store, mapping) {
        var columnName = mapping.getColumnName(property);
        var sqlBuf = new java.lang.StringBuffer(store.dialect.quote(columnName));
        sqlBuf.append(" ").append(operator).append(" ");
        if (typeof(value) === "string") {
            // FIXME: quoting a string value is job of the database dialect
            sqlBuf.append("'").append(value.toString()).append("'");
        } else {
            sqlBuf.append(value.toString());
        }
        return sqlBuf.toString();
    };
    
    return this;
};

/**
 * Creates a new order clause
 * @private
 */
var OrderClause = function(property, order) {
    
    this.toSql = function(store, mapping) {
        var columnName = mapping.getColumnName(property);
        return store.dialect.quote(columnName) + " " + order;
    };
    
    return this;
};
