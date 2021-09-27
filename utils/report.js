const _ = require("lodash");
const chalk = require("chalk");
const prettyMs = require("pretty-ms");
const {
  renderChart,
  appendSumRate,
  calcKeyInfo,
  objToLabelValues,
  filterMainRate
} = require("./common");

function genRate(a, b) {
  return (a / b).toFixed(4)
}

function ratioLabel(val) {
  const rules = [[0, '极低', 'red'], [0.2, '较低', 'red'], [0.4, '一般', 'yellow'], [0.6, '良好', 'yellow'], [0.8, '较高', 'green'], [0.9, '极高', 'green']]
  let rlt
  rules.every(e => {
    if (val >= e[0]) {
      rlt = e
      return true
    }
  })


  return chalk[rlt[2]](rlt[1])
}

// console.log(ratioLabel(0.5));

/**
 * 波动性报告，分析包括 cpu、heap size
 */
function fluctuateReport({
  timeArea,
  sampleValues,
  reportTitle,
  coverage = 0.8,
  // chat1Config: {},
  chat2Config = {},
  chatLabelWidth = 10
}) {
  console.log(`\n${chalk.red.bold(reportTitle)}\n`);

  timeArea && console.log("采样时长: ", prettyMs((timeArea[1] - timeArea[0]) / 1000));

  /** eg. [ ['a',3], ['b',2], ['c',1] ] */
  const sortLabelValues = _.sortBy(_.toPairs(_.countBy(sampleValues)), [
    "1"
  ]).reverse();
  // console.log("采样计数归并", sortLabelValues);

  const repeatRatio = genRate(sortLabelValues.filter(e => e[1] > 1).reduce((a, b) => (a[1] || a) + b[1]), sampleValues.length)
  console.log(
    `采样数 ${sampleValues.length} , 重复数 ${sortLabelValues.length}, 重复率: ${repeatRatio} [${ratioLabel(repeatRatio)}]`
  );
  // 全量采样值分布率
  const allSamplesRate = appendSumRate(sortLabelValues);
  // console.log("全量采样占比分布", allSamplesRate);

  // 主要样本值（过滤出总计大于等于覆盖率的数据项）分布律
  const mainSamplesRate = appendSumRate(
    filterMainRate(allSamplesRate, coverage)
  );
  const mainSamples = mainSamplesRate.map(e => [
    e[0],
    e[1],
    (parseFloat(e[2]) * 100).toFixed(2)
  ]);

  const concentrationRatio = genRate(mainSamples.length, allSamplesRate.length)
  renderChart({
    labelWidth: chatLabelWidth,
    title: `\n覆盖 ${coverage * 100}% 的样本计数分布数据, 集中率: ${concentrationRatio} [${ratioLabel(concentrationRatio)}]`,
    data: mainSamplesRate.map(e => ({
      key: e[0],
      val: parseFloat(e[1])
    })),
  });

  const keyInfo = calcKeyInfo(mainSamplesRate.map(e => parseFloat(e[0])))
  const StabilityRatio = genRate(Math.min(keyInfo.median, keyInfo.mean), Math.max(keyInfo.median, keyInfo.mean))
  renderChart({
    labelWidth: chatLabelWidth,
    title: `\n数值稳定率: ${StabilityRatio} [${ratioLabel(StabilityRatio)}]`,
    data: objToLabelValues(
      keyInfo,
      chat2Config.labelValue
    ),
    width: chat2Config.width,
  });
}

module.exports = {
  fluctuateReport
};
