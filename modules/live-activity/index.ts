import { requireOptionalNativeModule } from 'expo-modules-core';

export interface TraveletLiveActivityModule {
  isSupported(): boolean;
  areActivitiesEnabled(): boolean;
  isRunning(): boolean;
  syncCatalog(catalogJSON: string): void;
  refresh(): Promise<void>;
  start(categoryIndex: number): Promise<void>;
  stop(): Promise<void>;
}

/** `null` on Android, web, and in Expo Go — every caller must handle that. */
export default requireOptionalNativeModule<TraveletLiveActivityModule>('TraveletLiveActivity');
