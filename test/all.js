var runner = require("./runner");

exports.testCache = require("./cache_test");
exports.testCollectionManyToMany = require("./collection_manytomany_test");
exports.testCollection = require("./collection_test");
exports.testCollectionCache = require("./collection_cache_test");
exports.testConnectionPool = require("./connectionpool_test");
exports.testJSON = require("./json_test");
exports.testLifecycle = require("./lifecycle_test");
exports.testMapping = require("./mapping_test");
exports.testObject = require("./object_test");
exports.testStore = require("./store_test");
exports.testRollback = require("./rollback_test");
exports.testTransaction = require("./transaction_test");
exports.testQuery = require("./query/all");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
