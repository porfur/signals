function init() {
  let currentObserver;
  let currentMemo;

  function createMemo(callback) {
    let cachedMemoValue; // Store the cached value here
    const dependencies = new Map();

    const setCachedMemoValue = (value) => (cachedMemoValue = value);
    const setCurrentMemo = (value) => (currentMemo = value);
    const memoize = () => {
      if (cachedMemoValue === undefined) {
        setCachedMemoValue(callback());
      } else {
        setCurrentMemo();
      }
      return cachedMemoValue;
    };
    currentMemo = { clearCache: setCachedMemoValue, dependencies };

    return memoize;
  }

  //---------------------------
  function createSignal(initialValue = undefined) {
    let value = initialValue;
    const memoKey = Symbol;
    const observers = new Set();
    const memos = new Set();
    const get = () => {
      if (currentObserver && !observers.has(currentObserver)) {
        observers.add(currentObserver);
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
    currentObserver = fn;
    const result = fn();
    currentObserver = undefined;
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
