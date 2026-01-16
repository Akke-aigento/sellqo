import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-MANUAL-INVOICE] ${step}${detailsStr}`);
};

// EU countries for VAT purposes
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

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
  const hasValidVat = customer?.vat_verified === true;
  const isEuCountry = EU_COUNTRIES.includes(customerCountry);
  const isSameCountry = customerCountry === tenantCountry;

  logStep("VAT calculation", { tenantCountry, customerCountry, isB2B, hasValidVat, isEuCountry, isSameCountry });

  // Same country - always apply local VAT
  if (isSameCountry) {
    return {
      vatRate: taxPercent,
      vatAmount: subtotal * (taxPercent / 100),
      vatType: 'standard',
      vatText: null,
      taxCategoryCode: 'S',
    };
  }

  // B2B with valid VAT number in EU - Reverse Charge
  if (isB2B && hasValidVat && isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'reverse_charge',
      vatText: tenant.reverse_charge_text || 'BTW verlegd naar afnemer conform artikel 44 EU BTW-richtlijn',
      taxCategoryCode: 'AE',
    };
  }

  // Export outside EU
  if (!isEuCountry) {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'export',
      vatText: tenant.export_text || 'Vrijgesteld van BTW - levering buiten EU',
      taxCategoryCode: 'G',
    };
  }

  // B2C in EU with OSS enabled
  if (!isB2B && isEuCountry && tenant.apply_oss_rules) {
    const ossRates: Record<string, number> = {
      'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
      'DK': 25, 'EE': 22, 'FI': 24, 'FR': 20, 'DE': 19, 'GR': 24,
      'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
      'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 20,
      'SI': 22, 'ES': 21, 'SE': 25
    };
    const ossRate = ossRates[customerCountry] || taxPercent;
    return {
      vatRate: ossRate,
      vatAmount: subtotal * (ossRate / 100),
      vatType: 'oss',
      vatText: `BTW ${ossRate}% (OSS - ${customerCountry})`,
      taxCategoryCode: 'S',
    };
  }

  // Default: apply local VAT
  return {
    vatRate: taxPercent,
    vatAmount: subtotal * (taxPercent / 100),
    vatType: 'standard',
    vatText: null,
    taxCategoryCode: 'S',
  };
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

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

function generatePDFHTML(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  vatCalculation: VatCalculation;
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, items, subtotal, taxAmount, total, notes, vatCalculation } = data;
  
  const formatAmount = (amount: number) => formatCurrency(amount, currency);
  
  const itemRows = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeXml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.total_price)}</td>
    </tr>
  `).join('');

  const customerNameDisplay = customer?.company_name 
    ? escapeXml(customer.company_name)
    : customer 
      ? escapeXml(`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email)
      : 'Onbekend';

  const customerVatDisplay = customer?.vat_number 
    ? `<div>BTW: ${escapeXml(customer.vat_number)}</div>` 
    : '';

  // Build VAT display
  let vatDisplay = '';
  if (vatCalculation.vatType === 'reverse_charge' || vatCalculation.vatType === 'export') {
    vatDisplay = `
      <div class="total-row">
        <span>BTW (0%)</span>
        <span>${formatAmount(0)}</span>
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
    .notes { margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .notes-title { font-weight: 600; margin-bottom: 12px; }
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
    </div>
    <div>
      <div class="invoice-title">FACTUUR</div>
      <div class="invoice-number">${escapeXml(invoiceNumber)}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Klantgegevens</div>
      <div><strong>${customerNameDisplay}</strong></div>
      ${customer?.first_name && customer?.company_name ? `<div>t.a.v. ${escapeXml(`${customer.first_name} ${customer.last_name || ''}`.trim())}</div>` : ''}
      ${customer?.billing_street ? `<div>${escapeXml(customer.billing_street)}</div>` : ''}
      ${customer?.billing_postal_code || customer?.billing_city ? `<div>${escapeXml(customer.billing_postal_code || '')} ${escapeXml(customer.billing_city || '')}</div>` : ''}
      ${customer?.billing_country ? `<div>${escapeXml(customer.billing_country)}</div>` : ''}
      ${customer?.email ? `<div>${escapeXml(customer.email)}</div>` : ''}
      ${customer?.phone ? `<div>${escapeXml(customer.phone)}</div>` : ''}
      ${customerVatDisplay}
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Factuurdatum:</td>
      <td>${issueDate}</td>
      <td class="meta-label">Factuurnummer:</td>
      <td>${escapeXml(invoiceNumber)}</td>
    </tr>
    <tr>
      <td class="meta-label">Vervaldatum:</td>
      <td>${dueDate}</td>
      ${customer?.id ? `<td class="meta-label">Klantnummer:</td><td>${customer.id.substring(0, 8).toUpperCase()}</td>` : '<td></td><td></td>'}
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

  ${notes ? `
  <div class="notes">
    <div class="notes-title">Opmerkingen</div>
    <div>${escapeXml(notes)}</div>
  </div>
  ` : ''}

  <div class="footer">
    <p>${escapeXml(tenant.name)} ${tenant.kvk_number ? `| KvK: ${escapeXml(tenant.kvk_number)}` : ''} ${tenant.btw_number ? `| BTW: ${escapeXml(tenant.btw_number)}` : ''}</p>
  </div>
</body>
</html>`;
}

function generateUBL(data: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  tenant: any;
  customer: any;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  vatCalculation: VatCalculation;
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, items, subtotal, taxAmount, total, vatCalculation } = data;
  
  const customerName = customer?.company_name 
    || (customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email : 'Onbekend');

  const customerVatInfo = customer?.vat_number && vatCalculation.vatType === 'reverse_charge' 
    ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(customer.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` 
    : '';
  
  const invoiceLines = items.map((item, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${item.total_price.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.description)}</cbc:Description>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${item.unit_price.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('\n');

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
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(customerName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${customer?.billing_street ? `<cbc:StreetName>${escapeXml(customer.billing_street)}</cbc:StreetName>` : ''}
        ${customer?.billing_city ? `<cbc:CityName>${escapeXml(customer.billing_city)}</cbc:CityName>` : ''}
        ${customer?.billing_postal_code ? `<cbc:PostalZone>${escapeXml(customer.billing_postal_code)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${customer?.billing_country || 'NL'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${customerVatInfo}
      <cac:Contact>
        ${customer?.email ? `<cbc:ElectronicMail>${escapeXml(customer.email)}</cbc:ElectronicMail>` : ''}
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting manual invoice creation");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { 
      tenant_id, 
      customer_id,
      items,
      notes,
      send_email = false
    } = await req.json();

    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }

    if (!items || items.length === 0) {
      throw new Error("At least one item is required");
    }

    logStep("Fetching tenant", { tenant_id });

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    // Fetch customer if provided
    let customer = null;
    if (customer_id) {
      const { data: customerData } = await supabaseClient
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .single();
      customer = customerData;
    }

    logStep("Generating invoice number");

    // Generate invoice number
    const { data: invoiceNumber } = await supabaseClient
      .rpc("generate_invoice_number", { _tenant_id: tenant_id });

    const issueDate = formatDate(new Date());
    const dueDate = formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)); // 14 days
    const currency = tenant.currency || 'EUR';
    const invoiceFormat = tenant.invoice_format || 'pdf';

    // Calculate subtotal from items
    const subtotal = items.reduce((sum: number, item: InvoiceItem) => sum + item.total_price, 0);

    // Determine customer country
    const customerCountry = customer?.billing_country || tenant.country || 'NL';

    // Calculate VAT based on customer type and location
    const vatCalculation = calculateVat({
      subtotal,
      tenant,
      customer,
      customerCountry,
    });

    logStep("VAT calculated", vatCalculation);

    const total = subtotal + vatCalculation.vatAmount;

    const invoiceData = {
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      tenant,
      customer,
      items,
      subtotal,
      taxAmount: vatCalculation.vatAmount,
      total,
      notes,
      vatCalculation,
    };

    let pdfUrl = null;
    let ublUrl = null;

    // Generate PDF HTML
    if (invoiceFormat === 'pdf' || invoiceFormat === 'both') {
      logStep("Generating PDF HTML");
      const pdfHtml = generatePDFHTML(invoiceData);
      
      const pdfPath = `${tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.html`;
      
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
    }

    // Generate UBL XML
    if (invoiceFormat === 'ubl' || invoiceFormat === 'both') {
      logStep("Generating UBL XML");
      const ublXml = generateUBL(invoiceData);
      
      const ublPath = `${tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.xml`;
      
      const { error: uploadError } = await supabaseClient.storage
        .from("invoices")
        .upload(ublPath, new Blob([ublXml], { type: 'application/xml' }), {
          contentType: 'application/xml',
          upsert: true,
        });

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseClient.storage
          .from("invoices")
          .getPublicUrl(ublPath);
        ublUrl = publicUrl;
        logStep("UBL XML uploaded", { ublUrl });
      }
    }

    logStep("Creating invoice record");

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        tenant_id: tenant_id,
        customer_id: customer_id || null,
        order_id: null,
        invoice_number: invoiceNumber,
        status: 'draft',
        subtotal: subtotal,
        tax_amount: vatCalculation.vatAmount,
        total: total,
        pdf_url: pdfUrl,
        ubl_url: ublUrl,
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created successfully", { invoice_id: invoice.id, vatType: vatCalculation.vatType });

    // Send email if requested and customer has email
    if (send_email && customer?.email) {
      logStep("Triggering email send");
      await supabaseClient.functions.invoke('send-invoice-email', {
        body: { invoice_id: invoice.id }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      pdf_url: pdfUrl,
      ubl_url: ublUrl,
      vat_type: vatCalculation.vatType,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
