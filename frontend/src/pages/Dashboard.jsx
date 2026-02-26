import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, Clock, Users } from "lucide-react";
import { api, socket } from "../api/endpoints";
import { toast } from "sonner";
import Layout from "../components/Layout";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Create Date object factoring in local timezone strictly for UI display logic
  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const currentDay = selectedDateObj.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const [floatingSeats, setFloatingSeats] = useState(10);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);

  const batch1Days = ["Monday", "Tuesday", "Wednesday"];
  const batch2Days = ["Thursday", "Friday"];

  // Fetch initial status on load and when selectedDate changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = user.uid || user.name;
        // Pass selectedDate to getStatus
        const data = await api.seats.getStatus(userId, selectedDate);
        if (data.booked) {
          setBookingStatus(data.type); // "designated" or "floating"
        } else {
          setBookingStatus(null);
          // Only update floating seats if data provides it
          if (data.availableFloating !== undefined) {
            setFloatingSeats(data.availableFloating);
          }
        }

        // Fetch weekly roster data
        const today = new Date();
        const currentDayOfWk = today.getDay();
        const msPerDay = 24 * 60 * 60 * 1000;
        const startOfWeek = new Date(
          today.getTime() - (currentDayOfWk - 1) * msPerDay,
        )
          .toISOString()
          .split("T")[0];
        const endOfWeek = new Date(
          today.getTime() + (5 - currentDayOfWk) * msPerDay,
        )
          .toISOString()
          .split("T")[0];

        try {
          const weekly = await api.seats.getWeekly(startOfWeek, endOfWeek);
          if (weekly) {
            // Sort by date just in case
            weekly.sort((a, b) => a.date.localeCompare(b.date));
            setWeeklyData(weekly);
          }
        } catch (we) {
          console.error("Failed to fetch weekly data", we);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();

    // Socket.io real-time connection
    socket.connect();

    const handleSeatUpdate = (payload) => {
      // If the updated date matches the currently viewed date, or we want to update the weekly roster
      if (payload.date === selectedDate || payload.date) {
        fetchData();
        // optionally: toast.info("Seat availability updated in real-time");
      }
    };

    socket.on("seatUpdate", handleSeatUpdate);

    return () => {
      socket.off("seatUpdate", handleSeatUpdate);
      socket.disconnect();
    };
  }, [user, selectedDate]);

  const isDesignatedDay =
    (user.batch === 1 && batch1Days.includes(currentDay)) ||
    (user.batch === 2 && batch2Days.includes(currentDay));

  // Determine if floating can be booked for the selected date
  const now = new Date();
  const bookingDay = new Date(selectedDate + "T00:00:00");
  const previousDay = new Date(bookingDay);
  previousDay.setDate(bookingDay.getDate() - 1);
  previousDay.setHours(15, 0, 0, 0); // 3 PM previous day

  const isAfterCutoff = now > previousDay;
  const canBookFloating = !isDesignatedDay && isAfterCutoff;

  const handleBookDesignated = async () => {
    try {
      await api.seats.bookDesignated(user, selectedDate); // Pass full user object and date
      setBookingStatus("designated");
      toast.success("Designated seat booked successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to book designated seat.");
    }
  };

  const handleBookFloating = async () => {
    if (floatingSeats > 0) {
      try {
        await api.seats.bookFloating(user, selectedDate); // Pass full user object and date
        setFloatingSeats((prev) => prev - 1);
        setBookingStatus("floating");
        toast.success("Floating seat booked successfully!");
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Failed to book floating seat.");
      }
    }
  };

  const handleReleaseSeat = async () => {
    try {
      await api.seats.release(user, selectedDate); // Pass full user object and date
      setBookingStatus(null);

      // Re-fetch status to get accurate count
      const userId = user.uid || user.name;
      const data = await api.seats.getStatus(userId, selectedDate);
      if (data.availableFloating !== undefined) {
        setFloatingSeats(data.availableFloating);
      }
      toast.success("Seat released successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to release seat.");
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
          <p className="text-slate-600">
            Today is {currentDay} - Manage your seat bookings below
          </p>
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
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="text-blue-600" />
                    Action Center
                  </div>
                  <div className="flex items-center gap-2 text-sm font-normal">
                    <label htmlFor="booking-date" className="text-slate-600">
                      Select Date:
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border rounded px-2 py-1 text-slate-800"
                    />
                  </div>
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
                      <Button
                        onClick={handleBookDesignated}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        Confirm Designated Seat
                      </Button>
                    ) : (
                      <Button
                        onClick={handleReleaseSeat}
                        variant="destructive"
                        className="w-full"
                      >
                        Not Coming? Release Seat
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 text-orange-800 rounded-lg border border-orange-100 flex justify-between items-center">
                      <p className="font-medium">Buffer Seats Available</p>
                      <span className="text-2xl font-bold">
                        {floatingSeats}
                      </span>
                    </div>

                    {!bookingStatus ? (
                      <Button
                        onClick={handleBookFloating}
                        disabled={!canBookFloating || floatingSeats === 0}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300"
                      >
                        {canBookFloating
                          ? "Book Floating Seat"
                          : "Unlocks at 3 PM day prior"}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleReleaseSeat}
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      >
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
                  <div
                    className={`p-3 rounded-lg flex justify-between ${batch1Days.includes(currentDay) ? "bg-green-50 border border-green-200" : "bg-slate-50 border"}`}
                  >
                    <span className="font-medium">Mon - Wed</span>
                    <span className="text-sm bg-white px-2 py-1 rounded shadow-sm">
                      Batch 1
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-lg flex justify-between ${batch2Days.includes(currentDay) ? "bg-green-50 border border-green-200" : "bg-slate-50 border"}`}
                  >
                    <span className="font-medium">Thu - Fri</span>
                    <span className="text-sm bg-white px-2 py-1 rounded shadow-sm">
                      Batch 2
                    </span>
                  </div>
                  {weeklyData.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-semibold mb-2 text-slate-700">
                        Live Statistics
                      </h4>
                      <div className="space-y-2">
                        {weeklyData.map((d, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded border"
                          >
                            <span className="font-medium">{d.date}</span>
                            <span className="text-slate-600">
                              {d.designatedCount || 0} designated,{" "}
                              {d.floatingCount || 0} floating booked
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <span className="font-medium text-green-800">
                      Current Booking:
                    </span>
                    <span className="text-green-900 capitalize font-semibold">
                      {bookingStatus}
                    </span>
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
