var runner = require("./runner");
var assert = require("assert");

var Store = require("../lib/ringo/storage/sql/store").Store;
var sqlUtils = require("../lib/ringo/storage/sql/util");
var store = null;
var Author = null;
var Book = null;
var Relation = null;

const MAPPING_AUTHOR = {
    "id": {
        "column": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "nullable": false
         }
    }
};

const MAPPING_BOOK = {
    "id": {
        "column": "book_id"
    },
    "properties": {
        "title": {
            "type": "string",
            "column": "book_title",
            "length": 255,
            "nullable": false,
        }
    }
};

const MAPPING_RELATION = {
    "id": {
        "column": "rel_id"
    },
    "properties": {
        "author": {
            "type": "object",
            "entity": "Author",
            "column": "rel_author",
            "nullable": false
        },
        "book": {
            "type": "object",
            "entity": "Book",
            "column": "rel_book",
            "nullable": false
        }
    }
};

var populate = function() {
    var transaction = store.createTransaction();
    var authors = [];
    var books = [];
    for (var i=1; i<3; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save(transaction);
        authors.push(author);
        var book = new Book({
            "title": "Book " + i
        });
        book.save(transaction);
        books.push(book);
    }
    var relations = [];
    books.forEach(function(book) {
        authors.forEach(function(author, idx) {
            var relation = new Relation({
                "book": book,
                "author": author,
                "isEditor": idx % 2 === 0
            });
            relation.save(transaction);
            relations.push(relation);
        });
    })
    transaction.commit();
    return [authors, books, relations];
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    Relation = store.defineEntity("Relation", MAPPING_RELATION);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book, Relation].forEach(function(ctor) {
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
    Author = null;
    Book = null;
    Relation = null;
    return;
};

exports.testSimpleJoinQuery = function() {
    var [authors, books, relations] = populate();
    // all books by author 1
    var result = Book.query().join(Relation, "Relation.book == Book.id").equals("Relation.author", 1).select();
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]._id, books[0]._id);
    assert.strictEqual(result[1]._id, books[1]._id);
    // all authors of book 1
    result = Author.query().join(Relation, "Relation.author == Author.id").equals("Relation.book", 1).select();
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]._id, authors[0]._id);
    assert.strictEqual(result[1]._id, authors[1]._id);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
