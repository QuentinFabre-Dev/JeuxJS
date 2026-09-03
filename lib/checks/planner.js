/**
 * Selection of skills + document → list of tasks.
 *
 * This is the function that makes "just spelling" cost what it should: a check
 * nobody selected produces no task, and a task is the only thing that ever
 * costs time or money. It is pure, so the estimate shown before a review and
 * the work actually done cannot drift apart.
 */
import { CHECKS } from './registry.js';

/**
 * @param {object} options
 * @param {string[]} options.skills      selected skill ids
 * @param {number}   options.pageCount   pages in the parsed document
 * @param {number}   [options.pagesPerBatch=1] pages per batch-scoped task
 * @param {object[]} [options.registry]  checks to plan from; defaults to CHECKS
 */
export const planTasks = ({ skills, pageCount, pagesPerBatch = 1, registry = CHECKS }) => {
  const tasks = [];
  const selected = registry.filter((check) =>
    check.skills.some((skill) => skills.includes(skill))
  );

  for (const check of selected) {
    if (check.scope === 'document') {
      tasks.push({ id: check.id, check: check.id, engine: check.engine, scope: 'document' });
      continue;
    }

    const size = Math.max(1, check.pagesPerBatch ?? pagesPerBatch);
    for (let first = 1; first <= pageCount; first += size) {
      const pages = [];
      for (let page = first; page < first + size && page <= pageCount; page += 1) {
        pages.push(page);
      }
      tasks.push({
        id: `${check.id}:${pages[0]}`,
        check: check.id,
        engine: check.engine,
        scope: 'batch',
        pages,
      });
    }
  }

  // Grouping by engine keeps the paying calls together, which is what the
  // concurrency limit and the cost estimate are computed against.
  return tasks.sort((a, b) => a.engine.localeCompare(b.engine) || a.id.localeCompare(b.id));
};

/** How many tasks each engine will run — the basis of the pre-flight estimate. */
export const taskCountByEngine = (tasks) =>
  tasks.reduce((counts, task) => {
    counts[task.engine] = (counts[task.engine] ?? 0) + 1;
    return counts;
  }, {});
