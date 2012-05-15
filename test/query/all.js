var runner = require("../runner");

exports.testAst = require("./ast_test");
exports.testSql = require("./sql_test");
exports.testQuery = require("./query_test");
exports.testQueryJoin = require("./query_join_test");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
