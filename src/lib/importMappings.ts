import type { FieldMapping, FieldMappingItem } from '@/types/import';

// ============================================================================
// SHOPIFY CUSTOMER MAPPING - All 45+ fields from Shopify export
// ============================================================================
export const SHOPIFY_CUSTOMER_MAPPING: FieldMapping = {
  // Core customer fields
  'Customer ID': { target: 'shopify_customer_id', transform: 'string' },
  'First Name': { target: 'first_name' },
  'Last Name': { target: 'last_name' },
  'Email': { target: 'email', required: true, validate: 'email' },
  'Phone': { target: 'phone', transform: 'phone' },
  'Note': { target: 'notes' },
  'Tags': { target: 'tags', transform: 'tagArray' },
  'Tax Exempt': { target: 'tax_exempt', transform: 'yesNo' },
  
  // Marketing consent
  'Accepts Email Marketing': { target: 'email_subscribed', transform: 'yesNo' },
  'Accepts SMS Marketing': { target: 'sms_subscribed', transform: 'yesNo' },
  
  // Default Address fields - complete mapping
  'Default Address Company': { target: 'company_name' },
  'Default Address Address1': { target: 'billing_street' },
  'Default Address Address2': { target: 'raw_import_data', transform: 'jsonString:address2' },
  'Default Address City': { target: 'billing_city' },
  'Default Address Province Code': { target: 'province_code' },
  'Default Address Country Code': { target: 'billing_country', transform: 'countryCode' },
  'Default Address Zip': { target: 'billing_postal_code' },
  'Default Address Phone': { target: 'phone', fallback: true, transform: 'phone' },
  
  // Customer stats
  'Total Spent': { target: 'total_spent', transform: 'decimal' },
  'Total Orders': { target: 'total_orders', transform: 'number' },
  
  // Klaviyo and other metafields - all go to raw_import_data
  'language_preference (customer.metafields.customer.language_preference)': { target: 'raw_import_data', transform: 'jsonString:language_preference' },
  'Birth date (customer.metafields.facts.birth_date)': { target: 'raw_import_data', transform: 'jsonString:birth_date' },
  'Birthday (customer.metafields.klaviyo.birthday)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_birthday' },
  'Birthday (customer.metafields.klaviyo.birthday) (customer.metafields.klaviyo.birthday__customer_metafields_klaviyo_birthday_)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_birthday_alt' },
  'Created (customer.metafields.klaviyo.created)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_created' },
  'Customer ID (customer.metafields.klaviyo.customer_id)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_customer_id' },
  'First Active (customer.metafields.klaviyo.first_active)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_first_active' },
  'first_event_date (customer.metafields.klaviyo.first_event_date)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_first_event_date' },
  'has_received_welcome_flow (customer.metafields.klaviyo.has_received_welcome_flow)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_welcome_flow' },
  'Initial Referring Domain (customer.metafields.klaviyo.initial_referring_domain)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_initial_domain' },
  'Initial Source (customer.metafields.klaviyo.initial_source)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_initial_source' },
  'Last Active (customer.metafields.klaviyo.last_active)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_last_active' },
  'Last Referring Domain (customer.metafields.klaviyo.last_referring_domain)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_last_domain' },
  'Last Source (customer.metafields.klaviyo.last_source)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_last_source' },
  'Locale (customer.metafields.klaviyo.locale)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_locale' },
  'Locale: Country (customer.metafields.klaviyo.locale__country)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_locale_country' },
  'Locale: Language (customer.metafields.klaviyo.locale__language)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_locale_language' },
  'Phone (customer.metafields.klaviyo.phone)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_phone' },
  'Tax Exempt (customer.metafields.klaviyo.tax_exempt)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_tax_exempt' },
  'Total Orders (customer.metafields.klaviyo.total_orders)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_total_orders' },
  'Total Spent (customer.metafields.klaviyo.total_spent)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_total_spent' },
  'Unique ID (customer.metafields.klaviyo.unique_id)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_unique_id' },
  '$latitude (customer.metafields.klaviyo._latitude)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_latitude' },
  '$longitude (customer.metafields.klaviyo._longitude)': { target: 'raw_import_data', transform: 'jsonString:klaviyo_longitude' },
};

// ============================================================================
// SHOPIFY PRODUCT MAPPING - All 64+ fields from Shopify export
// ============================================================================
export const SHOPIFY_PRODUCT_MAPPING: FieldMapping = {
  // Core product fields
  'Handle': { target: 'slug', required: true },
  'Title': { target: 'name', required: true },
  'Body (HTML)': { target: 'description', transform: 'html' },
  'Vendor': { target: 'vendor' },
  'Product Category': { target: 'google_product_category' },
  'Type': { target: 'original_category_value' },
  'Tags': { target: 'tags', transform: 'tagArray' },
  'Published': { target: 'is_active', transform: 'yesNo' },
  'Status': { target: 'is_active', transform: 'shopifyProductStatus' },
  
  // Options (for variant info - store in raw_import_data)
  'Option1 Name': { target: 'raw_import_data', transform: 'jsonString:option1_name' },
  'Option1 Value': { target: 'raw_import_data', transform: 'jsonString:option1_value' },
  'Option1 Linked To': { target: 'raw_import_data', transform: 'jsonString:option1_linked' },
  'Option2 Name': { target: 'raw_import_data', transform: 'jsonString:option2_name' },
  'Option2 Value': { target: 'raw_import_data', transform: 'jsonString:option2_value' },
  'Option2 Linked To': { target: 'raw_import_data', transform: 'jsonString:option2_linked' },
  'Option3 Name': { target: 'raw_import_data', transform: 'jsonString:option3_name' },
  'Option3 Value': { target: 'raw_import_data', transform: 'jsonString:option3_value' },
  'Option3 Linked To': { target: 'raw_import_data', transform: 'jsonString:option3_linked' },
  
  // Variant fields
  'Variant SKU': { target: 'sku' },
  'Variant Grams': { target: 'weight', transform: 'gramsToKg' },
  'Variant Inventory Tracker': { target: 'raw_import_data', transform: 'jsonString:inventory_tracker' },
  'Variant Inventory Qty': { target: 'stock', transform: 'number' },
  'Variant Inventory Policy': { target: 'raw_import_data', transform: 'jsonString:inventory_policy' },
  'Variant Fulfillment Service': { target: 'raw_import_data', transform: 'jsonString:fulfillment_service' },
  'Variant Price': { target: 'price', transform: 'decimal' },
  'Variant Compare At Price': { target: 'compare_at_price', transform: 'decimal' },
  'Variant Requires Shipping': { target: 'requires_shipping', transform: 'yesNo' },
  'Variant Taxable': { target: 'taxable', transform: 'yesNo' },
  'Variant Barcode': { target: 'barcode' },
  'Variant Image': { target: 'images', transform: 'imageArray' },
  'Variant Weight Unit': { target: 'variant_weight_unit' },
  'Variant Tax Code': { target: 'raw_import_data', transform: 'jsonString:variant_tax_code' },
  
  // Unit pricing
  'Unit Price Total Measure': { target: 'raw_import_data', transform: 'jsonString:unit_price_measure' },
  'Unit Price Total Measure Unit': { target: 'raw_import_data', transform: 'jsonString:unit_price_measure_unit' },
  'Unit Price Base Measure': { target: 'raw_import_data', transform: 'jsonString:unit_price_base_measure' },
  'Unit Price Base Measure Unit': { target: 'raw_import_data', transform: 'jsonString:unit_price_base_unit' },
  
  // Images
  'Image Src': { target: 'images', transform: 'imageArray' },
  'Image Position': { target: 'raw_import_data', transform: 'jsonString:image_position' },
  'Image Alt Text': { target: 'raw_import_data', transform: 'jsonString:image_alt_text' },
  
  // SEO
  'SEO Title': { target: 'meta_title' },
  'SEO Description': { target: 'meta_description' },
  
  // Cost and misc
  'Cost per item': { target: 'cost_price', transform: 'decimal' },
  'Gift Card': { target: 'gift_card', transform: 'yesNo' },
  
  // Product metafields - all to raw_import_data
  'Product rating count (product.metafields.reviews.rating_count)': { target: 'raw_import_data', transform: 'jsonString:rating_count' },
  'Battery features (product.metafields.shopify.battery-features)': { target: 'raw_import_data', transform: 'jsonString:battery_features' },
  'Battery size (product.metafields.shopify.battery-size)': { target: 'raw_import_data', transform: 'jsonString:battery_size' },
  'Battery technology (product.metafields.shopify.battery-technology)': { target: 'raw_import_data', transform: 'jsonString:battery_technology' },
  'Battery type (product.metafields.shopify.battery-type)': { target: 'raw_import_data', transform: 'jsonString:battery_type' },
  'Connection type (product.metafields.shopify.connection-type)': { target: 'raw_import_data', transform: 'jsonString:connection_type' },
  'Item condition (product.metafields.shopify.item-condition)': { target: 'raw_import_data', transform: 'jsonString:item_condition' },
  'Manufacturer type (product.metafields.shopify.manufacturer-type)': { target: 'raw_import_data', transform: 'jsonString:manufacturer_type' },
  'Operating system (product.metafields.shopify.operating-system)': { target: 'raw_import_data', transform: 'jsonString:operating_system' },
  'Outlet type (product.metafields.shopify.outlet-type)': { target: 'raw_import_data', transform: 'jsonString:outlet_type' },
  'Plug type (input) (product.metafields.shopify.plug-type-input)': { target: 'raw_import_data', transform: 'jsonString:plug_type_input' },
  'Plug type (output) (product.metafields.shopify.plug-type-output)': { target: 'raw_import_data', transform: 'jsonString:plug_type_output' },
  'Portability (product.metafields.shopify.portability)': { target: 'raw_import_data', transform: 'jsonString:portability' },
  'Power source (product.metafields.shopify.power-source)': { target: 'raw_import_data', transform: 'jsonString:power_source' },
  'Product certifications & standards (product.metafields.shopify.product-certifications-standards)': { target: 'raw_import_data', transform: 'jsonString:certifications' },
  'Socket type (product.metafields.shopify.socket-type)': { target: 'raw_import_data', transform: 'jsonString:socket_type' },
  'Suitable space (product.metafields.shopify.suitable-space)': { target: 'raw_import_data', transform: 'jsonString:suitable_space' },
  'Wire/Rope material (product.metafields.shopify.wire-rope-material)': { target: 'raw_import_data', transform: 'jsonString:wire_material' },

  // Clothing & Fashion metafields — mapped to product_specifications and product_custom_specs
  // Direct spec mappings (columns exist in product_specifications table)
  'Color (product.metafields.shopify.color-pattern)': { target: '_spec_color' },
  'Size (product.metafields.shopify.size)': { target: '_spec_size' },
  'Fabric (product.metafields.shopify.fabric)': { target: '_spec_material' },
  'Material (product.metafields.shopify.material)': { target: '_spec_material' },
  'Care instructions (product.metafields.shopify.care-instructions)': { target: '_spec_storage_instructions' },

  // Custom spec mappings (go to product_custom_specs with group "Kleding")
  'Accessory size (product.metafields.shopify.accessory-size)': { target: '_custom_spec_Kleding_accessory_size' },
  'Activewear clothing features (product.metafields.shopify.activewear-clothing-features)': { target: '_custom_spec_Kleding_activewear_features' },
  'Activity (product.metafields.shopify.activity)': { target: '_custom_spec_Kleding_activity' },
  'Age group (product.metafields.shopify.age-group)': { target: '_custom_spec_Kleding_age_group' },
  'Bag/Case features (product.metafields.shopify.bag-case-features)': { target: '_custom_spec_Kleding_bag_case_features' },
  'Bag/Case material (product.metafields.shopify.bag-case-material)': { target: '_custom_spec_Kleding_bag_case_material' },
  'Bag/Case storage features (product.metafields.shopify.bag-case-storage-features)': { target: '_custom_spec_Kleding_bag_case_storage' },
  'Carry options (product.metafields.shopify.carry-options)': { target: '_custom_spec_Kleding_carry_options' },
  'Closure type (product.metafields.shopify.closure-type)': { target: '_custom_spec_Kleding_closure_type' },
  'Clothing accessory material (product.metafields.shopify.clothing-accessory-material)': { target: '_custom_spec_Kleding_clothing_accessory_material' },
  'Clothing features (product.metafields.shopify.clothing-features)': { target: '_custom_spec_Kleding_clothing_features' },
  'Fit (product.metafields.shopify.fit)': { target: '_custom_spec_Kleding_fit' },
  'Footwear material (product.metafields.shopify.footwear-material)': { target: '_custom_spec_Kleding_footwear_material' },
  'Headwear features (product.metafields.shopify.headwear-features)': { target: '_custom_spec_Kleding_headwear_features' },
  'Neckline (product.metafields.shopify.neckline)': { target: '_custom_spec_Kleding_neckline' },
  'Outerwear clothing features (product.metafields.shopify.outerwear-clothing-features)': { target: '_custom_spec_Kleding_outerwear_features' },
  'Pants length type (product.metafields.shopify.pants-length-type)': { target: '_custom_spec_Kleding_pants_length' },
  'Shoe features (product.metafields.shopify.shoe-features)': { target: '_custom_spec_Kleding_shoe_features' },
  'Shoe fit (product.metafields.shopify.shoe-fit)': { target: '_custom_spec_Kleding_shoe_fit' },
  'Sleeve length type (product.metafields.shopify.sleeve-length-type)': { target: '_custom_spec_Kleding_sleeve_length' },
  'Sneaker style (product.metafields.shopify.sneaker-style)': { target: '_custom_spec_Kleding_sneaker_style' },
  'Target gender (product.metafields.shopify.target-gender)': { target: '_custom_spec_Kleding_target_gender' },
  'Toe style (product.metafields.shopify.toe-style)': { target: '_custom_spec_Kleding_toe_style' },
  'Top length type (product.metafields.shopify.top-length-type)': { target: '_custom_spec_Kleding_top_length' },
  'Waist rise (product.metafields.shopify.waist-rise)': { target: '_custom_spec_Kleding_waist_rise' },
};

// ============================================================================
// SHOPIFY ORDER MAPPING - All 78+ fields from Shopify export
// ============================================================================
export const SHOPIFY_ORDER_MAPPING: FieldMapping = {
  // Core order fields
  'Name': { target: 'order_number', required: true },
  'Email': { target: 'customer_email', validate: 'email' },
  'Phone': { target: 'customer_phone', transform: 'phone' },
  'Id': { target: 'marketplace_order_id' },
  
  // Status fields
  'Financial Status': { target: 'payment_status', transform: 'shopifyPaymentStatus' },
  'Fulfillment Status': { target: 'status', transform: 'shopifyFulfillmentStatus' },
  'Paid at': { target: 'paid_at', transform: 'datetime' },
  'Fulfilled at': { target: 'shipped_at', transform: 'datetime' },
  'Cancelled at': { target: 'cancelled_at', transform: 'datetime' },
  'Created at': { target: 'original_created_at', transform: 'datetime' },
  
  // Money fields
  'Currency': { target: 'currency' },
  'Subtotal': { target: 'subtotal', transform: 'decimal' },
  'Shipping': { target: 'shipping_cost', transform: 'decimal' },
  'Taxes': { target: 'tax_amount', transform: 'decimal' },
  'Total': { target: 'total', transform: 'decimal', required: true },
  'Discount Code': { target: 'discount_code' },
  'Discount Amount': { target: 'discount_amount', transform: 'decimal' },
  'Refunded Amount': { target: 'refunded_amount', transform: 'decimal' },
  'Outstanding Balance': { target: 'outstanding_balance', transform: 'decimal' },
  
  // Shipping method
  'Shipping Method': { target: 'shipping_method' },
  'Accepts Marketing': { target: 'raw_marketplace_data', transform: 'jsonString:accepts_marketing' },
  
  // Line item fields - store in raw_marketplace_data for later processing
  'Lineitem quantity': { target: 'raw_marketplace_data', transform: 'jsonNumber:lineitem_quantity' },
  'Lineitem name': { target: 'raw_marketplace_data', transform: 'jsonString:lineitem_name' },
  'Lineitem price': { target: 'raw_marketplace_data', transform: 'jsonDecimal:lineitem_price' },
  'Lineitem compare at price': { target: 'raw_marketplace_data', transform: 'jsonDecimal:lineitem_compare_price' },
  'Lineitem sku': { target: 'raw_marketplace_data', transform: 'jsonString:lineitem_sku' },
  'Lineitem requires shipping': { target: 'raw_marketplace_data', transform: 'jsonString:lineitem_requires_shipping' },
  'Lineitem taxable': { target: 'raw_marketplace_data', transform: 'jsonString:lineitem_taxable' },
  'Lineitem fulfillment status': { target: 'raw_marketplace_data', transform: 'jsonString:lineitem_fulfillment_status' },
  'Lineitem discount': { target: 'raw_marketplace_data', transform: 'jsonDecimal:lineitem_discount' },
  'Vendor': { target: 'raw_marketplace_data', transform: 'jsonString:vendor' },
  
  // Billing address - merge into billing_address JSON
  'Billing Name': { target: 'billing_address', transform: 'jsonString:name' },
  'Billing Street': { target: 'billing_address', transform: 'jsonString:street' },
  'Billing Address1': { target: 'billing_address', transform: 'jsonString:address1' },
  'Billing Address2': { target: 'billing_address', transform: 'jsonString:address2' },
  'Billing Company': { target: 'billing_address', transform: 'jsonString:company' },
  'Billing City': { target: 'billing_address', transform: 'jsonString:city' },
  'Billing Zip': { target: 'billing_address', transform: 'jsonString:postal_code' },
  'Billing Province': { target: 'billing_address', transform: 'jsonString:province' },
  'Billing Province Name': { target: 'billing_address', transform: 'jsonString:province_name' },
  'Billing Country': { target: 'billing_address', transform: 'jsonString:country' },
  'Billing Phone': { target: 'billing_address', transform: 'jsonString:phone' },
  
  // Shipping address - merge into shipping_address JSON
  'Shipping Name': { target: 'shipping_address', transform: 'jsonString:name' },
  'Shipping Street': { target: 'shipping_address', transform: 'jsonString:street' },
  'Shipping Address1': { target: 'shipping_address', transform: 'jsonString:address1' },
  'Shipping Address2': { target: 'shipping_address', transform: 'jsonString:address2' },
  'Shipping Company': { target: 'shipping_address', transform: 'jsonString:company' },
  'Shipping City': { target: 'shipping_address', transform: 'jsonString:city' },
  'Shipping Zip': { target: 'shipping_address', transform: 'jsonString:postal_code' },
  'Shipping Province': { target: 'shipping_address', transform: 'jsonString:province' },
  'Shipping Province Name': { target: 'shipping_address', transform: 'jsonString:province_name' },
  'Shipping Country': { target: 'shipping_address', transform: 'jsonString:country' },
  'Shipping Phone': { target: 'shipping_address', transform: 'jsonString:phone' },
  
  // Notes
  'Notes': { target: 'notes' },
  'Note Attributes': { target: 'raw_marketplace_data', transform: 'jsonString:note_attributes' },
  
  // Payment info
  'Payment Method': { target: 'payment_method' },
  'Payment Reference': { target: 'external_reference' },
  'Payment References': { target: 'raw_marketplace_data', transform: 'jsonString:payment_references' },
  'Payment ID': { target: 'raw_marketplace_data', transform: 'jsonString:payment_id' },
  'Payment Terms Name': { target: 'raw_marketplace_data', transform: 'jsonString:payment_terms' },
  'Next Payment Due At': { target: 'raw_marketplace_data', transform: 'jsonString:next_payment_due' },
  'Receipt Number': { target: 'raw_marketplace_data', transform: 'jsonString:receipt_number' },
  
  // Tags and metadata
  'Tags': { target: 'order_tags', transform: 'tagArray' },
  'Risk Level': { target: 'risk_level' },
  'Source': { target: 'marketplace_source' },
  
  // Employee/location
  'Employee': { target: 'employee' },
  'Location': { target: 'location' },
  'Device ID': { target: 'raw_marketplace_data', transform: 'jsonString:device_id' },
  
  // Tax details - store in raw_marketplace_data
  'Tax 1 Name': { target: 'raw_marketplace_data', transform: 'jsonString:tax1_name' },
  'Tax 1 Value': { target: 'raw_marketplace_data', transform: 'jsonDecimal:tax1_value' },
  'Tax 2 Name': { target: 'raw_marketplace_data', transform: 'jsonString:tax2_name' },
  'Tax 2 Value': { target: 'raw_marketplace_data', transform: 'jsonDecimal:tax2_value' },
  'Tax 3 Name': { target: 'raw_marketplace_data', transform: 'jsonString:tax3_name' },
  'Tax 3 Value': { target: 'raw_marketplace_data', transform: 'jsonDecimal:tax3_value' },
  'Tax 4 Name': { target: 'raw_marketplace_data', transform: 'jsonString:tax4_name' },
  'Tax 4 Value': { target: 'raw_marketplace_data', transform: 'jsonDecimal:tax4_value' },
  'Tax 5 Name': { target: 'raw_marketplace_data', transform: 'jsonString:tax5_name' },
  'Tax 5 Value': { target: 'raw_marketplace_data', transform: 'jsonDecimal:tax5_value' },
  
  // Duties
  'Duties': { target: 'raw_marketplace_data', transform: 'jsonDecimal:duties' },
};

// ============================================================================
// WOOCOMMERCE MAPPINGS
// ============================================================================
export const WOOCOMMERCE_CUSTOMER_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'email': { target: 'email', required: true, validate: 'email' },
  'first_name': { target: 'first_name' },
  'last_name': { target: 'last_name' },
  'billing_company': { target: 'company_name' },
  'billing_address_1': { target: 'billing_street' },
  'billing_city': { target: 'billing_city' },
  'billing_state': { target: 'province_code' },
  'billing_postcode': { target: 'billing_postal_code' },
  'billing_country': { target: 'billing_country', transform: 'countryCode' },
  'billing_phone': { target: 'phone', transform: 'phone' },
  'shipping_address_1': { target: 'shipping_street' },
  'shipping_city': { target: 'shipping_city' },
  'shipping_postcode': { target: 'shipping_postal_code' },
  'shipping_country': { target: 'shipping_country', transform: 'countryCode' },
};

export const WOOCOMMERCE_PRODUCT_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'name': { target: 'name', required: true },
  'slug': { target: 'slug', required: true },
  'status': { target: 'is_active', transform: 'wooStatus' },
  'description': { target: 'description', transform: 'html' },
  'short_description': { target: 'short_description', transform: 'html' },
  'sku': { target: 'sku' },
  'price': { target: 'price', transform: 'decimal' },
  'regular_price': { target: 'compare_at_price', transform: 'decimal' },
  'stock_quantity': { target: 'stock', transform: 'number' },
  'weight': { target: 'weight', transform: 'decimal' },
  'categories': { target: 'category_id', transform: 'wcCategories' },
  'tags': { target: 'tags', transform: 'wcTags' },
  'images': { target: 'images', transform: 'wcImages' },
  'yoast_wpseo_title': { target: 'meta_title' },
  'yoast_wpseo_metadesc': { target: 'meta_description' },
  '_yoast_wpseo_title': { target: 'meta_title' },
  '_yoast_wpseo_metadesc': { target: 'meta_description' },
  'rank_math_title': { target: 'meta_title' },
  'rank_math_description': { target: 'meta_description' },
  'meta_title': { target: 'meta_title' },
  'meta_description': { target: 'meta_description' },
  'seo_title': { target: 'meta_title' },
  'seo_description': { target: 'meta_description' },
  'Meta: _yoast_wpseo_title': { target: 'meta_title' },
  'Meta: _yoast_wpseo_metadesc': { target: 'meta_description' },
};

export const SHOPIFY_CATEGORY_MAPPING: FieldMapping = {
  'Collection ID': { target: 'external_id' },
  'Handle': { target: 'slug', required: true },
  'Title': { target: 'name', required: true },
  'Body (HTML)': { target: 'description', transform: 'html' },
  'Image Src': { target: 'image_url' },
  'Sort Order': { target: 'sort_order', transform: 'number' },
  'SEO Title': { target: 'meta_title_nl' },
  'SEO Description': { target: 'meta_description_nl' },
};

export const WOOCOMMERCE_CATEGORY_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'name': { target: 'name', required: true },
  'slug': { target: 'slug', required: true },
  'parent': { target: 'parent_id' },
  'description': { target: 'description', transform: 'html' },
  'image': { target: 'image_url' },
  'menu_order': { target: 'sort_order', transform: 'number' },
  'wpseo_title': { target: 'meta_title_nl' },
  'wpseo_desc': { target: 'meta_description_nl' },
  'yoast_wpseo_title': { target: 'meta_title_nl' },
  'yoast_wpseo_metadesc': { target: 'meta_description_nl' },
};

// ============================================================================
// PLATFORM DETECTION
// ============================================================================
export function detectPlatform(headers: string[]): string {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  const shopifyIndicators = [
    'handle', 'variant sku', 'variant grams', 'variant inventory tracker',
    'default address company', 'accepts email marketing', 'customer id',
    'financial status', 'fulfillment status', 'lineitem'
  ];
  
  const wooIndicators = [
    'billing_company', 'billing_address_1', 'shipping_address_1',
    'stock_status', 'regular_price', 'sale_price'
  ];
  
  const magentoIndicators = [
    'attribute_set', 'configurable_variations', 'store_view_code'
  ];
  
  const prestaIndicators = [
    'id_product', 'id_category_default', 'reference'
  ];
  
  const lightspeedIndicators = [
    'product id', 'variant id', 'product type id'
  ];

  const shopifyScore = shopifyIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const wooScore = wooIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const magentoScore = magentoIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const prestaScore = prestaIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const lightspeedScore = lightspeedIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;

  const scores = { 
    shopify: shopifyScore, 
    woocommerce: wooScore, 
    magento: magentoScore, 
    prestashop: prestaScore,
    lightspeed: lightspeedScore
  };
  
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) return 'csv';
  
  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'csv';
}

// ============================================================================
// GET DEFAULT MAPPING - Now includes orders
// ============================================================================
export function getDefaultMapping(platform: string, dataType: string): FieldMapping {
  const mappings: Record<string, Record<string, FieldMapping>> = {
    shopify: {
      customers: SHOPIFY_CUSTOMER_MAPPING,
      products: SHOPIFY_PRODUCT_MAPPING,
      categories: SHOPIFY_CATEGORY_MAPPING,
      orders: SHOPIFY_ORDER_MAPPING,
    },
    woocommerce: {
      customers: WOOCOMMERCE_CUSTOMER_MAPPING,
      products: WOOCOMMERCE_PRODUCT_MAPPING,
      categories: WOOCOMMERCE_CATEGORY_MAPPING,
    },
  };
  
  return mappings[platform]?.[dataType] || {};
}

// ============================================================================
// FLEXIBLE HEADER MATCHING - Handles variations and metafields
// ============================================================================
export function findMatchingMapping(
  header: string, 
  mapping: FieldMapping
): FieldMappingItem | null {
  // 1. Exact match
  if (mapping[header]) return mapping[header];
  
  // 2. Case-insensitive exact match
  const normalizedHeader = header.toLowerCase().trim();
  for (const [key, config] of Object.entries(mapping)) {
    if (key.toLowerCase().trim() === normalizedHeader) {
      return config;
    }
  }
  
  // 3. Match base header (before parentheses) for metafields
  // e.g., "Phone (customer.metafields.klaviyo.phone)" -> "Phone"
  const baseHeader = header.split('(')[0].trim();
  if (baseHeader !== header && mapping[baseHeader]) {
    return mapping[baseHeader];
  }
  
  // 4. Check if the full header with metafield path exists
  for (const [key, config] of Object.entries(mapping)) {
    if (key.toLowerCase().includes(normalizedHeader) || 
        normalizedHeader.includes(key.toLowerCase())) {
      return config;
    }
  }
  
  return null;
}

// ============================================================================
// TRANSFORMERS - Extended with Shopify-specific transforms
// ============================================================================
export const TRANSFORMERS: Record<string, (value: string, key?: string) => unknown> = {
  string: (v) => v?.trim() || null,
  
  number: (v) => {
    if (!v) return null;
    const num = parseFloat(v.replace(',', '.'));
    return isNaN(num) ? null : num;
  },
  
  decimal: (v) => {
    if (!v) return null;
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  },
  
  boolean: (v) => {
    if (!v) return false;
    const lower = v.toLowerCase().trim();
    return ['yes', 'true', '1', 'ja', 'oui', 'published', 'active'].includes(lower);
  },
  
  // Shopify uses "yes"/"no" for booleans
  yesNo: (v) => {
    if (!v) return false;
    const lower = v.toLowerCase().trim();
    return ['yes', 'ja', 'true', '1', 'oui'].includes(lower);
  },
  
  phone: (v) => {
    if (!v) return null;
    return v.replace(/[^\d+]/g, '') || null;
  },
  
  email: (v) => {
    if (!v) return null;
    const email = v.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  },
  
  countryCode: (v) => {
    if (!v) return null;
    const code = v.trim().toUpperCase();
    return code.length === 2 ? code : null;
  },
  
  tagArray: (v) => {
    if (!v) return [];
    return v.split(',').map(t => t.trim()).filter(Boolean);
  },
  
  html: (v) => {
    if (!v) return null;
    return v;
  },
  
  imageArray: (v) => {
    if (!v) return [];
    // Split on comma, filter empty strings and remove duplicates
    const urls = v.split(',').map(url => url.trim()).filter(Boolean);
    return [...new Set(urls)];
  },
  
  gramsToKg: (v) => {
    if (!v) return null;
    const grams = parseFloat(v);
    return isNaN(grams) ? null : Math.round(grams / 10) / 100;
  },
  
  wooStatus: (v) => {
    const status = v?.toLowerCase().trim();
    return status === 'publish' || status === 'published';
  },
  
  datetime: (v) => {
    if (!v) return null;
    const date = new Date(v);
    return isNaN(date.getTime()) ? null : date.toISOString();
  },
  
  // Shopify Financial Status -> payment_status
  shopifyPaymentStatus: (v) => {
    if (!v) return 'pending';
    const statusMap: Record<string, string> = {
      'paid': 'paid',
      'pending': 'pending',
      'refunded': 'refunded',
      'partially_refunded': 'refunded',
      'partially refunded': 'refunded',
      'voided': 'failed',
      'authorized': 'pending',
      'expired': 'failed',
    };
    return statusMap[v.toLowerCase().trim()] || 'pending';
  },
  
  // Shopify Fulfillment Status -> order status
  shopifyFulfillmentStatus: (v) => {
    if (!v) return 'pending';
    const statusMap: Record<string, string> = {
      'fulfilled': 'shipped',
      'partial': 'processing',
      'unfulfilled': 'pending',
      'restocked': 'cancelled',
      '': 'pending',
    };
    return statusMap[v.toLowerCase().trim()] || 'pending';
  },
  
  // Shopify Product Status -> is_active
  shopifyProductStatus: (v) => {
    if (!v) return true;
    return v.toLowerCase().trim() === 'active';
  },
  
  // JSON string transformer - creates { key: value }
  'jsonString': (v, key) => {
    if (!key) return v;
    return { [key]: v?.trim() || null };
  },
  
  // JSON number transformer
  'jsonNumber': (v, key) => {
    if (!key) return v;
    const num = parseFloat(v?.replace(',', '.') || '');
    return { [key]: isNaN(num) ? null : num };
  },
  
  // JSON decimal transformer
  'jsonDecimal': (v, key) => {
    if (!key) return v;
    const cleaned = (v || '').replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return { [key]: isNaN(num) ? null : Math.round(num * 100) / 100 };
  },
};

// ============================================================================
// TRANSFORM RECORD - Enhanced with JSON merging for address fields
// ============================================================================
export function transformRecord(
  row: Record<string, string>, 
  mapping: FieldMapping
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [sourceField, config] of Object.entries(mapping)) {
    if (!config.target) continue;
    
    const value = row[sourceField];
    if (value === undefined || value === null || value === '') {
      // Skip empty values for fallback fields
      if (config.fallback) continue;
    }
    
    let transformedValue: unknown;
    
    if (config.transform) {
      // Check if transform has argument (e.g., "jsonString:city")
      const [transformName, transformArg] = config.transform.split(':');
      
      if (transformArg && TRANSFORMERS[transformName]) {
        // Call transformer with argument
        transformedValue = TRANSFORMERS[transformName](value || '', transformArg);
      } else if (TRANSFORMERS[config.transform]) {
        transformedValue = TRANSFORMERS[config.transform](value || '');
      } else {
        transformedValue = value;
      }
    } else {
      transformedValue = value?.trim() || null;
    }
    
    // Handle JSON object merging (for addresses and raw_import_data)
    if (typeof transformedValue === 'object' && transformedValue !== null && !Array.isArray(transformedValue)) {
      const existing = result[config.target];
      if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
        // Merge with existing object
        result[config.target] = { ...existing, ...transformedValue };
      } else {
        result[config.target] = transformedValue;
      }
    } else if (config.fallback && result[config.target]) {
      // Don't overwrite with fallback if already has value
      continue;
    } else {
      result[config.target] = transformedValue;
    }
  }
  
  return result;
}

// ============================================================================
// VALIDATE RECORD - Extended with order validation
// ============================================================================
export function validateRecord(
  record: Record<string, unknown>,
  dataType: string
): { valid: boolean; errors: Array<{ field: string; error: string }> } {
  const errors: Array<{ field: string; error: string }> = [];
  
  if (dataType === 'customers') {
    if (!record.email) {
      errors.push({ field: 'email', error: 'Email is required' });
    }
  }
  
  if (dataType === 'products') {
    if (!record.name) {
      errors.push({ field: 'name', error: 'Product name is required' });
    }
    if (!record.price && record.price !== 0) {
      errors.push({ field: 'price', error: 'Price is required' });
    }
  }
  
  if (dataType === 'orders') {
    if (!record.order_number) {
      errors.push({ field: 'order_number', error: 'Order number is required' });
    }
    if (!record.total && record.total !== 0) {
      errors.push({ field: 'total', error: 'Order total is required' });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// SHOPIFY PRODUCT ROW CONSOLIDATION
// Shopify exports multiple rows per product (for images/variants)
// This consolidates them into single product records
// ============================================================================
export function consolidateShopifyProductRows(
  rows: Record<string, string>[]
): Record<string, string>[] {
  // Detect if this is a Shopify product export
  const hasHandle = rows.some(r => 'Handle' in r);
  const hasTitle = rows.some(r => 'Title' in r);
  if (!hasHandle || !hasTitle) return rows;
  
  const productMap = new Map<string, Record<string, string>>();
  const imagesMap = new Map<string, string[]>();
  const variantsMap = new Map<string, Record<string, string>[]>();
  
  for (const row of rows) {
    const handle = row['Handle']?.trim();
    if (!handle) continue;
    
    if (!productMap.has(handle)) {
      // First row with this Handle = main product
      productMap.set(handle, { ...row });
      imagesMap.set(handle, []);
      variantsMap.set(handle, []);
    }
    
    // Collect all images
    const imageSrc = row['Image Src']?.trim();
    if (imageSrc) {
      const images = imagesMap.get(handle)!;
      if (!images.includes(imageSrc)) {
        images.push(imageSrc);
      }
    }
    
    // Collect variant data (ALL rows with Option1 Value, including the first/title row)
    if (row['Option1 Value']?.trim()) {
      variantsMap.get(handle)?.push({
        sku: row['Variant SKU'] || '',
        price: row['Variant Price'] || '',
        compare_at_price: row['Variant Compare At Price'] || '',
        stock: row['Variant Inventory Qty'] || '',
        option1: row['Option1 Value'] || '',
        option2: row['Option2 Value'] || '',
        option3: row['Option3 Value'] || '',
        barcode: row['Variant Barcode'] || '',
        image: row['Variant Image'] || '',
        weight: row['Variant Grams'] || '',
        requires_shipping: row['Variant Requires Shipping'] || '',
      });
    }
  }
  
  // Build consolidated rows
  const consolidated: Record<string, string>[] = [];
  
  for (const [handle, mainRow] of productMap) {
    const images = imagesMap.get(handle) || [];
    const variants = variantsMap.get(handle) || [];
    
    // Add all images as comma-separated string
    if (images.length > 0) {
      mainRow['Image Src'] = images.join(',');
    }
    
    // Add variant count for reference
    if (variants.length > 0) {
      mainRow['_variant_count'] = String(variants.length);
      mainRow['_variants_json'] = JSON.stringify(variants);
    }
    
    consolidated.push(mainRow);
  }
  
  console.log(`Consolidated ${rows.length} rows into ${consolidated.length} products`);
  return consolidated;
}
