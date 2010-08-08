var log = require('ringo/logging').getLogger(module.id);

export("ConnectionPool");

var ConnectionPool = function(props, maxConnections) {
    
    var connections = [];
    
    this.getConnection = function() {
        var conn = null;
        for each (var conn in connections) {
            if (conn.isValid()) {
                conn.lease();
                return conn;
            }
        }
        // no inactive connection found, create a new one until we reach
        // the maxConnections limit
        if (connections.length < maxConnections) {
            log.info("Creating database connection no.", connections.length);
            conn = new Connection(this, java.sql.DriverManager.getConnection(props.url, props.username,
                    props.password));
            conn.lease();
            connections.push(conn);
            return conn;
        } else {
            throw new Error("Maximum connection limit " + maxConnections + " reached");
        }
    };
    
    return this;
};

/** @ignore */
ConnectionPool.prototype.toString = function() {
    return "[ConnectionPool]";
};

/**
 * @param pool
 * @param conn
 * @returns
 * @constructor
 */
var Connection = function(pool, conn) {
    var inUse = false;
    var lastLease = null;

    /**
     * Returns the wrapped connection
     * @returns The wrapped connection
     * @type java.sql.Connection
     */
    this.getConnection = function() {
        return conn;
    };

    /**
     * Marks this connection as in-use if it's available
     * @returns True if this connection is marked, false if it's already in use
     * @type Boolean
     */
    this.lease = function() {
        if (inUse === true) {
            return false;
        }
        inUse = true;
        lastLease = (new Date()).getTime();
        return true;
    };

    /**
     * Returns true if this connection is in use
     * @returns True if this connection is in use
     * @type Boolean
     */
    this.isInUse = function() {
        return inUse === true;
    };

    /**
     * Returns the millis this connection was last leased
     * @returns The millis
     * @type Number
     */
    this.getLastUse = function() {
        return lastLease || 0;
    };
    
    /**
     * Marks this connection as not-in-use, but doesn't close it
     */
    this.close = function() {
        inUse = false;
        return;
    };

    /** @ignore */
    this.toString = function() {
        return conn.toString();
    };
    
    

    return this;
};

/**
 * Wrap all public methods of java.sql.Connection with JS methods
 */
Connection.prototype = (function() {
    var proto = {};
    var clazz = java.lang.Class.forName("java.sql.Connection");
    var methods = clazz.getMethods();
    methods.forEach(function(method) {
        proto[method.getName()] = function() {
            var conn = this.getConnection();
            return conn[method.getName()].apply(conn, arguments);
        };
    });
    return proto;
})();

/**
 * Returns true if this connection is still valid
 * @returns True if this connection is still valid
 * @type Boolean
 */
Connection.prototype.isValid = function() {
    var now = new Date();
    return (now.getTime() - this.getLastUse() < 60000) || this.validate();
};

/**
 * Returns true if the underlying connection is valid
 * @returns True if the connection is valid, false otherwise
 * @type Boolean
 */
Connection.prototype.validate = function() {
    try {
        this.getConnection().getMetaData();
    } catch (e) {
        return false;
    }
    return true;
};
