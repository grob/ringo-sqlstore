/**
 * @fileoverview Basic JDBC connection pool implementation.
 */
var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");
var {Vector, Properties} = java.util;
var {Thread, Class} = java.lang;
var fs = require("fs");
var {loadJars} = require("./util");

/**
 * Creates a new connection pool instance
 * @class Instances of this class represent a connection pool
 * @param {Object} props The connection properties to use
 * @returns A newly created connection pool
 * @constructor
 */
var ConnectionPool = exports.ConnectionPool = function(props) {
    loadJars();
    var limit = props.maxConnections || 0;
    var properties = new Properties();
    for each (let [key, value] in Iterator(props)) {
        if (key === "maxConnections") {
            continue;
        }
        if (key === "username") {
            key = "user";
        }
        properties.put(key, value);
    }
    var driver = null;
    var lock = {};
    var inUseConnections = new Vector();
    var idleConnections = new Vector();
    // create a worker for cleaning up stale connections and start it
    var worker = new Worker(module.resolve("./poolworker"));
    worker.onmessage = (function() {
        this.closeStaleConnections();
    }).bind(this);
    worker.postMessage("start");

    /**
     * Returns the driver used by this connection pool
     * @returns {java.sql.Driver} The driver
     * @ignore
     */
    this.getDriver = function() {
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
     * Returns the class name of the JDBC driver used by this connection pool
     * @returns {String} The driver class name
     */
    this.getDriverClass = function() {
        return this.getDriver().getClass().getName();
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
                        properties.get("url") + ", user:",
                        properties.get("user") + ")");
            }
            conn = new Connection(this,
                    this.getDriver().connect(properties.get("url"), properties));
            conn.setReadOnly(true);
            conn.setAutoCommit(true);
            inUseConnections.add(conn);
        } else {
            throw new Error("Connection limit " + limit + " reached");
        }
        return conn;
    }, lock);

    /**
     * Releases the connection passed as argument
     * @type {Connection} conn The connection to release
     * @ignore
     */
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
     * Loops over all connections and closes them. This method also stops
     * the worker cleaning up stale connections.
     * @returns undefined
     */
    this.close = sync(function() {
        worker.postMessage("stop");
        worker.terminate();
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
     * @ignore
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
     * Loops over all idle connections and closes all that are stale. This
     * method is called by a worker in regular intervals.
     * @ignore
     */
    this.closeStaleConnections = sync(function() {
        if (!idleConnections.isEmpty()) {
            var iter = idleConnections.iterator();
            while (iter.hasNext()) {
                var conn = iter.next();
                if (conn.isStale()) {
                    conn.connection.close();
                    iter.remove();
                    log.info("Closed stale connection", conn);
                }
            }
        }
    }, lock);

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
        "lastUse": {"value": Date.now(), "writable": true}
    });

    /**
     * Marks this connection as not-in-use, but doesn't close it.
     * @ignore
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
 * Returns true if this connection is still valid. This method connects to the
 * database if it wasn't used for one minute or if the `force` argument is given,
 * otherwise it returns true.
 * @param {Number} timeout Optional timeout value (defaults to 100ms)
 * @param {Boolean} force If true connection is tested regardless of last use
 * @returns {Boolean} True if this connection is still valid
 * @ignore
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
 * @returns {Boolean} True if this connection is stale
 */
Connection.prototype.isStale = function(timeToIdle) {
    if (timeToIdle == undefined) {
        timeToIdle = Connection.TIME_TO_IDLE;
    }
    return Date.now() - this.lastUse >= timeToIdle;
};
