/**
 * @fileoverview Worker implementation responsible for triggering stale connection
 * cleanup in the connection pool.
 */
var schedulerId = null;

/**
 * Stops the interval defined in this worker
 */
var stop = function() {
    if (schedulerId != null) {
        clearInterval(schedulerId);
    }
};

/**
 * Starts the interval which posts a "cleanup" message every minute to the
 * connection pool
 */
var start = function(pool) {
    schedulerId = setInterval(function() {
        pool.postMessage("cleanup");
    }, 60000);
};

/**
 * Start the scheduler which removes stale connections.
 * @param {Object} event This method expects the event's "data" property
 * to contain the connections vector.
 */
var onmessage = function onmessage(event) {
    switch (event.data) {
        case "start":
            stop();
            start(event.source);
            break;
        case "stop":
            stop();
            break;
    }
};
