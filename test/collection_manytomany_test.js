var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/main");
var utils = require("./utils");
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
        },
        "books": {
            "type": "collection",
            "query": "from Book join Relation on Relation.book = Book.id where Relation.author = :id"
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
            "nullable": false
        },
        "authors": {
            "type": "collection",
            "query": "from Author join Relation on Relation.author = Author.id where Relation.book = :id"
        },
        "editors": {
            "type": "collection",
            "query": "from Author join Relation on (Relation.author = Author.id and Relation.isEditor = true) and Relation.book = :id"
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

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    Relation = store.defineEntity("Relation", MAPPING_RELATION);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book, Relation);
    store.close();
};

exports.testSimpleCollection = function() {
    store.beginTransaction();
    var authors = [];
    var books = [];
    for (var i=1; i<3; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
        var book = new Book({
            "title": "Book " + i
        });
        book.save();
        books.push(book);
    }
    var relations = [];
    books.forEach(function(book) {
        authors.forEach(function(author, idx) {
            var relation = new Relation({
                "book": book,
                "author": author
            });
            relation.save();
            relations.push(relation);
        });
    })
    store.commitTransaction();
    var book = Book.get(1);
    assert.isNotNull(book);
    assert.strictEqual(book.authors.length, 2);
    assert.strictEqual(book.authors.get(0).id, authors[0].id);
    assert.strictEqual(book.authors.get(1).id, authors[1].id);
    var author = Author.get(2);
    assert.isNotNull(author);
    assert.strictEqual(author.books.length, 2);
    assert.strictEqual(author.books.get(0).id, books[0].id);
    assert.strictEqual(author.books.get(1).id, books[1].id);
    return;
};

exports.testAdditionalCriteria = function() {
    store.beginTransaction();
    var authors = [];
    for (var i=1; i<=2; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
    }
    var book = new Book({
        "title": "Book " + i
    });
    book.save();
    authors.forEach(function(author, idx) {
        var relation = new Relation({
            "book": book,
            "author": author,
            "isEditor": idx % 2 === 0
        });
        relation.save();
    });
    store.commitTransaction();
    var book = Book.get(1);
    assert.strictEqual(book.authors.length, 2);
    assert.strictEqual(book.editors.length, 1);
    assert.equal(book.editors.get(0).id, Author.get(1).id);
    return;
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
