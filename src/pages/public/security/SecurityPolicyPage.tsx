import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { PageMeta } from '@/components/seo/PageMeta';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { getSecurityPolicy, SECURITY_PDF_BASE_URL } from '@/data/securityPolicies';

export default function SecurityPolicyPage() {
  const { slug } = useParams<{ slug: string }>();
  const policy = getSecurityPolicy(slug);

  if (!policy) {
    return (
      <PublicPageLayout title="Policy not found" subtitle="This security policy does not exist.">
        <div className="max-w-3xl mx-auto text-center">
          <Button asChild>
            <Link to="/security">Back to Security &amp; Compliance</Link>
          </Button>
        </div>
      </PublicPageLayout>
    );
  }

  return (
    <>
      <PageMeta
        title={`${policy.title} — SellQo`}
        description={policy.summary}
        path={`/security/${policy.slug}`}
      />
      <PublicPageLayout
        title={policy.title}
        subtitle={`Version ${policy.version} · Effective ${policy.effectiveDate}`}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <Link
              to="/security"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> All policies
            </Link>
            <Button asChild variant="outline">
              <a
                href={`${SECURITY_PDF_BASE_URL}/${policy.slug}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </a>
            </Button>
          </div>

          <article className="bg-card rounded-2xl border border-border p-6 md:p-10">
            <div className="prose prose-slate max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-accent">
              <ReactMarkdown>{policy.markdown}</ReactMarkdown>
            </div>
          </article>
        </div>
      </PublicPageLayout>
    </>
  );
}
