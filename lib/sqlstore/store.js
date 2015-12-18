/**
 * @fileoverview Store instances represent the underlying database, providing
 * functionality for defining entities, manipulating and querying data.
 */
var constants = require("./constants");
var {Storable} = require("./storable");
var {EntityRegistry} = require("./entityregistry");
var {Key} = require("./key");
var {Transaction} = require("./transaction");
var EntityMapping = require("./mapping/entity");
var query = require("./query/query");
var objects = require("ringo/utils/objects");
var dbSchema = require("./database/schema");
var connectionPool = require("./connectionpool");
var log = require('ringo/logging').getLogger(module.id);
var {EventEmitter} = require("ringo/events");

/**
 * Determines the database dialect to use
 * @returns {BaseDialect} The database dialect
 * @ignore
 */
var determineDialect = function(connectionPool) {
    var driver = connectionPool.getDriverClassName();
    if (driver.indexOf("org.h2") === 0) {
        return require("./dialects/h2/dialect");
    } else if (driver.indexOf("com.mysql.jdbc") === 0) {
        return require("./dialects/mysql5/dialect");
    } else if (driver.indexOf("oracle.jdbc.driver") === 0) {
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
 * @see connection/pool
 */
var Store = exports.Store = function(connectionPool) {

    EventEmitter.call(this);

    var entityCache = null;
    var queryCache = null;

    Object.defineProperties(this, {
        /**
         * Contains the database dialect implementation of this store
         * @type BaseDialect
         * @ignore
         */
        "dialect": {
            "value": determineDialect(connectionPool)
        },
        /**
         * Contains the entity cache used by this store
         * @type Cache
         * @ignore
         */
        "entityCache": {
            "get": function() {
                return entityCache || null;
            },
            "enumerable": true
        },
        /**
         * Contains the query cache used by this store
         * @type Cache
         * @ignore
         */
        "queryCache": {
            "get": function() {
                return queryCache || null
            },
            "enumerable": true
        },
        /**
         * Contains the connection pool of this store
         * @type ConnectionPool
         * @ignore
         */
        "connectionPool": {
            "value": connectionPool,
            "enumerable": true
        },
        /**
         * The entity registry of this store
         * @type Object
         * @ignore
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
 */
Store.prototype.close = function() {
    this.connectionPool.close();
    this.entityCache && this.entityCache.clear();
    this.queryCache && this.queryCache.clear();
};

/**
 * Returns a database connection object.
 * @returns {java.sql.Connection} A database connection object
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
 * @returns {Function} The entity constructor function
 * @see #Store.prototype.getEntityConstructor
 */
Store.prototype.defineEntity = function(type, definition) {
    var entityMapping = EntityMapping.create(this.dialect, type, definition);
    return this.entityRegistry.registerConstructor(type,
            Storable.defineEntity(this, type, entityMapping));
};

/**
 * Registers the given module path(s) in the entity registry
 * @param {String|Array} path The module path, or an array of module paths
 */
Store.prototype.registerEntityModule = function(path) {
    this.entityRegistry.registerModule(path);
};

/**
 * Syncronizes the database tables and sequences with the defined entity mappings.
 * This method should be called once after all entities have been defined using
 * `defineEntity()`. Note that as of now this method only creates tables and
 * sequences, updates are currently ignored.
 */
Store.prototype.syncTables = function() {
    var conn = this.getConnection();
    try {
        for each (let ctor in this.entityRegistry.getConstructors()) {
            let schemaName = ctor.mapping.schemaName ||
                    this.dialect.getDefaultSchema(conn);
            log.debug("Syncing database table", ctor.mapping.tableName);
            if (!dbSchema.tableExists(conn, ctor.mapping.tableName, schemaName)) {
                this.createTable(conn, this.dialect, ctor.mapping);
                ctor.mapping.id.sequence.create(conn, this.dialect);
            } else {
                // TODO: update table
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
 */
Store.prototype.getEntityConstructor = function(type) {
    return this.entityRegistry.getConstructor(type);
};

/**
 * Returns the mapping for the given entity
 * @param {String} type The name of the registered entity
 * @returns {Mapping} The mapping of the entity
 * @ignore
 */
Store.prototype.getEntityMapping = function(type) {
    return this.entityRegistry.getConstructor(type).mapping;
};

/**
 * Utility function for creating a new or updating an existing table
 * @param {java.sql.Connection} conn The connection to use
 * @param {BaseDialect} dialect The database dialect to use
 * @param {Mapping} mapping The entity mapping definition
 * @ignore
 */
Store.prototype.createTable = function(conn, dialect, mapping) {
    // create table
    var columns = [mapping.id];
    var primaryKeys = [mapping.id.column];
    for each (let propMapping in mapping.properties) {
        // ignore collection mappings
        if (propMapping.isCollectionMapping) {
            continue;
        }
        columns.push(propMapping);
        if (propMapping.unique === true) {
            primaryKeys.push(propMapping.column);
        }
    }
    return dbSchema.createTable(conn, dialect, mapping.schemaName, mapping.tableName,
             columns, primaryKeys);
};

/**
 * Queries the database using the given sql statement, and returns the result
 * @param {String} sql The SQL statement to execute
 * @param {Array} parameters An array containing the statement parameters. Each entry
 * must be an object containing a property "type" (the type of the parameter)
 * and "value" (containing the parameter value).
 * @param {Function} collectorFunc The collector to extract result set data
 * @returns {Array} The result of the database query, where each result is an object
 * containing the column names with their values
 * @ignore
 */
Store.prototype.executeQuery = function(sql, parameters, collectorFunc) {
    var conn = null;
    var statement = null;
    try {
        conn = this.getConnection();
        if (log.isDebugEnabled()) {
            log.debug("Executing query", sql, parameters.toSource());
        }
        statement = conn.prepareStatement(sql, java.sql.ResultSet.TYPE_FORWARD_ONLY,
                java.sql.ResultSet.CONCUR_READ_ONLY);
        parameters.forEach(function(param, idx) {
            param.dataType.set(statement, idx + 1, param.value);
        });
        return collectorFunc(statement.executeQuery(), this);
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn != null && !this.hasTransaction()) {
            conn.close();
        }
    }
};

/**
 * Executes a data manipulating statement (insert/update/delete)
 * @param {String} sql The SQL statement
 * @param {Array} parameters An array containing the statement parameters. Each entry
 * must be an object containing a property "type" (the type of the parameter)
 * and "value" (containing the parameter value).
 * @param {Transaction} transaction The transaction
 * @returns The result as received from the database
 * @ignore
 */
Store.prototype.executeUpdate = function(sql, parameters, transaction) {
    var conn = null;
    var statement = null;
    var retries = 5;
    var retry = false;
    do {
        try {
            conn = transaction.getConnection();
            statement =  conn.prepareStatement(sql);
            parameters.forEach(function(param, idx) {
                if (param.value === undefined || param.value === null) {
                    statement.setNull(idx + 1, java.sql.Types.NULL);
                } else {
                    param.dataType.set(statement, idx + 1, param.value);
                }
            });
            return statement.executeUpdate();
        } catch (e if e.javaException instanceof java.sql.SQLTransactionRollbackException) {
            if (retries === 0) {
                throw e;
            }
            retry = true;
            if (log.isDebugEnabled()) {
                log.warn("Retrying statement", sql, parameters.map(function(param) {
                    return param.value;
                }).toSource());
            }
            // be nice, wait a bit
            java.lang.Thread.sleep(50);
        } catch (e) {
            throw e;
        } finally {
            statement && statement.close();
        }
    } while (retry === true && retries-- > 0);
};

/**
 * If the storable is persistent, this method loads the entity for it from
 * database and returns it, otherwise it returns an empty object.
 * @param {Storable} storable The storable to get the entity object for
 * @returns {Object} The entity object
 * @ignore
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
        entity = this.loadEntity(storable._key.type, storable._key.id);
        if (useCache) {
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
    var mapping = storable.constructor.mapping;
    var sql = "DELETE FROM " + this.dialect.quote(mapping.tableName, mapping.schemaName) +
            " WHERE " + this.dialect.quote(mapping.id.column) + " = ?";
    var parameters = [{
        "dataType": mapping.id.dataType,
        "value": storable.id
    }];
    // execute delete
    if (log.isDebugEnabled()) {
        log.debug("Deleting", storable._key, sql);
    }
    // load the entity from database if necessary to get the last state of it
    // (this is needed in transaction to evict mapped collections too)
    if (storable._entity === constants.LOAD_LAZY &&
            (typeof(storable.onRemove) === "function" ||
                    storable.constructor.mapping.collections.length > 0)) {
        storable._entity = this.loadEntity(storable._key.type, storable._key.id);
    }
    var result = this.executeUpdate(sql, parameters, transaction);
    transaction.addDeleted(storable);
    if (hasAutoTransaction) {
        transaction.commit();
    }
    return result;
};

/**
 * Stores the modifications to the storable passed as argument in the underlying
 * database. Note that this method additionally saves any transient mapped objects too.
 * @param {Storable} storable The storable whose entity should be updated
 * @param {Transaction} transaction Optional transaction
 * @param {java.util.HashSet} visited Optional hash set used to detect circular references
 * @ignore
 */
Store.prototype.updateEntity = function(storable, transaction, visited) {
    var mapping = storable.constructor.mapping;
    // store values in a new object, not in the _entity object of the storable.
    // the latter is in the store's entity cache, so modifying it would mean
    // that other threads accessing this entity object would get new values
    // that haven't been stored in database until this storable is committed.
    var newEntity = {};
    var isTransient = storable._state === constants.STATE_TRANSIENT;
    if (isTransient === true) {
        if (!storable._key.id) {
            storable._key.id = mapping.id.sequence.getNextId(this);
        }
    } else if (storable._entity === constants.LOAD_LAZY) {
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
            if (propValue != null && propMapping.isObjectMapping) {
                if (!propValue._key || propValue._key.type !== propMapping.entity) {
                    throw new Error(propMapping.name + " must be an instance of "
                            + propMapping.entity);
                } else if (propValue._state !== constants.STATE_CLEAN) {
                    propValue.save(transaction, visited);
                }
                propValue = propValue.id;
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
 * Stores the storable passed as argument in the underlying database.
 * @param {Storable} storable The storable to insert into database
 * @param {Transaction} transaction Optional transaction instance
 * @ignore
 */
Store.prototype.insert = function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var values = [];
    var parameters = [];
    var sql = "INSERT INTO " + this.dialect.quote(mapping.tableName, mapping.schemaName) +
            " (" + this.dialect.quote(mapping.id.column);

    // id column
    values.push("?");
    parameters.push({
        "dataType": mapping.id.dataType,
        "value": storable._key.id
    });

    // collect statement parameters
    for each (let propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping) {
            continue;
        }
        // ignore properties that are null or undefined
        let value = storable._entity[propMapping.column];
        if (value === null || value === undefined) {
            continue;
        }
        sql += ", " + this.dialect.quote(propMapping.column);
        values.push("?");
        parameters.push({
            "dataType": propMapping.dataType,
            "value": value
        });
    }
    sql += ") VALUES (" + values.join(", ") + ")";

    if (log.isDebugEnabled()) {
        log.debug("Inserting", storable._key, sql);
    }
    var result = this.executeUpdate(sql, parameters, transaction);
    transaction.addInserted(storable);
    return result;
};

/**
 * Updates the database row represented by the storable passed as argument.
 * @param {Storable} storable The storable to update in database
 * @param {Transaction} transaction Optional transaction instance
 * @ignore
 */
Store.prototype.update = function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var sqlBuf = ["UPDATE ", this.dialect.quote(mapping.tableName, mapping.schemaName), " SET "];
    var parameters = [];

    for each (let propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping) {
            continue;
        }
        if (parameters.length > 0) {
            sqlBuf.push(", ");
        }
        sqlBuf.push(this.dialect.quote(propMapping.column), " = ?");
        parameters.push({
            "dataType": propMapping.dataType,
            "value": storable._entity[propMapping.column]
        });
    }
    sqlBuf.push(" WHERE ", this.dialect.quote(mapping.id.column), " = ?");
    parameters.push({
        "dataType": mapping.id.dataType,
        "value": storable._key.id
    });

    // execute update
    if (log.isDebugEnabled()) {
        log.debug("Updating", storable._key, sqlBuf.join(""));
    }
    var result = this.executeUpdate(sqlBuf.join(""), parameters, transaction);
    transaction.addUpdated(storable);
    return result;
};

/**
 * Saves the storable in the database.
 * @param {Storable} storable The storable to save
 * @param {Transaction} transaction Optional transaction object
 * @param {java.util.HashSet} visited Optional hash set used to detect circular references
 * @ignore
 */
Store.prototype.save = function(storable, transaction, visited) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    try {
        this.updateEntity(storable, transaction, visited);
        if (storable._state === constants.STATE_TRANSIENT) {
            this.insert(storable, transaction);
        } else {
            this.update(storable, transaction);
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

/**
 * Loads an entity from the database
 * @param {String} type The name of the defined entity
 * @param {Number} id The ID of the row to retrieve
 * @returns {Object} The entity object, populated with the values received
 * from the database
 * @ignore
 */
Store.prototype.loadEntity = function(type, id) {
    var mapping = this.getEntityMapping(type);
    var sql = ["SELECT", mapping.mappings.map(function(propMapping) {
            return this.dialect.quote(propMapping.column);
        }, this).join(", "), "FROM", this.dialect.quote(mapping.tableName, mapping.schemaName),
        " WHERE", this.dialect.quote(mapping.id.column), "= ?"].join(" ");
    var parameters = [{
        "dataType": mapping.id.dataType,
        "value": id
    }];
    var entities = this.executeQuery(sql, parameters, function(resultSet) {
        var result = [];
        while (resultSet.next()) {
            let entity = {};
            mapping.mappings.forEach(function(columnMapping, idx) {
                entity[columnMapping.column] =
                        columnMapping.dataType.get(resultSet, idx + 1);
            });
            result.push(entity);
        }
        return result;
    });
    if (entities.length > 1) {
        throw new Error("Multiple rows returned by query");
    } else if (entities.length === 1) {
        return entities[0];
    }
    return null;
};

/**
 * Returns true if there is an entity with the given ID stored in database
 * @param {String} type The name of the defined entity
 * @param {Number} id The ID to check for existance
 * @returns {Boolean} True if the database has a row for the given type and ID,
 * false otherwise
 * @ignore
 */
Store.prototype.isEntityExisting = function(type, id) {
    var mapping = this.getEntityMapping(type);
    var idColumn = this.dialect.quote(mapping.id.column);
    var sql = ["SELECT", idColumn, "FROM",
               this.dialect.quote(mapping.tableName, mapping.schemaName),
               "WHERE", idColumn, "= ?"].join(" ");
    var parameters = [{
        "dataType": mapping.id.dataType,
        "value": id
    }];
    var result = this.executeQuery(sql, parameters, function(resultSet) {
        var result = [];
        while (resultSet.next()) {
            result.push(mapping.id.dataType.get(resultSet, 1));
        }
        return result;
    });
    if (result.length > 1) {
        throw new Error("Multiple rows returned by query " + sql);
    }
    return result.length === 1;
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
 * @returns An instance of the registered constructor function
 * @ignore
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
        entity = this.loadEntity(type, id);
    } else if (this.isEntityExisting(type, id) === true) {
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
 * @returns {Array} An array containing all instances of the given type
 */
Store.prototype.all = function(type) {
    return query.query(this, "from " + type);
};
