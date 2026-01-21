import { Link } from 'react-router-dom';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Linkedin, Twitter, Facebook } from 'lucide-react';

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Prijzen', href: '#pricing' },
  { label: 'Integraties', href: '#' },
  { label: 'API Docs', href: '#' },
  { label: 'Changelog', href: '#' },
];

const companyLinks = [
  { label: 'Over Ons', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Partners', href: '#' },
];

const supportLinks = [
  { label: 'Help Center', href: '#' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Status Page', href: '#' },
  { label: 'Neem Contact Op', href: '#' },
];

const socialLinks = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Algemene Voorwaarden', href: '#' },
  { label: 'Cookie Policy', href: '#' },
];

export function LandingFooter() {
  const handleNavClick = (href: string) => {
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div>
            <SellqoLogo variant="tagline" width={200} className="mb-4" />
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
                  <button
                    onClick={() => handleNavClick(link.href)}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </button>
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
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </a>
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
                  <button
                    onClick={() => handleNavClick(link.href)}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 SellQo BV - Made with ❤️ in Belgium
          </p>
          
          <div className="flex flex-wrap justify-center gap-6">
            {legalLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
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
    </footer>
  );
}
