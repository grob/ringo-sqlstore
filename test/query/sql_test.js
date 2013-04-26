var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store} = require("../../lib/sqlstore/store");
var {ConnectionPool} = require("../../lib/sqlstore/connectionpool");
var {Cache} = require("../../lib/sqlstore/cache");
var sqlUtils = require("../../lib/sqlstore/util");
var {Parser} = require("../../lib/sqlstore/query/parser");
var {SqlFunctionGenerator} = require("../../lib/sqlstore/query/sqlfunctiongenerator");
var {getNamedParameter} = require("../../lib/sqlstore/query/query");
var store = null;
var Author = null;
var Book = null;

const MAPPING_AUTHOR = {
    "table": "T_AUTHOR",
    "id": {
        "column": "AUTHOR_ID"
    },
    "properties": {
        "name": {
            "column": "AUTHOR_NAME",
            "type": "string"
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

exports.setUp = function() {
    store = new Store(new ConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
        }
    });
    store.close();
    store = null;
    Author = null;
    Book = null;
    return;
};

var testQueries = function(queries, startRule, nparams) {
    for each (let {query, sql, values} in queries) {
        let tree = Parser.parse(query, startRule);
        let generator = new SqlFunctionGenerator(store, tree.aliases);
        let resultSql, params;
        if (startRule) {
            // use the generator as visitor and create an SQL string
            resultSql = tree.accept(generator);
            params = generator.params;
        } else {
            // use the generator to create the sql statement creator function
            let sqlFunction = generator.createSqlFunction(tree);
            [resultSql, params] = sqlFunction(nparams, getNamedParameter);
        }
        assert.strictEqual(resultSql, getExpectedSql(sql), query);
        if (values) {
            assert.deepEqual(params, values, query);
        }
    }
};

var getExpectedSql = function(str) {
    return str.replace(/\$(\w+)(?:\.(\w+))?/g, function(match, table, property) {
        var mapping = store.getEntityMapping(table);
        if (!property) {
            return mapping.getQualifiedTableName(store.dialect);
        }
        return mapping.getQualifiedColumnName(property, store.dialect);
    })
};

exports.testExpression = function() {
    var queries = [
        {
            "query": "Author.id",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id - 2",
            "sql": "($Author.id - ?)",
            "values": [{"type": "long", "value": 2}]
        },
        {
            "query": "Author.id + 2",
            "sql": "($Author.id + ?)",
            "values": [{"type": "long", "value": 2}]
        }
    ];

    testQueries(queries);
};

exports.testSelectClause = function() {
    var queries = [
        {
            "query": "select Author from Author",
            "sql": "SELECT $Author.id FROM $Author"
        },
        {
            "query": "select Author.name from Author",
            "sql": "SELECT $Author.name FROM $Author"
        },
        {
            "query": "select Author.* from Author",
            "sql": "SELECT $Author.id, $Author.name FROM $Author"
        },
        {
            "query": "select Author.name, max(Author.id) - min(Author.id) as authors from Author",
            "sql": "SELECT $Author.name, (MAX($Author.id) - MIN($Author.id)) FROM $Author"
        },
        // simple select
        {
            "query": "from Author",
            "sql": "SELECT $Author.id FROM $Author"
        },
        {
            "query": "from Author, Book",
            "sql": "SELECT $Author.id, $Book.id FROM $Author, $Book"
        }
    ];

    testQueries(queries);
};

exports.testAggregation = function() {
    var queries = [
        {
            "query": "select max(Author.id) from Author",
            "sql": "SELECT MAX($Author.id) FROM $Author"
        },
        {
            "query": "select min(Author.id) from Author",
            "sql": "SELECT MIN($Author.id) FROM $Author"
        },
        {
            "query": "select sum(Author.id) from Author",
            "sql": "SELECT SUM($Author.id) FROM $Author"
        },
        {
            "query": "select count(Author.id) from Author",
            "sql": "SELECT COUNT($Author.id) FROM $Author"
        },
        {
            "query": "select count(distinct Author.id) from Author",
            "sql": "SELECT COUNT(DISTINCT $Author.id) FROM $Author"
        }
    ];

    testQueries(queries);
};

exports.testWhereClause = function() {
    var queries = [
        // testing default entity
        {
            "query": "from Author where Author.id = 1",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.id = ?"
        },
        {
            "query": "from Author, Book where Author.id = 1",
            "sql": "SELECT $Author.id, $Book.id FROM $Author, $Book WHERE $Author.id = ?"
        },
        {
            "query": "from Book, Author where Book.title = 'test'",
            "sql": "SELECT $Book.id, $Author.id FROM $Book, $Author WHERE $Book.title = ?"
        }
    ];

    testQueries(queries);
};

exports.testParenthesis = function() {
    var queries = [
        {
            "query": "Author.id = 1",
            "sql": "$Author.id = ?"
        },
        {
            "query": "(Author.id = 1)",
            "sql": "$Author.id = ?"
        },
        {
            "query": "Author.id = 1 or Author.id = 2",
            "sql": "($Author.id = ? OR $Author.id = ?)"
        },
        {
            "query": "Author.id = 1 and Author.id = 2",
            "sql": "($Author.id = ? AND $Author.id = ?)"
        },
        {
            "query": "Author.id = 1 or (Author.id = 2 and Author.id = 3)",
            "sql": "($Author.id = ? OR ($Author.id = ? AND $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 and (Author.id = 2 or Author.id = 3)",
            "sql": "($Author.id = ? AND ($Author.id = ? OR $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 and (Author.id = 2 and Author.id = 3)",
            "sql": "($Author.id = ? AND ($Author.id = ? AND $Author.id = ?))"
        },
        {
            "query": "(Author.id = 1 or Author.id = 2) or (Author.id = 3)",
            "sql": "(($Author.id = ? OR $Author.id = ?) OR $Author.id = ?)"
        }
    ];

    testQueries(queries);
};

exports.testBetweenCondition = function() {
    var queries = [
        {
            "query": "between 1 and 10",
            "sql": "BETWEEN ? AND ?",
            "params": [1, 10]
        },
        {
            "query": "not between 1 and 10",
            "sql": "NOT BETWEEN ? AND ?",
            "params": [1, 10]
        },
        {
            "query": "between 'A' and 'D'",
            "sql": "BETWEEN ? AND ?",
            "params": ["A", "D"]
        }
    ];

    testQueries(queries, "condition_rhs");
};

exports.testIsNullCondition = function() {
    var queries = [
        {
            "query": "is null",
            "sql": "IS NULL"
        },
        {
            "query": "is NOT null",
            "sql": "IS NOT NULL"
        }
    ];

    testQueries(queries, "condition_rhs");
};

exports.testInCondition = function() {
    var queries = [
        {
            "query": "in (1,2,3)",
            "sql": "IN (?, ?, ?)",
            "params": [1, 2, 3]
        },
        {
            "query": "not in (1,2,3)",
            "sql": "NOT IN (?, ?, ?)",
            "params": [1, 2, 3]
        },
        {
            "query": 'in ("A","B","C")',
            "sql": "IN (?, ?, ?)",
            "params": ["A", "B", "C"]
        },
        {
            "query": 'in ( select Author.id from Author)',
            "sql": "IN (SELECT $Author.id FROM $Author)"
        },
        {
            "query": 'in ( select Author.id from Author where (Author.id = 123))',
            "sql": "IN (SELECT $Author.id FROM $Author WHERE $Author.id = ?)",
            "params": [123]
        },
        {
            "query": 'in ( select Author.id from Author where Author.id = 123 or Author.name like "John%")',
            "sql": "IN (SELECT $Author.id FROM $Author WHERE ($Author.id = ? OR $Author.name LIKE ?))",
            "params": [123, "John%"]
        }
    ];

    testQueries(queries, "condition_rhs");
};

exports.testLikeCondition = function() {
    var queries = [
        {
            "query": "like 'John%'",
            "sql": "LIKE ?",
            "params": ["John%"]
        },
        {
            "query": 'like "%ohn%"',
            "sql": "LIKE ?",
            "params": ["%ohn%"]
        },
        {
            "query": 'not like "John%"',
            "sql": "NOT LIKE ?",
            "params": ["John%"]
        }
    ];

    testQueries(queries, "condition_rhs");
};

exports.testNotCondition  = function() {

    var queries = [
        {
            "query": "not Author.id = 1",
            "sql": "NOT $Author.id = ?",
            "params": [1]
        }
    ];

    testQueries(queries, "condition");
};

exports.testOrderByClause = function() {
    var queries = [
        {
            "query": "order by Author.id",
            "sql": "ORDER BY $Author.id ASC"
        },
        {
            "query": "order by Author.id asc",
            "sql": "ORDER BY $Author.id ASC"
        },
        {
            "query": "order by Author.id desc",
            "sql": "ORDER BY $Author.id DESC"
        },
        {
            "query": "order by Author.id, Book.title",
            "sql": "ORDER BY $Author.id ASC, $Book.title ASC"
        },
        {
            "query": "order by Author.id desc, Book.title asc",
            "sql": "ORDER BY $Author.id DESC, $Book.title ASC"
        },
        {
            "query": "order by min(Author.id) desc",
            "sql": "ORDER BY MIN($Author.id) DESC"
        },
        {
            "query": "order by min(Author.id) + 1 desc",
            "sql": "ORDER BY (MIN($Author.id) + ?) DESC"
        },
        {
            "query": "order by Author.id nulls first",
            "sql": "ORDER BY $Author.id ASC NULLS FIRST"
        },
        {
            "query": "order by Author.id desc nulls last",
            "sql": "ORDER BY $Author.id DESC NULLS LAST"
        }
    ];

    testQueries(queries, "orderByClause");
};

exports.testGroupByClause = function() {
    var queries = [
        {
            "query": "group by Author.name",
            "sql": "GROUP BY $Author.name"
        },
        {
            "query": "group by Author.id, Book.title",
            "sql": "GROUP BY $Author.id, $Book.title"
        }
    ];

    testQueries(queries, "groupByClause");
};

exports.testHavingClause = function() {
    var queries = [
        {
            "query": "having Author.id > 10",
            "sql": "HAVING $Author.id > ?",
            "params": [10]
        },
        {
            "query": "having max(Author.id) > 10",
            "sql": "HAVING MAX($Author.id) > ?",
            "params": [10]
        },
        {
            "query": "having max(Author.id) > 10 and min(Author.id) < 20",
            "sql": "HAVING (MAX($Author.id) > ? AND MIN($Author.id) < ?)",
            "params": [10, 20]
        }
    ];

    testQueries(queries, "havingClause");
};

exports.testFromClause = function() {
    var queries = [
        {
            "query": "from Author",
            "sql": "FROM $Author"
        },
        {
            "query": "from Author, Book",
            "sql": "FROM $Author, $Book"
        },
        {
            "query": "from Author as author, Book as book",
            "sql": "FROM $Author author, $Book book"
        }
    ];

    testQueries(queries, "fromClause");
};

exports.testInnerJoin = function() {
    var queries = [
        {
            "query": "inner join Book on Author.id = Book.author",
            "sql": "INNER JOIN $Book ON $Author.id = $Book.author"
        },
        {
            "query": "join Book on Author.id = Book.author",
            "sql": "INNER JOIN $Book ON $Author.id = $Book.author"
        }
    ];

    testQueries(queries, "innerJoin");
};

exports.testOuterJoin = function() {
    var queries = [
        {
            "query": "left outer join Book on Author.id = Book.author",
            "sql": "LEFT OUTER JOIN $Book ON $Author.id = $Book.author"
        },
        {
            "query": "right outer join Book on Author.id = Book.author",
            "sql": "RIGHT OUTER JOIN $Book ON $Author.id = $Book.author"
        }
    ];

    testQueries(queries, "outerJoin");
};

exports.testNamedParameter = function() {
    var namedParams = {
        "id": 123,
        "price": 123.23,
        "title": "Book%"
    };
    var queries = [
        {
            "query": "Book.id = :id",
            "sql": "$Book.id = ?",
            "values": [{"type": "long", "value": namedParams.id}]
        },
        {
            "query": "Book.id = :price",
            "sql": "$Book.id = ?",
            "values": [{"type": "double", "value": namedParams.price}]
        },
        {
            "query": "Book.title like :title",
            "sql": "$Book.title LIKE ?",
            "values": [{"type": "string", "value": namedParams.title}]
        }
    ];
    testQueries(queries, undefined, namedParams);
};

exports.testStorableAsNamedParameter = function() {
    var book = new Book({"title": "Test"});
    book.save();
    var namedParams = {
        "book": Book.get(1)
    };
    var queries = [
        {
            "query": "Book = :book",
            "sql": "$Book.id = ?",
            "values": [{"type": "long", "value": book._id}]
        }
    ];
    testQueries(queries, undefined, namedParams);
};

exports.testSelectExpression = function() {
    var queries = [
        {
            "query": "Author.id",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id authorId",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id as authorId",
            "sql": "$Author.id"
        },
        {
            "query": "count( Author.id ) as cnt",
            "sql": "COUNT($Author.id)"
        },
        {
            "query": "max(Author.id) - min(Author.id) as authors",
            "sql": "(MAX($Author.id) - MIN($Author.id))"
        }
    ];
    testQueries(queries, "selectExpression");
};

exports.testAliases = function() {
    var mapping = Author.mapping;
    var idColumn = store.dialect.quote(mapping.getMapping("id").column);
    var authorIdColumn = store.dialect.quote(Book.mapping.getMapping("author").column);
    var nameColumn = store.dialect.quote(mapping.getMapping("name").column);
    var queries = [
        {
            "query": "select a.id as authorId from Author as a",
            "sql": "SELECT a." + idColumn + " FROM $Author a"
        },
        {
            "query": "select count(a.id) as authorId from Author as a",
            "sql": "SELECT COUNT(a." + idColumn + ") FROM $Author a"
        },
        {
            "query": "select author from Author as author",
            "sql": "SELECT author." + idColumn + " FROM $Author author"
        },
        {
            "query": "select author.* from Author as author",
            "sql": "SELECT author." + idColumn + ", author." + nameColumn + " FROM $Author author"
        },
        {
            "query": "select Author.* as author from Author",
            "sql": "SELECT $Author.id, $Author.name FROM $Author"
        },
        {
            "query": "from Author as author",
            "sql": "SELECT author." + idColumn + " FROM $Author author"
        },
        {
            "query": "from Author as a inner join Book as b on a.id = b.author",
            "sql": "SELECT a." + idColumn + " FROM $Author a INNER JOIN $Book b ON a." + idColumn + " = b." + authorIdColumn
        }
    ];
    for each (var {query, sql} in queries) {
        let tree = Parser.parse(query);
        let sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
        assert.strictEqual(sqlFunction()[0], getExpectedSql(sql), query);
    }
};

exports.testComplexQueries = function() {
    var queries = [
        {
            "query": "select Author.name, count(Book.id) from Author, Book where Book.author = Author.id group by Author.id order by Author.name",
            "sql": "SELECT $Author.name, COUNT($Book.id) FROM $Author, $Book WHERE $Book.author = $Author.id GROUP BY $Author.id ORDER BY $Author.name ASC"
        }
    ];
    testQueries(queries);
};

exports.testOffset = function() {
    var tree = Parser.parse("select Author from Author offset 10");
    var sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlOffset(sqlBuf, 10);

    var sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction()[0], sqlBuf.join(""));
    // parameter value as offset
    tree = Parser.parse("select Author from Author offset :offset");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlOffset(sqlBuf, "?");
    sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction({"offset": 10}, getNamedParameter)[0],
            sqlBuf.join(""));
};

exports.testLimit = function() {
    var tree = Parser.parse("select Author from Author limit 100");
    var sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlLimit(sqlBuf, 100);
    var sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction()[0], sqlBuf.join(""));
    // parameter value as limit
    tree = Parser.parse("select Author from Author limit :limit");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlLimit(sqlBuf, "?");
    sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction({"limit": 100}, getNamedParameter)[0],
            sqlBuf.join(""));
};

exports.testRange = function() {
    var tree = Parser.parse("select Author from Author offset 10 limit 100");
    var sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, 10, 100);
    var sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction()[0], sqlBuf.join(""));
    // reverse offset/limit definition
    tree = Parser.parse("select Author from Author limit 100 offset 10");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, 10, 100);
    sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction()[0], sqlBuf.join(""));
    // parameter value as offset/limit
    tree = Parser.parse("select Author from Author offset :offset limit :limit");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, "?", "?");
    sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction({"offset": 10, "limit": 100}, getNamedParameter)[0],
            sqlBuf.join(""));
};

exports.testDistinct = function() {
    var mapping = Author.mapping;
    var idColumn = store.dialect.quote(mapping.getMapping("id").column);
    var tree = Parser.parse("select distinct a from Author as a");
    var sql = getExpectedSql("SELECT DISTINCT a." + idColumn +
            " FROM $Author a");
    var sqlFunction = SqlFunctionGenerator.createSqlFunction(store, tree);
    assert.strictEqual(sqlFunction()[0], sql);
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
