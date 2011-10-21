var runner = require("./runner");
var assert = require("assert");
var scheduler = require("ringo/scheduler");

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
    assert.strictEqual(transaction.inserted.length, authors.length);
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
    assert.strictEqual(transaction.inserted.length, authors.length);
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
    assert.strictEqual(transaction.deleted.length, 5);
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
    assert.strictEqual(transaction.inserted.length, 1);
    store.abortTransaction();
    assert.isNull(Transaction.getInstance());
    assert.strictEqual(Author.all().length, 0);
    return;
};

exports.testConcurrentInserts = function() {
    var cnt = 100;
    var callback = function() {
        var threadId = java.lang.Thread.currentThread().getId();
        for (var i=0; i<cnt; i+=1) {
            var author = new Author({
                "name": "Author " + (i + 1)
            });
            author.save();
            // console.info("Inserted", author._key, "(Thread " + threadId + ")");
        }
        return true;
    };

    var t1 = scheduler.setTimeout(callback, 0);
    var t2 = scheduler.setTimeout(callback, 0);
    assert.isTrue(t1.get());
    assert.isTrue(t2.get());
    assert.strictEqual(Author.all().length, cnt * 2);
    return;
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
