var SqlGenerator = exports.SqlGenerator = function(store, aliases, nparams) {
    Object.defineProperties(this, {
        "store": {"value": store},
        "aliases": {"value": aliases || {}},
        "params": {"value": []},
        "nparams": {"value": nparams || {}}
    });
    return this;
};
SqlGenerator.prototype.toString = function() {
    return "[SqlGenerator]";
};

SqlGenerator.prototype.getEntityMapping = function(name) {
    return this.store.getEntityMapping(this.aliases[name] || name);
};

SqlGenerator.prototype.visitValue = function(node) {
    this.params.push({
        "type": node.type,
        "value": node.value
    });
    return "?";
};

SqlGenerator.prototype.visitParameterValue = function(node) {
    if (this.nparams[node.value] === undefined) {
        throw new Error("Named parameter '" + node.value + "' is undefined");
    }
    var value = this.nparams[node.value];
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
    this.params.push({
        "type": type,
        "value": value
    });
    return "?";
};

SqlGenerator.prototype.visitEntity = function(node) {
    return node.getEntityMapping(this).getQualifiedTableName(this.store.dialect);
};

SqlGenerator.prototype.visitIdent = function(node) {
    return node.getPropertyMapping(this).getQualifiedColumnName(this.store.dialect);
};

SqlGenerator.prototype.visitAliasIdent = function(node) {
    var mapping = node.getPropertyMapping(this);
    return node.alias + "." + this.store.dialect.quote(mapping.column);
};

SqlGenerator.prototype.visitAliasEntity = function(node) {
    if (node.loadAggressive === true) {
        return node.alias + ".*";
    }
    var mapping = node.getPropertyMapping(this);
    return node.alias + "." + this.store.dialect.quote(mapping.column);
};

SqlGenerator.prototype.visitComparison = function(node) {
    return node.operator + " " + node.value.accept(this);
};

SqlGenerator.prototype.visitCondition = function(node) {
    var buf = [node.left.accept(this)];
    if (node.right != null) {
        buf.push(node.right.accept(this));
    }
    return buf.join(" ");
};
SqlGenerator.prototype.visitNotCondition = function(node) {
    return "NOT " + node.value.accept(this);
};

SqlGenerator.prototype.visitExistCondition = function(node) {
    return "EXISTS " + node.select.accept(this);
};

SqlGenerator.prototype.visitIsNullCondition = function(node) {
    if (node.isNot === true) {
        return "IS NOT NULL";
    }
    return "IS NULL";
};

SqlGenerator.prototype.visitBetweenCondition = function(node) {
    return ["BETWEEN", node.start.accept(this),
        "AND", node.end.accept(this)].join(" ");
};

SqlGenerator.prototype.visitInCondition = function(node) {
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

SqlGenerator.prototype.visitLikeCondition = function(node) {
    return [(node.isNot === true) ? "NOT LIKE" : "LIKE",
        node.value.accept(this)].join(" ");
};

SqlGenerator.prototype.visitConditionList = function(node) {
    var str = node.conditions.map(function(condition) {
        return condition.accept(this);
    }, this).join(" AND ");
    if (node.length > 1) {
        return "(" + str + ")";
    }
    return str;
};

SqlGenerator.prototype.visitExpression = function(node) {
    var buf = [node.andConditions.accept(this)];
    if (node.orConditions != undefined && node.orConditions.length > 0) {
        buf.push(node.orConditions.accept(this));
    }
    if (buf.length > 1) {
        return "(" + buf.join(" OR ") + ")";
    }
    return buf.join(" OR ");
};

SqlGenerator.prototype.visitHavingClause = function(node) {
    return "HAVING " + node.value.accept(this);
};

SqlGenerator.prototype.visitOrderBy = function(node) {
    return node.value.accept(this) + " " +
        ((node.isReverse) ? "DESC" : "ASC");
};

SqlGenerator.prototype.visitOrderByClause = function(node) {
    return "ORDER BY " + node.list.map(function(orderby) {
        return orderby.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitGroupByClause = function(node) {
    return "GROUP BY " + node.list.map(function(ident) {
        return ident.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitWhereClause = function(node) {
    return "WHERE " + node.value.accept(this);
};

SqlGenerator.prototype.visitFromClause = function(node) {
    return "FROM " + node.list.map(function(expression) {
        return expression.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitFromExpression = function(node) {
    var buf = [node.entity.accept(this)];
    if (node.alias != null) {
        buf.push("AS", node.alias);
    }
    return buf.join(" ");
};

SqlGenerator.prototype.visitInnerJoinClause = function(node) {
    return ["INNER JOIN", node.entities.map(function(entity) {
            return entity.accept(this);
        }, this).join(", "),
        "ON",
        node.predicate.accept(this)
    ].join(" ");
};

SqlGenerator.prototype.visitOuterJoinClause = function(node) {
    return [node.side, "OUTER JOIN", node.entities.map(function(entity) {
            return entity.accept(this);
        }, this).join(", "),
        "ON",
        node.predicate.accept(this)
    ].join(" ");
};

SqlGenerator.prototype.visitRangeClause = function(node) {
    if (node.offset > 0 && node.limit !== 0) {
        this.store.dialect.addSqlRange(this.buffer, node.offset, node.limit);
    } else if (node.offset > 0) {
        this.store.dialect.addSqlOffset(this.buffer, node.offset);
    } else if (node.limit !== 0) {
        this.store.dialect.addSqlLimit(this.buffer, node.limit);
    }
};

SqlGenerator.prototype.visitSelectClause = function(node) {
    return node.list.map(function(child) {
        return child.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitSelectEntity = function(node) {
    var mapping = node.getEntityMapping(this);
    if (node.loadAggressive === true) {
        return mapping.getQualifiedTableName(this.store.dialect) + ".*";
    }
    return mapping.getQualifiedColumnName(node.property, this.store.dialect);
};

SqlGenerator.prototype.visitSelectExpression = function(node) {
    var buf = [node.expression.accept(this)];
    if (node.alias != null) {
        buf.push("AS", node.alias);
    }
    return buf.join(" ");
};

SqlGenerator.prototype.visitAggregation = function(node) {
    return [node.type, "(", node.value.accept(this), ")"].join("");
};

SqlGenerator.prototype.visitSelect = function(node) {
    var buffer = new java.lang.StringBuffer();
    buffer.append("SELECT");
    if (node.isDistinct === true) {
        buffer.append(" DISTINCT");
    }
    buffer.append(" ");
    buffer.append(node.select.accept(this));
    for each (let prop in ["from", "join", "where", "groupBy", "having", "orderBy"]) {
        if (node[prop] != null) {
            buffer.append(" ");
            buffer.append(node[prop].accept(this));
        }
    }
    if (node.range != null) {
        if (node.range.offset > 0 && node.range.limit !== 0) {
            this.store.dialect.addSqlRange(buffer, node.range.offset, node.range.limit);
        } else if (node.range.offset > 0) {
            this.store.dialect.addSqlOffset(buffer, node.range.offset);
        } else if (node.range.limit !== 0) {
            this.store.dialect.addSqlLimit(buffer, node.range.limit);
        }
    }
    return buffer.toString();
};
