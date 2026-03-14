
-- Fix FK constraints to allow category deletion (SET NULL instead of NO ACTION)

-- products.category_id → SET NULL
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- categories.parent_id → SET NULL (subcategories become root)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL;

-- import_category_mappings FK constraints → SET NULL
ALTER TABLE import_category_mappings DROP CONSTRAINT IF EXISTS import_category_mappings_parent_category_id_fkey;
ALTER TABLE import_category_mappings ADD CONSTRAINT import_category_mappings_parent_category_id_fkey 
  FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE import_category_mappings DROP CONSTRAINT IF EXISTS import_category_mappings_matched_existing_id_fkey;
ALTER TABLE import_category_mappings ADD CONSTRAINT import_category_mappings_matched_existing_id_fkey 
  FOREIGN KEY (matched_existing_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE import_category_mappings DROP CONSTRAINT IF EXISTS import_category_mappings_user_assigned_parent_fkey;
ALTER TABLE import_category_mappings ADD CONSTRAINT import_category_mappings_user_assigned_parent_fkey 
  FOREIGN KEY (user_assigned_parent) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE import_category_mappings DROP CONSTRAINT IF EXISTS import_category_mappings_created_category_id_fkey;
ALTER TABLE import_category_mappings ADD CONSTRAINT import_category_mappings_created_category_id_fkey 
  FOREIGN KEY (created_category_id) REFERENCES categories(id) ON DELETE SET NULL;
