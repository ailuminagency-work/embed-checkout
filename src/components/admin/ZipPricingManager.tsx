import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface PricingZone {
  id: string;
  zone_name: string;
  minimum_price: number;
  active: boolean;
}

interface ZipMapRow {
  id: string;
  zip_code: string;
  zone_id: string;
  active: boolean;
}

export function ZipPricingManager() {
  const { toast } = useToast();
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [zipRows, setZipRows] = useState<ZipMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [zipDialogOpen, setZipDialogOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ zone_name: "", minimum_price: 0 });
  const [zipForm, setZipForm] = useState({ zip_code: "", zone_id: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: zoneData, error: zoneError }, { data: zipData, error: zipError }] = await Promise.all([
      supabase.from("pricing_zones").select("id, zone_name, minimum_price, active").order("zone_name"),
      supabase.from("zip_to_zone").select("id, zip_code, zone_id, active").order("zip_code"),
    ]);

    if (zoneError || zipError) {
      toast({ variant: "destructive", title: "Unable to load ZIP pricing" });
    } else {
      setZones((zoneData ?? []) as PricingZone[]);
      setZipRows((zipData ?? []) as ZipMapRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const zoneMap = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);
  const filteredZipRows = useMemo(
    () => zipRows.filter((row) => row.zip_code.includes(search.trim())),
    [zipRows, search],
  );

  const saveZone = async () => {
    const { error } = await supabase.from("pricing_zones").insert(zoneForm);
    if (error) {
      toast({ variant: "destructive", title: "Zone save failed", description: error.message });
      return;
    }
    setZoneDialogOpen(false);
    setZoneForm({ zone_name: "", minimum_price: 0 });
    fetchData();
  };

  const saveZip = async () => {
    const { error } = await supabase.from("zip_to_zone").insert(zipForm);
    if (error) {
      toast({ variant: "destructive", title: "ZIP save failed", description: error.message });
      return;
    }
    setZipDialogOpen(false);
    setZipForm({ zip_code: "", zone_id: zones[0]?.id ?? "" });
    fetchData();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zones</CardTitle>
          <CardDescription>Manage minimum charges by pricing zone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Zone</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Zone</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Zone name</Label><Input value={zoneForm.zone_name} onChange={(e) => setZoneForm((s) => ({ ...s, zone_name: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Minimum price</Label><Input type="number" min={0} value={zoneForm.minimum_price} onChange={(e) => setZoneForm((s) => ({ ...s, minimum_price: Number(e.target.value) }))} /></div>
              </div>
              <DialogFooter><Button onClick={saveZone}>Save Zone</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Table>
            <TableHeader><TableRow><TableHead>Zone</TableHead><TableHead>Minimum</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell>
                    <Input value={zone.zone_name} onChange={async (e) => {
                      const value = e.target.value;
                      setZones((rows) => rows.map((row) => row.id === zone.id ? { ...row, zone_name: value } : row));
                      await supabase.from("pricing_zones").update({ zone_name: value }).eq("id", zone.id);
                    }} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={zone.minimum_price} onChange={async (e) => {
                      const value = Number(e.target.value);
                      setZones((rows) => rows.map((row) => row.id === zone.id ? { ...row, minimum_price: value } : row));
                      await supabase.from("pricing_zones").update({ minimum_price: value }).eq("id", zone.id);
                    }} />
                  </TableCell>
                  <TableCell><Switch checked={zone.active} onCheckedChange={async (checked) => {
                    setZones((rows) => rows.map((row) => row.id === zone.id ? { ...row, active: checked } : row));
                    await supabase.from("pricing_zones").update({ active: checked }).eq("id", zone.id);
                  }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ZIP Codes</CardTitle>
          <CardDescription>Search, assign, and disable ZIP mappings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Search ZIP codes" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Dialog open={zipDialogOpen} onOpenChange={setZipDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add ZIP</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New ZIP Mapping</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>ZIP code</Label><Input value={zipForm.zip_code} onChange={(e) => setZipForm((s) => ({ ...s, zip_code: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Zone ID</Label><Input value={zipForm.zone_id} onChange={(e) => setZipForm((s) => ({ ...s, zone_id: e.target.value }))} placeholder={zones[0]?.id ?? "Select a zone"} /></div>
                </div>
                <DialogFooter><Button onClick={saveZip}>Save ZIP</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>ZIP</TableHead><TableHead>Zone</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filteredZipRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Input value={row.zip_code} onChange={async (e) => {
                    const value = e.target.value;
                    setZipRows((rows) => rows.map((zip) => zip.id === row.id ? { ...zip, zip_code: value } : zip));
                    await supabase.from("zip_to_zone").update({ zip_code: value }).eq("id", row.id);
                  }} /></TableCell>
                  <TableCell><Input value={zoneMap.get(row.zone_id)?.zone_name ?? row.zone_id} onChange={async (e) => {
                    const zone = zones.find((item) => item.zone_name === e.target.value || item.id === e.target.value);
                    if (!zone) return;
                    setZipRows((rows) => rows.map((zip) => zip.id === row.id ? { ...zip, zone_id: zone.id } : zip));
                    await supabase.from("zip_to_zone").update({ zone_id: zone.id }).eq("id", row.id);
                  }} /></TableCell>
                  <TableCell><Switch checked={row.active} onCheckedChange={async (checked) => {
                    setZipRows((rows) => rows.map((zip) => zip.id === row.id ? { ...zip, active: checked } : zip));
                    await supabase.from("zip_to_zone").update({ active: checked }).eq("id", row.id);
                  }} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={async () => {
                    await supabase.from("zip_to_zone").delete().eq("id", row.id);
                    fetchData();
                  }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}