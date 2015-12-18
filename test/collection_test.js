var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/sqlstore/main");
var constants = require("../lib/sqlstore/constants");
var utils = require("./utils");
var store = null;
var Book = null;
var Author = null;

const MAPPING_BOOK = {
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "length": 255,
            "nullable": false
        },
        "authorId": {
            "type": "integer",
            "column": "book_f_author",
            "nullable": false
        },
        "available": {
            "type": "boolean"
        }
    }
};

function populate(nrOfBooks) {
    store.beginTransaction();
    for (var i=0; i<nrOfBooks; i+=1) {
        var nr = i + 1;
        var authorId = (i % 2) + 1;
        var book = new Book({
            "title": "Book " + nr,
            "authorId": authorId,
            "available": (i % 2) === 0
        });
        book.save();
    }
    store.commitTransaction();
    return;
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    store.close();
};

/**
 * Basic collection test, including iteration
 */
exports.testBasics = function() {
    populate(11);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of all books"
    });
    // "books" collection is null as long as author is transient
    assert.isNull(author.books);
    author.save();
    // after persisting "books" collection is existing and populated at first access
    assert.strictEqual(author.books.length, 11);
    // iteration tests
    for (var i=0; i<author.books.length; i+=1) {
        assert.strictEqual(author.books.get(i).id, i + 1);
    }
    var cnt = 0;
    for each (var book in author.books) {
        assert.isTrue(book instanceof Book);
        assert.strictEqual(book.id, cnt + 1);
        cnt += 1;
    }
    assert.strictEqual(cnt, author.books.length);
    cnt = 0;
    author.books.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.strictEqual(book.id, cnt + 1);
        cnt += 1;
    });
    assert.strictEqual(cnt, author.books.length);
    // array methods
    assert.strictEqual(author.books.indexOf(author.books.get(2)), 2);
    assert.strictEqual(author.books.filter(function(book, idx) {
        return book.id % 2 === 0;
    }).length, 5);
    author.books.filter(function(book, idx) {
        return book.id % 2 === 0;
    }).forEach(function(book) {
        assert.isTrue(book instanceof Book);
    });
    assert.isTrue(author.books.some(function(book) {
        return book.id === 5;
    }));
    assert.isTrue(author.books.every(function(book) {
        return book instanceof Book;
    }));
    var ids = author.books.map(function(book) {
        return book.id;
    });
    ids.forEach(function(id, idx) {
        assert.strictEqual(id, idx + 1);
    });
    return;
};

exports.testWithQueryParameter = function() {
    populate(11);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where id > :threshold",
                "params": {
                    "threshold": 6
                }
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of half of the books"
    });
    author.save();
    author = Author.get(1);
    assert.strictEqual(author.books.length, 5);
    author.books.forEach(function(book, idx) {
        assert.strictEqual(book.id, idx + 7);
    });
};

/**
 * Collection with filtering via foreignProperty and ordering
 */
exports.testWithForeignProperty = function() {
    populate(11);
    Author = store.defineEntity("Author", {
        "id": {
            "column": "AUTHOR_ID"
        },
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where authorId = :id order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    assert.isNull(author.books);
    author.save();
    assert.isNotUndefined(author.books);
    assert.strictEqual(author.books.length, 6);
    // due to ordering first book is the last one
    assert.strictEqual(author.books.get(0).id, 11);
    return;
};

/**
 * Collection with filtering via local- and foreignProperty and ordering
 */
exports.testWithLocalAndForeignProperty = function() {
    populate(11);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "realId": {
                "type": "integer"
            },
            "books": {
                "type": "collection",
                "query": "from Book join Author on authorId = :realId order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books",
        "realId": 2 // mimick other author
    });
    assert.isNull(author.books);
    author.save();
    assert.isNotUndefined(author.books);
    assert.strictEqual(author.books.length, 5);
    // due to ordering first book is the last one
    assert.strictEqual(author.books.get(0).id, 10);
    return;
};

exports.testAggressiveLoading = function() {
    populate(11);
    // this is important, because populating also populates the cache
    store.entityCache.clear();
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "select b.* from Book b where b.authorId = :id"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.strictEqual(author.books.length, 6);
    for each (let book in author.books.all) {
        assert.isNotNull(book._entity);
    }
};

exports.testReloadInTransaction = function() {
    populate(101);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where authorId = :id order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();

    store.beginTransaction();
    var book = new Book({
        "title": "New Book",
        "authorId": 1,
        "available": true
    });
    book.save();
    author.books.invalidate();
    assert.strictEqual(author.books._state, constants.STATE_UNLOADED);
    // the collection manipulation above isn't visible to other threads
    assert.strictEqual(spawn(function() {
        return Author.get(1).books.length;
    }).get(), 51);
    // but for this thread the collection already contains the added book
    assert.strictEqual(author.books.length, 52);
    assert.strictEqual(author.books._state, constants.STATE_CLEAN);
    // even when retrieving a new author instance, the above added book is
    // contained in the collection
    assert.strictEqual(Author.get(1).books.length, 52);

    // committing the transaction will put the IDs of author.books into
    // the store's cache
    store.commitTransaction();
    // after commit the ids of the above collection is stored in cache
    var cachedIds = store.entityCache.get(author.books._cacheKey);
    assert.strictEqual(cachedIds, author.books.ids);
    // after commit the change is visible to other threads too
    assert.strictEqual(spawn(function() {
        return Author.get(1).books.ids;
    }).get(), author.books.ids);
};

exports.testInvalidateInTransaction = function() {
    populate(101);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where authorId = :id order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();
    // make sure the collection is cached
    assert.strictEqual(author.books.length, 51);
    assert.strictEqual(author.books.ids, store.entityCache.get(author.books._cacheKey));

    store.beginTransaction();
    var book = new Book({
        "title": "New Book 2",
        "authorId": 1,
        "available": true
    });
    book.save();
    author.books.invalidate();
    assert.isTrue(store.entityCache.containsKey(author.books._cacheKey));
    // cached collection is untouched
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).length, 51);
    store.commitTransaction();
    // after commit, the collection has been removed from the cache, since
    // it hasn't been reloaded during the transaction
    assert.isFalse(store.entityCache.containsKey(author.books._cacheKey));
};

exports.testRollbackWithoutReload = function() {
    populate(101);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where authorId = :id order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();
    // make sure the collection is cached
    assert.strictEqual(author.books.length, 51);
    assert.strictEqual(author.books.ids, store.entityCache.get(author.books._cacheKey));
    store.beginTransaction();
    var book = new Book({
        "title": "New Book 2",
        "authorId": 1,
        "available": true
    });
    book.save();
    author.books.invalidate();
    assert.isTrue(store.entityCache.containsKey(author.books._cacheKey));
    // cached collection is untouched
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).length, 51);
    store.abortTransaction();
    // the collection is reverted to it's previous state
    assert.strictEqual(author.books._state, constants.STATE_UNLOADED);
    assert.strictEqual(store.entityCache.get(author.books._cacheKey), author.books.ids);
    // store's cache is untouched
    assert.isTrue(store.entityCache.containsKey(author.books._cacheKey));
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).length, 51);
};

exports.testRollbackWithReload = function() {
    populate(101);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "query": "from Book where authorId = :id order by id desc"
            }
        }
    });
    store.syncTables();
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();
    // make sure the collection is cached
    assert.strictEqual(author.books.length, 51);
    assert.strictEqual(author.books.ids, store.entityCache.get(author.books._cacheKey));
    store.beginTransaction();
    var book = author.books.get(10);
    book.remove();
    author.books.invalidate();
    assert.strictEqual(author.books._state, constants.STATE_UNLOADED);
    // accessing .length reloads the collection
    assert.strictEqual(author.books.length, 50);
    // reloading the collection creates a new IDs array different from the one in cache
    assert.isFalse(store.entityCache.get(author.books._cacheKey) === author.books.ids);
    // the removed book isn't in collection anymore
    assert.strictEqual(author.books.indexOf(book), -1);
    // since we're in an open transaction, the cached collection is untouched
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).length, 51);
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).indexOf(book.id), 10);
    // so the remove above isn't visible to other threads
    assert.strictEqual(spawn(function() {
        return Author.get(1).books.length;
    }).get(), 51);

    store.abortTransaction();
    // the collection is reverted to it's previous state
    assert.strictEqual(author.books._state, constants.STATE_UNLOADED);
    assert.strictEqual(store.entityCache.get(author.books._cacheKey), author.books.ids);
    assert.strictEqual(store.entityCache.get(author.books._cacheKey).length, 51);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
