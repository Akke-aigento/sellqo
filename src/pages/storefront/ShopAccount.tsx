import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import { useStorefrontCustomerApi } from '@/hooks/useStorefrontCustomerApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, MapPin, Package, Lock, LogOut, Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { formatCurrency } from '@/lib/utils';
import type { StorefrontAddress } from '@/context/StorefrontAuthContext';

export default function ShopAccount() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const { customer, isAuthenticated, loading, logout, updateProfile } = useStorefrontAuth();
  const api = useStorefrontCustomerApi();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate(`/shop/${tenantSlug}/login?redirect=/shop/${tenantSlug}/account`, { replace: true });
    }
  }, [loading, isAuthenticated, navigate, tenantSlug]);

  if (loading || !customer) {
    return (
      <ShopLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <Helmet>
        <title>Mijn account | {tenant?.name || 'Shop'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mijn account</h1>
          <Button variant="ghost" size="sm" onClick={() => { logout(); navigate(`/shop/${tenantSlug}`); }}>
            <LogOut className="h-4 w-4 mr-2" /> Uitloggen
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile"><User className="h-4 w-4 mr-1 hidden sm:inline" /> Profiel</TabsTrigger>
            <TabsTrigger value="addresses"><MapPin className="h-4 w-4 mr-1 hidden sm:inline" /> Adressen</TabsTrigger>
            <TabsTrigger value="orders"><Package className="h-4 w-4 mr-1 hidden sm:inline" /> Bestellingen</TabsTrigger>
            <TabsTrigger value="security"><Lock className="h-4 w-4 mr-1 hidden sm:inline" /> Wachtwoord</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab customer={customer} updateProfile={updateProfile} />
          </TabsContent>
          <TabsContent value="addresses">
            <AddressesTab api={api} />
          </TabsContent>
          <TabsContent value="orders">
            <OrdersTab api={api} currency={tenant?.currency || 'EUR'} tenantSlug={tenantSlug || ''} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab api={api} />
          </TabsContent>
        </Tabs>
      </div>
    </ShopLayout>
  );
}

// Profile Tab
function ProfileTab({ customer, updateProfile }: { customer: any; updateProfile: any }) {
  const [firstName, setFirstName] = useState(customer.first_name || '');
  const [lastName, setLastName] = useState(customer.last_name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateProfile({ first_name: firstName, last_name: lastName, phone });
    setSaving(false);
    if (result.success) toast.success('Profiel bijgewerkt');
    else toast.error(result.error || 'Opslaan mislukt');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Persoonlijke gegevens</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>E-mailadres</Label>
            <Input value={customer.email} disabled className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Voornaam</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Achternaam</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Telefoonnummer</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Opslaan
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Addresses Tab
function AddressesTab({ api }: { api: ReturnType<typeof useStorefrontCustomerApi> }) {
  const [addresses, setAddresses] = useState<StorefrontAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', street: '', house_number: '', postal_code: '', city: '', country: 'BE' });

  useEffect(() => {
    api.getAddresses().then(data => { setAddresses(data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      let result;
      if (editId) {
        result = await api.updateAddress(editId, form as any);
      } else {
        result = await api.addAddress(form as any);
      }
      setAddresses(result || []);
      setShowForm(false);
      setEditId(null);
      setForm({ label: '', street: '', house_number: '', postal_code: '', city: '', country: 'BE' });
      toast.success(editId ? 'Adres bijgewerkt' : 'Adres toegevoegd');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await api.deleteAddress(id);
      setAddresses(result || []);
      toast.success('Adres verwijderd');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEdit = (addr: StorefrontAddress) => {
    setForm({ label: addr.label || '', street: addr.street, house_number: addr.house_number || '', postal_code: addr.postal_code, city: addr.city, country: addr.country });
    setEditId(addr.id);
    setShowForm(true);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mijn adressen</CardTitle>
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ label: '', street: '', house_number: '', postal_code: '', city: '', country: 'BE' }); }}>
            <Plus className="h-4 w-4 mr-1" /> Toevoegen
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="space-y-2">
              <Label>Label (bijv. "Thuis", "Werk")</Label>
              <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Straat</Label>
                <Input value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Nr</Label>
                <Input value={form.house_number} onChange={e => setForm(p => ({ ...p, house_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={form.postal_code} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Stad</Label>
                <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} required />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editId ? 'Bijwerken' : 'Opslaan'}</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Annuleren</Button>
            </div>
          </div>
        )}
        {addresses.length === 0 && !showForm && (
          <p className="text-muted-foreground text-center py-4">Nog geen adressen opgeslagen</p>
        )}
        {addresses.map(addr => (
          <div key={addr.id} className="flex items-start justify-between border rounded-lg p-4">
            <div>
              {addr.label && <p className="font-medium text-sm">{addr.label}</p>}
              <p className="text-sm">{addr.street} {addr.house_number}</p>
              <p className="text-sm">{addr.postal_code} {addr.city}</p>
              <p className="text-sm text-muted-foreground">{addr.country}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => startEdit(addr)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(addr.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Orders Tab
function OrdersTab({ api, currency, tenantSlug }: { api: ReturnType<typeof useStorefrontCustomerApi>; currency: string; tenantSlug: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOrders().then(data => { setOrders(data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const statusLabels: Record<string, string> = {
    pending: 'In afwachting', processing: 'In verwerking', shipped: 'Verzonden',
    delivered: 'Afgeleverd', cancelled: 'Geannuleerd', completed: 'Voltooid',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mijn bestellingen</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nog geen bestellingen</p>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString('nl-NL')}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(order.total, currency)}</p>
                  <p className="text-sm text-muted-foreground">{statusLabels[order.status] || order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Security Tab
function SecurityTab({ api }: { api: ReturnType<typeof useStorefrontCustomerApi> }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Wachtwoorden komen niet overeen'); return; }
    if (newPassword.length < 8) { toast.error('Wachtwoord moet minimaal 8 tekens bevatten'); return; }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Wachtwoord gewijzigd');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Wachtwoord wijzigen mislukt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wachtwoord wijzigen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label>Huidig wachtwoord</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Nieuw wachtwoord</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimaal 8 tekens" required />
          </div>
          <div className="space-y-2">
            <Label>Bevestig nieuw wachtwoord</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Wachtwoord wijzigen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
