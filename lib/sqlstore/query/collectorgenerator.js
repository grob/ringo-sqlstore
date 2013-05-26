/**
 * @fileoverview A module for creating select result set collectors
 */
var {createCacheKey} = require("../cache");
var {Key} = require("../key");
var {Normalizer} = require("./normalizer");

/**
 * Creates an Array of collector instances for the query AST passed as argument.
 * @param {Store} store The store to operate on
 * @param {Select} ast The query AST
 * @returns {Array} An array containing collector instances for all select
 * expressions in a query.
 */
exports.createCollector = function(store, ast) {
    if (ast.select.list.length === 1) {
        return getCollector(store, ast.aliases, ast.select.get(0), 1);
    }
    var offset = 1;
    return ast.select.list.map(function(selectExpression) {
        var collector = getCollector(store, ast.aliases, selectExpression, offset);
        offset += collector.columnCnt;
        return collector;
    }, this);
};

var getEntityMapping = function(store, aliases, name) {
    return store.getEntityMapping(aliases[name] || name);
};

var getPropertyMapping = function(store, aliases, name, property) {
    return getEntityMapping(store, aliases, name).getMapping(property);
};

/**
 * Creates the appropriate collector for the query AST select expression passed
 * as argument.
 * @param {Store} store The store to operate on
 * @param {Array} aliases An array containing the aliases in the query
 * @param {SelectExpression} selectExpression The select expression
 * @param {Number} offset The 1-based column offset of the select expression
 * @returns {EntityCollector|AggressiveEntityCollector|PropertyCollector|ValueCollector} The collector
 */
var getCollector = function(store, aliases, selectExpression, offset) {
    var node = selectExpression.expression;
    if (node.constructor.name === "SelectEntity") {
        return new AggressiveEntityCollector(getEntityMapping(store, aliases, node.name),
                offset, selectExpression.alias);
    } else if (node.constructor.name === "Ident") {
        if (node.property === null) {
            return new EntityCollector(getEntityMapping(store, aliases, node.entity),
                    offset, selectExpression.alias);
        }
        return new PropertyCollector(getPropertyMapping(store, aliases, node.entity, node.property),
                offset, selectExpression.alias);
    }
    return new ValueCollector(offset, selectExpression.alias ||
                selectExpression.accept(new Normalizer()));
};

/**
 * Creates a new EntityCollector instance
 * @class Instances of this class are capable to retrieve the ID of an entity
 * from a query result set and create the appropriate entity instance (resp.
 * fetch it from the entity cache if defined).
 * @param {Mapping} mapping The entity mapping
 * @param {Number} columnIdx The 1-based index position of the entity ID to
 * collect within a result set
 * @param {String} alias Optional alias for the selected entity
 * @returns A newly created EntityCollector instance
 * @constructor
 */
var EntityCollector = function EntityCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        /**
         * Contains the mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the column offset index (1-based)
         * @type Number
         */
        "columnIdx": {"value": columnIdx, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1)
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
EntityCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

/**
 * Collects the entity from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Store} store The store to operate on
 * @returns The entity
 */
EntityCollector.prototype.collect = function(resultSet, metaData, store) {
    var id = this.mapping.id.jdbcType.get(resultSet, this.columnIdx);
    var cacheKey = createCacheKey(this.mapping.type, id);
    var transaction = store.getTransaction();
    var useCache = store.entityCache &&
            (!transaction || !transaction.containsKey(cacheKey));
    var key = null;
    var entity = null;
    if (useCache && store.entityCache.containsKey(cacheKey)) {
        [key, entity] = store.entityCache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        if (useCache) {
            store.entityCache.put(cacheKey, [key, entity]);
        }
    }
    return store.create(this.mapping.type, key, entity);
};

/**
 * Returns the name of the result object property for the collected entity, which
 * is either the alias of the entity if defined in the query or the name of the
 * entity.
 * @returns {String} The name of the result object property
 */
EntityCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.type;
};

/**
 * Creates a new AggressiveEntityCollector instance
 * @class Instances of this class are capable to retrieve all mapped properties
 * of an entity from a query result set and create the appropriate entity instance
 * (resp. fetch it from the entity cache if defined).
 * @param {Mapping} mapping The entity mapping
 * @param {Number} columnIdx The 1-based offset of the entity properties to
 * collect within a result set
 * @param {String} alias Optional alias for the selected entity
 * @returns A newly created AggressiveEntityCollector instance
 * @constructor
 */
var AggressiveEntityCollector = function AggressiveEntityCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        /**
         * The mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the column offset index (1-based)
         * @type Number
         */
        "columnIdx": {"value": columnIdx, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle.
         * @type Number
         */
        "columnCnt": {"value": Object.keys(mapping.columns).length, "enumerable": true}
    });
    return this;
};

/** @ignore */
AggressiveEntityCollector.prototype.toString = function() {
    return "[AggressiveEntityCollector]";
};

/**
 * Collects the entity from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Store} store The store to operate on
 * @returns The entity
 */
AggressiveEntityCollector.prototype.collect = function(resultSet, metaData, store) {
    var id = this.mapping.id.jdbcType.get(resultSet, this.columnIdx);
    var useCache = store.entityCache !== null;
    var cacheKey = null;
    if (useCache === true) {
        cacheKey = createCacheKey(this.mapping.type, id);
        var transaction = store.getTransaction();
        useCache = !transaction || !transaction.containsKey(cacheKey);
    }
    var key = null;
    var entity = null;
    if (useCache && store.entityCache.containsKey(cacheKey)) {
        [key, entity] = store.entityCache.get(cacheKey);
    } else {
        key = new Key(this.mapping.type, id);
        entity = {};
        entity[this.mapping.id.column] = id;
        var columnIdx = this.columnIdx + 1;
        for each (let propMapping in this.mapping.columns) {
            if (propMapping === this.mapping.id) {
                continue;
            }
            entity[propMapping.column] = propMapping.jdbcType.get(resultSet, columnIdx++);
        }
        if (useCache) {
            store.entityCache.put(cacheKey, [key, entity]);
        }
    }
    return store.create(this.mapping.type, key, entity);
};

/**
 * Returns the name of the result object property for the collected entity, which
 * is either the alias of the entity if defined in the query or the name of the
 * entity.
 * @returns {String} The name of the result object property
 */
AggressiveEntityCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.type;
};

/**
 * Creates a new PropertyCollector instance
 * @class Instances of this class are capable to retrieve a single property
 * of an entity from a query result set and return it.
 * @param {Mapping} mapping The entity mapping
 * @param {Number} columnIdx The 1-based offset of the entity property to
 * collect within a result set
 * @param {String} alias Optional alias for the selected property
 * @returns A newly created PropertyCollector instance
 * @constructor
 */
var PropertyCollector = function PropertyCollector(mapping, columnIdx, alias) {
    Object.defineProperties(this, {
        /**
         * The mapping of this collector
         * @type Mapping
         */
        "mapping": {"value": mapping, "enumerable": true},
        /**
         * Contains the column offset index (1-based)
         * @type Number
         */
        "columnIdx": {"value": columnIdx, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1).
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
PropertyCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

/**
 * Collects the entity property value from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Store} store The store to operate on
 * @returns The entity property value
 */
PropertyCollector.prototype.collect = function(resultSet, metaData, store) {
    return this.mapping.jdbcType.get(resultSet, this.columnIdx);
};

/**
 * Returns the name of the result object property for the collected property, which
 * is either the alias of the property if defined in the query or the fully
 * qualified property name (`<EntityName>.<PropertyName>`).
 * @returns {String} The name of the result object property
 */
PropertyCollector.prototype.getResultPropertyName = function() {
    return this.alias || this.mapping.mapping.type + "." + this.mapping.name;
};


/**
 * Creates a new ValueCollector instance
 * @class Instances of this class are capable to retrieve a single value from a
 * query result set and return it.
 * @param {Number} columnIdx The 1-based offset of the value to collect within
 * a result set
 * @param {String} alias The alias for the selected value
 * @returns A newly created PropertyCollector instance
 * @constructor
 */
var ValueCollector = function ValueCollector(columnIdx, alias) {
    Object.defineProperties(this, {
        /**
         * Contains the column offset index (1-based)
         * @type Number
         */
        "columnIdx": {"value": columnIdx, "enumerable": true},
        /**
         * Contains the alias for this entity (if specified in the query)
         * @type String
         */
        "alias": {"value": alias, "enumerable": true},
        /**
         * Contains the number of columns this collector will handle (1).
         * @type Number
         */
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
ValueCollector.prototype.toString = function() {
    return "[ValueCollector]";
};

/**
 * Collects the value from the result set
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Store} store The store to operate on
 * @returns The value
 */
ValueCollector.prototype.collect = function(resultSet, metaData, store) {
    var columnType = store.dialect.getJdbcType(metaData.getColumnType(this.columnIdx));
    return columnType.get(resultSet, this.columnIdx);
};

/**
 * Returns the name of the result object property for the collected value, which
 * is the alias of the value.
 * @returns {String} The name of the result object property
 */
ValueCollector.prototype.getResultPropertyName = function(metaData) {
    return this.alias;
};