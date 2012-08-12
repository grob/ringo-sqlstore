var Normalizer = exports.Normalizer = function() {
    return this;
};

Normalizer.prototype.toString = function() {
    return "[Normalizer]";
};

Normalizer.prototype.visitValue = function(node) {
    return node.value;
};

Normalizer.prototype.visitParameterValue = function(node) {
    return ":" + node.value;
};

Normalizer.prototype.visitSummand = function(node) {
    return [node.left.accept(this), node.operand, node.right.accept(this)].join("");
};

Normalizer.prototype.visitFactor = Normalizer.prototype.visitSummand;

Normalizer.prototype.visitEntity = function(node) {
    return node.name;
};

Normalizer.prototype.visitIdent = function(node) {
    return node.entity + "." + node.property;
};

Normalizer.prototype.visitComparison = function(node) {
    return node.operator + " " + node.value.accept(this);
};

Normalizer.prototype.visitCondition = function(node) {
    var buf = [node.left.accept(this)];
    if (node.right != null) {
        buf.push(node.right.accept(this));
    }
    return buf.join(" ");
};
Normalizer.prototype.visitNotCondition = function(node) {
    return "NOT " + node.value.accept(this);
};

Normalizer.prototype.visitExistCondition = function(node) {
    return "EXISTS " + node.select.accept(this);
};

Normalizer.prototype.visitIsNullCondition = function(node) {
    if (node.isNot === true) {
        return "IS NOT NULL";
    }
    return "IS NULL";
};

Normalizer.prototype.visitBetweenCondition = function(node) {
    return ["BETWEEN", node.start.accept(this),
        "AND", node.end.accept(this)].join(" ");
};

Normalizer.prototype.visitInCondition = function(node) {
    var buf = ["IN ("];
    if (node.values instanceof Array) {
        buf.push(node.values.map(function(value) {
            return value.accept(this);
        }, this).join(", "));
    } else {
        buf.push(node.values.accept(this));
    }
    buf.push(")");
    return buf.join("");
};

Normalizer.prototype.visitLikeCondition = function(node) {
    return [(node.isNot === true) ? "NOT LIKE" : "LIKE",
        node.value.accept(this)].join(" ");
};

Normalizer.prototype.visitConditionList = function(node) {
    var str = node.conditions.map(function(condition) {
        return condition.accept(this);
    }, this).join(" AND ");
    if (node.length > 1) {
        return "(" + str + ")";
    }
    return str;
};

Normalizer.prototype.visitExpression = function(node) {
    var buf = [node.andConditions.accept(this)];
    if (node.orConditions != undefined && node.orConditions.length > 0) {
        buf.push(node.orConditions.accept(this));
    }
    if (buf.length > 1) {
        return "(" + buf.join(" OR ") + ")";
    }
    return buf.join(" OR ");
};

Normalizer.prototype.visitHavingClause = function(node) {
    return "HAVING " + node.value.accept(this);
};

Normalizer.prototype.visitOrderBy = function(node) {
    return node.value.accept(this) + " " +
        ((node.isReverse) ? "DESC" : "ASC");
};

Normalizer.prototype.visitOrderByClause = function(node) {
    return "ORDER BY " + node.list.map(function(orderby) {
        return orderby.accept(this);
    }, this).join(", ");
};

Normalizer.prototype.visitGroupByClause = function(node) {
    return "GROUP BY " + node.list.map(function(ident) {
        return ident.accept(this);
    }, this).join(", ");
};

Normalizer.prototype.visitWhereClause = function(node) {
    return "WHERE " + node.value.accept(this);
};

Normalizer.prototype.visitFromClause = function(node) {
    return "FROM " + node.list.map(function(entity) {
        return entity.accept(this);
    }, this).join(", ");
};

Normalizer.prototype.visitJoinClause = function(node) {
    return node.list.map(function(join) {
        return join.accept(this);
    }, this).join(", ");
};

Normalizer.prototype.visitInnerJoin = function(node) {
    return [
        "INNER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

Normalizer.prototype.visitOuterJoin = function(node) {
    return [
        node.side, "OUTER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

Normalizer.prototype.visitRangeClause = function(node) {
    if (node.offset > 0 && node.limit !== 0) {
        return "OFFSET " + node.offset + " LIMIT " + node.limit;
    } else if (node.offset > 0) {
        return "OFFSET " + node.offset;
    } else if (node.limit !== 0) {
        return "LIMIT " + node.limit;
    }
};

Normalizer.prototype.visitSelectClause = function(node) {
    return node.list.map(function(child) {
        return child.accept(this);
    }, this).join(", ");
};

Normalizer.prototype.visitSelectExpression = function(node) {
    return node.expression.accept(this);
};

Normalizer.prototype.visitSelectEntity = function(node) {
    return node.name;
};

Normalizer.prototype.visitAggregation = function(node) {
    var buf = [node.type, "("];
    if (node.isDistinct === true) {
        buf.push("DISTINCT ");
    }
    buf.push(node.value.accept(this), ")");
    return buf.join("");
};

Normalizer.prototype.visitSelect = function(node) {
    var buf = ["SELECT"];
    if (node.isDistinct === true) {
        buf.push(" DISTINCT");
    }
    buf.push(" ", node.select.accept(this));
    for each (let prop in ["from", "join", "where", "groupBy", "having", "orderBy", "range"]) {
        if (node[prop] != null) {
            buf.push(" ", node[prop].accept(this));
        }
    }
    return buf.join("");
};
