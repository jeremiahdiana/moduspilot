/**
 * Whether an interactive card was already answered — read off the thread, not
 * held in component state.
 *
 * Every card's answer becomes a real user turn; that IS the contract, so the
 * model receives the choice as ordinary context. Which means the message
 * FOLLOWING a card is already a persisted record of whether it was answered, and
 * it survives reloads, new tabs and other devices.
 *
 * Component state does not: `submitted` reset on every reload, so an
 * already-answered card came back pristine and could be answered a second time,
 * appending a duplicate answer to a question the model had long since moved past.
 *
 * The sentinels below are the exact strings the cards emit. They are a contract
 * between the card, this reader, and the system prompt — change one, change all.
 */

const ANSWER_PREFIX = 'Answering "';
const ANSWER_SEP = '": ';
const DRAFT_MARKER = ' using this direction: ';

/** Drop the "— detail" half of `Label — detail`, matching the card's own chip. */
function shortLabel(answer: string): string {
  const dash = answer.indexOf(' — ');
  return (dash === -1 ? answer : answer.slice(0, dash)).trim();
}

/**
 * The summary label for an answered OptionsCard, or null if the following turn
 * isn't an answer to it (i.e. the user typed something else and moved on).
 */
export function readOptionsAnswer(followingUserText: string | undefined): string | null {
  if (!followingUserText) return null;
  const labels = followingUserText
    .split('\n')
    .filter(line => line.startsWith(ANSWER_PREFIX))
    .map(line => {
      const at = line.indexOf(ANSWER_SEP);
      return at === -1 ? '' : line.slice(at + ANSWER_SEP.length);
    })
    // Multi-select answers arrive as "A — d; B — d".
    .flatMap(answer => answer.split(';').map(shortLabel))
    .filter(Boolean);
  return labels.length > 0 ? labels.join(' · ') : null;
}

/** The chosen direction for an answered DraftOptionsCard, or null. */
export function readDraftAnswer(followingUserText: string | undefined): string | null {
  if (!followingUserText) return null;
  const at = followingUserText.indexOf(DRAFT_MARKER);
  if (at === -1 || !followingUserText.startsWith('Draft my reply')) return null;
  const rest = followingUserText.slice(at + DRAFT_MARKER.length);
  // The card appends a trailing instruction after the direction.
  const end = rest.indexOf('. Write the full email body now.');
  return shortLabel(end === -1 ? rest : rest.slice(0, end)) || null;
}
