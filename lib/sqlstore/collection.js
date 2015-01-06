/**
 * @fileoverview Provides constructors for standard and partitioned collections.
 */
var {getSelector, getParameterDescription} = require("./query/query");

var createCacheKey = function(type, id, property) {
    return type + "#" + id + "." + property;
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
    var params = selector.params.map(function(param) {
        if (typeof(param) === "string") {
            return getParameterDescription(nparams[param]);
        }
        return param;
    });
    return store.executeQuery(selector.sql, params, selector.collector);
};

/**
 * Returns a named query parameter object. By default it proxies all
 * properties of the collection's parent storable, plus optional named
 * parameters defined in the collection mapping.
 * @param {Storable} parent The collection's parent storable
 * @param {Object} params Optional named parameter object defined in the
 * collection mapping
 * @returns The query parameter object
 * @type Object
 */
var createQueryParams = function(parent, params) {
    var descriptors = {};
    if (params !== null) {
        Object.getOwnPropertyNames(params).forEach(function(key) {
            descriptors[key] = {
                "value": params[key]
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
                    storables = query(store, selector,
                            createQueryParams(parent, collectionMapping.params));
                    ids = storables.map(function(storable) {
                        return storable._key.id;
                    });
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
            return this.selector.ast.from.list[0].name
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
            return this.ids.indexOf(storable.id);
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
    return new Collection(store, collectionMapping, selector, parent);
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
