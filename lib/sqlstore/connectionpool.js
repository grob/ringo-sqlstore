var log = require("ringo/logging").getLogger(module.id);
var engine = require("ringo/engine").getRhinoEngine();
var {Worker} = require("ringo/worker");

export("ConnectionPool");

var loadDriver = function(driverClass, jar) {
    try {
        java.lang.Class.forName(driverClass, false, engine.getClassLoader());
    } catch (e if (e.javaException instanceof java.lang.ClassNotFoundException)) {
        addToClasspath(module.resolve("../../jars/" + jar));
    }
    return;
};

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
    var connections = new java.util.Vector();
    // create a worker used for cleaning up stale connections and start it
    var worker = new Worker(module.resolve("./connectionpoolworker"));
    worker.onmessage = function(event) {
        log.info("Closed stale connection", event.data);
    };
    worker.postMessage(connections);

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
        var iter = connections.iterator();
        while (iter.hasNext()) {
            var conn = iter.next();
            if (conn.lease()) {
                if (conn.isValid()) {
                    return conn;
                }
                // connection is invalid, remove it
                log.info("Removed invalid connection", conn, "from pool");
                iter.remove();
            }
        }
        // no inactive connection found, create a new one until we reach
        // the maxConnections limit (if defined)
        if (!maxConnections || connections.size() < maxConnections) {
            log.debug("Creating database connection no.", connections.length, "(URL:", props.url, ", Username:", props.username + ")");
            var conn = new Connection(this, this.getDriver().connect(props.url, connectionProps));
            conn.lease();
            connections.add(conn);
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
        return connections.size();
    };

    /**
     * Loops over all connections, closes them and empties the internal
     * connection store.
     */
    this.closeConnections = sync(function() {
        var iter = connections.iterator();
        while (iter.hasNext()) {
            var conn = iter.next();
            conn.getConnection().close();
        }
        connections.clear();
        return;
    });

    /**
     * Removes a connection from the pool
     * @param {Connection} The connection to remove
     */
    this.remove = sync(function(conn) {
        if (!connections.contains(conn)) {
            log.warn("Connection", conn, "isn't in pool anymore, ignoring");
            return false;
        }
        log.info("Removed invalid connection", conn, "from pool");
        return connections.remove(conn);
    });

    /**
     * Returns the number of open connections.
     * @returns The number of open connections
     * @type Number
     */
    this.countOpenConnections = sync(function() {
        var iter = connections.iterator();
        var result = 0;
        while (iter.hasNext()) {
            var conn = iter.next();
            if (conn.isInUse() === true) {
                result += 1;
            }
        }
        return result;
    });

    /**
     * Stops the scheduler
     */
    this.stopScheduler = function() {
        worker.terminate();
        return;
    };

    // add database driver .jar to classpath if necessary
    switch (props.driver) {
        case "com.mysql.jdbc.Driver":
            loadDriver(props.driver, "mysql.jar");
            break;
        case "oracle.jdbc.driver.OracleDriver":
            loadDriver(props.driver, "ojdbc6.jar");
            break;
        case "org.postgresql.Driver":
            loadDriver(props.driver, "postgresql.jar");
            break;
        case "org.h2.Driver":
            loadDriver(props.driver, "h2-1.3.160.jar");
            break;
        default:
            throw new Error("Unsupported jdbc driver '" + props.driver + "'");
    }

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
    var lastLease = 0;

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
        return lastLease;
    };

    /**
     * Marks this connection as not-in-use, but doesn't close it. In addition
     * the wrapped connection is put back into writable autocommit mode.
     */
    this.close = function() {
        inUse = false;
        try {
            conn.setReadOnly(false);
            conn.setAutoCommit(true);
            lastLease = (new Date()).getTime();
        } catch (e) {
            // connection is dead, remove it from the pool
            pool.remove(this);
        }
        return;
    };

    /** @ignore */
    this.toString = function() {
        return conn.toString();
    };

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
 * @param {Number} timeout Optional timeout value (defaults to 100ms)
 * @returns True if this connection is still valid
 * @type Boolean
 */
Connection.prototype.isValid = function(timeout) {
    return this.getConnection().isValid(timeout || 100);
};

/**
 * Returns true if this connection hasn't been used within the maximum idle time
 * @param {Number} timeToIdle Optional threshold in milliseconds
 * @returns True if this connection is stale
 * @type Boolean
 */
Connection.prototype.isStale = function(timeToIdle) {
    if (timeToIdle == undefined) {
        timeToIdle = Connection.TIME_TO_IDLE;
    }
    var lastUse = this.getLastUse();
    return lastUse > 0 && (new Date()).getTime() - lastUse >= timeToIdle;
};
