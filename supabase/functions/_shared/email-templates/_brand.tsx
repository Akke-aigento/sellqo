/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Button,
  Container,
  Heading,
  Img,
  Link,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export const BRAND = {
  primary: '#1d3a5f',
  accent: '#ff7733',
  text: '#1a2332',
  muted: '#5b6b7d',
  border: '#e4e8ee',
  footerText: '#8a96a4',
}

export const LOGO_URL = 'https://sellqo.app/email-logo.png'
export const SUPPORT_EMAIL = 'support@sellqo.app'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  color: BRAND.text,
}

export const container = { padding: '32px 24px', maxWidth: '560px' }

export const h1Style = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: BRAND.text,
  margin: '0 0 16px',
  lineHeight: '1.3',
}

export const paragraph = {
  fontSize: '15px',
  color: BRAND.text,
  lineHeight: '1.6',
  margin: '0 0 16px',
}

export const mutedParagraph = {
  fontSize: '13px',
  color: BRAND.muted,
  lineHeight: '1.6',
  margin: '24px 0 0',
}

export const linkStyle = { color: BRAND.primary, textDecoration: 'underline' }

export const button = {
  backgroundColor: BRAND.primary,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const infoBox = {
  backgroundColor: '#f4f6f9',
  border: `1px solid ${BRAND.border}`,
  borderRadius: '8px',
  padding: '20px',
  margin: '16px 0 24px',
  textAlign: 'center' as const,
}

export const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  letterSpacing: '6px',
  color: BRAND.primary,
  margin: '0',
}

export const footerWrap = {
  borderTop: `1px solid ${BRAND.border}`,
  marginTop: '32px',
  paddingTop: '24px',
}

export const footerText = {
  fontSize: '12px',
  color: BRAND.footerText,
  lineHeight: '1.6',
  margin: '0 0 6px',
}

export const Header = () => (
  <Section style={{ textAlign: 'center', padding: '0 0 24px' }}>
    <Link href="https://sellqo.app">
      <Img
        src={LOGO_URL}
        alt="SellQo"
        height="40"
        style={{ height: '40px', width: 'auto', display: 'inline-block', border: 0 }}
      />
    </Link>
  </Section>
)

export const Footer = () => (
  <Section style={footerWrap}>
    <Text style={footerText}>
      Verzonden door{' '}
      <Link href="https://sellqo.app" style={{ color: BRAND.footerText, textDecoration: 'underline' }}>
        SellQo
      </Link>{' '}
      · Jouw webshop. Simpel online.
    </Text>
    <Text style={footerText}>
      Vragen? Mail ons op{' '}
      <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: BRAND.footerText, textDecoration: 'underline' }}>
        {SUPPORT_EMAIL}
      </Link>
      .
    </Text>
    <Text style={{ ...footerText, fontSize: '11px', marginTop: '8px' }}>
      © {new Date().getFullYear()} SellQo. Alle rechten voorbehouden.
    </Text>
  </Section>
)

export { Button, Container, Heading, Link, Section, Text }