var runner = require("./runner");
var assert = require("assert");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");
var system = require("system");

var {Store, Cache} = require("../lib/sqlstore/main");
var Transaction = require("../lib/sqlstore/transaction").Transaction;
var {Storable} = require("../lib/sqlstore/storable");
var sqlUtils = require("../lib/sqlstore/util");

var store = null;
var Author = null;
var Book = null;

const MAPPING_AUTHOR = {
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
        },
        "books": {
            "type": "collection",
            "query": "from Book b where b.author = :id"
        }
    }
};

const MAPPING_BOOK = {
    "table": "book",
    "id": {
        "column": "book_id",
        "sequence": "book_id"
    },
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "nullable": false
        },
        "author": {
            "type": "object",
            "entity": "Author",
            "column": "book_author"
        }
    }
};


exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Book, Author].forEach(function(ctor) {
        if (ctor == null) {
            return;
        }
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    store.close();
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
    assert.strictEqual(Object.keys(transaction.inserted).length, 0);
    return;
};

exports.testCommitRemove = function() {
    var transaction = store.beginTransaction();
    assert.isNotNull(transaction);
    assert.isFalse(transaction.isDirty());
    var author = new Author({
        "name": "Author"
    });
    author.save();
    var books = [];
    for (var i=0; i<5; i+=1) {
        let book = new Book({
            "title": "Book " + (i + 1),
            "author": author
        });
        book.save();
        books.push(book);
    }
    assert.strictEqual(Object.keys(transaction.inserted).length, books.length + 1);
    store.commitTransaction();
    assert.isFalse(store.hasTransaction());
    // populate the author's books collection and ensure it's in entity cache
    assert.strictEqual(author.books.length, books.length);
    assert.isTrue(store.entityCache.containsKey(author.books._cacheKey));
    // remove the author, but roll back the transaction - the cached collection
    // should stay in entity cache
    transaction = store.beginTransaction();
    author.remove();
    transaction.rollback();
    assert.isTrue(store.entityCache.containsKey(author.books._cacheKey));
    // now remove the author - this must evict the mapped collection from cache
    transaction = store.beginTransaction();
    author.remove();
    transaction.commit();
    assert.isFalse(store.entityCache.containsKey(author.books._cacheKey));
};

exports.testBeginTransaction = function() {
    assert.isNull(store.getTransaction());
    var transaction = store.beginTransaction();
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
    assert.strictEqual(Object.keys(transaction.inserted).length, 0);
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
    semaphore.tryWait(1000, nrOfWorkers);
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
    assert.isFalse(store.entityCache.containsKey(author._cacheKey));
    // even after re-getting the storable its _entity isn't cached
    Author.get(1);
    assert.isFalse(store.entityCache.containsKey(author._cacheKey));
    // same happens when querying for the newly created author instance
    assert.strictEqual(store.query("from Author where Author.id = 1")[0].id, 1);
    assert.isFalse(store.entityCache.containsKey(author._cacheKey));
    store.commitTransaction();
    // after commit the storable is visible and it's _entity cached
    assert.isTrue(store.entityCache.containsKey(author._cacheKey));
    assert.isTrue(author._key.equals(spawn(function() {
        return Author.get(1)._key;
    }).get()));
};

exports.testUpdateIsolation = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.isTrue(store.entityCache.containsKey(author._cacheKey));
    store.beginTransaction();
    author.name = "Jane Foo";
    author.save();
    // the above is not visible for other threads
    assert.strictEqual(spawn(function() {
        return Author.get(1).name;
    }).get(), "John Doe");
    // nor is the change above in cache
    assert.strictEqual(store.entityCache.get(author._cacheKey).author_name, "John Doe");
    // even after re-getting the storable its _entity isn't cached
    assert.strictEqual(Author.get(1).name, "Jane Foo");
    assert.strictEqual(store.entityCache.get(author._cacheKey).author_name, "John Doe");
    // same happens when querying for the newly created author instance
    assert.strictEqual(store.query("from Author a where a.id = 1")[0].name, "Jane Foo");
    assert.strictEqual(store.entityCache.get(author._cacheKey).author_name, "John Doe");
    store.commitTransaction();
    // after commit the storable is visible and it's _entity cached
    assert.strictEqual(store.entityCache.get(author._cacheKey).author_name, "Jane Foo");
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
    assert.isTrue(store.entityCache.containsKey(author._cacheKey));
    store.commitTransaction();
    // after commit the storable is gone from cache and for other threads too
    assert.isFalse(store.entityCache.containsKey(author._cacheKey));
    assert.isNull(spawn(function() {
        return Author.get(1);
    }).get());
};

exports.testCommitEvent = function() {
    var keys = null;
    store.addListener("commit", function(data) {
        keys = data;
    });
    var author = new Author({
        "name": "John Doe"
    });
    var book = new Book({
        "title": "Book",
        "author": author
    });
    // inserted
    book.save();
    assert.isNotNull(keys);
    assert.isTrue(keys.inserted.indexOf(author._cacheKey) > -1);
    assert.isTrue(keys.inserted.indexOf(book._cacheKey) > -1);
    // updated
    book.title = "New Book";
    book.save();
    assert.isTrue(keys.updated.indexOf(book._cacheKey) > -1);
    // access the books collection to force loading IDs
    assert.strictEqual(author.books.length, 1);
    store.beginTransaction();
    author.remove();
    book.remove();
    store.commitTransaction();
    assert.isTrue(keys.deleted.indexOf(author._cacheKey) > -1);
    assert.isTrue(keys.deleted.indexOf(book._cacheKey) > -1);
    // the author's books collection is removed from cache too
    assert.isTrue(keys.collections.indexOf(author.books._cacheKey) > -1);
};

exports.testOnSave = function() {
    var calledOnSave = 0;

    Author.prototype.onSave = function() {
        calledOnSave += 1;
    };

    var author = new Author({
        "name": "John Doe"
    });

    store.beginTransaction();
    author.save();
    // callbacks are executed after transaction has been committed successfully
    assert.strictEqual(calledOnSave, 0);
    store.commitTransaction();
    assert.strictEqual(calledOnSave, 1);

    // author hasn't been modified, so no callback is executed
    author.save();
    assert.strictEqual(calledOnSave, 1);

    // this time with implicit transaction
    author = Author.get(1);
    author.name = "Jane Foo";
    author.save();
    assert.strictEqual(calledOnSave, 2);
};

exports.testOnRemove = function() {
    var name = "John Doe";
    var calledOnRemove = false;

    Author.prototype.onRemove = function() {
        calledOnRemove = true;
        assert.strictEqual(this._state, Storable.STATE_DELETED);
        assert.strictEqual(this.name, name);
    };

    var author = new Author({
        "name": name
    });
    author.save();
    // remove the entity from the cache
    store.entityCache.clear();
    store.beginTransaction();
    // remove a newly created instance, i.e. it's data is not
    // loaded when remove() is called
    Author.get(1).remove();
    assert.isFalse(calledOnRemove);
    store.commitTransaction();
    assert.isTrue(calledOnRemove);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
