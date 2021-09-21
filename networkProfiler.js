const _ = require("lodash");
const prettyBytes = require("pretty-bytes");
const prettyMs = require("pretty-ms");
const { nearNum } = require("./utils/common");
const { fluctuateReport } = require("./utils/report");

const harJson = require("./temp/network.har.json");

const basicRecords = harJson.log.entries
  .filter(e => /_sd-\d+\.ts/.test(e.request.url)) // 匹配条件
  .map(e => {
    return {
      startedDateTime: e.startedDateTime,
      time: e.time,
      request: _.pick(e.request, ["bodySize"]),
      response: _.pick(e.response, [
        "status",
        "bodySize",
        "_transferSize",
        "_error"
      ]),
      timings: e.timings
    };
  });

/**
 * 分享响应的传输大小波动
 */
const transferSizeValues = basicRecords.map(e => e.response._transferSize); // 响应的传输大小
const sampleValues = transferSizeValues.map(
  e => prettyBytes(nearNum(e, 20 * 1024)) // 按 20k 误差归并
);

fluctuateReport({
  reportTitle: "Network Profile",
  coverage: 0.9,
  sampleValues,
  timeArea: [
    new Date(basicRecords[0].startedDateTime).getTime() * 1000,
    new Date(basicRecords.slice(-1)[0].startedDateTime).getTime() * 1000
  ],
  chat2Config: {
    labelValue: false,
    width: 50,
    leftOffset: -1
  }
});
