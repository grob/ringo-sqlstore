const term = require("ringo/term");
const assert = require("assert");
const Store = require("../lib/store");

let store = null;
let Author = null;

function onmessage(event) {
    const start = Date.now();
    store = new Store(event.data.connectionPool);
    store.setQueryCache(event.data.queryCache);
    store.setEntityCache(event.data.entityCache || null);
    Author = store.defineEntity("Author", event.data.mapping);
    const msPerQuery = [];
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