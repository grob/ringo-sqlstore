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

SqlGenerator.prototype.isAliased = function(name) {
    return this.aliases.hasOwnProperty(name);
};

SqlGenerator.prototype.getEntityMapping = function(name) {
    return this.store.getEntityMapping(this.aliases[name] || name);
};

SqlGenerator.prototype.getPropertyMapping = function(name, property) {
    return this.getEntityMapping(name).getMapping(property);
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
    } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
        type = (value % 1 === 0) ? "long" : "double";
    } else if (value instanceof Date) {
        type = "timestamp";
    } else if (value._key != null && value._id != null) {
        type = "long";
        value = value._id
    }
    this.params.push({
        "type": type,
        "value": value
    });
    return "?";
};

SqlGenerator.prototype.visitSummand = function(node) {
    return ["(",
        node.left.accept(this), " ", node.operand, " ", node.right.accept(this),
    ")"].join("");
};

SqlGenerator.prototype.visitFactor = SqlGenerator.prototype.visitSummand;

SqlGenerator.prototype.visitEntity = function(node) {
    var mapping = this.getEntityMapping(node.name);
    var result = mapping.getQualifiedTableName(this.store.dialect);
    if (node.alias) {
        result += " " + node.alias;
    }
    return result;
};

SqlGenerator.prototype.visitIdent = function(node) {
    var propMapping = this.getPropertyMapping(node.entity, node.property || "id");
    var alias = this.isAliased(node.entity) ? node.entity : null;
    return propMapping.getQualifiedColumnName(this.store.dialect, alias);
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
    return [(node.isNot === true) ? "NOT BETWEEN" : "BETWEEN",
        node.start.accept(this), "AND", node.end.accept(this)].join(" ");
};

SqlGenerator.prototype.visitInCondition = function(node) {
    var buf = [(node.isNot === true) ? "NOT IN (" : "IN ("];
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
    var buf = [node.value.accept(this)];
    if (node.isReverse) {
        buf.push("DESC");
    } else {
        buf.push("ASC");
    }
    if (node.nulls !== null) {
        buf.push("NULLS");
        if (node.nulls < 0) {
            buf.push("FIRST");
        } else if (node.nulls > 0) {
            buf.push("LAST");
        }
    }
    return buf.join(" ");
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
    return "FROM " + node.list.map(function(entity) {
        return entity.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitJoinClause = function(node) {
    return node.list.map(function(join) {
        return join.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitInnerJoin = function(node) {
    return [
        "INNER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

SqlGenerator.prototype.visitOuterJoin = function(node) {
    return [
        node.side, "OUTER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

SqlGenerator.prototype.visitSelectClause = function(node) {
    return node.list.map(function(child) {
        return child.accept(this);
    }, this).join(", ");
};

SqlGenerator.prototype.visitSelectExpression = function(node) {
    return node.expression.accept(this);
};

SqlGenerator.prototype.visitSelectEntity = function(node) {
    var mapping = this.getEntityMapping(node.name);
    var dialect = this.store.dialect;
    var alias = this.isAliased(node.name) ? node.name : null;
    var buf = [];
    for each (let propMapping in mapping.columns) {
        if (!propMapping.isCollectionMapping()) {
            buf.push(propMapping.getQualifiedColumnName(dialect, alias));
        }
    }
    return buf.join(", ");
};

SqlGenerator.prototype.visitAggregation = function(node) {
    var buf = [node.type, "("];
    if (node.isDistinct === true) {
        buf.push("DISTINCT ");
    }
    buf.push(node.value.accept(this), ")");
    return buf.join("");
};

SqlGenerator.prototype.visitSelect = function(node) {
    var buf = ["SELECT"];
    if (node.isDistinct === true) {
        buf.push(" DISTINCT");
    }
    buf.push(" ", node.select.accept(this));
    for each (let prop in ["from", "join", "where", "groupBy", "having", "orderBy"]) {
        if (node[prop] != null) {
            buf.push(" ", node[prop].accept(this));
        }
    }
    if (node.range != null) {
        var offset = !isNaN(node.range.offset) ?
                node.range.offset : node.range.offset.accept(this);
        var limit = !isNaN(node.range.limit) ?
                node.range.limit : node.range.limit.accept(this);
        if (offset && limit) {
            this.store.dialect.addSqlRange(buf, offset, limit);
        } else if (offset) {
            this.store.dialect.addSqlOffset(buf, offset);
        } else if (limit) {
            this.store.dialect.addSqlLimit(buf, limit);
        }
    }
    return buf.join("");
};
