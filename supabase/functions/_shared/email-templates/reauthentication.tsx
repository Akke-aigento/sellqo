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
    <Preview>Je bevestigingscode voor SellQo</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading style={h1Style}>Bevestigingscode</Heading>
        <Text style={paragraph}>
          Gebruik onderstaande code om je actie te bevestigen. De code is 10
          minuten geldig.
        </Text>
        <Section style={infoBox}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={mutedParagraph}>
          Heb je dit niet aangevraagd? Negeer deze e-mail en wijzig je wachtwoord
          uit voorzorg.
        </Text>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail