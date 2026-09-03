/**
 * Contract check, from the browser's point of view.
 *
 * The statement of work is parsed here like any other document — it never
 * leaves as a file, only as text — and the two documents are sent together to
 * `/api/sow`, which streams the commitments first and their verdicts after.
 */
import { streamReview } from './reviewStream.js';
import { forTransport } from '../../lib/checks/sentences.js';

export const runSowCheck = async ({
  documentModel,
  sowModel,
  language,
  signal,
  onCommitments,
  onVerdict,
  onError,
}) =>
  streamReview(
    {
      documentModel: forTransport(documentModel),
      sowModel: forTransport(sowModel),
      language,
    },
    {
      onPlan: (plan) => onCommitments?.(plan.tasks ?? []),
      onVerdict,
      onError,
    },
    signal,
    '/api/sow'
  );
