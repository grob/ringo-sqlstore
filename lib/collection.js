/**
 * @module collection
 */
const constants = require("./constants");
const {getSelector, getParameterDescription} = require("./query/query");
const statements = require("./database/statements");

/**
 * Helper method for executing a query and returning the results
 * @param {Store} store The store to operate on
 * @param {Object} selector An object containing the query AST and the raw
 * SQL generator function
 * @param {Object} nparams An object containing named parameters referenced
 * in the query
 * @returns {Array} The query result
 * @private
 * @ignore
 */
const query = function query(store, selector, nparams) {
    const params = selector.params.map(function(param) {
        if (typeof(param) === "string") {
            return getParameterDescription(nparams[param]);
        }
        return param;
    });
    return statements.query(store, selector.sql, params, selector.collector);
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
 * @private
 * @ignore
 */
const createQueryParams = function createQueryParams(parent, params) {
    const descriptors = {};
    if (params !== null) {
        Object.getOwnPropertyNames(params).forEach(function(key) {
            descriptors[key] = Object.getOwnPropertyDescriptor(params, key);
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
const Collection = module.exports = function Collection(store, collectionMapping, selector, parent) {
    let ids = null;
    let storables = null;

    Object.defineProperties(this, {
        /**
         * The state of this collection
         * @name Collection#_state
         * @property {Number}
         */
        "_state": {"value": constants.STATE_UNLOADED, "writable": true},
        /**
         * The internal cache key of this collection
         * @name Collection#_cacheKey
         * @property {String}
         */
        "_cacheKey": {"value": parent._key.type + "#" + parent._key.id + "." +
                collectionMapping.name},
        /**
         * The store used by this collection
         * @name Collection#store
         * @property {Store}
         */
        "store": {"value": store},
        /**
         * Contains the mapping definition of this collection
         * @name Collection#mapping
         * @property {CollectionMapping}
         */
        "mapping": {"value": collectionMapping},
        /**
         * Contains the underlying selector of this collection
         * @name Collection#selector
         * @property {Object}
         */
        "selector": {"value": selector},
        /**
         * An array containing the storable IDs of this collection
         * @name Collection#ids
         * @property {Array}
         */
        "ids": {
            "get": function() {
                this.load();
                return ids;
            }
        },
        /**
         * An array containing the storables of this collection
         * @name Collection#storables
         * @property {Array}
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
         * @name Collection#load
         */
        "load": {
            "value": function() {
                if (this._state === constants.STATE_CLEAN) {
                    return;
                }
                const transaction = store.getTransaction();
                const useCache = store.entityCache &&
                        (!transaction || !transaction.containsKey(this._cacheKey));
                if (useCache && store.entityCache.containsKey(this._cacheKey)) {
                    ids = store.entityCache.get(this._cacheKey);
                    storables = new Array(ids.length);
                } else {
                    storables = query(store, selector,
                            createQueryParams(parent, collectionMapping.params));
                    ids = storables.map(function(storable) {
                        return storable._key.id;
                    });
                    if (useCache) {
                        store.entityCache.put(this._cacheKey, ids);
                    }
                }
                this._state = constants.STATE_CLEAN;
            }
        }
    });

    return this;
};

Collection.prototype = Object.create({}, {
    /** @ignore */
    "toString": {
        "value": function() {
            return "[Collection " + this._cacheKey + "]";
        }
    },
    /**
     * The name of the storable entity this collection contains
     * @name Collection#entity
     * @property {String}
     * @readonly
     */
    "entity": {
        "get": function() {
            return this.selector.entities[0]
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
     * @name Collection#length
     * @property {Number}
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
     * @name Collection#get
     */
    "get": {
        "value": function(idx) {
            if (idx >= 0 && idx < this.ids.length) {
                let storable = this.storables[idx];
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
     * @name Collection#invalidate
     */
    "invalidate": {
        "value": function() {
            const transaction = this.store.getTransaction();
            if (transaction !== null) {
                this._state = constants.STATE_UNLOADED;
                transaction.addCollection(this);
            } else {
                // we're not in an open transaction, so it's safe to
                // immediately invalidate the collection
                this._state = constants.STATE_UNLOADED;
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
     * @name Collection#forEach
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
     * @name Collection#indexOf
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
     * @name Collection#every
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
     * @name Collection#some
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
     * @name Collection#filter
     */
    "filter": {
        "value": function(callback, context) {
            if (typeof(callback) !== "function") {
                throw new TypeError();
            }
            const result = [];
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
     * @name Collection#map
     */
    "map": {
        "value": function(callback, context) {
            return this.ids.map(function(id, idx) {
                return callback.call(context, this.get(idx), idx, this);
            }, this);
        }
    },
    /**
     * Applies a callback against an accumulator and each element in this
     * collection (from left to right) to reduce it to a single value
     * @param {Function} callback The callback to execute
     * @param {Object} initialValue Optional initial value. If none is given
     * the first object in this collection is used as initial value
     * @returns {Object} The value that results from the reduction
     * @name Collection#reduce
     */
    "reduce": {
        "value": function(callback /*, initialValue */) {
            const len = this.ids.length;
            let idx = 0;
            let result;
            if (arguments.length === 2) {
                result = arguments[1];
            } else {
                result = this.get(idx++);
                if (idx >= len) {
                    throw new TypeError( 'Reduce of empty collection with no initial value' );
                }
            }
            while (idx < len) {
                result = callback.call(null, result, this.get(idx), idx, this);
                idx++;
            }
            return result;
        }
    },
    /**
     * Returns the index of the first element in the array that satisfies the
     * provided callback function, otherwise -1 is returned.
     * @param {Function} callback The callback to execute
     * @param {Object} context An optional to use as <code>this</code> when
     * executing the callback
     * @returns {Number} The index position, or -1
     * @name Collection#findIndex
     */
    "findIndex": {
        "value": function(callback, context) {
            if (typeof(callback) !== "function") {
                throw new TypeError("callback must be a function");
            }
            const len = this.ids.length;
            let idx = 0;
            while (idx < len) {
                let value = this.get(idx);
                if (callback.call(context, value, idx, this)) {
                    return idx;
                }
                idx++;
            }
            return -1;
        }
    },
    /**
     * Returns the the first element in the array that satisfies the
     * provided callback function, otherwise undefined is returned.
     * @param {Function} callback The callback to execute
     * @param {Object} context An optional to use as <code>this</code> when
     * executing the callback
     * @returns {Object} The element
     * @name Collection#find
     */
    "find": {
        "value": function(callback, context) {
            if (typeof(callback) !== "function") {
                throw new TypeError("callback must be a function");
            }
            const len = this.ids.length;
            let idx = 0;
            while (idx < len) {
                let value = this.get(idx);
                if (callback.call(context, value, idx, this)) {
                    return value;
                }
                idx++;
            }
            return undefined;
        }
    },
    /**
     * Converts this collection into a plain JavaScript Array
     * @returns {Array} An array containing the storables of this collection
     * @name Collection#all
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
 * @name Collection.createInstance
 */
Collection.createInstance = function(store, collectionMapping, parent) {
    const selector = getSelector(store, collectionMapping.query);
    return new Collection(store, collectionMapping, selector, parent);
};

/**
 * Creates a new collection iterator
 * @class A collection iterator
 * @param {Collection} collection The collection to operate on
 * @returns A newly created collection iterator
 * @constructor
 * @private
 * @ignore
 */
const CollectionIterator = function CollectionIterator(collection) {
    let idx = 0;

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
