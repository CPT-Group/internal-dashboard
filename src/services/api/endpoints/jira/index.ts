/**
 * Jira API – organized fine-tuned calls for widgets and data.
 * Uses the app's /api/jira/search proxy; all NOVA results are filtered to key >= 661.
 */

export { getTicketsTransitionedToday, getTicketsCreatedToday } from './tickets';
export type { TicketsTransitionedTodayResult, TicketsCreatedTodayResult } from './tickets';

export { fetchUpdates } from './updates';
export type { FetchUpdatesResult } from './updates';

export {
  jqlTicketsTransitionedToday,
  jqlTicketsCreatedToday,
  jqlTicketsUpdatedSince,
} from './jql';
