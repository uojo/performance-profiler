
const _ = require('lodash')
const chalk = require("chalk");
const printf = require('printf')
const { table, getBorderCharacters } = require('table')

const { parseModuleUrl } = require('./utils/parseModule')
const { genID, outputReport, pms2, nearNum, toPercent } = require('./utils/common')
const { fluctuateReport } = require("./utils/report");

/**
 * 从 Profile 文件中提取 cpuProfile.nodes
 * @param {*} cpuProfileRecords 
 * @returns 
 */
function getCPUNodes(cpuProfileRecords) {
  const nodes = cpuProfileRecords.map(e => _.get(e, 'args.data.cpuProfile.nodes'))
  // console.log('nodes: ', nodes);

  // 调用帧
  const callFrames = nodes.reduce((a, b) => {
    return (a ? a : []).concat(b ? b : [])
  })
  // console.log('callFrames: ', callFrames);

  const nodesMap = {}
  callFrames.forEach((e) => {
    nodesMap[e.id] = e
  })
  // console.log('nodesMap: ', nodesMap);
  return nodesMap
}

/**
 * 从 Profile 文件中提取消耗 CPU 的任务 ID 和消耗 CPU 的时间
 * @param {} sourceRecords 
 * @returns 
 */
function getCPUSamples(sourceRecords) {
  return sourceRecords.map(e => {
    if (_.get(e, 'args.data.cpuProfile.samples')) {
      return {
        samples: e.args.data.cpuProfile.samples, // 消耗CPU的任务ID队列
        timeDeltas: e.args.data.timeDeltas // 消耗CPU时间的队列
      }
    }
  }).filter(Boolean)
}

/**
 * 抽取主要分类记录概要数据并计算（百分比与记录数）
 * @param {*} codeTypeMap 
 * @returns 
 */
function getOverviewRecords(codeTypeMap) {
  let totalTime = 0;
  for (key in codeTypeMap) {
    totalTime += codeTypeMap[key].totalTime
  }

  const jsFuncTimeDeltasCount = Object.values(codeTypeMap.JS.funcNames).map(e => e.timeDeltas.length).reduce((a, b) => a + b)

  let items = Object.keys(codeTypeMap.other.funcNames)
    .map(e => (
      { name: `other${e}`, data: codeTypeMap.other.funcNames[e] }
    ))
    .concat(
      { name: 'javascript', data: codeTypeMap.JS }
    )
    .map(e => {
      const tt = e.data.totalTime
      // console.log('e.data: ', e.data);
      const ttr = toPercent(tt, totalTime)
      return {
        name: e.name,
        tt: [tt, pms2(tt)],
        ttr: [ttr, `${(ttr * 100).toFixed(2)}%`],
        count: e.name === 'javascript' ? jsFuncTimeDeltasCount : e.data.timeDeltas.length
      }
    })
  items.sort((a, b) => (b.tt[0] - a.tt[0]))
  items.push({ name: 'Total', tt: [totalTime, pms2(totalTime)] })
  // console.log('items: ', items);
  return items
}

function col2row(title, obj) {
  const items = getOverviewRecords(obj)
  const names = [''].concat(items.map(e => e.name))
  const values = [title].concat(items.map(e => {
    return [e.tt[1], _.get(e, 'ttr.1'), _.get(e, 'count')].filter(e => Boolean(e)).join(' | ')
  }))
  return {
    names,
    values
  }
}

/**
 * 归并分析所有 CPU 时间片
 * 原理：
 * cat:disabled-by-default-v8.cpu_profiler 对象中记录 CPU 持续的时间片，其中，args.data.timeDeltas 存放了时间片值，时间片对应运行的任务 ID 存放在 args.data.cpuProfile.samples 中。任务 ID 分布在所有 args.data.cpuProfile.nodes 中。 
 */
function cpuTimeDeltas(items) {
  let sourceRecords = items.filter(e => e['cat'] === 'disabled-by-default-v8.cpu_profiler')

  const totalOffset = sourceRecords.slice(-1)[0].ts - sourceRecords[0].ts
  const nodesMap = getCPUNodes(sourceRecords)
  const samples = getCPUSamples(sourceRecords)

  const codeTypeMap = {} // 主要包括：JS、other
  const urlMap = {}
  const urlFuncMap = {}
  samples.forEach(e => {
    // 依据 samples 中的任务id，匹配对应的 nodeID
    e.samples.forEach((nodeID, i) => {
      // id 对应的时间片值，timeDeltas 与 samples 对应
      const timeDelta = e.timeDeltas[i]
      const node = nodesMap[nodeID]
      const type = node.callFrame.codeType // 调用帧的任务类型
      const url = parseModuleUrl(node.callFrame.url)
      const funcName = (node.callFrame.functionName || '(anonymous)').replace(/^\s*/g, '')
      const urlFuncID = genID(url, funcName)

      // 一级代码分类
      if (!codeTypeMap[type]) {
        codeTypeMap[type] = { totalTime: 0, urls: {}, funcNames: {}, }
      }
      codeTypeMap[type].totalTime += timeDelta // 累计消耗CPU的时间
      codeTypeMap[type].totalTimeFormat = pms2(codeTypeMap[type].totalTime)

      // 匹配相同任务路径的消耗信息
      if (url) {
        if (!codeTypeMap[type].urls[url]) {
          codeTypeMap[type].urls[url] = { totalTime: 0, timeDeltas: [] }
        }
        codeTypeMap[type].urls[url].timeDeltas.push(timeDelta)
        codeTypeMap[type].urls[url].totalTime += timeDelta
      }

      // 统计相同函数名称的消耗信息。
      if (typeof codeTypeMap[type].funcNames[funcName] !== 'object') {
        codeTypeMap[type].funcNames[funcName] = { totalTime: 0, timeDeltas: [] }
      }
      !funcName && console.log('000');
      codeTypeMap[type].funcNames[funcName].timeDeltas || console.log('> ', codeTypeMap[type].funcNames[funcName]);
      codeTypeMap[type].funcNames[funcName].timeDeltas.push(timeDelta)
      codeTypeMap[type].funcNames[funcName].totalTime += timeDelta


      // 因为不同的任务路径中存在相同的函数名，故以任务路径+函数名称作为ID
      if (!urlFuncMap[urlFuncID]) {
        urlFuncMap[urlFuncID] = { name: funcName, totalTime: 0, count: 0, timeDeltas: [] }
      }
      urlFuncMap[urlFuncID].count++
      urlFuncMap[urlFuncID].totalTime += timeDelta
      urlFuncMap[urlFuncID].timeDeltas.push(timeDelta)


      // 统计每个任务路径的消耗信息
      if (url) {
        if (!urlMap[url]) {
          urlMap[url] = { totalTime: 0, count: 0, timeDeltas: [], funcNames: new Set() }
        }
        urlMap[url].count++
        urlMap[url].totalTime += timeDelta
        urlMap[url].timeDeltas.push(timeDelta)
        urlMap[url].funcNames.add(funcName) // 加到对应的 url 下
      }
      // end
    })
  })

  const urlRecords = Object.keys(urlMap).map(key => {
    const val = urlMap[key]
    return {
      k: key,
      tt: val.totalTime,
      ttf: pms2(val.totalTime),
      c: val.count,
      fs: [...val.funcNames.values()].map(fname => ({
        f: fname,
        c: urlFuncMap[genID(key, fname)].count,
        tt: urlFuncMap[genID(key, fname)].totalTime,
        ttf: pms2(urlFuncMap[genID(key, fname)].totalTime)
      })).sort((a, b) => b.tt - a.tt)
    }
  }).sort((a, b) => b.tt - a.tt)

  return { codeTypeMap, urlRecords }
}

/**
 * 输出数值波动报告
 * @param {*} samples 
 * @param {*} title 
 */
function outputFluctuateStats(samples, title) {
  const timeDeltaItems = Object.keys(samples).reduce((a, b) => {
    return (samples[a] ? samples[a].timeDeltas : a).concat(samples[b].timeDeltas)
  }).filter(e => e > 100)

  fluctuateReport({
    reportTitle: `波动性分析 (${title})`,
    coverage: 0.99,
    sampleValues: timeDeltaItems.map(e => nearNum(e, 100)),
  });
}

/**
 * 展示各个 Url 对 CPU 的消耗统计
 * @param {*} samples 
 */
function outputUrlStats(samples) {
  console.log(`\n${chalk.red.bold('URL 归并统计')}\n`);
  console.log(
    table(
      Object.keys(samples)
        .sort((a, b) => samples[b].totalTime - samples[a].totalTime)
        .map(e => {
          return [pms2(samples[e].totalTime), samples[e].timeDeltas.length, e]
        })
    )
  )
}

/**
 * 分析所有消耗 CPU 时间的记录，包括波动性、以 url 进行归并统计。
 * @param {} record
 * @param {string} parsePath
 */
function timeDeltaReport(record, { showFluctuate = 10, showUrls = 10 } = {}) {
  const timeDeltaInfo = cpuTimeDeltas(record.data)
  // console.log(Object.keys(timeDeltaInfo.codeTypeMap)); // [ 'JS', 'other' ]
  // console.log(Object.keys(timeDeltaInfo.codeTypeMap.JS)); // [ 'totalTime', 'urls', 'funcNames', 'totalTimeFormat' ]

  // 所有 js 文件暂用 CPU 的时间段样本
  const jsUrlsSamples = _.get(timeDeltaInfo.codeTypeMap, 'JS.urls') // 仅统计具有 url 属性的记录，所以有局限
  showFluctuate && outputFluctuateStats(jsUrlsSamples, record.title)
  showUrls && outputUrlStats(jsUrlsSamples)
}

/**
 * 将分析结果写到JSON文件中
 * @param {} records 
 */
function writeTDTree(record) {
  const timeDeltaInfo = cpuTimeDeltas(record.data)
  // outputReport('sortUrls', timeDeltaInfo.sortUrls) // 输出到文件
  // outputReport('codeTypeMap', timeDeltaInfo.codeTypeMap)
}

/**
 * 输出单条分析结果，表头左侧
 * @param {} records 
 */
function singleOverview(record) {
  const timeDeltaInfo = cpuTimeDeltas(record.data)
  const items = getOverviewRecords(timeDeltaInfo.codeTypeMap).map(e => {
    return [
      e.name,
      _.get(e, 'tt.1', '-'),
      _.get(e, 'ttr.1', '-'),
      e.count || '-',
    ]
  })

  console.log(table(items, {
    border: getBorderCharacters('norc'),
    header: {
      alignment: 'center',
      content: `CPU 分类耗时统计 (${record.title})`,
    },
  }));
}

/**
 * 输出多条分析结果，表头在首行
 * @param {} records 
 */
function multiOverview(records) {
  let headRow = null
  const items = records.map((e, i) => {
    const rlt = col2row(e.title, cpuTimeDeltas(e.data).codeTypeMap)
    if (i === 0) headRow = rlt.names
    return rlt.values
  })

  console.log(table([headRow, ...items], {
    border: getBorderCharacters('norc'),
    // header: {
    //   alignment: 'center',
    //   content: `CPU 分类耗时统计`,
    // },
    columnDefault: {
      // width: 18,
      alignment: 'justify'
    },
  }));
}

/**
 * 分类统计各个分类的数值占比
 * @param  {...any} args 
 */
function overview(...args) {
  if (args.length > 1) {
    multiOverview(args)
  } else {
    singleOverview(...args)
  }
}

module.exports = {
  overview,
  timeDeltaReport
}