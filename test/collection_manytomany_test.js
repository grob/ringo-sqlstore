var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var sqlUtils = require("ringo/storage/sql/util");
var store = null;
var Author = null;
var Book = null;
var Relation = null;
var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
};

const MAPPING_AUTHOR = {
    "id": {
        "column": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "nullable": false
         },
         "books": {
            "type": "collection",
            "entity": "Book",
            "through": "Relation",
            "join": "Relation.book == Book.id",
            "foreignProperty": "Relation.author"
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
        },
        "authors": {
            "type": "collection",
            "entity": "Author",
            "through": "Relation",
            "join": "Relation.author == Author.id",
            "foreignProperty": "Relation.book"
        },
        "editors": {
            "type": "collection",
            "entity": "Author",
            "through": "Relation",
            "join": "Relation.author == Author.id && Relation.isEditor == true",
            "foreignProperty": "Relation.book"
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
        },
        "isEditor": "boolean"
    }
};

exports.setDbProps = function(props) {
    dbProps = props;
    return;
};

exports.setUp = function() {
    store = new Store(dbProps);
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

exports.testSimpleCollection = function() {
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
                "author": author
            });
            relation.save(transaction);
            relations.push(relation);
        });
    })
    transaction.commit();
    var book = Book.get(1);
    assert.isNotNull(book);
    assert.strictEqual(book.authors.length, 2);
    assert.equal(book.authors.get(0), authors[0]);
    assert.equal(book.authors.get(1), authors[1]);
    var author = Author.get(2);
    assert.isNotNull(author);
    assert.equal(author.books.length, 2);
    assert.equal(author.books.get(0), books[0]);
    assert.equal(author.books.get(1), books[1]);
    return;
};

exports.testAdditionalCriteria = function() {
    var transaction = store.createTransaction();
    var authors = [];
    for (var i=1; i<2; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save(transaction);
        authors.push(author);
    }
    var book = new Book({
        "title": "Book " + i
    });
    book.save(transaction);
    authors.forEach(function(author, idx) {
        var relation = new Relation({
            "book": book,
            "author": author,
            "isEditor": idx % 2 === 0
        });
        relation.save(transaction);
    });
    transaction.commit();
    var book = Book.get(1);
    assert.strictEqual(book.editors.length, 1);
    assert.equal(book.editors.get(0), Author.get(1));
    return;
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require("test").run(exports);
}
