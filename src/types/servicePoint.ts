export interface ServicePointAddress {
  street: string;
  house_number?: string;
  city: string;
  postal_code: string;
  country: string;
}

export interface ServicePoint {
  id: string;
  name: string;
  carrier: string;
  type: 'pickup_point' | 'locker' | 'post_office';
  address: ServicePointAddress;
  distance?: number;
  latitude?: number;
  longitude?: number;
  opening_hours?: Record<string, string>;
}

export interface ServicePointData {
  id: string;
  name: string;
  carrier: string;
  type: 'pickup_point' | 'locker' | 'post_office';
  address: ServicePointAddress;
  distance?: number;
  latitude?: number;
  longitude?: number;
  opening_hours?: Record<string, string>;
}

export type DeliveryType = 'home_delivery' | 'service_point';
