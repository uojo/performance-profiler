const _ = require("lodash");
const { filterPmRecords, calcKeyInfo, nearNum, pms2 } = require("./utils/common");
const { fluctuateReport } = require("./utils/report");

function durationVolatility(record) {
  const taskSamples = filterPmRecords({
    performanceJson: record.data,
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
}

function durationInfo(record) {
  const samples = filterPmRecords({
    performanceJson: record.data,
    recordName: "RunTask",
    pushBefore(e) {
      return nearNum(e.dur, 5000); // 手动对值进行近值归并
    }
  });

  const kInfo = calcKeyInfo(samples.values.filter(e => parseFloat(e) > 0))
  let data = {}
  Object.keys(kInfo).forEach(e => {
    data[e] = [kInfo[e], pms2(kInfo[e])]
  })
  return {
    gtFrameCount: samples.values.filter(e => e > 16700).length, // 大于一帧的绘制时间
    data
  }
}

module.exports = {
  durationVolatility,
  durationInfo
}