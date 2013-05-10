var term = require("ringo/term");
var assert = require("assert");
var {Store} = require("../lib/sqlstore/store");
var {Cache} = require("../lib/sqlstore/cache");

var store = null;
var Author = null;

var MAPPING_AUTHOR = {
    // "schema": "TEST",
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
        }
    }
};

function onmessage(event) {
    var start = Date.now();
    store = new Store(event.data.connectionPool);
    store.setQueryCache(event.data.queryCache);
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    var msPerQuery = [];
    for (let i=0; i<event.data.cnt; i+=1) {
        let s = Date.now();
        let id = ((Math.random() * event.data.maxAuthors) | 0) + 1;
        let author = store.query("select Author.* from Author where Author.id = :id", {
            "id": id
        })[0];
        msPerQuery[i] = Date.now() - s;
//        store.sqlQuery("select 1");
        // assert.strictEqual(author._id, id);
    }
    event.source.postMessage({
        "workerNr": event.data.workerNr,
        "millis": Date.now() - start,
        "msPerQuery": msPerQuery
    });
}