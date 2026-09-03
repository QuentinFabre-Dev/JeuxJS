/**
 * Bounded fan-out.
 *
 * Every task is independent, so the fastest review is the one that starts
 * everything at once — but "everything at once" is also how an API answers 429
 * and how a review that would have taken 15 seconds takes two minutes of
 * back-off. The pool keeps a fixed number of tasks in flight and yields each
 * result the moment it lands, in completion order rather than task order.
 *
 * Results are yielded as `{ task, value }` or `{ task, error }`: one failing
 * check must not cancel the twenty that are working.
 */
export async function* runPool(tasks, worker, { concurrency = 12 } = {}) {
  const queue = [...tasks];
  const inFlight = new Map();
  let nextId = 0;

  const launch = () => {
    const task = queue.shift();
    if (!task) return;
    const id = nextId++;
    const promise = Promise.resolve()
      .then(() => worker(task))
      .then(
        (value) => ({ id, task, value }),
        (error) => ({ id, task, error })
      );
    inFlight.set(id, promise);
  };

  for (let i = 0; i < Math.max(1, concurrency); i += 1) launch();

  while (inFlight.size > 0) {
    const settled = await Promise.race(inFlight.values());
    inFlight.delete(settled.id);
    launch();
    yield settled.error
      ? { task: settled.task, error: settled.error }
      : { task: settled.task, value: settled.value };
  }
}
