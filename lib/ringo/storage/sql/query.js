export("BaseQuery");

var Key = require("./key").Key;
var log = require('ringo/logging').getLogger(module.id);

const EQUAL = "=";
const GREATER_THAN = ">";
const GREATER_THAN_OR_EQUALS = ">=";
const LESS_THAN = "<";
const LESS_THAN_OR_EQUALS = "<=";
const ORDER_ASC = "asc";
const ORDER_DESC = "desc";

var executeQuery = function(query, property) {
    var sql = query.toSql(property);
    log.info("Retrieving entities:", sql);
    var store = query.getStore();
    var type = query.getType();
    var mapping = store.getEntityMapping(type);
    var result = store.executeQuery(sql);
    if (result.length < 1) {
        return null;
    } else if (result.length === 1) {
        var id = result[0][mapping.idColumnName];
        return store.create(type, new Key(type, id), null);
    } else {
        return result.map(function(resultRow) {
            var id = resultRow[mapping.idColumnName];
            return store.create(type, new Key(type, id), null);
        });
    }
};


var BaseQuery = function(store, type) {
    
    this.select = function(property) {
        return executeQuery(this.getQuery(), property);
    };
    
    this.getQuery = function() {
        return new Criteria(store, type);
    };
    
    return this;
};

/** @ignore */
BaseQuery.prototype.toString = function() {
    return "[BaseQuery]";
};

BaseQuery.prototype.equals = function(property, value) {
    return new OperatorQuery(this, EQUAL, property, value);
};

BaseQuery.prototype.greater = function(property, value) {
    return new OperatorQuery(this, GREATER_THAN, property, value);
};

BaseQuery.prototype.greaterEquals = function(property, value) {
    return new OperatorQuery(this, GREATER_THAN_OR_EQUALS, property, value);
};

BaseQuery.prototype.less = function(property, value) {
    return new OperatorQuery(this, LESS_THAN, property, value);
};

BaseQuery.prototype.lessEquals = function(property, value) {
    return new OperatorQuery(this, LESS_THAN_OR_EQUALS, property, value);
};

BaseQuery.prototype.orderBy = function(expression) {
    var parts = expression.split(/\s+/);
    if (/^\w+\s+desc(ending)?$/i.test(expression) === true) {
        return new OrderQuery(this, ORDER_DESC, expression.substring(0, expression.indexOf(" ")));
    }
    return new OrderQuery(this, ORDER_ASC, expression);
};

BaseQuery.prototype.limit = function(limit) {
    return new LimitQuery(this, limit);
};

BaseQuery.prototype.offset = function(offset) {
    return new OffsetQuery(this, offset);
};

BaseQuery.prototype.range = function(from, to) {
    return new RangeQuery(this, from, to);
};


var OperatorQuery = function(parentQuery, operator, property, value) {
    
    this.select = function(selectProperty) {
        return executeQuery(this.getQuery(), selectProperty);
    };

    this.getQuery = function() {
        var query = parentQuery.getQuery();
        return query.addClause(new OperatorClause(operator, property, value));
    };

    return this;
};
OperatorQuery.prototype = new BaseQuery();




var OrderQuery = function(parentQuery, order, property) {
    
    this.select = function(selectProperty) {
        return executeQuery(this.getQuery(), selectProperty);
    };

    this.getQuery = function() {
        var query = parentQuery.getQuery();
        return query.addOrder(new OrderClause(property, order));
    };

    return this;
};
OrderQuery.prototype = new BaseQuery();


var LimitQuery = function(parentQuery, limit) {

    this.select = function(selectProperty) {
        return executeQuery(this.getQuery(), selectProperty);
    };

    this.getQuery = function() {
        var query = parentQuery.getQuery();
        return query.setLimit(limit);
    };

    return this;
};

var OffsetQuery = function(parentQuery, offset) {

    this.select = function(selectProperty) {
        return executeQuery(this.getQuery(), selectProperty);
    };

    this.getQuery = function() {
        var query = parentQuery.getQuery();
        return query.setOffset(offset);
    };

    return this;
};

var RangeQuery = function(parentQuery, from, to) {

    this.select = function(selectProperty) {
        return executeQuery(this.getQuery(), selectProperty);
    };

    this.getQuery = function() {
        var query = parentQuery.getQuery();
        query.setOffset(from);
        query.setLimit(to - from);
        return query;
    };

    return this;
};


var Criteria = function(store, type) {
    var clauses = [];
    var orders = [];
    var offset = 0;
    var limit = Infinity;
    
    this.getStore = function() {
        return store;
    };
    
    this.getType = function() {
        return type;
    };
    
    this.hasClauses = function() {
        return clauses.length > 0;
    };
    
    this.hasOrders = function() {
        return orders.length > 0;
    };
    
    this.hasOffset = function() {
        return offset > 0;
    };

    this.hasLimit = function() {
        return limit !== Infinity;
    };
    
    this.addClause = function(clause) {
        clauses.push(clause);
        return this;
    };
    
    this.addOrder = function(order) {
        orders.push(order);
        return this;
    };
    
    this.setOffset = function(value) {
        offset = value;
        return this;
    };
    
    this.setLimit = function(value) {
        limit = value;
        return this;
    };
    
    this.toSql = function(property) {
        var mapping = store.getEntityMapping(type);
        var sqlBuf = new java.lang.StringBuffer("SELECT ");
        // FIXME: allow selecting specific properties!
        sqlBuf.append(store.dialect.quote(mapping.idColumnName));
        sqlBuf.append(" FROM ");
        sqlBuf.append(store.dialect.quote(mapping.tableName));
        if (clauses.length > 0) {
            sqlBuf.append(" WHERE ");
            sqlBuf.append(clauses.map(function(clause) {
                return clause.toSql(store, mapping);
            }).join(" AND "));
        }
        // orders
        if (orders.length > 0) {
            sqlBuf.append(" ORDER BY ").append(orders.map(function(order) {
                return order.toSql(store, mapping);
            }).join(", "));
        }
        // offset/limit
        if (offset > 0 && limit !== Infinity) {
            return store.dialect.getSqlRange(sqlBuf.toString(), offset, limit);
        } else if (offset > 0) {
            return store.dialect.getSqlOffset(sqlBuf.toString(), offset);
        } else if (limit !== Infinity) {
            return store.dialect.getSqlLimit(sqlBuf.toString(), limit);
        }
        return sqlBuf.toString();
    };
    
    return this;
};

/** @ignore */
Criteria.prototype.toString = function() {
    return "[Criteria]";
};


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

var OrderClause = function(property, order) {
    
    this.toSql = function(store, mapping) {
        var columnName = mapping.getColumnName(property);
        return store.dialect.quote(columnName) + " " + order;
    };
    
    return this;
};
