DELETE FROM public.vat_validations
WHERE country_code = 'BE'
  AND is_valid = false
  AND (company_name = '---' OR company_name IS NULL);