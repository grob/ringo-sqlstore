var log = require("ringo/logging").getLogger(module.id);
var {TYPE_FORWARD_ONLY, CONCUR_READ_ONLY} = java.sql.ResultSet;
var {SQLTransactionRollbackException} = java.sql;


var retry = function(statement) {
    return function() {
        var retries = 5;
        var retry = false;
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

exports.insert = retry(function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var conn, statement;
    try {
        conn = transaction.getConnection();
        statement = conn.prepareStatement(mapping.sql.insert);
        mapping.mappings.forEach(function(propMapping, idx) {
            var value = storable._entity[propMapping.column];
            if (value === undefined || value === null) {
                statement.setNull(idx + 1, java.sql.Types.NULL);
            } else {
                propMapping.dataType.set(statement, idx + 1, value);
            }
        });
        var result = statement.executeUpdate();
        transaction.addInserted(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

exports.update = retry(function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var conn, statement;
    try {
        conn = transaction.getConnection();
        statement =  conn.prepareStatement(mapping.sql.update);
        // property values
        var max = mapping.mappings.length;
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
        var result = statement.executeUpdate();
        transaction.addUpdated(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

exports.remove = retry(function(storable, transaction) {
    var mapping = storable.constructor.mapping;
    var conn, statement;
    try {
        conn = transaction.getConnection();
        statement =  conn.prepareStatement(mapping.sql.remove);
        mapping.id.dataType.set(statement, 1, storable.id);
        var result = statement.executeUpdate();
        transaction.addDeleted(storable);
        return result;
    } finally {
        statement && statement.close();
    }
});

exports.exists = function(store, type, id) {
    var mapping = store.entityRegistry.getConstructor(type).mapping;
    if (log.isDebugEnabled()) {
        log.debug("Executing exists query", mapping.sql.exists, id);
    }
    var conn, statement;
    try {
        conn = store.getConnection();
        statement = conn.prepareStatement(mapping.sql.exists,
                TYPE_FORWARD_ONLY, CONCUR_READ_ONLY);
        mapping.id.dataType.set(statement, 1, id);
        return statement.executeQuery().next();
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn != null && !store.hasTransaction()) {
            conn.close();
        }
    }
};

exports.get = function(store, type, id) {
    var mapping = store.entityRegistry.getConstructor(type).mapping;
    if (log.isDebugEnabled()) {
        log.debug("Executing select query", mapping.sql.get, id);
    }
    var conn, statement;
    try {
        conn = store.getConnection();
        statement = conn.prepareStatement(mapping.sql.get,
                TYPE_FORWARD_ONLY, CONCUR_READ_ONLY);
        mapping.id.dataType.set(statement, 1, id);
        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
            var entity = {};
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
        if (conn != null && !store.hasTransaction()) {
            conn.close();
        }
    }
};

exports.query = function(store, sql, parameters, collectorFunc) {
    var conn, statement;
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
        if (conn != null && !store.hasTransaction()) {
            conn.close();
        }
    }
};