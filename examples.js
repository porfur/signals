// console.log("Test running");
import {
  createSignal,
  createEffect,
  batch,
  createMemo,
  createScope,
  onCleanup,
} from "./index.js";
//
// // [[ CREATE EFFECT ]]
// When signal getters are called inside a create effect callback
// that function is stored by the signal and it reruns whenever the
// value is changed via the signal setter
(() => {
  const button = document.querySelector("#createEffect-button");
  const [count, setCount] = createSignal(0);
  let flag;
  createEffect(() => {
    console.log("Count is now", count());
    button.innerText = `Counter: ${count()}`;
    console.log(count)

    //If for some reason you want to nest createEffects the inner ones need to be scoped and disposed.
    // const innerDispose = createScope(() =>
    //   createEffect(() => console.log("NESTED count", count())),
    // );
    // innerDispose(() => console.log("InnerDisposeRan"));
    //
  }),
    button.addEventListener("click", () => {
      flag = !flag;
      return flag ? setCount(count()) : setCount(count() + 1);
    });
})();
//
// // ==============================================================================
//
// // [[ BATCH ]]
// When there are multiple signals in an effect, each of those signals
// runs it's own copy of that effect. Wraping the setters in a batch
// alows that effect to run only once
(() => {
  const batchbutton = document.querySelector("#batch-button");
  const nobatchbutton = document.querySelector("#no-batch-button");
  const [positiveCount, setPositiveCount] = createSignal(0);
  const [negativeCount, setNegativeCount] = createSignal(0);

  createEffect(() => {
    console.log("Positive count is now", positiveCount());
    console.log("Negative count is now", negativeCount());
    batchbutton.innerText = `Batch Counter: ${positiveCount()}${negativeCount()}`;
    nobatchbutton.innerText = `No Batch Counter: ${positiveCount()}${negativeCount()}`;
  });

  nobatchbutton.addEventListener("click", () => {
    setPositiveCount(positiveCount() + 1);
    setNegativeCount(negativeCount() - 1);
  });
  batchbutton.addEventListener("click", () => {
    batch(() => {
      console.log("as");
      setPositiveCount(positiveCount() + 1);
      batch(() => {
        setNegativeCount(negativeCount() - 1);
        batch(() => setNegativeCount(negativeCount() + 1));
      });
    });
  });
})();
//
// ==============================================================================
//
// // [[ CREATE MEMO ]]
(() => {
  const memobutton = document.querySelector("#memo-button");
  const nomemobutton = document.querySelector("#no-memo-button");
  const memotext = document.querySelector("#memo-text");
  const nomemotext = document.querySelector("#no-memo-text");
  const [noMemoCount, setNoMemoCount] = createSignal(0);
  const [memoCount, setMemoCount] = createSignal(0);

  function countTo(nr, startNr = 0) {
    if (startNr > nr) {
      console.log(" ------ Counting done");
      return nr;
    }
    return countTo(nr, startNr + 1);
  }

  // Without createMemo
  createEffect(() => {
    nomemobutton.innerText = `Without Memo Counter: ${noMemoCount()}`;
    const fragment = document.createDocumentFragment();
    console.log(" ========= Without createMemo Start ========= ");
    for (let i = 0; i <= noMemoCount(); i++) {
      fragment.append(document.createTextNode(` ${countTo(noMemoCount())}`));
    }
    console.log(" ========= Without createMemo End =========== ");
    nomemotext.appendChild(fragment);
  });

  // With createMemo
  const memoizedCountDown = createMemo(() => {
    console.log("IN MEMO");
    return countTo(memoCount());
  });

  createEffect(() => {
    console.log(" ========= With createMemo Start ========= ");
    memobutton.innerText = `With Memo Counter: ${memoCount()}`;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i <= memoCount(); i++) {
      fragment.append(document.createTextNode(` ${memoizedCountDown()}`));
    }
    memotext.appendChild(fragment);
    console.log(" ========= With createMemo End =========== ");
  });

  nomemobutton.addEventListener("click", () => {
    setNoMemoCount(noMemoCount() + 1);
  });
  memobutton.addEventListener("click", () => {
    setMemoCount(memoCount() + 1);
  });
})();
//
// // ==============================================================================

// [[ CREATE SCOPE ]]
// Effects and Memoized values are stored in a signal.
// Wraping the code in createScope alows the disposal of unused effects and memos
(() => {
  const scopeBtn = document.querySelector("#scope-button");
  const noScopeBtn = document.querySelector("#no-scope-button");
  const [count, setCount] = createSignal(0);

  const dispose = createScope(() => {
    onCleanup(() => console.log("IN DISPOSE CLEANUP"));
    const memo = createMemo(() => {
      console.log("Count in Memo is now", count());
      return count();
    });
    createEffect(() => {
      console.log("Count in Effect is now:", count());
      scopeBtn.innerText = `Counter: ${count()} | Counter memo: ${memo()}`;
    });
    scopeBtn.addEventListener("click", () => {
      debugger;
      setCount(count() + 1);
      console.log("Count on Click is:", count());
    });
  });

  noScopeBtn.addEventListener("click", () => {
    dispose(() => {
      console.log("Effects in scope were now disposed");
    });
  });
})();

// [[ ON CLEANUP - EFFECT ]]
// (() => {
//   const cleanupBtn = document.querySelector("#cleanup-button");
//   const cleanupText = document.querySelector("#cleanup-text");
//   const [randomNr, setRandomNr] = createSignal(getRandomNr());
//   const [randomNr2, setRandomNr2] = createSignal(getRandomNr());
//   const [isIntervalOn, setIsIntervalOn] = createSignal(false);
//
//   function getRandomNr() {
//     return Math.floor(Math.random() * 10);
//   }
//
//   createEffect(() => {
//     cleanupBtn.innerText = `onCleanup - ${randomNr()}`;
//
//     let increment = 0;
//
//     const interval = setInterval(() => {
//       cleanupText.innerText = `${increment} - ${randomNr()} - ${randomNr2()}`;
//       increment++;
//     }, 1000);
//     console.log("INTERVAL ID", interval);
//
//     onCleanup(() => {
//       clearInterval(interval);
//       console.log("INTERVAL", interval, "CLEARED ON CLEANUP");
//     });
//     // onCleanup(() => {
//     //   console.log("ON CLEANUP 2");
//     // });
//     return;
//   });
//
//   cleanupBtn.addEventListener("click", () => {
//     batch(() => {
//       setRandomNr(getRandomNr());
//       setRandomNr2(getRandomNr());
//     });
//   });
// })();

// [[ ON CLEANUP - MEMO ]]
(() => {
  const incrementBtn = document.querySelector("#cleanup-all-button-increment");
  const disposeBtn = document.querySelector("#cleanup-all-button-dispose");
  const [count, setCount] = createSignal(0);

  const dispose = createScope(() => {
    function countTo(nr, startNr = 0) {
      if (startNr > nr) {
        console.log(" ------ Counting done");
        return nr;
      }
      return countTo(nr, startNr + 1);
    }
    let cleanupCount = 0;
    const memoizedCountDown = createMemo(() => {
      onCleanup(() => {
        console.log("ON CLEANUP MEMO RAN", cleanupCount);
        cleanupCount++;
      });
      return countTo(count());
    });

    createEffect(() => {
      for (let i = 0; i <= count(); i++) {
        incrementBtn.append(document.createTextNode(` ${memoizedCountDown()}`));
      }
    });

    incrementBtn.addEventListener("click", () => {
      setCount(count() + 1);
    });
  });
  disposeBtn.addEventListener("click", () => {
    dispose(() => {
      console.log("DIspose clicked");
    });
  });
})();
