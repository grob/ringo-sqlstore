/**
 * @module cache
 */

addToClasspath(module.resolve("../jars/caffeine-2.6.0.jar"));

module.exports = function(size) {
    if (isNaN(parseInt(size, 10)) || !isFinite(size)) {
        size = 1000;
    }
    return com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
            .maximumSize(size)
            .build();
};