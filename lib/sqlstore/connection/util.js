var objects = require("ringo/utils/objects");
var fs = require("fs");

var loadJars = exports.loadJars = function() {
    // add all jar files in jars directory to classpath
    var dir = module.resolve("../../../jars/");
    fs.list(dir).forEach(function(file) {
        if (fs.extension(file) === ".jar") {
            addToClasspath(fs.join(dir, file));
        }
    });
};

exports.initConnectionPool = function(props) {
    if (props.hasOwnProperty("pool")) {
        props = objects.clone(props);
        var poolType = props.pool.toLowerCase();
        delete props.pool;
        if (poolType === "c3p0") {
            return initC3p0(props);
        } else if (poolType === "bonecp") {
            return initBoneCP(props);
        } else {
            throw new Error("Unknown connection pool type '" + poolType + "'");
        }
    }
    return initJsConnectionPool(props);
};

var initJsConnectionPool = exports.initJsConnectionPool = function(props) {
    var {ConnectionPool} = require("./pool");
    return new ConnectionPool(props);
};

var initC3p0 = exports.initC3p0 = function(props) {
    loadJars();
    var dataSource = new com.mchange.v2.c3p0.ComboPooledDataSource();
    dataSource.setDriverClass(props.driver);
    dataSource.setJdbcUrl(props.url);
    dataSource.setUser(props.user);
    dataSource.setPassword(props.password);
    for each (let [key, value] in Iterator(props)) {
        if (["driver", "url", "user", "password"].indexOf(key) > -1) {
            continue;
        }
        dataSource[key] = value;
    }
    return dataSource;
};

var initBoneCP = exports.initBoneCP = function(props) {
    loadJars();
    var dataSource = new com.jolbox.bonecp.BoneCPDataSource();
    dataSource.setDriverClass(props.driver);
    dataSource.setJdbcUrl(props.url);
    dataSource.setUsername(props.user);
    dataSource.setPassword(props.password);
    for each (let [key, value] in Iterator(props)) {
        if (["driver", "url", "user", "password"].indexOf(key) > -1) {
            continue;
        }
        dataSource[key] = value;
    }
    return dataSource;
};
