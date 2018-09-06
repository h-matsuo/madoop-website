import * as child_process from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as process from 'process';
import * as util from 'util';

import * as bodyParser from 'body-parser';
import * as cors from 'cors'; // Cross-Origin Resource Sharing
import * as express from 'express';
import * as log4js from 'log4js';
import * as multer from 'multer';

import {Job, WasmMapper, WasmReducer, WasmWebServer} from 'madoop';
import MyInputData from './MyInputData';
import MyShuffler from './MyShuffler';

const ROOT = '/demo';
const PORT = 8000;
const MADOOP_ROOT = `${ROOT}/server`;
const MADOOP_PORT = 5000;

const app = express();
const router = express.Router();
const upload = multer();
const logger = log4js.getLogger();

const job = new Job('demo');
const server = new WasmWebServer();

let jobStatus: string = 'unregistered';
let jobResult: any = null;

const setUpMadoop = async (mapSrc: string, reduceSrc: string, inputDataStr: string): Promise<void> => {
  jobStatus = 'compiling';
  process.chdir('./workdir');

  logger.info('Save `map.cpp` and `reduce.cpp`.');
  const writeFilePromise = util.promisify(fs.writeFile);
  await Promise.all([
    writeFilePromise('map.cpp',    mapSrc),
    writeFilePromise('reduce.cpp', reduceSrc)
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
  let serverInstance: http.Server = null;
  const mapper = new WasmMapper();
  mapper.setWasmJs(compiled[0]);
  mapper.setWasmBinary(compiled[1]);
  const reducer = new WasmReducer();
  reducer.setWasmJs(compiled[2]);
  reducer.setWasmBinary(compiled[3]);
  const inputData = new MyInputData(inputDataStr);
  const shuffler = new MyShuffler();
  job.setInputData(inputData);
  job.setMapper(mapper);
  job.setShuffler(shuffler);
  job.setReducer(reducer);
  job.setCallbackWhenAccessedFirstly(() => {
    logger.info('Start executing registered job.');
    jobStatus = 'executing';
  });
  job.setCallbackWhenCompleted(result => {
    logger.info('Registered job has been completed.');
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
};

router.get('/status', (req, res): void => {
  logger.info('[GET] /status');
  res.send({
    jobStatus: jobStatus
  });
});

router.get('/results', (req, res): void => {
  logger.info('[GET] /results');
  // Currently job results are Map<any, any> object
  res.send(JSON.stringify([...jobResult]));
});

router.post('/tasks', upload.single('data'), async (req, res): Promise<void> => {
  logger.info('[POST] /tasks');
  const mapSrc = req.body['map-function-src'];
  const reduceSrc = req.body['reduce-function-src'];
  let inputData: string = null;
  if (req.is('application/x-www-form-urlencoded')) {
    inputData = req.body['data'];
  } else if (req.is('multipart/form-data')) {
    inputData = req.file.buffer.toString();
  } else {
    res.status(400);
    return;
  }
  res.status(202).sendFile('./static/accepted.html', { root: __dirname });
  setUpMadoop(mapSrc, reduceSrc, inputData);
});

// Settings for CORS: Cross-Origin Resource Sharing
app.use(cors());

// Settings for body-parser middleware
app.use(bodyParser.json({
  limit: '100mb' // to avoid status 413 (payload too large)
}));
app.use(bodyParser.urlencoded({
  limit: '100mb', // to avoid `PayloadTooLargeError`
  extended: true
}));

app.use(ROOT, router);
app.use(ROOT, express.static('static'));
app.listen(PORT);
logger.info(`Listen on \`localhost:${PORT}${ROOT}\`...`)
