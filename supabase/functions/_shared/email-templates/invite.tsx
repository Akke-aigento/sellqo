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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je bent uitgenodigd voor {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Je bent uitgenodigd</Heading>
        <Text style={paragraph}>
          Je hebt een uitnodiging ontvangen om deel te nemen aan{' '}
          <Link href={siteUrl} style={linkStyle}><strong>{siteName}</strong></Link>.
          Klik op de knop hieronder om de uitnodiging te accepteren en je account
          te activeren.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>Uitnodiging accepteren</Button>
        </Section>
        <Text style={mutedParagraph}>
          Werkt de knop niet? Kopieer en plak deze link in je browser:
          <br />
          <Link href={confirmationUrl} style={linkStyle}>{confirmationUrl}</Link>
        </Text>
        <Text style={mutedParagraph}>
          Heb je deze uitnodiging niet verwacht? Dan mag je deze e-mail veilig
          negeren.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default InviteEmail