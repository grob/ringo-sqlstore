var term = require("ringo/term");
var assert = require("assert");
var Store = require("../lib/store");

var store = null;
var Author = null;

function onmessage(event) {
    var start = Date.now();
    store = new Store(event.data.connectionPool);
    store.setQueryCache(event.data.queryCache);
    store.setEntityCache(event.data.entityCache || null);
    Author = store.defineEntity("Author", event.data.mapping);
    var msPerQuery = [];
    for (let i=0; i<event.data.cnt; i+=1) {
        let s = Date.now();
        let id = ((Math.random() * event.data.maxAuthors) | 0) + 1;
        let author = store.query("select Author.* from Author where Author.id = :id", {
            "id": id
        })[0];
        //let author = store.sqlQuery("select * from \"author\" where \"author_id\" = ?", [id])[0];
        msPerQuery[i] = Date.now() - s;
    }
    event.source.postMessage({
        "workerNr": event.data.workerNr,
        "millis": Date.now() - start,
        "msPerQuery": msPerQuery
    });
}