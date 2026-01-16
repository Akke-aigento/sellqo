export interface ExportGuide {
  steps: string[];
  expectedFields: string[];
  tips?: string[];
}

export interface PlatformExportGuides {
  customers: ExportGuide;
  products: ExportGuide;
}

export const SHOPIFY_EXPORT_GUIDE: PlatformExportGuides = {
  customers: {
    steps: [
      'Ga naar Shopify Admin → Customers',
      'Klik op "Export" rechtsboven',
      'Selecteer "All customers" of "Current search"',
      'Kies "CSV for Excel, Numbers, or other spreadsheet programs"',
      'Klik op "Export customers"'
    ],
    expectedFields: [
      'Customer ID', 'First Name', 'Last Name', 'Email', 'Company',
      'Phone', 'Address1', 'Address2', 'City', 'Province', 'Province Code',
      'Country', 'Country Code', 'Zip', 'Accepts Marketing', 'Total Spent',
      'Total Orders', 'Tags', 'Note'
    ],
    tips: [
      'Het bestand wordt naar je e-mail gestuurd als je veel klanten hebt',
      'Je kunt eerst filteren en dan alleen de gefilterde klanten exporteren'
    ]
  },
  products: {
    steps: [
      'Ga naar Shopify Admin → Products',
      'Klik op "Export" rechtsboven',
      'Selecteer "All products" of "Current search"',
      'Kies "CSV for Excel, Numbers, or other spreadsheet programs"',
      'Klik op "Export products"'
    ],
    expectedFields: [
      'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category',
      'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value',
      'Variant SKU', 'Variant Grams', 'Variant Inventory Qty',
      'Variant Price', 'Variant Compare At Price', 'Image Src',
      'Image Position', 'Image Alt Text', 'SEO Title', 'SEO Description'
    ],
    tips: [
      'Varianten worden als aparte rijen geëxporteerd',
      'Het eerste product per groep heeft alle basisinformatie'
    ]
  }
};

export const WOOCOMMERCE_EXPORT_GUIDE: PlatformExportGuides = {
  customers: {
    steps: [
      'Ga naar WordPress Admin → WooCommerce → Customers',
      'Klik op "Download" of "Export"',
      'Selecteer welke klanten je wilt exporteren',
      'Kies CSV formaat',
      'Klik op "Generate CSV"'
    ],
    expectedFields: [
      'ID', 'Email', 'First Name', 'Last Name', 'Username',
      'Billing First Name', 'Billing Last Name', 'Billing Company',
      'Billing Address 1', 'Billing Address 2', 'Billing City',
      'Billing Postcode', 'Billing Country', 'Billing State',
      'Billing Phone', 'Shipping First Name', 'Shipping Last Name',
      'Shipping Address 1', 'Shipping City', 'Shipping Postcode'
    ],
    tips: [
      'Gebruik eventueel een plugin zoals "WooCommerce Customer Export" voor meer opties',
      'Controleer of alle adresvelden zijn ingevuld'
    ]
  },
  products: {
    steps: [
      'Ga naar WordPress Admin → Products',
      'Selecteer producten of klik op "Export"',
      'Kies "Export all products" of selectie',
      'Selecteer gewenste velden',
      'Download CSV bestand'
    ],
    expectedFields: [
      'ID', 'SKU', 'Name', 'Short description', 'Description',
      'Regular price', 'Sale price', 'Categories', 'Tags',
      'Stock', 'Stock status', 'Weight', 'Length', 'Width',
      'Height', 'Images', 'Attribute 1 name', 'Attribute 1 value(s)'
    ],
    tips: [
      'Variable producten hebben meerdere rijen',
      'Afbeeldingen worden als URLs geëxporteerd'
    ]
  }
};

export const MAGENTO_EXPORT_GUIDE: PlatformExportGuides = {
  customers: {
    steps: [
      'Ga naar Admin Panel → Customers → All Customers',
      'Selecteer klanten of gebruik filters',
      'Klik op "Export" in het Actions menu',
      'Kies CSV formaat',
      'Download het bestand'
    ],
    expectedFields: [
      'Email', 'Firstname', 'Lastname', 'Group',
      'Billing Street', 'Billing City', 'Billing Postcode',
      'Billing Country', 'Billing Telephone', 'Shipping Street',
      'Shipping City', 'Shipping Postcode', 'Shipping Country'
    ],
    tips: [
      'Gebruik System → Export voor meer geavanceerde opties',
      'Selecteer Customer Main File voor volledige export'
    ]
  },
  products: {
    steps: [
      'Ga naar Admin Panel → System → Export',
      'Selecteer "Products" als Entity Type',
      'Configureer filters indien gewenst',
      'Klik op "Continue"',
      'Download het CSV bestand'
    ],
    expectedFields: [
      'sku', 'name', 'description', 'short_description',
      'price', 'special_price', 'categories', 'qty',
      'weight', 'url_key', 'base_image', 'small_image',
      'thumbnail_image', 'meta_title', 'meta_description'
    ],
    tips: [
      'Export bevat standaard alle product attributen',
      'Filter op specifieke attributen voor kleinere bestanden'
    ]
  }
};

export const PRESTASHOP_EXPORT_GUIDE: PlatformExportGuides = {
  customers: {
    steps: [
      'Ga naar Back Office → Customers → Customers',
      'Klik op de Export knop (CSV icoon)',
      'Of gebruik Advanced Parameters → Import/Export',
      'Selecteer Customer als entity',
      'Download CSV bestand'
    ],
    expectedFields: [
      'id_customer', 'email', 'firstname', 'lastname', 'company',
      'birthday', 'newsletter', 'optin', 'date_add', 'id_gender',
      'address1', 'address2', 'postcode', 'city', 'country', 'phone'
    ],
    tips: [
      'Adressen worden apart geëxporteerd via Addresses',
      'Combineer customer en address exports voor volledige data'
    ]
  },
  products: {
    steps: [
      'Ga naar Back Office → Catalog → Products',
      'Klik op Export (CSV icoon rechtsboven)',
      'Of gebruik Advanced Parameters → Import/Export',
      'Selecteer Products als entity',
      'Download CSV bestand'
    ],
    expectedFields: [
      'id_product', 'name', 'description', 'description_short',
      'price', 'wholesale_price', 'reference', 'quantity',
      'categories', 'image', 'weight', 'meta_title', 'meta_description',
      'link_rewrite'
    ],
    tips: [
      'Gebruik Import/Export module voor meer controle',
      'Combinaties worden in aparte export behandeld'
    ]
  }
};

export const LIGHTSPEED_EXPORT_GUIDE: PlatformExportGuides = {
  customers: {
    steps: [
      'Ga naar Lightspeed eCom → Klanten',
      'Klik op "Export" rechtsboven',
      'Kies CSV formaat',
      'Download het bestand'
    ],
    expectedFields: [
      'Klantnummer', 'E-mail', 'Voornaam', 'Achternaam', 'Bedrijf',
      'Telefoon', 'Straat', 'Huisnummer', 'Postcode', 'Plaats',
      'Land', 'Nieuwsbrief', 'Opmerkingen'
    ],
    tips: [
      'Lightspeed eCom heeft ingebouwde export functie',
      'Check ook Lightspeed Retail als je POS data hebt'
    ]
  },
  products: {
    steps: [
      'Ga naar Lightspeed eCom → Producten',
      'Klik op "Export" rechtsboven',
      'Selecteer alle producten of gebruik filters',
      'Kies CSV formaat',
      'Download het bestand'
    ],
    expectedFields: [
      'Artikelnummer', 'Titel', 'Omschrijving', 'Prijs',
      'Vergelijk prijs', 'Categorie', 'Voorraad', 'Gewicht',
      'Afbeelding', 'SEO titel', 'SEO beschrijving'
    ],
    tips: [
      'Varianten worden als aparte rijen geëxporteerd',
      'Check ook je Lightspeed Retail data indien van toepassing'
    ]
  }
};

export function getExportGuide(platform: string): PlatformExportGuides | null {
  switch (platform.toLowerCase()) {
    case 'shopify':
      return SHOPIFY_EXPORT_GUIDE;
    case 'woocommerce':
      return WOOCOMMERCE_EXPORT_GUIDE;
    case 'magento':
      return MAGENTO_EXPORT_GUIDE;
    case 'prestashop':
      return PRESTASHOP_EXPORT_GUIDE;
    case 'lightspeed':
      return LIGHTSPEED_EXPORT_GUIDE;
    default:
      return null;
  }
}

export const EXPORT_GUIDE_TRANSLATIONS = {
  nl: {
    export_guide_title: 'Export instructies',
    export_steps: 'Stappen',
    expected_fields: 'Verwachte velden',
    tips: 'Tips',
    step: 'Stap'
  },
  en: {
    export_guide_title: 'Export instructions',
    export_steps: 'Steps',
    expected_fields: 'Expected fields',
    tips: 'Tips',
    step: 'Step'
  },
  fr: {
    export_guide_title: 'Instructions d\'export',
    export_steps: 'Étapes',
    expected_fields: 'Champs attendus',
    tips: 'Conseils',
    step: 'Étape'
  },
  de: {
    export_guide_title: 'Export-Anleitung',
    export_steps: 'Schritte',
    expected_fields: 'Erwartete Felder',
    tips: 'Tipps',
    step: 'Schritt'
  }
};
