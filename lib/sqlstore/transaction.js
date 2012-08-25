var {Storable} = require("./storable");
var {Collection} = require("./collection");

/**
 * Returns a newly created Transaction instance
 * @class Instances of this class represent a database transaction, holding
 * information about inserted, updated and deleted objects and methods
 * to commit or rollback the transaction
 * @returns A newly created Transaction instance
 * @constructor
 */
var Transaction = exports.Transaction = function(store) {
    var connection = null;
    var inserted = {};
    var updated = {};
    var deleted = {};
    var collections = {};
    var keys = [];

    Object.defineProperties(this, {
        /**
         * The store
         * @type Store
         */
        "store": {"value": store, "enumerable": true},

        /**
         * Contains the keys of inserted objects
         * @type Array
         */
        "inserted": {"value": inserted, "enumerable": true},

        /**
         * Contains the keys of updated objects
         * @type Array
         */
        "updated": {"value": updated, "enumerable": true},

        /**
         * Contains the keys of deleted objects
         * @type Array
         */
        "deleted": {"value": deleted, "enumerable": true},

        /**
         * Contains the collections modified in this transaction
         */
        "collections": {"value": collections, "enumerable": true},

        /**
         * Contains the list of keys of all objects modified in this transaction
         */
        "keys": {"value": keys, "enumerable": true}
    });

    /**
     * Resets this transaction.
     * @private
     */
    var reset = function() {
        if (connection !== null) {
            connection.close();
            connection = null;
        }
        inserted = {};
        updated = {};
        deleted = {};
        collections = {};
        keys.length = 0;
        return;
    };

    /**
     * Returns the connection of this transaction
     * @returns The connection
     * @type java.sql.Connection
     */
    this.getConnection = function() {
        if (connection === null) {
            connection = store.connectionPool.getConnection();
            connection.setTransactionIsolation(java.sql.Connection.TRANSACTION_READ_COMMITTED);
            connection.setReadOnly(false);
            connection.setAutoCommit(false);
        }
        return connection;
    };

    /**
     * Commits all changes made in this transaction
     */
    this.commit = function() {
        this.getConnection().commit();
        Transaction.removeInstance();
        if (store.isCacheEnabled()) {
            for each (let [cacheKey, storable] in Iterator(inserted)) {
                store.cache.put(cacheKey, [storable._key, storable._entity]);
            }
            for each (let [cacheKey, storable] in Iterator(updated)) {
                store.cache.put(cacheKey, [storable._key, storable._entity]);
            }
            for each (let [cacheKey, storable] in Iterator(deleted)) {
                store.cache.remove(cacheKey);
            }
            for each (let [cacheKey, collection] in Iterator(collections)) {
                if (collection._state === Collection.STATE_CLEAN) {
                    // the collection has been reloaded within the transaction,
                    // so it's save to put its IDs into the cache
                    store.cache.put(cacheKey, collection.ids);
                } else {
                    store.cache.remove(cacheKey);
                }
            }
        }
        reset();
        return;
    };

    /**
     * Rolls back all changes made in this transaction
     */
    this.rollback = function() {
        this.getConnection().rollback();
        Transaction.removeInstance();
        for each (let [cacheKey, storable] in Iterator(inserted)) {
            storable._state = Storable.STATE_TRANSIENT;
        }
        for each (let [cacheKey, storable] in Iterator(updated)) {
            storable._state = Storable.STATE_DIRTY;
        }
        for each (let [cacheKey, storable] in Iterator(deleted)) {
            storable._state = Storable.STATE_CLEAN;
        }
        for each (let [cacheKey, collection] in Iterator(collections)) {
            collection._state = Collection.STATE_UNLOADED;
        }
        reset();
        return;
    };

    return this;
};

/**
 * A static property containing the ThreadLocal instance used to bind
 * transactions to threads
 * @type java.lang.ThreadLocal
 * @private
 */
Object.defineProperty(Transaction, "threadLocal", {
    "value": new java.lang.ThreadLocal()
});

/**
 * Creates a new Transaction and binds it to the local thread
 * @param {Store} store The store to use
 * @returns The Transaction instance
 * @type Transaction
 */
Transaction.createInstance = function(store) {
    var transaction = Transaction.threadLocal.get();
    if (transaction === null) {
        transaction = new Transaction(store);
        Transaction.threadLocal.set(transaction);
    }
    return transaction;
};

/**
 * Returns the transaction instance bound to the calling thread.
 * @returns The transaction, or null if none has been initialized
 * @type Transaction
 */
Transaction.getInstance = function() {
    return Transaction.threadLocal.get();
};

/**
 * Removes the transaction bound to the calling thread
 */
Transaction.removeInstance = function() {
    var transaction = Transaction.getInstance();
    if (transaction !== null) {
        Transaction.threadLocal.remove();
    }
    return;
};

/** @ignore */
Transaction.prototype.toString = function() {
    return "[Transaction (" + Object.keys(this.inserted).length + " inserted, " +
            Object.keys(this.updated).length + " updated, " +
            Object.keys(this.deleted).length + " deleted, " +
            Object.keys(this.collections).length + " collections)]";
};

/**
 * Returns true if this transaction is dirty
 * @returns True if this transaction is dirty
 * @type Boolean
 */
Transaction.prototype.isDirty = function() {
    return this.keys.length > 0;
};

/**
 * @private
 * @param key
 * @param obj
 * @param map
 */
Transaction.prototype.add = function(map, key, obj) {
    map[key] = obj;
    if (this.keys.indexOf(key) < 0) {
        this.keys.push(key);
    }
};

/**
 * Adds the storable to the list of inserted ones
 * @param {Storable} storable The storable to register
 */
Transaction.prototype.addInserted = function(storable) {
    return this.add(this.inserted, storable._cacheKey, storable);
};

/**
 * Adds the storable to the list of updated ones
 * @param {Storable} storable The storable to register
 */
Transaction.prototype.addUpdated = function(storable) {
    return this.add(this.updated, storable._cacheKey, storable);
};

/**
 * Adds the storable to the list of deleted ones
 * @param {Storable} storable The storable to register
 */
Transaction.prototype.addDeleted = function(storable) {
    return this.add(this.deleted, storable._cacheKey, storable);
};

/**
 * Adds the collection to this transaction
 * @param {Key} key The key to register
 */
Transaction.prototype.addCollection = function(collection) {
    return this.add(this.collections, collection._cacheKey, collection);
};

/**
 * Returns true if this transaction contains the key passed as argument
 * @param {String} key The key
 * @returns {Boolean} True if this transaction contains the key
 */
Transaction.prototype.containsKey = function(key) {
    return this.keys.indexOf(key) > -1;
};
