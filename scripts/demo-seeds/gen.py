#!/usr/bin/env python3
"""DEMO-3 generator: spec.py -> SQL per winkel (data, thema, foto-prompts) + presets.json.
Deterministische UUID's (uuid5 op slug), zodat een tweede run dezelfde ID's geeft."""
import json, os, sys, uuid
sys.path.insert(0, os.path.dirname(__file__))
from spec import SHOPS, NOTE, NO_PEOPLE

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
NS = uuid.UUID('6f2b1c4e-0d4a-4a8e-9a51-5e11c0de0003')
SELLQO_TENANT = 'd03c63fe-48c6-4ff7-a30b-7506ea3e71ab'
U = lambda *parts: str(uuid.uuid5(NS, '/'.join(parts)))
q = lambda s: 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
arr = lambda xs: 'null' if not xs else "array[" + ','.join(q(x) for x in xs) + "]::text[]"
js = lambda o: q(json.dumps(o, ensure_ascii=False)) + '::jsonb'

def slugify(s):
    import re, unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:60]

PRESET_THEME = {
  'kleding': None,
  'tech':   dict(brand='#22d3ee', h='Space Grotesk', b='Inter', s=dict(background='#0b0f17', text='#e6edf6', button_style='rounded', corner_radius='medium', header_layout='left', logo_height=40, show_search=True, hero_style='split', heading_style='left', card_style='framed', container='wide', caps=False)),
  'beauty': dict(brand='#c06c84', h='Playfair Display', b='DM Sans', s=dict(background='#fbf3ef', text='#3b2a2c', button_style='pill', corner_radius='large', header_layout='center', logo_height=44, show_search=False, hero_style='boxed', heading_style='center', card_style='minimal', container='normal', caps=False)),
  'bar':    dict(brand='#e0a526', h='Bricolage Grotesque', b='DM Sans', s=dict(background='#12100c', text='#f1e7d3', button_style='rounded', corner_radius='medium', header_layout='left', logo_height=44, show_search=False, hero_style='full', heading_style='label', card_style='list', container='normal', caps=True)),
  'bistro': dict(brand='#2f5d46', h='Playfair Display', b='Lato', s=dict(background='#f7f1e6', text='#1f2a24', button_style='square', corner_radius='small', header_layout='center', logo_height=48, show_search=False, hero_style='split', heading_style='center', card_style='list', container='normal', caps=False)),
  'wijn':   dict(brand='#7a2334', h='Merriweather', b='Lato', s=dict(background='#faf6f1', text='#2a1418', button_style='square', corner_radius='none', header_layout='center', logo_height=44, show_search=True, hero_style='full', heading_style='label', card_style='minimal', container='normal', caps=True)),
  'koffie': dict(brand='#b5651d', h='Bricolage Grotesque', b='Work Sans', s=dict(background='#f4ede4', text='#2b1d14', button_style='pill', corner_radius='large', header_layout='left', logo_height=44, show_search=False, hero_style='boxed', heading_style='left', card_style='framed', container='normal', caps=False)),
}
PRESET_META = {
  'tech':   ('Tech & gadgets', 'Donker en strak, voor elektronica, gadgets en accessoires. Productfoto’s springen eruit.'),
  'beauty': ('Beauty & verzorging', 'Zacht en luchtig, voor huidverzorging, cosmetica en wellness.'),
  'bar':    ('Bar & café', 'Donker en warm, voor cafés en bars: drankkaart, bestellen aan tafel via QR en betalen aan de toog.'),
  'bistro': ('Restaurant & bistro', 'Klassiek en verzorgd, voor restaurants: menukaart met allergenen, afhalen, leveren en bestellen aan tafel.'),
  'wijn':   ('Wijn & delicatessen', 'Elegant en rustig, voor wijnhandels, delicatessen en geschenken.'),
  'koffie': ('Koffie & thee', 'Warm en ambachtelijk, voor koffiebranders, theehuizen en lokale makers.'),
}
PRODUCT_PAGE = {
  'tech':   dict(show_delivery=True, delivery_text='Vandaag besteld, morgen in huis', show_returns=True, returns_text='30 dagen retour, ook geopend', show_payment_icons=True, show_related=True, related_title='Past er perfect bij'),
  'beauty': dict(show_delivery=True, delivery_text='Gratis staaltjes bij elke bestelling', show_returns=True, returns_text='Niet tevreden? Geld terug', show_payment_icons=True, show_related=True, related_title='Maak je ritueel compleet'),
  'bar':    dict(show_delivery=False, show_returns=False, show_payment_icons=False, show_related=True, related_title='Lekker erbij'),
  'bistro': dict(show_delivery=True, delivery_text='Afhalen, leveren of aan tafel', show_returns=False, show_payment_icons=True, show_related=True, related_title='Lekker erbij'),
  'wijn':   dict(show_delivery=True, delivery_text='Zorgvuldig verpakt, binnen 2 werkdagen', show_returns=False, show_payment_icons=True, show_related=True, related_title='Ook lekker'),
  'koffie': dict(show_delivery=True, delivery_text='Vers gebrand, door je brievenbus', show_returns=False, show_payment_icons=True, show_related=True, related_title='Ook proberen'),
}

def norm(shop, p):
    """Productrij -> dict, ongeacht het tupelformaat in spec.py."""
    d = dict(cat=p[0], name=p[1], price=p[2], compare=p[3], desc=p[4], prompt=p[-1], allergens=None, dietary=None, variants=None, opt=None)
    if shop['horeca']:
        d['allergens'], d['dietary'] = p[5], p[6]
    elif len(p) == 9:
        d['allergens'], d['variants'], d['opt'] = p[5], p[6], p[7]
    elif isinstance(p[5], list) and p[5] and isinstance(p[5][0], str):
        d['allergens'] = p[5]
    else:
        d['variants'], d['opt'] = p[5], p[6]
    return d

def sections(shop):
    """Homepagesecties voor de demo (en, generiek gemaakt, voor de preset)."""
    h = shop['hero_text']
    out = [dict(section_type='hero', title=h[0], subtitle=h[1], content=dict(image_url='', button_text=h[2], button_link='/menu' if shop['horeca'] else '/producten', text_alignment='left', overlay_opacity=0.4), settings={})]
    out.append(dict(section_type='usp_bar', title=None, content=dict(items=[dict(icon=i, title=t, text=x) for i, t, x in shop['usp']]), settings=dict(style=dict(background='accent', spacing='compact'))))
    if shop['horeca']:
        out.append(dict(section_type='menu_card', title='Onze kaart', content=dict(show_images=True, max_per_category=20), settings={}))
        out.append(dict(section_type='contact_hours', title='Openingsuren', content=dict(show_hours=True, show_map=True, hours=[dict(day=d, time=t) for d, t in shop['hours']]), settings=dict(style=dict(background='muted'))))
    else:
        out.append(dict(section_type='featured_products', title='Uitgelicht', content=dict(max_products=8), settings=dict(style=dict(columns='4', image_ratio='portrait' if shop['preset'] in ('kleding', 'beauty') else 'square'))))
        out.append(dict(section_type='text_image', title=shop['story_title'], content=dict(text=shop['story_body'], image_url='', image_position='right', button_text='Bekijk alles', button_link='/producten'), settings={}))
    faq = [dict(question=a, answer=b) for a, b in shop['faq']]
    faq.append(dict(question='Is dit een echte winkel?', answer='Nee, dit is een demowinkel van SellQo. Je kan alles uitproberen, ook afrekenen, maar er wordt niets ' + shop['verb'] + ' of aangerekend.'))
    out.append(dict(section_type='faq', title='Goed om te weten', content=dict(items=faq), settings={}))
    return out

def shop_sql(shop):
    t = U(shop['slug'])
    L = [f"DO $$\nDECLARE t uuid := '{t}';\nBEGIN"]
    pay = '["bank_transfer"]' if not shop['horeca'] else '[]'
    L.append(f"""INSERT INTO tenants (id, name, slug, owner_email, owner_name, address, postal_code, city, country, currency, language, tax_percentage, primary_color, payment_methods_enabled, is_demo, billing_exempt, platform_newsletter_opt_in, notification_email, iban, bic, bank_transfer_acknowledged_manual)
VALUES (t, {q(shop['name'])}, {q(shop['slug'])}, {q(shop['slug'] + '@sellqo.app')}, 'SellQo Demo', 'Voorbeeldstraat {10 + SHOPS.index(shop) * 2}', '3000', 'Leuven', 'BE', 'EUR', 'nl', {shop['tax']}, {q(shop['color'])}, '{pay}'::jsonb, true, true, false, 'info@sellqo.app', 'BE00 0000 0000 0000', 'DEMOBEBB', true);""")
    L.append("UPDATE tenant_subscriptions SET plan_id='enterprise', status='active', trial_end=null WHERE tenant_id=t;")
    L.append("UPDATE tenants SET subscription_plan='enterprise', subscription_status='active' WHERE id=t;")
    L.append(f"DELETE FROM customers WHERE tenant_id='{SELLQO_TENANT}' AND email={q(shop['slug'] + '@sellqo.app')};")
    if shop['horeca']:
        L.append("UPDATE tenants SET business_modules = array['horeca'] WHERE id=t;")
        L.append("UPDATE tenant_feature_overrides SET granted_features = array['horeca'] WHERE tenant_id=t;")
        L.append("IF NOT FOUND THEN INSERT INTO tenant_feature_overrides (tenant_id, granted_features) VALUES (t, array['horeca']); END IF;")
    for i, (cname, cslug) in enumerate(shop['cats']):
        L.append(f"INSERT INTO categories (id, tenant_id, name, slug, sort_order, is_active) VALUES ('{U(shop['slug'], 'cat', cslug)}', t, {q(cname)}, {q(cslug)}, {i}, true);")
    track = not shop['horeca']
    for i, raw in enumerate(shop['products']):
        p = norm(shop, raw)
        pid = U(shop['slug'], 'p', p['name'])
        stock = 0 if not track else (2 if i == 1 else 15)
        L.append(f"""INSERT INTO products (id, tenant_id, category_id, name, slug, price, compare_at_price, product_type, requires_shipping, track_inventory, stock, is_active, hide_from_storefront, is_featured, short_description, description, allergens, dietary)
VALUES ('{pid}', t, '{U(shop['slug'], 'cat', p['cat'])}', {q(p['name'])}, {q(slugify(p['name']))}, {p['price']}, {p['compare'] if p['compare'] else 'null'}, 'physical', {'false' if shop['horeca'] else 'true'}, {str(track).lower()}, {stock}, true, false, {str(i < 8).lower()}, {q(p['desc'])}, {q('<p>' + p['desc'] + '</p>')}, {arr(p['allergens']) if p['allergens'] else "'{}'::text[]"}, {arr(p['dietary']) if p['dietary'] else "'{}'::text[]"});""")
        if p['variants']:
            L.append(f"INSERT INTO product_variant_options (product_id, tenant_id, name, values, position) VALUES ('{pid}', t, {q(p['opt'])}, {arr([v[0] for v in p['variants']])}, 0);")
            for j, (vt, vp, vs) in enumerate(p['variants']):
                L.append(f"INSERT INTO product_variants (product_id, tenant_id, title, price, stock, track_inventory, attribute_values, position, is_active) VALUES ('{pid}', t, {q(vt)}, {vp}, {vs}, true, {js({p['opt']: vt})}, {j}, true);")
    for gi, (gname, gmin, gmax, gcats, opts) in enumerate(shop.get('groups', [])):
        gid = U(shop['slug'], 'g', gname)
        cats = 'array[' + ','.join(f"'{U(shop['slug'], 'cat', c)}'::uuid" for c in gcats) + ']'
        L.append(f"INSERT INTO product_addon_groups (id, tenant_id, name, min_select, max_select, category_ids, sort_order, is_active) VALUES ('{gid}', t, {q(gname)}, {gmin}, {gmax}, {cats}, {gi}, true);")
        for oi, (oname, oprice) in enumerate(opts):
            L.append(f"INSERT INTO product_addon_options (group_id, tenant_id, name, price, sort_order, is_active) VALUES ('{gid}', t, {q(oname)}, {oprice}, {oi}, true);")
    for si, (sname, sprice, sfree, sft, scountries) in enumerate(shop['ship']):
        pcs = arr(['3000', '3001', '3010', '3012', '3018']) if sft == 'local_delivery' else 'null'
        minv = 25 if sft == 'local_delivery' else 'null'
        L.append(f"INSERT INTO shipping_methods (tenant_id, name, price, free_above, fulfillment_type, countries, postal_codes, min_order_amount, is_active, is_default, sort_order, estimated_days_min, estimated_days_max) VALUES (t, {q(sname)}, {sprice}, {sfree if sfree else 'null'}, {q(sft)}, {arr(scountries)}, {pcs}, {minv}, true, {str(si == 0).lower()}, {si}, {0 if sft != 'shipping' else 1}, {0 if sft != 'shipping' else 2});")
    if shop['horeca']:
        bar = shop['preset'] == 'bar'
        day = [["15:00", "23:45"]] if bar else [["12:00", "14:00"], ["18:00", "21:30"]]
        hours = {"pickup": {str(d): day for d in range(7)}}
        if not bar:
            hours["local_delivery"] = {str(d): [["18:00", "21:30"]] for d in range(7)}
        L.append(f"""INSERT INTO fulfillment_settings (tenant_id, slots_enabled, slot_minutes, prep_minutes, days_ahead, max_orders_per_slot, timezone, hours, pay_on_pickup, notify_ready, qr_mode, qr_pay_counter, qr_pay_online)
VALUES (t, true, 15, {10 if bar else 25}, 1, {10 if bar else 6}, 'Europe/Brussels', {js(hours)}, true, true, 'order', true, false);""")
    for pt, title, body in [
        ('contact', 'Contact', f"<h1>Contact</h1><p>{shop['name']} is een demowinkel van SellQo. Naam, adres en producten zijn verzonnen.</p><p>Vragen over SellQo of over deze demo? Mail naar <a href=\"mailto:info@sellqo.app\">info@sellqo.app</a>.</p>"),
        ('terms', 'Algemene voorwaarden', f"<h1>Algemene voorwaarden</h1><p>{shop['name']} is een demowinkel van SellQo. Er wordt niets {shop['verb']} of aangerekend. Bestellingen worden na 14 dagen automatisch gewist.</p><p>Contact: <a href=\"mailto:info@sellqo.app\">info@sellqo.app</a>.</p>"),
        ('privacy', 'Privacybeleid', "<h1>Privacybeleid</h1><p>Dit is een demowinkel van SellQo. Wat je hier invult, gebruiken we enkel om de demo te laten werken; het wordt na 14 dagen gewist. Gebruik bij voorkeur een testadres.</p>"),
    ] + ([] if shop['horeca'] else [
        ('shipping', 'Verzending', '<h1>Verzending</h1><p>Dit is een demowinkel: er wordt niets verzonden. In een echte winkel staan hier de levertijden en kosten.</p>'),
        ('refund', 'Retourneren', '<h1>Retourneren</h1><p>Dit is een demowinkel: er is niets te retourneren. In een echte winkel staat hier hoe je een product terugstuurt.</p>'),
    ]):
        L.append(f"INSERT INTO legal_pages (tenant_id, page_type, title_nl, content_nl, is_published, is_auto_generated) VALUES (t, {q(pt)}, {q(title)}, {q(body)}, true, false);")
    L.append(f"INSERT INTO ops.demo_shops (tenant_id, note) VALUES (t, {q(shop['name'])});")
    L.append("INSERT INTO ops.demo_stock (tenant_id, product_id, variant_id, stock) SELECT tenant_id, id, null, stock FROM products WHERE tenant_id = t AND track_inventory UNION ALL SELECT tenant_id, product_id, id, stock FROM product_variants WHERE tenant_id = t;")
    L.append("END $$;")
    return '\n'.join(L)

def theme_sql(shop):
    t = U(shop['slug'])
    th = PRESET_THEME[shop['preset']]
    if th is None:  # kleding: bestaande preset, waarden uit schema.json
        sch = json.load(open('/home/claude/sellqo-storefront/src/theme/schema.json'))
        pr = [p for p in sch['presets'] if p['id'] == 'kleding'][0]
        brand, hf, bf, settings, pp = pr['theme']['brand_color'], pr['theme']['heading_font'], pr['theme']['body_font'], pr['settings'], pr['product_page']
    else:
        brand, hf, bf, settings, pp = th['brand'], th['h'], th['b'], th['s'], PRODUCT_PAGE[shop['preset']]
    tc = dict(preset=shop['preset'], settings=settings, product_page=pp)
    note = NOTE.format(verb=shop['verb'])
    L = [f"INSERT INTO tenant_theme_settings (tenant_id, brand_color, primary_color, heading_font, body_font, theme_config, shop_live, shop_ordering, shop_live_at, is_published, storefront_status, show_announcement_bar, announcement_text) VALUES ('{t}', {q(brand)}, {q(brand)}, {q(hf)}, {q(bf)}, {js(tc)}, true, true, now(), true, 'online', true, {q(note)});"]
    for i, s in enumerate(sections(shop)):
        L.append(f"INSERT INTO homepage_sections (tenant_id, section_type, title, subtitle, content, settings, sort_order, is_visible) VALUES ('{t}', {q(s['section_type'])}, {q(s.get('title'))}, {q(s.get('subtitle'))}, {js(s['content'])}, {js(s['settings'])}, {i}, true);")
    return '\n'.join(L)

def img_sql(shop):
    t = U(shop['slug'])
    rows = [(shop['slug'] + '-hero', shop['style'] + ' ' + shop['hero'][1], '16:9'),
            (shop['slug'] + '-story', shop['style'] + ' ' + shop['story_prompt'], '4:3')]
    for raw in shop['products']:
        p = norm(shop, raw)
        rows.append((slugify(p['name']), shop['style'] + ' ' + p['prompt'] + '.', '3:4' if shop['preset'] in ('kleding', 'beauty') else '1:1'))
    vals = ',\n'.join(f"({q(s)}, '{t}', {q(pr + ' ' + NO_PEOPLE)}, {q(ar)})" for s, pr, ar in rows)
    return f"INSERT INTO ops.demo_img (slug, tenant_id, prompt, ar) VALUES\n{vals};"

def presets():
    out = []
    for shop in SHOPS:
        if PRESET_THEME[shop['preset']] is None:
            continue
        th = PRESET_THEME[shop['preset']]
        name, desc = PRESET_META[shop['preset']]
        secs = sections(shop)
        for s in secs:  # generiek: geen demonamen in de preset
            if s['section_type'] == 'faq':
                s['content']['items'] = s['content']['items'][:-1]
        out.append(dict(id=shop['preset'], name=name, description=desc,
            preview=dict(background=th['s']['background'], text=th['s']['text'], accent=th['brand'], image=''),
            theme=dict(brand_color=th['brand'], heading_font=th['h'], body_font=th['b']),
            settings=th['s'], product_page=PRODUCT_PAGE[shop['preset']], sections=secs,
            example=dict(url=f"https://{shop['slug']}.sellqo.shop", label=shop['name'])))
    return out

if __name__ == '__main__':
    for shop in SHOPS:
        for kind, fn in (('data', shop_sql), ('theme', theme_sql), ('img', img_sql)):
            open(os.path.join(OUT, f"{shop['slug']}.{kind}.sql"), 'w').write(fn(shop))
    json.dump(presets(), open(os.path.join(OUT, 'presets.json'), 'w'), ensure_ascii=False, indent=2)
    json.dump({s['slug']: U(s['slug']) for s in SHOPS}, open(os.path.join(OUT, 'tenants.json'), 'w'), indent=2)
    print('ok', len(SHOPS))
