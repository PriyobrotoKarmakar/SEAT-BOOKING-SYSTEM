import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "../api/adminEndpoints";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdate = async (userId, newBatch) => {
    try {
      await adminApi.updateUserBatch(userId, newBatch);
      setUsers(
        users.map((u) =>
          u.uid === userId ? { ...u, batch: Number(newBatch) } : u,
        ),
      );
      toast.success("User batch updated");
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const filteredUsers = users
    .filter((user) => !user.isAdmin && user.email !== "priyobroto@gmail.com")
    .filter(
      (user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>User Management</span>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center p-4">Loading users...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        defaultValue={String(user.batch)}
                        onValueChange={(val) =>
                          handleBatchUpdate(user.uid, val)
                        }
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Batch 1</SelectItem>
                          <SelectItem value="2">Batch 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>Squad {user.squad}</TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">
                          Admin
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">User</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
