var {
    addHostObject
} = require("ringo/engine");

var {
    bindArguments,
    bindThisObject
} = require("ringo/functional");

var Key = require("ringo/storage/sql/key").Key;
var Transaction = require("ringo/storage/sql/transaction").Transaction;

var sqlUtils = require("ringo/storage/sql/util");

var log = require('ringo/logging').getLogger(module.id);

addHostObject(org.ringojs.wrappers.Storable);


export("Store");

/**
 * Returns a new Store instance
 * @class Instances of this class represent a RDBMS store
 * @param {Object} props The database connection properties
 * @returns A new Store instance
 * @constructor
 */
var Store = function(props) {
    var dialect = null;
    var entityRegistry = {};

    Object.defineProperty(this, "dialect", {
        "get": function() {
            if (dialect === null) {
                dialect = this.determineDialect();
            }
            return dialect;
        }
    });

    /**
     * Returns a database connection object
     * @returns A dabase connection object
     * @type java.sql.Connection
     */
    this.getConnection = function() {
        return java.sql.DriverManager.getConnection(props.url, props.username,
                props.password);
    };

    /**
     * Defines an entity within this store
     * @param {String} type The name of the entity constructor
     * @param {Object} The database mapping object, defining the ID column
     * and all (optionally mapped) properties of the entity instances
     * @returns The constructor function
     * @type Function
     */
    this.defineEntity = function(type, mapping) {
        var ctor = entityRegistry[type];
        if (!ctor) {
            ctor = entityRegistry[type] = Storable.defineEntity(this, type, mapping);
            ctor.get = bindThisObject(bindArguments(getById, type), this);
            // create the table if it doesn't exist already
            var conn = this.getConnection();
            if (sqlUtils.tableExists(conn, mapping.table) === false) {
                this.createTable(conn, this.dialect, mapping);
            } else {
                // TODO: update table
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

    return this;
};

/**
 * Determines the database dialect to use
 * @returns The database dialect
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
            default:
                throw new Error("Unsupported database " + productName);
        }
    } finally {
        sqlUtils.close(conn);
    }
    return;
};

/**
 * Utility function for creating a new or updating an existing table
 * @param {java.sql.Connection} conn The connection to use
 * @param {Dialect} dialect The database dialect to use
 * @param {Object} mapping The entity mapping definition
 */
Store.prototype.createTable = function(conn, dialect, mapping) {
    // create table
    var columns = [];
    var primaryKeys = [];

    // id column (mapping definition is optional)
    var idDef = mapping.id || {
        "column": "id"
    };
    columns.push({
        "name": idDef.column || "id",
        "type": "integer",
        "nullable": false
    });
    primaryKeys.push(idDef.column);

    // properties
    for (var propName in mapping.properties) {
        var property = mapping.properties[propName];
        if (property.type == null) {
            throw new Error("Store.createOrUpdateTable: missing data type definition for property " + propName);
        }
        var columnName = property.column || propName;
        columns.push({
            "name": columnName,
            "type": property.type,
            "nullable": property.nullable,
            "length": property.length,
            "precision": property.precision,
            "scale": property.scale,
            "default": property["default"],
        });
        if (property.unique === true) {
            primaryKeys.push(columnName);
        }
    }
    return sqlUtils.createTable(conn, dialect, mapping.table, columns, primaryKeys);
};

/**
 * Queries the database using the given sql statement, and returns the result
 * @param {String} sql The SQL statement to execute
 * @returns The result of the database query
 * @type Array
 */
Store.prototype.query = function(sql) {
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
                var columnType = metaData.getColumnType(i);
                var dataType = this.dialect.getColumnTypeByJdbcNumber(columnType);
                if (dataType == null) {
                    throw new Error("unknown data type " + columnType +
                            " of column " + columnName);
                }
                row[columnName] = dataType.get(resultSet, columnName);
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
 * Generates a new id for the given type
 * TODO: allow definition of sequences!
 * @param {String} type The type to return the next unused id for
 * @returns The next unused id
 * @type Number
 */
Store.prototype.generateId = function(type) {
    var tableName = this.getTableName(type);
    var sequence = this.getIdSequenceName(type);
    var id = null;
    if (sequence != null) {
        // got a sequence, query it
        throw new Error("TBD");
    } else {
        // no sequence, increment the biggest id used in the table
        var idColumnName = this.getIdColumnName(type);
        var sqlBuf = new java.lang.StringBuffer("SELECT MAX(");
        sqlBuf.append(this.dialect.quote(idColumnName));
        sqlBuf.append(") AS MAX_ID FROM ").append(tableName);
        var resultSet = this.query(sqlBuf.toString());
        var maxId = resultSet[0]["MAX_ID"];
        id = maxId + 1;
    }
    return id;
};

/**
 * Returns the mapping definition for the given type
 * @param {String} The registered entity type to return the mapping for
 * @returns The mapping definition
 * @type Object
 */
Store.prototype.getMapping = function(type) {
    return this.getEntityConstructor(type).mapping;
};

/**
 * Returns the name of the table for the given type
 * @param {String} type The registered entity type to return the table name for
 * @returns The table name
 * @type String 
 */
Store.prototype.getTableName = function(type) {
    return this.getMapping(type).table;
};

/**
 * Returns the ID column name for the given type
 * @param {String} type The registered entity type to return the ID column for
 * @returns The ID column name, or the default "id"
 * @type String 
 */
Store.prototype.getIdColumnName = function(type) {
    var mapping = this.getMapping(type);
    if (mapping.id != null && mapping.id.column != null) {
        return mapping.id.column;
    }
    return "id";
};

/**
 * Returns the ID sequence name for the given entity type
 * @param {String} type The entity type name
 * @returns The ID sequence name, or null if none has been defined
 * @type String
 */
Store.prototype.getIdSequenceName = function(type) {
    var mapping = this.getMapping(type);
    if (mapping.id != null && mapping.id.sequence) {
        return mapping.id.sequence;
    }
    return null;
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
        var entity = arg.clone({});
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
    var tableName = this.getTableName(key.type);
    var idColumnName = this.getIdColumnName(key.type);
    var ctor = this.getEntityConstructor(key.type);
    var sqlBuf = new java.lang.StringBuffer("DELETE FROM ");
    sqlBuf.append(tableName).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(idColumnName)).append(" = ?");
    // execute delete
    log.info("Deleting", key, sqlBuf.toString());
    var conn = null;
    var statement = null;
    try {
        if (transaction != null) {
            log.info("Using transaction mode");
            conn = transaction.getConnection();
            conn.setTransactionIsolation(java.sql.Connection.TRANSACTION_SERIALIZABLE);
            conn.setAutoCommit(false);
        } else {
            log.info("Using autocommit mode");
            conn = this.getConnection();
            conn.setAutoCommit(true);
        }
        conn.setReadOnly(false);
        statement = conn.prepareStatement(sqlBuf.toString());
        this.dialect.getColumnType("integer").set(statement, key.id, 1);
        var result = statement.executeUpdate();
        if (transaction != null) {
            transaction.deleted.push(key);
        }
        return result;
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
        if (transaction == undefined) {
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
    // FIXME: return true only if any of the properties' value is different
    // than the entity value - this way we can check if it's necessary to
    // store an entity in database
    for (var name in properties) {
        var value = properties[name];
        if (isStorable(value)) {
            value.save();
            value = value._key;
        } else if (value instanceof Array) {
            value = value.map(function(obj) {
                if (obj instanceof Storable) {
                    obj.save();
                    return obj._key;
                } else {
                    return obj;
                }
            });
        }
        entity[name] = value;
    }
    return true;
};

/**
 * Inserts the entity into database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.insert = function(entity, transaction) {
    var mapping = this.getMapping(entity._key.type);
    var columns = [];
    var sqlBuf = new java.lang.StringBuffer("INSERT INTO ");
    var valuesBuf = new java.lang.StringBuffer(") VALUES (");
    sqlBuf.append(mapping.table).append(" (");
    
    // id column
    var idColumnName = this.getIdColumnName(entity._key.type);
    var nextId = this.generateId(entity._key.type);
    sqlBuf.append(this.dialect.quote(idColumnName));
    valuesBuf.append("?");
    columns.push({
        "name": idColumnName,
        "dataType": this.dialect.getColumnType("integer")
    });

    // collect properties
    for (var propName in mapping.properties) {
        var propMapping = mapping.properties[propName];
        // ignore properties that are null or undefined, and for which a
        // default value is set in mapping definition
        var value = entity[propMapping.column || propName];
        if ((value === null || value === undefined) && propMapping["default"] != null) {
            continue;
        }
        if (columns.length > 0) {
            sqlBuf.append(", ");
            valuesBuf.append(", ");
        }
        sqlBuf.append(this.dialect.quote(propMapping.column || propName));
        valuesBuf.append("?");
        columns.push({
            "name": propName,
            "dataType": this.dialect.getColumnType(propMapping.type)
        });
    }
    sqlBuf.append(valuesBuf.toString());
    sqlBuf.append(")");

    // execute insert
    log.info("Inserting", entity._key, sqlBuf.toString());
    var conn = null;
    var statement = null;
    try {
        if (transaction != null) {
            log.info("Using transaction mode");
            conn = transaction.getConnection();
            conn.setTransactionIsolation(java.sql.Connection.TRANSACTION_SERIALIZABLE);
            conn.setAutoCommit(false);
        } else {
            log.info("Using autocommit mode");
            conn = this.getConnection();
            conn.setAutoCommit(true);
        }
        conn.setReadOnly(false);
        statement = conn.prepareStatement(sqlBuf.toString());
        columns.forEach(function(column, idx) {
            if (column.name === idColumnName) {
                column.dataType.set(statement, nextId, idx + 1);
            } else {
                var value = entity[column.name];
                if (value === undefined || value === null) {
                    statement.setNull(idx + 1, column.dataType.jdbcTypeNumber);
                } else {
                    column.dataType.set(statement, value, idx + 1);
                }
            }
        });
        var result = statement.executeUpdate();
        if (transaction != null) {
            transaction.inserted.push(entity._key);
        }
        // update the entity key
        entity._key.id = nextId;
        return result;
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
        if (transaction == undefined) {
            sqlUtils.close(conn);
        }
    }
};

/**
 * Updates the entity in database
 * @param {Object} entity The entity object containing the values to store in DB
 * @param {Transaction} transaction Optional transaction instance
 */
Store.prototype.update = function(entity, transaction) {
    var mapping = this.getMapping(entity._key.type);
    var columns = [];
    var sqlBuf = new java.lang.StringBuffer("UPDATE ");
    sqlBuf.append(mapping.table).append(" SET ");

    for (var propName in mapping.properties) {
        if (columns.length > 0) {
            sqlBuf.append(", ");
        }
        var propMapping = mapping.properties[propName];
        sqlBuf.append(this.dialect.quote(propMapping.column || propName));
        sqlBuf.append(" = ?");
        columns.push({
            "name": propName,
            "dataType": this.dialect.getColumnType(propMapping.type)
        });
    }
    sqlBuf.append(" WHERE ");
    sqlBuf.append(this.dialect.quote(this.getIdColumnName(entity._key.type)));
    sqlBuf.append(" = ").append(entity._key.id);

    // execute insert
    log.info("Updating", entity._key, sqlBuf.toString());
    // TODO: this below is nearly the same for insert and update!
    var conn = null;
    var statement = null;
    try {
        if (transaction != null) {
            log.info("Using transaction mode");
            conn = transaction.getConnection();
            conn.setTransactionIsolation(java.sql.Connection.TRANSACTION_SERIALIZABLE);
            conn.setAutoCommit(false);
        } else {
            log.info("Using autocommit mode");
            conn = this.getConnection();
            conn.setAutoCommit(true);
        }
        conn.setReadOnly(false);
        statement = conn.prepareStatement(sqlBuf.toString());
        columns.forEach(function(column, idx) {
            var value = entity[column.name];
            if (value === undefined || value === null) {
                statement.setNull(idx + 1, column.dataType.jdbcTypeNumber);
            } else {
                column.dataType.set(statement, value, idx + 1);
            }
        });
        var result = statement.executeUpdate();
        if (transaction != null) {
            transaction.updated.push(entity._key);
        }
        return result;
    } catch (e) {
        throw e;
    } finally {
        sqlUtils.close(statement);
        if (transaction == undefined) {
            sqlUtils.close(conn);
        }
    }
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
    var mapping = this.getEntityConstructor(entity._key.type).mapping;
    var props = {};
    for (var name in mapping.properties) {
        var propMapping = mapping.properties[name];
        var value = entity[(propMapping.column || name)];
        if (isKey(value)) {
            // FIXME: this is appearently wrong, need to load a mapped
            props[name] = this.create(value.type, value, entity);
        } else {
            props[name] = value;
        }
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
    var tableName = this.getTableName(type);
    var idColumnName = this.getIdColumnName(type);
    var sqlBuf = new java.lang.StringBuffer("SELECT * FROM ");
    sqlBuf.append(tableName).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(idColumnName));
    sqlBuf.append(" = ").append(id.toString());
    log.info("Retrieving entity", sqlBuf.toString());
    // TODO: use preparedStatement
    var entities = this.query(sqlBuf.toString(), [id]);
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
    var tableName = this.getTableName(type);
    var idColumnName = this.getIdColumnName(type);
    var sqlBuf = new java.lang.StringBuffer("SELECT ");
    sqlBuf.append(this.dialect.quote(idColumnName)).append(" FROM ");
    sqlBuf.append(tableName).append(" WHERE ");
    sqlBuf.append(this.dialect.quote(idColumnName));
    sqlBuf.append(" = ").append(id.toString());
    log.info("Retrieving entity", sqlBuf.toString());
    // TODO: use preparedStatement
    var result = this.query(sqlBuf.toString(), [id]);
    if (result.length > 1) {
        throw new Error("Multiple rows returned by query");
    }
    return result.length === 1;
};



/**
 * Returns true if the value passed as argument is a key
 * @param {Object} value The value to check
 * @returns True if the value is a key, false otherwise
 * @type Boolean
 */
function isKey(value) {
    return value instanceof Key;
};

/**
 * Returns true if the argument is a storable
 * @param {Object} arg The value to check
 * @returns True if the argument is a storable, false otherwise
 * @type Boolean
 */
function isStorable(arg) {
    return arg != null && arg instanceof Storable; 
};

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
};

/******************************************
 *****    Q U E R Y   S U P P O R T   *****
 ******************************************/



/**
 * Loads an entity from database and returns an instance of the
 * appropriate registered constructor
 * @param {String} type The name of the registered constructor
 * @param {Number} id The id of the entity to return
 * @param {Boolean} aggressive If true the properties of the instance
 * are initialized right away. Default is to load the properties from
 * the database only if they are accessed
 * @returns An instance of the registered constructor function
 */
function getById(type, id, aggressive) {
    if (this.isEntityExisting(type, id) === true) {
        return this.create(type, new Key(type, id), null);
    }
    return null;
};
