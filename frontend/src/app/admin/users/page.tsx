"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, User } from "lucide-react";

interface AdminUser extends UserProfile {
  org_name?: string;
}

const MOCK_USERS: AdminUser[] = [
  { id: "u1", email: "sarah@apex.com", first_name: "Sarah", last_name: "Chen", role: "admin", organization_id: "1", org_name: "Apex Insurance Group", is_active: true, created_at: "2025-01-10T00:00:00Z", updated_at: "2025-03-20T00:00:00Z" },
  { id: "u2", email: "mike@apex.com", first_name: "Mike", last_name: "Torres", role: "agent", organization_id: "1", org_name: "Apex Insurance Group", is_active: true, created_at: "2025-01-15T00:00:00Z", updated_at: "2025-03-18T00:00:00Z" },
  { id: "u3", email: "jane@blueharbor.com", first_name: "Jane", last_name: "Park", role: "admin", organization_id: "2", org_name: "Blue Harbor Agency", is_active: true, created_at: "2025-02-14T00:00:00Z", updated_at: "2025-03-21T00:00:00Z" },
  { id: "u4", email: "tom@coastal.com", first_name: "Tom", last_name: "Walsh", role: "agent", organization_id: "3", org_name: "Coastal Coverage LLC", is_active: false, created_at: "2025-03-01T00:00:00Z", updated_at: "2025-03-05T00:00:00Z" },
  { id: "u5", email: "lisa@eagle.com", first_name: "Lisa", last_name: "Novak", role: "superadmin", organization_id: "5", org_name: "Eagle Eye Brokers", is_active: true, created_at: "2024-12-05T00:00:00Z", updated_at: "2025-03-24T00:00:00Z" },
];

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<AdminUser[]>("/admin/users"),
    placeholderData: MOCK_USERS,
    staleTime: 60_000,
  });

  const all = users ?? MOCK_USERS;

  const filtered = all.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      (u.org_name ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const roleColor = (role: string) => {
    if (role === "superadmin") return "bg-indigo-500/20 text-indigo-300";
    if (role === "admin") return "bg-blue-500/20 text-blue-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-indigo-100">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">{all.length} users across all tenants</p>
      </div>

      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or org..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 bg-white/5 border-white/10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground">User</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Organization</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Role</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((user) => (
                  <TableRow key={user.id} className="border-white/5 hover:bg-indigo-500/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.org_name ?? user.organization_id}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 capitalize ${roleColor(user.role)}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${user.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                        {user.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No users match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
