// Signal pattern inspired by SolidJS
// Following the example of
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs

const init = () => {
  // These globals are set in the create functions and then used by the signals
  // as a function or identifier or both before being cleared
  let currentEffect;
  let currentMemo;
  let currentBatch;

  // Global functions used to set global variables
  const setCurrentMemo = (value) => (currentMemo = value);
  const setCurrentEffect = (value) => (currentEffect = value);
  const setCurrentBatch = (value) => (currentBatch = value);
  const updateMemos = (memosMap, newValue) => {
    memosMap.forEach((cachedValue, clearCache) => {
      if (cachedValue !== newValue) {
        memosMap.set(clearCache, newValue);
        clearCache();
      }
    });
  };
  const runEffects = (effectsSet, newValue) =>
    effectsSet.forEach((fn) => {
      if (fn(newValue)) {
        effectsSet.delete(fn);
      }
    });
  const addCurrentEffectToSet = (effectsSet) => {
    if (currentEffect && !effectsSet.has(currentEffect)) {
      effectsSet.add(currentEffect);
    }
  };
  const addCurrentMemoToMap = (memosMap, value) => {
    if (currentMemo && !memosMap.has(currentMemo)) {
      memosMap.set(currentMemo, value);
    }
  };
  // --------------------------------------------------------------------------------
  function createMemo(getData) {
    let cachedData;
    let shouldClearCache = true;

    const setClearCache = (bool = true) => (shouldClearCache = bool);

    const getMemoizedData = () => {
      console.log(currentBatch);
      if (shouldClearCache) {
        // Update the cached data and reset flag
        cachedData = getData();
        setClearCache(false);
      }
      // NOTE: The global currentMemoClearCache will remain set until getMemoizedData is called
      // It needs to remain set so all signals in getData can add it to their memosMap
      // Here it's being reset to undefined
      currentMemo && setCurrentMemo();

      return cachedData;
    };
    // NOTE: The currentMemoClearCache global is being set to a fn that
    // sets the shouldClearCache flag to true
    // It will be used by the signal to clear cache if the value changes
    setCurrentMemo(setClearCache);

    return getMemoizedData;
  }

  // --------------------------------------------------------------------------------
  function batch(callback) {
    setCurrentBatch({ memosMap: new Map(), effectsSet: new Set() });
    callback();
    currentBatch.effectsSet.forEach((effect) => {
      runEffects(effect);
    });
    currentBatch.memosMap.forEach((memo) => {
      updateMemos();
    });
    setCurrentBatch();
  }
  // --------------------------------------------------------------------------------
  function createSignal(initialValue = undefined) {
    let value = initialValue;
    const effectsSet = new Set();
    const memosMap = new Map();

    const get = () => {
      if (currentBatch) {
        addCurrentEffectToSet(currentBatch.effectsSet);
        addCurrentMemoToMap(currentBatch.memosMap, value);
      }
      addCurrentEffectToSet(effectsSet);
      addCurrentMemoToMap(memosMap, value);
      return value;
    };

    const set = (newValue) => {
      value = newValue;
      if (currentBatch) {
        addCurrentEffectToSet(currentBatch.effectsSet);
        addCurrentMemoToMap(currentBatch.memosMap, value);
      }
      updateMemos(memosMap, value);
      runEffects(effectsSet, value);
      return value;
    };

    return [get, set];
  }
  // --------------------------------------------------------------------------------
  function createEffect(fn) {
    setCurrentEffect(fn);
    // Call the function after setting the currentEffect
    // so the signals inside fn can access it
    const result = fn();
    // Clear current effect
    setCurrentEffect();
    return result;
  }
  //---------------------------
  return { batch, createSignal, createEffect, createMemo };
};

const { batch, createSignal, createEffect, createMemo } = init();

const [a, setA] = createSignal(0);
const [b, setB] = createSignal(100);
const [c, setC] = createSignal(1000);
let nr = 0;
let aa = createMemo(() => {
  console.log("MEMO RAN");
  return a() + b() + c();
});
const updateNumbers = () => {
  console.log("IN UPDATENUMBERS");
  batch(() => {
    setA(a() + 1);
    setB(b() + 1);
    setC(c() + 1);
  });
};
createEffect(() => {
  console.log("CREATE EFFECT RAN");
  document.querySelector("button").innerText = `T-${aa()}`;
});
document.querySelector("button").addEventListener("click", () => {
  if (nr % 3 === 0) {
  }
  updateNumbers();
  console.log(a(), b(), c());
  console.log("CLICK_______", aa());
  nr++;
  console.log(nr);
});
