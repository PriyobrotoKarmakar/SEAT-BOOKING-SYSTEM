import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Users, Calendar } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/endpoints";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", batch: 1, squad: 1 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setFormData({
        name: parsed.name || "",
        batch: parsed.batch || 1,
        squad: parsed.squad || 1,
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.auth.updateProfile({
        uid: user.uid,
        ...formData,
      });
      setUser(response.user);
      localStorage.setItem("user", JSON.stringify(response.user));
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(error.message || "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>
          <p className="text-slate-500 mt-1">Manage your account details</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isEditing ? "Edit Information" : "Personal Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <form
                id="profile-form"
                onSubmit={handleUpdate}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address (Cannot be changed)
                  </Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch</Label>
                    <Input
                      id="batch"
                      type="number"
                      min="1"
                      value={formData.batch}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          batch: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="squad">Squad</Label>
                    <Input
                      id="squad"
                      type="number"
                      min="1"
                      value={formData.squad}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          squad: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <User className="text-blue-600" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">Full Name</p>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Mail className="text-green-600" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">Email Address</p>
                    <p className="font-semibold text-slate-900">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="bg-purple-100 p-3 rounded-full">
                      <Calendar className="text-purple-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">Batch</p>
                      <p className="font-semibold text-slate-900">
                        {user.batch}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="bg-orange-100 p-3 rounded-full">
                      <Users className="text-orange-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">Squad</p>
                      <p className="font-semibold text-slate-900">
                        {user.squad}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          {isEditing && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="profile-form" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isEditing && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            )}
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;
