/**
 * @fileoverview Provides various utility functions for instantiating JDBC
 * connection pools
 */
var objects = require("ringo/utils/objects");
var fs = require("fs");

/**
 * Loads all .jar files placed in the `jars` directory of SqlStore
 * @ignore
 */
var loadJars = exports.loadJars = function() {
    // add all jar files in jars directory to classpath
    var dir = module.resolve("../../../jars/");
    fs.list(dir).forEach(function(file) {
        if (fs.extension(file) === ".jar") {
            addToClasspath(fs.join(dir, file));
        }
    });
};

/**
 * Factory method for creating and initializing a connection pool. If the props
 * argument contains a `pool` property, this method returns one of the following
 * connection pools (provided that the necessary jar files have been placed
 * into the `jars` directory of SqlStore):
 *
 * - `c3p0` creates a c3p0 datasource
 * - `boneCP` creates a BoneCP datasource
 *
 * If no `pool` property is set, the standard connection pool is instantiated.
 * @example
 * // standard connection pool connecting to a h2 in-memory database
 * initConnectionPool({
 *     "url": "jdbc:h2:mem:databasename;MVCC=TRUE",
 *     "driver": "org.h2.Driver"
 * })
 *
 * // standard connection pool connecting to a MySQL database
 * // (this needs the MySQL JDBC driver jar in the `jars`
 * // directory of SqlStore)
 * initConnectionPool({
 *     "url": "jdbc:mysql://localhost/databasename",
 *     "driver": "com.mysql.jdbc.Driver",
 *     "user": "test",
 *     "password": "secret"
 * })
 *
 * // c3p0 connection pool connecting to a PostgreSQL database -  for this
 * // the PostgreSQL JDBC driver jar and the c3p0 jar files must be present
 * // in the `jars` directory of SqlStore.
 * // For further configuration of the pool define the appropriate properties
 * // in the object passed as argument
 * initConnectionPool({
 *     "pool": "c3p0",
 *     "url": "jdbc:postgresql://localhost/databasename",
 *     "driver": "org.postgresql.Driver",
 *     "user": "test",
 *     "password": "secret",
 *     "minPoolSize": 5,
 *     "acquireIncrement": 2,
 *     "numHelperThreads": 6,
 *     "maxPoolSize": 20,
 *     "maxStatementsPerConnection": 10,
 * })
 *
 * // BoneCP connection pool connecting to an Oracle database - for this
 * // the Oracle JDBC driver jar and the BoneCP jar files must be present
 * // in the `jars` directory of SqlStore
 * // For further configuration of the pool define the appropriate properties
 * // in the object passed as argument
 * initConnectionPool({
 *     "pool": "boneCP",
 *     "url": "jdbc:postgresql://localhost/databasename",
 *     "driver": "org.postgresql.Driver",
 *     "user": "test",
 *     "password": "secret",
 *     "minConnectionsPerPartition": 5,
 *     "acquireIncrement": 5,
 *     "maxConnectionsPerPartition": 20,
 *     "partitionCount": 1,
 * })
 *
 * @param {Object} props The connection pool properties.
 * @returns The connection pool
 * @see http://www.mchange.com/projects/c3p0/
 * @see http://jolbox.com/
 */
exports.initConnectionPool = function(props) {
    if (props.hasOwnProperty("pool")) {
        props = objects.clone(props);
        var poolType = props.pool.toLowerCase();
        delete props.pool;
        if (poolType === "c3p0") {
            return initC3p0(props);
        } else if (poolType === "bonecp") {
            return initBoneCP(props);
        } else {
            throw new Error("Unknown connection pool type '" + poolType + "'");
        }
    }
    return initJsConnectionPool(props);
};

/**
 * Initializes the standard connection pool
 * @param {Object} props The connection pool properties.
 * @returns {ConnectionPool} The connection pool
 * @ignore
 */
var initJsConnectionPool = exports.initJsConnectionPool = function(props) {
    var {ConnectionPool} = require("./pool");
    return new ConnectionPool(props);
};

/**
 * Initializes a c3p0 connection pool data source, provided that the necessary
 * jar files have been placed in the `jars` directory of SqlStore.
 * @param {Object} props The connection pool properties.
 * @returns {com.mchange.v2.c3p0.ComboPooledDataSource} The connection pool
 * @see http://www.mchange.com/projects/c3p0/
 * @ignore
 */
var initC3p0 = exports.initC3p0 = function(props) {
    loadJars();
    var dataSource = new com.mchange.v2.c3p0.ComboPooledDataSource();
    dataSource.setDriverClass(props.driver);
    dataSource.setJdbcUrl(props.url);
    dataSource.setUser(props.user);
    dataSource.setPassword(props.password);
    for each (let [key, value] in Iterator(props)) {
        if (["driver", "url", "user", "password"].indexOf(key) > -1) {
            continue;
        }
        dataSource[key] = value;
    }
    return dataSource;
};

/**
 * Initializes a BoneCP connection pool data source, provided that the necessary
  * jar files have been placed in the `jars` directory of SqlStore.
 * @param {Object} props The connection pool properties.
 * @returns {com.jolbox.bonecp.BoneCPDataSource} The connection pool
 * @see http://jolbox.com/
 * @ignore
 */
var initBoneCP = exports.initBoneCP = function(props) {
    loadJars();
    var dataSource = new com.jolbox.bonecp.BoneCPDataSource();
    dataSource.setDriverClass(props.driver);
    dataSource.setJdbcUrl(props.url);
    dataSource.setUsername(props.user);
    dataSource.setPassword(props.password);
    for each (let [key, value] in Iterator(props)) {
        if (["driver", "url", "user", "password"].indexOf(key) > -1) {
            continue;
        }
        dataSource[key] = value;
    }
    return dataSource;
};
