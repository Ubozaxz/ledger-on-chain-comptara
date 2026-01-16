-- Create accounting entries table for cloud persistence
CREATE TABLE public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  libelle TEXT NOT NULL,
  debit TEXT,
  credit TEXT,
  montant DECIMAL(18, 8) NOT NULL,
  devise TEXT DEFAULT 'HBAR',
  tx_hash TEXT,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table for cloud persistence
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paiement', 'encaissement')),
  destinataire TEXT NOT NULL,
  montant DECIMAL(18, 8) NOT NULL,
  devise TEXT DEFAULT 'HBAR',
  objet TEXT,
  tx_hash TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounting_entries (open access by wallet address)
CREATE POLICY "Users can view entries by wallet address"
ON public.accounting_entries
FOR SELECT
USING (true);

CREATE POLICY "Users can create entries"
ON public.accounting_entries
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update entries"
ON public.accounting_entries
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete entries"
ON public.accounting_entries
FOR DELETE
USING (true);

-- RLS policies for payments (open access by wallet address)
CREATE POLICY "Users can view payments by wallet address"
ON public.payments
FOR SELECT
USING (true);

CREATE POLICY "Users can create payments"
ON public.payments
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update payments"
ON public.payments
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete payments"
ON public.payments
FOR DELETE
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_accounting_entries_wallet ON public.accounting_entries(wallet_address);
CREATE INDEX idx_payments_wallet ON public.payments(wallet_address);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_entries_updated_at
BEFORE UPDATE ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();