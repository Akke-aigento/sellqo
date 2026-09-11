CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_keywords_uniq
  ON public.ads_bolcom_keywords (tenant_id, adgroup_id, keyword, match_type);

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_targeting_products_uniq
  ON public.ads_bolcom_targeting_products (tenant_id, adgroup_id, ean);

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_search_terms_uniq
  ON public.ads_bolcom_search_terms (tenant_id, campaign_id, adgroup_id, search_term, date)
  NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_performance_uniq
  ON public.ads_bolcom_performance (tenant_id, campaign_id, adgroup_id, keyword_id, date)
  NULLS NOT DISTINCT;