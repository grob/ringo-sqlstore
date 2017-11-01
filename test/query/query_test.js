const runner = require("../runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../../lib/main");
const constants = require("../../lib/constants");
const utils = require("../utils");
let store = null;
let Author = null;
let Book = null;

const MAPPING_AUTHOR = {
    "table": "T_AUTHOR",
    "id": {
        "column": "AUTHOR_ID"
    },
    "properties": {
        "name": {
            "column": "AUTHOR_NAME",
            "type": "string"
        },
        "books": {
            "type": "collection",
            "query": "from Book b where b.author = :id"
        }
    }
};

const MAPPING_BOOK = {
    "table": "T_BOOK",
    "id": {
        "column": "BOOK_ID"
    },
    "properties": {
        "title": {
            "column": "BOOK_TITLE",
            "type": "string"
        },
        "author": {
            "column": "BOOK_F_AUTHOR",
            "type": "object",
            "entity": "Author"
        }
    }
};

const populate = function() {
    store.beginTransaction();
    const authors = [];
    const books = [];
    for (let i=0; i<10; i+=1) {
        let author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
        let book = new Book({
            "title": "Book " + i,
            "author": authors[i]
        });
        book.save();
        books.push(book);
    }
    store.commitTransaction();
    return [authors, books];
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    store.close();
};

exports.testSelectEntity = function() {
    populate();
    const queries = [
        "from Book",
        "select Book from Book",
        "select Book as book from Book",
        "select b from Book b",
        "select b as book from Book b"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10);
        result.forEach(function(book, idx) {
            assert.strictEqual(book.id, idx + 1, query);
            assert.strictEqual(book._entity, constants.LOAD_LAZY, query);
        });
    });
};

exports.testSelectMultipleEntities = function() {
    populate();
    const queries = [
        "select Author, Book from Book, Author where Book.author = Author.id and Author.id < 6",
        "select a, b from Book b, Author a where b.author = a.id and a.id < 6",
        "select a, b from Book b, Author a where author = a and a < 6"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 5);
        result.forEach(function(props, idx) {
            assert.strictEqual(props["Book"].id, idx + 1);
            assert.strictEqual(props["Author"].id, idx + 1);
        });
    });
};

exports.testSelectEntityCached = function() {
    populate();
    store.setEntityCache(new Cache());
    const result = store.query("select Book from Book");
    assert.strictEqual(result.length, 10);
    assert.strictEqual(store.entityCache.estimatedSize(), 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book.id, idx + 1);
        assert.strictEqual(book._entity, constants.LOAD_LAZY);
        assert.isNotNull(store.entityCache.getIfPresent(book._cacheKey));
        assert.strictEqual(store.entityCache.getIfPresent(book._cacheKey), constants.LOAD_LAZY);
    });
    store.entityCache.invalidateAll();
    store.setEntityCache(null);
};

exports.testSelectEntityAggressive = function() {
    populate();
    const queries = [
        "select Book.* from Book",
        "select b.* from Book b",
        "select * from Book b",
        "select * from Book"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10);
        result.forEach(function(book, idx) {
            assert.isTrue(book instanceof Book);
            assert.isTrue(book.author instanceof Author);
            assert.strictEqual(book.id, idx + 1);
            assert.isFalse(book._entity === constants.LOAD_LAZY);
        });
    });
};

exports.testSelectEntityAggressiveCached = function() {
    populate();
    store.setEntityCache(new Cache());
    const titleColumn = Book.mapping.getMapping("title").column;
    const result = store.query("select Book.* from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.isTrue(book.author instanceof Author);
        assert.strictEqual(book.id, idx + 1);
        assert.isNotNull(book._entity);
        assert.strictEqual(book._entity[titleColumn], "Book " + idx);
        assert.isNotNull(store.entityCache.getIfPresent(book._cacheKey));
        // books are loaded aggressively, so cache contains the entity objects
        assert.isNotNull(store.entityCache.getIfPresent(book._cacheKey));
        assert.isNotNull(store.entityCache.getIfPresent(book.author._cacheKey));
        // but authors are not, therefor the cache contains null
        assert.strictEqual(store.entityCache.getIfPresent(book.author._cacheKey), constants.LOAD_LAZY);
    });
    store.entityCache.invalidateAll();
    store.setEntityCache(null);
};

exports.testSelectMultipleEntitiesAggressive = function() {
    populate();
    const queries = [
        "select b.*, a.* from Book b, Author a where b.author = a.id",
        "select b.*, a.* from Book b, Author a where author = a"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10);
        result.forEach(function(obj, idx) {
            assert.isTrue(obj.Book instanceof Book);
            assert.isTrue(obj.Author instanceof Author);
            assert.isFalse(obj.Book._entity === constants.LOAD_LAZY);
            assert.isFalse(obj.Author._entity === constants.LOAD_LAZY);
            assert.strictEqual(obj.Book.id, idx + 1);
            assert.strictEqual(obj.Book.title, "Book " + idx);
            assert.strictEqual(obj.Book.author.id, obj.Author.id);
            assert.strictEqual(obj.Author.id, idx + 1);
        });
    });
};

exports.testSelectProperties = function() {
    populate();
    let queries = [
        "select Book.title from Book",
        "select b.title from Book b",
        "select title from Book b",
        "select title from Book"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10, query);
        result.forEach(function(title, idx) {
            assert.strictEqual(title, "Book " + idx, query);
        });
    });
    queries = [
        ["select Book.title, Book.id from Book", "Book."],
        ["select b.title, b.id from Book b", "b."],
        ["select title, id from Book b", ""],
        ["select title, id from Book", ""]
    ];
    queries.forEach(function([query, prefix]) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10, query);
        result.forEach(function (props, idx) {
            assert.strictEqual(Object.keys(props).length, 2, query);
            assert.strictEqual(props[prefix + "id"], idx + 1, query);
            assert.strictEqual(props[prefix + "title"], "Book " + idx, query);
        });
    });
    queries = [
        ["select Author.id, Book.title from Book, Author where Book.author = Author.id and Author.id < 6", ["Author.", "Book."]],
        ["select a.id, b.title from Book b, Author a where b.author = a.id and a.id < 6", ["a.", "b."]],
        ["select a.id, b.title from Book b, Author a where author = a and a < 6", ["a.", "b."]]
    ];
    queries.forEach(function([query, propPrefixes]) {
        let result = store.query(query);
        assert.strictEqual(result.length, 5, query);
        result.forEach(function (props, idx) {
            assert.strictEqual(Object.keys(props).length, 2, query);
            assert.strictEqual(props[propPrefixes[0] + "id"], idx + 1, query);
            assert.strictEqual(props[propPrefixes[1] + "title"], "Book " + idx, query);
        });
    });
};

exports.testSelectValues = function() {
    populate();
    let queries = [
        "select max(Book.id) from Book",
        "select max(b.id) from Book b",
        "select max(id) from Book b",
        "select max(id) from Book"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 1, query);
        assert.strictEqual(result[0], 10, query);
    });
    // multiple values without aliases
    queries = [
        ["select min(Book.id), max(Book.id) from Book", "Book."],
        ["select min(b.id), max(b.id) from Book b", "b."],
        ["select min(id), max(id) from Book b", ""],
        ["select min(id), max(id) from Book", ""]
    ];
    queries.forEach(function([query, prefix]) {
        let result = store.query(query);
        assert.strictEqual(result.length, 1, query);
        let props = result[0];
        assert.strictEqual(Object.keys(props).length, 2, query);
        assert.strictEqual(props["MIN(" + prefix + "id)"], 1, query);
        assert.strictEqual(props["MAX(" + prefix + "id)"], 10, query);
    });
    // multiple values without result object aliases
    queries = [
        "select min(Book.id) as min, max(Book.id) as max from Book",
        "select min(b.id) as min, max(b.id) as max from Book b",
        "select min(id) as min, max(id) as max from Book b",
        "select min(id) as min, max(id) as max from Book"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(Object.keys(result[0]).length, 2);
        assert.strictEqual(result[0].min, 1);
        assert.strictEqual(result[0].max, 10);
    });
    // operand with alias
    queries = [
        "select Book.id || '-' || Book.title from Book order by Book asc",
        "select b.id || '-' || b.title from Book b order by b.id asc",
        "select id || '-' || title from Book b order by b asc",
        "select id || '-' || title from Book order by id asc"
    ];
    queries.forEach(function(query) {
        let result = store.query(query);
        assert.strictEqual(result.length, 10, query);
        result.forEach(function(str, idx) {
            assert.strictEqual(str, (idx + 1) + "-Book " + idx, query);
        });
    });
};

exports.testNamedParameter = function() {
    populate();
    // named params
    const result = store.query("from Book where Book.title like :title", {
        "title": "Book%"
    });
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.strictEqual(book.title, "Book " + idx);
        assert.strictEqual(book.id, idx + 1);
    });
};

exports.testStorableAsNamedParameter = function() {
    populate();
    const author = Author.get(1);
    const book = store.query("from Book where Book.author = :author", {
        "author": author
    });
    assert.strictEqual(book.length, 1);
    assert.isTrue(book[0] instanceof Book);
    assert.isTrue(book[0].author._key.equals(author._key));
};

exports.testAliases = function() {
    populate();
    let result = store.query("select Author.name as author, Book.title as title from Author, Book where Book.author = Author.id");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["title"], "Book " + idx);
    });
    result = store.query("select a.name as author from Author as a where a.id < 6");
    assert.strictEqual(result.length, 5);
    result.forEach(function(name, idx) {
        assert.strictEqual(name, "Author " + idx);
    });
    result = store.query("select count(Author.id) as cnt from Author");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select count(aut.id) as cnt from Author aut");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select Author.name author, count(Book.id) from Author, Book where Book.author = Author.id group by Author.name order by Author.name");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["COUNT(Book.id)"], 1);
    });
    result = store.query("select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.name order by Author.name");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["cnt"], 1);
    });
    result = store.query("select a as author, b as book from Author a inner join Book b on a.id = b.author");
    assert.strictEqual(result.length, 10);
};

exports.testSelectAggregation = function() {
    populate();
    let result = store.query("select count(Book.id) from Book");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select count(Book.id) as cnt from Book");
    assert.strictEqual(result[0], 10);
};

exports.testSummand = function() {
    populate();
    let result = store.query("select Book.id + 10 from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, idx + 11);
    });
    result = store.query("select ((Book.id + 1) * 2) from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, ((idx + 2) * 2));
    });
};

exports.testSubSelect = function() {
    populate();
    const query = "from Author where id = 1 or id = (select author from Book where title = 'Book 2') order by id";
    let result = store.query(query);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 1);
    assert.strictEqual(result[1].id, 3);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
