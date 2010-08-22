var log = require('ringo/logging').getLogger(module.id);

export("ConnectionPool");

/**
 * Creates a new connection pool instance
 * @class Instances of this class represent a connection pool
 * @param {Object} props The connection properties to use
 * @param {Number} maxConnections Optional maximum connections
 * @returns A newly created connection pool
 * @constructor
 */
var ConnectionPool = function(props, maxConnections) {
    
    var driver = null;
    var connections = [];
    var connectionProps = (function() {
        var properties = new java.util.Properties();
        for (var name in props) {
            if (name === "username") {
                properties.put("user", props[name]);
            } else {
                properties.put(name, props[name]);
            }
        }
        return properties;
    })();

    /**
     * Returns the driver used by this connection pool
     * @returns The driver
     * @type java.sql.Driver
     */
    this.getDriver = function() {
        if (driver === null) {
            var classLoader = java.lang.Thread.currentThread().getContextClassLoader();
            var drvr = java.lang.Class.forName(props.driver, true, classLoader).newInstance();
            if (!drvr.acceptsURL(props.url)) {
                throw new Error("Invalid URL " + props.url + " for driver " + props.driver);
            }
            driver = drvr;
        }
        return driver;
    };
    
    /**
     * Searches for an unused connection and returns it.
     * @returns An unused connect
     * @type Connection
     */
    this.getConnection = sync(function() {
        var conn = null;
        for each (var conn in connections) {
            if (conn.isValid() && conn.lease()) {
                return conn;
            }
        }
        // no inactive connection found, create a new one until we reach
        // the maxConnections limit (if defined)
        if (!maxConnections || connections.length < maxConnections) {
            log.debug("Creating database connection no.", connections.length, "(URL:", props.url, ", Username:", props.username + ")");
            conn = new Connection(this, this.getDriver().connect(props.url, connectionProps));
            conn.lease();
            connections.push(conn);
            return conn;
        } else {
            throw new Error("Maximum connection limit " + maxConnections + " reached");
        }
    });
    
    /**
     * Returns the number of connections in this pool
     * @returns The number of connections in this pool
     * @type Number
     */
    this.size = function() {
        return connections.length;
    };
    
    /**
     * Loops over all connections, closes them and empties the internal
     * connection store.
     */
    this.closeConnections = function() {
        for each (var conn in connections) {
            conn.getConnection().close();
        }
        connections.length = 0;
        return;
    };
    
    return this;
};

/** @ignore */
ConnectionPool.prototype.toString = function() {
    return "[ConnectionPool]";
};

/**
 * Creates a new Connection wrapper instance
 * @class Instances of this class wrap a JDBC connection. Note that calling
 * close() doesn't actually close the connection but marks it as unused.
 * @param {ConnectionPool} pool The connection pool this connection belongs to
 * @param {java.sql.Connection} conn The connection to wrap
 * @returns A newly created Connection instance
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
     * Marks this connection as not-in-use, but doesn't close it. In addition
     * the wrapped connection is put back into writable autocommit mode.
     */
    this.close = function() {
        inUse = false;
        conn.setReadOnly(false);
        conn.setAutoCommit(true);
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
 * Returns true if this connection is still valid. This method connects to the
 * database if it wasn't used for one minute.
 * @returns True if this connection is still valid
 * @type Boolean
 */
Connection.prototype.isValid = function() {
    return (new Date().getTime() - this.getLastUse() < 60000) || this.validate();
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
