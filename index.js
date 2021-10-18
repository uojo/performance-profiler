const getData = (e) => ({ title: e, data: require(`./temp/${e}.json`) })

const cpuProfiler = require('./cpuProfiler')
const heapProfiler = require('./heapProfiler')
const taskProfiler = require('./taskProfiler')

// cpuProfiler.timeDeltaReport(getData('v2.13.1-10s'))
// cpuProfiler.overview(getData('v2.13.1-10s'))
// cpuProfiler.overview(...['v2.13.1-10s', 'v2.17-10s'].map(e => getData(e)))

// heapProfiler.usedVolatility(getData('v2.13.1-10s'))
// heapProfiler.usedSizeInfo(getData('v2.13.1-10s'))

// taskProfiler.durationInfo(getData('v2.13.1-10s'))