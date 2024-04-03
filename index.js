// Signal pattern inspired by SolidJS
// Example for signals and effects found at
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs
// For createMemo and batch I used the SolidJS documentation to figure
// out how and why they are usefull

function init() {
  // ============================================================================
  // [[ GLOBALS ]]
  //
  // (( Variables ))
  // Globals used by the REACTIVITY functions to pass around functions

  const [getEffect, setEffect] = createValue();
  const [getClearMemoFn, setClearMemoFn] = createValue();
  const [getBatchEffectsFn, setBatchEffectsFn] = createValue();
  const [getScopeCollectorFn, setScopeCollectorFn] = createValue();
  const [getOnCleanupSet, setOnCleanupSet] = createValue();
  const globalCleanupMap = new Map();

  // (( Functions ))
  // Used to set global variables
  // No arguments sets them to undefined

  // ============================================================================
  // [[ REACTIVITY FUNCTIONS ]]
  //(( Cleanup ))
  //TO DO
  function onCleanup(callback) {
    const onCleanupSet = getOnCleanupSet() || new Set();
    onCleanupSet.add(callback);
    console.log("in oncleanp", onCleanupSet);
    setOnCleanupSet(onCleanupSet);
  }

  //(( Scope ))
  // Stores disposable effects in a set and deletes them when the
  // returend dispose fn is called.
  // Used to remove deprecaded effects from a signal
  function createScope(callback) {
    // A map which holds a signal's effectsSet as key
    // and a set of disposable effects as values
    let allEffectsMap = new Map();
    let allClearMemosMap = new Map();

    setScopeCollectorFn(scopeCollector);
    callback();
    addFuncToGlobalCleanup(callback);
    setScopeCollectorFn();
    return dispose;

    // Get a signal's effectsSet and the current effect
    // and add them to the allEffectsMap
    function scopeCollector({
      effectsSet,
      currentEffect,
      clearMemosSet,
      currentClearMemo,
    }) {
      addDisposableToScopeMap(allEffectsMap, effectsSet, currentEffect);
      addDisposableToScopeMap(
        allClearMemosMap,
        clearMemosSet,
        currentClearMemo,
      );
    }

    // Removes all disposable effects from the signalsEffects
    function dispose(disposeCallback) {
      disposeFnFromGlobalCleanup(callback);
      disposeFromScopeMap(allEffectsMap);
      disposeFromScopeMap(allClearMemosMap);
      disposeCallback();
      runOnCleanupsFor(callback);
      allEffectsMap = undefined;
      return true;
    }
  }

  // (( Batch ))
  // Defers the effects of all signals set in the callback
  // and removes duplicates before running them
  function batch(callback) {
    const allEffects = new Set();
    const uniteEffects = (effectsSet) => allEffects.add(...effectsSet);

    // Sets the global batchEffectsFn to a function
    // When used by a signal, it collects all it's effects here
    setBatchEffectsFn(uniteEffects);

    // When a signal setter is ran inside the callback
    // It will pass it's effects to the uniteEffets
    // function via the global getBatchEffectsFn()
    // NOTE: Inside the signal's setter the effects are deffer due to the
    // getBatchEffectsFn() being set to a function
    callback();

    // Run the defered effects
    runEffects(allEffects, true);

    // Reset currentBatchEffects to undefined
    setBatchEffectsFn();
  }

  // (( Memoize Value ))
  // Caches the data returned from the callback
  // Returns a getter function that returns the
  // cached data or the updated data if it changed
  function createMemo(callback) {
    let cachedData;
    let [shouldClearCache, setShouldClearCache] = createValue(true);

    // Set global clearMemoFn to the local shouldClearCache setter
    // That global function will be used by the signal to clear
    // the cache of this memo when the signal's value changes
    setClearMemoFn(() => setShouldClearCache(true));

    //Cache the data for the first time and have the signals inside
    //get access to the setShouldClearCache function via the globsl setClearMemoFn
    cachedData = callback();
    addFuncToGlobalCleanup(callback);

    // Reset global currentMemoClearFn to undefined
    setClearMemoFn();

    // Getter function that returns cachedData or updated data
    function getMemoizedData() {
      if (shouldClearCache()) {
        runOnCleanupsFor(callback);
        // Update the cached data and reset flag
        cachedData = callback();
        addFuncToGlobalCleanup(callback);
        setShouldClearCache(false);
      }
      return cachedData;
    }

    return getMemoizedData;
  }

  // (( Effect ))
  // Sets the global currentEffect variable to it's callback
  // to be accessed by the signals used inside that callback
  function createEffect(fn) {
    if (!getScopeCollectorFn()) {
      console.warn(
        "Current effect is out of scope and can't be cleaned up.",
        "Wrap it in a createScope to avoid memory leaks",
      );
    }
    setEffect(fn);
    // Call the function after setting the currentEffect
    // so the signals inside fn can access it
    const result = fn();

    // Clear current effect
    setEffect();
    return result;
  }

  // (( Signal ))
  // Returns a [getterFn(),setterFn()] tuple used to set and store data.
  function createSignal(initialValue) {
    let signalValue = initialValue;
    // TODO The effects set might hold effects that are no longer needed.
    // They should be removed.
    // Maybe have effects be a map with symbol kets from each component that encapsulates the effect
    // Explore making a createElement function that has a symbol to use as a key here
    const effectsSet = new Set();
    const clearMemosSet = new Set();

    // When the getter is called inside the callback of a createMemo or createEffect,
    // That callback is stored in the Set of that signal
    function getter() {
      const currentEffect = getEffect();
      const currentScopeCollectorFn = getScopeCollectorFn();
      const currentClearMemo = getClearMemoFn();

      addToSet(effectsSet, currentEffect);
      addToSet(clearMemosSet, currentClearMemo);
      addFuncToGlobalCleanup(currentEffect);

      if (currentScopeCollectorFn) {
        currentScopeCollectorFn({
          effectsSet,
          currentEffect,
          clearMemosSet,
          currentClearMemo,
        });
      }
      return signalValue;
    }

    // When a setter is called the effects of the signal are ran and
    // the memoized values are updated (cache is cleared if the value changes).
    // If multiple setters are called inside a batch function then the effects of
    // all those signals are batched together and duplicates are removed before being run
    const setter = (newValue, alwaysRun = false) => {
      if (signalValue !== newValue) {
        //Order below matters first clear memos then update value and then run effects with new val
        clearMemoForSet(clearMemosSet);
        signalValue = newValue;
        runEffects(effectsSet);
      } else if (alwaysRun) {
        runEffects(effectsSet);
      }
      return signalValue;
    };

    return [getter, setter];
  }

  // ============================================================================
  // ============================================================================
  // [[ HELPERS ]]

  function createValue(val) {
    let value = val;
    const get = () => value;
    const set = (newVal) => {
      value = newVal;
      return value;
    };
    return [get, set];
  }

  function addToSet(set, val) {
    val && set.add(val);
  }

  // Function used to run a signal's effects
  // NOTE: Also removes effect if the effect returns true
  function runEffects(effectsSet, skipBatch = false) {
    const batchEffects = skipBatch ? null : getBatchEffectsFn();
    if (batchEffects) {
      batchEffects(effectsSet);
      return;
    }
    effectsSet.forEach((fn) => {
      runOnCleanupsFor(fn);
      return fn() && effectsSet.delete(fn);
    });
  }

  function runOnCleanupsFor(fn) {
    console.log('in run cleanups',fn,globalCleanupMap.has(fn))
    console.log('in run cleanups',globalCleanupMap)


    if (globalCleanupMap.has(fn)) {
      console.log(fn);
      globalCleanupMap.get().forEach((cleanup) => cleanup());
      globalCleanupMap.delete(fn);
    }
  }

  // Function used to update a signal's memoized values
  function clearMemoForSet(memosSet) {
    memosSet.forEach((clearCache) => clearCache());
  }

  function addFuncToGlobalCleanup(fn) {
    const currentOnCleanUpSet = getOnCleanupSet();
    console.log({currentOnCleanUpSet})
    // Clear current onCleanupSet
    setOnCleanupSet();
    if (!currentOnCleanUpSet || !fn) return;
    if (!globalCleanupMap.has(fn)) {
      globalCleanupMap.set(fn, currentOnCleanUpSet);
      return;
    }
    globalCleanupMap.get(fn).add(...currentOnCleanUpSet);
  }

  function addDisposableToScopeMap(scopeMap, keySet, currentFn) {
    if (!currentFn) return;
    if (!scopeMap.has(keySet)) {
      scopeMap.set(keySet, new Set());
    }
    const disposableSet = scopeMap.get(keySet);
    disposableSet.add(currentFn);
  }

  function disposeFromScopeMap(scopeMap) {
    if (!scopeMap) return;
    scopeMap.forEach((disposableSet, keySet) => {
      disposableSet.forEach((disposableEffect) =>
        keySet.delete(disposableEffect),
      );
    });
  }

  function disposeFnFromGlobalCleanup(fn) {
    globalCleanupMap.delete(fn);
  }

  return {
    createSignal,
    createEffect,
    batch,
    createMemo,
    createScope,
    onCleanup,
  };
}

export const {
  createSignal,
  createEffect,
  batch,
  createMemo,
  createScope,
  onCleanup,
} = init();
