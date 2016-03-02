var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../../lib/main");
var config = require("../config");
var utils = require("../utils");

const MAPPING_EVENT_JSON = {
    "properties": {
        "slug": "string",
        "data": "json"
    }
};

const MAPPING_EVENT_JSONB = {
    "properties": {
        "slug": "string",
        "data": "jsonb"
    }
};

var store, Event, EventB;

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(config.postgresql));
    store.setEntityCache(new Cache());
    Event = store.defineEntity("Event", MAPPING_EVENT_JSON);
    EventB = store.defineEntity("EventB", MAPPING_EVENT_JSONB);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Event, EventB);
    store.close();
};

exports.testSaveObject = function() {
    var event = new Event({
        "slug": "some event",
        "data": { "propertyString": "event1", "propertyNumber": 12345 }
    });
    var eventb = new EventB({
        "slug": "some event",
        "data": { "propertyString": "event2", "propertyNumber": 67890 }
    });
    event.save();
    eventb.save();

    assert.strictEqual(event.id, 1);
    assert.deepEqual(event.data, { "propertyString": "event1", "propertyNumber": 12345 });
    assert.strictEqual(eventb.id, 1);
    assert.deepEqual(eventb.data, { "propertyString": "event2", "propertyNumber": 67890 });

    assert.strictEqual(Event.all().length, 1);
    assert.strictEqual(EventB.all().length, 1);
};

exports.testQueryObjects = function() {
    // populate the tables
    store.beginTransaction();
    for (var i = 0; i < 10; i++) {
        let obj = { "title": "event" + i, "num": Math.random() };
        if (i % 2) {
            obj.rating = i;
        }
        let event = new Event({
            "slug": "event" + i,
            "data": obj
        });
        let eventb = new EventB({
            "slug": "event" + i,
            "data": obj
        });
        event.save();
        eventb.save();
    }
    store.commitTransaction();

    let query = "select Event.slug as slug, Event.data as data from Event order by Event.id";
    let result = store.query(query);
    assert.strictEqual(result.length, 10, query);
    assert.strictEqual(result[0].slug, "event0", query);
    assert.strictEqual(result[0].data.title, "event0", query);

    query = "select Event.slug from Event where Event.slug = 'event1'";
    result = store.query(query);
    assert.strictEqual(result.length, 1, query);

    query = "select EventB.slug as slug, EventB.data as data from EventB order by EventB.id";
    result = store.query(query);
    assert.strictEqual(result.length, 10, query);
    assert.strictEqual(result[0].slug, "event0", query);
    assert.strictEqual(result[0].data.title, "event0", query);

    query = "select EventB.slug from EventB where EventB.slug = 'event1'";
    result = store.query(query);
    assert.strictEqual(result.length, 1, query);

    let nativeQuery = "SELECT * FROM \"Event\" WHERE (data->'rating')IS NOT NULL";
    result = store.sqlQuery(nativeQuery);

    assert.strictEqual(result.length, 5, nativeQuery);
    assert.strictEqual(result[0].id, 2, "wrong id");
    assert.strictEqual(result[0].slug, "event1", "wrong slug");
    assert.strictEqual(result[0].data.rating, 1, "wrong rating");

    assert.strictEqual(result[1].id, 4, "wrong id");
    assert.strictEqual(result[1].slug, "event3", "wrong slug");
    assert.strictEqual(result[1].data.rating, 3, "wrong rating");

    nativeQuery = "SELECT * FROM \"EventB\" WHERE (data->'rating')IS NOT NULL";
    result = store.sqlQuery(nativeQuery);

    assert.strictEqual(result.length, 5, nativeQuery);
    assert.strictEqual(result[0].id, 2, "wrong id");
    assert.strictEqual(result[0].slug, "event1", "wrong slug");
    assert.strictEqual(result[0].data.rating, 1, "wrong rating");

    assert.strictEqual(result[1].id, 4, "wrong id");
    assert.strictEqual(result[1].slug, "event3", "wrong slug");
    assert.strictEqual(result[1].data.rating, 3, "wrong rating");
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
