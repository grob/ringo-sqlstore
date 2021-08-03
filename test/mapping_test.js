const runner = require("./runner");
const assert = require("assert");
const system = require("system");
const strings = require("ringo/utils/strings");
const {toByteArray} = require("binary");

const Store = require("../lib/store");
const dbMetaData = require("../lib/database/metadata");
const dialects = require("../lib/dialects/all");
const utils = require("./utils");

let store = null;
let Model = null;
let ParentModel = null;

const getColumnMetaData = function(store, mapping, propertName) {
    const propMapping = mapping.getMapping(propertName);
    const conn = store.getConnection();
    try {
        return dbMetaData.getColumns(conn, store.dialect, mapping.tableName,
                        null, propMapping.column)[0] || null;
    } finally {
        conn && conn.close();
    }
};

const getIndexInfo = function(mapping, isUnique) {
    const conn = store.getConnection();
    try {
        return dbMetaData.getIndexes(conn, store.dialect, mapping.tableName,
                null, isUnique === true, true);
    } finally {
        conn && conn.close();
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
};

exports.tearDown = function() {
    Model && utils.drop(store, Model);
    ParentModel && utils.drop(store, ParentModel);
    store.close();
};

exports.testNullable = function() {
    Model = store.defineEntity("Model", {
        "properties": {
            "name": {
                "type": "string",
                "nullable": false
            },
            "parent": {
                "type": "object",
                "entity": "ParentModel",
                "nullable": false
            }
        }
    });
    ParentModel = store.defineEntity("ParentModel", {
        "properties": {
            "name": "string"
        }
    });
    store.syncTables();
    // check table index metadata
    assert.isFalse(getColumnMetaData(store, Model.mapping, "name").nullable);
    assert.isFalse(getColumnMetaData(store, Model.mapping, "parent").nullable);
    // functional test
    new Model({"name": "John Doe", "parent": new ParentModel()}).save();
    assert.strictEqual(Model.all().length, 1);
    assert.throws(function() {
        new Model().save();
    }, java.sql.SQLException);
    assert.throws(function() {
        new Model({"name": "model"}).save();
    }, java.sql.SQLException);
};

exports.testUnique = function() {
    Model = store.defineEntity("Model", {
        "table": "t_model",
        "properties": {
            "name": {
                "type": "string",
                "length": 20,
                "unique": true
            }
        }
    });
    store.syncTables();
    // check table index metadata
    const indexInfo = getIndexInfo(Model.mapping, true);
    assert.isTrue(Object.keys(indexInfo).some(function(key) {
        let index = indexInfo[key];
        return index.isUnique === true && index.columns.some(function(column) {
            return column.name === Model.mapping.properties.name.column;
        });
    }));
    // functional test
    const props = {"name": "John Doe"};
    new Model(props).save();
    assert.throws(function() {
        new Model(props).save();
    }, java.sql.SQLException);
};

exports.testLength = function() {
    Model = store.defineEntity("Model", {
        "table": "t_model",
        "properties": {
            "name": {
                "type": "string",
                "length": 10
            }
        }
    });
    store.syncTables();
    // check table index metadata
    assert.strictEqual(getColumnMetaData(store, Model.mapping, "name").length,
            Model.mapping.properties.name.length);
    // functional test
    new Model({"name": "abcdefghij"}).save();
    assert.throws(function() {
        new Model({"name": "abcdefghijk"}).save();
    }, java.sql.SQLException);
};

exports.testPrecisionScale = function() {
    Model = store.defineEntity("Model", {
        "table": "t_model",
        "properties": {
            "doublep": {
                "type": "double",
                "precision": 6
            },
            "doubleps": {
                "type": "double",
                "precision": 6,
                "scale": 2
            }
        }
    });
    store.syncTables();
    let metaData = getColumnMetaData(store, Model.mapping, "doublep");
    assert.strictEqual(metaData.length, 6);
    assert.strictEqual(metaData.scale, 0);
    metaData = getColumnMetaData(store, Model.mapping, "doubleps");
    assert.strictEqual(metaData.length, 6);
    assert.strictEqual(metaData.scale, 2);
};

exports.testTypes = function() {
    const mapping = {
        "table": "typetest",
        "properties": {
            "typeInteger": {
                "type": "integer"
            },
            "typeLong": {
                "type": "long"
            },
            "typeShort": {
                "type": "short"
            },
            "typeDouble": {
                "type": "double"
            },
            "typeDoubleP": {
                "type": "double",
                "precision": 6
            },
            "typeDoublePs": {
                "type": "double",
                "precision": 6,
                "scale": 2
            },
            "typeCharacter": {
                "type": "character"
            },
            "typeString": {
                "type": "string"
            },
            "typeBoolean": {
                "type": "boolean"
            },
            "typeDate": {
                "type": "date"
            },
            "typeTime": {
                "type": "time"
            },
            "typeTimestamp": {
                "type": "timestamp"
            },
            "typeBinary": {
                "type": "binary"
            },
            "typeText": {
                "type": "text"
            }
        }
    };
    Model = store.defineEntity("Model", mapping);
    store.syncTables();

    /* this doesn't work with oracle databases, because integers
       are always returned as java.sql.DECIMAL

    for each (let [key, definition] in Iterator(mapping.properties)) {
        let metaData = getColumnMetaData(Model.mapping, key);
        console.log(key, metaData.toSource());
        console.log(definition.type, metaData.name, metaData.type);
        assert.strictEqual(jdbcDataTypes[metaData.type],
                dataTypes[definition.type], "Data type of " + key);
    }
     */

    const props = {
        "typeInteger": 12345678,
        "typeLong": 12345678910,
        "typeShort": 12345,
        "typeDouble": 2199.99,
        "typeDoubleP": 2200,
        "typeDoublePs": 2199.99,
        "typeCharacter": "T",
        "typeString": "Test",
        "typeBoolean": true,
        "typeDate": new Date(2010, 7, 11, 0, 0, 0, 0),
        "typeTime": new Date(1970, 0, 1, 17, 36, 4, 723),
        "typeTimestamp": new Date(2010, 7, 11, 36, 4, 23, 723),
        "typeBinary": toByteArray("test"),
        "typeText": strings.repeat("abcdefghij", 10000)
    };
    let model = new Model(props);
    model.save();

    // read values
    model = Model.get(1);
    Object.keys(mapping.properties).forEach(function(key) {
        const definition = mapping.properties[key];
        let value = model[key];
        let expected = props[key];
        switch (definition.type) {
            case "date":
            case "time":
            case "timestamp":
                assert.strictEqual(value.getFullYear(), expected.getFullYear(), key);
                assert.strictEqual(value.getMonth(), expected.getMonth(), key);
                assert.strictEqual(value.getDate(), expected.getDate(), key);
                assert.strictEqual(value.getHours(), expected.getHours(), key);
                assert.strictEqual(value.getMinutes(), expected.getMinutes(), key);
                assert.strictEqual(value.getSeconds(), expected.getSeconds(), key);
                // mysql < 5.6.4 doesn't know about millis,
                // and oracle doesn't store millis in DATE columns...
                if (store.dialect === dialects.h2 ||
                        store.dialect === dialects.postgresql ||
                        (store.dialect === dialects.oracle && definition.type !== "time")) {
                    assert.strictEqual(value.getMilliseconds(), expected.getMilliseconds(), key);
                }
                break;
            case "binary":
                assert.isTrue(java.util.Arrays.equals(value, expected));
                break;
            default:
                assert.strictEqual(value, expected);
        }
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
