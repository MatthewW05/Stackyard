export const OPEN_PREVIEW_MESSAGE = 'stackyard:open-preview' as const;

export interface OpenPreviewMessage {
  type: typeof OPEN_PREVIEW_MESSAGE;
  url: string;
}
