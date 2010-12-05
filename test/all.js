var runner = require("./runner");

exports.testCache = require("./cache_test");
exports.testConnectionPool = require("./connectionpool_test");
exports.testStore = require("./store_test");
exports.testQuery = require("./query_test");
exports.testTransaction = require("./transaction_test");
exports.testObject = require("./object_test");
exports.testQueryJoin = require("./query_join_test");
exports.testQueryJsToSql = require("./query_jsToSql");
exports.testCollection = require("./collection_test");
exports.testCollectionManyToMany = require("./collection_manytomany_test");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
