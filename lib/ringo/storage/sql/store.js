export("Store");

var objects = require("ringo/utils/objects");
var addHostObject = require("ringo/engine").addHostObject;
var Key = require("./key").Key;
var Transaction = require("./transaction").Transaction;
var Mapping = require("./mapping").Mapping;
var ConnectionPool = require("./connectionpool").ConnectionPool;
var Query = require("./query").Query;
var Collection = require("./collection").Collection;
var Cache = require("./cache").Cache;
var sqlUtils = require("ringo/storage/sql/util");
var log = require('ringo/logging').getLogger(module.id);

addHostObject(org.ringojs.wrappers.Storable);


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
 * Returns a new Store instance
 * @class Instances of this class represent a RDBMS store
 * @param {Object} props The database connection properties
 * @param {Number} maxConnections The maximum number of database connections
 * @returns A new Store instance
 * @constructor
 */
var Store = function(props, maxConnections) {
    var dialect = null;
    var entityRegistry = {};
    var connectionPool = new ConnectionPool(props, maxConnections || 10);
    var cache = new Cache();
    var store = this;

    Object.defineProperty(this, "dialect", {
        "get": function() {
            if (dialect === null) {
                dialect = this.determineDialect();
            }
            return dialect;
        }
    });

    Object.defineProperty(this, "cache", {"value": cache});

    /**
     * Returns a database connection object
     * @returns A dabase connection object
     * @type java.sql.Connection
     */
    this.getConnection = function() {
        return connectionPool.getConnection();
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
            mapping.table = mapping.table || type;
            var m = new Mapping(this, mapping);
            ctor = entityRegistry[type] = Storable.defineEntity(this, type, m);
            ctor.get = function(id) {
                return store.get(type, id);
            };
            ctor.all = function() {
                return store.all(type);
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
     * Creates a new transaction object and returns it
     * @returns A newly created transaction instance
     * @type Transaction
     */
    this.createTransaction = function() {
        return new Transaction(this);
    };
    
    /**
     * Closes all connections this store has opened
     */
    this.closeConnections = function() {
        connectionPool.closeConnections();
        return;
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
 * @param {Mapping} mapping The entity mapping used to retrieve the values
 * @returns The result of the database query, where each result is an object
 * containing the column names with their values
 * @type Array
 */
Store.prototype.executeQuery = function(sql, mapping) {
    var conn = null;
    var statement = null;
    var resultSet = null;
    try {
        conn = this.getConnection();
        conn.setReadOnly(true);
        statement = conn.createStatement();
        resultSet = statement.executeQuery(sql);
        var metaData = resultSet.getMetaData();
        var columnCount = metaData.getColumnCount();
        var result = [];
        while (resultSet.next()) {
            var row = {};
            for (var i=1; i<=columnCount; i+=1) {
                var columnName = metaData.getColumnLabel(i);
                var propMapping = mapping.columns[columnName];
                if (propMapping == null) {
                    // unmapped column, ignore
                    continue;
                }
                var columnType = propMapping.getColumnType();
                row[columnName] = columnType.get(resultSet, columnName, i);
            }
            result[result.length] = row;
        }
        return result;
    } finally {
        sqlUtils.close(resultSet);
        sqlUtils.close(statement);
        sqlUtils.close(conn);
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
        if (transaction != null) {
            conn = transaction.getConnection();
            log.debug("Using transaction mode, connection:", conn);
        } else {
            log.debug("Using autocommit mode, connection: ", conn);
            conn = this.getConnection();
            conn.setReadOnly(false);
        }
        statement = conn.prepareStatement(sql);
        columns.forEach(function(column, idx) {
            var value = values[idx];
            if (value === undefined || value === null) {
                statement.setNull(idx + 1, java.sql.Types.NULL);
            } else {
                column.getColumnType().set(statement, value, idx + 1);
            }
        });
        return statement.executeUpdate();
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
        if (conn.getAutoCommit()) {
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
        sqlBuf.append(this.dialect.quote(mapping.id.column));
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
        if (conn.getAutoCommit()) {
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
        Object.defineProperty(entity, "_key", {
            // FIXME: shouldn't the key be something like t12345?
            value: new Key(type, null)
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
    var mapping = this.getEntityMapping(key.type);
    var sqlBuf = new java.lang.StringBuffer("DELETE FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(mapping.id.column)).append(" = ?");
    // execute delete
    log.debug("Deleting", key, sqlBuf.toString());
    var conn = null;
    var statement = null;
    try {
        if (transaction != null) {
            conn = transaction.getConnection();
            log.debug("Using transaction mode, connection:", conn);
        } else {
            conn = this.getConnection();
            log.debug("Using autocommit mode, connection:", conn);
            conn.setReadOnly(false);
        }
        statement = conn.prepareStatement(sqlBuf.toString());
        this.dialect.getType("integer").set(statement, key.id, 1);
        var result = statement.executeUpdate();
        if (transaction != null) {
            transaction.deleted.push(key);
        }
        // remove object from cache
        var cacheKey = Cache.createKey(key);
        this.cache.remove(cacheKey);
        return result;
    } finally {
        sqlUtils.close(statement);
        if (conn.getAutoCommit()) {
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
            if (!isStorable(propValue)) {
                throw new Error(propMapping.name + " must be an instance of a defined entity");
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
        // ignore properties that are null or undefined, and for which a
        // default value is set in mapping definition
        var value = entity[propMapping.column];
        if ((value === null || value === undefined) && propMapping["default"] != null) {
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
    sqlBuf.append(this.dialect.quote(mapping.id.column));
    sqlBuf.append(" = ").append(entity._key.id);

    // execute update
    log.debug("Updating", entity._key, sqlBuf.toString());
    var result = this.executeUpdate(sqlBuf.toString(), columns, values, transaction);
    if (transaction != null) {
        transaction.updated.push(entity._key);
    }
    // remove object from cache
    var cacheKey = Cache.createKey(entity._key);
    this.cache.remove(cacheKey);
    return result;
};

/**
 * Saves the storable in the database
 * @param {Object} properties The properties of the entity instance
 * @param {Object} entity The persistent data of the entity instance
 * @param {Object} transaction Optional transaction object
 */
Store.prototype.save = function(properties, entity, transaction) {
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
            // build query and instantiate collection
            var foreignProp = propMapping.foreignProperty;
            var localVal = entity[mapping.id.column];
            var mappedEntity = propMapping.entity;
            var query = this.query(mappedEntity).equals(foreignProp, localVal);
            value = new Collection(propMapping.name, query);
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
    sqlBuf.append(this.dialect.quote(mapping.id.column));
    sqlBuf.append(" = ").append(id.toString());
    log.debug("Loading entity:", sqlBuf.toString());
    // TODO: use preparedStatement
    var entities = this.executeQuery(sqlBuf.toString(), mapping);
    if (entities.length > 1) {
        throw new Error("Multiple rows returned by query");
    } else if (entities.length === 1) {
        // store the key in the entity - this is needed by
        // getProperties method
        Object.defineProperty(entities[0], "_key", {
            value: new Key(type, id)
        });
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
    sqlBuf.append(this.dialect.quote(mapping.id.column)).append(" FROM ");
    sqlBuf.append(mapping.getQualifiedTableName(this.dialect)).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(mapping.id.column));
    sqlBuf.append(" = ").append(id.toString());
    log.debug("Checking entity:", sqlBuf.toString());
    // TODO: use preparedStatement
    var result = this.executeQuery(sqlBuf.toString(), mapping);
    if (result.length > 1) {
        throw new Error("Multiple rows returned by query " + sqlBuf.toString());
    }
    return result.length === 1;
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
 * @returns An instance of the registered constructor function
 */
Store.prototype.get = function(type, id) {
    var cacheKey = Cache.createKey(type, id);
    if (this.cache.containsKey(cacheKey)) {
        return this.cache.get(cacheKey);
    }
    if (this.isEntityExisting(type, id) === true) {
        var result = this.create(type, new Key(type, id), null);
        this.cache.put(cacheKey, result);
        return result;
    }
    return null;
};

/**
 * Retrieves all instances of the given type from the database
 * @type {String} type The type
 * @returns An array containing all persisted instances
 * @type Array
 */
Store.prototype.all = function(type) {
    return this.query(type).select();
};
