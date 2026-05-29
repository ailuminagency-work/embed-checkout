import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Copy, Eye, EyeOff, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = crypto.getRandomValues(new Uint8Array(40));
  return "sk_" + Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

export function ApiKeysManager() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, permissions, active, last_used_at, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Failed to load API keys", description: error.message });
    } else {
      setKeys(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const raw = generateKey();
    const prefix = raw.slice(0, 8);
    const hash = await hashKey(raw);

    const { error } = await supabase.from("api_keys").insert({
      name: newName.trim(),
      key_prefix: prefix,
      key_hash: hash,
      permissions: ["read:bookings", "read:catalog"],
    });

    setCreating(false);
    if (error) {
      toast({ variant: "destructive", title: "Failed to create key", description: error.message });
    } else {
      setGeneratedKey(raw);
      setNewName("");
      setDialogOpen(true);
      await loadKeys();
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    const { error } = await supabase.from("api_keys").update({ active: false }).eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Failed to revoke key", description: error.message });
    } else {
      toast({ title: `"${name}" revoked` });
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, active: false } : k));
    }
  };

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Use API keys to connect external apps to your booking system via the REST API.
          The base URL is{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/v1
          </code>
        </p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Generate New Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Mobile App, CRM Integration…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading keys…
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No API keys yet. Generate one above to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} className={k.active ? "" : "opacity-50"}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{k.name}</span>
                        {k.active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Revoked</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {k.key_prefix}••••••••••••••••••••••••••••••••
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span>Created {format(parseISO(k.created_at), "MMM d, yyyy")}</span>
                        {k.last_used_at && (
                          <span>Last used {format(parseISO(k.last_used_at), "MMM d, yyyy")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {k.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRevoke(k.id, k.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New key dialog — shows full key once */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setRevealed(false); setGeneratedKey(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                readOnly
                value={generatedKey ?? ""}
                type={revealed ? "text" : "password"}
                className="font-mono text-xs pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRevealed((r) => !r)}>
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyKey}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this key in your requests as the <code className="bg-muted px-1 py-0.5 rounded">X-Api-Key</code> header.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setDialogOpen(false); setRevealed(false); setGeneratedKey(null); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
