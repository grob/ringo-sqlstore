var dbProps = {
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
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
