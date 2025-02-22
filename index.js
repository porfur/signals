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

  // ============================================================================
  // [[ REACTIVITY FUNCTIONS ]]

  /**
   * (( onCleanup ))
   * When called inside a createMemo or createEffect callback
   * it's callback is ran before re-running that memo/effect callback
   *
   * @param {Function} callback
   */
  function onCleanup(callback) {
    const onCleanupSet = getOnCleanupSet() || new Set();
    onCleanupSet.add(callback);
    if (getEffect() || getClearMemoFn()) {
      setOnCleanupSet(onCleanupSet);
    }
  }

  // ---------------------------------------------------------------------

  //(( Scope ))
  // Stores disposable effects in a set and deletes them when the
  // returend dispose fn is called.
  // Used to remove deprecaded effects from a signal
  function createScope(callback) {
    // A map which holds a signal's effectsSet as key
    // and a set of disposable effects as values
    let allScopedEffectsMap = new Map();
    let allScopedClearMemosMap = new Map();

    setScopeCollectorFn(scopeCollector);
    callback();
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
      addDisposableToScopeMap(allScopedEffectsMap, effectsSet, currentEffect);
      addDisposableToScopeMap(
        allScopedClearMemosMap,
        clearMemosSet,
        currentClearMemo,
      );
    }

    // Removes all disposable effects from the signalsEffects
    function dispose(disposeCallback) {
      disposeFromScopeMap(allScopedEffectsMap);
      disposeFromScopeMap(allScopedClearMemosMap);
      allScopedEffectsMap = undefined;
      allScopedClearMemosMap = undefined;
      disposeCallback && disposeCallback();
    }
  }

  // ---------------------------------------------------------------------

  // (( Batch ))
  // Defers the effects of all signals set in the callback
  // and removes duplicates before running them
  function batch(callback) {
    const previousBatch = getBatchEffectsFn() || null;
    const allEffects = new Set();
    function uniteEffects(effectsSet) {
      if (effectsSet.size) {
        allEffects.add(...effectsSet);
      }
      return allEffects;
    }

    // Sets the global batchEffectsFn to a function
    // When used by a signal, it collects all it's effects here
    setBatchEffectsFn(uniteEffects);

    // When a signal setter is ran inside the callback
    // It will pass it's effects to the uniteEffets
    // function via the global getBatchEffectsFn()
    // NOTE: Inside the signal's setter the effects are deffer due to the
    // getBatchEffectsFn() being set to a function
    callback();

    // Run the defered effects only once for all the batches
    if (!previousBatch) {
      runEffects(allEffects, true);
    }

    // Reset global batch effects to undefined
    setBatchEffectsFn();
  }

  // ---------------------------------------------------------------------

  // (( Memoize Value ))
  // Caches the data returned from the callback
  // Returns a getter function that returns the
  // cached data or the updated data if it changed
  function createMemo(fn) {
    let cachedData;
    // Initial value is false so it doesn't run the cleanup on the first get
    let [getShouldClearCache, setShouldClearCache] = createValue(false);

    // Set global clearMemoFn to the local shouldClearCache setter
    // That global function will be used by the signal to clear
    // the cache of this memo when the signal's value changes
    setClearMemoFn(() => setShouldClearCache(true));

    //Cache the data for the first time and have the signals inside
    //get access to the setShouldClearCache function via the global setClearMemoFn
    cachedData = fn();

    // Reset global getClearMemoFn() to undefined
    setClearMemoFn();

    // Getter function that returns cachedData or updated data
    function getMemoizedData() {
      if (getShouldClearCache()) {
        runOnCleanupsFor(fn);
        // Update the cached data and reset flag
        cachedData = fn();
        setShouldClearCache(false);
      }
      return cachedData;
    }

    return getMemoizedData;
  }

  // ---------------------------------------------------------------------

  // (( Effect ))
  // Sets the global currentEffect variable to it's callback
  // to be accessed by the signals used inside that callback
  function createEffect(fn) {
    if (!getScopeCollectorFn()) {
      console.warn(
        fn,
        "Current effect is out of scope and can't be cleaned up.",
        "Wrap it in a createScope to avoid memory leaks",
      );
    }
    setEffect(fn);
    // Call the function after setting the currentEffect
    // so the signals inside fn can access it
    const result = fn();

    addFuncToGlobalCleanup(fn);
    // Clear current effect
    setEffect();
    return result;
  }

  // ---------------------------------------------------------------------

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
    function getSignal() {
      const currentEffect = getEffect();
      const currentScopeCollectorFn = getScopeCollectorFn();
      const currentClearMemo = getClearMemoFn();

      addToSet(effectsSet, currentEffect);
      addToSet(clearMemosSet, currentClearMemo);

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
    const setSignal = (newValue, forceReactivity = false) => {
      if (newValue !== signalValue || forceReactivity) {
        //Order below matters
        clearMemoForSet(clearMemosSet); // clear memos
        signalValue = newValue; // update value
        runEffects(effectsSet); // run effects with new val
      }
      return signalValue;
    };

    return [getSignal, setSignal];
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
      // onCleanups should run before running the effects
      runOnCleanupsFor(fn);
      if (fn()) {
        effectsSet.delete(fn);
      }
      //Need to re-add to globalCleanup because runOnCleanupsFor also removes them from globalCleanup
      addFuncToGlobalCleanup(fn);
    });
  }

  function runOnCleanupsFor(callback) {
    if (globalCleanupMap.has(callback)) {
      const onCleanupSetForCallback = globalCleanupMap.get(callback);
      onCleanupSetForCallback.forEach((cleanup) => cleanup());
      globalCleanupMap.delete(callback);
    }
  }

  // Function used to update a signal's memoized values
  function clearMemoForSet(memosSet) {
    memosSet.forEach((clearCache) => clearCache());
  }

  function addFuncToGlobalCleanup(callback) {
    const currentOnCleanUpSet = getOnCleanupSet();
    if (!currentOnCleanUpSet || !callback) return;
    setOnCleanupSet();
    if (!globalCleanupMap.has(callback)) {
      globalCleanupMap.set(callback, currentOnCleanUpSet);
    }
  }

  function addDisposableToScopeMap(scopeMap, keyFnSet, currentFn) {
    if (!currentFn) return;
    if (!scopeMap.has(keyFnSet)) {
      scopeMap.set(keyFnSet, new Set());
    }
    const disposableSet = scopeMap.get(keyFnSet);
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
