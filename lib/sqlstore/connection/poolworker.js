var log = require("ringo/logging").getLogger(module.id);
var schedulerId = null;

var stop = function() {
    if (schedulerId != null) {
        clearInterval(schedulerId);
    }
};

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
