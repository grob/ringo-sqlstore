var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store} = require("../../lib/main");
var dbSchema = require("../../lib/database/schema");
var metaData = require("../../lib/database/metadata");
var dbUtils = require("../../lib/database/utils");
var utils = require("../utils");

var store = null;
var conn = null;
var tableName = null;
var sequenceName = null;

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    conn = store.getConnection();
};

exports.tearDown = function() {
    if (tableName !== null) {
        dbSchema.dropTable(conn, store.dialect, tableName);
    }
    if (sequenceName !== null) {
        dbSchema.dropSequence(conn, store.dialect, sequenceName);
    }
    conn !== null && conn.close();
    store.close();
};

exports.testTable = function() {
    tableName = "t_test";
    var columns = [
        {
            "column": "tst_id",
            "type": "long"
        },
        {
            "column": "tst_name",
            "type": "string"
        }
    ];
    var primaryKeys = ["tst_id"];
    var result = dbSchema.createTable(conn, store.dialect,
                    null, tableName, columns, primaryKeys);
    assert.isTrue(result);
    var tables = metaData.getTables(conn, store.dialect);
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, tableName);
    assert.isTrue(metaData.tableExists(conn, store.dialect, tableName));
    assert.isTrue(dbSchema.dropTable(conn, store.dialect, tableName));
    assert.isFalse(metaData.tableExists(conn, store.dialect, tableName));
};

exports.testSequence = function() {
    if (!store.dialect.hasSequenceSupport) {
        return;
    }
    sequenceName = "test_id";
    var result = dbSchema.createSequence(conn, store.dialect, sequenceName);
    assert.isTrue(result);
    var sequences = metaData.getSequences(conn, store.dialect);
    assert.strictEqual(sequences.length, 1);
    assert.strictEqual(sequences[0].name, sequenceName);
    assert.isTrue(metaData.sequenceExists(conn, store.dialect, sequenceName));
    assert.isTrue(dbSchema.dropSequence(conn, store.dialect, sequenceName));
    assert.isFalse(metaData.sequenceExists(conn, store.dialect, sequenceName));
};

exports.testTruncateTable = function() {
    tableName = "t_test";
    var columns = [
        {
            "column": "tst_id",
            "type": "long"
        },
        {
            "column": "tst_name",
            "type": "string"
        }
    ];
    var primaryKeys = ["tst_id"];
    var result = dbSchema.createTable(conn, store.dialect,
                    null, tableName, columns, primaryKeys);
    assert.isTrue(result);
    dbUtils.executeUpdate(conn, [
        "insert into ", store.dialect.quote("t_test"),
        " (", store.dialect.quote("tst_id"), ", ", store.dialect.quote("tst_name"),
        ") values (1, 'test')"
    ].join(""));
    var collector = function(resultSet) {
        resultSet.next();
        return resultSet.getInt(1);
    };
    assert.strictEqual(dbUtils.executeQuery(conn, "select count(*) from " +
            store.dialect.quote("t_test"), collector), 1);
    dbSchema.truncateTable(conn, store.dialect, tableName);
    assert.strictEqual(dbUtils.executeQuery(conn, "select count(*) from " +
            store.dialect.quote("t_test"), collector), 0);
};

exports.testResetSequence = function() {
    if (store.dialect.hasSequenceSupport) {
        sequenceName = "test_id";
        var result = dbSchema.createSequence(conn, store.dialect, sequenceName);
        assert.isTrue(result);
        var collector = function(resultSet) {
            resultSet.next();
            return resultSet.getInt(1);
        };
        assert.strictEqual(dbUtils.executeQuery(conn,
                store.dialect.getSqlNextSequenceValue(sequenceName), collector), 1);
        dbSchema.resetSequence(conn, store.dialect, sequenceName);
        assert.strictEqual(dbUtils.executeQuery(conn,
                store.dialect.getSqlNextSequenceValue(sequenceName), collector), 1);
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
