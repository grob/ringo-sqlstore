var runner = require("./runner");
var assert = require("assert");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");

var Store = require("../lib/sqlstore/store").Store;
var Transaction = require("../lib/sqlstore/transaction").Transaction;
var sqlUtils = require("../lib/sqlstore/util");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "table": "author",
    "id": {
        "column": "author_id"
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
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
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

exports.testCommit = function() {
    var transaction = store.beginTransaction();
    var authors = [];
    // insert some test objects
    for (var i=0; i<5; i+=1) {
        var author = new Author({
            "name": "Author " + (i + 1)
        });
        author.save();
        authors.push(author);
    }
    assert.strictEqual(Object.keys(transaction.inserted).length, authors.length);
    assert.isTrue(transaction.isDirty());
    store.commitTransaction();
    assert.strictEqual(Author.all().length, 5);
    return;
};

exports.testBeginTransaction = function() {
    assert.isNull(store.getTransaction());
    store.beginTransaction();
    var transaction = store.getTransaction();
    assert.isNotNull(transaction);
    assert.isFalse(transaction.isDirty());

    var authors = [];
    // insert some test objects
    for (var i=0; i<5; i+=1) {
        var author = new Author({
            "name": "Author " + (i + 1)
        });
        author.save();
        authors.push(author);
    }
    assert.strictEqual(Object.keys(transaction.inserted).length, authors.length);
    assert.isTrue(transaction.isDirty());
    assert.strictEqual(Author.all().length, 5);
    store.commitTransaction();
    assert.isNull(store.getTransaction());
    assert.strictEqual(Author.all().length, 5);

    // remove test objects
    store.beginTransaction();
    transaction = store.getTransaction();
    assert.isFalse(transaction.isDirty());
    authors.forEach(function(author) {
        author.remove();
    });
    assert.isTrue(transaction.isDirty());
    assert.strictEqual(Object.keys(transaction.deleted).length, 5);
    store.commitTransaction();
    assert.isNull(store.getTransaction());

    // abort transaction
    store.beginTransaction();
    transaction = store.getTransaction();
    var author = new Author({
        "name": "Author " + (authors.length + 1)
    });
    author.save(transaction);
    assert.isTrue(transaction.isDirty());
    assert.strictEqual(Object.keys(transaction.inserted).length, 1);
    store.abortTransaction();
    assert.isNull(Transaction.getInstance());
    assert.strictEqual(Author.all().length, 0);
    return;
};

exports.testMultipleModifications = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    store.beginTransaction();
    // step 1: modify author and save it, but don't commit the transaction
    author = Author.get(1);
    author.name = "Jane Foo";
    author.save();
    // step 2: modify author again, this time committing the transaction
    // sqlstore is expected to do *both* updates
    author.name = "John Doe";
    author.save();
    store.commitTransaction();
    assert.strictEqual(author.name, "John Doe");
    author = Author.get(1);
    assert.strictEqual(author.name, "John Doe");
};

exports.testConcurrentInserts = function() {
    var nrOfWorkers = 10;
    var cnt = 10;
    var semaphore = new Semaphore();

    for (var i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker(module.resolve("./transaction_worker"));
        w.onmessage = function(event) {
            semaphore.signal();
        };
        w.postMessage({
            "workerNr": i,
            "cnt": cnt,
            "Author": Author
        }, true);
    }
    semaphore.wait(nrOfWorkers);
    assert.strictEqual(Author.all().length, cnt * nrOfWorkers);
    return;
};

exports.testInsertIsolation = function() {
    store.beginTransaction();
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    // the above is not visible for other threads
    assert.isNull(spawn(function() {
        return Author.get(1);
    }).get());
    // nor is the storable's _entity in cache
    assert.isFalse(store.cache.containsKey(author._cacheKey));
    // even after re-getting the storable its _entity isn't cached
    Author.get(1);
    assert.isFalse(store.cache.containsKey(author._cacheKey));
    // same happens when querying for the newly created author instance
    assert.strictEqual(store.query("from Author where Author.id = 1")[0]._id, 1);
    assert.isFalse(store.cache.containsKey(author._cacheKey));
    store.commitTransaction();
    // after commit the storable is visible and it's _entity cached
    assert.isTrue(store.cache.containsKey(author._cacheKey));
    assert.isTrue(author._key.equals(spawn(function() {
        return Author.get(1)._key;
    }).get()));
};

exports.testUpdateIsolation = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.isTrue(store.cache.containsKey(author._cacheKey));
    store.beginTransaction();
    author.name = "Jane Foo";
    author.save();
    // the above is not visible for other threads
    assert.strictEqual(spawn(function() {
        return Author.get(1).name;
    }).get(), "John Doe");
    // nor is the change above in cache
    assert.strictEqual(store.cache.get(author._cacheKey)[1].author_name, "John Doe");
    // even after re-getting the storable its _entity isn't cached
    assert.strictEqual(Author.get(1).name, "Jane Foo");
    assert.strictEqual(store.cache.get(author._cacheKey)[1].author_name, "John Doe");
    // same happens when querying for the newly created author instance
    assert.strictEqual(store.query("from Author a where a.id = 1")[0].name, "Jane Foo");
    assert.strictEqual(store.cache.get(author._cacheKey)[1].author_name, "John Doe");
    store.commitTransaction();
    // after commit the storable is visible and it's _entity cached
    assert.strictEqual(store.cache.get(author._cacheKey)[1].author_name, "Jane Foo");
    assert.strictEqual(spawn(function() {
        return Author.get(1).name;
    }).get(), "Jane Foo");
};

exports.testRemoveIsolation = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    store.beginTransaction();
    author.remove();
    // the above is not visible for other threads
    assert.isNotNull(spawn(function() {
        return Author.get(1);
    }).get());
    // nor is the change above in cache
    assert.isTrue(store.cache.containsKey(author._cacheKey));
    store.commitTransaction();
    // after commit the storable is gone from cache and for other threads too
    assert.isFalse(store.cache.containsKey(author._cacheKey));
    assert.isNull(spawn(function() {
        return Author.get(1);
    }).get());
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
