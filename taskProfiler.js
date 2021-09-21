const _ = require("lodash");
const prettyBytes = require("pretty-bytes");
const { filterPmRecords, nearNum, pms2 } = require("./utils/common");
const { fluctuateReport } = require("./utils/report");

// const performanceJson = require("./temp/v2.13.1-10s.json");
// const performanceJson = require("./temp/v2.17-10s.json");
// const performanceJson = require("./temp/v2.18-220s-im.json");
const performanceJson = require('./temp/v2.18-20s-im-p2.json')

const taskSamples = filterPmRecords({
  performanceJson,
  recordName: "RunTask",
  pushBefore(e) {
    return pms2(nearNum(e.dur, 5000)); // 手动对值进行近值归并
  }
});

fluctuateReport({
  reportTitle: "Task duration",
  sampleValues: taskSamples.values.filter(e => parseFloat(e) > 0),
  coverage: 0.99,
  chatLabelWidth: 11
});
