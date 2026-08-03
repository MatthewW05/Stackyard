export type StatusState = 'loading' | 'done' | 'error';

/**
 * A <p> with a small loading indicator that's only visible while state is
 * 'loading', and a data-state attribute so CSS can flag error text.
 */
export function createStatusLine(): {
  el: HTMLParagraphElement;
  set: (message: string, state: StatusState) => void;
} {
  const el = document.createElement('p');
  el.className = 'status-line';

  const spinner = document.createElement('span');
  spinner.className = 'status-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');

  el.append(spinner, text);

  function set(message: string, state: StatusState): void {
    text.textContent = message;
    el.dataset.state = state;
  }

  return { el, set };
}
