import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Users, Calendar } from "lucide-react";
import Layout from "../components/Layout";

const Profile = ({ user = { name: "Priyo", email: "priyo@wissen.com", batch: 1, squad: 3 } }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any auth tokens here
    navigate("/login");
  };

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>
          <p className="text-slate-500 mt-1">Manage your account details</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
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
                  <p className="font-semibold text-slate-900">{user.batch}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="bg-orange-100 p-3 rounded-full">
                  <Users className="text-orange-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Squad</p>
                  <p className="font-semibold text-slate-900">{user.squad}</p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full">
              Edit Profile
            </Button>
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              Logout
            </Button>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default Profile;
