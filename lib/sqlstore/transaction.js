var {Storable} = require("./storable");

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
    var inserted = [];
    var updated = [];
    var deleted = [];

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
        "deleted": {"value": deleted, "enumerable": true}
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
        inserted.length = 0;
        updated.length = 0;
        deleted.length = 0;
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
            for each (let storable in inserted) {
                store.cache.put(storable._key.getCacheKey(), [storable._key, storable._entity]);
            }
            for each (let storable in updated) {
                store.cache.put(storable._key.getCacheKey(), [storable._key, storable._entity]);
            }
            for each (let storable in deleted) {
                store.cache.remove(storable._key.getCacheKey());
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
        for each (let storable in inserted) {
            storable._state = Storable.STATE_TRANSIENT;
        }
        for each (let storable in updated) {
            storable._state = Storable.STATE_DIRTY;
        }
        for each (let storable in deleted) {
            storable._state = Storable.STATE_CLEAN;
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
    return "[Transaction (" + this.inserted.length + " inserted, " +
                this.updated.length + " updated, " +
                this.deleted.length + " deleted)]";
};

/**
 * Returns true if this transaction is dirty
 * @returns True if this transaction is dirty
 * @type Boolean
 */
Transaction.prototype.isDirty = function() {
    return this.inserted.length > 0 || this.updated.length > 0 || this.deleted.length > 0;
};

/**
 * Adds the key to the list of inserted ones
 * @param {Key} key The key to register
 * @param {Object} entity The inserted entity object
 */
Transaction.prototype.addInserted = function(storable) {
    this.inserted.push(storable);
    return;
};

/**
 * Adds the key to the list of update ones
 * @param {Key} key The key to register
 */
Transaction.prototype.addUpdated = function(storable) {
    this.updated.push(storable);
    return;
};

/**
 * Adds the key to the list of deleted ones
 * @param {Key} key The key to register
 */
Transaction.prototype.addDeleted = function(storable) {
    this.deleted.push(storable);
    return;
};

