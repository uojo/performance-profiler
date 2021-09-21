const _ = require("lodash");
const prettyBytes = require("pretty-bytes");
const prettyMs = require("pretty-ms");
const { filterPmRecords } = require("./utils/common");
const { fluctuateReport } = require("./utils/report");

// const performanceJson = require("./temp/v2.13.1-10s.json");
const performanceJson = require("./temp/v2.17-10s.json");
// const performanceJson = require("./temp/v2.18-220s-im.json");
// const performanceJson = require("./temp/v2.18-35s-im.json");

const heapSamples = filterPmRecords({
  performanceJson,
  recordName: "UpdateCounters",
  pushBefore(e) {
    return prettyBytes(e.args.data.jsHeapSizeUsed);
  }
});

fluctuateReport({
  reportTitle: "JS Heap Size Used",
  sampleValues: heapSamples.values,
  timeArea: heapSamples.timeArea,
  labelWidth: 80,
});
