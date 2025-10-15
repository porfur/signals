// Signal pattern inspired by SolidJS
// Example for signals and effects found at
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs
//
// For batch, createMemo, createScope, onCleanup,
// I used the SolidJS documentation to figure
// out what they do and how they are used.

function init() {
  // ============================================================================
  // [[ GLOBALS ]]
  //
  // (( Variables ))
  // Globals used by the reactivity functions
  const [getEffect, setEffect] = createValue();
  const [getClearMemoFn, setClearMemoFn] = createValue();
  const [getIsbatching, setIsBatching] = createValue();
  const [getBatchEffectsFn, setBatchEffectsFn] = createValue();
  const [getScopeCollectorFn, setScopeCollectorFn] = createValue();
  const [getOnCleanupSet, setOnCleanupSet] = createValue();
  const [getIsCleaning, setIsCleaning] = createValue();

  // A map where the key is an effect function
  // and the value is a set of cleanup functions
  const globalCleanupMap = new Map();

  // ============================================================================
  // [[ REACTIVITY FUNCTIONS ]]

  // (( onCleanup ))
  // Used inside a createMemo or createEffect.
  // Takes a callback funnction that runs before re-running the memo/effect.
  function onCleanup(cleanupCallback) {
    // If the global getIsCleaning is true that onCleanup
    // was called from inside a cleanup function.
    // In that case just run the callback and return early.
    if (getIsCleaning()) {
      console.warn(
        cleanupCallback,
        "You are nesting onCleanup calls.",
        "The inner calls will be run when the outer most cleanup runs",
      );
      cleanupCallback();
      return;
    }

    // onCleanupSet is a Set of cleanup functions used to run before re-running
    // an effect or a clearMemo function
    // In cases where multiple cleanups are inside the same memo or effect callback
    // there might already be a global onCleanupSet otherwise create a new Set
    const onCleanupSet = getOnCleanupSet() || new Set();

    onCleanupSet.add(cleanupCallback);
    if (getEffect() || getClearMemoFn()) {
      // Set the global onCleanupSet to the current cleanup set.
      setOnCleanupSet(onCleanupSet);
    }
  }

  // ---------------------------------------------------------------------

  //  (( Scope ))
  //  Stores all effects created inside it's callback in a Set.
  //  Returns a dispose function that deletes that Set.
  //  Used to remove deprecaded effects from a signal
  function createScope(scopeCallback) {
    // Maps where
    // key is a signal's effectsSet/clearMemosSet
    // value is a Set of the disposable effects/clearMemos
    let scopedEffectsMap = new Map();
    let scopedClearMemosMap = new Map();

    // This scopeCollector function is used to get a signal's effects/clearMemos
    // and add them to the scopedEffectsMap/scopedClearMemosMap
    function scopeCollector({
      effectsSet,
      currentEffect,
      clearMemosSet,
      currentClearMemo,
    }) {
      addDisposableToScopeMap(scopedEffectsMap, effectsSet, currentEffect);
      addDisposableToScopeMap(
        scopedClearMemosMap,
        clearMemosSet,
        currentClearMemo,
      );
    }

    // Removes all disposable effects/clearMemos
    // from the scopedEffectsMap/scopedClearMemosMap
    function dispose(disposeCallback) {
      if (!scopedEffectsMap) {
        return;
      }
      disposeFromScopeMap(scopedEffectsMap);
      disposeFromScopeMap(scopedClearMemosMap);
      scopedEffectsMap = undefined;
      scopedClearMemosMap = undefined;
      disposeCallback && disposeCallback();
    }

    setScopeCollectorFn(scopeCollector); //Set global scopeCollectorFn to the current scopeCollector
    scopeCallback(); // Run scope
    setScopeCollectorFn(); // reset global scopeCollectorFn
    return dispose;
  }

  // ---------------------------------------------------------------------

  // (( Batch ))
  // Defers the effects of all signals set in the callback
  // and removes duplicates before running them
  function batch(fn) {
    // This needs to be retrieved before calling setBatchEffectsFn below.
    // Used to check for nested barching
    const previousBatch = getBatchEffectsFn();
    const allEffects = new Set();

    // Joins all effects in a single Set without duplicates
    function uniteEffects(effectsSet) {
      effectsSet.forEach((e) => allEffects.add(e));
      return allEffects;
    }

    // This flag is used to warn in case of nested batching
    if (getIsbatching()) {
      console.warn(
        fn,
        "Batch calls are being nested",
        "They all get bundled in one big batch at the end but you shouldn't do that because it hurts my soul.",
      );
    }

    // Sets the global batchEffectsFn to a function
    // When used by a signal, it collects all it's effects here
    setBatchEffectsFn(uniteEffects);

    // When a signal setter is ran inside the callback
    // It will pass it's effects to the uniteEffects function
    // via the global getBatchEffectsFn()
    // NOTE: Inside the signal's setter the effects are deffer
    // due to the getBatchEffectsFn() being set to a function
    setIsBatching(true); // Enable flag before fn call
    // Runs the batch callback which sets signals which in turn
    // batches the effects using the now global uniteEffects.
    fn();
    setIsBatching(); // Disable flag after fn call

    // Run the defered effects only once for all the batches
    // This means the effects only once for the outer most
    // batch where there is no previous batches
    // All the nested batches are still taken into account
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
    const previousClearMemoFn = getClearMemoFn();

    // Initial value is false so it doesn't run the cleanup on the first get
    let [getShouldClearCache, setShouldClearCache] = createValue(false);

    // Check if memos are nested and log error
    if (previousClearMemoFn) {
      console.error(
        fn,
        "This is a nested createMemo call.",
        "createMemo cannot be nested.",
      );
      console.trace(fn);
      return;
    }

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
    if (getEffect()) {
      console.warn(
        fn,
        "You are nesting effects.",
        "I don't know why but make sure you wrap it in a scope and dispose of it.",
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

      // If inside of a scope pass the data to the
      // scopeCollectorFn so it can dispose when needed
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

    // TODO: Check if needed
    getSignal.isSignal = true; // Used to check if a function is a signal getter

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
  // Also removes effect if the effect returns true
  function runEffects(effectsSet, skipBatch = false) {
    // Batch effects is a global function set by setBatchEffectsFn() inside batch()
    const batchEffects = skipBatch ? null : getBatchEffectsFn();

    if (batchEffects) {
      //If provided the function is used to add the current effects to the batch
      //then the running of the effect is skipped until the batch functions calls
      // runEffects with skipBatch = true
      batchEffects(effectsSet);
      return;
    }

    effectsSet.forEach((fn) => {
      // onCleanups should run before running the effects
      runOnCleanupsFor(fn);

      setEffect(fn); // set global effect so it can be used by the cleanup function
      const shouldDeleteEffect = fn(); // Remove effect if the effect returns true
      setEffect(); // Remove global effect after running

      if (shouldDeleteEffect) {
        effectsSet.delete(fn);
        setOnCleanupSet(); // Remove onCleanupSet if effect is to be deleted
        return; // Skip adding to global cleanup
      }
      //Need to re-add to globalCleanup because runOnCleanupsFor also removes them from globalCleanup
      addFuncToGlobalCleanup(fn);
    });
  }

  function runOnCleanupsFor(callback) {
    setIsCleaning(true); //Flag for checking nested cleanups
    if (globalCleanupMap.has(callback)) {
      const onCleanupSetForCallback = globalCleanupMap.get(callback);
      onCleanupSetForCallback.forEach((cleanup) => cleanup());
      //Remove after running
      globalCleanupMap.delete(callback);
    }
    setIsCleaning(); // Remove flag after cleanup
  }

  // Function used to update a signal's memoized values
  function clearMemoForSet(memosSet) {
    memosSet.forEach((clearCache) => clearCache());
  }

  function addFuncToGlobalCleanup(callback) {
    const currentOnCleanUpSet = getOnCleanupSet();
    setOnCleanupSet();
    if (!currentOnCleanUpSet || !callback) return;
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
