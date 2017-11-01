/**
 * @module database/statements
 */

const log = require("ringo/logging").getLogger(module.id);
const {TYPE_FORWARD_ONLY, CONCUR_READ_ONLY} = java.sql.ResultSet;
const {SQLTransactionRollbackException} = java.sql;

const retry = function(statement) {
    return function() {
        let retries = 5;
        let retry = false;
        do {
            try {
                return statement.apply(null, arguments);
            } catch (e if e.javaException instanceof SQLTransactionRollbackException) {
                if (retries === 0) {
                    throw e;
                }
                log.error("Retrying statement due to exception", e);
                retry = true;
                // be nice, wait a bit
                java.lang.Thread.sleep(50);
            }
        } while (retry === true && retries-- > 0);
    };
};

/**
 * Inserts a storable into the database
 * @param {Storable} storable The storable to insert
 * @param {Transaction} transaction The transaction
 * @returns {Number} The number of storables inserted (always 1)
 */
exports.insert = retry(function(storable, transaction) {
    const mapping = storable.constructor.mapping;
    let generatedKeys = null;
    if (mapping.id.autoIncrement || mapping.id.sequence) {
        generatedKeys = java.lang.reflect.Array.newInstance(java.lang.String, 1);
        generatedKeys[0] = new java.lang.String(mapping.id.column);
    }
    const max = mapping.mappings.length;
    let conn, statement;
    try {
        conn = transaction.getConnection();
        statement = conn.prepareStatement(mapping.sql.insert, generatedKeys);
        // start at idx 1 to skip the id mapping
        for (let idx = 1; idx < max; idx += 1) {
            let propMapping = mapping.mappings[idx];
            let value = storable._entity[propMapping.column];
            if (value === undefined || value === null) {
                statement.setNull(idx, java.sql.Types.NULL);
            } else {
                propMapping.dataType.set(statement, idx, value);
            }
        }
        const result = statement.executeUpdate();
        if (generatedKeys !== null) {
            const resultSet = statement.getGeneratedKeys();
            if (resultSet.next()) {
                storable._key.id =
                        storable._entity[mapping.id.column] =
                                resultSet.getLong(1);
            } else {
                throw new Error("Expected receiving a generated ID");
            }
        }
        transaction.addInserted(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

/**
 * Updates the record represented by the storable with its values
 * @param {Storable} storable The storable to update
 * @param {Transaction} transaction The transaction
 * @returns {Number} The number of storables updated (always 1)
 */
exports.update = retry(function(storable, transaction) {
    const mapping = storable.constructor.mapping;
    let conn, statement;
    try {
        conn = transaction.getConnection();
        statement =  conn.prepareStatement(mapping.sql.update);
        // property values
        const max = mapping.mappings.length;
        for (let idx=1; idx<max; idx+=1) {
            let propMapping = mapping.mappings[idx];
            let value = storable._entity[propMapping.column];
            if (value === undefined || value === null) {
                statement.setNull(idx, java.sql.Types.NULL);
            } else {
                propMapping.dataType.set(statement, idx, value);
            }
        }
        // id value
        mapping.id.dataType.set(statement, max, storable._key.id);
        const result = statement.executeUpdate();
        transaction.addUpdated(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

/**
 * Removes the record represented by the storable from the database
 * @param {Storable} storable The storable to remove
 * @param {Transaction} transaction The transaction
 * @returns {Number} The number of storables removed (always 1)
 */
exports.remove = retry(function(storable, transaction) {
    const mapping = storable.constructor.mapping;
    let conn, statement;
    try {
        conn = transaction.getConnection();
        statement =  conn.prepareStatement(mapping.sql.remove);
        mapping.id.dataType.set(statement, 1, storable.id);
        const result = statement.executeUpdate();
        transaction.addDeleted(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

/**
 * Removes the record represented by the storable from the database
 * @param {Store} store The store
 * @param {String} type The type of entity
 * @param {Number} id The ID to check for existence in the database
 * @returns {boolean} True if the database contains a record with the given id
 */
exports.exists = function(store, type, id) {
    const mapping = store.entityRegistry.getConstructor(type).mapping;
    if (log.isDebugEnabled()) {
        log.debug("Executing exists query", mapping.sql.exists, id);
    }
    let conn, statement;
    try {
        conn = store.getConnection();
        statement = conn.prepareStatement(mapping.sql.exists,
                TYPE_FORWARD_ONLY, CONCUR_READ_ONLY);
        mapping.id.dataType.set(statement, 1, id);
        return statement.executeQuery().next();
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn && !store.hasTransaction()) {
            conn.close();
        }
    }
};

/**
 * Returns the data stored in database for a given type and id
 * @param {Store} store The store
 * @param {String} type The entity type
 * @param {Number} id The ID
 * @returns {Object} An object containing all data stored in database for the
 * given ID, with property names equaling column names
 */
exports.get = function(store, type, id) {
    const mapping = store.entityRegistry.getConstructor(type).mapping;
    if (log.isDebugEnabled()) {
        log.debug("Executing select query", mapping.sql.get, id);
    }
    let conn, statement;
    try {
        conn = store.getConnection();
        statement = conn.prepareStatement(mapping.sql.get,
                TYPE_FORWARD_ONLY, CONCUR_READ_ONLY);
        mapping.id.dataType.set(statement, 1, id);
        const resultSet = statement.executeQuery();
        if (resultSet.next()) {
            const entity = {};
            mapping.mappings.forEach(function(columnMapping, idx) {
                entity[columnMapping.column] =
                        columnMapping.dataType.get(resultSet, idx + 1);
            });
            if (resultSet.next()) {
                throw new Error("Multiple rows returned by query");
            }
            return entity;
        }
        return null;
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn && !store.hasTransaction()) {
            conn.close();
        }
    }
};

/**
 * Executes a query against the database
 * @param {Store} store The store
 * @param {String} sql The SQL query string
 * @param {Object} parameters An object containing statement parameters
 * @param {Function} collectorFunc A collector function which receives the
 * statement resultset and the store as arguments, and is expected to return
 * an array of objects, each containing the values of a record stored in database.
 * @returns {Array} An array containing objects with the query result, as returned
 * by the collector function passed as argument
 */
exports.query = function(store, sql, parameters, collectorFunc) {
    let conn, statement;
    try {
        conn = store.getConnection();
        if (log.isDebugEnabled()) {
            log.debug("Executing query", sql, parameters.toSource());
        }
        statement = conn.prepareStatement(sql,
                TYPE_FORWARD_ONLY, CONCUR_READ_ONLY);
        parameters.forEach(function(param, idx) {
            param.dataType.set(statement, idx + 1, param.value);
        });
        return collectorFunc(statement.executeQuery(), store);
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn && !store.hasTransaction()) {
            conn.close();
        }
    }
};