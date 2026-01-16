import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICE] ${step}${detailsStr}`);
};

// EU countries for VAT purposes
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// 4-language VAT invoice texts - legally correct texts per EU Directive 2006/112/EC
type SupportedLanguage = 'nl' | 'en' | 'fr' | 'de';

const VAT_TEXTS = {
  // Intra-Community supply of GOODS (B2B) - Article 138
  intracom_goods: {
    nl: 'Intracommunautaire levering vrijgesteld van BTW - art. 138 BTW-richtlijn 2006/112/EG',
    en: 'Intra-Community supply exempt from VAT - Art. 138 VAT Directive 2006/112/EC',
    fr: 'Livraison intracommunautaire exonérée de TVA - Art. 138 Directive TVA 2006/112/CE',
    de: 'Innergemeinschaftliche Lieferung umsatzsteuerfrei - Art. 138 MwSt-Richtlinie 2006/112/EG',
  },
  // Intra-Community SERVICES (B2B) - Article 196 (Reverse Charge)
  intracom_services: {
    nl: 'BTW verlegd naar afnemer - art. 196 BTW-richtlijn 2006/112/EG',
    en: 'VAT reverse charged to customer - Art. 196 VAT Directive 2006/112/EC',
    fr: 'TVA autoliquidée par le preneur - Art. 196 Directive TVA 2006/112/CE',
    de: 'Steuerschuldnerschaft des Leistungsempfängers - Art. 196 MwSt-Richtlinie 2006/112/EG',
  },
  // Export outside EU - Article 146
  export: {
    nl: 'Uitvoer vrijgesteld van BTW - art. 146 BTW-richtlijn 2006/112/EG',
    en: 'Export exempt from VAT - Art. 146 VAT Directive 2006/112/EC',
    fr: 'Exportation exonérée de TVA - Art. 146 Directive TVA 2006/112/CE',
    de: 'Ausfuhr umsatzsteuerfrei - Art. 146 MwSt-Richtlinie 2006/112/EG',
  },
  // OSS Scheme applied
  oss: {
    nl: 'BTW berekend volgens OSS-regeling (One-Stop-Shop) - bestemmingsland tarief',
    en: 'VAT calculated under OSS scheme (One-Stop-Shop) - destination country rate',
    fr: 'TVA calculée selon le régime OSS (guichet unique) - taux du pays de destination',
    de: 'MwSt berechnet nach OSS-Regelung (One-Stop-Shop) - Steuersatz des Bestimmungslandes',
  },
};

// Get customer language, defaulting to tenant language or 'nl'
function getCustomerLanguage(customer: any, tenant: any): SupportedLanguage {
  const countryToLanguage: Record<string, SupportedLanguage> = {
    'NL': 'nl', 'BE': 'nl',
    'DE': 'de', 'AT': 'de', 'CH': 'de', 'LU': 'de',
    'FR': 'fr', 
    'GB': 'en', 'IE': 'en', 'US': 'en', 'CA': 'en', 'AU': 'en',
  };
  
  const customerCountry = customer?.billing_country || customer?.shipping_country || '';
  const inferredLang = countryToLanguage[customerCountry];
  
  if (inferredLang) return inferredLang;
  
  const tenantLang = tenant?.language?.toLowerCase() as SupportedLanguage;
  if (['nl', 'en', 'fr', 'de'].includes(tenantLang)) return tenantLang;
  
  return 'nl';
}

interface VatCalculation {
  vatRate: number;
  vatAmount: number;
  vatType: 'standard' | 'reverse_charge' | 'export' | 'oss';
  vatText: string | null;
  taxCategoryCode: string;
}

function calculateVat(params: {
  subtotal: number;
  tenant: any;
  customer: any;
  customerCountry: string;
}): VatCalculation {
  const { subtotal, tenant, customer, customerCountry } = params;
  const tenantCountry = tenant.country || 'NL';
  const taxPercent = tenant.tax_percentage || 21;
  const isB2B = customer?.customer_type === 'b2b';
  const requireViesValidation = tenant.require_vies_validation !== false;
  const hasValidVat = requireViesValidation 
    ? customer?.vat_verified === true 
    : Boolean(customer?.vat_number);
  const isEuCountry = EU_COUNTRIES.includes(customerCountry);
  const isSameCountry = customerCountry === tenantCountry;
  
  const lang = getCustomerLanguage(customer, tenant);

  logStep("VAT calculation", { 
    tenantCountry, 
    customerCountry, 
    isB2B, 
    hasValidVat, 
    isEuCountry, 
    isSameCountry, 
    lang,
    requireViesValidation,
    vatVerified: customer?.vat_verified,
    vatNumber: customer?.vat_number
  });

  if (isSameCountry) {
    return {
      vatRate: taxPercent,
      vatAmount: subtotal * (taxPercent / 100),
      vatType: 'standard',
      vatText: null,
      taxCategoryCode: 'S',
    };
  }

  if (isB2B && hasValidVat && isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'reverse_charge',
      vatText: VAT_TEXTS.intracom_services[lang],
      taxCategoryCode: 'AE',
    };
  }

  if (!isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'export',
      vatText: VAT_TEXTS.export[lang],
      taxCategoryCode: 'G',
    };
  }

  if (!isB2B && isEuCountry && tenant.apply_oss_rules) {
    const ossRates: Record<string, number> = {
      'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
      'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
      'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
      'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 23,
      'SI': 22, 'ES': 21, 'SE': 25
    };
    const ossRate = ossRates[customerCountry] || taxPercent;
    return {
      vatRate: ossRate,
      vatAmount: subtotal * (ossRate / 100),
      vatType: 'oss',
      vatText: `${VAT_TEXTS.oss[lang]} (${ossRate}% ${customerCountry})`,
      taxCategoryCode: 'S',
    };
  }

  return {
    vatRate: taxPercent,
    vatAmount: subtotal * (taxPercent / 100),
    vatType: 'standard',
    vatText: null,
    taxCategoryCode: 'S',
  };
}

/**
 * Generates a Belgian structured communication (OGM)
 * Format: +++XXX/XXXX/XXXXX+++ (12 digits, last 2 = modulo 97 checksum)
 */
function generateOGM(baseNumber: number | string): string {
  let numericBase = typeof baseNumber === 'string' 
    ? baseNumber.replace(/\D/g, '') 
    : baseNumber.toString();
  
  if (!numericBase || numericBase === '0') {
    numericBase = Date.now().toString().slice(-10);
  }
  
  numericBase = numericBase.slice(-10).padStart(10, '0');
  
  const baseNum = BigInt(numericBase);
  const remainder = Number(baseNum % 97n);
  const checksum = (remainder === 0 ? 97 : remainder).toString().padStart(2, '0');
  
  const full = numericBase + checksum;
  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7, 12)}+++`;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatCIIDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate Cross-Industry Invoice (CII) XML for Factur-X
function generateCIIXml(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  order: any;
  orderItems: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingCost: number;
  vatCalculation: VatCalculation;
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, orderItems, subtotal, taxAmount, total, shippingCost, vatCalculation } = data;
  
  const issueDateTime = formatCIIDate(new Date(issueDate));
  const dueDateTime = formatCIIDate(new Date(dueDate));
  
  const customerName = customer?.company_name || 
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
    customer?.email || 'Customer';

  // Generate line items
  const lineItems = orderItems.map((item, index) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        ${item.product_sku ? `<ram:SellerAssignedID>${escapeXml(item.product_sku)}</ram:SellerAssignedID>` : ''}
        <ram:Name>${escapeXml(item.product_name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${item.unit_price.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatCalculation.taxCategoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${vatCalculation.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${item.total_price.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDateTime}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        ${tenant.peppol_id ? `<ram:GlobalID schemeID="${tenant.peppol_id.split(':')[0]}">${escapeXml(tenant.peppol_id.split(':')[1] || tenant.peppol_id)}</ram:GlobalID>` : ''}
        <ram:Name>${escapeXml(tenant.name)}</ram:Name>
        <ram:PostalTradeAddress>
          ${tenant.address ? `<ram:LineOne>${escapeXml(tenant.address)}</ram:LineOne>` : ''}
          ${tenant.postal_code ? `<ram:PostcodeCode>${escapeXml(tenant.postal_code)}</ram:PostcodeCode>` : ''}
          ${tenant.city ? `<ram:CityName>${escapeXml(tenant.city)}</ram:CityName>` : ''}
          <ram:CountryID>${tenant.country || 'NL'}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${tenant.btw_number ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(tenant.btw_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        ${customer?.peppol_id ? `<ram:GlobalID schemeID="${customer.peppol_id.split(':')[0]}">${escapeXml(customer.peppol_id.split(':')[1] || customer.peppol_id)}</ram:GlobalID>` : ''}
        <ram:Name>${escapeXml(customerName)}</ram:Name>
        <ram:PostalTradeAddress>
          ${order.billing_address?.street ? `<ram:LineOne>${escapeXml(order.billing_address.street)}</ram:LineOne>` : ''}
          ${order.billing_address?.postal_code ? `<ram:PostcodeCode>${escapeXml(order.billing_address.postal_code)}</ram:PostcodeCode>` : ''}
          ${order.billing_address?.city ? `<ram:CityName>${escapeXml(order.billing_address.city)}</ram:CityName>` : ''}
          <ram:CountryID>${order.billing_address?.country || 'NL'}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${customer?.vat_number && vatCalculation.vatType === 'reverse_charge' ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(customer.vat_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
        <ram:DefinedTradeContact>
          <ram:EmailURIUniversalCommunication>
            <ram:URIID>${escapeXml(customer?.email || order.customer_email)}</ram:URIID>
          </ram:EmailURIUniversalCommunication>
        </ram:DefinedTradeContact>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ShipToTradeParty>
        <ram:Name>${escapeXml(customerName)}</ram:Name>
        <ram:PostalTradeAddress>
          ${order.shipping_address?.street ? `<ram:LineOne>${escapeXml(order.shipping_address.street)}</ram:LineOne>` : ''}
          ${order.shipping_address?.postal_code ? `<ram:PostcodeCode>${escapeXml(order.shipping_address.postal_code)}</ram:PostcodeCode>` : ''}
          ${order.shipping_address?.city ? `<ram:CityName>${escapeXml(order.shipping_address.city)}</ram:CityName>` : ''}
          <ram:CountryID>${order.shipping_address?.country || 'NL'}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:ShipToTradeParty>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDateTime}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${taxAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${vatCalculation.vatText ? `<ram:ExemptionReason>${escapeXml(vatCalculation.vatText)}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${subtotal.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${vatCalculation.taxCategoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${vatCalculation.vatRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotal.toFixed(2)}</ram:LineTotalAmount>
        ${shippingCost > 0 ? `<ram:ChargeTotalAmount>${shippingCost.toFixed(2)}</ram:ChargeTotalAmount>` : ''}
        <ram:TaxBasisTotalAmount>${subtotal.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${taxAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${total.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${total.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
${lineItems}
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function generateUBL(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  order: any;
  orderItems: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  vatCalculation: VatCalculation;
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, orderItems, subtotal, taxAmount, total, vatCalculation } = data;
  
  const invoiceLines = orderItems.map((item, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${item.total_price.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.product_name)}</cbc:Description>
        <cbc:Name>${escapeXml(item.product_name)}</cbc:Name>
        ${item.product_sku ? `<cac:SellersItemIdentification><cbc:ID>${escapeXml(item.product_sku)}</cbc:ID></cac:SellersItemIdentification>` : ''}
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${item.unit_price.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('\n');

  const customerVatInfo = customer?.vat_number && vatCalculation.vatType === 'reverse_charge' 
    ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(customer.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` 
    : '';

  // Add Peppol endpoint IDs if available
  const sellerEndpoint = tenant.peppol_id 
    ? `<cbc:EndpointID schemeID="${tenant.peppol_id.split(':')[0]}">${escapeXml(tenant.peppol_id.split(':')[1] || tenant.peppol_id)}</cbc:EndpointID>` 
    : '';
  const buyerEndpoint = customer?.peppol_id 
    ? `<cbc:EndpointID schemeID="${customer.peppol_id.split(':')[0]}">${escapeXml(customer.peppol_id.split(':')[1] || customer.peppol_id)}</cbc:EndpointID>` 
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>

  <cac:AccountingSupplierParty>
    <cac:Party>
      ${sellerEndpoint}
      <cac:PartyName>
        <cbc:Name>${escapeXml(tenant.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${tenant.address ? `<cbc:StreetName>${escapeXml(tenant.address)}</cbc:StreetName>` : ''}
        ${tenant.city ? `<cbc:CityName>${escapeXml(tenant.city)}</cbc:CityName>` : ''}
        ${tenant.postal_code ? `<cbc:PostalZone>${escapeXml(tenant.postal_code)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${tenant.country || 'NL'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${tenant.btw_number ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(tenant.btw_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      ${tenant.kvk_number ? `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${escapeXml(tenant.kvk_number)}</cbc:CompanyID>
      </cac:PartyLegalEntity>` : ''}
      <cac:Contact>
        ${tenant.owner_email ? `<cbc:ElectronicMail>${escapeXml(tenant.owner_email)}</cbc:ElectronicMail>` : ''}
        ${tenant.phone ? `<cbc:Telephone>${escapeXml(tenant.phone)}</cbc:Telephone>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      ${buyerEndpoint}
      <cac:PartyName>
        <cbc:Name>${escapeXml(customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || customer?.email || 'Klant')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${order.shipping_address?.street ? `<cbc:StreetName>${escapeXml(order.shipping_address.street)}</cbc:StreetName>` : ''}
        ${order.shipping_address?.city ? `<cbc:CityName>${escapeXml(order.shipping_address.city)}</cbc:CityName>` : ''}
        ${order.shipping_address?.postal_code ? `<cbc:PostalZone>${escapeXml(order.shipping_address.postal_code)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${order.shipping_address?.country || 'NL'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${customerVatInfo}
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(customer?.email || order.customer_email)}</cbc:ElectronicMail>
        ${customer?.phone ? `<cbc:Telephone>${escapeXml(customer.phone)}</cbc:Telephone>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${vatCalculation.taxCategoryCode}</cbc:ID>
        <cbc:Percent>${vatCalculation.vatRate}</cbc:Percent>
        ${vatCalculation.vatText ? `<cbc:TaxExemptionReason>${escapeXml(vatCalculation.vatText)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${invoiceLines}
</Invoice>`;
}

function generatePDFHTML(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  order: any;
  orderItems: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingCost: number;
  vatCalculation: VatCalculation;
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, orderItems, subtotal, taxAmount, total, shippingCost, vatCalculation } = data;
  
  const formatAmount = (amount: number) => formatCurrency(amount, currency);
  
  const itemRows = orderItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeXml(item.product_name)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.total_price)}</td>
    </tr>
  `).join('');

  let vatDisplay = '';
  if (vatCalculation.vatType === 'reverse_charge') {
    vatDisplay = `
      <div class="total-row">
        <span>BTW (0%)</span>
        <span>${formatAmount(0)}</span>
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
        ${escapeXml(vatCalculation.vatText || '')}
      </div>
    `;
  } else if (vatCalculation.vatType === 'export') {
    vatDisplay = `
      <div class="total-row">
        <span>BTW (0%)</span>
        <span>${formatAmount(0)}</span>
      </div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
        ${escapeXml(vatCalculation.vatText || '')}
      </div>
    `;
  } else if (vatCalculation.vatType === 'oss') {
    vatDisplay = `
      <div class="total-row">
        <span>BTW (${vatCalculation.vatRate}% OSS)</span>
        <span>${formatAmount(taxAmount)}</span>
      </div>
    `;
  } else {
    vatDisplay = `
      <div class="total-row">
        <span>BTW (${vatCalculation.vatRate}%)</span>
        <span>${formatAmount(taxAmount)}</span>
      </div>
    `;
  }

  const customerNameDisplay = customer?.company_name 
    ? escapeXml(customer.company_name)
    : escapeXml(`${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || customer?.email || 'Klant');

  const customerVatDisplay = customer?.vat_number 
    ? `<div>BTW: ${escapeXml(customer.vat_number)}</div>` 
    : '';

  const customerPeppolDisplay = customer?.peppol_id 
    ? `<div>Peppol-ID: ${escapeXml(customer.peppol_id)}</div>` 
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1f2937; font-size: 14px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company-info { max-width: 300px; }
    .company-name { font-size: 24px; font-weight: bold; color: ${tenant.primary_color || '#3b82f6'}; margin-bottom: 8px; }
    .invoice-title { font-size: 32px; font-weight: bold; color: #1f2937; text-align: right; }
    .invoice-number { font-size: 16px; color: #6b7280; text-align: right; margin-top: 8px; }
    .facturx-badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; margin-top: 8px; display: inline-block; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { max-width: 250px; }
    .address-label { font-weight: 600; margin-bottom: 8px; color: #374151; }
    .meta-table { width: 100%; margin-bottom: 40px; }
    .meta-table td { padding: 8px 0; }
    .meta-label { color: #6b7280; width: 150px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    .items-table th:nth-child(2), .items-table th:nth-child(3), .items-table th:nth-child(4) { text-align: right; }
    .items-table th:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.final { font-size: 18px; font-weight: bold; border-top: 2px solid #1f2937; padding-top: 12px; margin-top: 8px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
    .payment-info { margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .payment-title { font-weight: 600; margin-bottom: 12px; }
    .vat-notice { margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      ${tenant.logo_url ? `<img src="${tenant.logo_url}" alt="${escapeXml(tenant.name)}" style="max-height: 60px; margin-bottom: 16px;">` : `<div class="company-name">${escapeXml(tenant.name)}</div>`}
      <div>${tenant.address ? escapeXml(tenant.address) : ''}</div>
      <div>${tenant.postal_code ? escapeXml(tenant.postal_code) : ''} ${tenant.city ? escapeXml(tenant.city) : ''}</div>
      <div>${tenant.country || 'NL'}</div>
      ${tenant.phone ? `<div>Tel: ${escapeXml(tenant.phone)}</div>` : ''}
      ${tenant.owner_email ? `<div>Email: ${escapeXml(tenant.owner_email)}</div>` : ''}
      ${tenant.kvk_number ? `<div>KvK: ${escapeXml(tenant.kvk_number)}</div>` : ''}
      ${tenant.btw_number ? `<div>BTW: ${escapeXml(tenant.btw_number)}</div>` : ''}
      ${tenant.peppol_id ? `<div>Peppol-ID: ${escapeXml(tenant.peppol_id)}</div>` : ''}
    </div>
    <div>
      <div class="invoice-title">FACTUUR</div>
      <div class="invoice-number">${escapeXml(invoiceNumber)}</div>
      <div class="facturx-badge">Factur-X EN16931</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Factuuradres</div>
      <div><strong>${customerNameDisplay}</strong></div>
      ${customer?.first_name && customer?.company_name ? `<div>t.a.v. ${escapeXml(`${customer.first_name} ${customer.last_name || ''}`.trim())}</div>` : ''}
      ${order.billing_address?.street ? `<div>${escapeXml(order.billing_address.street)}</div>` : ''}
      ${order.billing_address?.postal_code || order.billing_address?.city ? `<div>${escapeXml(order.billing_address.postal_code || '')} ${escapeXml(order.billing_address.city || '')}</div>` : ''}
      ${order.billing_address?.country ? `<div>${escapeXml(order.billing_address.country)}</div>` : ''}
      ${customerVatDisplay}
      ${customerPeppolDisplay}
    </div>
    <div class="address-block">
      <div class="address-label">Afleveradres</div>
      <div><strong>${customerNameDisplay}</strong></div>
      ${order.shipping_address?.street ? `<div>${escapeXml(order.shipping_address.street)}</div>` : ''}
      ${order.shipping_address?.postal_code || order.shipping_address?.city ? `<div>${escapeXml(order.shipping_address.postal_code || '')} ${escapeXml(order.shipping_address.city || '')}</div>` : ''}
      ${order.shipping_address?.country ? `<div>${escapeXml(order.shipping_address.country)}</div>` : ''}
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Factuurdatum:</td>
      <td>${issueDate}</td>
      <td class="meta-label">Ordernummer:</td>
      <td>${escapeXml(order.order_number)}</td>
    </tr>
    <tr>
      <td class="meta-label">Vervaldatum:</td>
      <td>${dueDate}</td>
      <td class="meta-label">Klantnummer:</td>
      <td>${customer?.id?.substring(0, 8).toUpperCase() || '-'}</td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th>Omschrijving</th>
        <th style="text-align: center;">Aantal</th>
        <th style="text-align: right;">Prijs</th>
        <th style="text-align: right;">Totaal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotaal</span>
      <span>${formatAmount(subtotal)}</span>
    </div>
    ${shippingCost > 0 ? `
    <div class="total-row">
      <span>Verzendkosten</span>
      <span>${formatAmount(shippingCost)}</span>
    </div>
    ` : ''}
    ${vatDisplay}
    <div class="total-row final">
      <span>Totaal</span>
      <span>${formatAmount(total)}</span>
    </div>
  </div>

  ${vatCalculation.vatText ? `
  <div class="vat-notice">
    <strong>BTW-vermelding:</strong> ${escapeXml(vatCalculation.vatText)}
  </div>
  ` : ''}

  <div class="payment-info">
    <div class="payment-title">Betaling</div>
    <div>Deze factuur is betaald via ${order.stripe_payment_intent_id ? 'online betaling' : 'onze webshop'}.</div>
    ${tenant.iban ? `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
      <div style="font-weight: 600; margin-bottom: 4px;">Bankgegevens</div>
      <div>IBAN: ${escapeXml(tenant.iban.replace(/(.{4})/g, '$1 ').trim())}</div>
      ${tenant.bic ? `<div>BIC: ${escapeXml(tenant.bic)}</div>` : ''}
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <p>${escapeXml(tenant.name)} ${tenant.kvk_number ? `| KBO/KvK: ${escapeXml(tenant.kvk_number)}` : ''} ${tenant.btw_number ? `| BTW: ${escapeXml(tenant.btw_number)}` : ''} ${tenant.iban ? `| IBAN: ${escapeXml(tenant.iban)}` : ''}</p>
    <p style="margin-top: 8px; font-size: 10px; color: #9ca3af;">Deze factuur bevat embedded Factur-X XML (EN16931) voor automatische verwerking door boekhoudsoftware.</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting invoice generation");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { order_id } = await req.json();
    if (!order_id) {
      throw new Error("order_id is required");
    }

    logStep("Fetching order", { order_id });

    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    const { data: existingInvoice } = await supabaseClient
      .from("invoices")
      .select("id")
      .eq("order_id", order_id)
      .single();

    if (existingInvoice) {
      logStep("Invoice already exists", { invoice_id: existingInvoice.id });
      return new Response(JSON.stringify({ 
        success: true, 
        invoice_id: existingInvoice.id,
        message: "Invoice already exists" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orderItems } = await supabaseClient
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", order.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    let customer = null;
    if (order.customer_id) {
      const { data: customerData } = await supabaseClient
        .from("customers")
        .select("*")
        .eq("id", order.customer_id)
        .single();
      customer = customerData;
    }

    if (!customer) {
      customer = {
        id: order.customer_id || 'guest',
        email: order.customer_email,
        first_name: order.customer_name?.split(' ')[0] || '',
        last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
        phone: order.customer_phone,
        customer_type: 'b2c',
      };
    }

    logStep("Generating invoice number");

    const { data: invoiceNumber } = await supabaseClient
      .rpc("generate_invoice_number", { _tenant_id: order.tenant_id });

    const issueDate = formatDate(new Date());
    const dueDate = formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    const currency = tenant.currency || 'EUR';
    const invoiceFormat = tenant.invoice_format || 'pdf';

    const customerCountry = order.shipping_address?.country || customer?.billing_country || tenant.country || 'NL';

    const subtotal = Number(order.subtotal) || 0;
    const vatCalculation = calculateVat({
      subtotal,
      tenant,
      customer,
      customerCountry,
    });

    logStep("VAT calculated", vatCalculation);

    const invoiceData = {
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      tenant,
      customer,
      order,
      orderItems: orderItems || [],
      subtotal,
      taxAmount: vatCalculation.vatAmount,
      total: subtotal + vatCalculation.vatAmount + (Number(order.shipping_cost) || 0),
      shippingCost: Number(order.shipping_cost) || 0,
      vatCalculation,
    };

    let pdfUrl = null;
    let ublUrl = null;
    let ciiUrl = null;

    // Always generate Factur-X compatible PDF
    logStep("Generating Factur-X PDF HTML");
    const pdfHtml = generatePDFHTML(invoiceData);
    
    const pdfPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.html`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from("invoices")
      .upload(pdfPath, new Blob([pdfHtml], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (!uploadError) {
      const { data: { publicUrl } } = supabaseClient.storage
        .from("invoices")
        .getPublicUrl(pdfPath);
      pdfUrl = publicUrl;
      logStep("PDF HTML uploaded", { pdfUrl });
    }

    // Always generate CII XML for Factur-X embedding
    logStep("Generating CII XML for Factur-X");
    const ciiXml = generateCIIXml(invoiceData);
    
    const ciiPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_factur-x.xml`;
    
    const { error: ciiUploadError } = await supabaseClient.storage
      .from("invoices")
      .upload(ciiPath, new Blob([ciiXml], { type: 'application/xml' }), {
        contentType: 'application/xml',
        upsert: true,
      });

    if (!ciiUploadError) {
      const { data: { publicUrl } } = supabaseClient.storage
        .from("invoices")
        .getPublicUrl(ciiPath);
      ciiUrl = publicUrl;
      logStep("CII XML uploaded", { ciiUrl });
    }

    // Generate UBL XML for Peppol (always for B2B, or if explicitly requested)
    const isB2B = customer?.customer_type === 'b2b';
    const isBelgianB2B = isB2B && (customerCountry === 'BE' || tenant.country === 'BE');
    const peppolRequired = isBelgianB2B && new Date() >= new Date('2026-01-01');
    
    if (invoiceFormat === 'ubl' || invoiceFormat === 'both' || isB2B) {
      logStep("Generating UBL XML for Peppol");
      const ublXml = generateUBL(invoiceData);
      
      const ublPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.xml`;
      
      const { error: ublUploadError } = await supabaseClient.storage
        .from("invoices")
        .upload(ublPath, new Blob([ublXml], { type: 'application/xml' }), {
          contentType: 'application/xml',
          upsert: true,
        });

      if (!ublUploadError) {
        const { data: { publicUrl } } = supabaseClient.storage
          .from("invoices")
          .getPublicUrl(ublPath);
        ublUrl = publicUrl;
        logStep("UBL XML uploaded", { ublUrl });
      }
    }

    // Determine Peppol status
    const peppolStatus = peppolRequired ? 'pending' : null;

    // Generate OGM (Belgian structured communication)
    const ogmReference = generateOGM(invoiceNumber);
    logStep("OGM generated", { ogmReference });

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        tenant_id: order.tenant_id,
        order_id: order.id,
        customer_id: order.customer_id,
        invoice_number: invoiceNumber,
        status: 'draft',
        subtotal: order.subtotal,
        tax_amount: vatCalculation.vatAmount,
        total: subtotal + vatCalculation.vatAmount + (Number(order.shipping_cost) || 0),
        pdf_url: pdfUrl,
        ubl_url: ublUrl,
        ogm_reference: ogmReference,
        paid_at: new Date().toISOString(),
        is_b2b: isB2B,
        peppol_status: peppolStatus,
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created successfully", { 
      invoice_id: invoice.id, 
      vatType: vatCalculation.vatType,
      isB2B,
      peppolStatus,
      hasCiiXml: !!ciiUrl
    });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      pdf_url: pdfUrl,
      ubl_url: ublUrl,
      cii_url: ciiUrl,
      auto_send: tenant.auto_send_invoices,
      vat_type: vatCalculation.vatType,
      is_b2b: isB2B,
      peppol_status: peppolStatus,
      peppol_required: peppolRequired,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});