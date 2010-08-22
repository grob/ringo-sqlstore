var dbProps = {
    "url": "jdbc:oracle:thin:@192.168.1.215:1524:XE",
    "driver": "oracle.jdbc.driver.OracleDriver",
    "username": "test",
    "password": "test"
};

exports.testTransaction = require("./transaction_test");
exports.testTransaction.setDbProps(dbProps);
exports.testStore = require("./store_test");
exports.testStore.setDbProps(dbProps);

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require('test').run(exports);
}
