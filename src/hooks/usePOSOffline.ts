import { useState, useEffect, useCallback, useRef } from 'react';
import type { POSCartItem, POSPayment, POSTransaction } from '@/types/pos';

// IndexedDB database name and version
const DB_NAME = 'sellqo_pos_offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_transactions';

export interface OfflineTransaction {
  id: string;
  terminalId: string;
  sessionId: string | null;
  tenantId: string;
  cashierId: string;
  customerId?: string;
  items: POSCartItem[];
  payments: POSPayment[];
  cashReceived?: number;
  cashChange?: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  createdOfflineAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  syncError?: string;
}

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for offline transactions
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('terminalId', 'terminalId', { unique: false });
        store.createIndex('createdOfflineAt', 'createdOfflineAt', { unique: false });
      }
    };
  });
}

// Get all pending transactions
async function getPendingTransactions(): Promise<OfflineTransaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('syncStatus');
    const request = index.getAll(IDBKeyRange.only('pending'));
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get all transactions for a terminal
async function getTerminalTransactions(terminalId: string): Promise<OfflineTransaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('terminalId');
    const request = index.getAll(IDBKeyRange.only(terminalId));
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Save transaction to IndexedDB
async function saveOfflineTransaction(txn: OfflineTransaction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(txn);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Update transaction sync status
async function updateTransactionStatus(
  id: string,
  status: OfflineTransaction['syncStatus'],
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const txn = getRequest.result as OfflineTransaction;
      if (!txn) {
        resolve();
        return;
      }
      
      txn.syncStatus = status;
      txn.syncAttempts = (txn.syncAttempts || 0) + (status === 'syncing' ? 1 : 0);
      if (error) txn.syncError = error;
      
      const putRequest = store.put(txn);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
  });
}

// Delete synced transaction
async function deleteTransaction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Count pending transactions
async function countPending(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('syncStatus');
    const request = index.count(IDBKeyRange.only('pending'));
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export interface UsePOSOfflineOptions {
  terminalId?: string;
  tenantId?: string;
  userId?: string;
  onSyncTransaction?: (txn: OfflineTransaction) => Promise<POSTransaction | null>;
  enabled?: boolean;
}

export function usePOSOffline(options: UsePOSOfflineOptions) {
  const { terminalId, tenantId, userId, onSyncTransaction, enabled = true } = options;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await countPending();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to count pending transactions:', error);
    }
  }, []);

  // Save transaction for offline processing
  const saveForOffline = useCallback(async (data: {
    items: POSCartItem[];
    payments: POSPayment[];
    sessionId: string | null;
    cashReceived?: number;
    cashChange?: number;
    customerId?: string;
  }): Promise<OfflineTransaction | null> => {
    if (!terminalId || !tenantId || !userId) return null;

    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountTotal = data.items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = data.items.reduce(
      (sum, item) => sum + (item.price * item.quantity - item.discount) * (item.tax_rate / 100),
      0
    );
    const total = subtotal - discountTotal + taxTotal;

    const offlineTxn: OfflineTransaction = {
      id: crypto.randomUUID(),
      terminalId,
      sessionId: data.sessionId,
      tenantId,
      cashierId: userId,
      customerId: data.customerId,
      items: data.items,
      payments: data.payments,
      cashReceived: data.cashReceived,
      cashChange: data.cashChange,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      createdOfflineAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncAttempts: 0,
    };

    try {
      await saveOfflineTransaction(offlineTxn);
      await refreshPendingCount();
      return offlineTxn;
    } catch (error) {
      console.error('Failed to save offline transaction:', error);
      return null;
    }
  }, [terminalId, tenantId, userId, refreshPendingCount]);

  // Sync a single transaction
  const syncTransaction = useCallback(async (txn: OfflineTransaction): Promise<boolean> => {
    if (!onSyncTransaction) return false;

    try {
      await updateTransactionStatus(txn.id, 'syncing');
      
      const result = await onSyncTransaction(txn);
      
      if (result) {
        // Successfully synced - delete from IndexedDB
        await deleteTransaction(txn.id);
        return true;
      } else {
        await updateTransactionStatus(txn.id, 'failed', 'Sync returned null');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateTransactionStatus(txn.id, 'failed', errorMessage);
      return false;
    }
  }, [onSyncTransaction]);

  // Sync all pending transactions
  const syncAll = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isSyncing || !isOnline) return { synced: 0, failed: 0 };

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const pending = await getPendingTransactions();
      
      for (const txn of pending) {
        // Skip transactions with too many failed attempts
        if (txn.syncAttempts >= 5) {
          failed++;
          continue;
        }
        
        const success = await syncTransaction(txn);
        if (success) {
          synced++;
        } else {
          failed++;
        }
      }
      
      await refreshPendingCount();
    } catch (error) {
      console.error('Failed to sync transactions:', error);
    } finally {
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [isSyncing, isOnline, syncTransaction, refreshPendingCount]);

  // Get all offline transactions for current terminal
  const getOfflineTransactions = useCallback(async (): Promise<OfflineTransaction[]> => {
    if (!terminalId) return [];
    return getTerminalTransactions(terminalId);
  }, [terminalId]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && enabled && pendingCount > 0) {
      // Delay sync slightly to ensure stable connection
      const timeout = setTimeout(() => {
        syncAll();
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOnline, enabled, pendingCount, syncAll]);

  // Periodic sync check (every 30 seconds)
  useEffect(() => {
    if (!enabled) return;

    // Initial count
    refreshPendingCount();

    syncIntervalRef.current = setInterval(() => {
      refreshPendingCount();
      if (isOnline && pendingCount > 0) {
        syncAll();
      }
    }, 30000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [enabled, isOnline, refreshPendingCount, syncAll, pendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveForOffline,
    syncAll,
    getOfflineTransactions,
    refreshPendingCount,
  };
}
