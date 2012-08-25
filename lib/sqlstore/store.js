export("Store");

var {Storable} = require("./storable");
var {Key} = require("./key");
var {Transaction} = require("./transaction");
var {Mapping} = require("./mapping");
var {ConnectionPool} = require("./connectionpool");
var {Query} = require("./query/query");
var {Cache, createCacheKey} = require("./cache");
var {Collection} = require("./collection");
var objects = require("ringo/utils/objects");
var sqlUtils = require("./util");
var log = require('ringo/logging').getLogger(module.id);

/**
 * Returns true if the argument is a storable
 * @param {Object} arg The value to check
 * @returns True if the argument is a storable, false otherwise
 * @type Boolean
 */
function isStorable(arg) {
    return arg != null && arg instanceof Storable;
}

/**
 * Returns true if the value passed as argument is an entity (the object
 * containing the values read from database).
 * @param {Object} value The value to check
 * @returns True if the value is an entity, false otherwise
 * @type Boolean
 */
function isEntity(value) {
    return value instanceof Object
            && !isStorable(value)
            && isKey(value._key);
}

/**
 * Returns a new Store instance
 * @class Instances of this class represent a RDBMS store
 * @param {Object} props The database connection properties
 * @param {Number} maxConnections The maximum number of database connections
 * @returns A new Store instance
 * @constructor
 */
var Store = function(props, opts) {
    var options = objects.clone(opts, {
        "maxConnections": 10,
        "cacheSize": 1000
    });
    var dialect = null;
    var entityRegistry = {};
    var connectionPool = new ConnectionPool(props, options.maxConnections);
    var store = this;
    var cache = (options.cacheSize > 0) ? new Cache(options.cacheSize) : null;
    var queryCache = new Cache(options.queryCacheSize);

    Object.defineProperties(this, {
        /**
         * Contains the database dialect implementation of this store
         * @type Dialect
         */
        "dialect": {
            "get": function() {
                return dialect || (dialect = this.determineDialect())
            }
        },
        /**
         * Contains the object cache of this store
         * @type Cache
         */
        "cache": {"value": cache},
        /**
         * Contains the object cache of this store
         * @type Cache
         */
        "queryCache": {"value": queryCache},
        /**
         * Contains the connection pool of this store
         * @type ConnectionPool
         */
        "connectionPool": {"value": connectionPool}
    });

    /**
     * Returns a database connection object.
     * @returns A database connection object
     * @type java.sql.Connection
     */
    this.getConnection = function() {
        return (this.getTransaction() || connectionPool).getConnection();
    };

    /**
     * Defines an entity within this store
     * @param {String} type The name of the entity constructor
     * @param {Object} mapping The database mapping object, defining the ID column
     * and all (optionally mapped) properties of the entity instances
     * @returns The constructor function
     * @type Function
     */
    this.defineEntity = function(type, mapping) {
        var ctor = entityRegistry[type];
        if (!ctor) {
            var m = new Mapping(this, type, mapping);
            ctor = entityRegistry[type] = Storable.defineEntity(this, type, m);
            ctor.get = function(id, aggressive) {
                return store.get(type, id, aggressive);
            };
            ctor.all = function() {
                return store.all(type);
            };
            // create the table if it doesn't exist already
            var conn = this.getConnection();
            try {
                var schemaName = m.schemaName || this.dialect.getDefaultSchema(conn);
                if (sqlUtils.tableExists(conn, m.tableName, schemaName) === false) {
                    this.createTable(conn, this.dialect, m);
                    if (m.id.hasSequence() && this.dialect.hasSequenceSupport()) {
                        sqlUtils.createSequence(conn, this.dialect, m.schemaName, m.id.sequence);
                    }
                } else {
                    // TODO: update table
                }
            } finally {
                sqlUtils.close(conn);
            }
        }
        return ctor;
    };

    /**
     * Returns the registered entity constructor for the given type
     * @param {String} type The name of the registered entity
     * @returns The entity constructor function
     * @type Function
     */
    this.getEntityConstructor = function(type) {
        var ctor = entityRegistry[type];
        if (ctor === null || ctor === undefined) {
            throw new Error("Entity '" + type + "' is not defined");
        }
        return ctor;
    };

    /**
     * Returns true if the object cache of this store is enabled
     * @returns True if the cache is enabled
     * @type Boolean
     */
    this.isCacheEnabled = function() {
        return cache !== null;
    };

    return this;
};

/**
 * Creates an entity object containing the values received from the database
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Number} columnCount The number of columns in the result set
 * @returns A newly constructed entity object
 * @type Object
 */
Store.prototype.createEntity = function(mapping, resultSet, metaData, columnCount) {
    var entity = {};
    for (var i=1; i<=columnCount; i+=1) {
        var columnName = metaData.getColumnName(i);
        var propMapping = mapping.columns[columnName];
        if (propMapping == null) {
            // unmapped column, ignore
            continue;
        }
        var columnType = this.dialect.getType(propMapping.type);
        entity[columnName] = columnType.get(resultSet, i);
    }
    return entity;
};

/**
 * Returns the mapping for the given entity
 * @param {String} type The name of the registered entity
 * @returns The mapping of the entity
 * @type Mapping
 */
Store.prototype.getEntityMapping = function(type) {
    return this.getEntityConstructor(type).mapping;
};

/**
 * Determines the database dialect to use
 * @returns The database dialect
 * @type Dialect
 */
Store.prototype.determineDialect = function() {
    var conn = this.getConnection();
    var metaData = null;
    try {
        metaData = conn.getMetaData();
        var productName = metaData.getDatabaseProductName();
        var majorVersion = metaData.getDatabaseMajorVersion();
        switch (productName) {
            case "H2":
                return require("./databases/h2");
            case "MySQL":
                if (majorVersion === 5) {
                    return require("./databases/mysql5");
                }
                throw new Error("Unsupported MySQL version " + majorVersion);
            case "Oracle":
                return require("./databases/oracle");
            case "PostgreSQL":
                return require("./databases/postgresql");
            default:
                throw new Error("Unsupported database " + productName);
        }
    } finally {
        sqlUtils.close(conn);
    }
    return null;
};

/**
 * Utility function for creating a new or updating an existing table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The database dialect to use
 * @param {Mapping} mapping The entity mapping definition
 */
Store.prototype.createTable = function(conn, dialect, mapping) {
    // create table
    var columns = [mapping.id];
    var primaryKeys = [mapping.id.column];
    for each (var propMapping in mapping.properties) {
        // ignore collection mappings
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        columns.push(propMapping);
        if (propMapping.unique === true) {
            primaryKeys.push(propMapping.column);
        }
    }
    return sqlUtils.createTable(conn, dialect, mapping.schemaName, mapping.tableName,
             columns, primaryKeys);
};

/**
 * Queries the database using the given sql statement, and returns the result
 * @param {String} sql The SQL statement to execute
 * @param {Array} An array containing the statement parameters. Each entry
 * must be an object containing a property "type" (the type of the parameter)
 * and "value" (containing the parameter value).
 * @param {Collector} collector The collector to extract result set data
 * @returns The result of the database query, where each result is an object
 * containing the column names with their values
 * @type Array
 */
Store.prototype.executeQuery = function(sql, parameters, collectorFunc) {
    var conn = null;
    var statement = null;
    var resultSet = null;
    try {
        conn = this.getConnection();
        // switch non-transaction connections into read-only mode
        if (conn.getAutoCommit() && !conn.isReadOnly()) {
            conn.setReadOnly(true);
        }
        if (log.isDebugEnabled()) {
            log.debug("Executing query", sql, parameters.toSource());
        }
        statement = conn.prepareStatement(sql);
        parameters.forEach(function(param, idx) {
            if (param.value === undefined || param.value === null) {
                statement.setNull(idx + 1, java.sql.Types.NULL);
            } else {
                var columnType = this.dialect.getType(param.type);
                columnType.set(statement, param.value, idx + 1);
            }
        }, this);
        resultSet = statement.executeQuery();
        return collectorFunc(resultSet, resultSet.getMetaData());
    } finally {
        sqlUtils.close(resultSet);
        sqlUtils.close(statement);
        if (conn != null && conn.getAutoCommit()) {
            sqlUtils.close(conn);
        }
    }
};

/**
 * Executes a data manipulating statement (insert/update)
 * @param {String} sql The SQL statement
 * @parameters {Array} An array containing the statement parameters. Each entry
 * must be an object containing a property "type" (the type of the parameter)
 * and "value" (containing the parameter value).
 * @param {Transaction} transaction The transaction
 * @returns The result as received from the database
 */
Store.prototype.executeUpdate = function(sql, parameters, transaction) {
    var conn = null;
    var statement = null;
    try {
        conn = transaction.getConnection();
        statement = conn.prepareStatement(sql);
        parameters.forEach(function(param, idx) {
            if (param.value === undefined || param.value === null) {
                statement.setNull(idx + 1, java.sql.Types.NULL);
            } else {
                var columnType = this.dialect.getType(param.type);
                columnType.set(statement, param.value, idx + 1);
            }
        }, this);
        return statement.executeUpdate();
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
    }
};

/**
 * If the storable is persistent, this method loads the entity for it from
 * database and returns it, otherwise it returns an empty object.
 * @param {Storable} storable The storable to get the entity object for
 * @returns The entity object
 */
Store.prototype.getEntity = function(storable) {
    if (storable._state === Storable.STATE_TRANSIENT) {
        return {};
    }
    var entity = null;
    var cacheKey = storable._cacheKey;
    var transaction = this.getTransaction();
    var useCache = this.isCacheEnabled() &&
        (!transaction || !transaction.containsKey(cacheKey));
    if (useCache && this.cache.containsKey(cacheKey)) {
        entity = this.cache.get(cacheKey)[1];
    }
    if (entity === null) {
        entity = this.loadEntity(storable._key.type, storable._key.id);
        if (useCache) {
            this.cache.put(cacheKey, [storable._key, entity]);
        }
    }
    return entity;
};

/**
 * Factory function for creating new entity instances
 * @param {String} type The name of the registered entity type
 * @param {Key} key The key to use
 * @param {Object} entity The entity to use
 * @returns A new instance of the defined entity
 * @type Object
 */
Store.prototype.create = function(type, key, entity) {
    return this.getEntityConstructor(type).createInstance(key, entity);
};

/**
 * Removes the data with the given key from the database
 * @param {Key} key The key to remove from the database
 * @param {Object} transaction Optional transaction object
 */
Store.prototype.remove = function(storable, transaction) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    var mapping = this.getEntityMapping(storable._key.type);
    var sql = "DELETE FROM " + mapping.getQualifiedTableName(this.dialect) +
            " WHERE " + this.dialect.quote(mapping.id.column) + " = ?";
    // execute delete
    if (log.isDebugEnabled()) {
        log.debug("Deleting", storable._key, sql);
    }
    var conn = null;
    var statement = null;
    try {
        conn = transaction.getConnection();
        statement = conn.prepareStatement(sql);
        this.dialect.getType("long").set(statement, storable._key.id, 1);
        var result = statement.executeUpdate();
        transaction.addDeleted(storable);
        if (hasAutoTransaction) {
            transaction.commit();
        }
        return result;
    } finally {
        sqlUtils.close(statement);
    }
};

/**
 * Writes the property values into the entity object. Note that this method
 * additionally saves any mapped objects too.
 * @param {Storable} storable The storable whose entity should be updated
 * @param {Transaction} transaction Optional transaction
 * @param {HashSet} visited Optional hash set used to detect circular references
 */
Store.prototype.updateEntity = function(storable, transaction, visited) {
    var mapping = storable.constructor.mapping;
    // store values in a new object, not in the _entity object of the storable.
    // the latter is in the store's entity cache, so modifying it would mean
    // that other threads accessing this entity object would get new values
    // that haven't been stored in database until this storable is committed.
    var newEntity = {};
    if (storable._state === Storable.STATE_TRANSIENT) {
        if (storable._key.id !== null) {
            // the id might have been set by application code, so use it
            newEntity[mapping.id.column] = storable._key.id;
        } else {
            // get next ID and store it both in the key and in the entity
            var id = mapping.id.getNextId(transaction);
            storable._key.id = newEntity[mapping.id.column] = id;
        }
    } else if (!storable._entity) {
        storable._entity = this.getEntity(storable);
        newEntity[mapping.id.column] = storable._entity[mapping.id.column];
    }
    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        var propValue = storable[propMapping.name];
        if (propMapping.isObjectMapping() && propValue != null) {
            var mappedEntity = this.getEntityConstructor(propMapping.entity);
            if (!isStorable(propValue) || !(propValue instanceof mappedEntity)) {
                throw new Error(propMapping.name + " must be an instance of " + propMapping.entity);
            }
            propValue.save(transaction, visited);
            propValue = propValue._id;
        }
        newEntity[propMapping.column] = propValue;
    }
    // swap entity objects - if the statement or commit fails, the storable will
    // still have it's updated values, but its _state will be reverted
    storable._entity = newEntity;
    return;
};

/**
 * Inserts the entity into database
 * @param {Storable} storable The storable to insert into database
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.insert = function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var values = [];
    var parameters = [];
    var sql = "INSERT INTO " + mapping.getQualifiedTableName(this.dialect) +
            " (" + this.dialect.quote(mapping.id.column);

    // id column
    values.push("?");
    parameters.push({
        "type": mapping.id.type,
        "value": storable._key.id
    });

    // collect statement parameters
    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        // ignore properties that are null or undefined
        var value = storable._entity[propMapping.column];
        if (value === null || value === undefined) {
            continue;
        }
        sql += ", " + this.dialect.quote(propMapping.column);
        values.push("?");
        parameters.push({
            "type": propMapping.type,
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
 * Updates the entity in database
 * @param {Storable} storable The storable to update in database
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.update = function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var sql = "UPDATE " + mapping.getQualifiedTableName(this.dialect) + " SET ";
    var parameters = [];

    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        if (parameters.length > 0) {
            sql += ", ";
        }
        sql += this.dialect.quote(propMapping.column) + " = ?";
        parameters.push({
            "type": propMapping.type,
            "value": storable._entity[propMapping.column]
        });
    }
    sql += " WHERE " + mapping.id.getQualifiedColumnName(this.dialect) + " = ?";
    parameters.push({
        "type": mapping.id.type,
        "value": storable._key.id
    });

    // execute update
    if (log.isDebugEnabled()) {
        log.debug("Updating", storable._key, sql);
    }
    var result = this.executeUpdate(sql, parameters, transaction);
    transaction.addUpdated(storable);
    return result;
};

/**
 * Saves the storable in the database
 * @param {Storable} storable The storable to save
 * @param {Transaction} transaction Optional transaction object
 * @param {HashSet} visted Optional hash set used to detect circular references
 */
Store.prototype.save = function(storable, transaction, visited) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    try {
        this.updateEntity(storable, transaction, visited);
        if (storable._state === Storable.STATE_TRANSIENT) {
            this.insert(storable, transaction);
        } else {
            this.update(storable, transaction);
        }
        // reset storable props - this ensures mapped object/collections are
        // freshly populated on first access
        storable._props = {};
        if (hasAutoTransaction) {
            transaction.commit();
        }
    } catch (e) {
        if (hasAutoTransaction) {
            transaction.rollback();
        }
        throw e;
    }
    return;
};

/**
 * Loads an entity from the database
 * @param {String} type The name of the defined entity
 * @param {Number} id The ID of the row to retrieve
 * @returns The entity object, populated with the values received from the database
 * @type Object
 */
Store.prototype.loadEntity = function(type, id) {
    var mapping = this.getEntityMapping(type);
    var sql = "SELECT * FROM " + mapping.getQualifiedTableName(this.dialect) +
            " WHERE " + mapping.id.getQualifiedColumnName(this.dialect) + " = ?";
    var parameters = [{
        "type": mapping.id.type,
        "value": id
    }];
    var store = this;
    var entities = this.executeQuery(sql, parameters, function(resultSet) {
        var metaData = resultSet.getMetaData();
        var columnCount = metaData.getColumnCount();
        var result = [];
        while (resultSet.next()) {
            result.push(store.createEntity(mapping, resultSet, metaData, columnCount));
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
 * @returns True if the database has a row for the given type and ID, false otherwise
 * @type Boolean
 */
Store.prototype.isEntityExisting = function(type, id) {
    var mapping = this.getEntityMapping(type);
    var sql = "SELECT " + mapping.id.getQualifiedColumnName(this.dialect) +
            " FROM " + mapping.getQualifiedTableName(this.dialect) +
            " WHERE " + mapping.id.getQualifiedColumnName(this.dialect) + " = ?";
    var parameters = [{
        "type": mapping.id.type,
        "value": id
    }];
    var store = this;
    var result = this.executeQuery(sql, parameters, function(resultSet) {
        var columnType = store.dialect.getType(mapping.id.type);
        var result = [];
        while (resultSet.next()) {
            result.push(columnType.get(resultSet, 1));
        }
        return result;
    });
    if (result.length > 1) {
        throw new Error("Multiple rows returned by query " + sqlBuf.toString());
    }
    return result.length === 1;
};

/**
 * Starts a new transaction. Note that the transaction is bound to the thread,
 * so any SQL query issued during an open transaction is using the same
 * database connection.
 * @returns The newly opened transaction
 * @type Transaction
 */
Store.prototype.beginTransaction = function() {
    return Transaction.createInstance(this);
};

/**
 * Returns the current transaction, or null if none has been opened.
 * @returns The current transaction
 * @type Transaction
 */
Store.prototype.getTransaction = function() {
    return Transaction.getInstance();
};

/**
 * Returns true if there is a transaction bound to the current thread.
 * @returns True if a transaction is bound to the current thread
 * @type Boolean
 */
Store.prototype.hasTransaction = function() {
    return Transaction.getInstance() !== null;
};

/**
 * Commits the transaction and closes it.
 */
Store.prototype.commitTransaction = function() {
    var transaction = Transaction.getInstance();
    if (transaction == null) {
        throw new Error("No open transaction to commit");
    }
    transaction.commit();
    return;
};

/**
 * Aborts the current transaction bound to the thread calling this method.
 */
Store.prototype.abortTransaction = function() {
    var transaction = Transaction.getInstance();
    if (transaction == null) {
        throw new Error("No open transaction to abort");
    }
    transaction.rollback();
    return;
};


/******************************************
 *****    Q U E R Y   S U P P O R T   *****
 ******************************************/


/**
 * Returns a new Query instance for the given type
 * @type {String} type The type to return the query for
 * @returns A newly created Query instance
 * @type Query
 */
Store.prototype.query = function(queryStr, nparams) {
    return (new Query(this, queryStr)).select(nparams);
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
 */
Store.prototype.get = function(type, id, aggressive) {
    var key = null;
    var entity = null;
    var cacheKey = createCacheKey(type, id);
    var transaction = this.getTransaction();
    var useCache = this.isCacheEnabled() &&
        (!transaction || !transaction.containsKey(cacheKey));
    if (useCache && this.cache.containsKey(cacheKey)) {
        [key, entity] = this.cache.get(cacheKey);
        return this.create(type, key, entity);
    }
    if (aggressive === true) {
        entity = this.loadEntity(type, id);
        if (entity !== null) {
            key = new Key(type, id);
        }
    } else if (this.isEntityExisting(type, id) === true) {
        key = new Key(type, id);
    }
    if (key !== null) {
        if (useCache) {
            this.cache.put(cacheKey, [key, entity]);
        }
        return this.create(type, key, entity);
    }
    return null;
};

/**
 * Retrieves all instances of the given type from the database
 * @param {String} type The type
 * @param {String} property Either a property name or "*". In the former case
 * this method returns an array containing all property values, in the latter
 * case an array containing entitites. If the argument is "*" the entities
 * are fully loaded, otherwise (default) lazy.
 * @returns An array containing the matched values or entities
 * @type Array
 */
Store.prototype.all = function(type) {
    return (new Query(this, "from " + type)).select();
};
