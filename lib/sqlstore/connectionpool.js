/**
 * Loads all .jar files placed in the `jars` directory of SqlStore
 * @ignore
 */
var loadJars = exports.loadJars = function() {
    // add all jar files in jars directory to classpath
    var dir = module.resolve("../../jars/");
    var repo = getRepository(dir);
    var list = repo.getResources().filter(function(resource) {
        return resource.name.slice(-4) === ".jar";
    });
    list.forEach(function(file) {
        addToClasspath(file);
    });
};

exports.init = function(props) {
    loadJars();
    var config = new com.zaxxer.hikari.HikariConfig();
    config.setDriverClassName(props.driver);
    config.setJdbcUrl(props.url);
    config.setUsername(props.user);
    config.setPassword(props.password);
    for each (let [key, value] in Iterator(props)) {
        if (["driver", "url", "user", "password"].indexOf(key) > -1) {
            continue;
        }
        config[key] = value;
    }
    return new com.zaxxer.hikari.HikariDataSource(config);
};