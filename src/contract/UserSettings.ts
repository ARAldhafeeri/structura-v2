/**
 * All vs code extension user defined settings in simple interface. 
 */
export interface IUserSettings {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  getAll(): Record<string, any>;
}