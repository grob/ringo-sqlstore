var {Class} = java.lang;

/**
 * Creates a new Connection wrapper instance
 * @class Instances of this class wrap a JDBC connection. Note that calling
 * close() doesn't actually close the connection but marks it as unused.
 * @param {ConnectionPool} pool The connection pool this connection belongs to
 * @param {java.sql.Connection} conn The connection to wrap
 * @returns A newly created Connection instance
 * @constructor
 */
var Connection = module.exports = function(pool, conn) {

    Object.defineProperties(this, {
        /**
         * The pool this connection belongs to
         * @type ConnectionPool
         * @ignore
         */
        "pool": {"value": pool},
        /**
         * The wrapped connection
         * @type java.sql.Connection
         * @ignore
         */
        "connection": {"value": conn},
        /**
         * The last use timestamp in milliseconds of this connection
         * @type Number
         * @ignore
         */
        "lastUse": {"value": Date.now(), "writable": true},
        /**
         * The last check timestamp in milliseconds of this connection
         * @type Number
         * @ignore
         */
        "lastCheck": {"value": Date.now(), "writable": true}
    });

    return this;
};

/**
 * Time in millis a connection is allowed to idle before it is closed by the
 * connection pool scheduler (value: 1 hour)
 * @type Number
 */
Connection.TIME_TO_IDLE = 3600000;

/**
 * Wrap all public methods of java.sql.Connection with JS methods
 * @ignore
 */
Connection.prototype = (function() {
    var proto = {};
    var clazz = Class.forName("java.sql.Connection");
    var methods = clazz.getMethods();
    methods.forEach(function(method) {
        var name = method.getName();
        proto[name] = function() {
            return this.connection[name].apply(this.connection, arguments);
        };
    });
    return proto;
})();

/**
 * Marks this connection as not-in-use, but doesn't close it.
 * @ignore
 */
Connection.prototype.close = function() {
    try {
        if (!this.connection.isReadOnly()) {
            this.connection.setReadOnly(true);
        }
        if (!this.connection.getAutoCommit()) {
            this.connection.setAutoCommit(true);
        }
        this.lastUse = Date.now();
        this.pool.release(this);
    } catch (e) {
        // connection is dead, remove it from the pool
        this.pool.remove(this);
    }
};

/** @ignore */
Connection.prototype.toString = function() {
    return this.connection.toString();
};



/**
 * Returns true if this connection is still valid. This method connects to the
 * database if it wasn't used for one minute or if the `force` argument is given,
 * otherwise it returns true.
 * @param {Number} timeout Optional timeout value in seconds (defaults to 2)
 * @param {Boolean} force If true connection is tested regardless of last use
 * @returns {Boolean} True if this connection is still valid
 * @ignore
 */
Connection.prototype.isValid = function(timeout, force) {
    if (force !== true && Date.now() - this.lastCheck < 60000) {
        return true;
    }
    this.lastCheck = Date.now();
    if (log.isDebugEnabled()) {
        log.debug("Checking if connection", this, "is valid...");
    }
    try {
        return this.connection.isValid(timeout || 2);
    } catch (e) { /* ignore */ }
    return false;
};

/**
 * Returns true if this connection hasn't been used within the maximum idle time
 * @param {Number} timeToIdle Optional threshold in milliseconds
 * @returns {Boolean} True if this connection is stale
 */
Connection.prototype.isStale = function(timeToIdle) {
    if (timeToIdle == undefined) {
        timeToIdle = Connection.TIME_TO_IDLE;
    }
    return Date.now() - this.lastUse >= timeToIdle;
};
