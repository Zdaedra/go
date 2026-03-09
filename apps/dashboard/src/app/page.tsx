"use client";

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function DashboardHome() {
  const [logs, setLogs] = useState<{ message: string; level: string }[]>([]);

  const [sites, setSites] = useState<any[]>([]);

  // Fetch sites on load
  const loadSites = async () => {
    try {
      const apiUrl = "/api";
      const res = await fetch(`${apiUrl}/v1/sites`);
      if (res.ok) setSites(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSites();
    // Connect to the Orchestrator SSE stream
    const apiUrl = "/api";
    const eventSource = new EventSource(`${apiUrl}/v1/logs/stream`);

    eventSource.addEventListener("log", (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, data].slice(-50)); // Keep last 50 logs
      } catch (err) {
        console.error("Failed to parse log event", err);
      }
    });

    return () => {
      eventSource.close();
    }
  }, []);

  const [formUrl, setFormUrl] = useState("");
  const [formName, setFormName] = useState("");
  const [formDepth, setFormDepth] = useState("3");
  const [adding, setAdding] = useState(false);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl || !formName) return;
    setAdding(true);

    try {
      const apiUrl = "/api";
      // 1. Create Site
      const createRes = await fetch(`${apiUrl}/v1/sites/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          base_url: formUrl,
          crawl_depth: parseInt(formDepth),
          game_mode: false
        })
      });

      if (!createRes.ok) throw new Error("Failed to create");
      const site = await createRes.json();

      // 2. Trigger Crawl
      await fetch(`${apiUrl}/v1/sites/${site.id}/crawl`, { method: 'POST' });

      setFormName("");
      setFormUrl("");
      loadSites();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Crawlers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pages Crawled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Features Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Games Played</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 md:grid-cols-3">
        {/* Add Site Form */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Add New Site</CardTitle>
            <CardDescription>Target a new website for crawling.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Site Name</Label>
                <Input id="name" placeholder="e.g. OGS Server" value={formName} onChange={e => setFormName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Base URL</Label>
                <Input id="url" type="url" placeholder="https://online-go.com" value={formUrl} onChange={e => setFormUrl(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth">Max Crawl Depth</Label>
                <Input id="depth" type="number" defaultValue="3" value={formDepth} onChange={e => setFormDepth(e.target.value)} />
              </div>
              {/* Note: We would want to use a Checkbox for game mode, handled below or with standard html checkbox */}
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="gamemode" className="rounded bg-background" />
                <Label htmlFor="gamemode">Enable Go Engine Gameplay mode</Label>
              </div>
              <Button type="submit" disabled={adding} className="w-full mt-4">
                {adding ? "Adding..." : "Add Site & Trigger Crawl"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sites List */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Tracked Sites</CardTitle>
              <CardDescription>Monitor status and manage crawling deployments.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No sites added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sites.map(site => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">
                          {site.name}<br />
                          <span className="text-xs text-muted-foreground">{site.base_url}</span>
                        </TableCell>
                        <TableCell>{site.status}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">View Data</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Live Logs Mockup */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Live Crawler Logs</CardTitle>
                <CardDescription>Real-time events streaming from background workers.</CardDescription>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-4 h-[250px] overflow-y-auto font-mono text-sm space-y-2">
                {logs.length === 0 && (
                  <div className="text-muted-foreground italic h-full flex items-center justify-center">
                    Waiting for crawler events...
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className={`gap-2 ${log.level === 'error' ? 'text-destructive' : 'text-foreground'}`}>
                    <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span> {log.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
