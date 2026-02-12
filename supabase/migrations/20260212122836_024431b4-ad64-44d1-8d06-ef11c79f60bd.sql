-- Insert seed data for channel_field_mappings
INSERT INTO public.channel_field_mappings (channel_type, channel_category, sellqo_field, channel_field, channel_field_label, is_required, transform_rule, field_group, sort_order, is_active) VALUES
-- BOL.COM MAPPINGS
('bol_com', NULL, 'specs.upc', 'ean', 'EAN Code', true, NULL, 'identification', 1, true),
('bol_com', NULL, 'specs.brand', 'brand', 'Brand', true, NULL, 'identification', 2, true),
('bol_com', NULL, 'specs.material', 'material', 'Material', false, NULL, 'material', 1, true),
('bol_com', NULL, 'specs.length_cm', 'packageDimensions.length', 'Package Length (cm)', false, '{"type":"unit_conversion","from_unit":"cm","to_unit":"cm","conversion_factor":1}', 'logistics', 1, true),
('bol_com', NULL, 'specs.width_cm', 'packageDimensions.width', 'Package Width (cm)', false, '{"type":"unit_conversion","from_unit":"cm","to_unit":"cm","conversion_factor":1}', 'logistics', 2, true),
('bol_com', NULL, 'specs.height_cm', 'packageDimensions.height', 'Package Height (cm)', false, '{"type":"unit_conversion","from_unit":"cm","to_unit":"cm","conversion_factor":1}', 'logistics', 3, true),
('bol_com', NULL, 'specs.package_weight_kg', 'packageWeight', 'Package Weight (kg)', false, '{"type":"unit_conversion","from_unit":"kg","to_unit":"kg","conversion_factor":1}', 'logistics', 4, true),
('bol_com', NULL, 'specs.is_fragile', 'fragile', 'Fragile', false, NULL, 'logistics', 5, true),
('bol_com', NULL, 'specs.country_of_origin', 'countryOfOrigin', 'Country of Origin', false, NULL, 'identification', 3, true),

-- AMAZON MAPPINGS
('amazon', NULL, 'specs.upc', 'GTIN', 'GTIN/UPC', true, NULL, 'identification', 1, true),
('amazon', NULL, 'specs.brand', 'Brand', 'Brand', true, NULL, 'identification', 2, true),
('amazon', NULL, 'specs.material', 'Material', 'Material Type', false, NULL, 'material', 1, true),
('amazon', NULL, 'specs.color', 'Color', 'Color', false, NULL, 'material', 2, true),
('amazon', NULL, 'specs.length_cm', 'Length', 'Item Length (cm)', false, '{"type":"unit_conversion","from_unit":"cm","to_unit":"cm","conversion_factor":1}', 'logistics', 1, true),
('amazon', NULL, 'specs.weight_kg', 'Weight', 'Item Weight (kg)', false, '{"type":"unit_conversion","from_unit":"kg","to_unit":"kg","conversion_factor":1}', 'logistics', 2, true),
('amazon', NULL, 'specs.is_hazardous', 'Hazardous', 'Hazardous Material', false, NULL, 'compliance', 1, true),

-- SHOPIFY MAPPINGS
('shopify', NULL, 'specs.barcode', 'barcode', 'Barcode', false, NULL, 'identification', 1, true),
('shopify', NULL, 'specs.brand', 'vendor', 'Vendor (Brand)', false, NULL, 'identification', 2, true),
('shopify', NULL, 'specs.material', 'material', 'Material', false, NULL, 'material', 1, true),
('shopify', NULL, 'specs.color', 'color', 'Color', false, NULL, 'material', 2, true),
('shopify', NULL, 'specs.weight_kg', 'weight', 'Weight (kg)', false, '{"type":"unit_conversion","from_unit":"kg","to_unit":"kg","conversion_factor":1}', 'logistics', 1, true),
('shopify', NULL, 'specs.country_of_origin', 'country_code_of_origin', 'Country of Origin', false, NULL, 'identification', 3, true),

-- WOOCOMMERCE MAPPINGS
('woocommerce', NULL, 'specs.upc', 'upc', 'UPC Code', false, NULL, 'identification', 1, true),
('woocommerce', NULL, 'specs.brand', 'brand', 'Brand', false, NULL, 'identification', 2, true),
('woocommerce', NULL, 'specs.material', 'material', 'Material', false, NULL, 'material', 1, true),
('woocommerce', NULL, 'specs.color', 'color', 'Color', false, NULL, 'material', 2, true),
('woocommerce', NULL, 'specs.weight_kg', 'weight', 'Weight (kg)', false, '{"type":"unit_conversion","from_unit":"kg","to_unit":"kg","conversion_factor":1}', 'logistics', 1, true),

-- EBAY MAPPINGS
('ebay', NULL, 'specs.upc', 'upc', 'UPC/EAN', false, NULL, 'identification', 1, true),
('ebay', NULL, 'specs.brand', 'brand', 'Brand', false, NULL, 'identification', 2, true),
('ebay', NULL, 'specs.mpn', 'mpn', 'Manufacturer Part Number', false, NULL, 'identification', 3, true),
('ebay', NULL, 'specs.color', 'color', 'Color', false, NULL, 'material', 1, true),
('ebay', NULL, 'specs.weight_kg', 'weight', 'Weight (kg)', false, '{"type":"unit_conversion","from_unit":"kg","to_unit":"kg","conversion_factor":1}', 'logistics', 1, true),
('ebay', NULL, 'specs.country_of_origin', 'country', 'Country of Origin', false, NULL, 'identification', 4, true)
ON CONFLICT DO NOTHING;