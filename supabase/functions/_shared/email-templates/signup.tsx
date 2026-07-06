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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Bevestig je e-mailadres voor {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Welkom bij {siteName}</Heading>
        <Text style={paragraph}>
          Bedankt voor je registratie bij{' '}
          <Link href={siteUrl} style={linkStyle}><strong>{siteName}</strong></Link>.
          Bevestig je e-mailadres (
          <Link href={`mailto:${recipient}`} style={linkStyle}>{recipient}</Link>
          ) om je account te activeren en aan de slag te gaan met je webshop.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>Account bevestigen</Button>
        </Section>
        <Text style={mutedParagraph}>
          Werkt de knop niet? Kopieer en plak deze link in je browser:
          <br />
          <Link href={confirmationUrl} style={linkStyle}>{confirmationUrl}</Link>
        </Text>
        <Text style={mutedParagraph}>
          Heb je geen account aangemaakt? Dan kun je deze e-mail veilig negeren.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail