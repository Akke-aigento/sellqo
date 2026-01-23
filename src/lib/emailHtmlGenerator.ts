import type { EmailBlock, EmailBlockStyle } from '@/types/emailBuilder';

interface GlobalStyles {
  backgroundColor?: string;
  fontFamily?: string;
  maxWidth?: number;
}

function styleToInline(style: EmailBlockStyle): string {
  const styles: string[] = [];
  
  if (style.backgroundColor) styles.push(`background-color: ${style.backgroundColor}`);
  if (style.textColor) styles.push(`color: ${style.textColor}`);
  if (style.fontSize) styles.push(`font-size: ${style.fontSize}px`);
  if (style.fontWeight) styles.push(`font-weight: ${style.fontWeight}`);
  if (style.textAlign) styles.push(`text-align: ${style.textAlign}`);
  if (style.borderRadius) styles.push(`border-radius: ${style.borderRadius}px`);
  if (style.borderColor && style.borderWidth) {
    styles.push(`border: ${style.borderWidth}px solid ${style.borderColor}`);
  }
  
  // Padding
  const pt = style.paddingTop ?? 0;
  const pb = style.paddingBottom ?? 0;
  const pl = style.paddingLeft ?? 24;
  const pr = style.paddingRight ?? 24;
  styles.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);
  
  return styles.join('; ');
}

function renderBlockToHtml(block: EmailBlock): string {
  const inlineStyle = styleToInline(block.style);
  
  switch (block.type) {
    case 'header':
      return `
        <tr>
          <td style="${inlineStyle}">
            ${block.content.logoUrl ? `<img src="${block.content.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 16px;">` : ''}
            ${block.content.headerText ? `<h1 style="margin: 0; font-size: 28px; color: inherit;">${block.content.headerText}</h1>` : ''}
          </td>
        </tr>
      `;
      
    case 'text':
      return `
        <tr>
          <td style="${inlineStyle}">
            <p style="margin: 0; line-height: 1.6;">${block.content.text || ''}</p>
          </td>
        </tr>
      `;
      
    case 'image':
      const imgContent = block.content.imageUrl 
        ? `<img src="${block.content.imageUrl}" alt="${block.content.altText || ''}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">`
        : '';
      const wrappedImg = block.content.linkUrl 
        ? `<a href="${block.content.linkUrl}">${imgContent}</a>` 
        : imgContent;
      return `
        <tr>
          <td style="${inlineStyle}">
            ${wrappedImg}
          </td>
        </tr>
      `;
      
    case 'button':
      return `
        <tr>
          <td style="${inlineStyle}">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="background-color: ${block.style.backgroundColor || '#7c3aed'}; border-radius: ${block.style.borderRadius || 8}px;">
                  <a href="${block.content.buttonUrl || '#'}" style="display: inline-block; padding: 14px 32px; color: ${block.style.textColor || '#ffffff'}; text-decoration: none; font-weight: 500; font-size: 16px;">
                    ${block.content.buttonText || 'Klik hier'}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
      
    case 'divider':
      const borderStyle = block.content.dividerStyle || 'solid';
      return `
        <tr>
          <td style="padding: ${block.style.paddingTop || 16}px 24px ${block.style.paddingBottom || 16}px 24px;">
            <hr style="border: none; border-top: 1px ${borderStyle} ${block.style.borderColor || '#e5e7eb'}; margin: 0;">
          </td>
        </tr>
      `;
      
    case 'spacer':
      return `
        <tr>
          <td style="height: ${block.content.height || 32}px; line-height: 1px; font-size: 1px;">&nbsp;</td>
        </tr>
      `;
      
    case 'product':
      return `
        <tr>
          <td style="${inlineStyle}">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                ${block.content.productImage ? `
                  <td width="120" style="padding-right: 20px;">
                    <img src="${block.content.productImage}" alt="${block.content.productName || ''}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                  </td>
                ` : ''}
                <td style="vertical-align: top;">
                  <h3 style="margin: 0 0 8px; font-size: 18px; color: #1a1a1a;">${block.content.productName || 'Product'}</h3>
                  ${block.content.productDescription ? `<p style="margin: 0 0 12px; color: #666; font-size: 14px;">${block.content.productDescription}</p>` : ''}
                  <p style="margin: 0; font-size: 18px; font-weight: bold; color: #7c3aed;">${block.content.productPrice || ''}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
      
    case 'social':
      const socialLinks = [];
      if (block.content.facebook) socialLinks.push(`<a href="${block.content.facebook}" style="margin: 0 8px;"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/facebook.svg" width="24" height="24" alt="Facebook"></a>`);
      if (block.content.instagram) socialLinks.push(`<a href="${block.content.instagram}" style="margin: 0 8px;"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg" width="24" height="24" alt="Instagram"></a>`);
      if (block.content.twitter) socialLinks.push(`<a href="${block.content.twitter}" style="margin: 0 8px;"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/x.svg" width="24" height="24" alt="Twitter"></a>`);
      if (block.content.linkedin) socialLinks.push(`<a href="${block.content.linkedin}" style="margin: 0 8px;"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg" width="24" height="24" alt="LinkedIn"></a>`);
      
      return `
        <tr>
          <td style="${inlineStyle}">
            ${socialLinks.join('')}
          </td>
        </tr>
      `;
      
    case 'footer':
      return `
        <tr>
          <td style="${inlineStyle}">
            <p style="margin: 0 0 8px;">${block.content.companyName || '{{company_name}}'}</p>
            <p style="margin: 0 0 16px;">${block.content.companyAddress || '{{company_address}}'}</p>
            <p style="margin: 0;">
              <a href="{{unsubscribe_url}}" style="color: #999999; text-decoration: underline;">${block.content.unsubscribeText || 'Uitschrijven'}</a>
              ${block.content.includePreferences ? ' | <a href="{{preferences_url}}" style="color: #999999; text-decoration: underline;">Email voorkeuren</a>' : ''}
            </p>
          </td>
        </tr>
      `;
      
    default:
      return '';
  }
}

export function generateEmailHtml(blocks: EmailBlock[], globalStyles?: GlobalStyles): string {
  const bgColor = globalStyles?.backgroundColor || '#f4f4f4';
  const fontFamily = globalStyles?.fontFamily || "Arial, sans-serif";
  const maxWidth = globalStyles?.maxWidth || 600;
  
  const blockRows = blocks.map(renderBlockToHtml).join('\n');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; border-collapse: collapse; }
    td { padding: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: ${fontFamily};">
  <center style="width: 100%; background-color: ${bgColor};">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: ${maxWidth}px; margin: 0 auto;" class="email-container">
      <tr>
        <td style="padding: 20px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff;">
            ${blockRows}
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}
