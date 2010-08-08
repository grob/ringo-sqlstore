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
    var limit = 0;
    
    Object.defineProperty(this, "store", {
        "value": store,
        "enumerable": false
    });
    
    Object.defineProperty(this, "type", {
        "value": type,
        "enumerable": false
    });

    Object.defineProperty(this, "clauses", {
        "value": clauses,
        "enumerable": false
    });

    Object.defineProperty(this, "orders", {
        "value": orders,
        "enumerable": false
    });

    this.setLimit = function(value) {
        return limit = value;
    };
    
    this.getLimit = function() {
        return limit;
    };

    this.setOffset = function(value) {
        return offset = value;
    };
    
    this.getOffset = function() {
        return offset;
    };

    return this;
};

/** @ignore */
Query.prototype.toString = function() {
    return "[Query]";
};

Query.prototype.toSql = function(property) {
    var store = this.store;
    var mapping = store.getEntityMapping(this.type);
    var sqlBuf = new java.lang.StringBuffer("SELECT ");
    // FIXME: allow selecting specific properties!
    sqlBuf.append(store.dialect.quote(mapping.idColumnName));
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

Query.prototype.select = function(property) {
    var store = this.store;
    var type = this.type;
    var sql = this.toSql(property);
    log.info("Retrieving entities:", sql);
    var mapping = store.getEntityMapping(this.type);
    return store.executeQuery(sql).map(function(resultRow) {
        var id = resultRow[mapping.idColumnName];
        return store.create(type, new Key(type, id), null);
    });
};

Query.prototype.equals = function(property, value) {
    this.clauses.push(new OperatorClause(EQUAL, property, value));
    return this;
};

Query.prototype.greater = function(property, value) {
    this.clauses.push(new OperatorClause(GREATER_THAN, property, value));
    return this;
};

Query.prototype.greaterEquals = function(property, value) {
    this.clauses.push(new OperatorClause(GREATER_THAN_OR_EQUALS, property, value));
    return this;
};

Query.prototype.less = function(property, value) {
    this.clauses.push(new OperatorClause(LESS_THAN, property, value));
    return this;
};

Query.prototype.lessEquals = function(property, value) {
    this.clauses.push(new OperatorClause(LESS_THAN_OR_EQUALS, property, value));
    return this;
};

Query.prototype.orderBy = function(expression) {
    if (/^\w+\s+desc(ending)?$/i.test(expression) === true) {
        this.orders.push(new OrderClause(expression.substring(0, expression.indexOf(" ")), ORDER_DESC));
    } else {
        this.orders.push(new OrderClause(expression, ORDER_ASC));
    }
    return this;
};

Query.prototype.limit = function(limit) {
    this.setLimit(limit);
    return this;
};

Query.prototype.offset = function(offset) {
    this.setOffset(offset);
    return this;
};

Query.prototype.range = function(from, to) {
    this.setOffset(from);
    this.setLimit(to - from);
    return this;
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
