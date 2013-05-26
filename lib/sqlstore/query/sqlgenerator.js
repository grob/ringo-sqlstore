/**
 * @fileoverview Provides an SqlGenerator constructor capable of converting
 * a query AST into a raw SQL query suitable for the underlying database.
 */

/**
 * Creates a new SqlGenerator instance
 * @class Instances of this class are capable of converting a query AST into
 * a raw SQL query string.
 * @param {Store} store The store to operate on
 * @param {Object} aliases The entity aliases referenced in the "from" clause
 * of the query, if any
 * @returns A newly created SqlGenerator instance
 * @constructor
 */
var SqlGenerator = exports.SqlGenerator = function(store, aliases) {
    Object.defineProperties(this, {
        /**
         * The store this generatore operates on
         * @type Store
         */
        "store": {"value": store},
        /**
         * An object containing entity aliases as property names and the
         * entity name as values
         * @type Object
         */
        "aliases": {"value": aliases || {}},
        /**
         * An array containing the descriptors of values specified in the query.
         * @type Array
         */
        "params": {"value": []}
    });
    return this;
};

/** @ignore */
SqlGenerator.prototype.toString = function() {
    return "[SqlGenerator]";
};

/**
 * Returns true if the name passed as argument is an alias for an entity
 * @param {String} name The entity name
 * @returns {Boolean} True if an alias for this entity has been defined in
 * the query, false otherwise
 */
SqlGenerator.prototype.isAliased = function(name) {
    return this.aliases.hasOwnProperty(name);
};

/**
 * Returns the mapping for the entity with the given name
 * @param {String} name The entity name or it's alias
 * @returns {Mapping} The mapping for the entity
 */
SqlGenerator.prototype.getEntityMapping = function(name) {
    return this.store.getEntityMapping(this.aliases[name] || name);
};

/**
 * Returns the mapping for the given property
 * @param {String} name The entity name or it's alias
 * @param {String} property The property name
 * @returns {PrimitiveMapping|ObjectMapping|CollectionMapping} The property mapping
 */
SqlGenerator.prototype.getPropertyMapping = function(name, property) {
    return this.getEntityMapping(name).getMapping(property);
};

/**
 * Pushes the value descriptor (an object containing the type of the value and
 * the value itself) into the `params` array of this generator, and returns a
 * question mark as placeholder for the parameter in the SQL query.
 * @param {Value} node The value node
 * @returns {String} A question mark
 */
SqlGenerator.prototype.visitValue = function(node) {
    this.params.push({
        "type": node.type,
        "value": node.value
    });
    return "?";
};

/**
 * Pushes the name of the named parameter referenced in the query (`:<name>`)
 * into the internal `params` array and returns a question mark as placeholder
 * for the parameter in the SQL query
 * @param {ParameterValue} node The parameter value node
 * @returns {String} A question mark
 */
SqlGenerator.prototype.visitParameterValue = function(node) {
    this.params.push(node.value);
    return "?";
};

/**
 * Returns the SQL representation of the summand passed as argument
 * @param {Summand} node The summand node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitSummand = function(node) {
    return ["(",
        node.left.accept(this), " ", node.operand, " ", node.right.accept(this),
    ")"].join("");
};

/**
 * Returns the SQL representation of the factor passed as argument
 * @param {Factor} node The factor node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitFactor = SqlGenerator.prototype.visitSummand;

/**
 * Returns the SQL representation (`[<SchemaName>.]<TableName>[ <alias>]`) of
 * the entity passed as argument.
 * @param {Entity} node The entity node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitEntity = function(node) {
    var mapping = this.getEntityMapping(node.name);
    var result = mapping.getQualifiedTableName(this.store.dialect);
    if (node.alias) {
        result += " " + node.alias;
    }
    return result;
};

/**
 * Returns the SQL representation (`<TableName|alias>.<ColumnName>`) of the
 * ident passed as argument.
 * @param {Ident} node The ident node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitIdent = function(node) {
    var propMapping = this.getPropertyMapping(node.entity, node.property || "id");
    var alias = this.isAliased(node.entity) ? node.entity : null;
    return propMapping.getQualifiedColumnName(this.store.dialect, alias);
};

/**
 * Returns the SQL representation of the comparison passed as argument
 * @param {Comparison} node The comparison node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitComparison = function(node) {
    return node.operator + " " + node.value.accept(this);
};

/**
 * Returns the SQL representation of the condition passed as argument
 * @param {Condition} node The condition node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitCondition = function(node) {
    var buf = [node.left.accept(this)];
    if (node.right != null) {
        buf.push(node.right.accept(this));
    }
    return buf.join(" ");
};

/**
 * Returns the SQL representation of the "not" condition passed as argument
 * @param {NotCondition} node The "not" condition node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitNotCondition = function(node) {
    return "NOT " + node.value.accept(this);
};

/**
 * Returns the SQL representation of the "exists" condition passed as argument
 * @param {ExistsCondition} node The "exists" condition node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitExistCondition = function(node) {
    return "EXISTS " + node.select.accept(this);
};

/**
 * Returns the SQL representation of the "(not) null" condition passed as argument
 * @param {NullCondition} node The node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitIsNullCondition = function(node) {
    if (node.isNot === true) {
        return "IS NOT NULL";
    }
    return "IS NULL";
};

/**
 * Returns the SQL representation of the "between" condition passed as argument
 * @param {BetweenCondition} node The "between" condition node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitBetweenCondition = function(node) {
    return [(node.isNot === true) ? "NOT BETWEEN" : "BETWEEN",
        node.start.accept(this), "AND", node.end.accept(this)].join(" ");
};

/**
 * Returns the SQL representation of the "in" condition passed as argument
 * @param {InCondition} node The "in" condition node
 * @returns {String} The SQL representation
 */
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

/**
 * Returns the SQL representation of the "like" condition passed as argument
 * @param {LikeCondition} node The "like" condition node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitLikeCondition = function(node) {
    return [(node.isNot === true) ? "NOT LIKE" : "LIKE",
        node.value.accept(this)].join(" ");
};

/**
 * Returns the SQL representation of the condition list passed as argument
 * @param {ConditionList} node The condition list node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitConditionList = function(node) {
    var str = node.conditions.map(function(condition) {
        return condition.accept(this);
    }, this).join(" AND ");
    if (node.length > 1) {
        return "(" + str + ")";
    }
    return str;
};

/**
 * Returns the SQL representation of the expression passed as argument
 * @param {Expression} node The expression node
 * @returns {String} The SQL representation
 */
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

/**
 * Returns the SQL representation of the "having" clause passed as argument
 * @param {HavingClause} node The "having" clause node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitHavingClause = function(node) {
    return "HAVING " + node.value.accept(this);
};

/**
 * Returns the SQL representation of the "order by" passed as argument
 * @param {OrderBy} node The "order by" node
 * @returns {String} The SQL representation
 */
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

/**
 * Returns the SQL representation of the "order by" clause passed as argument
 * @param {OrderByClause} node The "order by" clause node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitOrderByClause = function(node) {
    return "ORDER BY " + node.list.map(function(orderby) {
        return orderby.accept(this);
    }, this).join(", ");
};

/**
 * Returns the SQL representation of the "group by" clause passed as argument
 * @param {GroupByClause} node The "group by" clause node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitGroupByClause = function(node) {
    return "GROUP BY " + node.list.map(function(ident) {
        return ident.accept(this);
    }, this).join(", ");
};

/**
 * Returns the SQL representation of the "where" clause passed as argument
 * @param {WhereClause} node The "where clause" node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitWhereClause = function(node) {
    return "WHERE " + node.value.accept(this);
};

/**
 * Returns the SQL representation of the "from" clause passed as argument
 * @param {FromClause} node The "from" clause node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitFromClause = function(node) {
    return "FROM " + node.list.map(function(entity) {
        return entity.accept(this);
    }, this).join(", ");
};

/**
 * Returns the SQL representation of the "join" clause passed as argument
 * @param {JoinClause} node The "join clause" node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitJoinClause = function(node) {
    return node.list.map(function(join) {
        return join.accept(this);
    }, this).join(", ");
};

/**
 * Returns the SQL representation of the "inner join" passed as argument
 * @param {InnerJoin} node The "inner join" node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitInnerJoin = function(node) {
    return [
        "INNER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

/**
 * Returns the SQL representation of the "outer join" passed as argument
 * @param {OuterJoin} node The "outer join" node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitOuterJoin = function(node) {
    return [
        node.side, "OUTER JOIN",
        node.entity.accept(this),
        "ON", node.predicate.accept(this)
    ].join(" ");
};

/**
 * Returns the SQL representation of the "select" clause passed as argument
 * @param {SelectClause} node The "select" clause node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitSelectClause = function(node) {
    return node.list.map(function(child) {
        return child.accept(this);
    }, this).join(", ");
};

/**
 * Returns the SQL representation of the select expression passed as argument
 * @param {SelectExpression} node The select expression node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitSelectExpression = function(node) {
    return node.expression.accept(this);
};

/**
 * Returns the SQL representation of the select entity passed as argument (i.e.
 * an entity referenced in the select clause)
 * @param {SelectEntity} node The select entity node
 * @returns {String} The SQL representation
 */
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

/**
 * Returns the SQL representation of the aggregation passed as argument
 * @param {Aggregation} node The aggregation node
 * @returns {String} The SQL representation
 */
SqlGenerator.prototype.visitAggregation = function(node) {
    var buf = [node.type, "("];
    if (node.isDistinct === true) {
        buf.push("DISTINCT ");
    }
    buf.push(node.value.accept(this), ")");
    return buf.join("");
};

/**
 * Returns the SQL representation of the select statement passed as argument
 * @param {Select} node The select node (i.e. the root node of the query AST)
 * @returns {String} The SQL representation
 */
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

/**
 * Creates a function suitable for generating a raw SQL query based on the
 * AST passed as argument. This function is cached together with the AST it's
 * based on in the store's query cache.
 * @param {Node} ast The query AST as produced by the query parser
 * @returns {Function} The SQL generator function
 */
SqlGenerator.prototype.createSqlFunction = function(ast) {
    var sql = ast.accept(this);
    var buf = ["return ["];
    buf.push("\"" + sql.replace(/"/g, "\\\"") + "\",");
    buf.push("[" + this.params.map(function(param) {
        if (typeof(param) === "string") {
            return "getNamedParameter(nparams, \"" + param + "\")";
        }
        return param.toSource();
    }).join(", ") + "]");
    buf.push("];");
    return new Function("nparams", "getNamedParameter", buf.join("\n"));
};

/**
 * Convenience method for creating the raw SQL query generator function
 * @param {Store} store The store to operate on
 * @param {Node} ast The query AST
 * @returns {Function} The SQL generator function
 * @see #SqlGenerator.prototype.createSqlFunction
 */
SqlGenerator.createSqlFunction = function(store, ast) {
    var generator = new SqlGenerator(store, ast.aliases);
    return generator.createSqlFunction(ast);
};