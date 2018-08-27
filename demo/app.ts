import * as child_process from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as process from 'process';
import * as util from 'util';

import * as bodyParser from 'body-parser';
import * as cors from 'cors'; // Cross-Origin Resource Sharing
import * as express from 'express';
import * as log4js from 'log4js';

import {Job, AbstractInputData, WasmMapper, WasmReducer, WasmWebServer} from 'madoop';

const ROOT = '/demo';
const PORT = 8000;
const MADOOP_ROOT = `${ROOT}/server`;
const MADOOP_PORT = 5000;

const app = express();
const router = express.Router();
const logger = log4js.getLogger();

const job = new Job('demo');
const server = new WasmWebServer();

let jobStatus: string = 'unregistered';
let jobResult: string = null;

router.get('/status', (req, res): void => {
  logger.info('[GET] /status');
  res.send({
    jobStatus: jobStatus
  });
});

router.get('/results', (req, res): void => {
  logger.info('[GET] /results');
  res.send(jobResult);
});

router.post('/tasks', async (req, res): Promise<void> => {
  logger.info('[POST] /tasks');
  const reqData = req.body;
  res.status(202).sendFile('./static/accepted.html', { root: __dirname });
  jobStatus = 'compiling';
  process.chdir('./workdir');

  logger.info('Save `map.cpp` and `reduce.cpp`.');
  const writeFilePromise = util.promisify(fs.writeFile);
  await Promise.all([
    writeFilePromise('map.cpp',    reqData['map-function-src']),
    writeFilePromise('reduce.cpp', reqData['reduce-function-src'])
  ]).catch(err => {
    console.error(err);
  });

  logger.info('Compile `map.cpp` and `reduce.cpp`.');
  const execPromise = util.promisify(child_process.exec);
  await Promise.all([
    execPromise('./compile.sh map'),
    execPromise('./compile.sh reduce')
  ]).catch(err => {
    console.error(err);
    jobStatus = 'compile error';
  });

  logger.info('Set up Madoop server.');
  const readFilePromise = util.promisify(fs.readFile);
  const compiled = await Promise.all([
    readFilePromise('map.js', 'utf8'),
    readFilePromise('map.wasm'),
    readFilePromise('reduce.js', 'utf8'),
    readFilePromise('reduce.wasm')
  ]).catch(err => {
    console.log(err);
    jobStatus = 'madoop server error';
  });
  const mapper = new WasmMapper();
  mapper.setWasmJs(compiled[0]);
  mapper.setWasmBinary(compiled[1]);
  const reducer = new WasmReducer();
  reducer.setWasmJs(compiled[2]);
  reducer.setWasmBinary(compiled[3]);
  class InputData extends AbstractInputData {
    constructor() {
      super();
      const rawData = reqData['data'];
      const data = rawData.split('\n');
      const length = data.length;
      const step = 40000; // 1 行につき平均約 1.1 KB
      const dataElement: string[][] = [];
      for (let i = 0; i < Math.floor(length / step); ++i) {
        const begin = step * i;
        const end = step * (i + 1);
        dataElement.push(data.slice(begin, end));
      }
      dataElement.push(data.slice(step * Math.floor(length / step)));
      for (let i = 0; i < dataElement.length; ++i) {
        let line = '';
        for (let j = 0; j < dataElement[i].length; ++j) {
          line += dataElement[i][j] + '\n';
        }
        this.addInputData(line);
      }
    }
  };
  let serverInstance: http.Server = null;
  const inputData = new InputData();
  job.setInputData(inputData);
  job.setMapper(mapper);
  job.setReducer(reducer);
  job.setCallbackWhenCompleted(result => {
    logger.info('Registered job has been completed.')
    jobResult = result;
    jobStatus = 'completed';
    serverInstance.close();
  });
  server.setJob(job);
  server.setRoot(MADOOP_ROOT);
  server.setPort(`${MADOOP_PORT}`);
  serverInstance = server.run();

  jobStatus = 'ready';
  process.chdir(__dirname);
});


// Settings for CORS: Cross-Origin Resource Sharing
app.use(cors());

// Settings for parsing JSON as request body
app.use(bodyParser.urlencoded({
  limit: '100mb', // to avoid `PayloadTooLargeError`
  extended: true
}));
app.use(bodyParser.json({
  limit: '100mb' // to avoid status 413 (payload too large)
}));

app.use(ROOT, router);
app.use(ROOT, express.static('static'));
app.listen(PORT);
logger.info(`Listen on \`localhost:${PORT}${ROOT}\`...`)
