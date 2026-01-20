import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServicePointData } from "@/types/servicePoint";

interface ServicePointCardProps {
  servicePoint: ServicePointData;
  showMapLink?: boolean;
}

const carrierColors: Record<string, string> = {
  postnl: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  dhl: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  dpd: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ups: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  gls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bpost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const typeLabels: Record<string, string> = {
  pickup_point: "Afhaalpunt",
  locker: "Pakketautomaat",
  post_office: "Postkantoor",
};

const typeIcons: Record<string, React.ReactNode> = {
  pickup_point: <MapPin className="h-4 w-4" />,
  locker: <Package className="h-4 w-4" />,
  post_office: <MapPin className="h-4 w-4" />,
};

export function ServicePointCard({ servicePoint, showMapLink = true }: ServicePointCardProps) {
  const { name, carrier, type, address, opening_hours, latitude, longitude, distance } = servicePoint;

  const formatAddress = () => {
    const parts = [
      address.street,
      address.house_number,
    ].filter(Boolean).join(' ');
    
    return `${parts}, ${address.postal_code} ${address.city}`;
  };

  const formatDistance = () => {
    if (!distance) return null;
    if (distance < 1000) return `${distance}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const getGoogleMapsUrl = () => {
    if (latitude && longitude) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(formatAddress())}`;
  };

  const formatOpeningHours = () => {
    if (!opening_hours || Object.keys(opening_hours).length === 0) return null;

    const dayLabels: Record<string, string> = {
      monday: 'Ma',
      tuesday: 'Di',
      wednesday: 'Wo',
      thursday: 'Do',
      friday: 'Vr',
      saturday: 'Za',
      sunday: 'Zo',
    };

    return Object.entries(opening_hours).map(([day, hours]) => ({
      day: dayLabels[day] || day,
      hours,
    }));
  };

  const openingHoursData = formatOpeningHours();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {typeIcons[type]}
            <CardTitle className="text-base font-medium">{name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={carrierColors[carrier.toLowerCase()] || ""}>
              {carrier.toUpperCase()}
            </Badge>
            <Badge variant="secondary">
              {typeLabels[type] || type}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-foreground">{formatAddress()}</p>
            {distance && (
              <p className="text-muted-foreground text-xs mt-0.5">
                {formatDistance()} afstand
              </p>
            )}
          </div>
        </div>

        {openingHoursData && openingHoursData.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Openingstijden</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {openingHoursData.map(({ day, hours }) => (
                  <div key={day} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{day}:</span>
                    <span className="text-foreground">{hours}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showMapLink && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            asChild
          >
            <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Bekijk op kaart
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
