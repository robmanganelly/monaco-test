import { Environment } from 'monaco-editor';

/**
 * Tell TypeScript that window has a MonacoEnvironment property
 */
declare global {
  interface Window {
    MonacoEnvironment?: Environment;
  }
}

window.MonacoEnvironment = {
  getWorkerUrl: (_moduleId: string, label: string) => {
    // Determine the base path (useful if your app is hosted in a subfolder)
    const base = './assets/monaco/vs';

    switch (label) {
      case 'json':
        return `${base}/language/json/json.worker.js`;
      case 'css':
      case 'scss':
      case 'less':
        return `${base}/language/css/css.worker.js`;
      case 'html':
      case 'handlebars':
      case 'razor':
        return `${base}/language/html/html.worker.js`;
      case 'typescript':
      case 'javascript':
        return `${base}/language/typescript/ts.worker.js`;
      default:
        return `${base}/editor/editor.worker.js`;
    }
  },
};