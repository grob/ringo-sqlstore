var {Parser} = require("./query/parser");
var {Query} = require("./query/query");
var ast = require("./query/ast");

export("Collection", "PartitionedCollection");

/**
 * FIXME: this is needed because we have only the entity object,
 * not the storable - therfor map all properties of the collection's
 * parent into the resulting params object
 *
 * This should be obsolete once Store.prototype.getProperties receives
 * the storable object, not it's entity
 */
var createQueryParams = function(collectionMapping, parentEntity) {
    var params = Object.create(collectionMapping.params || {});

    var parentMapping = collectionMapping.mapping;
    Object.defineProperty(params, "id", {
        "get": function() {
            return parentEntity[parentMapping.id.column];
        },
        "configurable": true
    });
    for (let name in parentMapping.properties) {
        let propMapping = parentMapping.properties[name];
        Object.defineProperty(params, name, {
            "get": function() {
                return parentEntity[propMapping.column];
            },
            "configurable": true
        });
    }
    return params;
};

/**
 * Creates a new Collection instance
 * @class Instances of this class represent a collection object, mimicking
 * a JS array. Note that it's currently not possible to directly access objects
 * using index positions (eg. collection[0]), use get(index) instead. Iterating
 * using for, for each or forEach is supported
 * @param {String} name The property name of the collection
 * @param {Query} query The query used to populate the collection
 * @returns A newly created Collection instance
 * @constructor
 */
var Collection = function(collectionMapping, query, parentEntity) {
    var isInitialized = false;
    var objects = [];

    /**
     * Initializes the collection
     */
    var initialize = function(force) {
        if (!isInitialized || force === true) {
            objects = query.select(createQueryParams(collectionMapping, parentEntity));
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
 * @param {Object} entity The entity
 * @returns A new Collection instance
 * @type Collection
 */
Collection.createInstance = function(store, collectionMapping, parentEntity) {
    // FIXME: we're only getting the parent entity object, therefor parameters
    // in the collection query must reference the COLUMN name
    // need to get the storable instance herein, so named query parameters
    // can reference the storable's properties
    var query = new Query(store, collectionMapping.query);
    if (collectionMapping.partitionSize > 0) {
        return new PartitionedCollection(collectionMapping, query, parentEntity);
    }
    return new Collection(collectionMapping, query, parentEntity);
};

/**
 * Creates a new Collection instance
 * @class Instances of this class represent a collection object, mimicking
 * a JS array. Note that it's currently not possible to directly access objects
 * using index positions (eg. collection[0]), use get(index) instead. Iterating
 * using for, for each or forEach is supported
 * @param {String} name The property name of the collection
 * @param {Query} query The query used to populate the collection
 * @returns A newly created Collection instance
 * @constructor
 */
var PartitionedCollection = function(collectionMapping, query, parentEntity) {
    var isInitialized = false;
    var ids = null;
    var store = query.store;
    var type = query.type;
    var partitions = [];

    /**
     * Initializes the collection
     */
    var initialize = function() {
        if (!isInitialized) {
            ids = query.selectProperties(createQueryParams(collectionMapping, parentEntity));
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
                var selectExpression = new ast.SelectExpression(selectEntity);
                var selectClause = new ast.SelectClause([selectExpression]);
                var condition = new ast.Condition(new ast.Ident(entityName, "id"),
                        new ast.InCondition(idsToFetch));
                var expression = new ast.Expression(new ast.ConditionList([condition]));
                var whereClause = new ast.WhereClause(expression);
                var select = new ast.Select(selectClause, query.ast.from, null,
                        whereClause, null, null, query.ast.orderBy);
                partition = partitions[partitionIdx] = Query.selectEntities(store, select);
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
