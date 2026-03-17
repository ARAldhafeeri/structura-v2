/**
 * Custom vs code web view conroller 
 */
export interface IWebviewController {
  postMessage(message: any): void;
  onMessage(callback: (message: any) => void): void;
  show(): void;
  hide(): void;
  isVisible(): boolean;
}

export type ViewportState = { zoom: number; pan: { x: number; y: number } };
