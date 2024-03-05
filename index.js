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
  // These variables are set in the create functions and then used by the signals
  // as a function or identifier or both before being cleared
  let currentEffect; // The current effect callback
  let currentMemoClearFn; // The fn used to clear the current memo's cache
  let currentBatchEffects; //
  let currentScopeEffectsCollector; //

  // (( Functions ))
  // Used to set global variables
  // No arguments sets them to undefined
  const setCurrentMemoClearFn = (value) => (currentMemoClearFn = value);
  const setCurrentEffect = (value) => (currentEffect = value);
  const setCurrentBatchEffects = (value) => (currentBatchEffects = value);

  // Function used to update a signal's memoized values
  const clearMemoCaches = (memosSet) => {
    memosSet.forEach((clearCache) => {
      memosSet.set(clearCache, newValue);
      clearCache();
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

  // Function to add the global  currentMemoClearFn to memos set
  const addCurrentMemoToSet = (memosSet) => {
    if (currentMemoClearFn) {
      memosSet.set(currentMemoClearFn);
    }
  };

  // ============================================================================
  // [[ REACTIVITY FUNCTIONS ]]
  //(( Cleanup ))
  //TO DO
  //(( Scope ))
  //TO DO Test and comment to remember how the hell this works
  function createScope(fn) {
    let signalsAndEffects = new Map();

    currentScopeEffectsCollector = (currentSignalEffectsSet, currentEffect) => {
      let scopedEffectsSet = new Set();
      if (!signalsAndEffects.has(currentSignalEffectsSet)) {
        signalsAndEffects.set(currentSignalEffectsSet, scopedEffectsSet);
      }
      scopedEffectsSet = signalsAndEffects.get(currentSignalEffectsSet);
      scopedEffectsSet.add(currentEffect);
      currentScopeEffectsCollector = undefined;
    };

    fn();
    function dispose(fn) {
      if (signalsAndEffects.size) {
        signalsAndEffects.forEach((valScopedEffSet, keySignalEffSet) => {
          valScopedEffSet.forEach((scopedEff) =>
            keySignalEffSet.delete(scopedEff),
          );
        });
        signalsAndEffects = undefined;
        fn();
        return true;
      }
    }

    return dispose;
  }

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

    // Set global currentMemoClearFn to the setShouldClearCache fn
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
    if (!currentScopeEffectsCollector) {
      console.warn(
        "Current effect is out of scope and can't be cleaned up.",
        "Wrap it in a createScope to avoid memory leaks",
      );
    }
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
  function createSignal(initialValue) {
    let value = initialValue;
    // TODO The effects set might hold effects that are no longer needed.
    // They should be removed.
    // Maybe have effects be a map with symbol kets from each component that encapsulates the effect
    // Explore making a createElement function that has a symbol to use as a key here
    const effectsSet = new Set();
    const clearMemoCacheSet = new Set();

    // When the getter is called inside the callback of a createMemo or createEffect,
    // That callback is stored in the Map/Set of that signal
    const getter = () => {
      addCurrentEffectToSet(effectsSet);
      addCurrentMemoToSet(clearMemoCacheSet, value);

      if (currentScopeEffectsCollector && currentEffect) {
        currentScopeEffectsCollector(effectsSet, currentEffect);
      }

      return value;
    };

    // When a setter is called the effects of the signal are ran and
    // the memoized values are updated (cache is cleared if the value changes).
    // If multiple setters are called inside a batch function then the effects of
    // all those signals are batched together and duplicates are removed before being run
    const setter = (newValue, alwaysRun = false) => {
      if (value !== newValue) {
        value = newValue;
        runEffects(effectsSet, currentBatchEffects);
        clearMemoCaches(clearMemoCacheSet, value);
      } else if (alwaysRun) {
        runEffects(effectsSet, currentBatchEffects);
      }
      return value;
    };

    return [getter, setter];
  }

  // ============================================================================
  return { batch, createSignal, createEffect, createMemo, createScope };
}

export const { batch, createSignal, createEffect, createMemo, createScope } =
  init();
