var {Parser} = require("./query/parser");
var {Query} = require("./query/query");
var ast = require("./query/ast");

export("Collection", "PartitionedCollection");

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
var Collection = function(collectionMapping, query, parent) {
    var isInitialized = false;
    var objects = [];

    /**
     * Initializes the collection
     */
    var initialize = function(force) {
        if (!isInitialized || force === true) {
            objects = query.select(createQueryParams(parent, collectionMapping.params));
        }
        isInitialized = true;
        return;
    };

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperties(this, {
        "objects": {
            "get": function() {
                initialize();
                return objects;
            }
        },
        "name": {
            "get": function() {
                return collectionMapping.name;
            }
        },
        "__iterator__": {
            "value": function() {
                initialize();
                return new CollectionIterator(this);
            }
        }
    });

    return this;
};

Object.defineProperties(Collection.prototype, {
    "toString": {
        "value": function() {
            return "[Collection " + this.name + "]";
        }
    },
    "length": {
        "get": function() {
            return this.objects.length;
        }
    },
    "get": {
        "value": function(idx) {
            if (idx >= 0 && idx < this.objects.length) {
                return this.objects[idx];
            }
            return null;
        }
    },
    "forEach": {
        "value": function(func) {
            return this.objects.forEach(func);
        }
    },
    "indexOf": {
        "value": function(storable) {
            var len = this.length;
            for (var i=0; i<len; i+=1) {
                if (this.get(i)._id === storable._id) {
                    return i;
                }
            }
            return -1;
        }
    },
    "every": {
        "value": function(callback, context) {
            return this.objects.every(callback, context);
        }
    },
    "some": {
        "value": function(callback, context) {
            return this.objects.some(callback, context);
        }
    },
    "filter": {
        "value": function(callback, context) {
            return this.objects.filter(callback, context);
        }
    },
    "map": {
        "value": function(callback, context) {
            return this.objects.map(callback, context);
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
        return new PartitionedCollection(collectionMapping, query, parent);
    }
    return new Collection(collectionMapping, query, parent);
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
var PartitionedCollection = function(collectionMapping, query, parent) {
    var isInitialized = false;
    var ids = null;
    var store = query.store;
    var partitions = [];

    /**
     * Initializes the collection
     */
    var initialize = function() {
        if (!isInitialized) {
            ids = query.select(createQueryParams(parent, collectionMapping.params));
            partitions = new Array(Math.ceil(ids.length / collectionMapping.partitionSize));
        }
        isInitialized = true;
        return;
    };

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperties(this, {
        "partitions": {
            "get": function() {
                return partitions;
            }
        },
        "name": {
            "get": function() {
                return collectionMapping.name;
            }
        },
        "length": {
            "get": function() {
                initialize();
                return ids.length;
            },
            "enumerable": true
        }
    });

    /**
     * Returns a collection iterator instance
     * @returns A collection iterator
     * @type CollectionIterator
     */
    this.__iterator__ = function() {
        initialize();
        return new CollectionIterator(this);
    };

    /**
     * Returns the object at the given index position
     * @param {Number} idx The index position
     * @returns The object at the given index position
     */
    this.get = function(idx) {
        initialize();
        if (idx >= 0 && idx < ids.length) {
            var partitionIdx = Math.floor(idx / collectionMapping.partitionSize);
            var partition = partitions[partitionIdx];
            if (partition == undefined) {
                // load partition
                var start = partitionIdx * collectionMapping.partitionSize;
                var end = Math.min(start + collectionMapping.partitionSize, ids.length);
                var entityName = query.ast.from.list[0].entity.entity;
                var idsToFetch = ids.slice(start, end).map(function(id) {
                    return new ast.IntValue(id);
                });
                var selectEntity = new ast.SelectEntity(entityName, true);
                var selectClause = new ast.SelectClause([selectEntity]);
                var condition = new ast.Condition(new ast.Ident(entityName, "id"),
                        new ast.InCondition(idsToFetch));
                var expression = new ast.Expression(new ast.ConditionList([condition]));
                var whereClause = new ast.WhereClause(expression);
                var select = new ast.Select(selectClause, query.ast.from, null,
                        whereClause, null, null, query.ast.orderBy);
                partition = partitions[partitionIdx] = Query.select(store, select);
            }
            var objectIdx = idx - (partitionIdx * collectionMapping.partitionSize);
            return partition[objectIdx];
        }
        return null;
    };

    /**
     * Iterates over this collection
     * @param {Function} func The callback function to execute for each
     * object in this collection
     */
    this.forEach = function(func) {
        initialize();
        var collection = this;
        return ids.forEach(function(entity, idx) {
            func(collection.get(idx), idx);
        });
    };

    return this;
};

/** @ignore */
PartitionedCollection.prototype.toString = function() {
    return "[PartitionedCollection " + this.name + "]";
};


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
