export("Store");

var {Storable} = require("ringo-storable");
var {Key} = require("./key");
var {Transaction} = require("./transaction");
var {Mapping} = require("./mapping");
var {ConnectionPool} = require("./connectionpool");
var {Query} = require("./query");
var {Cache, createCacheKey} = require("./cache");
var {Collection} = require("./collection");
var objects = require("ringo/utils/objects");
var sqlUtils = require("./util");
var log = require('ringo/logging').getLogger(module.id);

var STATE_CLEAN = 0;
var STATE_NEW = 1;
var STATE_DIRTY = 2;

/**
 * Returns true if the value passed as argument is a key
 * @param {Object} value The value to check
 * @returns True if the value is a key, false otherwise
 * @type Boolean
 */
function isKey(value) {
    return value instanceof Key;
}

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
 * Converts a java.sql.ResultSet instance into an array of entity instances
 * @param {Store} store The store to operate on
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {Boolean} aggressive If true this method aggressively loaded instances
 * (utilizing the store's entity cache if enabled), otherwise lazy ones.
 * @returns An array of entity instances
 * @type Array
 */
function collectInstances(store, mapping, resultSet, aggressive) {
    var result = [];
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    var idColumnIdx = resultSet.findColumn(mapping.id.column);
    var idColumnType = store.dialect.getType(mapping.id.type);
    while (resultSet.next()) {
        // first fetch id from result set and do a cache lookup
        var id = idColumnType.get(resultSet, idColumnIdx);
        var entity = null;
        var cacheKey = createCacheKey(mapping.type, id);
        if (store.isCacheEnabled() && store.cache.containsKey(cacheKey)) {
            entity = store.cache.get(cacheKey);
        } else if (aggressive === true) {
            entity = createEntity(store, mapping, resultSet, metaData, columnCount);
        }
        var key = (entity !== null) ? entity._key : new Key(mapping.type, id);
        result.push(store.create(mapping.type, key, entity));
    }
    return result;
}

/**
 * Converts a java.sql.ResultSet instance into an array of property values
 * @param {Store} store The store to operate on
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {String} property The name of the property
 * @returns An array of property values
 * @type Array
 */
function collectProperties(store, mapping, resultSet, property) {
    var columnType = store.dialect.getType(mapping.getColumnType(property));
    var result = [];
    while (resultSet.next()) {
        result.push(columnType.get(resultSet, 1));
    }
    return result;
}

/**
 * Creates an entity object containing the values received from the database
 * @param {Store} store The store to operate on
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @param {java.sql.ResultSetMetaData} metaData The result set metadata
 * @param {Number} columnCount The number of columns in the result set
 * @returns A newly constructed entity object
 * @type Object
 */
function createEntity(store, mapping, resultSet, metaData, columnCount) {
    var entity = {};
    for (var i=1; i<=columnCount; i+=1) {
        var columnName = metaData.getColumnName(i);
        var propMapping = mapping.columns[columnName];
        if (propMapping == null) {
            // unmapped column, ignore
            continue;
        }
        var columnType = store.dialect.getType(propMapping.type);
        entity[columnName] = columnType.get(resultSet, i);
    }
    // store the key in the entity - this is needed by getProperties method
    Object.defineProperty(entity, "_key", {
        "value": new Key(mapping.type, entity[mapping.id.column])
    });
    if (store.isCacheEnabled() && !store.getTransaction()) {
        store.cache.put(entity._key.getCacheKey(), entity);
    }
    return entity;
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

    /**
     * Contains the database dialect implementation of this store
     * @type Dialect
     */
    Object.defineProperty(this, "dialect", {
        "get": function() {
            if (dialect === null) {
                dialect = this.determineDialect();
            }
            return dialect;
        }
    });

    /**
     * Contains the object cache of this store
     * @type Cache
     */
    Object.defineProperty(this, "cache", {"value": cache});

    /**
     * Contains the connection pool of this store
     * @type ConnectionPool
     */
    Object.defineProperty(this, "connectionPool", {"value": connectionPool});

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
            ctor.all = function(property) {
                return store.all(type, property);
            };
            ctor.query = function() {
                return store.query(type);
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
 * Returns the mapping for the given entity
 * @param {String} type The name of the registered entity
 * @returns The mapping of the entity
 * @type Mapping
 */
Store.prototype.getEntityMapping = function(type) {
    return this.getEntityConstructor(type).mapping;
};

/**
 * Returns a collector function
 * @param {Mapping} mapping The mapping to use
 * @param {String} property An optional property name
 * @returns A collector function expecting a java.sql.ResultSet instance
 * as single argument
 * @type Function
 */
Store.prototype.getCollector = function(mapping, property) {
    var store = this;
    return function(resultSet) {
        if (typeof(property) === "string") {
            if (property === "*") {
                return collectInstances(store, mapping, resultSet, true);
            }
            return collectProperties(store, mapping, resultSet, property);
        }
        return collectInstances(store, mapping, resultSet, false);
    }
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
             columns, primaryKeys, mapping.engine);
};

/**
 * Queries the database using the given sql statement, and returns the result
 * @param {String} sql The SQL statement to execute
 * @parameters {Array} An array containing the statement parameters. Each entry
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
        log.debug("Executing query", sql, parameters.toSource());
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
        return collectorFunc(resultSet);
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
 * Returns the ID stored in the given key
 * @param {Key} key The key
 * @returns The ID of the key
 * @type Number
 */
Store.prototype.getId = function(key) {
    if (isKey(key)) {
        return key.id;
    }
    throw new Error("Not a key: " + key);
};

/**
 * Returns the key of the given entity
 * @param {String} type The type of the registered entity
 * @param {Object} arg Either a key instance, or an entity
 * @returns The key or null
 * @type Key
 */
Store.prototype.getKey = function(type, arg) {
    if (isKey(arg)) {
        return arg;
    } else if (isEntity(arg)) {
        return arg._key;
    }
    return null;
};

/**
 * Returns true if both keys are equal
 * @param {Key} keyA The key
 * @param {Key} keyB The key to compare to
 * @returns True if both keys are equal, false otherwise
 * @type Boolean
 */
Store.prototype.equalKeys = function(keyA, keyB) {
    return keyA.equals(keyB);
};

/**
 * Returns an entity with the given type, based on the second argument
 * @param {Object} arg Either a database Key instance (in which case the entity
 * is loaded from database), an entity (basically an object containing a
 * property _key with a Key instance as value), or an object, in which case
 * an entity is created based on the argument object.
 * @returns The entity
 */
Store.prototype.getEntity = function(type, arg) {
    if (isKey(arg)) {
        return this.loadEntity(arg.type, arg.id);
    } else if (isEntity(arg)) {
        return arg;
    } else if (arg instanceof Object) {
        var entity = {};
        // FIXME: shouldn't the key be something like t12345?
        Object.defineProperty(entity, "_key", {
            "value": new Key(type, null)
        });
        return entity;
    }
    return null;
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
Store.prototype.remove = function(key, transaction) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    var mapping = this.getEntityMapping(key.type);
    var sqlBuf = new java.lang.StringBuffer("DELETE FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(mapping.id.column)).append(" = ?");
    // execute delete
    log.debug("Deleting", key, sqlBuf.toString());
    var conn = null;
    var statement = null;
    try {
        conn = transaction.getConnection();
        statement = conn.prepareStatement(sqlBuf.toString());
        this.dialect.getType("long").set(statement, key.id, 1);
        var result = statement.executeUpdate();
        transaction.addDeleted(key);
        if (hasAutoTransaction) {
            transaction.commit();
        }
        // remove object from cache if enabled
        if (this.isCacheEnabled()) {
            this.cache.remove(key.getCacheKey());
        }
        return result;
    } finally {
        sqlUtils.close(statement);
    }
};

/**
 * Writes the property values into the entity object. Note that this method
 * additionally stores any mapped objects too.
 * @param {Object} properties The properties of a registered entity type
 * @param {Object} entity The entity object holding the values that are
 * read from resp. written to the database
 * @returns A numeric state indicator
 * @type Number
 */
Store.prototype.updateEntity = function(properties, entity, transaction) {
    var state = STATE_CLEAN;
    // return STATE_CLEAN for lazily loaded objects or if the entity
    // has already been registered in this transaction (eg. circular reference)
    if (properties === undefined || transaction.hasKey(entity._key)) {
        return state;
    }
    // register entity key within the transaction to avoid re-touching it
    transaction.registerKey(entity._key);

    var mapping = this.getEntityMapping(entity._key.type);
    if (entity._key.isPersistent() === false) {
        // get next ID and store it both in the key and in the entity
        entity._key.id = entity[mapping.id.column] = mapping.id.getNextId(transaction);
        state = STATE_NEW;
    }
    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        var propValue = properties[propMapping.name];
        var entityValue = entity[propMapping.column];
        if (propMapping.isObjectMapping() && propValue != null) {
            var mappedEntity = this.getEntityConstructor(propMapping.entity);
            if (!isStorable(propValue) || !(propValue instanceof mappedEntity)) {
                throw new Error(propMapping.name + " must be an instance of " + propMapping.entity);
            }
            propValue.save(transaction);
            propValue = propValue._id;
        }
        if (state === STATE_CLEAN && propValue !== entityValue) {
            state = STATE_DIRTY;
        }
        entity[propMapping.column] = propValue;
    }
    return state;
};

/**
 * Inserts the entity into database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.insert = function(entity, transaction) {
    var mapping = this.getEntityMapping(entity._key.type);
    var parameters = [];
    var sqlBuf = new java.lang.StringBuffer("INSERT INTO ");
    var valuesBuf = new java.lang.StringBuffer(") VALUES (");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" (");

    // id column
    sqlBuf.append(this.dialect.quote(mapping.id.column));
    valuesBuf.append("?");
    parameters.push({
        "type": mapping.id.type,
        "value": entity._key.id
    });

    // collect statement parameters
    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        // ignore properties that are null or undefined
        var value = entity[propMapping.column];
        if (value === null || value === undefined) {
            continue;
        }
        if (parameters.length > 0) {
            sqlBuf.append(", ");
            valuesBuf.append(", ");
        }
        sqlBuf.append(this.dialect.quote(propMapping.column));
        valuesBuf.append("?");
        parameters.push({
            "type": propMapping.type,
            "value": entity[propMapping.column]
        });
    }
    sqlBuf.append(valuesBuf.toString());
    sqlBuf.append(")");

    log.debug("Inserting", entity._key, sqlBuf.toString());
    var result = this.executeUpdate(sqlBuf.toString(), parameters, transaction);
    transaction.addInserted(entity._key);
    return result;
};

/**
 * Updates the entity in database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.update = function(entity, transaction) {
    var mapping = this.getEntityMapping(entity._key.type);
    var parameters = [];
    var sqlBuf = new java.lang.StringBuffer("UPDATE ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" SET ");

    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        if (parameters.length > 0) {
            sqlBuf.append(", ");
        }
        sqlBuf.append(this.dialect.quote(propMapping.column));
        sqlBuf.append(" = ?");
        parameters.push({
            "type": propMapping.type,
            "value": entity[propMapping.column]
        });
    }
    sqlBuf.append(" WHERE ");
    sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect));
    sqlBuf.append(" = ?");
    parameters.push({
        "type": mapping.id.type,
        "value": entity._key.id
    });

    // execute update
    log.debug("Updating", entity._key, sqlBuf.toString());
    var result = this.executeUpdate(sqlBuf.toString(), parameters, transaction);
    transaction.addUpdated(entity._key);
    // remove object from cache if enabled
    if (this.isCacheEnabled()) {
        this.cache.remove(entity._key.getCacheKey());
    }
    return result;
};

/**
 * Saves the storable in the database
 * @param {Object} properties The properties of the entity instance
 * @param {Object} entity The persistent data of the entity instance
 * @param {Object} transaction Optional transaction object
 */
Store.prototype.save = function(properties, entity, transaction) {
    var hasAutoTransaction = false;
    if (transaction == undefined && (transaction = this.getTransaction()) == null) {
        transaction = this.beginTransaction();
        hasAutoTransaction = true;
    }
    try {
        var state = this.updateEntity(properties, entity, transaction);
        if (state !== STATE_CLEAN) {
            if (state === STATE_NEW) {
                this.insert(entity, transaction);
            } else {
                this.update(entity, transaction);
            }
            // (re-)call getProperties to populate mapped object or collection properties
            this.getProperties(this, entity, properties);
        }
        if (hasAutoTransaction) {
            transaction.commit();
        } else {
            // unregister the key of the entity in the transaction, otherwise
            // subsequent updates of this entity within the same uncommitted
            // transaction would be ignored
            transaction.unregisterKey(entity._key);
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
 * Returns an object containing the accessible properties of the entity. This
 * method resolves mapped objects and collections as they are defined
 * in the entity mapping definition.
 * @param {Object} store The store (FIXME: why as argument?)
 * @param {Object} entity The values received from the database
 * @returns The properties of the entity
 * @type Object
 */
Store.prototype.getProperties = function(store, entity, props) {
    var type = entity._key.type;
    var mapping = this.getEntityMapping(type);
    var props = props || {};
    for each (var propMapping in mapping.properties) {
        if (props.hasOwnProperty(propMapping.name)) {
            continue;
        }
        var value = entity[propMapping.column];
        if (propMapping.isCollectionMapping()) {
            value = Collection.createInstance(this, propMapping, entity);
        } else if (propMapping.isObjectMapping() && value != null) {
            // load the mapped entity from database
            value = this.get(propMapping.entity, value);
        }
        props[propMapping.name] = value;
    }
    return props;
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
    var sqlBuf = new java.lang.StringBuffer("SELECT * FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" WHERE ");
    sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect));
    sqlBuf.append(" = ?");
    var parameters = [{
        "type": mapping.id.type,
        "value": id
    }];
    var store = this;
    var entities = this.executeQuery(sqlBuf.toString(), parameters, function(resultSet) {
        var metaData = resultSet.getMetaData();
        var columnCount = metaData.getColumnCount();
        var result = [];
        while (resultSet.next()) {
            result.push(createEntity(store, mapping, resultSet, metaData, columnCount));
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
    var sqlBuf = new java.lang.StringBuffer("SELECT ");
    sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect)).append(" FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" WHERE ");
    sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect));
    sqlBuf.append(" = ?");
    var parameters = [{
        "type": mapping.id.type,
        "value": id
    }];
    var store = this;
    var result = this.executeQuery(sqlBuf.toString(), parameters, function(resultSet) {
        return collectProperties(store, mapping, resultSet, mapping.id.name);
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
    return Transaction.getInstance(this.connectionPool);
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
Store.prototype.query = function(type) {
    return new Query(this, type);
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
    var entity = null;
    if (this.isCacheEnabled()) {
        var cacheKey = createCacheKey(type, id);
        if (this.cache.containsKey(cacheKey)) {
            entity = this.cache.get(cacheKey);
            if (entity !== null) {
                return this.create(type, entity._key, entity);
            }
            return this.create(type, new Key(type, id), null);
        }
    }
    if (aggressive === true) {
        entity = this.loadEntity(type, id);
        if (entity !== null) {
            return this.create(type, entity._key, entity);
        }
    } else if (this.isEntityExisting(type, id) === true) {
        if (this.isCacheEnabled()) {
            this.cache.put(createCacheKey(type, id), null);
        }
        return this.create(type, new Key(type, id), null);
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
Store.prototype.all = function(type, property) {
    return this.query(type).select(property);
};
