UPDATE orders 
SET tracking_url = CASE 
  WHEN carrier ILIKE '%bpost%' THEN 'https://track.bpost.cloud/btr/web/#/search?itemCode=' || tracking_number
  WHEN carrier ILIKE '%postnl%' OR carrier = 'TNT' THEN 'https://postnl.nl/tracktrace/?B=' || tracking_number
  WHEN carrier ILIKE '%dhl%' THEN 'https://www.dhl.com/nl-nl/home/tracking.html?tracking-id=' || tracking_number
  WHEN carrier ILIKE '%dpd%' THEN 'https://tracking.dpd.de/parcelstatus?query=' || tracking_number || '&locale=nl_NL'
  WHEN carrier ILIKE '%ups%' THEN 'https://www.ups.com/track?tracknum=' || tracking_number
  WHEN carrier ILIKE '%gls%' THEN 'https://gls-group.eu/NL/nl/pakketten-volgen?match=' || tracking_number
  WHEN carrier ILIKE '%fedex%' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || tracking_number
  ELSE 'https://17track.net/nl/track?nums=' || tracking_number
END
WHERE tracking_url LIKE '%jfrfracking.info%' AND tracking_number IS NOT NULL;