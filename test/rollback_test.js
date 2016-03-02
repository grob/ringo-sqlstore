var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/main");
var utils = require("./utils");
var constants = require("../lib/constants");
var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "properties": {
        "name": "string",
        "isAlive": {
            "type": "boolean",
            "nullable": false
        }
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author);
    store.close();
};

exports.testInsertRollback = function() {
    var author = new Author({
        "name": "John Doe"
    });
    assert.throws(function() {
        author.save();
    });
    // since no explicit transaction was opened, the above does an auto-rollback
    assert.strictEqual(author._state, constants.STATE_TRANSIENT);
    // and nothing was put into the cache
    assert.strictEqual(store.entityCache.size(), 0);
    // trying to access the _cacheKey throws an exception because
    // the storable is still in transient state
    assert.throws(function() {
        assert.isNotNull(author._cacheKey);
    });
};

exports.testInsertRollbackWithTransaction = function() {
    // FIXME: how to force a transaction.commit() to fail?
    var transaction = store.beginTransaction();
    var author = new Author({
        "name": "John Doe",
        "isAlive": true
    });
    author.save();
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    // roll back the transaction
    transaction.rollback();
    assert.strictEqual(author._state, constants.STATE_TRANSIENT);
    // nothing was put into the cache
    assert.isFalse(store.entityCache.containsKey(author._cacheKey));
    assert.isNull(Author.get(1));
};

exports.testUpdateRollback = function() {
    var author = new Author({
        "name": "John Doe",
        "isAlive": true
    });
    author.save();
    // the stored entity has been put into the cache after successful save
    assert.isTrue(store.entityCache.containsKey(author._cacheKey));
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    author = Author.get(1);
    // set non-nullable property to null
    author.isAlive = null;
    assert.throws(function() {
        author.save();
    });
    // during auto-rollback (since no explict transaction was opened), the
    // state of the author instance has been reverted back
    assert.strictEqual(author._state, constants.STATE_DIRTY);
    // but the modified property stays the same
    assert.isNull(author.isAlive);
    // make sure the cached entity object is not affected by the change above
    var cachedEntity = store.entityCache.get(author._cacheKey);
    assert.isTrue(cachedEntity[Author.mapping.getMapping("isAlive").column]);
    author = Author.get(1);
    assert.isTrue(author.isAlive);
};

exports.testUpdateRollbackWithTransaction = function() {
    var author = new Author({
        "name": "John Doe",
        "isAlive": true
    });
    author.save();
    // the stored entity has been put into the cache after successful save
    assert.isTrue(store.entityCache.containsKey(author._cacheKey));
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    // open transaction
    author = Author.get(1);
    var transaction = store.beginTransaction();
    author.isAlive = false;
    author.save();
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    // now do a rollback - this should revert the storable's state back to DIRTY
    transaction.rollback();
    assert.strictEqual(author._state, constants.STATE_DIRTY);
    // but the modified property stays the same
    assert.isFalse(author.isAlive);
    // make sure the cached entity object is not affected by the changes above
    var cachedEntity = store.entityCache.get(author._cacheKey);
    assert.isTrue(cachedEntity[Author.mapping.getMapping("isAlive").column]);
    author = Author.get(1);
    assert.isTrue(author.isAlive);
};

exports.testRemoveRollback = function() {
    var author = new Author({
        "name": "John Doe",
        "isAlive": true
    });
    author.save();
    store.beginTransaction();
    author.name = "Jane Foo";
    assert.strictEqual(author._state, constants.STATE_DIRTY);
    author.remove();
    assert.strictEqual(author._state, constants.STATE_DELETED);
    store.abortTransaction();
    // FIXME: this is somehow wrong - the state should be reverted to DIRTY,
    // since that was the last state before removing...
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    assert.strictEqual(author.name, "Jane Foo");
    // make sure the cached entity object is not affected by the changes above
    var cachedEntity = store.entityCache.get(author._cacheKey);
    assert.strictEqual(cachedEntity[Author.mapping.getMapping("name").column], "John Doe");
    author = Author.get(1);
    assert.strictEqual(author.name, "John Doe");
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
