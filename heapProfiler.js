const _ = require("lodash");
const prettyBytes = require("pretty-bytes");
const prettyMs = require("pretty-ms");
const { filterPmRecords, calcKeyInfo } = require("./utils/common");
const { fluctuateReport } = require("./utils/report");


function usedVolatility(record) {
  const samples = filterPmRecords({
    performanceJson: record.data,
    recordName: "UpdateCounters",
    pushBefore(e) {
      return prettyBytes(e.args.data.jsHeapSizeUsed);
    }
  });

  fluctuateReport({
    reportTitle: `JS Heap Size Used (${record.title})`,
    sampleValues: samples.values,
    timeArea: samples.timeArea,
    labelWidth: 80,
  });
}

function usedSizeInfo(record) {
  const samples = filterPmRecords({
    performanceJson: record.data,
    recordName: "UpdateCounters",
    pushBefore(e) {
      return e.args.data.jsHeapSizeUsed;
    }
  });

  const kInfo = calcKeyInfo(samples.values)
  let rlt = {}
  Object.keys(kInfo).forEach(e => {
    rlt[e] = [kInfo[e], prettyBytes(kInfo[e])]
  })
  return rlt
}

module.exports = {
  usedVolatility,
  usedSizeInfo
}