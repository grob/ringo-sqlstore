export("Collection", "PartitionedCollection");

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
var Collection = function(collectionMapping, query) {
    var isInitialized = false;
    var objects = [];

    /**
     * Initializes the collection
     */
    var initialize = function(force) {
        if (!isInitialized || force === true) {
            objects = query.select(collectionMapping.loadAggressive ? "*" : null);
        }
        isInitialized = true;
        return;
    };

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperty(this, "name", {"value": collectionMapping.name});

    /**
     * Contains the length of the collection
     * @type Number
     */
    Object.defineProperty(this, "length", {
        "get": function() {
            initialize();
            return objects.length;
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
        if (idx >= 0 && idx < objects.length) {
            return objects[idx];
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
        return objects.forEach(func);
    };

    return this;
};

/**
 * Static factory method for creating new collections
 * @param {Store} store The store
 * @param {CollectionMapping} collectionMapping The mapping definition of the collection
 * @param {Object} entity The entity
 * @returns A new Collection instance
 * @type Collection
 */
Collection.createInstance = function(store, collectionMapping, entity) {
    // construct query and instantiate collection
    var entityMapping = collectionMapping.mapping;
    var query = store.query(collectionMapping.entity);
    if (collectionMapping.through !== null) {
        var localColumnName = entityMapping.getColumnName(collectionMapping.localProperty || "id");
        var throughEntity = store.getEntityConstructor(collectionMapping.through);
        var localValue = entity[localColumnName];
        query.join(throughEntity, collectionMapping.join).equals(collectionMapping.foreignProperty, localValue);
    } else if (collectionMapping.foreignProperty !== null) {
        var localColumnName = entityMapping.getColumnName(collectionMapping.localProperty);
        var localValue = entity[localColumnName];
        query.equals(collectionMapping.foreignProperty, localValue);
    }
    if (collectionMapping.filter !== null) {
        query.filter(collectionMapping.filter);
    }
    if (collectionMapping.orderBy !== null) {
        query.orderBy(collectionMapping.orderBy);
    }
    if (collectionMapping.limit !== null) {
        query.limit(collectionMapping.limit);
    }
    if (collectionMapping.isPartitioned === true) {
        return new PartitionedCollection(collectionMapping, query);
    }
    return new Collection(collectionMapping, query);
};

/** @ignore */
Collection.prototype.toString = function() {
    return "[Collection " + this.name + "]";
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
var PartitionedCollection = function(collectionMapping, query) {
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
            ids = query.select("id");
            partitions = new Array(Math.ceil(ids.length / collectionMapping.partitionSize));
        }
        isInitialized = true;
        return;
    };

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperty(this, "name", {"value": collectionMapping.name});

    /**
     * Contains the partitions already loaded. Used for unit testing only.
     * @type Array
     * @private
     */
    Object.defineProperty(this, "partitions", {
        "get": function() {
            return partitions;
        },
        "enumerable": false
    });
    
    /**
     * Contains the length of the collection
     * @type Number
     */
    Object.defineProperty(this, "length", {
        "get": function() {
            initialize();
            return ids.length;
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
                var idsToFetch = ids.slice(start, end);
                var partitionQuery = store.query(type).equals("id", idsToFetch);
                if (collectionMapping.orderBy !== null) {
                    partitionQuery.orderBy(collectionMapping.orderBy);
                }
                partition = partitions[partitionIdx] = partitionQuery.select("*");
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
Collection.prototype.toString = function() {
    return "[Collection " + this.name + "]";
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
