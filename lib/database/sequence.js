var log = require("ringo/logging").getLogger(module.id);
var dbSchema = require("./schema");

exports.create = function(dialect, type, definition) {
    if (!dialect.hasSequenceSupport || !definition.id || !definition.id.sequence) {
        var column = (definition.id && definition.id.column) || "id";
        return new MaxIdSequence(definition.table || type, column, definition.schema);
    }
    return new NativeSequence(definition.id.sequence, definition.schema);
};

var NativeSequence = exports.NativeSequence = function(name, schema) {
    Object.defineProperties(this, {
        "name": {"value": name, "enumerable": true},
        "schema": {"value": schema || null, "enumerable": true}
    });
    return this;
};

NativeSequence.prototype.getNextId = function(store) {
    var sql = store.dialect.getSqlNextSequenceValue(this.name);
    if (log.isDebugEnabled()) {
        log.debug("Retrieving next ID from sequence", this.name);
    }
    var statement = null;
    var conn = store.getConnection();
    try {
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        var resultSet = statement.executeQuery(sql);
        resultSet.next();
        return resultSet.getLong(1);
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn != null && !store.hasTransaction()) {
            conn.close();
        }
    }
};

NativeSequence.prototype.create = function(conn, dialect) {
    return dbSchema.createSequence(conn, dialect, this.name, this.schema);
};

NativeSequence.prototype.drop = function(conn, dialect) {
    return dbSchema.dropSequence(conn, dialect, this.name, this.schema);
};

var MaxIdSequence = exports.MaxIdSequence = function(table, column, schema) {
    var lastId = 0;
    var lock = {};

    Object.defineProperties(this, {
        "table": {"value": table, "enumerable": true},
        "column": {"value": column, "enumerable": true},
        "schema": {"value": schema || null, "enumerable": true},
        "getNextId": {
            "value": sync((function(store) {
                var maxId = this.getMaxId(store);
                return (lastId = Math.max(maxId + 1, lastId + 1));
            }).bind(this), lock),
            "enumerable": true}
    });

    return this;
};

MaxIdSequence.prototype.getMaxId = function(store) {
    // retrieve the max id used in the table
    var sql = "SELECT MAX(" + store.dialect.quote(this.column, this.table) +
                ") FROM " + store.dialect.quote(this.table, this.schema);
    if (log.isDebugEnabled()) {
        log.debug("Retrieving max ID of", this.table);
    }
    var statement = null;
    var conn = store.getConnection();
    try {
        statement = conn.createStatement();
        var resultSet = statement.executeQuery(sql);
        resultSet.next();
        return resultSet.getLong(1);
    } finally {
        statement && statement.close(); // closes resultSet too
        if (conn != null && !store.hasTransaction()) {
            conn.close();
        }
    }
};

MaxIdSequence.prototype.create = function() {};

MaxIdSequence.prototype.drop = function() {};
