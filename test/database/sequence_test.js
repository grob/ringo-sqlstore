var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store} = require("../../lib/main");
var dbSequence = require("../../lib/database/sequence");
var dbSchema = require("../../lib/database/schema");

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
    conn && conn.close();
    store.close();
};

exports.testMaxIdSequence = function() {
    sequenceName = "test_id";
    tableName = "t_test";
    var idColumnName = "tst_id";
    var columns = [{"column": idColumnName, "type": "long"}];
    assert.isTrue(dbSchema.createTable(conn, store.dialect,
            null, tableName, columns, [idColumnName]));
    var definition = {
        "table": tableName,
        "id": {
            "column": "tst_id"
        }
    };
    var seq = new dbSequence.MaxIdSequence(tableName, idColumnName);
    assert.isNotNull(seq);
    assert.isUndefined(seq.create(conn, store.dialect));
    assert.isUndefined(seq.drop(conn, store.dialect));
    assert.strictEqual(seq.getNextId(store), 1);
    // the table doesn't contain any records, but the sequence uses its
    // own counter, so with the next call it returns 2
    assert.strictEqual(seq.getNextId(store), 2);

    // the counter is global, so even if we create a new sequence
    // it returns the correct next value
    // TODO: switch to autogenerated ids if no sequence available
    /*
    var seq2 = new dbSequence.MaxIdSequence(tableName, idColumnName);
    assert.strictEqual(seq2.getNextId(store), 3);
    */
};

exports.testNativeSequence = function() {
    if (!store.dialect.hasSequenceSupport) {
        return;
    }
    sequenceName = "test_id";
    var seq = new dbSequence.NativeSequence(sequenceName, null);
    assert.isNotNull(seq);
    assert.isTrue(seq.create(conn, store.dialect));
    assert.strictEqual(seq.getNextId(store), 1);
    assert.strictEqual(seq.getNextId(store), 2);
    var seq2 = new dbSequence.NativeSequence(sequenceName, null);
    assert.strictEqual(seq2.getNextId(store), 3);
    assert.isTrue(seq.drop(conn, store.dialect));
};

exports.testCreate = function() {
    var Entity = "Test";
    // neither table nor column definition
    var seq = dbSequence.create(store.dialect, Entity, {});
    assert.isTrue(seq instanceof dbSequence.MaxIdSequence);
    assert.strictEqual(seq.table, Entity);
    assert.strictEqual(seq.column, "id");

    // table name defined
    var tableName = "t_test";
    seq = dbSequence.create(store.dialect, Entity, {
        "table": tableName
    });
    assert.isTrue(seq instanceof dbSequence.MaxIdSequence);
    assert.strictEqual(seq.table, tableName);
    assert.strictEqual(seq.column, "id");

    // id mapping defined, but no id column specified
    seq = dbSequence.create(store.dialect, Entity, {
        "table": tableName,
        "id": {
            "type": "long"
        }
    });
    assert.isTrue(seq instanceof dbSequence.MaxIdSequence);
    assert.strictEqual(seq.table, tableName);
    assert.strictEqual(seq.column, "id");

    // id mapping with column definition
    var idColumnName = "tst_id";
    seq = dbSequence.create(store.dialect, Entity, {
        "table": tableName,
        "id": {
            "column": idColumnName
        }
    });
    assert.isTrue(seq instanceof dbSequence.MaxIdSequence);
    assert.strictEqual(seq.table, tableName);
    assert.strictEqual(seq.column, idColumnName);

    // native sequence
    if (store.dialect.hasSequenceSupport) {
        sequenceName = "test_id";
        seq = dbSequence.create(store.dialect, Entity, {
            "table": tableName,
            "id": {
                "column": idColumnName,
                "sequence": sequenceName
            }
        });
        assert.isTrue(seq instanceof dbSequence.NativeSequence);
        assert.strictEqual(seq.name, sequenceName);
        assert.strictEqual(seq.schema, null);
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
