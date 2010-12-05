var runner = require("./runner");
var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var sqlUtils = require("ringo/storage/sql/util");
var store = null;
var Book = null;
var Author = null;

const MAPPING_BOOK = {
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "length": 255,
            "nullable": false,
        },
        "authorId": {
            "type": "integer",
            "column": "book_f_author",
            "nullable": false
        }
    }
};

function populate(nrOfBooks) {
    var transaction = store.createTransaction();
    for (var i=0; i<nrOfBooks; i+=1) {
        var nr = i + 1;
        var authorId = (i % 2) + 1;
        var book = new Book({
            "title": "Book " + nr,
            "authorId": authorId
        });
        book.save(transaction);
    }
    transaction.commit();
    return;
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Book = store.defineEntity("Book", MAPPING_BOOK);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Book, Author].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Book = null;
    Author = null;
    return;
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
                "entity": "Book"
            }
        }
    });
    var author = new Author({
        "name": "Author of all books"
    });
    author.save();
    author = Author.get(1);
    assert.strictEqual(author.books.length, 11);
    // iteration tests
    for (var i=0; i<author.books.length; i+=1) {
        assert.strictEqual(author.books.get(i)._id, i + 1);
    }
    var cnt = 0;
    for each (var book in author.books) {
        assert.isTrue(book instanceof Book);
        cnt += 1;
    }
    assert.strictEqual(cnt, author.books.length);
    cnt = 0;
    author.books.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        cnt += 1;
    });
    assert.strictEqual(cnt, author.books.length);
    return;
};

/**
 * Collection with filtering via foreignProperty and ordering
 */
exports.testWithForeignProperty = function() {
    populate(11);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "entity": "Book",
                "foreignProperty": "authorId",
                "orderBy": "id desc"
            }
        }
    });
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();
    author = Author.get(1);
    assert.strictEqual(author.books.length, 6);
    // due to ordering first book is the last one
    assert.strictEqual(author.books.get(0)._id, 11);
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
                "entity": "Book",
                "localProperty": "realId",
                "foreignProperty": "authorId",
                "orderBy": "id desc"
            }
        }
    });
    var author = new Author({
        "name": "Author of just a bunch of books",
        "realId": 2 // mimick other author
    });
    author.save();
    author = Author.get(1);
    assert.strictEqual(author.books.length, 5);
    // due to ordering first book is the last one
    assert.strictEqual(author.books.get(0)._id, 10);
    return;
};

/**
 * Partitioned collection with custom partition size, ordering and filtering
 * with foreignProperty
 */
exports.testPartitionedCollection = function() {
    populate(101);
    Author = store.defineEntity("Author", {
        "properties": {
            "name": {
                "type": "string"
            },
            "books": {
                "type": "collection",
                "entity": "Book",
                "isPartitioned": true,
                "partitionSize": 10,
                "foreignProperty": "authorId",
                "orderBy": "id desc"
            }
        }
    });
    var author = new Author({
        "name": "Author of just a bunch of books"
    });
    author.save();
    author = Author.get(1);

    assert.strictEqual(author.books.length, 51);
    // due to ordering first book is the last one
    assert.strictEqual(author.books.get(0)._id, 101);
    assert.isNotUndefined(author.books.partitions[0]);
    var book = author.books.get(10);
    assert.isNotUndefined(author.books.partitions[1]);
    assert.strictEqual(book._id, 81);
    book = author.books.get(50);
    assert.isNotUndefined(author.books.partitions[5]);
    for (var i=2; i<5; i+=1) {
        assert.isUndefined(author.books.partitions[i], "Partition " + i +
                " should be undefined");
    }
    return;
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
