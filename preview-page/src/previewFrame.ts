/**
 * A live-preview iframe wrapped in a small toolbar with an Expand toggle.
 * Expanded mode isn't the real Fullscreen API - just a fixed overlay that
 * fills the viewport - so it works the same in both the dev-server and
 * static-file preview flows without needing a user gesture at toggle time.
 */
export function createPreviewFrame(): {
  wrapper: HTMLDivElement;
  show: (url: string) => void;
} {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-frame-wrapper';

  const toolbar = document.createElement('div');
  toolbar.className = 'preview-frame-toolbar';

  const expandButton = document.createElement('button');
  expandButton.type = 'button';
  expandButton.className = 'btn btn-secondary';

  function setExpanded(expanded: boolean): void {
    wrapper.classList.toggle('is-expanded', expanded);
    expandButton.textContent = expanded ? 'Collapse' : 'Expand';
    expandButton.setAttribute(
      'aria-label',
      expanded ? 'Collapse preview' : 'Expand preview to fill the page',
    );
    document.body.style.overflow = expanded ? 'hidden' : '';
  }
  setExpanded(false);

  expandButton.addEventListener('click', () => {
    setExpanded(!wrapper.classList.contains('is-expanded'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wrapper.classList.contains('is-expanded')) {
      setExpanded(false);
    }
  });

  toolbar.append(expandButton);

  const iframe = document.createElement('iframe');
  iframe.className = 'preview-frame';

  wrapper.append(toolbar, iframe);

  function show(url: string): void {
    iframe.src = url;
    wrapper.classList.add('is-visible');
  }

  return { wrapper, show };
}
