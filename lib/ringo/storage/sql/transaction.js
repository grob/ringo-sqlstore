export("Transaction");

/**
 * Returns a newly created Transaction instance
 * @class Instances of this class represent a database transaction, holding
 * information about inserted, updated and deleted objects and methods
 * to commit or rollback the transaction
 * @returns A newly created Transaction instance
 * @constructor
 */
var Transaction = function(store) {
    var connection = null;
    var inserted = [];
    var updated = [];
    var deleted = [];

    /**
     * Resets this transaction.
     * @private
     */
    var reset = function() {
        if (connection !== null) {
            connection.setTransactionIsolation(java.sql.Connection.TRANSACTION_READ_COMMITTED);
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
            connection = store.getConnection();
            connection.setTransactionIsolation(java.sql.Connection.TRANSACTION_SERIALIZABLE);
            connection.setReadOnly(false);
            connection.setAutoCommit(false);
        }
        return connection;
    };

    /**
     * Commits all changes made in this transaction
     */
    this.commit = function() {
        connection.commit();
        reset();
        return;
    };

    /**
     * Rolls back all changes made in this transaction
     */
    this.rollback = function() {
        connection.rollback();
        reset();
        return;
    };

    /**
     * Returns true if this transaction is dirty
     * @returns True if this transaction is dirty
     * @type Boolean
     */
    this.isDirty = function() {
        return inserted.length > 0 || updated.length > 0 || deleted.length > 0;
    };

    /**
     * Contains the keys of inserted objects
     * @type Array
     */
    Object.defineProperty(this, "inserted", {
        "get": function() {
            return inserted;
        }
    });

    /**
     * Contains the keys of updated objects
     * @type Array
     */
    Object.defineProperty(this, "updated", {
        "get": function() {
            return updated;
        }
    });
    
    /**
     * Contains the keys of deleted objects
     * @type Array
     */
    Object.defineProperty(this, "deleted", {
        "get": function() {
            return deleted;
        }
    });
    
    return this;
};

/** @ignore */
Transaction.prototype.toString = function() {
    return "[Transaction (" + this.inserted.length + " inserted, " +
                this.updated.length + " updated, " +
                this.deleted.length + " deleted)]";
};
