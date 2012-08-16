var {createCacheKey} = require("./cache");
var {SqlGenerator} = require("./query/sqlgenerator");
var {Query} = require("./query/query");
var {Key} = require("./key");
var ast = require("./query/ast");

export("Collection", "PartitionedCollection");

var CollectorGenerator = function(store, aliases) {
    Object.defineProperties(this, {
        "store": {"value": store, "enumerable": true},
        "aliases": {"value": aliases || {}, "enumerable": true}
    });
    return this;
};

CollectorGenerator.prototype.toString = function() {
    return "[CollectorGenerator]";
};

CollectorGenerator.prototype.getEntityMapping = function(name) {
    return this.store.getEntityMapping(this.aliases[name] || name);
};

CollectorGenerator.prototype.create = function(selectExpression) {
    var node = selectExpression.get(0).expression;
    if (node instanceof ast.SelectEntity) {
        return new AggressiveEntityCollector(this.getEntityMapping(node.name));
    }
    return new EntityCollector(this.getEntityMapping(node.entity));
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
    var store = this.mapping.store;
    var columnType = store.dialect.getType(this.mapping.id.type);
    ids.push(columnType.get(resultSet, 1));
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
    var columnType = store.dialect.getType(this.mapping.id.type);
    var id = columnType.get(resultSet, 1);
    var len = ids.push(id);
    var key = null;
    var entity = null;
    var cacheKey = createCacheKey(this.mapping.type, id);
    if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
        [key, entity] = store.cache.get(cacheKey);
    }
    if (entity === null) {
        key = new Key(this.mapping.type, id);
        entity = {};
        var columnIdx = 2;
        for each (let propMapping in this.mapping.columns) {
            columnIdx = resultSet.findColumn(this.node.getColumnAlias(propMapping.name));
            columnType = store.dialect.getType(propMapping.type);
            entity[propMapping.column] = columnType.get(resultSet, columnIdx++);
        }
        storables[len - 1] = store.create(this.mapping.type, key, entity);
        if (store.isCacheEnabled()) {
            store.cache.put(cacheKey, [key, entity]);
        }
    }
};

var select = function(store, queryAst, nparams) {
    var sqlGenerator = new SqlGenerator(store, queryAst.aliases, nparams);
    var collectorGenerator = new CollectorGenerator(store, queryAst.aliases);
    var sql = queryAst.accept(sqlGenerator);
    var collector = collectorGenerator.create(queryAst.select);
    return store.executeQuery(sql, sqlGenerator.params, function(resultSet) {
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
var Collection = function(store, collectionMapping, query, parent) {
    var isInitialized = false;
    var ids = null;
    var storables = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperties(this, {
        "store": {
            "get": function() {
                return store;
            }
        },
        "mapping": {
            "value": collectionMapping
        },
        "entity": {
            "value": query.ast.from.get(0).name
        },
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
        "name": {
            "get": function() {
                return collectionMapping.name;
            }
        },
        "__iterator__": {
            "value": function() {
                this.load();
                return new CollectionIterator(this);
            }
        },
        "query": {
            "get": function() {
                return query;
            }
        },
        "load": {
            "value": function(force) {
                if (isInitialized && force !== true) {
                    return;
                }
                if (force !== true && store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                    ids = store.cache.get(cacheKey);
                } else {
                    [ids, storables] = select(store, query.ast,
                            createQueryParams(parent, collectionMapping.params));
                    if (store.isCacheEnabled()) {
                        store.cache.put(cacheKey, ids);
                    }
                }
                isInitialized = true;
            }
        },
        "add": {
            "value": function(obj) {
                this.invalidate();
            }
        },
        "remove": {
            "value": function(obj) {
                this.invalidate();
            }
        },
        "invalidate": {
            "value": function() {
                if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                    store.cache.remove(cacheKey);
                }
                isInitialized = false;
            }
        }
    });

    return this;
};

Object.defineProperties(Collection.prototype, {
    /* ignore */
    "toString": {
        "value": function() {
            return "[Collection " + this.name + "]";
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
            return this.ids.filter(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
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
    var query = new Query(store, collectionMapping.query);
    if (collectionMapping.partitionSize > 0) {
        return new PartitionedCollection(store, collectionMapping, query, parent);
    }
    return new Collection(store, collectionMapping, query, parent);
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
var PartitionedCollection = function(store, collectionMapping, query, parent) {
    var isInitialized = false;
    var ids = null;
    var partitions = [];
    var cacheKey = createCacheKey(parent._key.type, parent._key.id,
            collectionMapping.name);

    Object.defineProperties(this, {
        "store": {
            "get": function() {
                return store;
            }
        },
        "mapping": {
            "value": collectionMapping
        },
        "entity": {
            "value": query.ast.from.get(0).name
        },
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
        "name": {
            "get": function() {
                return collectionMapping.name;
            }
        },
        "__iterator__": {
            "value": function() {
                this.load();
                return new CollectionIterator(this);
            }
        },
        "query": {
            "get": function() {
                if (query === null) {
                    query = createQuery(store, collectionMapping, parentEntity);
                }
                return query;
            }
        },
        "load": {
            "value": function(force) {
                if (isInitialized && force !== true) {
                    return;
                }
                var storables;
                if (force !== true && store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                    ids = store.cache.get(cacheKey);
                } else {
                    [ids, storables] = select(store, query.ast,
                            createQueryParams(parent, collectionMapping.params));
                    if (store.isCacheEnabled()) {
                        store.cache.put(cacheKey, ids);
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
                isInitialized = true;
            }
        },
        "add": {
            "value": function(obj) {
                this.invalidate();
            }
        },
        "remove": {
            "value": function(obj) {
                this.invalidate();
            }
        },
        "invalidate": {
            "value": function() {
                if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
                    store.cache.remove(cacheKey);
                }
                isInitialized = false;
            }
        }
    });

    return this;
};

Object.defineProperties(PartitionedCollection.prototype, {

    /** @ignore */
    "toString": {
        "value": function() {
            return "[PartitionedCollection " + this.name + "]";
        }
    },
    "length": {
        "get": function() {
            return this.ids.length;
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
                    var start = partitionIdx * collectionMapping.partitionSize;
                    var end = Math.min(start + collectionMapping.partitionSize, ids.length);
                    var idsToFetch = ids.slice(start, end).map(function(id) {
                        return new ast.IntValue(id);
                    });
                    var selectEntity = new ast.SelectEntity(this.entity, true);
                    var selectClause = new ast.SelectClause([new ast.SelectExpression(selectEntity)]);
                    var condition = new ast.Condition(new ast.Ident(this.entity, "id"),
                            new ast.InCondition(idsToFetch));
                    var expression = new ast.Expression(new ast.ConditionList([condition]));
                    var whereClause = new ast.WhereClause(expression);
                    var select = new ast.Select(selectClause, query.ast.from, null,
                            whereClause, null, null, query.ast.orderBy);
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
    },

    /**
    * Iterates over this collection
    * @param {Function} func The callback function to execute for each
    * object in this collection
    */
    "forEach": {
        "value": function(func) {
            return this.ids.forEach(function(entity, idx) {
                func(this.get(idx), idx);
            }, this);
        }
    }
});

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
