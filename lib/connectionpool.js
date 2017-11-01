/**
 * @module connectionpool
 * @typedef {Object} HikariDataSource
 */

/**
 * Loads all .jar files placed in the `jars` directory of SqlStore
 */
const loadJars = exports.loadJars = function() {
    // add all jar files in jars directory to classpath
    const dir = module.resolve("../jars/");
    const repo = getRepository(dir);
    const list = repo.getResources().filter(function(resource) {
        return resource.name.slice(-4) === ".jar";
    });
    list.forEach(function(file) {
        addToClasspath(file);
    });
};

/**
 * Returns a newly instantiated connection pool using the properties
 * passed as argument
 * @param {Object} props The database properties
 * @returns {HikariDataSource}
 */
exports.init = function(props) {
    loadJars();
    const config = new com.zaxxer.hikari.HikariConfig();
    config.setDriverClassName(props.driver);
    config.setJdbcUrl(props.url);
    config.setUsername(props.user);
    config.setPassword(props.password);
    Object.keys(props).forEach(function(key) {
        if (["driver", "url", "user", "password"].indexOf(key) === -1) {
            config[key] = props[key];
        }
    });
    return new com.zaxxer.hikari.HikariDataSource(config);
};