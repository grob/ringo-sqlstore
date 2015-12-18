var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../../lib/main");
var utils = require("../utils");
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
                "author": author,
                "isEditor": idx % 2 === 0
            });
            relation.save();
            relations.push(relation);
        });
    })
    store.commitTransaction();
    return [authors, books, relations];
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

exports.testInnerJoinQuery = function() {
    var [authors, books, relations] = populate();
    // all books by author 1
    var result = store.query("from Book inner join Relation on Relation.book = Book.id where Relation.author = 1");
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, books[0].id);
    assert.strictEqual(result[1].id, books[1].id);
    // all authors of book 1 - this time with named parameter
    result = store.query("from Author inner join Relation on Relation.author = Author.id where Relation.book = :bookId", {
        "bookId": 1
    });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, authors[0].id);
    assert.strictEqual(result[1].id, authors[1].id);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
