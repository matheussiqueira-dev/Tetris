export {};

declare global {
  interface Window {
    cv?: {
      Mat?: new (...args: unknown[]) => unknown;
      onRuntimeInitialized?: () => void;
      [key: string]: unknown;
    };
  }
}
