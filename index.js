// Signal pattern inspired by SolidJS
// Example for signals and effects found at
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs
// For createMemo and batch I used the SolidJS documentation to figure
// out how and why they are usefull

const init = () => {
  // ============================================================================
  // [[ GLOBALS ]]
  //
  // (( Variables ))
  // These variables are set in the create functions and then used by the signals
  // as a function or identifier or both before being cleared
  let currentEffect; // The current effect callback
  let currentMemoClearFn; // The fn used to clear the current memo's cache
  let currentBatchEffects; //

  // (( Functions ))
  // Used to set global variables
  // No arguments sets them to undefined
  const setCurrentMemoClearFn = (value) => (currentMemoClearFn = value);
  const setCurrentEffect = (value) => (currentEffect = value);
  const setCurrentBatchEffects = (value) => (currentBatchEffects = value);

  // Function used to update a signal's memoized values
  const updateMemos = (memosMap, newValue) => {
    // NOTE: The key of each memosMap if the fn used to clear it's cache
    memosMap.forEach((cachedValue, clearCache) => {
      if (cachedValue !== newValue) {
        memosMap.set(clearCache, newValue);
        clearCache();
      }
    });
  };

  // Function used to run a signal's effects
  // NOTE: Also removes effect if the effect returns true
  const runEffects = (effectsSet, currentBatchEffects) => {
    if (currentBatchEffects) {
      currentBatchEffects(effectsSet);
      return;
    }
    effectsSet.forEach((fn) => fn() && effectsSet.delete(fn));
  };

  // Function to add the global currentEffect to an effects Set
  const addCurrentEffectToSet = (effectsSet) => {
    if (currentEffect && !effectsSet.has(currentEffect)) {
      effectsSet.add(currentEffect);
    }
  };

  // Function to add the global  currentMemoClearFn to memos Map
  const addCurrentMemoToMap = (memosMap, value) => {
    if (currentMemoClearFn && !memosMap.has(currentMemoClearFn)) {
      memosMap.set(currentMemoClearFn, value);
    }
  };

  // ============================================================================

  // [[ REACTIVITY FUNCTIONS ]]

  // (( Batch ))
  // Defers the effects of all signals set in the callback
  // and removes duplicates before running them
  function batch(callback) {
    const allEffects = new Set();
    // Sets the currentBatchEffects variable to a function that when
    // used by a signal, it collects all it's effects removing duplicates
    setCurrentBatchEffects((effectsSet) => {
      allEffects.add(...effectsSet);
    });
    // Runs the callback which in turn sets the signals
    // and populates the allEffects Set
    // NOTE: Inside the signal's setter the effects are deffer due to the
    // currentBatchEffects being set to a function
    callback();
    // Run the defered effects
    runEffects(allEffects);
    // Reset currentBatchEffects to undefined
    setCurrentBatchEffects();
  }

  // (( Memoize Value ))
  // Caches the data returned from the callback
  // Returns a getter function that returns the
  // cached data or the updated data if it changed
  function createMemo(getDataCalback) {
    let cachedData;
    let shouldClearCache = true;
    // Setter function for the shouldClearCache flag
    // Defaults to true
    const setShouldClearCache = (bool = true) => (shouldClearCache = bool);

    // Getter function that returns cachedData or updated data
    const getMemoizedData = () => {
      if (shouldClearCache) {
        // Update the cached data and reset flag
        cachedData = getDataCalback();
        setShouldClearCache(false);
      }
      return cachedData;
    };

    // Set global currentMemoClearFn to the shouldClearCache fn
    // That global function will be used by the signal to clear
    // the cache of this memo when the signal's value changes
    setCurrentMemoClearFn(setShouldClearCache);

    //Cache the data for the first time and have the signals inside
    //get access to the global currentMemoClearFn
    cachedData = getDataCalback();
    // Reset global currentMemoClearFn to undefined
    setCurrentMemoClearFn();

    return getMemoizedData;
  }

  // (( Effect ))
  // Sets the global currentEffect variable to it's callback
  // to be accessed by the signals used inside that callback
  function createEffect(fn) {
    setCurrentEffect(fn);
    // Call the function after setting the currentEffect
    // so the signals inside fn can access it
    const result = fn();
    // Clear current effect
    setCurrentEffect();
    return result;
  }

  // (( Signal ))
  // Returns a [getterFn(),setterFn()] tuple used to set and store data.
  function createSignal(initialValue = undefined) {
    let value = initialValue;
    const effectsSet = new Set();
    const memosMap = new Map();

    // When the getter is called inside the callback of a createMemo or createEffect,
    // That callback is stored in the Map/Set of that signal
    const getter = () => {
      addCurrentEffectToSet(effectsSet);
      addCurrentMemoToMap(memosMap, value);
      return value;
    };

    // When a setter is called the effects of the signal are ran and
    // the memoized values are updated (cache is cleared if the value changes).
    // If multiple setters are called inside a batch function then the effects of 
    // all those signals are batched together and duplicates are removed before being run
    const setter = (newValue) => {
      value = newValue;
      runEffects(effectsSet, currentBatchEffects);
      updateMemos(memosMap, value);
      return value;
    };

    return [getter, setter];
  }

  // ============================================================================
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
  console.log("IN UPDATENUMBERS", c());

  // batch(() => {
  setA(a() + 1);
  setB(b() + 1);
  setC(c() + 1);
  // });
};
createEffect(() => {
  console.log("CREATE EFFECT RAN");
  document.querySelector("button").innerText = `T-${aa()}`;
});
document.querySelector("button").addEventListener("click", () => {
  if (nr % 3 === 0) {
    updateNumbers();
    console.log(a(), b(), c());
    console.log("CLICK_______", aa());
  }
  nr++;
  console.log(nr);
});
