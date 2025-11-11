-- This function allows an admin to update specific fields of a contract.
-- To keep it safe and flexible, it accepts a JSONB object with the fields to update.
-- Only whitelisted fields will be updated.

CREATE OR REPLACE FUNCTION public.admin_update_contract(
    _contract_id UUID,
    _updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  update_query TEXT := '';
  allowed_fields TEXT[] := ARRAY['status', 'end_date', 'duration_months', 'months_paid', 'total_profit_paid', 'monthly_rate'];
  field TEXT;
  value_text TEXT;
BEGIN
  -- 1. Authorization: Ensure the caller is an admin.
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
  END IF;

  -- 2. Build the dynamic UPDATE statement
  FOR field IN SELECT key FROM jsonb_each_text(_updates) LOOP
    IF NOT (field = ANY(allowed_fields)) THEN
      RAISE EXCEPTION 'Le champ ''%'' n''est pas autorisé à la mise à jour.', field;
    END IF;

    -- Get the value and quote it properly for the query
    value_text := _updates ->> field;

    -- For numeric fields, don't quote. For others, quote.
    IF field = ANY(ARRAY['duration_months', 'months_paid', 'total_profit_paid', 'monthly_rate']) THEN
       -- Ensure it's a valid number
       IF value_text !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
          RAISE EXCEPTION 'La valeur pour le champ ''%'' doit être un nombre.', field;
       END IF;
       update_query := update_query || format('%I = %s, ', field, value_text);
    ELSE
       -- Quote as a literal for text, dates, etc.
       update_query := update_query || format('%I = %L, ', field, value_text);
    END IF;
  END LOOP;

  -- 3. Check if there is anything to update
  IF update_query = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid fields to update provided.');
  END IF;

  -- Remove the trailing comma and space
  update_query := substr(update_query, 1, length(update_query) - 2);

  -- 4. Execute the final query
  EXECUTE format('UPDATE public.contracts SET %s WHERE id = %L', update_query, _contract_id);

  -- 5. Return success
  RETURN jsonb_build_object('success', true, 'message', 'Contrat mis à jour avec succès.');
END;
$$;
