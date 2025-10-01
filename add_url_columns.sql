-- Add category_url and product_url columns to sites table if they don't exist
-- This is safe to run multiple times

DO $$
BEGIN
    -- Add category_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'sites'
        AND column_name = 'category_url'
    ) THEN
        ALTER TABLE public.sites ADD COLUMN category_url VARCHAR;
        RAISE NOTICE 'Added category_url column';
    ELSE
        RAISE NOTICE 'category_url column already exists';
    END IF;

    -- Add product_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'sites'
        AND column_name = 'product_url'
    ) THEN
        ALTER TABLE public.sites ADD COLUMN product_url VARCHAR;
        RAISE NOTICE 'Added product_url column';
    ELSE
        RAISE NOTICE 'product_url column already exists';
    END IF;
END $$;
