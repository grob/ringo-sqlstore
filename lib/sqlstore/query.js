export("Query", "jsToSql");

var log = require('ringo/logging').getLogger(module.id);
var {Parser, Token} = require('ringo/parser');
var {Storable} = require("ringo-storable");

var EQUAL = "=";
var GREATER_THAN = ">";
var GREATER_THAN_OR_EQUALS = ">=";
var LESS_THAN = "<";
var LESS_THAN_OR_EQUALS = "<=";
var ORDER_ASC = "asc";
var ORDER_DESC = "desc";

/**
 * Converts an AST node to SQL
 * @param {Store} store The store to use
 * @param {StringBuffer} buf The SQL statement buffer
 * @param {Array} parameters An array containing statement parameter objects
 * @param {org.mozilla.javascript.ast.AstNode} node The node to convert
 * @param {String} type The default type to use when resolving property names
 */
function convertAst(store, buf, parameters, node, type) {
    switch (node.type) {
        case Token.EXPR_RESULT:
            convertAst(store, buf, parameters, node.getExpression(), type);
            break;
        case Token.LP:
            buf.append("(");
            convertAst(store, buf, parameters, node.getExpression(), type);
            buf.append(")");
            break;
        case Token.AND:
            convertAst(store, buf, parameters, node.left, type);
            buf.append(" AND ");
            convertAst(store, buf, parameters, node.right, type);
            break;
        case Token.OR:
            convertAst(store, buf, parameters, node.left, type);
            buf.append(" OR ");
            convertAst(store, buf, parameters, node.right, type);
            break;
        case Token.EQ:
        case Token.SHEQ:
            convertAst(store, buf, parameters, node.left, type);
            buf.append(" = ");
            convertAst(store, buf, parameters, node.right, type);
            break;
        case Token.ASSIGN:
            throw new Error("Please use double or triple quotes as equality operator");
            break;
        case Token.NE:
        case Token.GT:
        case Token.GE:
        case Token.LT:
        case Token.LE:
        case Token.IN:
            convertAst(store, buf, parameters, node.left, type);
            buf.append(" ");
            buf.append(Packages.org.mozilla.javascript.ast.AstNode.operatorToString(node));
            buf.append(" ");
            convertAst(store, buf, parameters, node.right, type);
            break;
        case Token.ARRAYLIT:
            buf.append("(");
            ScriptableList(node.getElements()).forEach(function(element, idx) {
                if (idx > 0) {
                    buf.append(", ");
                }
                convertAst(store, buf, parameters, element, type);
            });
            buf.append(")");
            break;
        case Token.STRING:
            buf.append("?");
            parameters.push({
                "type": "string",
                "value": node.getValue()
            });
            break;
        case Token.NUMBER:
            buf.append("?");
            parameters.push({
                "type": "long",
                "value": node.getNumber()
            });
            break;
        case Token.TRUE:
        case Token.FALSE:
            buf.append("?");
            parameters.push({
                "type": "boolean",
                "value": node.toSource() == "true"
            });
            break;
        case Token.GETPROP:
            buf.append(getQualifiedColumnName(store, node.toSource(), type));
            break;
        case Token.NAME:
            buf.append(getQualifiedColumnName(store, node.getIdentifier(), type));
            break;
        default:
            throw new Error("Unknown AST node: " + Token.typeToName(node.type) +
                    " (" + node.getClass().getName() + ")");
            break;
    }
    return;
}

/**
 * Parses a javascript filter string into an SQL where clause
 * @param {Store} store The store
 * @param {String} str The filter string
 * property names)
 * @param {String} defaultType The default type (used for unprefixed property names)
 * @returns The parsed filter string
 * @type String
 */
function jsToSql(store, str, defaultType) {
    var parser = new Parser();
    var ast = parser.parse(str);
    var buf = new java.lang.StringBuffer();
    var parameters = [];
    convertAst(store, buf, parameters, ast.getFirstChild(), defaultType);
    return [buf.toString(), parameters];
}

/**
 * If the argument is a storable, this method returns its ID, otherwise
 * it simply returns the argument.
 * @param {Object} Either a storable or any other type of value
 * @returns The ID of the storable or the argument
 */
function getValue(value) {
    if (value != null && (value instanceof Storable)) {
        if (value._id != null) {
            return value._id;
        } else {
            throw new Error("Can't use a transient storable as query clause");
        }
    }
    return value;
}

/**
 * Returns the mapping for the property passed as argument
 * @param {Store} store The store
 * @param {String} property The property name, which can optionally be
 * prefixed with the entity type name it belongs to (separated with a dot)
 * @param {String} defaultType The default type (used for unprefixed property names)
 * @returns The property mapping
 * @type Mapping
 */
var getPropertyMapping = function(store, property, defaultType) {
    var mapping;
    if (property.indexOf(".") > -1) {
        var [entityType, propName] = property.split(".");
        mapping = store.getEntityConstructor(entityType).mapping;
        property = propName;
    } else {
        mapping = store.getEntityConstructor(defaultType).mapping;
    }
    return mapping.getMapping(property, store.dialect);
};

/**
 * Returns the qualified column name for the property passed as argument
 * @param {Store} store The store
 * @param {String} property The property name, which can optionally be
 * prefixed with the entity type name it belongs to (separated with a dot)
 * @param {String} defaultType The default type (used for unprefixed property names)
 * @returns The column name
 * @type String
 */
var getQualifiedColumnName = function(store, property, defaultType) {
    var mapping = getPropertyMapping(store, property, defaultType);
    return mapping.getQualifiedColumnName(store.dialect);
};

/**
 * Creates a new Query instance
 * @class Instances of this class represent a database query
 * @param {Store} store The store to operate on
 * @param {String} type The entity type to query
 * @returns A newly created Query instance
 * @constructor
 */
var Query = function(store, type) {

    var join = null;
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
     * Contains the mapping to use
     * @type Mapping
     */
    Object.defineProperty(this, "mapping", {
        "value": store.getEntityMapping(type),
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
        return parseInt(limit, 10);
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
        return parseInt(offset, 10);
    };

    /**
     * Joins this query with the entity passed as argument
     * @param {Function} throughEntity The entity to join with
     * @param {String} predicate The join predicate
     * @returns The query
     * @type Query
     */
    this.join = function(throughEntity, predicate) {
        join = new InnerJoin(this, throughEntity, predicate);
        return this;
    };

    /**
     * Returns the join of this query
     * @returns The join
     * @type InnerJoin
     */
    this.getJoin = function() {
        return join;
    };

    return this;
};

/** @ignore */
Query.prototype.toString = function() {
    return "[Query]";
};

/**
 * Returns the SQL statement represented by this query
 * @returns The SQL statement to use for querying and the parameters array
 * @type Array
 */
Query.prototype.toSql = function(property, aggregation) {
    var store = this.store;
    var mapping = store.getEntityMapping(this.type);
    var sqlBuf = new java.lang.StringBuffer("SELECT ");
    var parameters = [];
    var columnName = null;
    if (typeof(property) === "string") {
        if (property === "*") {
            columnName = store.dialect.quote(mapping.tableName) + "." + property;
        } else {
            columnName = mapping.getQualifiedColumnName(property, store.dialect);
        }
    } else {
        columnName = mapping.id.getQualifiedColumnName(store.dialect);
    }
    if (aggregation != null) {
        sqlBuf.append(aggregation).append("(").append(columnName).append(")");
    } else {
        sqlBuf.append(columnName);
    }
    sqlBuf.append(" FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(store.dialect));
    if (this.getJoin() != null) {
        sqlBuf.append(this.getJoin().toSql(parameters));
    }
    if (this.clauses.length > 0) {
        sqlBuf.append(" WHERE ");
        sqlBuf.append(this.clauses.map(function(clause) {
            return clause.toSql(parameters);
        }).join(" AND "));
    }
    // orders
    if (this.orders.length > 0) {
        sqlBuf.append(" ORDER BY ").append(this.orders.map(function(order) {
            return order.toSql();
        }).join(", "));
    }
    // offset/limit
    if (this.getOffset() > 0 && this.getLimit() !== 0) {
        store.dialect.addSqlRange(sqlBuf, this.getOffset(), this.getLimit());
    } else if (this.getOffset() > 0) {
        store.dialect.addSqlOffset(sqlBuf, this.getOffset());
    } else if (this.getLimit() !== 0) {
        store.dialect.addSqlLimit(sqlBuf, this.getLimit());
    }
    return [sqlBuf.toString(), parameters];
};

/**
 * Executes this query
 * @param {String} property Either the name of a property, or "*". In the former
 * case this method returns an array containing the property values of each matched
 * entity, in the latter it returns an array containing all matched entities. If
 * the argument is omitted, this method returns an array containing lazily loaded
 * entities (they are loaded at first property access).
 * @returns The result array containing either values or entities matching the query
 * @type Array
 */
Query.prototype.select = function(property) {
    var [sql, parameters] = this.toSql(property);
    var collector = this.store.getCollector(this.mapping, property);
    return this.store.executeQuery(sql, parameters, collector);
};

/**
 * Returns the result of the aggregation function specified
 * @param {String} aggregation The aggregation function
 * @param {String} property The property to aggregate
 * @returns The result received from the database
 * @type Number
 */
Query.prototype.aggregate = function(aggregation, property) {
    var [sql, parameters] = this.toSql(property, aggregation);
    var collector = this.store.getCollector(this.mapping, property);
    return this.store.executeQuery(sql, parameters, collector)[0];
};

/**
 * Returns the number of persisted entities
 * @returns The number of persisted entities
 * @type Number
 */
Query.prototype.count = function() {
    return this.aggregate("COUNT", "id");
};

/**
 * Returns the maximum value of the given property
 * @param {String} property The property name
 * @returns The maximum value
 */
Query.prototype.max = function(property) {
    return this.aggregate("MAX", property);
};

/**
 * Returns the minimum value of the given property
 * @param {String} property The property name
 * @returns The minimum value
 */
Query.prototype.min = function(property) {
    return this.aggregate("MIN", property);
};

/**
 * Returns the sum of all values of the given property
 * @param {String} property The property name
 * @returns The sum
 */
Query.prototype.sum = function(property) {
    return this.aggregate("SUM", property);
};

/**
 * Returns only the distinct values of the given property
 * @param {String} property The property name
 * @returns The sum
 */
Query.prototype.distinct = function(property) {
    var [sql, parameters] = this.toSql(property, "DISTINCT");
    var collector = this.store.getCollector(this.mapping, property);
    return this.store.executeQuery(sql, parameters, collector);
};

/**
 * Adds an "equals"-clause to this query
 * @param {String} property The property
 * @param {Object} value The value. If the value is an array, the clause added
 * leads to an "where property in (value)" SQL clause.
 * @returns The query
 * @type Query
 */
Query.prototype.equals = function(property, value) {
    if (value instanceof Array) {
        this.clauses.push(new InClause(this, property, value));
    } else {
        this.clauses.push(new OperatorClause(this, EQUAL, property, value));
    }
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
    this.clauses.push(new OperatorClause(this, GREATER_THAN, property, value));
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
    this.clauses.push(new OperatorClause(this, GREATER_THAN_OR_EQUALS, property, value));
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
    this.clauses.push(new OperatorClause(this, LESS_THAN, property, value));
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
    this.clauses.push(new OperatorClause(this, LESS_THAN_OR_EQUALS, property, value));
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
    if (/\s+desc(ending)?$/i.test(expression) === true) {
        this.orders.push(new OrderClause(this, expression.substring(0, expression.indexOf(" ")), ORDER_DESC));
    } else {
        this.orders.push(new OrderClause(this, expression, ORDER_ASC));
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
 * @param {Number} from The start index
 * @param {Number} to The end index
 * @returns The query
 * @type Query
 */
Query.prototype.range = function(from, to) {
    this.setOffset(from);
    this.setLimit(to - from);
    return this;
};

/**
 * Adds a filter to the query. All placeholders (eg. "$1") are replaced
 * with the additional arguments to this method.
 * @param {String} str The filter string
 * @returns The query
 * @type Query
 */
Query.prototype.filter = function(str/* [arg1[, arg2]] */) {
    var values = Array.prototype.slice.call(arguments, 1);
    this.clauses.push(new FilterClause(this, str, values));
    return this;
};

/**
 * Creates a new operator clause
 * @class Instances of this class represent an operator clause
 * @param {Query} query The query this clause belongs to
 * @param {String} operator The operator
 * @param {String} property The name of the property
 * @param {Object} value The value. If it's a storable instance, it's id is used as value
 * @returns A newly created OperatorClause instance
 * @constructor
 * @private
 */
var OperatorClause = function(query, operator, property, value) {

    this.toSql = function(parameters) {
        var mapping = getPropertyMapping(query.store, property, query.type);
        var columnName = mapping.getQualifiedColumnName(query.store.dialect);
        var sqlBuf = new java.lang.StringBuffer(columnName);
        if (operator === EQUAL && (value === null || value === undefined)) {
            sqlBuf.append(" IS NULL");
        } else {
            sqlBuf.append(" ").append(operator).append(" ?");
            parameters.push({
                "type": mapping.type,
                "value": getValue(value)
            });
        }
        return sqlBuf.toString();
    };

    return this;
};

/**
 * Creates a new "where in"-clause
 * @class Instances of this class represent a "where column in (...)" clause
 * @param {Query} query The query this clause belongs to
 * @param {String} property The name of the property
 * @param {Array} value An array of values. The array can contain storable
 * instances as values, in which case the id of the storables are used as values
 * @returns A newly created OperatorClause instance
 * @constructor
 * @private
 */
var InClause = function(query, property, value) {

    this.toSql = function(parameters) {
        var mapping = getPropertyMapping(query.store, property, query.type);
        var columnName = mapping.getQualifiedColumnName(query.store.dialect);
        var sqlBuf = new java.lang.StringBuffer(columnName);
        sqlBuf.append(" in (");
        sqlBuf.append(value.map(function(val) {
            parameters.push({
                "type": mapping.type,
                "value": getValue(val)
            });
            return "?";
        }).join(", "));
        sqlBuf.append(")");
        return sqlBuf.toString();
    };

    return this;
};

/**
 * Creates a new order clause
 * @param {Query} query The query this clause belongs to
 * @param {String} property The name of the property
 * @param {String} order Optional order ("(desc|asc)[ending]")
 * @constructor
 * @private
 */
var OrderClause = function(query, property, order) {

    this.toSql = function() {
        return getQualifiedColumnName(query.store, property, query.type) + " " + order;
    };

    return this;
};

/**
 * Instances of this class represent an inner join
 * @param {Query} query The query this clause belongs to
 * @param {Function} relationEntity The relation entity constructor
 * @param {String} predicate The join predicate
 * @returns A newly created InnerJoin instance
 * @constructor
 * @private
 */
var InnerJoin = function(query, relationEntity, predicate) {
    var [sql, params] = jsToSql(query.store, predicate, query.type);
    var sqlBuf = new java.lang.StringBuffer(" INNER JOIN ");
    sqlBuf.append(relationEntity.mapping.getQualifiedTableName(query.store.dialect));
    sqlBuf.append(" ON ");
    sqlBuf.append(sql);

    this.toSql = function(parameters) {
        Array.prototype.push.apply(parameters, params);
        return sqlBuf.toString();
    };

    return this;
};

/**
 * A generic filter clause
 * @param {Query} query The query this clause belongs to
 * @param {String} filter The filter string
 * @returns A newly created FilterClause instance
 * @constructor
 * @private
 */
var FilterClause = function(query, filter) {
    var [sql, params] = jsToSql(query.store, filter, query.type);

    this.toSql = function(parameters) {
        Array.prototype.push.apply(parameters, params);
        return sql;
    };

    return this;
};
