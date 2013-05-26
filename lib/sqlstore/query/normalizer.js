/**
 * @fileoverview A query normalizer capable of converting a query AST back into
 * a query string
 */
var Normalizer = exports.Normalizer = function() {
    return this;
};

/** @ignore */
Normalizer.prototype.toString = function() {
    return "[Normalizer]";
};

/**
 * Returns the value of a value node
 * @param {Value} node
 * @returns {String} The value of the node
 */
Normalizer.prototype.visitValue = function(node) {
    return node.value;
};

/**
 * Returns the value of the parameter value, preceded by a colon.
 * @param {ParameterValue} node The parameter value node
 * @returns {String} The parameter value as string
 */
Normalizer.prototype.visitParameterValue = function(node) {
    return ":" + node.value;
};

/**
 * Normalizes the summand node
 * @param {Summand} node The summand node
 * @returns {String} The summand node as string
 */
Normalizer.prototype.visitSummand = function(node) {
    return [node.left.accept(this), node.operand, node.right.accept(this)].join("");
};

/**
 * Normalizes the factor node
 * @param {Summand} node The factor node
 * @returns {String} The factor node as string
 */
Normalizer.prototype.visitFactor = Normalizer.prototype.visitSummand;

/**
 * Returns the name of the entity node
 * @param {Entity} node The entity node
 * @returns {String} The name of the entity
 */
Normalizer.prototype.visitEntity = function(node) {
    return node.name;
};

/**
 * Returns the fully qualified representation of the ident node
 * @param {Ident} node The ident node
 * @returns {String} The string representation (`<EntityName>.<PropertyName>`)
 */
Normalizer.prototype.visitIdent = function(node) {
    return node.entity + "." + node.property;
};

/**
 * Normalizes the comparison node
 * @param {Comparison} node The comparison node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitComparison = function(node) {
    return node.operator + " " + node.value.accept(this);
};

/**
 * Normalizes the condition node
 * @param {Condition} node The condition
 * @returns {String} The string representation
 */
Normalizer.prototype.visitCondition = function(node) {
    var buf = [node.left.accept(this)];
    if (node.right != null) {
        buf.push(node.right.accept(this));
    }
    return buf.join(" ");
};

/**
 * Normalizes the NotCondition node
 * @param {NotCondition} node The "not" condition
 * @returns {String} The string representation
 */
Normalizer.prototype.visitNotCondition = function(node) {
    return "NOT " + node.value.accept(this);
};

/**
 * Normalizes the "exists" condition node
 * @param {ExistsCondition} node The "exists" condition
 * @returns {String} The string representation
 */
Normalizer.prototype.visitExistCondition = function(node) {
    return "EXISTS " + node.select.accept(this);
};

/**
 * Normalizes the "is (not) null" condition node
 * @param {IsNullCondition} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitIsNullCondition = function(node) {
    if (node.isNot === true) {
        return "IS NOT NULL";
    }
    return "IS NULL";
};

/**
 * Normalizes the "between" condition node
 * @param {BetweenCondition} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitBetweenCondition = function(node) {
    return ["BETWEEN", node.start.accept(this),
        "AND", node.end.accept(this)].join(" ");
};

/**
 * Normalizes the "(not) in" condition node
 * @param {InCondition} node The node
 * @returns {String} The string representation
 */
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

/**
 * Normalizes the "like" condition node
 * @param {LikeCondition} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitLikeCondition = function(node) {
    return [(node.isNot === true) ? "NOT LIKE" : "LIKE",
        node.value.accept(this)].join(" ");
};

/**
 * Normalizes the list of conditions
 * @param {ConditionList} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitConditionList = function(node) {
    var str = node.conditions.map(function(condition) {
        return condition.accept(this);
    }, this).join(" AND ");
    if (node.length > 1) {
        return "(" + str + ")";
    }
    return str;
};

/**
 * Normalizes the expression node
 * @param {Expression} node The node
 * @returns {String} The string representation
 */
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

/**
 * Normalizes the "having" clause node
 * @param {HavingClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitHavingClause = function(node) {
    return "HAVING " + node.value.accept(this);
};

/**
 * Normalizes the "order by" node
 * @param {OrderBy} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitOrderBy = function(node) {
    return node.value.accept(this) + " " +
        ((node.isReverse) ? "DESC" : "ASC");
};

/**
 * Normalizes the "order by" clause node
 * @param {OrderByClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitOrderByClause = function(node) {
    return "ORDER BY " + node.list.map(function(orderby) {
        return orderby.accept(this);
    }, this).join(", ");
};

/**
 * Normalizes the "group by" clause node
 * @param {GroupByClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitGroupByClause = function(node) {
    return "GROUP BY " + node.list.map(function(ident) {
        return ident.accept(this);
    }, this).join(", ");
};

/**
 * Normalizes the "where" clause node
 * @param {WhereClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitWhereClause = function(node) {
    return "WHERE " + node.value.accept(this);
};

/**
 * Normalizes the "from" clause node
 * @param {FromClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitFromClause = function(node) {
    return "FROM " + node.list.map(function(entity) {
        return entity.accept(this);
    }, this).join(", ");
};

/**
 * Normalizes the "join" clause node
 * @param {JoinClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitJoinClause = function(node) {
    return node.list.map(function(join) {
        return join.accept(this);
    }, this).join(", ");
};

/**
 * Normalizes the "inner join" node
 * @param {InnerJoin} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitInnerJoin = function(node) {
    return [
        "INNER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

/**
 * Normalizes the "outer join" clause node
 * @param {OuterJoin} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitOuterJoin = function(node) {
    return [
        node.side, "OUTER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

/**
 * Normalizes the range clause node
 * @param {RangeClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitRangeClause = function(node) {
    if (node.offset > 0 && node.limit !== 0) {
        return "OFFSET " + node.offset + " LIMIT " + node.limit;
    } else if (node.offset > 0) {
        return "OFFSET " + node.offset;
    } else if (node.limit !== 0) {
        return "LIMIT " + node.limit;
    }
};

/**
 * Normalizes the select clause node
 * @param {SelectClause} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitSelectClause = function(node) {
    return node.list.map(function(child) {
        return child.accept(this);
    }, this).join(", ");
};

/**
 * Normalizes the select expression node
 * @param {SelectExpression} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitSelectExpression = function(node) {
    return node.expression.accept(this);
};

/**
 * Normalizes the select entity node
 * @param {SelectEntity} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitSelectEntity = function(node) {
    return node.name;
};

/**
 * Normalizes an aggregation node
 * @param {Aggregation} node The node
 * @returns {String} The string representation
 */
Normalizer.prototype.visitAggregation = function(node) {
    var buf = [node.type, "("];
    if (node.isDistinct === true) {
        buf.push("DISTINCT ");
    }
    buf.push(node.value.accept(this), ")");
    return buf.join("");
};

/**
 * Normalizes the select query
 * @param {Select} node The node
 * @returns {String} The string representation
 */
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
