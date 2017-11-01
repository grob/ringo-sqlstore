const runner = require("../runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../../lib/main");
const utils = require("../utils");
let store = null;
let Author = null;
let Book = null;
let Relation = null;

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
            "nullable": false
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

const populate = function() {
    store.beginTransaction();
    const authors = [];
    const books = [];
    for (let i=1; i<3; i+=1) {
        let author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
        let book = new Book({
            "title": "Book " + i
        });
        book.save();
        books.push(book);
    }
    const relations = [];
    books.forEach(function(book) {
        authors.forEach(function(author, idx) {
            const relation = new Relation({
                "book": book,
                "author": author,
                "isEditor": idx % 2 === 0
            });
            relation.save();
            relations.push(relation);
        });
    });
    store.commitTransaction();
    return [authors, books, relations];
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
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
    const [authors, books] = populate();
    // all books by author 1
    let result = store.query("from Book inner join Relation on Relation.book = Book.id where Relation.author = 1");
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
};

exports.testMultipleJoins = function() {
    const [authors, books] = populate();
    const result = store.query("from Book b " +
            "join Relation r on r.book = b.id " +
            "join Author a on r.author = a.id " +
            "where a.id = 1");
    assert.strictEqual(result.length, 2);
    result.forEach(function(obj, idx) {
        assert.isTrue(obj instanceof Book);
        assert.strictEqual(obj.id, books[idx].id);
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
