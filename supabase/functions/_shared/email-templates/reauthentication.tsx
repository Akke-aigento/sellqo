/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Head, Html, Preview, Section } from 'npm:@react-email/components@0.0.22'
import {
  Container,
  Footer,
  Header,
  Heading,
  Text,
  codeStyle,
  container,
  h1Style,
  infoBox,
  main,
  mutedParagraph,
  paragraph,
} from './_brand.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je SellQo verificatiecode</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Bevestig je identiteit</Heading>
        <Text style={paragraph}>
          Gebruik onderstaande code om je actie in SellQo te bevestigen:
        </Text>
        <Section style={infoBox}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={mutedParagraph}>
          Deze code verloopt binnen korte tijd. Heb je hem niet aangevraagd?
          Negeer deze e-mail dan veilig.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
