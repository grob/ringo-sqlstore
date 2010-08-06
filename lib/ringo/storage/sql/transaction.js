export("Transaction");

/**
 * @constructor
 */
var Transaction = function(store) {
    var connection = null;
    var inserted = [];
    var updated = [];
    var deleted = [];

    this.getConnection = function() {
        if (connection === null) {
            connection = store.getConnection();
        }
        return connection;
    };

    this.isDirty = function() {
        return inserted.length > 0 || updated.length > 0 || deleted.length > 0;
    };

    Object.defineProperty(this, "inserted", {
        "get": function() {
            return inserted;
        }
    });

    Object.defineProperty(this, "updated", {
        "get": function() {
            return updated;
        }
    });
    
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

/**
 * Commits all changes made in this transaction
 */
Transaction.prototype.commit = function() {
    this.getConnection().commit();
    this.inserted.length = 0;
    this.updated.length = 0;
    this.deleted.length = 0;
    return;
};

/**
 * Rolls back all changes made in this transaction
 */
Transaction.prototype.rollback = function() {
    this.getConnection().rollback();
    this.inserted.length = 0;
    this.updated.length = 0;
    this.deleted.length = 0;
    return;
};
