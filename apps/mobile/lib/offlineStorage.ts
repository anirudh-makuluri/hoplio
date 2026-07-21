import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAuthUser, ChatMessage, TRoomData } from './types';
import NetInfo from '@react-native-community/netinfo';
import * as messageStore from './db/messageStore';
import type { PendingMessage } from './db/messageStore.types';

export type { PendingMessage };

// Storage keys (prefs / small blobs stay on AsyncStorage)
const STORAGE_KEYS = {
  USER_DATA: 'offline_user_data',
  ROOMS_DATA: 'offline_rooms_data',
  /** @deprecated Migrated to SQLite once; kept only for one-time import. */
  MESSAGES_DATA: 'offline_messages_data',
  LAST_SYNC_TIME: 'last_sync_time',
  /** @deprecated Migrated to SQLite once; kept only for one-time import. */
  OFFLINE_MESSAGES: 'offline_pending_messages',
  IS_OFFLINE_MODE: 'is_offline_mode',
  SQLITE_MIGRATED: 'offline_sqlite_migrated_v1',
};

export interface OfflineUserData {
  user: TAuthUser;
  lastLoginTime: number;
  isOfflineMode: boolean;
}

export interface OfflineRoomData {
  [roomId: string]: TRoomData;
}

export interface OfflineMessageData {
  [roomId: string]: ChatMessage[];
}

class OfflineStorageService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private sqliteReady: Promise<void> | null = null;

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      console.log('Network status changed:', this.isOnline ? 'Online' : 'Offline');
      
      if (this.isOnline && this.syncInProgress === false) {
        this.syncPendingData();
      }
    });
  }

  private async ensureSqliteReady(): Promise<void> {
    if (!this.sqliteReady) {
      this.sqliteReady = this.migrateAsyncStorageMessagesIfNeeded().catch((error) => {
        this.sqliteReady = null;
        throw error;
      });
    }
    await this.sqliteReady;
  }

  private async migrateAsyncStorageMessagesIfNeeded(): Promise<void> {
    try {
      const migrated = await AsyncStorage.getItem(STORAGE_KEYS.SQLITE_MIGRATED);
      if (migrated === '1') {
        return;
      }

      const [messagesDataString, pendingMessagesString] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_MESSAGES),
      ]);

      if (messagesDataString) {
        const messagesData = JSON.parse(messagesDataString) as OfflineMessageData;
        await messageStore.replaceAllMessagesData(messagesData);
      }

      if (pendingMessagesString) {
        const pendingMessages = JSON.parse(pendingMessagesString) as PendingMessage[];
        await messageStore.replacePendingMessages(pendingMessages);
      }

      await AsyncStorage.multiRemove([
        STORAGE_KEYS.MESSAGES_DATA,
        STORAGE_KEYS.OFFLINE_MESSAGES,
      ]);
      await AsyncStorage.setItem(STORAGE_KEYS.SQLITE_MIGRATED, '1');
      console.log('Migrated offline messages from AsyncStorage to SQLite');
    } catch (error) {
      console.error('Failed to migrate offline messages to SQLite:', error);
      // Still mark ready path usable; empty SQLite is better than blocking the app.
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.SQLITE_MIGRATED, '1');
      } catch {
        // ignore
      }
    }
  }

  // User data storage
  async saveUserData(user: TAuthUser): Promise<void> {
    try {
      const offlineUserData: OfflineUserData = {
        user,
        lastLoginTime: Date.now(),
        isOfflineMode: false
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(offlineUserData));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, Date.now().toString());
      console.log('User data saved offline');
    } catch (error) {
      console.error('Failed to save user data offline:', error);
    }
  }

  async getUserData(): Promise<OfflineUserData | null> {
    try {
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userDataString) {
        return JSON.parse(userDataString);
      }
      return null;
    } catch (error) {
      console.error('Failed to get user data from offline storage:', error);
      return null;
    }
  }

  async clearUserData(): Promise<void> {
    try {
      await this.ensureSqliteReady();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.ROOMS_DATA,
        STORAGE_KEYS.MESSAGES_DATA,
        STORAGE_KEYS.OFFLINE_MESSAGES,
      ]);
      await messageStore.clearAllMessageData();
      console.log('User data cleared from offline storage');
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }

  // Room data storage
  async saveRoomsData(rooms: { [roomId: string]: TRoomData }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ROOMS_DATA, JSON.stringify(rooms));
      console.log('Rooms data saved offline');
    } catch (error) {
      console.error('Failed to save rooms data offline:', error);
    }
  }

  async getRoomsData(): Promise<{ [roomId: string]: TRoomData } | null> {
    try {
      const roomsDataString = await AsyncStorage.getItem(STORAGE_KEYS.ROOMS_DATA);
      if (roomsDataString) {
        return JSON.parse(roomsDataString);
      }
      return null;
    } catch (error) {
      console.error('Failed to get rooms data from offline storage:', error);
      return null;
    }
  }

  // Message storage for offline access (SQLite)
  async saveMessagesForRoom(roomId: string, messages: ChatMessage[]): Promise<void> {
    try {
      await this.ensureSqliteReady();
      await messageStore.saveMessagesForRoom(roomId, messages);
      console.log(`Messages saved offline for room ${roomId}`);
    } catch (error) {
      console.error('Failed to save messages offline:', error);
    }
  }

  async getMessagesForRoom(roomId: string): Promise<ChatMessage[] | null> {
    try {
      await this.ensureSqliteReady();
      return await messageStore.getMessagesForRoom(roomId);
    } catch (error) {
      console.error('Failed to get messages from offline storage:', error);
      return null;
    }
  }

  async getAllMessagesData(): Promise<OfflineMessageData> {
    try {
      await this.ensureSqliteReady();
      return await messageStore.getAllMessagesData();
    } catch (error) {
      console.error('Failed to get all messages data:', error);
      return {};
    }
  }

  // Pending messages for when offline (SQLite)
  async savePendingMessage(message: ChatMessage): Promise<void> {
    try {
      await this.ensureSqliteReady();
      await messageStore.savePendingMessage(message);
      console.log('Message saved as pending for offline sync');
    } catch (error) {
      console.error('Failed to save pending message:', error);
    }
  }

  async getPendingMessages(): Promise<PendingMessage[]> {
    try {
      await this.ensureSqliteReady();
      return await messageStore.getPendingMessages();
    } catch (error) {
      console.error('Failed to get pending messages:', error);
      return [];
    }
  }

  async clearPendingMessages(): Promise<void> {
    try {
      await this.ensureSqliteReady();
      await messageStore.clearPendingMessages();
      console.log('Pending messages cleared');
    } catch (error) {
      console.error('Failed to clear pending messages:', error);
    }
  }

  // Offline mode management
  async setOfflineMode(isOffline: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_OFFLINE_MODE, isOffline.toString());
      console.log('Offline mode set to:', isOffline);
    } catch (error) {
      console.error('Failed to set offline mode:', error);
    }
  }

  async isOfflineMode(): Promise<boolean> {
    try {
      const isOfflineString = await AsyncStorage.getItem(STORAGE_KEYS.IS_OFFLINE_MODE);
      return isOfflineString === 'true';
    } catch (error) {
      console.error('Failed to get offline mode status:', error);
      return false;
    }
  }

  // Sync management
  async getLastSyncTime(): Promise<number> {
    try {
      const lastSyncString = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
      return lastSyncString ? parseInt(lastSyncString) : 0;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return 0;
    }
  }

  async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, Date.now().toString());
    } catch (error) {
      console.error('Failed to update last sync time:', error);
    }
  }

  // Network status
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Sync pending data when back online
  async syncPendingData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    console.log('Starting offline data sync...');
    
    try {
      // This would be implemented based on your backend sync requirements
      // For now, we'll just clear pending messages and update sync time
      await this.clearPendingMessages();
      await this.updateLastSyncTime();
      console.log('Offline data sync completed');
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Utility methods
  async getStorageSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  async clearOldData(): Promise<void> {
    try {
      const lastSync = await this.getLastSyncTime();
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (lastSync < oneWeekAgo) {
        await this.clearUserData();
        console.log('Old offline data cleared');
      }
    } catch (error) {
      console.error('Failed to clear old data:', error);
    }
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorageService();
export default offlineStorage;
