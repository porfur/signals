// Signal pattern inspired by SolidJS
// Example for signals and effects found at
// https://www.thisdot.co/blog/deep-dive-into-how-signals-work-in-solidjs
//
// For batch(), createMemo(), createScope(), onCleanup(), I used the SolidJS
// documentation to figure out what they do and how they are used.
// For untrack() I admit I asked Chat GPT and got a hint. Not an answer!
// It beats trying to read the SolidJS source code but still feels like cheating.

export const {
  createSignal,
  createEffect,
  batch,
  createMemo,
  createScope,
  onCleanup,
  untrack,
  untrackScope,
} = init();

function init() {
  // ============================================================================
  // [[ GLOBALS ]]
  // Functions and flags used by the reactivity functions
  // to pass around data and keep track of what is happening.
  //
  // They are this over complicated because
  // I wanted to call a function instead of re-assignment because it looks cool.
  // Then it was hell stepping in through the debugger to se what I'm doing.
  // Now it looks cool, it's even more convoluted and I can log the global values if needed.

  const { createValue, globalValues } = initGlobalValues();

  const [getEffect, setEffect] = createValue("currentEffect");
  const [getClearMemoFn, setClearMemoFn] = createValue("cleanMemoFn");
  const [getIsBatching, setIsBatching] = createValue("isBatching");
  const [getBatchEffectsFn, setBatchEffectsFn] = createValue("batchEffectsFn");
  const [getScopeCollectorFn, setScopeCollectorFn] =
    createValue("scopeCollectorFn");
  const [getOnCleanupSet, setOnCleanupSet] = createValue("onCleanupSet");
  const [getIsCleaning, setIsCleaning] = createValue("isCleaning");

  // A map where the key is an effect or a clearMemoFn and the value is a set
  // of cleanup functions provided by calling cleanup() inside that effect/memo
  const globalCleanupMap = new Map();

  // ============================================================================
  // ============================================================================
  // [[ REACTIVITY FUNCTIONS ]]

  // ---------------------------------------------------------------------

  // (( Effect ))
  // Sets the global currentEffect variable to it's callback
  // That callback will be used by any signal getter called inside of it.
  function createEffect(fn) {
    // Warnings and errors. Not important for understanding
    // the big picture but really important to alert the of misuse.
    if (!getScopeCollectorFn()) {
      console.warn(
        fn,
        "Current effect is out of scope and can't be disposed!",
        "Wrap it in a createScope and dispose of it when no longer needed to avoid memory leaks",
      );
    }
    const currentEffect = getEffect();
    if (currentEffect) {
      console.error(
        "You are nesting effects.",
        "The effect",
        fn,
        "is being nested inside",
        currentEffect,
        "Wrap the inner effect inside untrack() to avoid memory leaks.",
      );
    }
    if (getClearMemoFn()) {
      console.error(
        "You are nesting the effect",
        fn,
        "inside a memo.",
        "Wrap the inner effect inside untrack() to avoid memory leaks.",
      );
    }

    // Here's the main thing.
    // When createEffect is called it sets the global currentEffect to the provided callback.
    setEffect(fn);
    // Then calls the function after setting the currentEffect
    // Inside that effect signal getters are being called.
    // Those getters will now have access to that global currentEffect
    const result = fn();

    // Also add the function to globalCleanupMap to be used on cleanup later.
    addFuncToGlobalCleanup(fn);
    // Not the gobal effect is reset again so signal getters
    // called outside the effect don't have access to it.
    setEffect();

    // No idea why I'm returning the result.
    // I have not found a use for it.
    return result;
  }

  // ---------------------------------------------------------------------

  // (( createSignal ))
  // This and createEffect are at the core of solidJS's reactivity.
  // Same as useState in React but the first value it returns is a
  // getter function instead of the actual value.

  // NOTE: For now pretend you can't read the comments
  // of anything with the word 'memo' or 'scope' in it.

  function createSignal(initialValue) {
    // Inside we have the actual value and two Sets soon to be populated with functions.
    let signalValue = initialValue;
    const effectsSet = new Set(); // The effects to run when changing the signal value.
    const clearMemosSet = new Set(); // Clear functions for memoizes values (I told you not to read this).

    // When the getter is called inside the callback of a createMemo (don't)
    // or createEffect, that callback is stored in the Sets of that signal.
    function getSignal() {
      // Now because the global effect was set before calling the
      // getter we have access to the effect inside this signal.
      const currentEffect = getEffect();

      // These other two are pretty much doing the same thing,
      // using globaly set functions from other places to do different things.
      // But you are not looking at them yet. Right?
      const currentClearMemo = getClearMemoFn();
      const currentScopeCollectorFn = getScopeCollectorFn();

      // Later on you will discover that effects get trapped inside a signal
      // and run even when no longer neded. In the business this is called a 'memory leak'
      // The currentScopeCollectorFn is just another function that can be set globaly
      // and used by a signal to keep track of effects and memos for disposal.
      if (currentScopeCollectorFn) {
        currentScopeCollectorFn({
          effectsSet,
          currentEffect,
          clearMemosSet,
          currentClearMemo,
        });
      }

      // The currentEffect function is added to the set of effects for this signal
      addToSet(effectsSet, currentEffect);
      // Same but with the currentclearMemo function
      addToSet(clearMemosSet, currentClearMemo);

      return signalValue;
    }

    // When a signalSetter is called the value is updated then the effects
    // and clearMemo functions from it's Sets will be called
    const setSignal = (newValue, forceReactivity = false) => {
      if (newValue !== signalValue || forceReactivity) {
        //Order below matters
        //I wrote that the order below matters a while ago and can't remember why.
        //It works and I'm not changing it to find out.

        // Memos are cleared first (you will read about it later)
        clearMemoForSet(clearMemosSet);
        signalValue = newValue;
        // The effects from the set will run.
        // This function has some extra stuff inside that you can look at later.
        // For now just know it runs all the effects in the set.
        runEffects(effectsSet);
      }
      return signalValue;
    };

    return [getSignal, setSignal];
  }

  // ---------------------------------------------------------------------

  // (( createMemo ))
  // This function behaves like a mix of an effect and a signal.
  // It takes a callback function that returns the desired data and returns a getter() similar to a signal.
  // The cached value is updated only when signals inside the callback change.
  function createMemo(fn) {
    // These are check for nested createMemos or createMemos nested inside
    // createEffect along with errors letting the user know ths is not cool.
    const previousClearMemoFn = getClearMemoFn();
    const currentEffect = getEffect();
    if (previousClearMemoFn) {
      console.error(
        "You are nesting memos",
        "The memo",
        fn,
        "is being nested inside",
        previousClearMemoFn,
        "Not sure what the usecase is but you can wrap the inner memo in untrack() if you want to keep nesting.",
      );
      return;
    }
    if (currentEffect) {
      console.error(
        "Cannot nest memos inside an effect.",
        "The memo",
        fn,
        "is nested inside",
        currentEffect,
        "Not sure what the usecase is but you can wrap the memo in untrack() if you want to keep nesting.",
      );
      return;
    }

    // Now that we know there is no nesting in this house let's continue.
    // Here is a the cachedData and a flag to check if we should clear it.
    // Ignore mentions of cleanp for now and just roll with it.
    let cachedData;
    let shouldClearCache; // Initial value is falsy so it doesn't run the cleanup on the first get.

    //Like this. Pretend it's not here for now.
    addFuncToGlobalCleanup(fn);

    // There is a global clearMemoFn currently empty.
    // We set it to a function that swithces shouldClearCache to true
    // Now this instance of the memo can be marked to recompute from outside.
    setClearMemoFn(() => {
      shouldClearCache = true;
    });

    // Cache the data for the first time.
    // Any signals called inside the callback will now be able to access the global clearMemoFn
    // Which was just set above.
    // Now if you go back to createSignal and look over what I told you to skip, you can see a
    // clearMemosSet which will be populated with the now global function that sets shouldClearCache to true
    // And if you look at setSignal you can see how the functions are called when the signal changes.
    cachedData = fn();

    // Reset global getClearMemoFn() to undefined
    // Now that the signals grabbed the function needed to clear the cached value
    // the global clearMemoFn is set back to undefined
    setClearMemoFn();

    // Up to this point createMemo behaves like createEffect.
    // From here on it takes on a role similar to a signal.

    // Flag to check if currently running an effect.
    // An effect calling the memo getter will run effects which in turn will call the getter
    // which will call the getter... (insert recursion joke)
    let isRunningEffect = false;
    const effectSet = new Set();

    // Getter function that returns cachedData or updated data
    function getMemoizedData() {
      const batchEffectFn = getBatchEffectsFn();
      const activeEffect = getEffect();
      addToSet(effectSet, activeEffect);
      effectSet.add(activeEffect);
      if (shouldClearCache) {
        runOnCleanupsFor(fn);
        const newData = fn();
        if (!isRunningEffect && activeEffect && newData !== cachedData) {
          isRunningEffect = true;
          batchEffectFn && setBatchEffectsFn(batchEffectFn);
          console.log("Before running memo effects");
          runEffects(effectSet);
          console.log("After running memo effects");
          batchEffectFn && setBatchEffectsFn();
          isRunningEffect = false;
        }
        cachedData = newData;
        shouldClearCache = false;
      }
      return cachedData;
    }

    return getMemoizedData;
  }
  // ---------------------------------------------------------------------

  // (( onCleanup ))
  // Used inside a createMemo or createEffect.
  // Takes a callback funnction that runs before re-running the memo/effect.
  function onCleanup(cleanupCallback) {
    // If the global isCleaning is true that onCleanup
    // was called from inside a cleanup function.
    // In that case just run the callback and return early.
    if (getIsCleaning()) {
      console.warn(
        cleanupCallback,
        "You are nesting onCleanup calls.",
        "The inner calls will be run when the outer most cleanup runs.",
        "What is it with you and nesting?",
      );
      cleanupCallback();
      return;
    }

    // onCleanupSet is a Set of cleanup functions used to run before re-running
    // an effect or a clearMemoFn.
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
  //  Stores all effects and memos created inside it's callback in Sets.
  //  Returns a dispose function that deletes those Sets.
  //  Used to remove deprecaded effects/memos from a signal.
  function createScope(scopeCallback) {
    // Maps where
    // key is a signal's effectsSet/clearMemoFnSet
    // value is a Set of the disposable effects/clearMemos
    let scopedEffectsMap = new Map();
    let scopedClearMemosMap = new Map();

    // This scopeCollector function is used to get a signal's effects/clearMemoFns
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
    if (getIsBatching()) {
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

  // (( Untrack ))
  // Skips tracking of effects and memos for it's callback
  function untrack(fn) {
    const activeEffect = getEffect();
    const activeClearMemoFn = getClearMemoFn();
    setEffect();
    setClearMemoFn();
    try {
      fn();
    } finally {
      setEffect(activeEffect);
      setClearMemoFn(activeClearMemoFn);
    }
  }

  function untrackScope(fn) {
    const activeScopeCollectorFn = getScopeCollectorFn();
    setScopeCollectorFn();
    try {
      fn();
    } finally {
      setScopeCollectorFn(activeScopeCollectorFn);
    }
  }

  // ============================================================================
  // ============================================================================
  // [[ HELPERS ]]

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

  // Init global values state
  function initGlobalValues() {
    const globalValues = {};
    function createValue(globalKey, initialValue = null) {
      globalValues[globalKey] = initialValue;
      return [
        () => globalValues[globalKey],
        (newVal) => {
          globalValues[globalKey] = newVal;
        },
      ];
    }
    return { createValue, globalValues };
  }

  return {
    createSignal,
    createEffect,
    batch,
    createMemo,
    createScope,
    onCleanup,
    untrack,
    untrackScope,
  };
}
