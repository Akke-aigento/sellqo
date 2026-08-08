import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Linkedin, Twitter, Facebook } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LandingLanguageSwitcher } from './LandingLanguageSwitcher';
import { openPlatformCookieSettings } from '@/components/PlatformCookieBanner';

const socialLinks = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
];

export function LandingFooter() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const productLinks = [
    { label: t('landing.footer.links.features'), href: '#features', isAnchor: true },
    { label: t('landing.footer.links.pricing'), href: '#pricing', isAnchor: true },
    { label: t('landing.footer.links.integrations'), href: '/integrations', isAnchor: false },
    { label: t('landing.footer.links.apiDocs'), href: '/api-docs', isAnchor: false },
    { label: t('landing.footer.links.changelog'), href: '/changelog', isAnchor: false },
  ];

  const companyLinks = [
    { label: t('landing.footer.links.about'), href: '/about' },
    { label: t('landing.footer.links.blog'), href: '/blog' },
    { label: t('landing.footer.links.contact'), href: '/contact' },
    { label: t('landing.footer.links.careers'), href: '/careers' },
    { label: t('landing.footer.links.partners'), href: '/partners' },
  ];

  const supportLinks = [
    { label: t('landing.footer.links.help'), href: '/help', isAnchor: false },
    { label: t('landing.footer.links.faq'), href: '#faq', isAnchor: true },
    { label: t('landing.footer.links.status'), href: '/status', isAnchor: false },
    { label: t('landing.footer.links.contactUs'), href: '/contact', isAnchor: false },
  ];

  const legalLinks = [
    { label: t('landing.footer.links.privacy'), href: '/privacy' },
    { label: t('landing.footer.links.terms'), href: '/terms' },
    { label: t('landing.footer.links.cookies'), href: '/cookies' },
    { label: 'Security', href: '/security' },
  ];

  const handleAnchorClick = (href: string) => {
    if (href.startsWith('#')) {
      if (location.pathname === '/') {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        navigate('/' + href);
      }
    }
  };

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div>
            <SellqoLogo variant="tagline" className="mb-4 w-full max-w-[200px] md:max-w-[280px]" />
            <p className="text-muted-foreground text-sm mb-6">
              {t('landing.footer.tagline')}
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
              <button
                type="button"
                onClick={openPlatformCookieSettings}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('cookieConsent.manage')}
              </button>
            </div>
          </div>

          {/* Product column */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  {link.isAnchor ? (
                    <button
                      onClick={() => handleAnchorClick(link.href)}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('landing.footer.company')}</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support column */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('landing.footer.support')}</h4>
            <ul className="space-y-3">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  {link.isAnchor ? (
                    <button
                      onClick={() => handleAnchorClick(link.href)}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Legal entity block — required for App Store / regulatory transparency */}
        <div className="pt-8 border-t border-border">
          <div className="bg-secondary/40 rounded-lg p-5 md:p-6 mb-6">
            <h4 className="font-semibold text-foreground mb-2 text-sm uppercase tracking-wide">
              {t('landing.footer.legalEntity')}
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="text-foreground font-medium">{t('landing.footer.legalLine1')}</p>
              <p>{t('landing.footer.legalLine2')}</p>
              <p>{t('landing.footer.legalLine3')}</p>
              <p>
                {t('landing.footer.contact')}{' '}
                <a href="mailto:info@sellqo.app" className="hover:text-foreground transition-colors underline">
                  info@sellqo.app
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center lg:text-left">
              {t('landing.footer.copyright', { year: new Date().getFullYear() })}
            </p>

            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              {legalLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Language selector */}
            <LandingLanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
