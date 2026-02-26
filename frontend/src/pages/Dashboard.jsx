import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, Clock, Users } from "lucide-react";
import { api } from "../api/endpoints";
import Layout from "../components/Layout";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : { name: "Priyo", batch: 1, squad: 3 };
  });
  const [currentDay, setCurrentDay] = useState("Thursday");
  const [currentTime, setCurrentTime] = useState(16);
  const [floatingSeats, setFloatingSeats] = useState(10);
  const [bookingStatus, setBookingStatus] = useState(null);

  const batch1Days = ["Monday", "Tuesday", "Wednesday"];
  const batch2Days = ["Thursday", "Friday"];

  // Fetch initial status on load
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const userId = user.uid || user.name;
        const data = await api.seats.getStatus(userId);
        if (data.booked) {
          setBookingStatus(data.type); // "designated" or "floating"
        } else {
          setBookingStatus(null);
          // Only update floating seats if data provides it
          if (data.availableFloating !== undefined) {
             setFloatingSeats(data.availableFloating);
          }
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    };
    fetchStatus();
  }, [user]);

  const isDesignatedDay = 
    (user.batch === 1 && batch1Days.includes(currentDay)) ||
    (user.batch === 2 && batch2Days.includes(currentDay));

  const canBookFloating = !isDesignatedDay && currentTime >= 15;

  const handleBookDesignated = async () => {
    try {
      await api.seats.bookDesignated(user); // Pass full user object
      setBookingStatus("designated");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleBookFloating = async () => {
    if (floatingSeats > 0) {
      try {
        await api.seats.bookFloating(user); // Pass full user object
        setFloatingSeats(prev => prev - 1);
        setBookingStatus("floating");
      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    }
  };

  const handleReleaseSeat = async () => {
    try {
      await api.seats.release(user); // Pass full user object
      setBookingStatus(null);
      
      // Re-fetch status to get accurate count
      const userId = user.uid || user.name;
      const data = await api.seats.getStatus(userId);
      if (data.availableFloating !== undefined) {
          setFloatingSeats(data.availableFloating);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <Layout user={user}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Welcome back, {user.name}! 👋
          </h2>
          <p className="text-slate-600">Today is {currentDay} - Manage your seat bookings below</p>
        </div>

        <Tabs defaultValue="book" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="book">Book Seat</TabsTrigger>
            <TabsTrigger value="roster">Weekly Roster</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          
          <TabsContent value="book" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="text-blue-600" />
                  Action Center
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                
                {isDesignatedDay ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                      <p className="font-medium flex items-center gap-2">
                        <CheckCircle size={18} />
                        Today is your Designated Day
                      </p>
                    </div>
                    
                    {!bookingStatus ? (
                      <Button onClick={handleBookDesignated} className="w-full bg-blue-600 hover:bg-blue-700">
                        Confirm Designated Seat
                      </Button>
                    ) : (
                      <Button onClick={handleReleaseSeat} variant="destructive" className="w-full">
                        Not Coming? Release Seat
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 text-orange-800 rounded-lg border border-orange-100 flex justify-between items-center">
                      <p className="font-medium">Buffer Seats Available</p>
                      <span className="text-2xl font-bold">{floatingSeats}</span>
                    </div>

                    {!bookingStatus ? (
                      <Button 
                        onClick={handleBookFloating} 
                        disabled={!canBookFloating || floatingSeats === 0}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300"
                      >
                        {canBookFloating ? "Book Floating Seat" : "Unlocks at 3 PM day prior"}
                      </Button>
                    ) : (
                      <Button onClick={handleReleaseSeat} variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                        Cancel Floating Booking
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roster" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="text-blue-600" />
                  Weekly Roster
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg flex justify-between ${batch1Days.includes(currentDay) ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border'}`}>
                    <span className="font-medium">Mon - Wed</span>
                    <span className="text-sm bg-white px-2 py-1 rounded shadow-sm">Batch 1</span>
                  </div>
                  <div className={`p-3 rounded-lg flex justify-between ${batch2Days.includes(currentDay) ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border'}`}>
                    <span className="font-medium">Thu - Fri</span>
                    <span className="text-sm bg-white px-2 py-1 rounded shadow-sm">Batch 2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>My Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-600">Name:</span>
                  <span className="text-slate-900">{user.name}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-600">Batch:</span>
                  <span className="text-slate-900">{user.batch}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-600">Squad:</span>
                  <span className="text-slate-900">{user.squad}</span>
                </div>
                {bookingStatus && (
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="font-medium text-green-800">Current Booking:</span>
                    <span className="text-green-900 capitalize font-semibold">{bookingStatus}</span>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4" 
                  onClick={() => navigate("/profile")}
                >
                  View Full Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
};

export default Dashboard;
