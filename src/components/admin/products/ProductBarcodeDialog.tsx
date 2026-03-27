import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Download, Printer, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ProductBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    name: string;
    sku: string | null;
    barcode: string | null;
    price: number;
  } | null;
}

type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC';

export function ProductBarcodeDialog({ open, onOpenChange, product }: ProductBarcodeDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [includePrice, setIncludePrice] = useState(true);

  const barcodeValue = product?.barcode || product?.sku || '';

  // Determine best format
  useEffect(() => {
    if (!barcodeValue) return;
    if (/^\d{13}$/.test(barcodeValue)) setFormat('EAN13');
    else if (/^\d{8}$/.test(barcodeValue)) setFormat('EAN8');
    else if (/^\d{12}$/.test(barcodeValue)) setFormat('UPC');
    else setFormat('CODE128');
  }, [barcodeValue]);

  // Render barcode
  useEffect(() => {
    if (!svgRef.current || !barcodeValue || !open) return;

    try {
      JsBarcode(svgRef.current, barcodeValue, {
        format,
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        textMargin: 6,
      });
    } catch {
      // Invalid format for this value – fallback to CODE128
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          textMargin: 6,
        });
      } catch {
        // still fails – show empty
      }
    }
  }, [barcodeValue, format, open]);

  const handleDownloadPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Add label area
      const labelHeight = includePrice ? 40 : 20;
      canvas.width = img.width;
      canvas.height = img.height + labelHeight;
      ctx!.fillStyle = '#fff';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);

      // Product name
      ctx!.fillStyle = '#000';
      ctx!.font = 'bold 12px Arial';
      ctx!.textAlign = 'center';
      const name = product?.name || '';
      const shortName = name.length > 30 ? name.substring(0, 30) + '…' : name;
      ctx!.fillText(shortName, canvas.width / 2, 14);

      // Barcode
      ctx!.drawImage(img, 0, 18);

      // Price
      if (includePrice && product) {
        ctx!.font = 'bold 14px Arial';
        ctx!.fillText(
          `€ ${product.price.toFixed(2)}`,
          canvas.width / 2,
          img.height + labelHeight - 4
        );
      }

      const link = document.createElement('a');
      link.download = `barcode-${barcodeValue}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Barcode gedownload');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode – ${product?.name}</title>
          <style>
            @page { size: 50mm 30mm; margin: 2mm; }
            body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; }
            .name { font-size: 9px; font-weight: bold; text-align: center; margin-bottom: 2px; max-width: 46mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            svg { max-width: 46mm; }
            .price { font-size: 10px; font-weight: bold; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="name">${product?.name || ''}</div>
          ${svgData}
          ${includePrice && product ? `<div class="price">€ ${product.price.toFixed(2)}</div>` : ''}
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(barcodeValue);
    toast.success('Barcode gekopieerd');
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Barcode</DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {barcodeValue ? (
            <>
              <div className="flex justify-center bg-white p-4 rounded-lg border">
                <svg ref={svgRef} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Formaat</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as BarcodeFormat)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">CODE128</SelectItem>
                      <SelectItem value="EAN13">EAN-13</SelectItem>
                      <SelectItem value="EAN8">EAN-8</SelectItem>
                      <SelectItem value="UPC">UPC-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Waarde</Label>
                  <div className="flex items-center gap-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">{barcodeValue}</code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded border-input"
                />
                Prijs op label ({`€ ${product.price.toFixed(2)}`})
              </label>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Geen barcode of SKU ingesteld voor dit product.</p>
              <p className="text-sm mt-1">Voeg een barcode (EAN) of SKU toe in de productinstellingen.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          {barcodeValue && (
            <>
              <Button variant="outline" onClick={handleDownloadPNG}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Afdrukken
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
