import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AccountingEntry {
  id: string;
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

export function useCloudData(walletAddress: string | null) {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch data from cloud
  const fetchData = useCallback(async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    try {
      const [entriesResult, paymentsResult] = await Promise.all([
        supabase
          .from('accounting_entries')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('created_at', { ascending: false })
      ]);

      if (entriesResult.error) throw entriesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setEntries(entriesResult.data || []);
      setPayments((paymentsResult.data || []) as Payment[]);
    } catch (error) {
      console.error('Error fetching cloud data:', error);
      // Fallback to localStorage
      const storedEntries = localStorage.getItem(`comptara_entries_${walletAddress}`);
      const storedPayments = localStorage.getItem(`comptara_payments_${walletAddress}`);
      if (storedEntries) setEntries(JSON.parse(storedEntries));
      if (storedPayments) setPayments(JSON.parse(storedPayments));
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Add entry to cloud
  const addEntry = useCallback(async (entry: Omit<AccountingEntry, 'id' | 'created_at' | 'updated_at'>) => {
    if (!walletAddress) return null;

    try {
      const { data, error } = await supabase
        .from('accounting_entries')
        .insert({
          ...entry,
          wallet_address: walletAddress
        })
        .select()
        .single();

      if (error) throw error;

      setEntries(prev => [data, ...prev]);
      
      // Also save to localStorage as backup
      const updatedEntries = [data, ...entries];
      localStorage.setItem(`comptara_entries_${walletAddress}`, JSON.stringify(updatedEntries));
      
      return data;
    } catch (error) {
      console.error('Error adding entry:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder l\'écriture',
        variant: 'destructive'
      });
      return null;
    }
  }, [walletAddress, entries, toast]);

  // Add payment to cloud
  const addPayment = useCallback(async (payment: Omit<Payment, 'id' | 'created_at'>) => {
    if (!walletAddress) return null;

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...payment,
          wallet_address: walletAddress
        })
        .select()
        .single();

      if (error) throw error;

      const typedData = data as Payment;
      setPayments(prev => [typedData, ...prev]);
      
      // Also save to localStorage as backup
      const updatedPayments = [typedData, ...payments];
      localStorage.setItem(`comptara_payments_${walletAddress}`, JSON.stringify(updatedPayments));
      
      return data;
    } catch (error) {
      console.error('Error adding payment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le paiement',
        variant: 'destructive'
      });
      return null;
    }
  }, [walletAddress, payments, toast]);

  // Load data when wallet connects
  useEffect(() => {
    if (walletAddress) {
      fetchData();
    } else {
      setEntries([]);
      setPayments([]);
    }
  }, [walletAddress, fetchData]);

  return {
    entries,
    payments,
    isLoading,
    addEntry,
    addPayment,
    refreshData: fetchData
  };
}
