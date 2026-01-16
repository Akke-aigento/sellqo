import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

interface TaxBreakdownLine {
  vatRate: number;
  vatCategory: string;
  taxableAmount: number;
  vatAmount: number;
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

// Calculate tax breakdown per VAT rate for multi-rate invoices
function calculateTaxBreakdown(lines: any[], vatCalculation: VatCalculation): TaxBreakdownLine[] {
  const breakdown = new Map<string, TaxBreakdownLine>();
  
  for (const line of lines) {
    const lineVatRate = line.vat_rate ?? vatCalculation.vatRate;
    const lineVatCategory = line.vat_category ?? vatCalculation.taxCategoryCode;
    const key = `${lineVatRate}-${lineVatCategory}`;
    
    const existing = breakdown.get(key) || {
      vatRate: lineVatRate,
      vatCategory: lineVatCategory,
      taxableAmount: 0,
      vatAmount: 0
    };
    
    const lineSubtotal = (line.quantity || 1) * (line.unit_price || line.total_price || 0);
    existing.taxableAmount += lineSubtotal;
    existing.vatAmount += lineSubtotal * (lineVatRate / 100);
    
    breakdown.set(key, existing);
  }
  
  return Array.from(breakdown.values()).sort((a, b) => b.vatRate - a.vatRate);
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

// VAT category codes for XML
function getVatCategoryCode(category: string): string {
  const codes: Record<string, string> = {
    'standard': 'S',
    'reduced': 'AA',
    'super_reduced': 'AA',
    'zero': 'Z',
    'exempt': 'E',
    'reverse_charge': 'AE',
    'export': 'G',
    'S': 'S',
    'AA': 'AA',
    'Z': 'Z',
    'E': 'E',
    'AE': 'AE',
    'G': 'G',
  };
  return codes[category] || 'S';
}

// Generate Cross-Industry Invoice (CII) XML for Factur-X EN16931
function generateCIIXml(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  order: any;
  orderItems: any[];
  invoiceLines: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingCost: number;
  vatCalculation: VatCalculation;
  taxBreakdown: TaxBreakdownLine[];
  ogmReference: string;
  isB2B: boolean;
}): string {
  const { 
    invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, 
    orderItems, invoiceLines, subtotal, taxAmount, total, shippingCost, 
    vatCalculation, taxBreakdown, ogmReference, isB2B 
  } = data;
  
  const issueDateTime = formatCIIDate(new Date(issueDate));
  const dueDateTime = formatCIIDate(new Date(dueDate));
  
  const customerName = customer?.company_name || 
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
    customer?.email || 'Customer';

  // Use invoice lines if available, otherwise use order items
  const lineItems = (invoiceLines?.length > 0 ? invoiceLines : orderItems).map((item, index) => {
    const lineVatRate = item.vat_rate ?? vatCalculation.vatRate;
    const lineVatCategory = item.vat_category ?? vatCalculation.taxCategoryCode;
    const lineTotal = item.line_total ?? item.total_price ?? (item.quantity * item.unit_price);
    
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        ${item.product_sku ? `<ram:SellerAssignedID>${escapeXml(item.product_sku)}</ram:SellerAssignedID>` : ''}
        <ram:Name>${escapeXml(item.description || item.product_name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${Number(item.unit_price).toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity || 1}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${getVatCategoryCode(lineVatCategory)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${lineVatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${Number(lineTotal).toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  // Generate tax breakdown XML
  const taxBreakdownXml = taxBreakdown.map(tax => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${tax.vatAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${vatCalculation.vatText && tax.vatRate === 0 ? `<ram:ExemptionReason>${escapeXml(vatCalculation.vatText)}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${tax.taxableAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${getVatCategoryCode(tax.vatCategory)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${tax.vatRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('');

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
        <ram:DefinedTradeContact>
          ${tenant.owner_email ? `<ram:EmailURIUniversalCommunication><ram:URIID>${escapeXml(tenant.owner_email)}</ram:URIID></ram:EmailURIUniversalCommunication>` : ''}
          ${tenant.phone ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${escapeXml(tenant.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ''}
        </ram:DefinedTradeContact>
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
      ${tenant.iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(tenant.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${tenant.bic ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(tenant.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
${taxBreakdownXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotal.toFixed(2)}</ram:LineTotalAmount>
        ${shippingCost > 0 ? `<ram:ChargeTotalAmount>${shippingCost.toFixed(2)}</ram:ChargeTotalAmount>` : ''}
        <ram:TaxBasisTotalAmount>${(subtotal + shippingCost).toFixed(2)}</ram:TaxBasisTotalAmount>
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
  invoiceLines: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingCost: number;
  vatCalculation: VatCalculation;
  taxBreakdown: TaxBreakdownLine[];
}): string {
  const { 
    invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, 
    orderItems, invoiceLines, subtotal, taxAmount, total, shippingCost,
    vatCalculation, taxBreakdown 
  } = data;
  
  // Use invoice lines if available, otherwise use order items
  const lines = invoiceLines?.length > 0 ? invoiceLines : orderItems;
  
  const invoiceLinesXml = lines.map((item, index) => {
    const lineVatRate = item.vat_rate ?? vatCalculation.vatRate;
    const lineTotal = item.line_total ?? item.total_price ?? (item.quantity * item.unit_price);
    
    return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity || 1}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${Number(lineTotal).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.description || item.product_name)}</cbc:Description>
        <cbc:Name>${escapeXml(item.description || item.product_name)}</cbc:Name>
        ${item.product_sku ? `<cac:SellersItemIdentification><cbc:ID>${escapeXml(item.product_sku)}</cbc:ID></cac:SellersItemIdentification>` : ''}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${getVatCategoryCode(item.vat_category || vatCalculation.taxCategoryCode)}</cbc:ID>
          <cbc:Percent>${lineVatRate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${Number(item.unit_price).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join('\n');

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

  // Tax subtotals for multi-rate support
  const taxSubtotals = taxBreakdown.map(tax => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currency}">${tax.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currency}">${tax.vatAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${getVatCategoryCode(tax.vatCategory)}</cbc:ID>
          <cbc:Percent>${tax.vatRate}</cbc:Percent>
          ${vatCalculation.vatText && tax.vatRate === 0 ? `<cbc:TaxExemptionReason>${escapeXml(vatCalculation.vatText)}</cbc:TaxExemptionReason>` : ''}
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`).join('\n');

  // Shipping as AllowanceCharge (charge)
  const shippingCharge = shippingCost > 0 ? `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReasonCode>FC</cbc:AllowanceChargeReasonCode>
    <cbc:AllowanceChargeReason>Shipping costs</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="${currency}">${shippingCost.toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>${vatCalculation.vatRate}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>` : '';

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
        <cbc:Name>${escapeXml(customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Customer')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${order.billing_address?.street ? `<cbc:StreetName>${escapeXml(order.billing_address.street)}</cbc:StreetName>` : ''}
        ${order.billing_address?.city ? `<cbc:CityName>${escapeXml(order.billing_address.city)}</cbc:CityName>` : ''}
        ${order.billing_address?.postal_code ? `<cbc:PostalZone>${escapeXml(order.billing_address.postal_code)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${order.billing_address?.country || 'NL'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${customerVatInfo}
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(customer?.email || order.customer_email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  ${tenant.iban ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(tenant.iban)}</cbc:ID>
      ${tenant.bic ? `
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${escapeXml(tenant.bic)}</cbc:ID>
      </cac:FinancialInstitutionBranch>` : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>` : ''}
${shippingCharge}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
${taxSubtotals}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${(subtotal + shippingCost).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    ${shippingCost > 0 ? `<cbc:ChargeTotalAmount currencyID="${currency}">${shippingCost.toFixed(2)}</cbc:ChargeTotalAmount>` : ''}
    <cbc:PayableAmount currencyID="${currency}">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${invoiceLinesXml}
</Invoice>`;
}

// Generate true Factur-X PDF with embedded CII XML using pdf-lib
async function generateFacturXPDF(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  order: any;
  orderItems: any[];
  invoiceLines: any[];
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingCost: number;
  vatCalculation: VatCalculation;
  taxBreakdown: TaxBreakdownLine[];
  ogmReference: string;
  isB2B: boolean;
}): Promise<{ pdfBytes: Uint8Array; ciiXml: string }> {
  const { 
    invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, 
    orderItems, invoiceLines, subtotal, taxAmount, total, shippingCost, 
    vatCalculation, taxBreakdown, ogmReference, isB2B 
  } = data;

  // Generate the CII XML first
  const ciiXml = generateCIIXml(data);

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Set PDF metadata for Factur-X compliance
  pdfDoc.setTitle(`Invoice ${invoiceNumber}`);
  pdfDoc.setAuthor(tenant.name);
  pdfDoc.setSubject(`Invoice ${invoiceNumber}`);
  pdfDoc.setKeywords(['invoice', 'factur-x', 'en16931']);
  pdfDoc.setProducer('Sellqo Factur-X Generator');
  pdfDoc.setCreator('Sellqo');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Create page (A4 size)
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();
  
  const margin = 50;
  let yPos = height - margin;
  
  const primaryColor = rgb(0.231, 0.510, 0.965); // #3b82f6
  const textColor = rgb(0.122, 0.161, 0.216); // #1f2937
  const grayColor = rgb(0.420, 0.447, 0.502); // #6b7280
  const lightGray = rgb(0.898, 0.906, 0.922); // #e5e7eb


  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  // Helper function to safely get customer name
  const customerName = customer?.company_name || 
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
    customer?.email || 'Klant';

  // Header
  page.drawText(tenant.name, {
    x: margin,
    y: yPos,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText('FACTUUR', {
    x: width - margin - 100,
    y: yPos,
    size: 24,
    font: helveticaBold,
    color: textColor,
  });

  yPos -= 20;
  page.drawText(invoiceNumber, {
    x: width - margin - 100,
    y: yPos,
    size: 12,
    font: helveticaFont,
    color: grayColor,
  });

  // Factur-X badge
  yPos -= 20;
  page.drawRectangle({
    x: width - margin - 90,
    y: yPos - 5,
    width: 90,
    height: 16,
    color: rgb(0.063, 0.725, 0.506), // #10b981
  });
  page.drawText('FACTUR-X EN16931', {
    x: width - margin - 85,
    y: yPos,
    size: 7,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  // Company info
  yPos = height - margin - 20;
  const companyInfo = [
    tenant.address,
    `${tenant.postal_code || ''} ${tenant.city || ''}`.trim(),
    tenant.country || 'NL',
    tenant.phone ? `Tel: ${tenant.phone}` : null,
    tenant.owner_email ? `Email: ${tenant.owner_email}` : null,
    tenant.kvk_number ? `KBO/KvK: ${tenant.kvk_number}` : null,
    tenant.btw_number ? `BTW: ${tenant.btw_number}` : null,
  ].filter(Boolean);

  for (const line of companyInfo) {
    yPos -= 14;
    page.drawText(line as string, {
      x: margin,
      y: yPos,
      size: 10,
      font: helveticaFont,
      color: textColor,
    });
  }

  // Addresses section
  yPos -= 40;
  
  // Billing address
  page.drawText('Factuuradres', {
    x: margin,
    y: yPos,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });
  
  page.drawText('Afleveradres', {
    x: width / 2,
    y: yPos,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });

  yPos -= 16;
  page.drawText(customerName, {
    x: margin,
    y: yPos,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });
  page.drawText(customerName, {
    x: width / 2,
    y: yPos,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });

  const billingLines = [
    order.billing_address?.street,
    `${order.billing_address?.postal_code || ''} ${order.billing_address?.city || ''}`.trim(),
    order.billing_address?.country,
    customer?.vat_number ? `BTW: ${customer.vat_number}` : null,
  ].filter(Boolean);

  const shippingLines = [
    order.shipping_address?.street,
    `${order.shipping_address?.postal_code || ''} ${order.shipping_address?.city || ''}`.trim(),
    order.shipping_address?.country,
  ].filter(Boolean);

  for (let i = 0; i < Math.max(billingLines.length, shippingLines.length); i++) {
    yPos -= 14;
    if (billingLines[i]) {
      page.drawText(billingLines[i] as string, {
        x: margin,
        y: yPos,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
    }
    if (shippingLines[i]) {
      page.drawText(shippingLines[i] as string, {
        x: width / 2,
        y: yPos,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
    }
  }

  // Meta info
  yPos -= 30;
  const metaY = yPos;
  
  page.drawText('Factuurdatum:', { x: margin, y: metaY, size: 10, font: helveticaFont, color: grayColor });
  page.drawText(issueDate, { x: margin + 80, y: metaY, size: 10, font: helveticaFont, color: textColor });
  page.drawText('Ordernummer:', { x: width / 2, y: metaY, size: 10, font: helveticaFont, color: grayColor });
  page.drawText(order.order_number, { x: width / 2 + 80, y: metaY, size: 10, font: helveticaFont, color: textColor });

  yPos -= 16;
  page.drawText('Vervaldatum:', { x: margin, y: yPos, size: 10, font: helveticaFont, color: grayColor });
  page.drawText(dueDate, { x: margin + 80, y: yPos, size: 10, font: helveticaFont, color: textColor });
  page.drawText('OGM:', { x: width / 2, y: yPos, size: 10, font: helveticaFont, color: grayColor });
  page.drawText(ogmReference, { x: width / 2 + 80, y: yPos, size: 10, font: helveticaFont, color: textColor });

  // Items table header
  yPos -= 40;
  page.drawRectangle({
    x: margin,
    y: yPos - 5,
    width: width - 2 * margin,
    height: 20,
    color: rgb(0.953, 0.957, 0.965), // #f3f4f6
  });

  page.drawText('Omschrijving', { x: margin + 10, y: yPos, size: 10, font: helveticaBold, color: textColor });
  page.drawText('Aantal', { x: 320, y: yPos, size: 10, font: helveticaBold, color: textColor });
  page.drawText('BTW%', { x: 370, y: yPos, size: 10, font: helveticaBold, color: textColor });
  page.drawText('Prijs', { x: 420, y: yPos, size: 10, font: helveticaBold, color: textColor });
  page.drawText('Totaal', { x: 480, y: yPos, size: 10, font: helveticaBold, color: textColor });

  // Items
  const items = invoiceLines?.length > 0 ? invoiceLines : orderItems;
  for (const item of items || []) {
    yPos -= 20;
    const lineVatRate = item.vat_rate ?? vatCalculation.vatRate;
    const lineTotal = item.line_total ?? item.total_price ?? (item.quantity * item.unit_price);
    
    page.drawText((item.description || item.product_name || '').substring(0, 40), { 
      x: margin + 10, y: yPos, size: 9, font: helveticaFont, color: textColor 
    });
    page.drawText(String(item.quantity || 1), { 
      x: 320, y: yPos, size: 9, font: helveticaFont, color: textColor 
    });
    page.drawText(`${lineVatRate}%`, { 
      x: 370, y: yPos, size: 9, font: helveticaFont, color: textColor 
    });
    page.drawText(formatAmount(item.unit_price), { 
      x: 420, y: yPos, size: 9, font: helveticaFont, color: textColor 
    });
    page.drawText(formatAmount(lineTotal), { 
      x: 480, y: yPos, size: 9, font: helveticaFont, color: textColor 
    });
    
    page.drawLine({
      start: { x: margin, y: yPos - 5 },
      end: { x: width - margin, y: yPos - 5 },
      thickness: 0.5,
      color: lightGray,
    });
  }

  // Totals section
  yPos -= 40;
  const totalsX = 380;
  
  page.drawText('Subtotaal', { x: totalsX, y: yPos, size: 10, font: helveticaFont, color: textColor });
  page.drawText(formatAmount(subtotal), { x: 480, y: yPos, size: 10, font: helveticaFont, color: textColor });

  if (shippingCost > 0) {
    yPos -= 16;
    page.drawText('Verzendkosten', { x: totalsX, y: yPos, size: 10, font: helveticaFont, color: textColor });
    page.drawText(formatAmount(shippingCost), { x: 480, y: yPos, size: 10, font: helveticaFont, color: textColor });
  }

  // Tax breakdown
  for (const tax of taxBreakdown) {
    yPos -= 16;
    page.drawText(`BTW ${tax.vatRate}%`, { x: totalsX, y: yPos, size: 10, font: helveticaFont, color: textColor });
    page.drawText(formatAmount(tax.vatAmount), { x: 480, y: yPos, size: 10, font: helveticaFont, color: textColor });
  }

  // Total
  yPos -= 20;
  page.drawLine({
    start: { x: totalsX, y: yPos + 5 },
    end: { x: width - margin, y: yPos + 5 },
    thickness: 1,
    color: textColor,
  });
  page.drawText('Totaal', { x: totalsX, y: yPos - 5, size: 12, font: helveticaBold, color: textColor });
  page.drawText(formatAmount(total), { x: 480, y: yPos - 5, size: 12, font: helveticaBold, color: textColor });

  // VAT notice if applicable
  if (vatCalculation.vatText) {
    yPos -= 40;
    page.drawRectangle({
      x: margin,
      y: yPos - 10,
      width: width - 2 * margin,
      height: 30,
      color: rgb(0.996, 0.953, 0.780), // #fef3c7
    });
    page.drawText('BTW-vermelding: ' + vatCalculation.vatText, { 
      x: margin + 10, y: yPos, size: 9, font: helveticaFont, color: rgb(0.573, 0.251, 0.055) // #92400e
    });
  }

  // Payment info
  yPos -= 60;
  page.drawRectangle({
    x: margin,
    y: yPos - 50,
    width: width - 2 * margin,
    height: 70,
    color: rgb(0.976, 0.980, 0.984), // #f9fafb
  });

  page.drawText('Betalingsgegevens', { x: margin + 10, y: yPos, size: 10, font: helveticaBold, color: textColor });
  
  if (tenant.iban) {
    yPos -= 16;
    page.drawText(`IBAN: ${tenant.iban.replace(/(.{4})/g, '$1 ').trim()}`, { 
      x: margin + 10, y: yPos, size: 10, font: helveticaFont, color: textColor 
    });
  }
  if (tenant.bic) {
    yPos -= 14;
    page.drawText(`BIC: ${tenant.bic}`, { x: margin + 10, y: yPos, size: 10, font: helveticaFont, color: textColor });
  }
  yPos -= 14;
  page.drawText(`Mededeling: ${ogmReference}`, { x: margin + 10, y: yPos, size: 10, font: helveticaBold, color: primaryColor });

  // Footer
  yPos = margin + 30;
  page.drawLine({
    start: { x: margin, y: yPos + 10 },
    end: { x: width - margin, y: yPos + 10 },
    thickness: 0.5,
    color: lightGray,
  });

  const footerText = [
    tenant.name,
    tenant.kvk_number ? `KBO/KvK: ${tenant.kvk_number}` : null,
    tenant.btw_number ? `BTW: ${tenant.btw_number}` : null,
    tenant.iban ? `IBAN: ${tenant.iban}` : null,
  ].filter(Boolean).join(' | ');

  page.drawText(footerText, { 
    x: margin, y: yPos - 5, size: 8, font: helveticaFont, color: grayColor 
  });

  page.drawText('Deze factuur bevat embedded Factur-X XML (EN16931) voor automatische verwerking.', { 
    x: margin, y: yPos - 18, size: 7, font: helveticaFont, color: rgb(0.612, 0.639, 0.686) // #9ca3af
  });

  // Embed CII XML as attached file for Factur-X compliance
  const xmlBytes = new TextEncoder().encode(ciiXml);
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X XML invoice data (EN16931)',
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();
  
  return { pdfBytes, ciiXml };
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
    const shippingCost = Number(order.shipping_cost) || 0;
    
    const vatCalculation = calculateVat({
      subtotal: subtotal + shippingCost,
      tenant,
      customer,
      customerCountry,
    });

    // Calculate tax breakdown for multi-rate support
    const taxBreakdown = calculateTaxBreakdown(orderItems || [], vatCalculation);

    logStep("VAT calculated", vatCalculation);

    const isB2B = customer?.customer_type === 'b2b';
    
    // Generate OGM (Belgian structured communication)
    const ogmReference = generateOGM(invoiceNumber);
    logStep("OGM generated", { ogmReference });

    const invoiceData = {
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      tenant,
      customer,
      order,
      orderItems: orderItems || [],
      invoiceLines: [], // Will be populated from invoice_lines table in future
      subtotal,
      taxAmount: vatCalculation.vatAmount,
      total: subtotal + vatCalculation.vatAmount + shippingCost,
      shippingCost,
      vatCalculation,
      taxBreakdown,
      ogmReference,
      isB2B,
    };

    let pdfUrl = null;
    let ublUrl = null;

    // Generate true Factur-X PDF with embedded CII XML
    logStep("Generating Factur-X PDF with embedded XML");
    const { pdfBytes, ciiXml } = await generateFacturXPDF(invoiceData);
    
    const pdfPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from("invoices")
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (!uploadError) {
      const { data: { publicUrl } } = supabaseClient.storage
        .from("invoices")
        .getPublicUrl(pdfPath);
      pdfUrl = publicUrl;
      logStep("Factur-X PDF uploaded", { pdfUrl });
    } else {
      logStep("PDF upload error", { error: uploadError.message });
    }

    // Also save standalone CII XML for reference/debugging
    const ciiPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_factur-x.xml`;
    
    await supabaseClient.storage
      .from("invoices")
      .upload(ciiPath, new Blob([ciiXml], { type: 'application/xml' }), {
        contentType: 'application/xml',
        upsert: true,
      });
    logStep("CII XML uploaded as reference file");

    // Generate UBL XML for Peppol (always for B2B, or if explicitly requested)
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
        total: subtotal + vatCalculation.vatAmount + shippingCost,
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

    // Create invoice lines for tracking
    if (orderItems && orderItems.length > 0) {
      const invoiceLines = orderItems.map((item, index) => ({
        invoice_id: invoice.id,
        description: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.total_price,
        vat_rate: vatCalculation.vatRate,
        vat_category: vatCalculation.taxCategoryCode,
        vat_amount: item.total_price * (vatCalculation.vatRate / 100),
        line_type: 'product',
        product_id: item.product_id,
        sort_order: index,
      }));

      // Add shipping line if applicable
      if (shippingCost > 0) {
        invoiceLines.push({
          invoice_id: invoice.id,
          description: 'Verzendkosten',
          quantity: 1,
          unit_price: shippingCost,
          line_total: shippingCost,
          vat_rate: vatCalculation.vatRate,
          vat_category: vatCalculation.taxCategoryCode,
          vat_amount: shippingCost * (vatCalculation.vatRate / 100),
          line_type: 'shipping',
          product_id: null,
          sort_order: orderItems.length,
        });
      }

      await supabaseClient
        .from("invoice_lines")
        .insert(invoiceLines);
      
      logStep("Invoice lines created", { count: invoiceLines.length });
    }

    // Archive the invoice for 7-year retention (Belgian legal requirement)
    logStep("Archiving invoice for 7-year retention");
    try {
      const pdfBuffer = new Uint8Array(pdfBytes);
      const encoder = new TextEncoder();
      
      // Calculate SHA256 hash of PDF for integrity verification
      const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Calculate expiry date (7 years from now)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 7);

      // Create archive record
      await supabaseClient
        .from("invoice_archive")
        .insert({
          tenant_id: order.tenant_id,
          document_id: invoice.id,
          document_type: 'invoice',
          document_number: invoiceNumber,
          pdf_storage_key: pdfPath,
          ubl_storage_key: ublUrl ? `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.xml` : null,
          cii_storage_key: ciiPath,
          sha256_hash: sha256Hash,
          file_size_bytes: pdfBuffer.length,
          expires_at: expiresAt.toISOString(),
          metadata: {
            customer_name: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
            total_amount: invoiceData.total,
            issue_date: issueDate,
            vat_type: vatCalculation.vatType,
            is_b2b: isB2B,
          },
        });
      
      logStep("Invoice archived", { sha256Hash, expiresAt: expiresAt.toISOString() });
    } catch (archiveError: any) {
      // Log but don't fail the invoice generation if archiving fails
      logStep("Archive warning", { message: archiveError.message });
    }

    logStep("Invoice created successfully", { 
      invoice_id: invoice.id, 
      vatType: vatCalculation.vatType,
      isB2B,
      peppolStatus,
      hasFacturX: true,
      taxBreakdown: taxBreakdown.length
    });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      pdf_url: pdfUrl,
      ubl_url: ublUrl,
      ogm_reference: ogmReference,
      has_facturx: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error", { message: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
