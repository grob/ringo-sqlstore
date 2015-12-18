var assert = require("assert");
var system = require("system");

var config = require("../config");
var {Store, Cache} = require("../../lib/sqlstore/main");
var sqlUtils = require("../../lib/sqlstore/util");

const MAPPING_EVENT_JSON = {
    "properties": {
        "data": "json"
    }
};

const MAPPING_EVENT_JSONB = {
    "properties": {
        "data": "jsonb"
    }
};

var store, Event, EventB;

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(config["postgresql"]));
    store.setEntityCache(new Cache());
    Event = store.defineEntity("Event", MAPPING_EVENT_JSON);
    EventB = store.defineEntity("EventB", MAPPING_EVENT_JSONB);
    store.syncTables();
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Event, EventB].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
        }
    });
    store.close();
};

exports.testSaveObject = function() {
    var event = new Event({
        "data": { "propertyString": "event1", "propertyNumber": 12345 }
    });
    var eventb = new EventB({
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

    return;
};

if (require.main === module) {
    system.exit(require("test").run(module.id));
}
