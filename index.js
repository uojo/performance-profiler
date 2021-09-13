const _ = require("lodash");
const prettyBytes = require("pretty-bytes");
const prettyMs = require("pretty-ms");
const { filterPmRecords } = require("./utils");
const { fluctuateReport } = require("./report");

const performanceJson = require("./temp/v2.13.1-10s.json");
// const performanceJson = require("./temp/v2.17-10s.json");

// cpu report
const cpuSamples = filterPmRecords({
  performanceJson,
  recordName: "ProfileChunk",
  pushBefore(e) {
    return e.args.data.cpuProfile.samples.map(e => `${(e * 0.1).toFixed(2)} %`);
  }
});

10 &&
  fluctuateReport({
    reportTitle: "CPU Profile",
    coverage: 0.99,
    sampleValues: cpuSamples.values,
    timeArea: cpuSamples.timeArea
  });

// heap size report
const heapSamples = filterPmRecords({
  performanceJson,
  recordName: "UpdateCounters",
  pushBefore(e) {
    return prettyBytes(e.args.data.jsHeapSizeUsed);
  }
});

10 &&
  fluctuateReport({
    reportTitle: "JS Heap Size Used Profile",
    sampleValues: heapSamples.values,
    timeArea: heapSamples.timeArea
  });
