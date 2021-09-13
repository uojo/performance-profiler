const _ = require("lodash");
const chalk = require("chalk");
const prettyMs = require("pretty-ms");
const {
  renderChart,
  appendSumRate,
  calcKeyInfo,
  objToLabelValues,
  filterMainRate
} = require("./utils");

/**
 * 波动性报告，分析包括 cpu、heap size
 */
function fluctuateReport({
  timeArea,
  sampleValues,
  reportTitle,
  coverage = 0.8,
  // chat1Config: {},
  chat2Config = {}
}) {
  console.log(`\n${chalk.magenta.bold(reportTitle)}\n`);

  console.log("采样时长: ", prettyMs((timeArea[1] - timeArea[0]) / 1000));

  /** eg. [ ['a',3], ['b',2], ['c',1] ] */
  const sortLabelValues = _.sortBy(_.toPairs(_.countBy(sampleValues)), [
    "1"
  ]).reverse();
  // console.log("sortLabelValues: ", sortLabelValues);
  // console.log("采样归并", sortLabelValues.length);

  const rate1 = (1 - sortLabelValues.length / sampleValues.length).toFixed(4);
  console.log(
    `采样数值重复率: ${rate1} [ ${sortLabelValues.length} / ${sampleValues.length} ]`
  );
  const allSamplesRate = appendSumRate(sortLabelValues);
  // console.log("全量采样占比分布", allSamplesRate);

  const mainSamplesRate = appendSumRate(
    filterMainRate(allSamplesRate, coverage)
  );
  // console.log("mainSamplesRate: ", mainSamplesRate);
  const mainSamples = mainSamplesRate.map(e => [
    e[0],
    (parseFloat(e[2]) * 100).toFixed(2)
  ]);

  renderChart({
    title: `\n构成 ${coverage * 100}% 的样本数值分布情况 [ ${
      mainSamples.length
    } / ${allSamplesRate.length} ]`,
    data: mainSamplesRate.map(e => ({
      key: e[0],
      val: parseFloat(e[2])
    }))
  });

  renderChart({
    title: `\n数值波动情况 [ 最大值、最小值、中位值、平均值 ]`,
    data: objToLabelValues(
      calcKeyInfo(mainSamplesRate.map(e => parseFloat(e[0]))),
      chat2Config.labelValue
    ),
    width: chat2Config.width,
    leftOffset: chat2Config.leftOffset || 1
  });
}

module.exports = {
  fluctuateReport
};
