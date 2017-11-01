/**
 * @module cache
 */

addToClasspath(module.resolve("../jars/concurrentlinkedhashmap-lru-1.4.2.jar"));

module.exports = function(size) {
    if (isNaN(parseInt(size, 10)) || !isFinite(size)) {
        size = 1000;
    }
    const builder = com.googlecode.concurrentlinkedhashmap.ConcurrentLinkedHashMap.Builder();
    return builder.maximumWeightedCapacity(size).build();
};