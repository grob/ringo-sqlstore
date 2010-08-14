exports.testH2 = require("./h2_test");
exports.testMysql = require("./mysql_test");
exports.testOracle = require("./oracle_test");

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
