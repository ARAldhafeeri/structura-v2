/**
 * Event for file change
 */
export type FileChangeEvent = { type: 'created' | 'changed' | 'deleted'; filePath: string; timestamp: number };
