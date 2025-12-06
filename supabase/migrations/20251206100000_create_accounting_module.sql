-- Create company_accounts table
CREATE TABLE IF NOT EXISTS public.company_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    balance NUMERIC(20, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create accounting_entries table (Ledger)
CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date TIMESTAMPTZ DEFAULT now(),
    description TEXT NOT NULL,
    debit_account_id UUID REFERENCES public.company_accounts(id) ON DELETE RESTRICT,
    credit_account_id UUID REFERENCES public.company_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
    related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create payment_batches table
CREATE TABLE IF NOT EXISTS public.payment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'cancelled')),
    total_amount NUMERIC(20, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create payment_batch_items table
CREATE TABLE IF NOT EXISTS public.payment_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.payment_batches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(20, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_batch_items ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (Admin Only)
CREATE POLICY "Admins can view company accounts" ON public.company_accounts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage company accounts" ON public.company_accounts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view accounting entries" ON public.accounting_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage accounting entries" ON public.accounting_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view payment batches" ON public.payment_batches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage payment batches" ON public.payment_batches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view payment batch items" ON public.payment_batch_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage payment batch items" ON public.payment_batch_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Seed Initial Accounts
INSERT INTO public.company_accounts (name, type, balance) VALUES
('Banque Principale', 'asset', 0),
('Portefeuille Crypto', 'asset', 0),
('Dépôts Clients', 'liability', 0),
('Dettes Retraits', 'liability', 0),
('Revenus Frais', 'revenue', 0),
('Pertes', 'expense', 0)
ON CONFLICT (name) DO NOTHING;

-- Function to generate batch number
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
BEGIN
    SELECT 'BATCH-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((count(*) + 1)::text, 3, '0')
    INTO new_number
    FROM public.payment_batches
    WHERE created_at::date = now()::date;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;
