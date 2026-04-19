-- Update Privacy Policy
UPDATE public.sellqo_legal_pages
SET 
  title = 'Privacy Policy',
  content = $$# Privacy Policy

**Last updated:** 19 April 2026

## 1. Data Controller

The data controller for SellQo is **Nomadix BV**, a company registered in Belgium under company number **BE 1017.500.207**, with registered office at **Beekstraat 49, 3051 Oud-Heverlee, Belgium**.

Contact for privacy requests: **info@sellqo.app**

## 2. What Data We Collect

We collect the following categories of personal data:

- **Account data**: name, email address, password (hashed), company name, billing address.
- **Usage data**: pages visited, features used, log data, device and browser information, IP address.
- **Payment data**: processed exclusively by our payment provider Stripe — we never store full card details on our servers.
- **Communication data**: messages, support tickets and feedback you send us.

## 3. Legal Basis for Processing

We process personal data on the following legal bases under the GDPR:

- **Contract performance** (Art. 6(1)(b)) — to provide the SellQo service to you.
- **Legitimate interest** (Art. 6(1)(f)) — to secure, improve and analyse our service.
- **Consent** (Art. 6(1)(a)) — for non-essential cookies and marketing communications.
- **Legal obligation** (Art. 6(1)(c)) — to comply with tax, accounting and other regulatory requirements.

## 4. How We Use Your Data

We use personal data to:

- Provide, maintain and improve the SellQo platform.
- Process payments and issue invoices.
- Provide customer support.
- Send service-related notifications.
- Detect, prevent and address fraud or abuse.
- Comply with legal obligations.

## 5. Data Sharing and Sub-Processors

We share data only with the following categories of recipients:

- **Supabase** (hosting, database and authentication infrastructure).
- **Stripe** (payment processing).
- **Resend** (transactional email delivery).
- **Hosting and CDN providers** that we use to operate the service.
- **Authorities**, where required by law.

All sub-processors are bound by data processing agreements and act under our instructions.

## 6. International Transfers

Some of our sub-processors (notably Supabase and Stripe) may process data outside the European Economic Area. Where this is the case, transfers are protected by Standard Contractual Clauses approved by the European Commission and additional safeguards where required.

## 7. Data Retention

We retain personal data only for as long as necessary:

- **Account data**: for the duration of your account and up to 24 months after closure.
- **Invoicing data**: 7 years, in accordance with Belgian tax law.
- **Log data**: typically 12 months.
- **Marketing data**: until you withdraw your consent.

## 8. Your Rights Under the GDPR

You have the right to:

- Access the personal data we hold about you.
- Request rectification of inaccurate data.
- Request erasure of your data (right to be forgotten).
- Request restriction of processing.
- Data portability.
- Object to processing based on legitimate interests.
- Withdraw consent at any time.
- Lodge a complaint with the Belgian Data Protection Authority (Gegevensbeschermingsautoriteit, www.gegevensbeschermingsautoriteit.be).

To exercise any of these rights, contact us at **info@sellqo.app**.

## 9. Security

We use industry-standard technical and organisational measures including encryption in transit (TLS), encryption at rest, access controls and regular security reviews to protect your data.

## 10. Changes to this Policy

We may update this privacy policy from time to time. Material changes will be communicated via email or in-app notification. The "Last updated" date at the top reflects the most recent revision.

## 11. Contact

For any questions about this privacy policy or our data practices:

**Nomadix BV**  
Beekstraat 49, 3051 Oud-Heverlee, Belgium  
Company number: BE 1017.500.207  
Email: info@sellqo.app
$$,
  last_published_at = now(),
  effective_date = current_date,
  version = COALESCE(version, 1) + 1,
  is_published = true,
  updated_at = now()
WHERE slug = 'privacy';

-- Update Terms of Service
UPDATE public.sellqo_legal_pages
SET 
  title = 'Terms of Service',
  content = $$# Terms of Service

**Last updated:** 19 April 2026

## 1. Service Provider

These Terms of Service ("Terms") govern your use of **SellQo**, a SaaS platform operated by **Nomadix BV**, a Belgian company registered under company number **BE 1017.500.207**, with registered office at **Beekstraat 49, 3051 Oud-Heverlee, Belgium** ("Nomadix", "we", "us").

Contact: **info@sellqo.app**

By creating an account or using SellQo you agree to these Terms.

## 2. Service Description

SellQo is a software-as-a-service platform that provides e-commerce management tools, including order management, inventory, marketplace integrations, customer relationship management, marketing automation and reporting. Specific features and limits depend on the subscription plan you select.

## 3. Account Responsibilities

You are responsible for:

- Providing accurate and complete registration information.
- Maintaining the confidentiality of your login credentials.
- All activity that occurs under your account.
- Ensuring that team members you invite comply with these Terms.
- Complying with all laws applicable to your business and end-customers.

## 4. Payment Terms

- Subscriptions are billed in advance on a monthly or annual basis through Stripe.
- All fees are exclusive of VAT unless stated otherwise.
- Failed payments may result in suspension or termination of your account.
- Subscriptions auto-renew unless cancelled before the renewal date.
- Refunds are governed by our Refund Policy.

## 5. Acceptable Use

You agree not to:

- Use SellQo for any unlawful or fraudulent purpose.
- Infringe intellectual property or privacy rights of others.
- Attempt to reverse engineer, decompile or otherwise compromise the platform.
- Send spam or unsolicited communications via the platform.
- Upload malware, viruses or harmful code.
- Use the service to compete directly with Nomadix.

## 6. Intellectual Property

All intellectual property in the SellQo platform — including software, design, branding, documentation and trademarks — is and remains the exclusive property of **Nomadix BV**. You receive a limited, non-exclusive, non-transferable licence to use SellQo for the duration of your subscription.

You retain ownership of the content and data you upload to the platform.

## 7. Service Availability

We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance and emergency interventions may occasionally affect availability. Specific service-level commitments, where applicable, are set out in a separate Service Level Agreement.

## 8. Limitation of Liability

To the maximum extent permitted by law:

- Nomadix BV is not liable for indirect, incidental, consequential or special damages, including loss of profit, revenue, data or business opportunities.
- Our total aggregate liability under these Terms is limited to the amount you paid us in the 12 months preceding the event giving rise to the claim.
- Nothing in these Terms excludes liability for fraud, gross negligence or any liability that cannot be excluded under Belgian law.

## 9. Termination

You may cancel your subscription at any time from your account settings; access continues until the end of the paid period. We may suspend or terminate your account for material breach of these Terms, including non-payment, abuse or violation of acceptable use rules.

Upon termination, you may export your data for a reasonable period as documented in our Data Processing Agreement.

## 10. Changes to these Terms

We may update these Terms from time to time. Material changes will be communicated by email or in-app notice at least 30 days before they take effect. Continued use of SellQo after the effective date constitutes acceptance.

## 11. Governing Law and Jurisdiction

These Terms are governed by **Belgian law**. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of **Leuven, Belgium**, without prejudice to any mandatory consumer protection rules.

## 12. Contact

**Nomadix BV**  
Beekstraat 49, 3051 Oud-Heverlee, Belgium  
Company number: BE 1017.500.207  
Email: info@sellqo.app
$$,
  last_published_at = now(),
  effective_date = current_date,
  version = COALESCE(version, 1) + 1,
  is_published = true,
  updated_at = now()
WHERE slug = 'terms';

-- Update Cookie Policy
UPDATE public.sellqo_legal_pages
SET 
  title = 'Cookie Policy',
  content = $$# Cookie Policy

**Last updated:** 19 April 2026

This cookie policy is provided by **Nomadix BV** (company number **BE 1017.500.207**), operator of SellQo. It explains how and why we use cookies and similar technologies on our website and platform.

## 1. What Are Cookies?

Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, or work more efficiently, and to provide information to the website owner.

## 2. Types of Cookies We Use

### Essential cookies
Strictly necessary for the website and platform to function — for example, authentication, session management, security and load balancing. These cannot be disabled.

### Functional cookies
Allow the platform to remember choices you make (such as language or display preferences) and provide enhanced features.

### Analytics cookies
Help us understand how visitors use our website so we can improve it. These cookies are only set with your consent.

## 3. Third-Party Cookies

Some cookies are set by third-party services we use, including:

- **Stripe** — for secure payment processing and fraud prevention.
- **Supabase** — for authentication and session handling.
- Analytics providers, where applicable and only with your consent.

These third parties have their own privacy and cookie policies governing how they handle data.

## 4. How to Manage Cookies

You can control and delete cookies through your browser settings. Most browsers allow you to:

- See which cookies are stored.
- Delete individual cookies or all cookies.
- Block cookies from specific sites or all sites.
- Block third-party cookies.

Please note that blocking essential cookies may prevent SellQo from working correctly.

For non-essential cookies, you can also withdraw your consent at any time via our cookie banner.

## 5. Changes to this Policy

We may update this cookie policy from time to time. The "Last updated" date at the top of this page reflects the latest revision.

## 6. Contact

For any questions about our use of cookies:

**Nomadix BV**  
Beekstraat 49, 3051 Oud-Heverlee, Belgium  
Company number: BE 1017.500.207  
Email: info@sellqo.app
$$,
  last_published_at = now(),
  effective_date = current_date,
  version = COALESCE(version, 1) + 1,
  is_published = true,
  updated_at = now()
WHERE slug = 'cookies';