var dbProps = {
    "url": "jdbc:postgresql://192.168.1.212/test",
    "driver": "org.postgresql.Driver",
    "username": "test",
    "password": "test"
};

require("./suite").forEach(function(moduleName) {
    var testName = "test " + moduleName;
    exports[testName] = require("./" + moduleName);
    exports[testName].setDbProps(dbProps);
});

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    require('test').run(exports);
}
