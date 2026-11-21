import { create } from 'zustand';

/** Short, non-blocking status messages ("Saved offline…"). Shown by NoticeHost. */
export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'warning';
}

interface NoticeState {
  notice: Notice | null;
  clear: () => void;
}

let noticeId = 0;

export const useNoticeStore = create<NoticeState>((set) => ({
  notice: null,
  clear: () => set({ notice: null }),
}));

export function showNotice(text: string, tone: Notice['tone'] = 'info'): void {
  useNoticeStore.setState({ notice: { id: ++noticeId, text, tone } });
}
