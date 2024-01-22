// Signal pattern inspired by SolidJS
// Following the example of
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs

export const { createSignal, createEffect, cleanEffect } = (() => {
  //Global variables used to pass information to the createSignal function
  let currentEffect;
  let currentMemo;

  // Global functions used to set global variables
  const setCurrentMemo = (value) => (currentMemo = value);
  const setCurrentEffect = (value) => (currentEffect = value);

// --------------------------------------------------------------------------------
  function createMemo(callback) {
    let cachedData; 
    let shouldClearCache = true;
    const dependencies = new Map(); // Will be set as [Symbol, value] in createSignal 
    
    const setShouldClearCache = (bool=true) => (shouldClearCache = bool);

    const getResult = () => {
      if (shouldClearCache) {
        // Update the cached data and reset flag
        cachedData = callback()
        setShouldClearCache(false)
      } else {
        // Remove currentMemo from the global variable
        setCurrentMemo();
      }
      return cachedData;
    };

    setCurrentMemo ({ clearCache: ()=>setShouldClearCache(), dependencies });

    return getResult;
  }

// --------------------------------------------------------------------------------
  function createSignal(initialValue = undefined) {
    let value = initialValue;
    const memoKey = Symbol;
    const observers = new Set();
    const memos = new Set();
    const get = () => {
      if (currentEffect && !observers.has(currentEffect)) {
        observers.add(currentEffect);
      }
      if (currentMemo && !memos.has(currentMemo)) {
        currentMemo.dependencies.set(memoKey, initialValue);
        memos.add(currentMemo);
      }
      return value;
    };

    const set = (newValue) => {
      value = newValue;
      memos.forEach((memo) => {
        if (memo.dependencies.get(memoKey) !== newValue) {
          memo.dependencies.set(memoKey, newValue);
          memo.clearCache();
        }
      });
      observers.forEach((fn) => {
        if (fn(newValue)) {
          observers.delete(fn);
        }
      });
    };
    return [get, set, observers];
  }
  //---------------------------
  function createEffect(fn) {
    currentEffect = fn;
    const result = fn();
    currentEffect = undefined;
    return result;
  }
  //---------------------------
  return { createSignal, createEffect, createMemo };
}
const { createSignal, createEffect, createMemo, t, n, render } = init();

const [a, setA] = createSignal(0);
const [b, setB] = createSignal(100);
let nr = 0;
let aa = createMemo(() => {
  console.log("MEMO RAN");
  return a() + b();
});
createEffect(() => {
  document.querySelector("button").innerText = `T-${aa()}`;
});
document.querySelector("button").addEventListener("click", () => {
  if (nr % 3 === 0) {
    setA(a() + 1);
    setB(b() + 1);
  }
  console.log("CLICK_______", aa());
  nr++;
  console.log(nr);
});
