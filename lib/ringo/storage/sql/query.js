export("Query");

var Key = require("./key").Key;
var log = require('ringo/logging').getLogger(module.id);

const EQUAL = "=";
const GREATER_THAN = ">";
const GREATER_THAN_OR_EQUALS = ">=";
const LESS_THAN = "<";
const LESS_THAN_OR_EQUALS = "<=";
const ORDER_ASC = "asc";
const ORDER_DESC = "desc";

var Query = function(store, type) {

    var clauses = [];
    var orders = [];
    var offset = 0;
    var limit = Infinity;
    
    this.select = function(property) {
        var sql = this.toSql(property);
        log.info("Retrieving entities:", sql);
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
Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.equals = function(property, value) {
    return this.addClause(new OperatorClause(EQUAL, property, value));
};

Query.prototype.greater = function(property, value) {
    return this.addClause(new OperatorClause(GREATER_THAN, property, value));
};

Query.prototype.greaterEquals = function(property, value) {
    return this.addClause(new OperatorClause(GREATER_THAN_OR_EQUALS, property, value));
};

Query.prototype.less = function(property, value) {
    return this.addClause(new OperatorClause(LESS_THAN, property, value));
};

Query.prototype.lessEquals = function(property, value) {
    return this.addClause(new OperatorClause(LESS_THAN_OR_EQUALS, property, value));
};

Query.prototype.orderBy = function(expression) {
    if (/^\w+\s+desc(ending)?$/i.test(expression) === true) {
        return this.addOrder(new OrderClause(expression.substring(0, expression.indexOf(" ")), ORDER_DESC));
    }
    return this.addOrder(new OrderClause(expression, ORDER_ASC));
};

Query.prototype.limit = function(limit) {
    return this.setLimit(limit);
};

Query.prototype.offset = function(offset) {
    return this.setOffset(offset);
};

Query.prototype.range = function(from, to) {
    this.setOffset(from);
    return this.setLimit(to - from);
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
