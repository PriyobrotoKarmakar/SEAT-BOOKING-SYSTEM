import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { adminApi } from "../api/adminEndpoints";
import { api } from "../api/endpoints";
import { toast } from "sonner";
import { UserPlus, UserMinus, AlertTriangle } from "lucide-react";

export const AdminSeatOverride = ({
  seatId,
  date,
  isOpen,
  onClose,
  currentOccupant,
  refreshData,
}) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookedUserIds, setBookedUserIds] = useState(new Set());
  const [overrideType, setOverrideType] = useState("book");

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setSelectedUser("");
      const [data, bookedSeats] = await Promise.all([
        adminApi.getAllUsers(),
        api.seats.getDailyBookedSeats(date),
      ]);
      setUsers(data);
      setBookedUserIds(new Set(bookedSeats.map((s) => s.userId)));
    } catch {
      toast.error("Failed to load users for override");
    }
  };

  const handleAction = async () => {
    setLoading(true);
    try {
      if (overrideType === "release") {
        if (!currentOccupant) return;
        await adminApi.releaseSeat(currentOccupant.userId, date);
        toast.success(`Released seat #${seatId}`);
      } else {
        if (!selectedUser) return;
        const user = users.find((u) => (u.uid || u.id) === selectedUser);
        const uid = user.uid || user.id;
        await adminApi.overrideBookSeat(
          uid,
          user.name,
          user.batch,
          date,
          seatId,
        );
        toast.success(`Force booked seat #${seatId} for ${user.name}`);
      }
      onClose();
      refreshData(); // Refresh map
    } catch (error) {
      toast.error(error.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Admin Override: Seat #{seatId}
          </DialogTitle>
          <DialogDescription>
            Date: {date}. This bypasses all rules (cutoff, batch, etc).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentOccupant ? (
            <div className="p-3 bg-slate-50 border rounded-md mb-4 text-sm">
              <strong>Currently Occupied By:</strong> {currentOccupant.userName}{" "}
              <br />
              <span className="text-slate-500 text-xs">
                User ID: {currentOccupant.userId}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-md mb-4 text-sm">
              Seat is currently empty.
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <Button
              variant={overrideType === "book" ? "default" : "outline"}
              onClick={() => setOverrideType("book")}
              className="flex-1"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Force Book
            </Button>
            {currentOccupant && (
              <Button
                variant={overrideType === "release" ? "destructive" : "outline"}
                onClick={() => setOverrideType("release")}
                className="flex-1"
              >
                <UserMinus className="mr-2 h-4 w-4" /> Force Release
              </Button>
            )}
          </div>

          {overrideType === "book" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select User to Book For:
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Search/Select User" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {users
                    .filter(
                      (u) =>
                        !u.isAdmin &&
                        u.email !== "priyobroto@gmail.com" &&
                        !bookedUserIds.has(u.uid || u.id),
                    )
                    .map((u) => (
                      <SelectItem key={u.uid || u.id} value={u.uid || u.id}>
                        {u.name} (Batch {u.batch})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {overrideType === "release" && (
            <p className="text-red-500 text-sm">
              Are you sure you want to kick{" "}
              <strong>{currentOccupant?.userName}</strong>? They will receive a
              notification (if socket connected).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAction}
            disabled={loading || (overrideType === "book" && !selectedUser)}
            className={
              overrideType === "release" ? "bg-red-600 hover:bg-red-700" : ""
            }
          >
            {loading ? "Processing..." : "Confirm Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
