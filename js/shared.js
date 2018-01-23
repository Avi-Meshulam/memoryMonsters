// get index of random unset array cell
function getFreeIndex(array) {
    var index;
    do {
        index = getRandomInt(0, array.length - 1);
    } while (array[index])
    return index;
}

// get a random integer inclusively
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// prefix 1 digit number with a zero
function pad(val) {
    return val > 9 ? val : "0" + val;
}

// format number of seconds as time string (HH:MM:SS)
function formatTime(seconds) {
    return pad(parseInt(seconds / 3600, 10)) + ':' +
        pad(parseInt(seconds / 60, 10)) + ':' +
        pad(seconds % 60);
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}