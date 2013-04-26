var {createCacheKey} = require("./cache");
var {getStatement, getNamedParameter} = require("./query/query");
var {Key} = require("./key");
var ast = require("./query/ast");

export("Collection", "PartitionedCollection");

var getEntityMapping = function(store, aliases, name) {
    return store.getEntityMapping(aliases[name] || name);
};

var createCollector = function(store, ast) {
    var node = ast.select.get(0).expression;
    if (node.constructor.name === "SelectEntity") {
        return new AggressiveEntityCollector(getEntityMapping(store, ast.aliases, node.name));
    }
    return new EntityCollector(getEntityMapping(store, ast.aliases, node.entity));
};

var EntityCollector = function(mapping) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnCnt": {"value": 1, "enumerable": true}
    });
    return this;
};

EntityCollector.prototype.toString = function() {
    return "[EntityCollector]";
};

EntityCollector.prototype.collect = function(resultSet, ids, storables) {
    ids.push(this.mapping.id.jdbcType.get(resultSet, 1));
    return;
};

var AggressiveEntityCollector = function(mapping) {
    Object.defineProperties(this, {
        "mapping": {"value": mapping, "enumerable": true},
        "columnCnt": {"value": Object.keys(mapping.columns).length, "enumerable": true}
    });
    return this;
};

AggressiveEntityCollector.prototype.toString = function() {
    return "[AggressiveEntityCollector]";
};

AggressiveEntityCollector.prototype.collect = function(resultSet, ids, storables) {
    var store = this.mapping.store;
    var entity = {};
    var columnIdx = 1;
    var transaction = store.getTransaction();
    var useCache = true;
    var len, key, cacheKey;
    for each (let propMapping in this.mapping.columns) {
        let value = entity[propMapping.column] = propMapping.jdbcType.get(resultSet, columnIdx++);
        if (propMapping === this.mapping.id) {
            len = ids.push(value);
            cacheKey = createCacheKey(this.mapping.type, value);
            useCache = store.hasEntityCache() &&
                    (!transaction || !transaction.containsKey(cacheKey));
            if (useCache && store.entityCache.containsKey(cacheKey)) {
                [key, entity] = store.entityCache.get(cacheKey);
                storables[len - 1] = store.create(this.mapping.type, key, entity);
                return;
            } else {
                key = new Key(this.mapping.type, value);
            }
        }
    }
    storables[len - 1] = store.create(this.mapping.type, key, entity);
    if (useCache) {
        store.entityCache.put(cacheKey, [key, entity]);
    }
};

var select = function(store, statement, nparams) {
    var [sql, params] = statement.create(nparams, getNamedParameter);
    var collector = createCollector(store, statement.ast);
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
 * using for, for each or forEach is supported
 * @param {String} name The property name of the collection
 * @param {Query} query The query used to populate the collection
 * @param {Storable} parent The parent storable
 * @returns A newly created Collection instance
 * @constructor
 */
var Collection = function(store, collectionMapping, statement, parent) {
    var ids = null;
    var storables = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperties(this, {
        "_state": {"value": Collection.STATE_UNLOADED, "writable": true},
        "_cacheKey": {"value": cacheKey},
        "store": {"value": store},
        "mapping": {"value": collectionMapping},
        "statement": {"value": statement},
        "ids": {
            "get": function() {
                this.load();
                return ids;
            }
        },
        "storables": {
            "get": function() {
                this.load();
                return storables;
            }
        },
        "load": {
            "value": function() {
                if (this._state === Collection.STATE_CLEAN) {
                    return;
                }
                var transaction = store.getTransaction();
                var useCache = store.hasEntityCache() &&
                        (!transaction || !transaction.containsKey(cacheKey));
                if (useCache && store.entityCache.containsKey(cacheKey)) {
                    ids = store.entityCache.get(cacheKey);
                } else {
                    [ids, storables] = select(store, statement,
                            createQueryParams(parent, collectionMapping.params));
                    if (useCache) {
                        store.entityCache.put(cacheKey, ids);
                    }
                }
                this._state = Collection.STATE_CLEAN;
            }
        }
    });

    return this;
};

Collection.STATE_UNLOADED = 1;
Collection.STATE_CLEAN = 2;

Object.defineProperties(Collection.prototype, {
    /* ignore */
    "toString": {
        "value": function() {
            return "[Collection " + this.name + "]";
        }
    },
    "name": {
        "get": function() {
            return this.mapping.name;
        }
    },
    "entity": {
        "get": function() {
            return this.statement.ast.from.get(0).name
        }
    },
    "__iterator__": {
        "value": function() {
            this.load();
            return new CollectionIterator(this);
        }
    },
    "length": {
        "get": function() {
            return this.ids.length;
        }
    },
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
     * that when calling this method in an open transaction the changes to
     * the collection will be visible to other threads only after successfully
     * committing the transaction.
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
                if (this.store.hasEntityCache() && this.store.entityCache.containsKey(this._cacheKey)) {
                    this.store.entityCache.remove(this._cacheKey);
                }
            }
        }
    },
    "forEach": {
        "value": function(callback, context) {
            this.ids.forEach(function(key, idx) {
                callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    "indexOf": {
        "value": function(storable) {
            if (storable._key.type !== this.entity) {
                return -1;
            }
            return this.ids.indexOf(storable._id);
        }
    },
    "every": {
        "value": function(callback, context) {
            return this.ids.every(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    "some": {
        "value": function(callback, context) {
            return this.ids.some(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
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
    "map": {
        "value": function(callback, context) {
            return this.ids.map(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
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
 * @returns A new Collection instance
 * @type Collection
 */
Collection.createInstance = function(store, collectionMapping, parent) {
    var statement = getStatement(store, collectionMapping.query);
    if (collectionMapping.partitionSize > 0) {
        return new PartitionedCollection(store, collectionMapping, statement, parent);
    }
    return new Collection(store, collectionMapping, statement, parent);
};

/**
 * Creates a new Collection instance
 * @class Instances of this class represent a collection object, mimicking
 * a JS array. Note that it's currently not possible to directly access objects
 * using index positions (eg. collection[0]), use get(index) instead. Iterating
 * using for, for each or forEach is supported
 * @param {String} name The property name of the collection
 * @param {Query} query The query used to populate the collection
 * @param {Storable} parent The parent storable
 * @returns A newly created Collection instance
 * @constructor
 */
var PartitionedCollection = function(store, collectionMapping, statement, parent) {
    var ids = null;
    var partitions = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    Object.defineProperties(this, {
        "_state": {"value": Collection.STATE_UNLOADED, "writable": true},
        "_cacheKey": {"value": cacheKey},
        "store": {"value": store},
        "mapping": {"value": collectionMapping},
        "statement": {"value": statement},
        "ids": {
            "get": function() {
                this.load();
                return ids;
            }
        },
        "partitions": {
            "get": function() {
                this.load();
                return partitions;
            }
        },
        "load": {
            "value": function() {
                if (this._state === Collection.STATE_CLEAN) {
                    return;
                }
                var storables;
                var transaction = store.getTransaction();
                var useCache = store.hasEntityCache() &&
                        (!transaction || !transaction.containsKey(cacheKey));
                if (useCache && store.entityCache.containsKey(cacheKey)) {
                    ids = store.entityCache.get(cacheKey);
                } else {
                    [ids, storables] = select(store, statement,
                            createQueryParams(parent, collectionMapping.params));
                    if (useCache) {
                        store.entityCache.put(cacheKey, ids);
                    }
                }
                partitions = new Array(Math.ceil(ids.length / collectionMapping.partitionSize));
                if (storables != null) {
                    for (var i= 0; i<partitions.length; i+=1) {
                        let begin = i * collectionMapping.partitionSize;
                        let end = begin + collectionMapping.partitionSize;
                        partitions[i] = storables.slice(begin, end);
                    }
                }
                this._state = Collection.STATE_CLEAN;
            }
        }
    });

    return this;
};

PartitionedCollection.prototype = Object.create(Collection.prototype, {

    /** @ignore */
    "toString": {
        "value": function() {
            return "[PartitionedCollection " + this.name + "]";
        }
    },

    /**
     * Returns the object at the given index position
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
                    var select = new ast.Select(this.statement.ast.aliases,
                        selectClause, this.statement.ast.from, null, whereClause,
                        null, null, this.statement.ast.orderBy);
                    partition = this.partitions[partitionIdx] = Query.select(this.store, select);
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
    }
});

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
