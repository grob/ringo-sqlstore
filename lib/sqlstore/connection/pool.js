/**
 * @fileoverview Basic JDBC connection pool implementation.
 */
var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");
var {ArrayList, Properties} = java.util;
var {Thread, Class} = java.lang;
var fs = require("fs");
var {loadJars} = require("./util");
var Connection = require("./connection");

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
    var inUseConnections = new ArrayList(limit || 100);
    var idleConnections = new ArrayList(limit || 100);
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
            } else {
                // try to close the connection to free any resources
                if (log.isDebugEnabled()) {
                    log.debug("Closing/removing invalid connection", conn);
                }
                try {
                    conn.connection.close();
                    conn = null;
                } catch (e) {
                    // ignore
                }
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
    this.size = sync(function() {
        return inUseConnections.size() + idleConnections.size();
    }, lock);

    /**
     * Loops over all connections and closes them. This method also stops
     * the worker cleaning up stale connections.
     * @returns undefined
     */
    this.close = sync(function() {
        worker.postMessage("stop");
        worker.terminate();
        for each (let list in [inUseConnections, idleConnections]) {
            let iter = list.iterator();
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
                let conn = iter.next();
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
 * Returns the class name of the JDBC driver used by this connection pool
 * @returns {String} The driver class name
 */
ConnectionPool.prototype.getDriverClass = function() {
    return this.getDriver().getClass().getName();
};
