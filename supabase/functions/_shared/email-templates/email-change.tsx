/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Head, Html, Preview, Section } from 'npm:@react-email/components@0.0.22'
import {
  Button,
  Container,
  Footer,
  Header,
  Heading,
  Link,
  Text,
  button,
  container,
  h1Style,
  linkStyle,
  main,
  mutedParagraph,
  paragraph,
} from './_brand.tsx'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Bevestig je nieuwe e-mailadres voor {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Bevestig je e-mailadres</Heading>
        <Text style={paragraph}>
          Je hebt gevraagd om je e-mailadres voor {siteName} te wijzigen van{' '}
          <Link href={`mailto:${oldEmail}`} style={linkStyle}>{oldEmail}</Link>{' '}
          naar{' '}
          <Link href={`mailto:${newEmail}`} style={linkStyle}>{newEmail}</Link>.
          Klik op de knop hieronder om de wijziging te bevestigen.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>E-mailadres bevestigen</Button>
        </Section>
        <Text style={mutedParagraph}>
          Werkt de knop niet? Kopieer en plak deze link in je browser:
          <br />
          <Link href={confirmationUrl} style={linkStyle}>{confirmationUrl}</Link>
        </Text>
        <Text style={mutedParagraph}>
          Heb je deze wijziging niet aangevraagd? Neem dan direct contact op via{' '}
          <Link href="mailto:support@sellqo.app" style={linkStyle}>support@sellqo.app</Link>.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail