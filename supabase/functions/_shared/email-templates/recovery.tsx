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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Stel je wachtwoord opnieuw in voor {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Wachtwoord opnieuw instellen</Heading>
        <Text style={paragraph}>
          We ontvingen een verzoek om je wachtwoord voor {siteName} opnieuw in te
          stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen. De
          link is 1 uur geldig.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>Nieuw wachtwoord instellen</Button>
        </Section>
        <Text style={mutedParagraph}>
          Werkt de knop niet? Kopieer en plak deze link in je browser:
          <br />
          <Link href={confirmationUrl} style={linkStyle}>{confirmationUrl}</Link>
        </Text>
        <Text style={mutedParagraph}>
          Heb je dit verzoek niet gedaan? Negeer deze e-mail — je wachtwoord blijft
          ongewijzigd.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail