export("Store");

var {Storable} = require("ringo/storable");
var {Key} = require("./key");
var {Transaction} = require("./transaction");
var {Mapping} = require("./mapping");
var {ConnectionPool} = require("./connectionpool");
var {Query} = require("./query");
var {Cache} = require("./cache");
var {Collection, PartitionedCollection} = require("./collection");
var objects = require("ringo/utils/objects");
var sqlUtils = require("ringo/storage/sql/util");
var log = require('ringo/logging').getLogger(module.id);

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
 * Converts a java.sql.ResultSet instance into an array of entities
 * @param {Store} store The store to operate on
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @returns An array of entities
 * @type Array
 */
function collectEntities(store, mapping, resultSet) {
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    var idColumnName = mapping.id.column;
    var idColumnIdx = resultSet.findColumn(idColumnName);
    var idColumnType = store.dialect.getType(mapping.id.type);
    var result = [];
    while (resultSet.next()) {
        // first fetch id from result set and do a cache lookup
        var id = idColumnType.get(resultSet, idColumnName, idColumnIdx);
        if (store.isCacheEnabled()) {
            var cacheKey = Cache.createKey(mapping.type, id);
            if (store.cache.containsKey(cacheKey)) {
                result.push(store.cache.get(cacheKey));
                continue;
            }
        }
        // cache miss, read entity values and create instance
        var key = new Key(mapping.type, id);
        var entity = null;
        if (columnCount > 1) {
            entity = {};
            entity[idColumnName] = id;
            for (var i=1; i<=columnCount; i+=1) {
                if (i === idColumnIdx) {
                    continue;
                }
                var columnName = metaData.getColumnName(i);
                var propMapping = mapping.columns[columnName];
                if (propMapping == null) {
                    // unmapped column, ignore
                    continue;
                }
                var columnType = store.dialect.getType(propMapping.type);
                entity[columnName] = columnType.get(resultSet, columnName, i);
            }
            Object.defineProperty(entity, "_key", {
                "value": key
            });
        }
        var instance = store.create(mapping.type, key, entity);
        if (store.isCacheEnabled()) {
            store.cache.put(cacheKey, instance);
        }
        result.push(instance);
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
    var propMapping = mapping.getMapping(property);
    var columnType = store.dialect.getType(propMapping.type);
    var result = [];
    while (resultSet.next()) {
        result.push(columnType.get(resultSet, propMapping.column, 1));
    }
    return result;
};

/**
 * Converts a java.sql.ResultSet instance into an array of entity data objects
 * @param {Store} store The store to operate on
 * @param {Mapping} mapping The mapping to use
 * @param {java.sql.ResultSet} resultSet The query result set
 * @returns An array of entity data objects
 * @type Array
 */
function collectEntityData(store, mapping, resultSet) {
    var metaData = resultSet.getMetaData();
    var columnCount = metaData.getColumnCount();
    var result = [];
    while (resultSet.next()) {
        var entityData = {};
        for (var i=1; i<=columnCount; i+=1) {
            var columnName = metaData.getColumnName(i);
            var propMapping = mapping.columns[columnName];
            if (propMapping == null) {
                // unmapped column, ignore
                continue;
            }
            var columnType = store.dialect.getType(propMapping.type);
            entityData[columnName] = columnType.get(resultSet, columnName, i);
        }
        // store the key in the entity - this is needed by getProperties method
        Object.defineProperty(entityData, "_key", {
            "value": new Key(mapping.type, entityData[mapping.id.column])
        });
        result.push(entityData);
    }
    return result;
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
     * Returns a database connection object. If a transaction has been opened
     * for the calling thread, this method returns the transaction's connection,
     * otherwise it returns the next free connection from the pool.
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
            var m = new Mapping(type, mapping);
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
     * Creates a new transaction object and returns it. Note that this transaction
     * is not bound to the calling thread.
     * @returns A newly created transaction instance
     * @type Transaction
     */
    this.createTransaction = function() {
        return new Transaction(this);
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
    if (typeof(property) === "string" && property !== "*") {
        return function(resultSet) {
            return collectProperties(store, mapping, resultSet, property);
        };
    }
    return function(resultSet) {
        return collectEntities(store, mapping, resultSet);
    };
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
 * @param {Collector} collector The collector to extract result set data
 * @returns The result of the database query, where each result is an object
 * containing the column names with their values
 * @type Array
 */
Store.prototype.executeQuery = function(sql, collectorFunc) {
    var conn = null;
    var statement = null;
    var resultSet = null;
    try {
        conn = this.getConnection();
        // switch non-transaction connections into read-only mode
        if (conn.getAutoCommit() && !conn.isReadOnly()) {
            conn.setReadOnly(true);
        }
        log.debug("Executing query", sql);
        statement = conn.createStatement();
        resultSet = statement.executeQuery(sql);
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
 * @param {Array} columns An array containing the mappings for each column
 * @param {Array} values An array containing the values for each column
 * @param {Transaction} transaction Optional transaction
 * @returns The result as received from the database
 */
Store.prototype.executeUpdate = function(sql, columns, values, transaction) {
    var conn = null;
    var statement = null;
    try {
        conn = (transaction || this).getConnection();
        if (conn.getAutoCommit() && conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.prepareStatement(sql);
        columns.forEach(function(column, idx) {
            var value = values[idx];
            if (value === undefined || value === null) {
                statement.setNull(idx + 1, java.sql.Types.NULL);
            } else {
                var columnType = this.dialect.getType(column.type);
                columnType.set(statement, value, idx + 1);
            }
        }, this);
        return statement.executeUpdate();
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
        if (conn != null && conn.getAutoCommit()) {
            sqlUtils.close(conn);
        }
    }
};

/**
 * Generates a new id for the given type, by either using a defined sequence
 * or incrementing the max-ID from the table for the given type.
 * @param {String} type The type to return the next unused id for
 * @param {String} transaction Optional transaction
 * @returns The next unused id
 * @type Number
 */
Store.prototype.generateId = function(type, transaction) {
    var mapping = this.getEntityMapping(type);
    var sqlBuf = new java.lang.StringBuffer();
    var offset = 0;
    if (mapping.id.hasSequence() && this.dialect.hasSequenceSupport()) {
        // got a sequence, retrieve it's next value
        sqlBuf.append(this.dialect.getSqlNextSequenceValue(mapping.id.sequence));
    } else {
        // no sequence, increment the biggest id used in the table
        sqlBuf.append("SELECT MAX(");
        sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect));
        sqlBuf.append(") FROM ");
        sqlBuf.append(mapping.getQualifiedTableName(this.dialect));
        offset = 1;
    }

    var statement = null;
    var resultSet = null;
    var conn = (transaction || this).getConnection();
    log.debug("Generating ID:", sqlBuf.toString());
    try {
        statement = conn.createStatement();
        resultSet = statement.executeQuery(sqlBuf.toString());
        var metaData = resultSet.getMetaData();
        resultSet.next();
        return resultSet.getLong(metaData.getColumnLabel(1)) + offset;
    } finally {
        sqlUtils.close(resultSet);
        sqlUtils.close(statement);
        if (conn != null && conn.getAutoCommit()) {
            sqlUtils.close(conn);
        }
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
    if (transaction == undefined) {
        transaction = this.getTransaction();
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
        conn = (transaction || this).getConnection();
        if (conn.getAutoCommit() && conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.prepareStatement(sqlBuf.toString());
        this.dialect.getType("long").set(statement, key.id, 1);
        var result = statement.executeUpdate();
        if (transaction != null) {
            transaction.deleted.push(key);
        }
        if (this.isCacheEnabled()) {
            // remove object from cache
            var cacheKey = Cache.createKey(key);
            this.cache.remove(cacheKey);
        }
        return result;
    } finally {
        sqlUtils.close(statement);
        if (conn != null && conn.getAutoCommit()) {
            sqlUtils.close(conn);
        }
    }
};

/**
 * Writes the property values into the entity object. Note that this method
 * additionally stores any mapped objects too.
 * @param {Object} properties The properties of a registered entity type
 * @param {Object} entity The entity object holding the values that are
 * read from resp. written to the database
 */
Store.prototype.updateEntity = function(properties, entity) {
    var isNew = false;
    var isDirty = false;
    var mapping = this.getEntityMapping(entity._key.type);
    if (entity._key === undefined || !entity._key.isPersistent()) {
        isNew = true;
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
            propValue.save();
            propValue = propValue._id;
        }
        if (!isNew && !isDirty && propValue !== entityValue) {
            isDirty = true;
        }
        entity[propMapping.column] = propValue;
    }
    return isNew || isDirty;
};

/**
 * Inserts the entity into database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.insert = function(entity, transaction) {
    var mapping = this.getEntityMapping(entity._key.type);
    var columns = [];
    var values = [];
    var sqlBuf = new java.lang.StringBuffer("INSERT INTO ");
    var valuesBuf = new java.lang.StringBuffer(") VALUES (");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" (");
    
    // id column
    var nextId = this.generateId(entity._key.type, transaction);
    sqlBuf.append(this.dialect.quote(mapping.id.column));
    valuesBuf.append("?");
    columns.push(mapping.id);
    values.push(nextId);

    // collect properties
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
        if (columns.length > 0) {
            sqlBuf.append(", ");
            valuesBuf.append(", ");
        }
        sqlBuf.append(this.dialect.quote(propMapping.column));
        valuesBuf.append("?");
        columns.push(propMapping);
        values.push(entity[propMapping.column]);
    }
    sqlBuf.append(valuesBuf.toString());
    sqlBuf.append(")");

    log.debug("Inserting", entity._key, sqlBuf.toString());
    var result = this.executeUpdate(sqlBuf.toString(), columns, values, transaction);
    // update the entity key
    entity._key.id = nextId;
    if (transaction != null) {
        transaction.inserted.push(entity._key);
    }
    return result;
};

/**
 * Updates the entity in database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.update = function(entity, transaction) {
    var mapping = this.getEntityMapping(entity._key.type);
    var columns = [];
    var values = [];
    var sqlBuf = new java.lang.StringBuffer("UPDATE ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" SET ");

    for each (var propMapping in mapping.properties) {
        // ignore collections
        if (propMapping.isCollectionMapping()) {
            continue;
        }
        if (columns.length > 0) {
            sqlBuf.append(", ");
        }
        sqlBuf.append(this.dialect.quote(propMapping.column));
        sqlBuf.append(" = ?");
        columns.push(propMapping);
        values.push(entity[propMapping.column]);
    }
    sqlBuf.append(" WHERE ");
    sqlBuf.append(mapping.id.getQualifiedColumnName(this.dialect));
    sqlBuf.append(" = ").append(entity._key.id.toString());

    // execute update
    log.debug("Updating", entity._key, sqlBuf.toString());
    var result = this.executeUpdate(sqlBuf.toString(), columns, values, transaction);
    if (transaction != null) {
        transaction.updated.push(entity._key);
    }
    if (this.isCacheEnabled()) {
        // remove object from cache
        var cacheKey = Cache.createKey(entity._key);
        this.cache.remove(cacheKey);
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
    if (transaction == undefined) {
        transaction = this.getTransaction();
    }
    if (this.updateEntity(properties, entity, transaction)) {
        if (entity._key.isPersistent()) {
            return this.update(entity, transaction);
        } else {
            return this.insert(entity, transaction);
        }
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
Store.prototype.getProperties = function(store, entity) {
    var type = entity._key.type;
    var mapping = this.getEntityMapping(type);
    var props = {};
    for each (var propMapping in mapping.properties) {
        var value = entity[propMapping.column];
        if (propMapping.isCollectionMapping()) {
            // construct query and instantiate collection
            var query = this.query(propMapping.entity);
            if (propMapping.through !== null) {
                var localColumnName = mapping.getColumnName(propMapping.localProperty || "id");
                var throughEntity = this.getEntityConstructor(propMapping.through);
                query.join(throughEntity, propMapping.join).equals(propMapping.foreignProperty, entity[localColumnName]);
            } else if (propMapping.foreignProperty !== null) {
                var localColumnName = mapping.getColumnName(propMapping.localProperty);
                query.equals(propMapping.foreignProperty, entity[localColumnName]);
            }
            if (propMapping.orderBy !== null) {
                query.orderBy(propMapping.orderBy);
            }
            if (propMapping.limit !== null) {
                query.limit(propMapping.limit);
            }
            if (propMapping.isPartitioned === true) {
                value = new PartitionedCollection(propMapping, query);
            } else {
                value = new Collection(propMapping, query);
            }
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
    sqlBuf.append(" = ").append(id.toString());
    log.debug("Loading entity:", sqlBuf.toString());
    // TODO: use preparedStatement
    var store = this;
    var entities = this.executeQuery(sqlBuf.toString(), function(resultSet) {
        return collectEntityData(store, mapping, resultSet);
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
    sqlBuf.append(" = ").append(id.toString());
    log.debug("Checking entity:", sqlBuf.toString());
    // TODO: use preparedStatement
    var store = this;
    var result = this.executeQuery(sqlBuf.toString(), function(resultSet) {
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
    Transaction.getInstance(this);
    return;
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
    var key = new Key(type, id);
    if (this.isCacheEnabled()) {
        var cacheKey = Cache.createKey(key);
        if (this.cache.containsKey(cacheKey)) {
            return this.cache.get(cacheKey);
        }
    }
    var result = null;
    if (aggressive === true) {
        var entity = this.loadEntity(type, id);
        if (entity !== null) {
            result = this.create(type, key, entity);
        }
    } else if (this.isEntityExisting(type, id) === true) {
        result = this.create(type, key, null);
    }
    if (result !== null && this.isCacheEnabled()) {
        this.cache.put(cacheKey, result);
    }
    return result;
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
