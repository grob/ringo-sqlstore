var Node = exports.Node = function() {
    return this;
};


var Value = exports.Value = function() {
    return Object.create(Value.prototype);
};
Value.prototype = Object.create(Node.prototype);

Value.prototype.toString = function() {
    return "[" + this.type + " " + this.value + "]";
};
Value.prototype.toSql = function(store, nparams, params) {
    params.push({
        "type": this.type,
        "value": this.value
    });
    return "?";
};

// values

var StringValue = exports.StringValue = function StringValue(value) {
    return Object.create(StringValue.prototype, {
        "type": {"value": "string", "enumerable": true},
        "value": {"value": value, "enumerable": true}
    })
};
StringValue.prototype = Object.create(Value.prototype);

var IntValue = exports.IntValue = function(value) {
    return Object.create(IntValue.prototype, {
        "type": {"value": "long", "enumerable": true},
        "value": {"value": value, "enumerable": true}
    });
};
IntValue.prototype = Object.create(Value.prototype);

var DecimalValue = exports.DecimalValue = function(value) {
    return Object.create(DecimalValue.prototype, {
        "type": {"value": "float", "enumerable": true},
        "value": {"value": value, "enumerable": true}
    });
};
DecimalValue.prototype = Object.create(Value.prototype);

var BooleanValue = exports.BooleanValue = function(value) {
    return Object.create(BooleanValue.prototype, {
        "type": {"value": "boolean", "enumerable": true},
        "value": {"value": value, "enumerable": true}
    });
};
BooleanValue.prototype = Object.create(Value.prototype);

var NullValue = exports.NullValue = function() {
    return Object.create(NullValue.prototype, {
        "type": {"value": "null", "enumerable": true},
        "value": {"value": null, "enumerable": true}
    });
};
NullValue.prototype = Object.create(Value.prototype);

var ParameterValue = exports.ParameterValue = function(name) {
    return Object.create(ParameterValue.prototype, {
        "type": {"value": "parameter", "enumerable": true},
        "value": {"value": name, "enumerable": true}
    });
};
ParameterValue.prototype = Object.create(Value.prototype);

ParameterValue.prototype.toSql = function(store, nparams, params) {
    var value = nparams[this.value];
    var type = null;
    if (value === undefined || value === null) {
        type = null;
    } else if (typeof(value) === "string") {
        type = "string";
    } else if (typeof(value) === "boolean") {
        type = "boolean";
    } else if (typeof(value) === "number") {
        type = (value % 1 === 0) ? "long" : "double";
    } else if (value instanceof Date) {
        type = "timestamp";
    }
    params.push({
        "type": type,
        "value": value
    });
    return "?";
};

// entity

var Entity = exports.Entity = function(entity, loadAggressive) {
    return Object.create(Entity.prototype, {
        "entity": {"value": entity, "enumerable": true},
        "property": {"value": "id", "enumerable": true},
        "loadAggressive": {"value": loadAggressive === true, "enumerable": true}
    });
};
Entity.prototype = Object.create(Node.prototype);

Entity.prototype.toString = function() {
    return "[Entity " + this.entity + "]";
};
Entity.prototype.toSql = function(store, nparams, params) {
    var mapping = store.getEntityMapping(this.entity);
    return mapping.getQualifiedTableName(store.dialect);
};
Entity.prototype.toSqlSelect = function(store, nparams, params) {
    var mapping = store.getEntityMapping(this.entity);
    if (this.loadAggressive === true) {
        return mapping.getQualifiedTableName(store.dialect) + ".*";
    }
    return mapping.getQualifiedColumnName(this.property, store.dialect);
};

// ident

var Ident = exports.Ident = function(entity, property) {
    return Object.create(Ident.prototype, {
        "entity": {"value": entity, "enumerable": true},
        "property": {"value": property || null, "enumerable": true}
    });
};
Ident.prototype = Object.create(Node.prototype);

Ident.prototype.toString = function() {
    if (this.property != undefined) {
        return "[Ident " + this.entity + "." + this.property + "]";
    }
    return "[Ident " + this.entity + "]";
};

Ident.prototype.toSql = function(store, nparams, params) {
    var mapping = store.getEntityMapping(this.entity);
    if (this.property != undefined) {
        return mapping.getQualifiedColumnName(this.property, store.dialect);
    }
    return mapping.getQualifiedTableName(store.dialect);
};
Ident.prototype.toSqlSelect = function(store, nparams, params) {
    var mapping = store.getEntityMapping(this.entity);
    if (this.property === "*") {
        return mapping.getQualifiedTableName(store.dialect) + ".*";
    }
    return mapping.getQualifiedColumnName(this.property || "id", store.dialect);
};


// comparison

var Comparison = exports.Comparison = function(operator, value) {
    return Object.create(Comparison.prototype, {
        "operator": {"value": operator, "enumerable": true},
        "value": {"value": value, "enumerable": true}
    });
};
Comparison.prototype = Object.create(Node.prototype);

Comparison.prototype.toString = function() {
    return "[Comparison " + this.operator + "]";
};

Comparison.prototype.toSql = function(store, nparams, params) {
    return [this.operator, this.value.toSql(store, nparams, params)].join(" ");
};


// condition

var Condition = exports.Condition = function(left, right) {
    return Object.create(Condition.prototype, {
        "left": {"value": left, "enumerable": true},
        "right": {"value": right, "enumerable": true}
    });
};

Condition.prototype = Object.create(Node.prototype);

Condition.prototype.toString = function() {
    return "[Condition]";
};

Condition.prototype.toSql = function(store, nparams, params) {
    var buf = [this.left.toSql(store, nparams, params)];
    if (this.right != null) {
        buf.push(this.right.toSql(store, nparams, params));
    }
    return buf.join(" ");
};

var NotCondition = exports.NotCondition = function(value) {
    return Object.create(NotCondition.prototype, {
        "value": {"value": value, "enumerable": true}
    });
};
NotCondition.prototype = Object.create(Node.prototype);

NotCondition.prototype.toString = function() {
    return "[Not]";
};
NotCondition.prototype.toSql = function(store, nparams, params) {
    return "NOT " + this.value.toSql(store, nparams, params);
};

var ExistsCondition = exports.ExistsCondition = function(select) {
    return Object.create(ExistsCondition.prototype, {
        "select": {"value": select, "enumerable": true}
    });
};
ExistsCondition.prototype = Object.create(Node.prototype);

ExistsCondition.prototype.toString = function() {
    return "[Exists]";
};
ExistsCondition.prototype.toSql = function(store, nparams, params) {
    return "EXISTS " + this.select.toSql(store, nparams, params);
};

var IsNullCondition = exports.IsNullCondition = function(not) {
    return Object.create(IsNullCondition.prototype, {
        "isNot": {"value": not === true, "enumerable": true}
    });
};

IsNullCondition.prototype = Object.create(Node.prototype);

IsNullCondition.prototype.toString = function() {
    if (this.isNot === true) {
        return "[IsNotNull]";
    }
    return "[IsNull]";
};

IsNullCondition.prototype.toSql = function(store, params) {
    if (this.isNot === true) {
        return "IS NOT NULL";
    }
    return "IS NULL";
};

var BetweenCondition = exports.BetweenCondition = function(start, end) {
    return Object.create(BetweenCondition.prototype, {
        "start": {"value": start, "enumerable": true},
        "end": {"value": end, "enumerable": true}
    });
};

BetweenCondition.prototype = Object.create(Node.prototype);

BetweenCondition.prototype.toString = function() {
    return "[Between]";
};

BetweenCondition.prototype.toSql = function(store, nparams, params) {
    return ["BETWEEN", this.start.toSql(store, nparams, params),
        "AND", this.end.toSql(store, nparams, params)].join(" ");
};

var InCondition = exports.InCondition = function(values) {
    return Object.create(InCondition.prototype, {
        "values": {"value": values, "enumerable": true}
    });
};
InCondition.prototype = Object.create(Node.prototype);

InCondition.prototype.toString = function() {
    return "[InCondition]";
};
InCondition.prototype.toSql = function(store, nparams, params) {
    var buf = ["IN ("];
    if (this.values instanceof Array) {
        buf.push(this.values.map(function(value) {
            return value.toSql(store, nparams, params);
        }).join(", "));
    } else {
        buf.push(this.values.toSql(store, nparams, params));
    }
    buf.push(")");
    return buf.join("");
};

var LikeCondition = exports.LikeCondition = function(value, not) {
    return Object.create(LikeCondition.prototype, {
        "isNot": {"value": not === true, "enumerable": true},
        "value": {"value": value, "enumerable": true}
    });
};
LikeCondition.prototype = Object.create(Node.prototype);

LikeCondition.prototype.toString = function() {
    if (this.isNot === true) {
        return "[NotLike]";
    }
    return "[Like]";
};
LikeCondition.prototype.toSql = function(store, nparams, params) {
    return [(this.isNot === true) ? "NOT LIKE" : "LIKE",
        this.value.toSql(store, nparams, params)].join(" ");
};

// condition list
var ConditionList = exports.ConditionList = function(conditions) {
    return Object.create(ConditionList.prototype, {
        "conditions": {"value": conditions, "enumerable": true},
        "length": {"get": function() {
            return conditions.length;
        }, "enumerable": true}
    });
};

ConditionList.prototype = Object.create(Node.prototype);

ConditionList.prototype.toString = function() {
    return "[ConditionList (" + this.length + ")]";
};

ConditionList.prototype.toSql = function(store, nparams, params) {
    var sql = this.conditions.map(function(condition) {
        return condition.toSql(store, nparams, params);
    }).join(" AND ");
    if (this.length > 1) {
        return "(" + sql + ")";
    }
    return sql;
};

// expression

var Expression = exports.Expression = function(andConditions, orConditions) {
    return Object.create(Expression.prototype, {
        "andConditions": {"value": andConditions, "enumerable": true},
        "orConditions": {"value": orConditions, "enumerable": true}
    });
};
Expression.prototype = Object.create(Node.prototype);

Expression.prototype.toString = function() {
    return "[Expression]";
};
Expression.prototype.toSql = function(store, nparams, params) {
    var buf = [this.andConditions.toSql(store, nparams, params)];
    if (this.orConditions != undefined && this.orConditions.length > 0) {
        buf.push(this.orConditions.toSql(store, nparams, params));
    }
    if (buf.length > 1) {
        return "(" + buf.join(" OR ") + ")";
    }
    return buf.join(" OR ");
};


// having clause

var HavingClause = exports.HavingClause = function(expression) {
    return Object.create(HavingClause.prototype, {
        "value": {"value": expression, "enumerable": true}
    });
};
HavingClause.prototype = Object.create(Node.prototype);

HavingClause.prototype.toString = function() {
    return "[Having]";
};
HavingClause.prototype.toSql = function(store, nparams, params) {
    return "HAVING " + this.value.toSql(store, nparams, params);
};

// order by

var OrderBy = exports.OrderBy = function(ident, isReverse) {
    return Object.create(OrderBy.prototype, {
        "value": {"value": ident, "enumerable": true},
        "isReverse": {"value": isReverse, "enumerable": true}
    });
};
OrderBy.prototype = Object.create(Node.prototype);

OrderBy.prototype.toString = function() {
    return "[OrderBy]";
};
OrderBy.prototype.toSql = function(store, nparams, params) {
    return [this.value.toSql(store, nparams, params),
        (this.isReverse) ? "DESC" : "ASC"].join(" ");
};

// order by clause

var OrderByClause = exports.OrderByClause = function(list) {
    return Object.create(OrderByClause.prototype, {
        "list": {"value": list, "enumerable": true}
    });
};
OrderByClause.prototype = Object.create(Node.prototype);

OrderByClause.prototype.toString = function() {
    return "[OrderByClause]";
};
OrderByClause.prototype.toSql = function(store, nparams, params) {
    return "ORDER BY " + this.list.map(function(orderby) {
        return orderby.toSql(store, nparams, params);
    }).join(", ");
};

// group by clause

var GroupByClause = exports.GroupByClause = function(list) {
    return Object.create(GroupByClause.prototype, {
        "list": {"value": list, "enumerable": true}
    });
};
GroupByClause.prototype = Object.create(Node.prototype);

GroupByClause.prototype.toString = function() {
    return "[GroupByClause]";
};
GroupByClause.prototype.toSql = function(store, nparams, params) {
    return "GROUP BY " + this.list.map(function(ident) {
        return ident.toSql(store, nparams, params);
    }).join(", ");
};


// where clause

var WhereClause = exports.WhereClause = function(expression) {
    return Object.create(WhereClause.prototype, {
        "value": {"value": expression, "enumerable": true}
    });
};
WhereClause.prototype = Object.create(Node.prototype);

WhereClause.prototype.toString = function() {
    return "[WhereClause]";
};
WhereClause.prototype.toSql = function(store, nparams, params) {
    return "WHERE " + this.value.toSql(store, nparams, params);
};


// from clause

var FromClause = exports.FromClause = function(list) {
    return Object.create(FromClause.prototype, {
        "list": {"value": list, "enumerable": true}
    });
};
FromClause.prototype = Object.create(Node.prototype);

FromClause.prototype.toString = function() {
    return "[FromClause]";
};
FromClause.prototype.toSql = function(store, nparams, params) {
    return "FROM " + this.list.map(function(ident) {
        return ident.toSql(store, nparams, params);
    }).join(", ");
};


// inner join clause

var InnerJoinClause = exports.InnerJoinClause = function(entities, predicate) {
    return Object.create(InnerJoinClause.prototype, {
        "entities": {"value": entities, "enumerable": true},
        "predicate": {"value": predicate, "enumerable": true}
    });
};
InnerJoinClause.prototype = Object.create(Node.prototype);

InnerJoinClause.prototype.toString = function() {
    return "[InnerJoin]";
};
InnerJoinClause.prototype.toSql = function(store, nparams, params) {
    return ["INNER JOIN", this.entities.map(function(entity) {
        return entity.toSql(store, nparams, params);
    }).join(", "), "ON", this.predicate.toSql(store, nparams, params)].join(" ");
};

// (left/right) outer join clause

var OuterJoinClause = exports.OuterJoinClause = function(side, entities, predicate) {
    return Object.create(OuterJoinClause.prototype, {
        "side": {"value": side, "enumerable": true},
        "entities": {"value": entities, "enumerable": true},
        "predicate": {"value": predicate, "enumerable": true}
    });
};
OuterJoinClause.prototype = Object.create(Node.prototype);

OuterJoinClause.prototype.toString = function() {
    return "[OuterJoinClause]";
};
OuterJoinClause.prototype.toSql = function(store, nparams, params) {
    return [this.side, "OUTER JOIN", this.entities.map(function(entity) {
        return entity.toSql(store, nparams, params);
    }).join(", "), "ON", this.predicate.toSql(store, nparams, params)].join(" ");
};

// range clause
var RangeClause = exports.RangeClause = function(offset, limit) {
    return Object.create(RangeClause.prototype, {
        "offset": {"value": offset || 0, "enumerable": true},
        "limit": {"value": limit || 0, "enumerable": true}
    });
};
RangeClause.prototype.toString = function() {
    return "[RangeClause]";
};


// select clause

var SelectClause = exports.SelectClause = function(list) {
    return Object.create(SelectClause.prototype, {
        "list": {"value": list, "enumerable": true},
        "length": {"get": function() {
                return list.length;
            }, "enumerable": true}
    });
};
SelectClause.prototype = Object.create(Node.prototype);

SelectClause.prototype.toString = function() {
    return "[SelectClause]";
};
SelectClause.prototype.toSql = function(store, nparams, params) {
    return this.list.map(function(sel) {
        return sel.toSqlSelect(store, nparams, params);
    }).join(", ");
};
SelectClause.prototype.isEntityQuery = function() {
    if (this.length === 1) {
        return this.list[0] instanceof Entity;
    }
    return false;
};


// aggregation

var Aggregation = exports.Aggregation = function(type, ident) {
    return Object.create(Aggregation.prototype, {
        "type": {"value": type, "enumerable": true},
        "value": {"value": ident, "enumerable": true}
    });
};
Aggregation.MAX = "MAX";
Aggregation.MIN = "MIN";
Aggregation.SUM = "SUM";
Aggregation.COUNT = "COUNT";
Aggregation.prototype = Object.create(Node.prototype);

Aggregation.prototype.toString = function() {
    return "[" + this.type + " " + this.value + "]";
};

Aggregation.prototype.toSqlSelect = function(store, nparams, params) {
    return [this.type, "(", this.value.toSql(store, nparams, params), ")"].join("");
};


// select

var Select = exports.Select = function(select, from, join, where, groupBy, having, orderBy, range, isDistinct) {
    return Object.create(Select.prototype, {
        "select": {"value": select, "enumerable": true},
        "from": {"value": from, "enumerable": true},
        "join": {"value": join, "enumerable": true},
        "where": {"value": where, "enumerable": true},
        "groupBy": {"value": groupBy, "enumerable": true},
        "having": {"value": having, "enumerable": true},
        "orderBy": {"value": orderBy, "enumerable": true},
        "range": {"value": range, "enumerable": true},
        "isDistinct": {"value": isDistinct === true, "enumerable": true}
    });
};
Select.prototype = Object.create(Node.prototype);

Select.prototype.toString = function() {
    return "[Select]";
};
Select.prototype.toSql = function(store, nparams, params) {
    var sqlBuf = new java.lang.StringBuffer("SELECT");
    if (this.isDistinct === true) {
        sqlBuf.append(" DISTINCT");
    }
    sqlBuf.append(" ").append(this.select.toSql(store, nparams, params));
    for each (let prop in ["from", "join", "where", "groupBy", "having", "orderBy"]) {
        if (this[prop] != null) {
            sqlBuf.append(" ").append(this[prop].toSql(store, nparams, params));
        }
    }
    if (this.range != null) {
        if (this.range.offset > 0 && this.range.limit !== 0) {
            store.dialect.addSqlRange(sqlBuf, this.range.offset, this.range.limit);
        } else if (this.range.offset > 0) {
            store.dialect.addSqlOffset(sqlBuf, this.range.offset);
        } else if (this.range.limit !== 0) {
            store.dialect.addSqlLimit(sqlBuf, this.range.limit);
        }
    }
    return sqlBuf.toString();
};

Select.prototype.isEntityQuery = function() {
    return this.select.isEntityQuery();
};
