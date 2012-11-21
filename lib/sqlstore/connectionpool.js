var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");
var {Vector, Properties} = java.util;
var {Thread, Class} = java.lang;

export("ConnectionPool");

var convertToProperties = function(props) {
    var properties = new Properties();
    for (var name in props) {
        if (name === "username") {
            // backwards compatibility
            properties.put("user", props[name]);
            continue;
        }
        properties.put(name, props[name]);
    }
    return properties;
};

var loadDriver = function(name) {
    // add database driver .jar to classpath if necessary
    switch (name) {
        case "com.mysql.jdbc.Driver":
            addToClasspath(module.resolve("../../jars/mysql.jar"));
            break;
        case "oracle.jdbc.driver.OracleDriver":
            addToClasspath(module.resolve("../../jars/ojdbc6.jar"));
            break;
        case "org.postgresql.Driver":
            addToClasspath(module.resolve("../../jars/postgresql.jar"));
            break;
        case "org.h2.Driver":
            addToClasspath(module.resolve("../../jars/h2-1.3.160.jar"));
            break;
        default:
            throw new Error("Unsupported jdbc driver '" + name + "'");
    }
};

/**
 * Creates a new connection pool instance
 * @class Instances of this class represent a connection pool
 * @param {Object} props The connection properties to use
 * @param {Number} maxConnections Optional maximum number of connections to allow
 * @returns A newly created connection pool
 * @constructor
 */
var ConnectionPool = function(props, maxConnections) {

    var limit = maxConnections || null;
    var properties = convertToProperties(props);
    var driverClass = null;
    var connections = new Vector();
    // create a worker for cleaning up stale connections and start it
    var worker = new Worker(module.resolve("./connectionpoolworker"));
    worker.onmessage = function(event) {
        log.info("Closed stale connection", event.data);
    };
    worker.postMessage(connections);

    /**
     * Resets this connection pool to a different database. Note that this
     * method closes open connections immediately.
     * @param {Object} props The properties of the database to connect to
     * @param {Number} maxConnections Optional maximum number of connections to allow
     */
    this.reset = sync(function(props, maxConnections) {
        this.closeConnections();
        properties = convertToProperties(props);
        limit = maxConnections || null;
        driverClass = null;
    }, connections);

    /**
     * Returns the connection properties of this pool
     * @returns {java.util.Properties} The connection properties
     */
    this.getProperties = function() {
        return properties;
    };

    /**
     * Returns the driver used by this connection pool
     * @returns {java.sql.Driver} The driver
     */
    this.getDriverClass = function() {
        if (driverClass === null) {
            loadDriver(properties.get("driver"));
            var classLoader = Thread.currentThread().getContextClassLoader();
            var drvr = Class.forName(properties.get("driver"), true, classLoader).newInstance();
            if (!drvr.acceptsURL(properties.get("url"))) {
                throw new Error("Invalid URL " + properties.get("url") +
                        " for driver " + properties.get("driver"));
            }
            driverClass = drvr;
        }
        return driverClass;
    };

    /**
     * Searches for an unused connection and returns it. This method throws
     * an error if the connection limit has been reached (if any has been
     * defined during construction of this pool).
     * @returns {Connection} A Connection instance
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
            if (log.isDebugEnabled()) {
                log.debug("Creating database connection no.", connections.size(),
                        "(URL:", properties.get("url"), ", user:",
                        properties.get("user") + ")");
            }
            var conn = new Connection(this,
                    this.getDriverClass().connect(properties.get("url"), properties));
            conn.lease();
            connections.add(conn);
            return conn;
        } else {
            throw new Error("Connection limit " + maxConnections + " reached");
        }
    }, connections);

    /**
     * Returns the number of connections in this pool
     * @returns {Number} The number of connections in this pool
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
    }, connections);

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
    }, connections);

    /**
     * Returns the number of open connections.
     * @returns {Number} The number of open connections
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
    }, connections);

    /**
     * Stops the worker that removes stale connections
     */
    this.stopScheduler = function() {
        worker.terminate();
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
    var clazz = Class.forName("java.sql.Connection");
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
    return this.getConnection().isValid(timeout || 100);
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
