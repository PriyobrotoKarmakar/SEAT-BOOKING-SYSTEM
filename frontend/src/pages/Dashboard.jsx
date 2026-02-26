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

  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const currentDay = selectedDateObj.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const [floatingSeats, setFloatingSeats] = useState(10);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [bookedSeatId, setBookedSeatId] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);

  // Seat Grid States
  const [dailyBookedSeats, setDailyBookedSeats] = useState([]);
  const [selectedSeatId, setSelectedSeatId] = useState(null);

  const batch1Days = ["Monday", "Tuesday", "Wednesday"];
  const batch2Days = ["Thursday", "Friday"];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = user.uid || user.name;

        const data = await api.seats.getStatus(userId, selectedDate);
        if (data.booked) {
          setBookingStatus(data.type); // "designated" or "floating"
          setBookedSeatId(data.seatId);
        } else {
          setBookingStatus(null);
          setBookedSeatId(null);
          // Only update floating seats if data provides it
          if (data.availableFloating !== undefined) {
            setFloatingSeats(data.availableFloating);
          }
        }

        // Fetch daily seat map
        const bookedList = await api.seats.getDailyBookedSeats(selectedDate);
        setDailyBookedSeats(bookedList);

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
    if (!selectedSeatId) {
      toast.error("Please click on a seat from the map before booking.");
      return;
    }
    try {
      await api.seats.bookDesignated(user, selectedDate, selectedSeatId);
      setBookingStatus("designated");
      setBookedSeatId(selectedSeatId);
      setSelectedSeatId(null);
      toast.success(`Designated seat #${selectedSeatId} booked successfully!`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to book designated seat.");
    }
  };

  const handleBookFloating = async () => {
    if (!selectedSeatId) {
      toast.error("Please click on a seat from the map before booking.");
      return;
    }
    if (floatingSeats > 0) {
      try {
        await api.seats.bookFloating(user, selectedDate, selectedSeatId);
        setFloatingSeats((prev) => prev - 1);
        setBookingStatus("floating");
        setBookedSeatId(selectedSeatId);
        setSelectedSeatId(null);
        toast.success(`Floating seat #${selectedSeatId} booked successfully!`);
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Failed to book floating seat.");
      }
    }
  };

  const handleReleaseSeat = async () => {
    try {
      await api.seats.release(user, selectedDate);
      setBookingStatus(null);
      setBookedSeatId(null);

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
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    50-Seat Virtual Floor Plan
                  </h4>

                  <div className="grid grid-cols-10 gap-2 mb-4">
                    {Array.from({ length: 50 }, (_, i) => i + 1).map(
                      (seatId) => {
                        const isBooked = dailyBookedSeats.find(
                          (s) => s.seatId === seatId,
                        );
                        const isMySeat =
                          isBooked &&
                          isBooked.userId === (user.uid || user.name);
                        const isSelected = selectedSeatId === seatId;

                        // Logic Enforcement:
                        // If it's your designated day, you MUST book 1-40.
                        // If it's NOT your designated day, you MUST book 41-50.
                        const isInvalidZone = isDesignatedDay
                          ? seatId > 40
                          : seatId <= 40;

                        let bgClass =
                          "bg-green-100 hover:bg-green-200 border-green-300 text-green-700 cursor-pointer";

                        if (isMySeat)
                          bgClass =
                            "bg-blue-500 border-blue-600 text-white cursor-not-allowed shadow-inner ring-2 ring-blue-300";
                        else if (isBooked)
                          bgClass =
                            "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-70";
                        else if (isSelected)
                          bgClass =
                            "bg-yellow-100 border-yellow-400 text-yellow-700 ring-2 ring-yellow-400";
                        else if (isInvalidZone && !bookingStatus)
                          bgClass =
                            "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50"; // Dim unavailable zones

                        // Visual Separator for the Buffer Pool (41-50)
                        const isBufferSeat = seatId > 40;

                        return (
                          <div
                            key={seatId}
                            onClick={() => {
                              if (
                                !isBooked &&
                                !bookingStatus &&
                                !isInvalidZone
                              ) {
                                setSelectedSeatId(
                                  seatId === selectedSeatId ? null : seatId,
                                );
                              } else if (isInvalidZone && !bookingStatus) {
                                toast.warning(
                                  isDesignatedDay
                                    ? "Please select a Designated Seat (1-40)."
                                    : "Please select a Buffer Seat (41-50).",
                                );
                              }
                            }}
                            className={`
                            h-10 rounded-md border text-xs font-bold flex items-center justify-center transition-all duration-200 select-none
                            ${bgClass}
                            ${isBufferSeat ? "border-orange-300 ring-1 ring-orange-200" : ""}
                            ${!isBooked && !bookingStatus && !isInvalidZone ? "active:scale-95 hover:shadow-sm" : ""}
                          `}
                            title={
                              isMySeat
                                ? "Your booked seat"
                                : isBooked
                                  ? `Booked by ${isBooked.userName}`
                                  : isInvalidZone
                                    ? "Not available for your current booking type"
                                    : "Available"
                            }
                          >
                            {seatId}
                          </div>
                        );
                      },
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 text-xs text-slate-500 mb-6 flex-wrap justify-center border-b pb-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-200 border border-green-300"></div>{" "}
                      Available (Your Zone)
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200 opacity-50"></div>{" "}
                      Unavailable Zone
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-200 border border-yellow-400"></div>{" "}
                      Selected
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300"></div>{" "}
                      Taken
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600"></div>{" "}
                      Yours
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 text-xs text-slate-500 mb-6 justify-center">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-200 border border-green-300"></div>{" "}
                      Available
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-200 border border-yellow-400"></div>{" "}
                      Selected
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300"></div>{" "}
                      Taken
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600"></div>{" "}
                      Yours
                    </div>
                  </div>
                </div>

                {!bookingStatus ? (
                  <div className="space-y-4 border-t pt-4">
                    {isDesignatedDay ? (
                      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h4 className="font-semibold text-emerald-800">
                              Designated Booking
                            </h4>
                            <p className="text-sm text-emerald-600">
                              It's {currentDay} — your batch's designated day.
                            </p>
                          </div>
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                        <Button
                          onClick={handleBookDesignated}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                          disabled={!selectedSeatId}
                        >
                          {selectedSeatId
                            ? `Book Seat #${selectedSeatId}`
                            : "Select a seat above"}
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h4 className="font-semibold text-orange-800">
                              Floating Booking
                            </h4>
                            <p className="text-sm text-orange-600">
                              {isAfterCutoff
                                ? "Floating seats are now available to book for tomorrow."
                                : "You must wait until 3 PM the day prior to book a floating seat."}
                            </p>
                          </div>
                          <Clock className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-700 bg-white inline-block px-3 py-1 rounded-full border mb-3">
                          Buffer Available:{" "}
                          <span
                            className={
                              floatingSeats > 0
                                ? "text-green-600"
                                : "text-red-500"
                            }
                          >
                            {floatingSeats}
                          </span>
                        </div>
                        <Button
                          onClick={handleBookFloating}
                          disabled={
                            !canBookFloating ||
                            floatingSeats === 0 ||
                            !selectedSeatId
                          }
                          className="w-full bg-orange-500 hover:bg-orange-600"
                        >
                          {!canBookFloating
                            ? "Not available yet"
                            : floatingSeats === 0
                              ? "Pool Empty"
                              : selectedSeatId
                                ? `Book Buffer Seat #${selectedSeatId}`
                                : "Select a seat above"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-100 rounded-lg p-6 text-center border">
                    <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-emerald-500">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <h4 className="font-semibold text-slate-800">
                      Seat #{bookedSeatId} Booked
                    </h4>
                    <p className="text-sm text-slate-500 mt-1 mb-4 capitalize">
                      {bookingStatus} Reservation
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleReleaseSeat}
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Release Seat
                    </Button>
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
