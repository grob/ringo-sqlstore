/**
 * @fileoverview Transaction implementation, keeping track of modifications
 * within a transaction and providing functionality for committing or rolling back.
 */
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
         * @type Array
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
     * @returns {java.sql.Connection} The connection
     * @ignore
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
     * Commits all changes made in this transaction, and releases the connection
     * used by this transaction. This method must not be called directly, instead
     * use `Store.prototype.commitTransaction()`.
     * @see store#Store.prototype.commitTransaction
     */
    this.commit = function() {
        this.getConnection().commit();
        Transaction.removeInstance();
        if (store.entityCache) {
            for each (let [cacheKey, storable] in Iterator(inserted)) {
                store.entityCache.put(cacheKey, [storable._key, storable._entity]);
            }
            for each (let [cacheKey, storable] in Iterator(updated)) {
                store.entityCache.put(cacheKey, [storable._key, storable._entity]);
            }
            for each (let [cacheKey, storable] in Iterator(deleted)) {
                store.entityCache.remove(cacheKey);
            }
            for each (let [cacheKey, collection] in Iterator(collections)) {
                if (collection._state === Collection.STATE_CLEAN) {
                    // the collection has been reloaded within the transaction,
                    // so it's save to put its IDs into the cache
                    store.entityCache.put(cacheKey, collection.ids);
                } else {
                    store.entityCache.remove(cacheKey);
                }
            }
        }
        reset();
        return;
    };

    /**
     * Rolls back all changes made in this transaction, and releases the
     * connection used by this transaction. This method must not be called
     * directly, instead use `Store.prototype.abortTransaction()`.
     * @see store#Store.prototype.abortTransaction
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
 * @ignore
 */
Object.defineProperty(Transaction, "threadLocal", {
    "value": new java.lang.ThreadLocal()
});

/**
 * Creates a new Transaction and binds it to the local thread
 * @param {Store} store The store to use
 * @returns {Transaction} The Transaction instance
 * @ignore
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
 * @returns {Transaction} The transaction, or null if none has been initialized
 * @ignore
 */
Transaction.getInstance = function() {
    return Transaction.threadLocal.get();
};

/**
 * Removes the transaction bound to the calling thread
 * @ignore
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
 * @returns {Boolean} True if this transaction is dirty
 */
Transaction.prototype.isDirty = function() {
    return this.keys.length > 0;
};

/**
 * Helper method for adding a key and an object to the map passed as argument.
 * @param {Object} map The map to add to
 * @param {Key} key The key
 * @param {Object} obj The object value
 * @ignore
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
 * @ignore
 */
Transaction.prototype.addInserted = function(storable) {
    return this.add(this.inserted, storable._cacheKey, storable);
};

/**
 * Adds the storable to the list of updated ones
 * @param {Storable} storable The storable to register
 * @ignore
 */
Transaction.prototype.addUpdated = function(storable) {
    return this.add(this.updated, storable._cacheKey, storable);
};

/**
 * Adds the storable to the list of deleted ones
 * @param {Storable} storable The storable to register
 * @ignore
 */
Transaction.prototype.addDeleted = function(storable) {
    return this.add(this.deleted, storable._cacheKey, storable);
};

/**
 * Adds the collection to this transaction
 * @param {Collection} collection The collection to register
 * @ignore
 */
Transaction.prototype.addCollection = function(collection) {
    return this.add(this.collections, collection._cacheKey, collection);
};

/**
 * Returns true if this transaction contains the key passed as argument
 * @param {String} key The key
 * @returns {Boolean} True if this transaction contains the key
 * @ignore
 */
Transaction.prototype.containsKey = function(key) {
    return this.keys.indexOf(key) > -1;
};
