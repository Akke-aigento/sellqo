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

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, orderItems, subtotal, taxAmount, total } = data;
  
  const taxPercent = tenant.tax_percentage || 21;
  
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
      <cac:Contact>
        ${tenant.owner_email ? `<cbc:ElectronicMail>${escapeXml(tenant.owner_email)}</cbc:ElectronicMail>` : ''}
        ${tenant.phone ? `<cbc:Telephone>${escapeXml(tenant.phone)}</cbc:Telephone>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${order.shipping_address?.street ? `<cbc:StreetName>${escapeXml(order.shipping_address.street)}</cbc:StreetName>` : ''}
        ${order.shipping_address?.city ? `<cbc:CityName>${escapeXml(order.shipping_address.city)}</cbc:CityName>` : ''}
        ${order.shipping_address?.postal_code ? `<cbc:PostalZone>${escapeXml(order.shipping_address.postal_code)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${order.shipping_address?.country || 'NL'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(customer.email)}</cbc:ElectronicMail>
        ${customer.phone ? `<cbc:Telephone>${escapeXml(customer.phone)}</cbc:Telephone>` : ''}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${taxPercent}</cbc:Percent>
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

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
}): string {
  const { invoiceNumber, issueDate, dueDate, currency, tenant, customer, order, orderItems, subtotal, taxAmount, total, shippingCost } = data;
  
  const formatAmount = (amount: number) => formatCurrency(amount, currency);
  const taxPercent = tenant.tax_percentage || 21;
  
  const itemRows = orderItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeXml(item.product_name)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.total_price)}</td>
    </tr>
  `).join('');

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
    .payment-info { margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .payment-title { font-weight: 600; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      ${tenant.logo_url ? `<img src="${tenant.logo_url}" alt="${escapeXml(tenant.name)}" style="max-height: 60px; margin-bottom: 16px;">` : `<div class="company-name">${escapeXml(tenant.name)}</div>`}
      <div>${tenant.address ? escapeXml(tenant.address) : ''}</div>
      <div>${tenant.postal_code ? escapeXml(tenant.postal_code) : ''} ${tenant.city ? escapeXml(tenant.city) : ''}</div>
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
      <div class="address-label">Factuuradres</div>
      <div><strong>${escapeXml(`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email)}</strong></div>
      ${order.billing_address?.street ? `<div>${escapeXml(order.billing_address.street)}</div>` : ''}
      ${order.billing_address?.postal_code || order.billing_address?.city ? `<div>${escapeXml(order.billing_address.postal_code || '')} ${escapeXml(order.billing_address.city || '')}</div>` : ''}
      ${order.billing_address?.country ? `<div>${escapeXml(order.billing_address.country)}</div>` : ''}
    </div>
    <div class="address-block">
      <div class="address-label">Afleveradres</div>
      <div><strong>${escapeXml(`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email)}</strong></div>
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
      <td>${customer.id.substring(0, 8).toUpperCase()}</td>
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
    <div class="total-row">
      <span>BTW (${taxPercent}%)</span>
      <span>${formatAmount(taxAmount)}</span>
    </div>
    <div class="total-row final">
      <span>Totaal</span>
      <span>${formatAmount(total)}</span>
    </div>
  </div>

  <div class="payment-info">
    <div class="payment-title">Betaling</div>
    <div>Deze factuur is betaald via ${order.stripe_payment_intent_id ? 'online betaling' : 'onze webshop'}.</div>
  </div>

  <div class="footer">
    <p>${escapeXml(tenant.name)} ${tenant.kvk_number ? `| KvK: ${escapeXml(tenant.kvk_number)}` : ''} ${tenant.btw_number ? `| BTW: ${escapeXml(tenant.btw_number)}` : ''}</p>
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

    // Fetch order with items
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Check if invoice already exists
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

    // Fetch order items
    const { data: orderItems } = await supabaseClient
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", order.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    // Fetch customer
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
      };
    }

    logStep("Generating invoice number");

    // Generate invoice number
    const { data: invoiceNumber } = await supabaseClient
      .rpc("generate_invoice_number", { _tenant_id: order.tenant_id });

    const issueDate = formatDate(new Date());
    const dueDate = formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)); // 14 days
    const currency = tenant.currency || 'EUR';
    const invoiceFormat = tenant.invoice_format || 'pdf';

    const invoiceData = {
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      tenant,
      customer,
      order,
      orderItems: orderItems || [],
      subtotal: Number(order.subtotal) || 0,
      taxAmount: Number(order.tax_amount) || 0,
      total: Number(order.total) || 0,
      shippingCost: Number(order.shipping_cost) || 0,
    };

    let pdfUrl = null;
    let ublUrl = null;

    // Generate PDF HTML
    if (invoiceFormat === 'pdf' || invoiceFormat === 'both') {
      logStep("Generating PDF HTML");
      const pdfHtml = generatePDFHTML(invoiceData);
      
      // Store HTML as PDF placeholder (actual PDF rendering would need a service like Puppeteer)
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
    }

    // Generate UBL XML
    if (invoiceFormat === 'ubl' || invoiceFormat === 'both') {
      logStep("Generating UBL XML");
      const ublXml = generateUBL(invoiceData);
      
      const ublPath = `${order.tenant_id}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.xml`;
      
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
        tax_amount: order.tax_amount,
        total: order.total,
        pdf_url: pdfUrl,
        ubl_url: ublUrl,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created successfully", { invoice_id: invoice.id });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      pdf_url: pdfUrl,
      ubl_url: ublUrl,
      auto_send: tenant.auto_send_invoices,
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
