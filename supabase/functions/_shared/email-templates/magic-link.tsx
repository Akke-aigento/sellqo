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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je inloglink voor SellQo</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Log in bij SellQo</Heading>
        <Text style={paragraph}>
          Klik op de knop hieronder om in te loggen. Deze link werkt eenmalig en
          verloopt binnen korte tijd.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Inloggen bij SellQo
          </Button>
        </Section>
        <Text style={mutedParagraph}>
          Werkt de knop niet? Kopieer en plak deze link in je browser:
          <br />
          <Link href={confirmationUrl} style={linkStyle}>
            {confirmationUrl}
          </Link>
        </Text>
        <Text style={mutedParagraph}>
          Heb je deze link niet aangevraagd? Negeer deze e-mail dan — er gebeurt
          niets met je account.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
