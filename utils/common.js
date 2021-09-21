const _ = require("lodash");
const path = require('path')
const chalk = require("chalk");
const fs = require('fs-extra')
const Chartscii = require("chartscii");
const median = require("median");
const prettyBytes = require("pretty-bytes");
const prettyMs = require("pretty-ms");
const bars = require("../bar");

function renderChart({ title, data, width = 50, labelWidth = 0, leftOffset = 0 }) {
  // console.log("chart.data: ", data, leftOffset);
  console.log(title);

  let barsStr = bars(data, { bar: "=", width, sort: false });

  if (labelWidth) {
    const label = barsStr.match('^[^|]+')
    if (label) {
      const labelW = label[0].length
      leftOffset = labelWidth - labelW
      // console.log('leftOffset: ', leftOffset);
    }
  }

  if (leftOffset > 0) {
    const leftOffsetStr = new Array(leftOffset).fill(" ").join("");
    // console.log("leftOffsetStr: ", leftOffsetStr.length);

    barsStr = barsStr
      .replace(/^/g, leftOffsetStr)
      .replace(/\n/g, `\n${leftOffsetStr}`);
  } else if (leftOffset < 0) {
    // barsStr = barsStr.replace(/^/g, "").replace(/\n/g, `\n`);
  }

  console.log(barsStr);
}

/**
 * 绘制占比图表
 */
function renderChart2({ title, data, width = 50, leftOffset = 0 }) {
  console.log("data: ", data);
  // create chart
  const chart = new Chartscii(data, {
    // label: title,
    theme: "lush",
    width,
    // fill: "░",
    sort: true,
    // reverse: true,
    char: "*",
    // color: "pink",
    // percentage: true,
    colorLabels: false
  });
  console.log(chalk.magenta(title));
  const leftOffsetStr = new Array(leftOffset).fill(" ").join();
  // console.log("leftOffsetStr: ", leftOffsetStr.length);
  console.log(
    chart
      .create()
      .replace(/^/g, leftOffsetStr)
      .replace(/\n/g, `\n${leftOffsetStr}`)
  );
}

/**
 * 统计数组中每条记录的值在总记录中的占比
 * @param {} values
 * @returns eg. [ [a,5], [b,3], [c,2] ] => [ [a, 5, 0.5], [b, 3, 0.3], [c, 2, 0.2] ]
 */
const appendSumRate = values => {
  // console.log("values: ", values);
  if (!values.length) return values;
  const sum = values.reduce((a, b) => {
    return (a[1] || a) + b[1];
  });
  // console.log("sum: ", sum);
  return values.map(e => {
    return e.concat((e[1] / sum).toFixed(4)); // 附加占比数据
  });
};

/**
 * 计算数列的常见指标
 * @param {Array} values
 * @returns eg. [1,2,3] => {max,min,mean,median}
 */
function calcKeyInfo(values) {
  // console.log("values: ", values);
  const sum = values.reduce((a, b) => parseFloat(a) + parseFloat(b));
  const max = Math.max(...values);
  const min = Math.min(...values);
  return {
    median: median(values),
    mean: parseFloat((sum / values.length).toFixed(4)),
    min,
    max
    // amplitude: (max - min).toFixed(4) // 振幅
  };
}

/**
 * 对象转数组<label, value>
 * @param {*} obj
 * @returns eg. {a:1,b:2} => [{key:a,val:1},{key:b,val:2}]
 */
function objToLabelValues(obj, labelValue = false) {
  return Object.keys(obj).map(e => ({
    key: labelValue ? `${e} (${obj[e]})` : e,
    val: obj[e]
  }));
}

/**
 * 过滤出满足总计数值的数据项
 * @param {Array} values 数列
 * @param {double} Threshold 满足总计数值
 * @returns [ [a, 5, 0.5], [b, 3, 0.3], [c, 2, 0.2] ] => [ [a, 5, 0.5], [b, 3, 0.3] ]
 */
function filterMainRate(values, Threshold = 0.8) {
  // console.log("values: ", values);
  let t = 0;
  const rlt = values.filter((e, i) => {
    const el = parseFloat(e[2]);
    if (!el) return false; // 排查 0
    t += el;
    // console.log(el, t, t <= Threshold);
    if (el > Threshold) return true; // 单项
    if (t <= Threshold) return true; // 累计
    return false;
  });
  // console.log("filter.main.rlt: ", rlt);
  return rlt;
}

function filterPmRecords({ recordName, performanceJson, pushBefore }) {
  const basicRecords = performanceJson.filter(e => e.name === recordName);

  let values = [];
  basicRecords.forEach(e => {
    values = values.concat(pushBefore(e));
  });
  return {
    values,
    timeArea: [basicRecords[0].ts, basicRecords.slice(-1)[0].ts]
  };
}

function nearNum(val, offset) {
  return Math.round(val / offset) * offset;
}

function genID(...args) {
  return args.join()
}

function outputReport(filename, json) {
  fs.writeJson(path.resolve(__dirname, `../temp/${filename}.json`), json).then(() => {
    console.log('output success!')
  })
}

const pms2 = (pu) => {
  return prettyMs(pu / 1000, { millisecondsDecimalDigits: 2 })
}

module.exports = {
  renderChart,
  appendSumRate,
  calcKeyInfo,
  objToLabelValues,
  filterMainRate,
  filterPmRecords,
  nearNum,
  genID,
  outputReport,
  pms2
};
