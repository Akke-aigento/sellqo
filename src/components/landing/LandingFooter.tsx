import { Link } from 'react-router-dom';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Linkedin, Twitter, Facebook } from 'lucide-react';

const productLinks = [
  { label: 'Features', href: '#features', isAnchor: true },
  { label: 'Prijzen', href: '#pricing', isAnchor: true },
  { label: 'Integraties', href: '/integrations', isAnchor: false },
  { label: 'API Docs', href: '/api-docs', isAnchor: false },
  { label: 'Changelog', href: '/changelog', isAnchor: false },
];

const companyLinks = [
  { label: 'Over Ons', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'Careers', href: '/careers' },
  { label: 'Partners', href: '/partners' },
];

const supportLinks = [
  { label: 'Help Center', href: '/help', isAnchor: false },
  { label: 'FAQ', href: '#faq', isAnchor: true },
  { label: 'Status Page', href: '/status', isAnchor: false },
  { label: 'Neem Contact Op', href: '/contact', isAnchor: false },
];

const socialLinks = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Algemene Voorwaarden', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
];

export function LandingFooter() {
  const handleAnchorClick = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
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
              E-commerce management, zoals het hoort.
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
            </div>
          </div>

          {/* Product column */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
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
            <h4 className="font-semibold text-foreground mb-4">Bedrijf</h4>
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
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
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
              Legal entity
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="text-foreground font-medium">SellQo is a product of Nomadix BV</p>
              <p>Beekstraat 49, 3051 Oud-Heverlee, Belgium</p>
              <p>VAT / Company number: BE 1017.500.207</p>
              <p>
                Contact:{' '}
                <a href="mailto:info@sellqo.app" className="hover:text-foreground transition-colors underline">
                  info@sellqo.app
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center lg:text-left">
              © {new Date().getFullYear()} Nomadix BV. All rights reserved.
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
              <Link
                to="/contact"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Contact
              </Link>
            </div>

            {/* Language selector */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button className="hover:text-foreground transition-colors">🇳🇱 NL</button>
              <span>|</span>
              <button className="hover:text-foreground transition-colors">🇬🇧 EN</button>
              <span>|</span>
              <button className="hover:text-foreground transition-colors">🇫🇷 FR</button>
              <span>|</span>
              <button className="hover:text-foreground transition-colors">🇩🇪 DE</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
