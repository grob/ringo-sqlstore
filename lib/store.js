/**
 * @file Store instances represent the underlying database, providing
 * functionality for defining entities, manipulating and querying data.
 * @module store
 */

/**
 * @typedef {Object} java
 * @typedef {Object} java.util
 * @typedef {Object} java.util.HashSet
 * @typedef {Object} java.sql
 * @typedef {Connection} java.sql.Connection
 */

var constants = require("./constants");
var Storable = require("./storable");
var EntityRegistry = require("./entityregistry");
var Key = require("./key");
var Transaction = require("./transaction");
var EntityMapping = require("./mapping/entity");
var query = require("./query/query");
var dbSchema = require("./database/schema");
var metaData = require("./database/metadata");
var statements = require("./database/statements");
var connectionPool = require("./connectionpool");
var log = require('ringo/logging').getLogger(module.id);
var {EventEmitter} = require("ringo/events");

/**
 * Determines the database dialect to use
 * @returns {Dialect} The database dialect
 * @ignore
 */
var determineDialect = function(connectionPool) {
    var driver = connectionPool.getDriverClassName();
    if (driver.indexOf("org.h2") === 0) {
        return require("./dialects/h2/dialect");
    } else if (driver.indexOf("com.mysql.jdbc") === 0) {
        return require("./dialects/mysql/dialect");
    } else if (driver.indexOf("oracle.jdbc") === 0) {
        return require("./dialects/oracle/dialect");
    } else if (driver.indexOf("org.postgresql") === 0) {
        return require("./dialects/postgresql/dialect");
    }
    throw new Error("Unsupported database " + driver);
};

/**
 * Creates a new Store instance
 * @class Instances of this class represent an RDBMS store
 * @param {ConnectionPool} connectionPool The connection pool to use
 * @returns A new Store instance
 * @constructor
 */
var Store = module.exports = function(connectionPool) {

    EventEmitter.call(this);

    var entityCache = null;
    var queryCache = null;

    /**
     * @property {HikariDataSource}
     * @name Store#connectionPool
     */
    Object.defineProperties(this, {
        /**
         * Contains the database dialect implementation of this store
         * @name Store#dialect
         * @type {Dialect}
         * @ignore
         * @readonly
         */
        "dialect": {
            "value": determineDialect(connectionPool)
        },
        /**
         * Contains the entity cache used by this store
         * @name Store#entityCache
         * @type {Cache}
         * @ignore
         * @readonly
         */
        "entityCache": {
            "get": function() {
                return entityCache || null;
            },
            "enumerable": true
        },
        /**
         * Contains the query cache used by this store
         * @name Store#queryCache
         * @type {Cache}
         * @ignore
         * @readonly
         */
        "queryCache": {
            "get": function() {
                return queryCache || null
            },
            "enumerable": true
        },
        /**
         * Contains the connection pool of this store
         * @name Store#connectionPool
         * @type {HikariDataSource}
         * @ignore
         * @readonly
         */
        "connectionPool": {
            "value": connectionPool,
            "enumerable": true
        },
        /**
         * The entity registry of this store
         * @name Store#entityRegistry
         * @type {Object}
         * @ignore
         * @readonly
         */
        "entityRegistry": {
            "value" : new EntityRegistry()
        }
    });

    /**
     * Sets the cache passed as argument as entity data cache of this store
     * @param {Cache} cache The entity cache to use
     */
    this.setEntityCache = function(cache) {
        entityCache = cache;
    };

    /**
     * Sets the cache passed as argument as query cache of this store
     * @param {Cache} cache The query cache to use
     */
    this.setQueryCache = function(cache) {
        queryCache = cache;
    };

    return this;
};

/**
 * Inititalizes the connection pool and returns it
 * @param {Object} props The pool/connection properties to use
 * @returns {HikariDataSource} The initialized connection pool
 */
Store.initConnectionPool = function(props) {
    return connectionPool.init(props);
};

/** @ignore */
Store.prototype.toString = function() {
    return "[Store]";
};

/**
 * Closes all open connections to the database and clears all caches.
 * @this Store
 */
Store.prototype.close = function() {
    this.connectionPool.close();
    this.entityCache && this.entityCache.clear();
    this.queryCache && this.queryCache.clear();
};

/**
 * Returns a database connection object.
 * @returns {java.sql.Connection} A database connection object
 * @this Store
 */
Store.prototype.getConnection = function() {
    return (this.getTransaction() || this.connectionPool).getConnection();
};

/**
 * Defines an entity within this store. This method returns a constructor
 * function for creating new instances of this entity. All entity constructors
 * created by this method are registered within this store and can be
 * retrieved later on using `getEntityConstructor(type)`.
 * @param {String} type The name of the entity constructor
 * @param {Object} definition The database mapping definition, defining the ID column
 * and all (optionally mapped) properties of entity instances.
 * @returns {Storable} The entity constructor function
 * @see #Store.prototype.getEntityConstructor
 * @this Store
 */
Store.prototype.defineEntity = function(type, definition) {
    var entityMapping = EntityMapping.create(this.dialect, type, definition);
    return this.entityRegistry.registerConstructor(type,
            Storable.defineEntity(this, type, entityMapping));
};

/**
 * Registers the given module path(s) in the entity registry
 * @param {String|Array} path The module path, or an array of module paths
 * @this Store
 */
Store.prototype.registerEntityModule = function(path) {
    this.entityRegistry.registerModule(path);
};

/**
 * Syncronizes the database tables and sequences with the defined entity mappings.
 * This method should be called once after all entities have been defined using
 * `defineEntity()`. Note that as of now this method only creates tables and
 * sequences, updates are currently ignored.
 * @this Store
 */
Store.prototype.syncTables = function() {
    var conn = this.getConnection();
    try {
        for each (let ctor in this.entityRegistry.getConstructors()) {
            log.debug("Syncing database table", ctor.mapping.tableName);
            if (!metaData.tableExists(conn, this.dialect, ctor.mapping.tableName, ctor.mapping.schemaName)) {
                this.createTable(conn, this.dialect, ctor.mapping);
            }
            let sequence = ctor.mapping.id.sequence;
            if (sequence && this.dialect.hasSequenceSupport) {
                if (sequence && !metaData.sequenceExists(conn, this.dialect, sequence)) {
                    dbSchema.createSequence(conn, this.dialect, sequence);
                }
            }
            if (ctor.mapping.indexes !== null) {
                for each (let [indexName, properties] in Iterator(ctor.mapping.indexes)) {
                    if (!metaData.indexExists(conn, this.dialect, ctor.mapping.tableName, indexName)) {
                        dbSchema.createIndex(conn, this.dialect, ctor.mapping.schemaName,
                                ctor.mapping.tableName, indexName, properties);
                    }
                }
            }
        }
    } finally {
        conn && conn.close();
    }
};

/**
 * Returns the registered entity constructor for the given type.
 * @param {String} type The name of the registered entity
 * @returns {Function} The entity constructor function
 * @this Store
 */
Store.prototype.getEntityConstructor = function(type) {
    return this.entityRegistry.getConstructor(type);
};

/**
 * Returns the mapping for the given entity
 * @param {String} type The name of the registered entity
 * @returns {Mapping} The mapping of the entity
 * @ignore
 * @this Store
 */
Store.prototype.getEntityMapping = function(type) {
    return this.entityRegistry.getConstructor(type).mapping;
};

/**
 * Utility function for creating a table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The database dialect to use
 * @param {Mapping} mapping The entity mapping definition
 * @ignore
 */
Store.prototype.createTable = function(conn, dialect, mapping) {
    return dbSchema.createTable(conn, dialect, mapping.schemaName,
            mapping.tableName, mapping.mappings, [mapping.id.column]);
};

/**
 * If the storable is persistent, this method loads the entity for it from
 * database and returns it, otherwise it returns an empty object.
 * @param {Storable} storable The storable to get the entity object for
 * @returns {Object} The entity object
 * @ignore
 * @this Store
 */
Store.prototype.getEntity = function(storable) {
    var entity = constants.LOAD_LAZY;
    var cacheKey = storable._cacheKey;
    var transaction = this.getTransaction();
    var useCache = this.entityCache &&
            (!transaction || !transaction.containsKey(cacheKey));
    if (useCache && this.entityCache.containsKey(cacheKey)) {
        entity = this.entityCache.get(cacheKey);
    }
    if (entity === constants.LOAD_LAZY) {
        entity = statements.get(this, storable._key.type, storable._key.id);
        if (useCache === true && entity !== null) {
            this.entityCache.put(cacheKey, entity);
        }
    }
    return entity;
};

/**
 * Removes the data with the given key from the database
 * @param {Storable} storable The storable to remove from the database
 * @param {Object} transaction Optional transaction object
 * @ignore
 */
Store.prototype.remove = function(storable, transaction) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    // load the entity from database if necessary to get the last state of it
    // (this is needed in transaction to evict mapped collections too)
    // FIXME: is this really necessary?
    if (storable._entity === constants.LOAD_LAZY &&
            (typeof(storable.onRemove) === "function" ||
                    storable.constructor.mapping.collections.length > 0)) {
        storable._entity = statements.get(this, storable._key.type, storable._key.id);
    }
    try {
        statements.remove(storable, transaction);
        if (hasAutoTransaction) {
            transaction.commit();
        }
    } catch (e) {
        if (hasAutoTransaction) {
            transaction.rollback();
        }
        throw e;
    }
};

/**
 * Stores the modifications to the storable passed as argument in the underlying
 * database. Note that this method additionally saves any transient mapped objects too.
 * @param {Storable} storable The storable whose entity should be updated
 * @param {Transaction} transaction Optional transaction
 * @param {java.util.HashSet} visited Optional hash set used to detect circular references
 * @param {Array} delayed An array containing callbacks for delayed updates
 * @ignore
 */
Store.prototype.updateEntity = function(storable, transaction, visited, delayed) {
    var mapping = storable.constructor.mapping;
    // store values in a new object, not in the _entity object of the storable.
    // the latter is in the store's entity cache, so modifying it would mean
    // that other threads accessing this entity object would get new values
    // that haven't been stored in database until this storable is committed.
    var newEntity = {};
    var isTransient = storable._state === constants.STATE_TRANSIENT;
    if (storable._entity === constants.LOAD_LAZY) {
        storable._entity = this.getEntity(storable);
    }
    newEntity[mapping.id.column] = storable._key.id;
    for each (let propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping) {
            continue;
        }
        let propValue = null;
        if (storable._props.hasOwnProperty(propMapping.name)) {
            propValue = storable._props[propMapping.name];
            if (propMapping.isObjectMapping && propValue != null) {
                if (!propValue._key || propValue._key.type !== propMapping.entity) {
                    throw new Error(propMapping.name + " must be an instance of "
                            + propMapping.entity);
                } else if (propValue._state !== constants.STATE_CLEAN) {
                    if (visited.contains(propValue._key)) {
                        // circular mapping - schedule an update of the child
                        // until the parent is saved
                        delayed.push((function(obj, column, mappedObj) {
                            return function() {
                                obj._entity[column] = mappedObj.id;
                                statements.update(obj, transaction);
                            };
                        })(storable, propMapping.column, propValue));
                        // use -1 as temporary value to avoid violating
                        // not-null constraints
                        propValue = -1;
                    } else {
                        this.persist(propValue, transaction, visited, delayed);
                        propValue = propValue.id;
                    }
                } else {
                    propValue = propValue.id;
                }
            }
        } else if (!isTransient && storable._entity.hasOwnProperty(propMapping.column)) {
            propValue = storable._entity[propMapping.column];
        }
        newEntity[propMapping.column] = propValue;
    }
    // swap entity objects - if the statement or commit fails, the storable will
    // still have it's updated values, but its _state will be reverted
    storable._entity = newEntity;
};

/**
 * Saves the storable in the database.
 * @param {Storable} storable The storable to save
 * @param {Transaction} transaction Optional transaction object
 * @ignore
 */
Store.prototype.save = function(storable, transaction) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    var delayed = [];
    var visited = new java.util.HashSet();
    try {
        this.persist(storable, transaction, visited, delayed);
        if (delayed.length > 0) {
            delayed.forEach(function(callback) {
                callback();
            });
        }
        if (hasAutoTransaction) {
            transaction.commit();
        }
    } catch (e) {
        if (hasAutoTransaction) {
            transaction.rollback();
        }
        throw e;
    }
};

Store.prototype.persist = function(storable, transaction, visited, delayed) {
    if (storable._state === constants.STATE_DELETED) {
        throw new Error("Unable to save " + storable + ", it has been removed before");
    }
    if (!visited.contains(storable._key)) {
        visited.add(storable._key);
        this.updateEntity(storable, transaction, visited, delayed);
        if (storable._state === constants.STATE_TRANSIENT) {
            statements.insert(storable, transaction);
        } else if (storable._state === constants.STATE_DIRTY) {
            statements.update(storable, transaction);
        }
        storable._state = constants.STATE_CLEAN;
    }
};

/**
 * Starts a new transaction. Note that the transaction is bound to the thread,
 * so any SQL query issued during an open transaction is using the same
 * database connection.
 * @returns {Transaction} The newly opened transaction
 */
Store.prototype.beginTransaction = function() {
    return Transaction.createInstance(this);
};

/**
 * Returns the current transaction, or null if none has been opened.
 * @returns {Transaction} The current transaction
 */
Store.prototype.getTransaction = function() {
    return Transaction.getInstance();
};

/**
 * Returns true if there is a transaction bound to the current thread.
 * @returns {Boolean} True if a transaction is bound to the current thread
 */
Store.prototype.hasTransaction = function() {
    return Transaction.getInstance() !== null;
};

/**
 * Commits the transaction bound to the current thread and closes it.
 */
Store.prototype.commitTransaction = function() {
    var transaction = Transaction.getInstance();
    if (transaction == null) {
        throw new Error("No open transaction to commit");
    }
    transaction.commit();
};

/**
 * Aborts (i.e. rolls back) the transaction bound to the current thread and
 * closes it.
 */
Store.prototype.abortTransaction = function() {
    var transaction = Transaction.getInstance();
    if (transaction == null) {
        throw new Error("No open transaction to abort");
    }
    transaction.rollback();
};


/******************************************
 *****    Q U E R Y   S U P P O R T   *****
 ******************************************/


/**
 * Returns the result of the given query
 * @param {String} queryStr The query string
 * @param {Object} nparams Optional object containing the named parameters
 * referenced in the query
 * @returns {Array} The result of the query
 */
Store.prototype.query = function(queryStr, nparams) {
    return query.query(this, queryStr, nparams);
};

/**
 * Returns the result of the given raw SQL query
 * @param {String} queryStr The SQL query string
 * @param {Array} params Optional array containing parameter values referenced
 * in the query
 * @returns {Array} An array of objects containing the query results
 */
Store.prototype.sqlQuery = function(queryStr, params) {
    return query.sqlQuery(this, queryStr, params);
};

/**
 * Loads an entity from database and returns an instance of the
 * appropriate registered constructor
 * @param {String} type The name of the registered constructor
 * @param {Number} id The id of the entity to return
 * @param {Boolean} aggressive If true the entity is loaded as a whole,
 * otherwise only an empty entity is constructed and its properties
 * are loaded whenever they're first accessed.
 * @returns {Storable} An instance of the registered constructor function
 * @ignore
 * @this Store
 */
Store.prototype.get = function(type, id, aggressive) {
    var key = new Key(type, id);
    var entity = null;
    var transaction = this.getTransaction();
    var useCache = this.entityCache &&
            (!transaction || !transaction.containsKey(key.cacheKey));
    if (useCache && this.entityCache.containsKey(key.cacheKey)) {
        entity = this.entityCache.get(key.cacheKey);
        return this.entityRegistry.getConstructor(type).createInstance(key, entity);
    }
    if (aggressive === true) {
        entity = statements.get(this, type, id);
    } else if (statements.exists(this, type, id) === true) {
        entity = constants.LOAD_LAZY;
    }
    if (entity !== null) {
        if (useCache) {
            this.entityCache.put(key.cacheKey, entity);
        }
        return this.entityRegistry.getConstructor(type).createInstance(key, entity);
    }
    return null;
};

/**
 * Retrieves all instances of the given type from the database
 * @param {String} type The type
 * @param {Boolean} aggressive If true the instances are loaded aggressively
 * @returns {Array} An array containing all instances of the given type
 */
Store.prototype.all = function(type, aggressive) {
    if (aggressive === true) {
        return query.query(this, "select * from " + type);
    }
    return query.query(this, "from " + type);
};
