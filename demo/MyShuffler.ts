import {AbstractShuffler} from 'madoop';

export default
class MyShuffler extends AbstractShuffler {

  setUpReducerInputData(
    mapperResult: Map<any, any[]>
  ): Map<any, any[]>[] {

    const STEP = 15000;

    const reduceInputData = [];
    const length = mapperResult.size;
    const itr = mapperResult.entries();
    let done = false;
    for (let i = 0; i < Math.floor(length / STEP); ++i) {
      const data = new Map<any, any[]>();
      for (let j = 0; j < STEP; ++j) {
        const next = itr.next();
        if (next.done) {
          done = true;
          break;
        }
        data.set(next.value[0], next.value[1]);
      }
      if (data.size > 0) {
        reduceInputData.push(data);
      }
      if (done) { break; }
    }
    const data = new Map<any, any[]>();
    while (true) {
      const next = itr.next();
      if (next.done) { break; }
      data.set(next.value[0], next.value[1]);
    }
    if (data.size > 0) {
      reduceInputData.push(data);
    }

    return reduceInputData;

  }

}
