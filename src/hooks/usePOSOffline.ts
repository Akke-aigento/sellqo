import { useState, useEffect, useCallback, useRef } from 'react';
import { calculatePosTotals, type PosCartDiscount } from '@/lib/calculations/posTotals';
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
  /** HORECA-0: wanneer de huidige poging startte (vastgelopen 'syncing' herkennen). */
  syncStartedAt?: string;
  /** HORECA-0: vroegste moment voor een nieuwe poging na een mislukking (backoff). */
  nextRetryAt?: string;
}

// HORECA-0: een verkoop in de wachtrij wordt nooit opgegeven. Vroeger werd een transactie
// na 5 mislukte pogingen definitief overgeslagen ('failed' werd nooit meer opgepakt) en bleef
// een poging die halverwege afbrak (app dicht, crash) eeuwig op 'syncing' staan: geld dat
// stil verdween uit de omzet. Nu: backoff tot max. 5 minuten, en 'syncing' ouder dan 60 s
// gaat terug naar de wachtrij. Dubbel insturen is veilig: de offline-id is de rij-id.
export const STALE_SYNCING_MS = 60_000;
export function retryDelayMs(attempts: number): number {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

/** Moet deze transactie nu (opnieuw) verstuurd worden? Puur, voor tests. */
export function isDueForSync(txn: OfflineTransaction, now: number): boolean {
  if (txn.syncStatus === 'pending') return true;
  if (txn.syncStatus === 'failed') return !txn.nextRetryAt || Date.parse(txn.nextRetryAt) <= now;
  if (txn.syncStatus === 'syncing') {
    const started = txn.syncStartedAt ? Date.parse(txn.syncStartedAt) : 0;
    return now - started > STALE_SYNCING_MS;
  }
  return false;
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

// Alle nog niet verstuurde transacties (pending, failed én syncing), oudste eerst.
async function getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(
      (request.result as OfflineTransaction[])
        .filter((t) => t.syncStatus !== 'synced')
        .sort((a, b) => a.createdOfflineAt.localeCompare(b.createdOfflineAt)),
    );
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
      if (status === 'syncing') txn.syncStartedAt = new Date().toISOString();
      if (status === 'failed') txn.nextRetryAt = new Date(Date.now() + retryDelayMs(txn.syncAttempts)).toISOString();
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

// Tel wat nog niet verstuurd is; 'failed' apart zodat de kassa het rood kan tonen.
async function countUnsynced(): Promise<{ pending: number; failed: number }> {
  const all = await getUnsyncedTransactions();
  return {
    pending: all.length,
    failed: all.filter((t) => t.syncStatus === 'failed').length,
  };
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
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
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
      const { pending, failed } = await countUnsynced();
      setPendingCount(pending);
      setFailedCount(failed);
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
    /** HORECA-0: id die online al geprobeerd werd (zie createTransaction.clientId). */
    clientId?: string;
    /** APP-CLEAN-3c: zelfde invoer als online (calculatePosTotals). */
    cartDiscount?: PosCartDiscount | null;
    vatHandling?: string | null;
  }): Promise<OfflineTransaction | null> => {
    if (!terminalId || !tenantId || !userId) return null;

    // APP-CLEAN-3c: offline rekende btw altijd BOVENOP de prijs (price × rate) en
    // negeerde de mandkorting, terwijl de kassa standaard inclusieve prijzen toont.
    // Een offline verkoop werd zo met een te hoog totaal geregistreerd. Nu exact
    // dezelfde berekening als online en als het scherm.
    const totals = calculatePosTotals(data.items, data.cartDiscount ?? null, data.vatHandling || 'inclusive');
    const subtotal = totals.subtotal;
    const discountTotal = totals.discount;
    const taxTotal = totals.taxTotal;
    const total = totals.total;

    const offlineTxn: OfflineTransaction = {
      id: data.clientId ?? crypto.randomUUID(),
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

  // Sync all unsynced transactions that are due (pending, failed past backoff, stale syncing)
  const syncAll = useCallback(async (opts?: { force?: boolean }): Promise<{ synced: number; failed: number }> => {
    // Ref i.p.v. state: twee timers in dezelfde tick mogen niet allebei starten.
    if (syncingRef.current || !isOnline) return { synced: 0, failed: 0 };
    syncingRef.current = true;
    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const now = Date.now();
      const due = (await getUnsyncedTransactions()).filter((t) =>
        // Handmatig "nu versturen" slaat de backoff over, maar nooit een poging die nog loopt.
        opts?.force ? t.syncStatus !== 'syncing' || isDueForSync(t, now) : isDueForSync(t, now),
      );
      
      for (const txn of due) {
        const success = await syncTransaction(txn);
        if (success) {
          synced++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.error('Failed to sync transactions:', error);
    } finally {
      await refreshPendingCount();
      syncingRef.current = false;
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [isOnline, syncTransaction, refreshPendingCount]);

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
      void refreshPendingCount();
      if (isOnline && pendingCount > 0) {
        void syncAll();
      }
    }, 15000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [enabled, isOnline, refreshPendingCount, syncAll, pendingCount]);

  return {
    isOnline,
    pendingCount,
    failedCount,
    isSyncing,
    saveForOffline,
    syncAll,
    getOfflineTransactions,
    refreshPendingCount,
  };
}
