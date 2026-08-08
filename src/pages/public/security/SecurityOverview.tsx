import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { PageMeta } from '@/components/seo/PageMeta';
import { Shield, Lock, Database, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { securityPolicies } from '@/data/securityPolicies';

const iconMap = { Shield, Lock, Database, AlertTriangle, ShieldCheck } as const;

export default function SecurityOverview() {
  return (
    <>
      <PageMeta
        title="Security & Compliance — SellQo"
        description="How SellQo protects merchant and customer data: information security, access control, encryption, incident response and vulnerability management."
        path="/security"
      />
      <PublicPageLayout
        title="Security & Compliance"
        subtitle="Our security posture, documented and publicly available."
      >
        <section className="max-w-4xl mx-auto mb-16">
          <div className="bg-card rounded-2xl border border-border p-8 md:p-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Our approach</h2>
            <p className="text-lg text-muted-foreground mb-6">
              SellQo is a multi-tenant, headless e-commerce platform operated by Nomadix BV in
              Belgium. Merchants trust us with their business data and with the personal data of
              their customers, so security is a design constraint rather than an afterthought.
            </p>
            <p className="text-muted-foreground">
              Data is hosted within the European Union, encrypted in transit and at rest, and
              isolated per tenant in the database layer itself through row-level security. Privileged
              operations run only in trusted server-side functions, secrets never reach client-side
              code, and every security-relevant change is verified after deployment. The policies
              below describe how this works in practice — including how we classify data, how we
              respond to incidents, and how we handle vulnerabilities.
            </p>
            <p className="text-muted-foreground mt-4 pt-4 border-t border-border text-sm">
              <span className="font-medium text-foreground">Security contact:</span>{' '}
              <a href="mailto:security@sellqo.app" className="text-accent hover:underline">
                security@sellqo.app
              </a>{' '}
              — for merchants, partners and security researchers.
            </p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Policies</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityPolicies.map((policy) => {
              const Icon = iconMap[policy.icon];
              return (
                <Link
                  key={policy.slug}
                  to={`/security/${policy.slug}`}
                  className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors flex flex-col"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{policy.title}</h3>
                  <p className="text-sm text-muted-foreground flex-1">{policy.summary}</p>
                  <span className="text-sm text-accent inline-flex items-center gap-1 mt-4">
                    Read policy <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            All policies: Version 1.0 · Effective 8 August 2026 · Reviewed annually.
          </p>
        </section>
      </PublicPageLayout>
    </>
  );
}
