export interface SecurityPolicy {
  slug: string;
  title: string;
  icon: 'Shield' | 'Lock' | 'Database' | 'AlertTriangle' | 'ShieldCheck';
  summary: string;
  version: string;
  effectiveDate: string;
  markdown: string;
}

export const SECURITY_POLICY_VERSION = '1.0';
export const SECURITY_POLICY_EFFECTIVE_DATE = '8 August 2026';

export const SECURITY_PDF_BASE_URL =
  'https://gczmfcabnoofnmfpzeop.supabase.co/storage/v1/object/public/marketing-assets/security';

export const securityPolicies: SecurityPolicy[] = [
  {
    slug: 'information-security-policy',
    title: 'Information Security Policy',
    icon: 'Shield',
    summary:
      'How SellQo protects the confidentiality, integrity and availability of merchant and customer data across infrastructure, endpoints and processes.',
    version: SECURITY_POLICY_VERSION,
    effectiveDate: SECURITY_POLICY_EFFECTIVE_DATE,
    markdown: `# Information Security Policy

**SellQo — operated by Nomadix BV**
Version 1.0 · Effective 8 August 2026 · Review cycle: annual

## 1. Purpose
This policy sets out how SellQo (a multi-tenant, headless e-commerce SaaS platform operated by Nomadix BV, Belgium) protects the confidentiality, integrity and availability of the data entrusted to it by merchants and their end customers. It applies to all systems, staff, contractors and third-party processors involved in operating the platform.

## 2. Scope
This policy covers all production infrastructure (application, database, storage, edge functions, CDN); all personal data of merchants ("tenants") and their end customers processed by the platform; all devices used to administer or develop the platform; and all third-party services that process data on SellQo's behalf.

## 3. Roles and responsibilities
The Managing Director of Nomadix BV holds overall accountability for information security and acts as the primary security and privacy contact. Day-to-day security operations — access management, monitoring, incident handling and change control — are carried out under this accountability. Because SellQo is operated by a small, focused team, security responsibilities are consolidated rather than distributed, and every person with production access is bound by the rules in this policy.

## 4. Infrastructure security
SellQo runs on managed cloud infrastructure hosted within the European Union. The platform uses a managed PostgreSQL backend (Supabase) with network isolation and infrastructure-level protection; a CDN and edge network (Cloudflare) providing DDoS protection, a web application firewall and TLS termination; and serverless edge functions for all privileged operations, so that secrets and service credentials never reside in client-side code. Network segregation and threat monitoring are provided at the infrastructure layer, and SellQo's architecture is designed to rely on that isolation rather than to weaken it.

## 5. Endpoint security
All endpoints used to administer or develop the platform run a maintained, supported operating system with active anti-malware protection enabled. Endpoints apply automatic security updates. A security baseline is enforced for daily operations, covering automatic screen lock, strong password complexity, full-disk encryption and multi-factor authentication on all business-critical accounts.

## 6. Access control
Access to production systems and personal data follows the principle of least privilege. Access is granted based on operational need, is limited to the minimum required, and is enforced technically rather than by convention. The detailed rules are set out in the separate Access Control Policy.

## 7. Data protection
Sensitive data is classified and protected according to the separate Data Classification & Encryption Policy. All data is encrypted in transit (TLS) and at rest, and third-party credentials are additionally encrypted at the application layer.

## 8. Change management and secure development
Changes to the platform follow a recon-first, verify-after workflow: the impact of a change is assessed before it is made, and verified against the live system afterwards. Security-relevant changes — database policies, privileged functions, authentication flows — are reviewed against a documented security standard before release. Dependencies are pinned to avoid uncontrolled updates, and secrets are never committed to source control.

## 9. Logging and monitoring
Production systems are monitored for availability and health. Logs never contain secrets, tokens, passwords or full personal data payloads; identifiers are logged instead of sensitive content. Automated monitoring alerts the responsible person when a system deviates from expected behaviour.

## 10. Incident response
Suspected or confirmed security incidents are handled according to the separate Incident Response Plan, which defines roles, reporting channels and notification obligations, including notification to affected merchants and to platform partners where required.

## 11. Third-party processors
Third-party services that process personal data on SellQo's behalf are selected for their security posture and are bound by data processing terms. Data is stored and processed within the European Union wherever the service allows it.

## 12. Compliance and review
This policy is reviewed at least annually, and whenever a significant change to the platform, its infrastructure or applicable law warrants it. Nomadix BV operates the platform in accordance with the EU General Data Protection Regulation (GDPR) and applicable Belgian law.`,
  },
  {
    slug: 'access-control-policy',
    title: 'Access Control Policy',
    icon: 'Lock',
    summary:
      'Least-privilege access, enforced in the data layer through row-level security, role mapping, service-role isolation and private storage.',
    version: SECURITY_POLICY_VERSION,
    effectiveDate: SECURITY_POLICY_EFFECTIVE_DATE,
    markdown: `# Access Control Policy

**SellQo — operated by Nomadix BV**
Version 1.0 · Effective 8 August 2026 · Review cycle: annual

## 1. Purpose
This policy defines how access to SellQo systems and to personal data is granted, enforced, reviewed and revoked. Its objective is to ensure that every actor — human or system — has only the access strictly required for its role, and no more.

## 2. Principle of least privilege
Access to systems that hold personal data is granted on the basis of least privilege. This is a design principle of the platform, not only an administrative rule: access rights are the minimum necessary to perform a legitimate task, and are enforced in the data layer itself.

## 3. Technical enforcement
Access control is enforced at multiple layers. Row-Level Security (RLS): every table containing tenant or customer data is protected by row-level security policies, so a tenant can only read and write its own data and cross-tenant access is structurally prevented at the database level. Role-based access: roles (platform administrator, tenant administrator, tenant user) determine which operations an authenticated user may perform, mapped explicitly and mirrored between the application and the database. Service-role isolation: privileged operations that must bypass tenant restrictions run only in trusted server-side functions using a dedicated service role that is never exposed to client-side code, and tables holding third-party credentials or secrets are restricted to the service role exclusively. Storage access: file storage buckets are private by default, access is scoped per tenant by path convention and policy, and sensitive documents are served only through short-lived signed URLs, never as public links.

## 4. Authentication
Access to production administration and development accounts requires strong authentication. Multi-factor authentication is enforced on all business-critical accounts (cloud infrastructure, source control, DNS/CDN, identity provider). Passwords meet complexity requirements and are never shared between individuals or reused across accounts.

## 5. Public endpoints
Any endpoint or data path that is intentionally public is justified individually: the reason it is public, exactly which data it exposes, and an abuse-mitigation consideration are all documented before it is released. Public access to any table holding tokens, credentials or personal data beyond what is strictly required is categorically prohibited.

## 6. Granting and revoking access
Access is granted only when there is an operational need, and is removed promptly when that need ends — including at the end of any engagement with a contractor or partner. Administrative invitations to tenant or platform accounts are issued deliberately and tracked, and pending invitations expire automatically if not accepted.

## 7. Review
Access rights, privileged database functions and public data paths are reviewed periodically as part of a recurring security audit. Findings are recorded, and any access that is no longer justified is removed.

## 8. Compliance
This policy supports SellQo's obligations under the GDPR and applicable Belgian law, and is reviewed at least annually.`,
  },
  {
    slug: 'data-classification-encryption-policy',
    title: 'Data Classification & Encryption Policy',
    icon: 'Database',
    summary:
      'How data is classified from public to secret, and how each class is encrypted in transit, at rest and at the application layer.',
    version: SECURITY_POLICY_VERSION,
    effectiveDate: SECURITY_POLICY_EFFECTIVE_DATE,
    markdown: `# Data Classification & Encryption Policy

**SellQo — operated by Nomadix BV**
Version 1.0 · Effective 8 August 2026 · Review cycle: annual

## 1. Purpose
This policy defines how SellQo classifies the data it holds and how each class is protected, with particular attention to encryption of sensitive data both in transit and at rest.

## 2. Data classification
SellQo classifies data from least to most sensitive. Public: information intended for open publication (public storefront content, published logos, marketing material); no confidentiality controls required. Internal: operational data that is not sensitive but not meant for public release (aggregated, non-identifying platform metrics). Personal data: any information relating to an identified or identifiable person — merchant account holders and their end customers, including names, contact details, addresses and order information; protected under the GDPR. Sensitive / secret: authentication credentials, access tokens, API keys, third-party integration credentials and payment-related identifiers; highest level of protection, access restricted to trusted server-side processes only. Every new data store is assigned a classification when it is created, and its protection is set to match.

## 3. Encryption in transit
All network communication with and within the platform is encrypted using TLS. This applies to traffic between end users and the platform, between the platform and its managed backend, and between the platform and third-party services. Unencrypted transport of personal or sensitive data is not permitted.

## 4. Encryption at rest
All platform data is encrypted at rest by the managed infrastructure. In addition, data classified as sensitive or secret receives an extra layer of application-level encryption: third-party credentials and comparable secrets are encrypted using authenticated encryption (AES-GCM) before storage, with the encryption key held in a protected secrets store and never written in plaintext into any table.

## 5. Secrets handling
Secrets — service keys, API keys, webhook secrets, encryption keys — are read only from a protected secrets store at runtime and never hard-coded in the application; never committed to source control, documentation, prompts, logs or examples; and actively removed when they become obsolete, since an unused secret is unnecessary attack surface. Client-side code and public configuration variables are treated as public by definition and never contain secrets or privileged credentials.

## 6. Data minimisation and logging
Only the personal data necessary to operate the service is collected and retained. Logs record identifiers rather than sensitive payloads, and never contain passwords, tokens or full personal data.

## 7. Retention and deletion
Personal data is retained only as long as necessary to provide the service or to meet a legal obligation. At the end of a contractual relationship, collected customer data in SellQo's possession is deleted. Individual data-subject requests to access, correct or delete personal data are supported; the process is described in the Privacy Policy.

## 8. Compliance
This policy supports SellQo's obligations under the GDPR and applicable Belgian law, and is reviewed at least annually.`,
  },
  {
    slug: 'incident-response-plan',
    title: 'Incident Response Plan',
    icon: 'AlertTriangle',
    summary:
      'Detection, containment, eradication, recovery and review of security incidents, including GDPR breach notification to authorities, merchants and partners.',
    version: SECURITY_POLICY_VERSION,
    effectiveDate: SECURITY_POLICY_EFFECTIVE_DATE,
    markdown: `# Incident Response Plan

**SellQo — operated by Nomadix BV**
Version 1.0 · Effective 8 August 2026 · Review cycle: annual

## 1. Purpose
This plan defines how SellQo detects, responds to, communicates and learns from security incidents, including personal data breaches. It exists so that incidents are handled quickly, consistently and in line with legal obligations.

## 2. What counts as an incident
A security incident is any event that compromises, or credibly threatens to compromise, the confidentiality, integrity or availability of SellQo systems or data. This includes unauthorised access to personal data, exposure of credentials or secrets, malware, denial-of-service, and significant unplanned outages affecting data safety.

## 3. Roles and responsibilities
The Managing Director of Nomadix BV is the Incident Lead and holds overall responsibility for incident response, including the decision to notify authorities, merchants and partners. The Incident Lead may delegate specific tasks (investigation, containment, communication) but remains accountable throughout. Given the size of the team, roles are consolidated; the Incident Lead is the single, always-available point of contact.

## 4. Reporting channels
Security concerns and suspected incidents are reported to a dedicated, monitored contact address: security@sellqo.app (routing to the Incident Lead). Merchants, partners, end users and security researchers can use this channel. Internal monitoring systems also raise automated alerts to the Incident Lead.

## 5. Response process
Incident response follows five stages. Identify: confirm that an incident is occurring, capture initial facts (what, when, which systems, which data), and open an incident record. Contain: limit the impact — for example by revoking exposed credentials, restricting access, isolating affected components or disabling a compromised path — while preserving evidence. Eradicate: remove the root cause by closing the vulnerability, rotating secrets and removing malicious artefacts. Recover: restore normal, verified operation and confirm the issue no longer persists, using evidence rather than assumption. Review: after resolution, conduct a root-cause review, record findings and corrective actions, and update controls and documentation to prevent recurrence.

## 6. Breach notification
Where an incident involves personal data, SellQo assesses without undue delay whether it constitutes a personal data breach under the GDPR. If the breach is likely to result in a risk to the rights and freedoms of individuals, the competent supervisory authority (in Belgium, the Data Protection Authority / Gegevensbeschermingsautoriteit) is notified in accordance with the GDPR timeframe. Where the breach affects a merchant's data or their end customers, the affected merchant is notified so they can meet their own obligations, and SellQo assists as required. Where a platform partner's data or integration is affected, that partner is notified promptly through the agreed channel. Affected individuals are informed where the GDPR requires it. A notification process is maintained specifically to alert partners and merchants of suspected or identified data breaches.

## 7. Records
Every incident is recorded, including timeline, impact, actions taken, notifications made and lessons learned. These records support accountability and continuous improvement.

## 8. Testing and review
This plan is reviewed at least annually and updated in light of incidents, changes to the platform, or changes in the law.`,
  },
  {
    slug: 'vulnerability-threat-management',
    title: 'Vulnerability & Threat Management Procedure',
    icon: 'ShieldCheck',
    summary:
      'How vulnerabilities are identified, prioritised and remediated, including dependency management, periodic audits and the preventive baseline.',
    version: SECURITY_POLICY_VERSION,
    effectiveDate: SECURITY_POLICY_EFFECTIVE_DATE,
    markdown: `# Vulnerability & Threat Management Procedure

**SellQo — operated by Nomadix BV**
Version 1.0 · Effective 8 August 2026 · Review cycle: annual

## 1. Purpose
This procedure describes how SellQo identifies, assesses, prioritises and remediates security vulnerabilities and threats across its platform and dependencies.

## 2. Sources of vulnerability information
SellQo identifies vulnerabilities and threats from automated security advisors provided by the managed database and infrastructure platform, reviewed whenever a change touches the schema or security configuration; from dependency and supply-chain signals, since all dependencies are version-pinned and updates are reviewed rather than applied blindly; from continuous availability and health monitoring that surfaces anomalous behaviour; and from reports received through the security contact channel (security@sellqo.app) from merchants, partners and external researchers.

## 3. Assessment and prioritisation
When a vulnerability is identified, it is assessed for exploitability and potential impact on confidentiality, integrity and availability. Critical and high issues that could expose personal data, credentials, or allow cross-tenant access are addressed as a priority, ahead of feature work. Medium and low issues with limited impact are scheduled into the normal work backlog and tracked to closure. Security advisor findings classified as errors halt the related release until resolved; warnings are, at minimum, recorded as backlog items.

## 4. Remediation
Remediation follows the platform's recon-first, verify-after discipline: the affected area and its blast radius are examined before a fix is applied, the fix is made additively where possible, and the result is verified against the live system — with evidence — before the issue is considered closed. Where remediation involves credentials, the affected secrets are rotated.

## 5. Change verification
Every change that touches security-relevant surfaces (database access policies, privileged functions, authentication) is verified after deployment: access policies are re-checked per role, and privileged functions are confirmed to carry their required safeguards. A change is not "done" until both the application layer and the data layer are confirmed correct.

## 6. Periodic audit
Independently of feature work, a recurring security audit is performed. It reviews privileged functions, public data paths, access policies and infrastructure advisors, and re-runs a standing security checklist. The outcome is recorded each time, including when no new findings are identified.

## 7. Threat prevention baseline
Preventive controls are maintained continuously: infrastructure-level network protection and web application firewall, TLS everywhere, least-privilege access enforced in the data layer, encrypted secrets, and anti-malware on all administrative endpoints.

## 8. Review
This procedure is reviewed at least annually and updated as the platform and threat landscape evolve.`,
  },
];

export function getSecurityPolicy(slug?: string): SecurityPolicy | undefined {
  return securityPolicies.find((p) => p.slug === slug);
}
