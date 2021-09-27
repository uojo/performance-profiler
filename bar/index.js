/* eslint-disable no-redeclare */
/* eslint-disable no-var */
/* eslint-disable no-use-before-define */
/* eslint-disable vars-on-top */
/**
 * Module dependencies.
 */

const fmt = require("printf");

/**
 * Return ascii histogram of `data`.
 *
 * @param {Object} data
 * @param {Object} [opts]
 * @return {String}
 * @api public
 */

function histogram(data, opts) {
  opts = opts || {};

  // options

  const width = opts.width || 60;
  const fillStr = opts.bar || "#";
  const map = opts.map || noop;

  // normalize data
  if (!Array.isArray(data)) {
    data = toArray(data);
  }
  if (opts.sort) data = data.sort(descending);

  const maxKey = max(
    data.map(function (d) {
      return d.key.length;
    })
  );

  const maxVal =
    max(
      data.map(function (d) {
        return d.val;
      })
    ) || width;
  let str = "";


  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const p = d.val / maxVal;
    const shown = Math.round(width * p);
    const blank = width - shown;
    let bar = Array(shown + 1).join(fillStr);
    bar += Array(blank + 1).join(" ");
    str += fmt("  %*s | %s | %s\n", d.key, maxKey, bar, map(d.val));
  }

  return str;
}

/**
 * Sort descending.
 */

function descending(a, b) {
  return b.val - a.val;
}

/**
 * Return max in array.
 */

function max(data) {
  let n = data[0];

  for (let i = 1; i < data.length; i++) {
    n = data[i] > n ? data[i] : n;
  }

  return n;
}

/**
 * Turn object into an array.
 */

function toArray(obj) {
  return Object.keys(obj).map(function (key) {
    return {
      key,
      val: obj[key]
    };
  });
}

/**
 * Noop map function.
 */

function noop(val) {
  return val;
}

/**
 * Expose `histogram()`.
 */

module.exports = histogram;
