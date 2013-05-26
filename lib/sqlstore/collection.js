/**
 * @fileoverview Provides constructors for standard and partitioned collections.
 */
var {createCacheKey} = require("./cache");
var {getSelector, getNamedParameter} = require("./query/query");
var {Key} = require("./key");
var {SqlGenerator} = require("./query/sqlgenerator");
var ast = require("./query/ast");

var getEntityMapping = function(store, aliases, name) {
    return store.getEntityMapping(aliases[name] || name);
};

/**
 * Helper function for creating a collector suitable for populating a collection.
 * @param {Store} store The store to operate on
 * @param {Node} ast The query AST
 * @returns {EntityCollector|AggressiveEntityCollector} The collector
 */
var createCollector = function(store, ast) {
    var node = ast.select.get(0).expression;
    if (node.constructor.name === "SelectEntity") {
        return new AggressiveEntityCollector(getEntityMapping(store, ast.aliases, node.name));
    }
    return new EntityCollector(getEntityMapping(store, ast.aliases, node.entity));
};

/**
 * Creates a new EntityCollector instance, capable of instantiating entity
 * instances from a query result set.
 * @param {Mapping} mapping The mapping of the entity
 * @returns A newly created EntityCollector instance
 * @constructor
 */
var EntityCollector = function(mapping) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

/** @ignore */
EntityCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

/**
 * Pushes the ID of the entity in the query result set to the internal `ids` array.
 * @param {java.sql.ResultSet} resultSet The result set
 * @param {Array} ids An array containing entity IDs
 * @param {Array} storables An array containing storable instances
 */
EntityCollector.prototype.collect = function(resultSet, ids, storables) {
    ids.push(this.mapping.id.jdbcType.get(resultSet, 1));
    return;
};

/**
 * Creates a new AggressiveEntityCollector instance, capable of instantiating entity
 * instances from a query result set and populating all their properties.
 * @param {Mapping} mapping The mapping of the entity
 * @returns A newly created AggressiveEntityCollector instance
 * @constructor
 */
var AggressiveEntityCollector = function(mapping) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnCnt": {"value": Object.keys(mapping.columns).length, "enumerable": true}
    });
    return this;
};

/** @ignore */
AggressiveEntityCollector.prototype.toString = function() {
    return "[AggressiveEntityCollector]";
};

/**
 * Collects the entity instance properties from the query result set and
 * creates a new storable instance of the entity. If the store has an entity
 * cache set this method does a cache lookup, and if it's a miss it creates
 * the storable instance and pushes it to the entity cache.
 * @param {java.sql.ResultSet} resultSet The result set
 * @param {Array} ids An array containing entity IDs
 * @param {Array} storables An array containing storable instances
 */
AggressiveEntityCollector.prototype.collect = function(resultSet, ids, storables) {
    var store = this.mapping.store;
    var entity = {};
    var columnIdx = 1;
    var transaction = store.getTransaction();
    var hasEntityCache = store.entityCache !== null;
    var len, key, cacheKey;
    for each (let propMapping in this.mapping.columns) {
        let value = entity[propMapping.column] = propMapping.jdbcType.get(resultSet, columnIdx++);
        if (propMapping === this.mapping.id) {
            len = ids.push(value);
            if (hasEntityCache === true) {
                cacheKey = createCacheKey(this.mapping.type, value);
                if ((!transaction || !transaction.containsKey(cacheKey)) &&
                        store.entityCache.containsKey(cacheKey)) {
                    [key, entity] = store.entityCache.get(cacheKey);
                    break;
                }
            }
            key = new Key(this.mapping.type, value);
        }
    }
    storables[len - 1] = store.create(this.mapping.type, key, entity);
    if (hasEntityCache) {
        store.entityCache.put(cacheKey, [key, entity]);
    }
};

/**
 * Helper method for executing a query and returning the results
 * @param {Store} store The store to operate on
 * @param {Object} selector An object containing the query AST and the raw
 * SQL generator function
 * @param {Object} nparams An object containing named parameters referenced
 * in the query
 * @returns {Array} The query result
 */
var query = function(store, selector, nparams) {
    var [sql, params] = selector.create(nparams, getNamedParameter);
    var collector = createCollector(store, selector.ast);
    return store.executeQuery(sql, params, function(resultSet) {
        var ids = [];
        var storables = [];
        while (resultSet.next()) {
            collector.collect(resultSet, ids, storables);
        }
        return [ids, storables];
    });
};

/**
 * Returns a named query parameter object. By default it proxies all
 * properties of the collection's parent storable (in addition the _id
 * property is mapped to "id"), plus optional named parameters defined
 * in the collection mapping.
 * @param {Storable} parent The collection's parent storable
 * @param {Object} params Optional named parameter object defined in the
 * collection mapping
 * @returns The query parameter object
 * @type Object
 */
var createQueryParams = function(parent, params) {
    var descriptors = {
        "id": {"value": parent._id, "writable": false}
    };
    if (params !== null) {
        Object.getOwnPropertyNames(params).forEach(function(key) {
            descriptors[key] = {
                "value": params[key],
                "writable": false
            };
        });
    }
    return Object.create(parent, descriptors);
};

/**
 * Creates a new Collection instance
 * @class Instances of this class represent a collection object, mimicking
 * a JS array. Note that it's currently not possible to directly access objects
 * using index positions (eg. collection[0]), use get(index) instead. Iterating
 * using `for`, `for each` or `forEach` is supported as well as a set of
 * Array-like iteration methods.
 * @param {Store} store The store to operate on
 * @param {Mapping} collectionMapping The collection mapping
 * @param {Object} selector An object containing the query ast and the sql
 * creation function
 * @param {Storable} parent The parent storable
 * @returns A newly created Collection instance
 * @constructor
 */
var Collection = exports.Collection = function(store, collectionMapping, selector, parent) {
    var ids = null;
    var storables = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperties(this, {
        /**
         * The state of this collection
         * @type Number
         * @name Collection.prototype._state
         * @ignore
         */
        "_state": {"value": Collection.STATE_UNLOADED, "writable": true},
        /**
         * The internal cache key of this collection
         * @type String
         * @name Collection.prototype._cacheKey
         * @ignore
         */
        "_cacheKey": {"value": cacheKey},
        /**
         * The store used by this collection
         * @type Store
         * @name Collection.prototype.store
         * @ignore
         */
        "store": {"value": store},
        /**
         * Contains the mapping definition of this collection
         * @type CollectionMapping
         * @name Collection.prototype.mapping
         * @ignore
         */
        "mapping": {"value": collectionMapping},
        /**
         * Contains the underlying selector of this collection
         * @type Object
         * @name Collection.prototype.selector
         * @ignore
         */
        "selector": {"value": selector},
        /**
         * An array containing the storable IDs of this collection
         * @type Array
         * @name Collection.prototype.ids
         */
        "ids": {
            "get": function() {
                this.load();
                return ids;
            }
        },
        /**
         * An array containing the storables of this collection
         * @type Array
         * @name Collection.prototype.storables
         */
        "storables": {
            "get": function() {
                this.load();
                return storables;
            }
        },
        /**
         * Populates the collection. In case the collection query is aggressive
         * (ie. `select Entity.* from Entity where ...`) this method also
         * constructs the storables, otherwise it only loads the IDs of the
         * storables contained in this collection.
         * @name Collection.prototype.load
         * @ignore
         */
        "load": {
            "value": function() {
                if (this._state === Collection.STATE_CLEAN) {
                    return;
                }
                var transaction = store.getTransaction();
                var useCache = store.entityCache &&
                        (!transaction || !transaction.containsKey(cacheKey));
                if (useCache && store.entityCache.containsKey(cacheKey)) {
                    ids = store.entityCache.get(cacheKey);
                } else {
                    [ids, storables] = query(store, selector,
                            createQueryParams(parent, collectionMapping.params));
                    if (useCache) {
                        store.entityCache.put(cacheKey, ids);
                    }
                }
                this._state = Collection.STATE_CLEAN;
            }
        },
        /** @ignore */
        "toString": {
            "value": function() {
                return "[Collection " + this.name + "]";
            }
        }
    });

    return this;
};

/** @ignore */
Collection.STATE_UNLOADED = 1;
/** @ignore */
Collection.STATE_CLEAN = 2;

/** @ignore */
Collection.prototype = Object.create({}, {
    /**
     * The name of the collection
     * @type String
     * @name Collection.prototype.name
     */
    "name": {
        "get": function() {
            return this.mapping.name;
        }
    },
    /**
     * The name of the storable entity this collection contains
     * @type String
     * @name Collection.prototype.entity
     */
    "entity": {
        "get": function() {
            return this.selector.ast.from.get(0).name
        }
    },
    /** @ignore */
    "__iterator__": {
        "value": function() {
            this.load();
            return new CollectionIterator(this);
        }
    },
    /**
     * The size of the collection
     * @type Number
     * @name Collection.prototype.length
     */
    "length": {
        "get": function() {
            return this.ids.length;
        }
    },
    /**
     * Returns the storable instance at the given index position
     * @param {Number} idx The index position of the storable to return
     * @returns {Storable} The storable at the given index position, or null
     * @name Collection.prototype.get
     */
    "get": {
        "value": function(idx) {
            if (idx >= 0 && idx < this.length) {
                var storable = this.storables[idx];
                if (storable === undefined) {
                    storable = this.storables[idx] =
                            this.store.get(this.entity, this.ids[idx]);
                }
                return storable;
            }
            return null;
        }
    },

    /**
     * Marks the collection as invalid, forcing a reload on next access. Note
     * that when calling this method in an open transaction any pending changes
     * affecting the collection will be visible to other threads only after
     * successfully committing the transaction.
     * @name Collection.prototype.invalidate
     */
    "invalidate": {
        "value": function() {
            var transaction = this.store.getTransaction();
            if (transaction != undefined) {
                this._state = Collection.STATE_UNLOADED;
                transaction.addCollection(this);
            } else {
                // we're not in an open transaction, so it's safe to
                // immediately invalidate the collection
                this._state = Collection.STATE_UNLOADED;
                if (this.store.entityCache && this.store.entityCache.containsKey(this._cacheKey)) {
                    this.store.entityCache.remove(this._cacheKey);
                }
            }
        }
    },
    /**
     * Iterates over the collection, executing the callback method for every
     * storable found. Similar to `Array.prototype.forEach()`.
     * @param {Function} callback The callback to execute
     * @param {Object} context Optional context object, representing the `this`.
     * @name Collection.prototype.forEach
     */
    "forEach": {
        "value": function(callback, context) {
            this.ids.forEach(function(key, idx) {
                callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    /**
     * Returns the index position of the storable passed as argument within
     * the collection.
     * @param {Storable} storable The storable to get the index position for
     * @returns {Number} The index position of the storable
     * @name Collection.prototype.indexOf
     */
    "indexOf": {
        "value": function(storable) {
            if (storable._key.type !== this.entity) {
                return -1;
            }
            return this.ids.indexOf(storable._id);
        }
    },
    /**
     * Executes the provided callback once for each storable in the collection,
     * until it finds one where the callback function returns false. Similar
     * to `Array.prototype.every()`.
     * @param {Function} callback The callback to execute
     * @param {Object} context Optional context object, representing the `this`.
     * @returns {Boolean} False if a callback execution returned false, true if
     * all callback executions returned true.
     * @name Collection.prototype.every
     */
    "every": {
        "value": function(callback, context) {
            return this.ids.every(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    /**
     * Executes the provided callback once for each storable in the collection,
     * until it finds one where the callback returned true. If found this method
     * immediately returns true, otherwise false. Similar to `Array.prototype.some()`.
     * @param {Function} callback The callback to execute
     * @param {Object} context Optional context object, representing the `this`.
     * @returns {Boolean} True if a callback execution returned true, false otherwise.
     * @name Collection.prototype.some
     */
    "some": {
        "value": function(callback, context) {
            return this.ids.some(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    /**
     * Returns an array containing those storables for which the provided callback
     * function returned true. Similar to `Array.prototype.filter()`.
     * @param {Function} callback The callback to execute
     * @param {Object} context Optional context object, representing the `this`.
     * @returns {Array} An array containing storables
     * @name Collection.prototype.filter
     */
    "filter": {
        "value": function(callback, context) {
            if (typeof(callback) !== "function") {
                throw new TypeError();
            }
            var result = [];
            for (let idx=0; idx<this.ids.length; idx+=1) {
                let storable = this.get(idx);
                if (callback.call(context, storable, idx, this)) {
                    result.push(storable);
                }
            }
            return result;
        }
    },
    /**
     * Executes the provided callback for every storable in this collection and
     * returns an array containing the result values. Similar to `Array.prototype.map()`.
     * @param {Function} callback The callback to execute
     * @param {Object} context Optional context object, representing the `this`.
     * @returns {Array} An array containing the result values of the callback
     * executions.
     * @name Collection.prototype.map
     */
    "map": {
        "value": function(callback, context) {
            return this.ids.map(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    /**
     * Converts this collection into a plain JavaScript Array
     * @returns {Array} An array containing the storables of this collection
     * @name Collection.prototype.all
     */
    "all": {
        "get": function() {
            return this.ids.map(function(id, idx) {
                return this.get(idx);
            }, this);
        }
    }
});

/**
 * Static factory method for creating new collections
 * @param {Store} store The store
 * @param {CollectionMapping} collectionMapping The mapping definition of the collection
 * @param {Storable} parent The parent storable
 * @returns {Collection} A new Collection instance
 */
Collection.createInstance = function(store, collectionMapping, parent) {
    var selector = getSelector(store, collectionMapping.query);
    if (collectionMapping.partitionSize > 0) {
        return new PartitionedCollection(store, collectionMapping, selector, parent);
    }
    return new Collection(store, collectionMapping, selector, parent);
};

/**
 * Creates a new PartitionedCollection instance
 * @class Instances of this class represent a partitioned collection. Similar
 * to standard collections this type initially loads the IDs of all storables and
 * creates initially empty storable partitions. These partitions are only
 * populated on-access, using a single SQL statement. Partitioned collections
 * are useful if a collection potentially contains a large number of storables.
 * @param {Store} store The store to operate on
 * @param {Mapping} collectionMapping The collection mapping
 * @param {Object} selector An object containing the query ast and the sql
 * creation function
 * @param {Storable} parent The parent storable
 * @returns A newly created PartitionedCollection instance
 * @constructor
 * @see Collection
 */
var PartitionedCollection = exports.PartitionedCollection =
        function(store, collectionMapping, selector, parent) {
    var ids = null;
    var partitions = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    Object.defineProperties(this, {
        /**
         * The state of this collection
         * @type Number
         * @name PartitionedCollection.prototype._state
         * @ignore
         */
        "_state": {"value": Collection.STATE_UNLOADED, "writable": true},
        /**
         * The internal cache key of this collection
         * @type String
         * @name PartitionedCollection.prototype._cacheKey
         * @ignore
         */
        "_cacheKey": {"value": cacheKey},
        /**
         * The store used by this collection
         * @type Store
         * @name PartitionedCollection.prototype.store
         * @ignore
         */
        "store": {"value": store},
        /**
         * Contains the mapping definition of this collection
         * @type CollectionMapping
         * @name PartitionedCollection.prototype.mapping
         * @ignore
         */
        "mapping": {"value": collectionMapping},
        /**
         * Contains the underlying selector of this collection
         * @type Object
         * @name PartitionedCollection.prototype.selector
         * @ignore
         */
        "selector": {"value": selector},
        /**
         * An array containing the storable IDs of this collection
         * @type Array
         * @name PartitionedCollection.prototype.ids
         */
        "ids": {
            "get": function() {
                this.load();
                return ids;
            }
        },
        /**
         * An array containing the storable partitions of this collection
         * @type Array
         * @name PartitionedCollection.prototype.storables
         */
        "partitions": {
            "get": function() {
                this.load();
                return partitions;
            }
        },
        /**
         * Populates the collection.
         * @name PartitionedCollection.prototype.load
         * @ignore
         */
        "load": {
            "value": function() {
                if (this._state === Collection.STATE_CLEAN) {
                    return;
                }
                var storables = null;
                var transaction = store.getTransaction();
                var useCache = store.entityCache &&
                        (!transaction || !transaction.containsKey(cacheKey));
                if (useCache && store.entityCache.containsKey(cacheKey)) {
                    ids = store.entityCache.get(cacheKey);
                } else {
                    [ids, storables] = query(store, selector,
                            createQueryParams(parent, collectionMapping.params));
                    if (useCache) {
                        store.entityCache.put(cacheKey, ids);
                    }
                }
                partitions = new Array(Math.ceil(ids.length / collectionMapping.partitionSize));
                if (storables.length > 0) {
                    for (var i=0; i<partitions.length; i+=1) {
                        let begin = i * collectionMapping.partitionSize;
                        let end = begin + collectionMapping.partitionSize;
                        partitions[i] = storables.slice(begin, end);
                    }
                }
                this._state = Collection.STATE_CLEAN;
            }
        },
        /** @ignore */
        "toString": {
            "value": function() {
                return "[PartitionedCollection " + this.name + "]";
            }
        }
    });

    return this;
};

/** @ignore */
PartitionedCollection.prototype = Object.create(Collection.prototype, {
    /**
     * Returns the storable at the given index position
     * @param {Number} idx The index position
     * @returns The object at the given index position
     */
    "get": {
        "value": function(idx) {
            if (idx >= 0 && idx < this.length) {
                var partitionIdx = Math.floor(idx / this.mapping.partitionSize);
                var partition = this.partitions[partitionIdx];
                if (partition == undefined) {
                    // load partition
                    var selector = this.getPartitionQuerySelector(partitionIdx);
                    var [ids, storables] = query(this.store, selector);
                    partition = this.partitions[partitionIdx] = storables;
                }
                var objectIdx = idx - (partitionIdx * this.mapping.partitionSize);
                var storable = partition[objectIdx];
                if (storable === undefined) {
                    storable = partition[objectIdx] =
                        this.store.get(this.entity, this.ids[idx]);
                }
                return storable;
            }
            return null;
        }
    },
    /**
     * Rewrites this collection's query to one suitable for loading the storable
     * partition at the given index position. Note that this partition selector
     * is not cached.
     * @param {Number} partitionIdx The index position of the partition to load
     * @returns {Object} An object containing the rewritten query ast and
     * the SQL creation function.
     * @ignore
     */
    "getPartitionQuerySelector": {
        "value": function(partitionIdx) {
            var start = partitionIdx * this.mapping.partitionSize;
            var end = Math.min(start + this.mapping.partitionSize, this.ids.length);
            var idsToFetch = this.ids.slice(start, end).map(function(id) {
                return new ast.IntValue(id);
            });
            var selectEntity = new ast.SelectEntity(this.entity);
            var selectClause = new ast.SelectClause([new ast.SelectExpression(selectEntity)]);
            var condition = new ast.Condition(new ast.Ident(this.entity, "id"),
                new ast.InCondition(idsToFetch));
            var expression = new ast.Expression(new ast.ConditionList([condition]));
            var whereClause = new ast.WhereClause(expression);
            var select = new ast.Select(this.selector.ast.aliases,
                selectClause, this.selector.ast.from, null, whereClause,
                null, null, this.selector.ast.orderBy);
            return {
                "ast": select,
                "create": SqlGenerator.createSqlFunction(this.store, select)
            };
        }
    }
});

/** @ignore */
PartitionedCollection.prototype.constructor = PartitionedCollection;

/**
 * Creates a new collection iterator
 * @class A collection iterator
 * @param {Collection} collection The collection to operate on
 * @returns A newly created collection iterator
 * @constructor
 */
var CollectionIterator = function(collection) {
    var idx = 0;

    /**
     * Returns the next element in the collection, or throws a StopIteration
     * if the end of the collection is reached
     * @returns The next element in the collection
     */
    this.next = function() {
        if (idx < collection.length) {
            return collection.get(idx++);
        }
        throw StopIteration;
    };

    return this;
};
