## Probleem
In `LandingFooter.tsx` doet `handleAnchorClick` alleen `document.querySelector(href).scrollIntoView()`. Op andere pagina's (bv. `/careers`, `/about`) bestaan die secties niet, dus er gebeurt niets. Hetzelfde geldt voor de FAQ-link in de support-kolom.

## Oplossing
`LandingFooter.tsx` aanpassen zodat anchor-links (`#features`, `#pricing`, `#faq`) altijd werken, ook vanuit andere routes:

1. `useLocation` en `useNavigate` van `react-router-dom` gebruiken.
2. In `handleAnchorClick(href)`:
   - Als `location.pathname === '/'`: huidige gedrag (smooth scroll naar element).
   - Anders: `navigate('/' + href)` (bv. `/#features`) zodat de landing laadt met de hash.
3. Op de landing (`src/pages/Landing.tsx`) een klein `useEffect` toevoegen dat bij mount kijkt naar `window.location.hash` en na een korte delay (zodat secties gerenderd zijn) naar het overeenkomstige element scrollt. Dit dekt ook directe deep-links zoals `/#pricing`.

Alleen deze twee bestanden wijzigen. Geen wijzigingen aan `ScrollToTop`, geen andere componenten aanraken.

## Acceptatie
- Vanuit `/careers`, `/about`, etc. leidt klikken op Features / Pricing / FAQ in de footer naar de landing en scrollt naar de juiste sectie.
- Vanuit `/` blijft de smooth-scroll werken zonder route-verandering.
- `/#features` als directe URL scrollt na load naar de sectie.
