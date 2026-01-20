export type ShippingProvider = 'sendcloud' | 'myparcel' | 'shippo' | 'easypost' | 'manual';

export interface ShippingIntegration {
  id: string;
  tenant_id: string;
  provider: ShippingProvider;
  display_name: string;
  api_key: string | null;
  api_secret: string | null;
  is_active: boolean;
  is_default: boolean;
  settings: Record<string, unknown>;
  webhook_secret: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ShippingIntegrationFormData {
  provider: ShippingProvider;
  display_name: string;
  api_key?: string;
  api_secret?: string;
  is_active: boolean;
  is_default: boolean;
  settings?: Record<string, unknown>;
}

export type ShippingLabelStatus = 'pending' | 'created' | 'printed' | 'shipped' | 'delivered' | 'cancelled' | 'error';

export interface ShippingLabel {
  id: string;
  tenant_id: string;
  order_id: string;
  integration_id: string | null;
  provider: string;
  external_id: string | null;
  external_parcel_id: string | null;
  carrier: string | null;
  service_type: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  label_url: string | null;
  label_format: string | null;
  status: ShippingLabelStatus;
  error_message: string | null;
  weight_kg: number | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  shipping_cost: number | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface ShippingStatusUpdate {
  id: string;
  tenant_id: string;
  label_id: string | null;
  order_id: string | null;
  provider: string;
  external_event_id: string | null;
  status: string;
  status_message: string | null;
  location: string | null;
  carrier_status: string | null;
  event_timestamp: string | null;
  raw_payload: unknown;
  created_at: string | null;
}

export interface ShippingProviderInfo {
  id: ShippingProvider;
  name: string;
  description: string;
  logoUrl?: string;
  websiteUrl: string;
  features: string[];
  requiresApiKey: boolean;
  requiresApiSecret: boolean;
}

export const SHIPPING_PROVIDERS: ShippingProviderInfo[] = [
  {
    id: 'sendcloud',
    name: 'Sendcloud',
    description: 'Europese verzendplatform met 80+ carriers',
    websiteUrl: 'https://www.sendcloud.nl',
    features: ['Label generatie', 'Track & Trace', 'Retour portaal', '80+ carriers'],
    requiresApiKey: true,
    requiresApiSecret: true,
  },
  {
    id: 'myparcel',
    name: 'MyParcel',
    description: 'Nederlandse verzendoplossing voor PostNL, DHL en meer',
    websiteUrl: 'https://www.myparcel.nl',
    features: ['Label generatie', 'Track & Trace', 'PostNL integratie', 'DHL integratie'],
    requiresApiKey: true,
    requiresApiSecret: false,
  },
  {
    id: 'shippo',
    name: 'Shippo',
    description: 'Internationale verzendplatform',
    websiteUrl: 'https://goshippo.com',
    features: ['Multi-carrier', 'Address validation', 'Rate comparison'],
    requiresApiKey: true,
    requiresApiSecret: false,
  },
  {
    id: 'easypost',
    name: 'EasyPost',
    description: 'Developer-vriendelijke shipping API',
    websiteUrl: 'https://www.easypost.com',
    features: ['RESTful API', 'Address verification', 'Insurance'],
    requiresApiKey: true,
    requiresApiSecret: false,
  },
  {
    id: 'manual',
    name: 'Handmatig',
    description: 'Handmatige tracking invoer zonder externe integratie',
    websiteUrl: '',
    features: ['Geen kosten', 'Volledige controle', 'Alle carriers'],
    requiresApiKey: false,
    requiresApiSecret: false,
  },
];
