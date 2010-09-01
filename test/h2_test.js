var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
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
