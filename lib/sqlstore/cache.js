addToClasspath(module.resolve("../../jars/concurrentlinkedhashmap-lru-1.4.jar"));

var {ConcurrentLinkedHashMap} = com.googlecode.concurrentlinkedhashmap;

exports.Cache = function(size) {
    if (isNaN(parseInt(size, 10)) || !isFinite(size)) {
        size = 1000;
    }
    return ConcurrentLinkedHashMap.Builder().maximumWeightedCapacity(size).build();
};