var runner = require("./runner");
var assert = require("assert");

var Store = require("../lib/sqlstore/store").Store;
var sqlUtils = require("../lib/sqlstore/util");
var {Storable} = require("../lib/sqlstore/storable");
var {Key} = require("../lib/sqlstore/key");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    // "schema": "TEST",
    "table": "author",
    "id": {
        "column": "author_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "author_name",
            "nullable": false
        }
    }
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    assert.isNotNull(store);
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    assert.isTrue(Author instanceof Function);
    // static constructor functions
    assert.strictEqual(typeof(Author.get), "function");
    assert.strictEqual(typeof(Author.all), "function");
    assert.strictEqual(Author, store.getEntityConstructor("Author"));
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    var schemaName = Author.mapping.schemaName || store.dialect.getDefaultSchema(conn);
    if (sqlUtils.tableExists(conn, Author.mapping.tableName, schemaName)) {
        sqlUtils.dropTable(conn, store.dialect, Author.mapping.tableName, schemaName);
        if (Author.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
            sqlUtils.dropSequence(conn, store.dialect, Author.mapping.id.sequence, schemaName);
        }
    }
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Author = null;
    return;
};

exports.testInternalProps = function() {
    var author = new Author();
    assert.strictEqual(author._props.constructor, Object);
    assert.isFalse(author._props.hasOwnProperty("name"));
    assert.isUndefined(author._entity);
    assert.strictEqual(author._key.constructor, Key);
    assert.isNull(author._key.id);
    assert.isUndefined(author.name);
    author.name = "John Doe";
    assert.isTrue(author._props.hasOwnProperty("name"));
    assert.isNotUndefined(author._props.name);
    author.save();
    assert.isNotUndefined(author._entity);
    assert.isNotNull(author._key.id);
    // save() clears the _props object
    assert.deepEqual(author._props, {});
    assert.isNotUndefined(author.name);
    assert.isFalse(author._props.hasOwnProperty("name"));
    // setting the name property stores the new value in the _props object
    author.name = "Jane Foo";
    assert.isTrue(author._props.hasOwnProperty("name"));
    var mapping = author.constructor.mapping;
    assert.strictEqual(author._entity[mapping.getMapping("name").column], "John Doe");
    assert.strictEqual(author._props.name, "Jane Foo");
};

exports.testLifecycle = function() {
    var author = new Author({
        "name": "John Doe"
    });
    assert.strictEqual(author._state, Storable.STATE_TRANSIENT);
    author.save();
    assert.strictEqual(Author.all().length, 1);
    assert.strictEqual(author._state, Storable.STATE_CLEAN);
    author = Author.get(1);
    assert.strictEqual(author._state, Storable.STATE_CLEAN);
    // modify
    author.name = "Jane Foo";
    assert.strictEqual(author._state, Storable.STATE_DIRTY);
    author.save();
    assert.strictEqual(author._state, Storable.STATE_CLEAN);
    // remove
    author = Author.get(1);
    assert.strictEqual(author._state, Storable.STATE_CLEAN);
    author.remove();
    assert.strictEqual(author._state, Storable.STATE_DELETED);
    assert.strictEqual(Author.all().length, 0);
};

exports.testAlreadyRemoved = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.strictEqual(Author.all().length, 1);
    author.remove();
    // modify removed entity
    author.name = "Jane Foo";
    // state is still STATE_DELETED
    assert.strictEqual(author._state, Storable.STATE_DELETED);
    // saving throws an error
    assert.throws(function() {
        author.save();
    }, Error);
    assert.strictEqual(Author.all().length, 0);
};

exports.testMultipleRemoval = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.strictEqual(Author.all().length, 1);
    author = Author.get(1);
    author.remove();
    assert.strictEqual(author._state, Storable.STATE_DELETED);
    assert.strictEqual(Author.all().length, 0);
    author.remove();
    assert.strictEqual(author._state, Storable.STATE_DELETED);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
