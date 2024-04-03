console.log("Test running");
import { createSignal, createEffect, batch } from "./index.js";

// [[ CREATE EFFECT ]]
// When signal getters are called inside a create effect callback 
// that function is stored by the signal and it reruns whenever the 
// value is changed via the signal setter
(() => {
  const button = document.querySelector("#createEffect-button");
  const [count, setCount] = createSignal(0);

  createEffect(() => {
    console.log("Count is now", count());
    button.innerText = `Counter: ${count()}`;
  });

  button.addEventListener("click", () => setCount(count() + 1));
})();

// ==============================================================================

// [[ BATCH ]]
// When there are multiple signals in an effect, each of those signals
// runs it's own copy of that effect.
// Wraping the setters in a batch alows that effect to run only once
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
      setPositiveCount(positiveCount() + 1);
      setNegativeCount(negativeCount() - 1);
    });
  });
})();
