export const triggerToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
};
