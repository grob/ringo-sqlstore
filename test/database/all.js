const runner = require("../runner");
const system = require("system");

exports.testSchema = require("./schema_test");

if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
