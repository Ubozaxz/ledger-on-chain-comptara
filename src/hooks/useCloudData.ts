import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AccountingEntry {
  id: string;
  user_id?: string | null;
  wallet_address: string;
  date: string;
  libelle: string;
  debit: string;
  credit: string;
  montant: number;
  devise: string;
  tx_hash: string;
  description?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id?: string | null;
  wallet_address: string;
  type: 'paiement' | 'encaissement';
  destinataire: string;
  montant: number;
  devise: string;
  objet: string;
  tx_hash: string;
  status: string;
  created_at: string;
}

interface OfflineEntry {
  type: 'entry' | 'payment';
  data: any;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = 'comptara_offline_queue';

export function useCloudData(walletAddress: string | null, userId: string | null) {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const { toast } = useToast();
  const syncingRef = useRef(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: 'Connexion rétablie', description: 'Synchronisation en cours...' });
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: 'Mode hors-ligne', description: 'Les données seront synchronisées au retour du réseau', variant: 'destructive' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Get offline queue
  const getOfflineQueue = useCallback((): OfflineEntry[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Save to offline queue
  const addToOfflineQueue = useCallback((item: OfflineEntry) => {
    const queue = getOfflineQueue();
    queue.push(item);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    setPendingSync(queue.length);
  }, [getOfflineQueue]);

  // Clear offline queue
  const clearOfflineQueue = useCallback(() => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    setPendingSync(0);
  }, []);

  // Sync offline queue to cloud
  const syncOfflineQueue = useCallback(async () => {
    if (!userId || syncingRef.current) return;
    
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    let successCount = 0;
    const failedItems: OfflineEntry[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'entry') {
          const { error } = await supabase
            .from('accounting_entries')
            .insert({
              ...item.data,
              user_id: userId,
              wallet_address: walletAddress || 'offline',
            });
          if (error) throw error;
          successCount++;
        } else if (item.type === 'payment') {
          const { error } = await supabase
            .from('payments')
            .insert({
              ...item.data,
              user_id: userId,
              wallet_address: walletAddress || 'offline',
            });
          if (error) throw error;
          successCount++;
        }
      } catch (err) {
        console.error('Sync error:', err);
        failedItems.push(item);
      }
    }

    if (failedItems.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedItems));
      setPendingSync(failedItems.length);
    } else {
      clearOfflineQueue();
    }

    if (successCount > 0) {
      toast({ title: 'Synchronisation réussie', description: `${successCount} élément(s) synchronisé(s)` });
      fetchData();
    }

    syncingRef.current = false;
  }, [userId, walletAddress, getOfflineQueue, clearOfflineQueue, toast]);

  // Fetch data from cloud
  const fetchData = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Build query - if wallet connected, filter by wallet; otherwise get all user entries
      let entriesQuery = supabase
        .from('accounting_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      let paymentsQuery = supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (walletAddress) {
        entriesQuery = entriesQuery.eq('wallet_address', walletAddress);
        paymentsQuery = paymentsQuery.eq('wallet_address', walletAddress);
      }

      const [entriesResult, paymentsResult] = await Promise.all([
        entriesQuery,
        paymentsQuery
      ]);

      if (entriesResult.error) throw entriesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setEntries(entriesResult.data || []);
      setPayments((paymentsResult.data || []) as Payment[]);

      // Update pending sync count
      setPendingSync(getOfflineQueue().length);
    } catch (error) {
      console.error('Error fetching cloud data:', error);
      // Fallback to localStorage
      const storageKey = `comptara_cache_${userId}`;
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const { entries: cachedEntries, payments: cachedPayments } = JSON.parse(cached);
        setEntries(cachedEntries || []);
        setPayments(cachedPayments || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, walletAddress, getOfflineQueue]);

  // Add entry to cloud (or offline queue)
  const addEntry = useCallback(async (entry: Omit<AccountingEntry, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'wallet_address'>) => {
    if (!userId) {
      toast({ title: 'Erreur', description: 'Connexion requise', variant: 'destructive' });
      return null;
    }

    const entryData = {
      ...entry,
      user_id: userId,
      wallet_address: walletAddress || 'no-wallet',
    };

    // If offline, add to queue
    if (!isOnline) {
      addToOfflineQueue({ type: 'entry', data: entry, createdAt: new Date().toISOString() });
      
      // Add to local state for immediate feedback
      const localEntry = {
        ...entryData,
        id: `offline_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as AccountingEntry;
      setEntries(prev => [localEntry, ...prev]);
      
      toast({ title: 'Sauvegarde hors-ligne', description: 'Sera synchronisé au retour du réseau' });
      return localEntry;
    }

    try {
      const { data, error } = await supabase
        .from('accounting_entries')
        .insert(entryData)
        .select()
        .single();

      if (error) throw error;

      setEntries(prev => [data, ...prev]);

      // Cache locally
      const storageKey = `comptara_cache_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify({ entries: [data, ...entries], payments }));

      return data;
    } catch (error: any) {
      console.error('Error adding entry:', error);
      
      // Fallback to offline queue
      addToOfflineQueue({ type: 'entry', data: entry, createdAt: new Date().toISOString() });
      
      toast({
        title: 'Sauvegarde locale',
        description: 'Connexion instable, sera synchronisé automatiquement',
        variant: 'destructive'
      });
      return null;
    }
  }, [userId, walletAddress, isOnline, entries, payments, toast, addToOfflineQueue]);

  // Add payment to cloud (or offline queue)
  const addPayment = useCallback(async (payment: Omit<Payment, 'id' | 'created_at' | 'user_id' | 'wallet_address'>) => {
    if (!userId) {
      toast({ title: 'Erreur', description: 'Connexion requise', variant: 'destructive' });
      return null;
    }

    const paymentData = {
      ...payment,
      user_id: userId,
      wallet_address: walletAddress || 'no-wallet',
    };

    // If offline, add to queue
    if (!isOnline) {
      addToOfflineQueue({ type: 'payment', data: payment, createdAt: new Date().toISOString() });
      
      const localPayment = {
        ...paymentData,
        id: `offline_${Date.now()}`,
        created_at: new Date().toISOString(),
      } as Payment;
      setPayments(prev => [localPayment, ...prev]);
      
      toast({ title: 'Sauvegarde hors-ligne', description: 'Sera synchronisé au retour du réseau' });
      return localPayment;
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) throw error;

      const typedData = data as Payment;
      setPayments(prev => [typedData, ...prev]);

      // Cache locally
      const storageKey = `comptara_cache_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify({ entries, payments: [typedData, ...payments] }));

      return data;
    } catch (error: any) {
      console.error('Error adding payment:', error);
      
      addToOfflineQueue({ type: 'payment', data: payment, createdAt: new Date().toISOString() });
      
      toast({
        title: 'Sauvegarde locale',
        description: 'Connexion instable, sera synchronisé automatiquement',
        variant: 'destructive'
      });
      return null;
    }
  }, [userId, walletAddress, isOnline, entries, payments, toast, addToOfflineQueue]);

  // Load data when user connects
  useEffect(() => {
    if (userId) {
      fetchData();
      // Try to sync offline queue
      if (isOnline) {
        syncOfflineQueue();
      }
    } else {
      setEntries([]);
      setPayments([]);
    }
  }, [userId, fetchData, isOnline, syncOfflineQueue]);

  return {
    entries,
    payments,
    isLoading,
    isOnline,
    pendingSync,
    addEntry,
    addPayment,
    refreshData: fetchData,
    syncOfflineQueue
  };
}
