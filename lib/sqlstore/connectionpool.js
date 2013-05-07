var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");
var {Vector, Properties} = java.util;
var {Thread, Class} = java.lang;
var fs = require("fs");

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

/**
 * Creates a new connection pool instance
 * @class Instances of this class represent a connection pool
 * @param {Object} props The connection properties to use
 * @param {Number} maxConnections Optional maximum number of connections to allow
 * @returns A newly created connection pool
 * @constructor
 */
var ConnectionPool = function(props, maxConnections) {

    // add all jar files to the classpath
    var dir = module.resolve("../../jars/");
    fs.list(dir).forEach(function(file) {
        if (fs.extension(file) === ".jar") {
            addToClasspath(fs.join(dir, file));
        }
    });

    var limit = maxConnections || 0;
    var properties = convertToProperties(props);
    var driver = null;
    var lock = {};
    var inUseConnections = new Vector();
    var idleConnections = new Vector();
    // create a worker for cleaning up stale connections and start it
    var worker = new Worker(module.resolve("./connectionpoolworker"));
    worker.onmessage = function(event) {
        log.info("Closed stale connection", event.data);
    };
    worker.postMessage(idleConnections);

    /**
     * Resets this connection pool to a different database. Note that this
     * method closes open connections immediately.
     * @param {Object} props The properties of the database to connect to
     * @param {Number} maxConnections Optional maximum number of connections to allow
     */
    this.reset = sync(function(props, maxConnections) {
        this.closeConnections();
        properties = convertToProperties(props);
        limit = maxConnections || 0;
        driverClass = null;
    }, lock);

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
        if (driver === null) {
            var classLoader = Thread.currentThread().getContextClassLoader();
            driver = Class.forName(properties.get("driver"), true, classLoader).newInstance();
            if (!driver.acceptsURL(properties.get("url"))) {
                throw new Error("Invalid URL " + properties.get("url") +
                        " for driver " + properties.get("driver"));
            }
        }
        return driver;
    };

    /**
     * Searches for an unused connection and returns it. This method throws
     * an error if the connection limit has been reached (if any has been
     * defined during construction of this pool).
     * @returns {Connection} A Connection instance
     */
    this.getConnection = sync(function() {
        var conn;
        if (!idleConnections.isEmpty()) {
            conn = idleConnections.remove(0);
            if (conn.isValid()) {
                inUseConnections.add(conn);
                return conn;
            }
        }
        if (!limit || limit > this.size()) {
            if (log.isDebugEnabled()) {
                log.debug("Creating database connection no.",
                        inUseConnections.size(), "(URL:",
                        properties.get("url"), ", user:",
                        properties.get("user") + ")");
            }
            conn = new Connection(this,
                    this.getDriverClass().connect(properties.get("url"), properties));
            conn.setReadOnly(true);
            conn.setAutoCommit(true);
            inUseConnections.add(conn);
        } else {
            throw new Error("Connection limit " + limit + " reached");
        }
        return conn;
    }, lock);

    this.release = sync(function(conn) {
        inUseConnections.remove(conn);
        idleConnections.add(conn);
    }, lock);

    /**
     * Returns the number of connections in this pool
     * @returns {Number} The number of connections in this pool
     */
    this.size = function() {
        return inUseConnections.size() + idleConnections.size();
    };

    /**
     * Loops over all connections, closes them and empties the internal
     * connection store.
     */
    this.closeConnections = sync(function() {
        for each (let list in [inUseConnections, idleConnections]) {
            var iter = list.iterator();
            while (iter.hasNext()) {
                iter.next().connection.close();
            }
            list.clear();
        }
    }, lock);

    /**
     * Removes a connection from the pool
     * @param {Connection} The connection to remove
     */
    this.remove = sync(function(conn) {
        if (idleConnections.contains(conn)) {
            return idleConnections.remove(conn);
        } else if (inUseConnections.contains(conn)) {
            return inUseConnections.remove(conn);
        } else {
            log.warn("Connection", conn, "isn't in pool anymore, ignoring");
            return false;
        }
    }, lock);

    /**
     * Returns the number of open connections.
     * @returns {Number} The number of open connections
     */
    this.countOpenConnections = function() {
        return inUseConnections.size();
    };

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

    Object.defineProperties(this, {
        "connection": {"value": conn},
        "lastUse": {"value": Date.now(), "writable": true}
    });

    /**
     * Marks this connection as not-in-use, but doesn't close it. In addition
     * the wrapped connection is put back into writable autocommit mode.
     */
    this.close = function() {
        try {
            if (!conn.isReadOnly()) {
                conn.setReadOnly(true);
            }
            if (!conn.getAutoCommit()) {
                conn.setAutoCommit(true);
            }
            this.lastUse = Date.now();
            pool.release(this);
        } catch (e) {
            // connection is dead, remove it from the pool
            pool.remove(this);
        }
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
        var name = method.getName();
        proto[name] = function() {
            return this.connection[name].apply(this.connection, arguments);
        };
    });
    return proto;
})();

/** @ignore */
Connection.prototype.toString = function() {
    return this.connection.toString();
};

/**
 * Returns true if this connection is still valid. This method connects to the
 * database if it wasn't used for one minute.
 * @param {Number} timeout Optional timeout value (defaults to 100ms)
 * @param {Boolean} force If true connection is tested regardless of last use
 * @returns True if this connection is still valid
 * @type Boolean
 */
Connection.prototype.isValid = function(timeout, force) {
    if (force !== true && Date.now() - this.lastUse < 60000) {
        return true;
    }
    try {
        return this.connection.isValid(timeout || 100);
    } catch (e) { /* ignore */ }
    return false;
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
    return Date.now() - this.lastUse >= timeToIdle;
};
