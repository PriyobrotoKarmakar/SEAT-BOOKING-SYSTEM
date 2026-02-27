import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, Clock, Users } from "lucide-react";
import { api, socket } from "../api/endpoints";
import { adminApi } from "../api/adminEndpoints";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { AdminUserManagement } from "../components/AdminUserManagement";
import { AdminSeatOverride } from "../components/AdminSeatOverride";
import { Shield, Sun, Umbrella } from "lucide-react";

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

  const [dailyBookedSeats, setDailyBookedSeats] = useState([]);
  const [selectedSeatId, setSelectedSeatId] = useState(null);

  // Admin State
  const [isAdminActionOpen, setIsAdminActionOpen] = useState(false);
  const [adminTargetSeat, setAdminTargetSeat] = useState(null);
  const [specialDays, setSpecialDays] = useState({});

  const batch1Days = ["Monday", "Tuesday", "Wednesday"];
  const batch2Days = ["Thursday", "Friday"];

  // Expose fetchData outside useEffect so refreshData can call it without page reload
  const fetchRef = React.useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = user.uid || user.name;

        const data = await api.seats.getStatus(userId, selectedDate);
        if (data.booked) {
          setBookingStatus(data.type);
          setBookedSeatId(data.seatId);
        } else {
          setBookingStatus(null);
          setBookedSeatId(null);
          if (data.availableFloating !== undefined) {
            setFloatingSeats(data.availableFloating);
          }
        }

        const bookedList = await api.seats.getDailyBookedSeats(selectedDate);
        setDailyBookedSeats(bookedList);

        try {
          const sd = await api.seats.getSpecialDays();
          setSpecialDays(sd || {});
        } catch {
          /* non-critical */
        }

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
            weekly.sort((a, b) => a.date.localeCompare(b.date));
            setWeeklyData(weekly);
          }
        } catch (we) {
          console.error(we);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRef.current = fetchData; // expose for refreshData
    fetchData();

    socket.connect();

    const handleSeatUpdate = (payload) => {
      if (payload.date === selectedDate || payload.date) {
        fetchData();
      }
    };

    socket.on("seatUpdate", handleSeatUpdate);

    // Real-time holiday override updates
    const handleSpecialDayUpdate = ({ date, type }) => {
      setSpecialDays((prev) => {
        const next = { ...prev };
        if (type === null) delete next[date];
        else next[date] = { date, type };
        return next;
      });
    };
    socket.on("specialDayUpdate", handleSpecialDayUpdate);

    return () => {
      socket.off("seatUpdate", handleSeatUpdate);
      socket.off("specialDayUpdate", handleSpecialDayUpdate);
      socket.disconnect();
    };
  }, [user, selectedDate]);

  const dayOfWeek = selectedDateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const workingOverride = specialDays[selectedDate]?.type === "working";
  const holidayOverride = specialDays[selectedDate]?.type === "holiday";
  // A day is a holiday if: it's a weekend (not overridden) OR a weekday marked as holiday
  const isEffectiveHoliday = (isWeekend && !workingOverride) || holidayOverride;

  const isDesignatedDay =
    (Number(user.batch) === 1 && batch1Days.includes(currentDay)) ||
    (Number(user.batch) === 2 && batch2Days.includes(currentDay));

  const now = new Date();
  const bookingDay = new Date(selectedDate + "T00:00:00");
  const bookingDayOfWeek = bookingDay.getDay();

  const cutoffDay = new Date(bookingDay);
  if (bookingDayOfWeek === 1) {
    cutoffDay.setDate(bookingDay.getDate() - 3);
  } else {
    cutoffDay.setDate(bookingDay.getDate() - 1);
  }
  cutoffDay.setHours(12, 0, 0, 0);

  const isAfterCutoff = now > cutoffDay;
  const canBookFloating = !isDesignatedDay && isAfterCutoff;

  const releaseTime = new Date(bookingDay);
  if (bookingDayOfWeek === 1) {
    releaseTime.setDate(bookingDay.getDate() - 3);
  } else {
    releaseTime.setDate(bookingDay.getDate() - 1);
  }
  releaseTime.setHours(12, 0, 0, 0);

  const designatedSeatsReleased = now > releaseTime;

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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-xl border border-blue-100 dark:border-blue-900">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            Welcome back, {user.name}! 👋
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Today is {currentDay} - Manage your seat bookings below
          </p>
        </div>

        <Tabs defaultValue="book" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="book">Book Seat</TabsTrigger>
            <TabsTrigger value="roster">Weekly Roster</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {user.isAdmin && (
              <TabsTrigger
                value="admin"
                className="text-purple-600 bg-purple-50 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700"
              >
                <Shield className="mr-2 h-4 w-4" /> Admin Panel
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="book" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="text-blue-600" />
                    Action Center
                  </div>
                  <div className="flex items-center gap-2 text-sm font-normal flex-wrap">
                    <label htmlFor="booking-date" className="text-slate-600">
                      Select Date:
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
                    />
                    {user.isAdmin && (
                      <button
                        onClick={async () => {
                          try {
                            if (holidayOverride || workingOverride) {
                              await adminApi.removeSpecialDay(selectedDate);
                              toast.success(
                                `Override removed for ${selectedDate}`,
                              );
                            } else if (isWeekend) {
                              await adminApi.setSpecialDay(
                                selectedDate,
                                "working",
                              );
                              toast.success(
                                `${selectedDate} set as Working Day ✅`,
                              );
                            } else {
                              await adminApi.setSpecialDay(
                                selectedDate,
                                "holiday",
                              );
                              toast.success(
                                `${selectedDate} set as Holiday 🌴`,
                              );
                            }
                          } catch (e) {
                            toast.error(e.message);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          holidayOverride
                            ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                            : workingOverride
                              ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                              : isWeekend
                                ? "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
                                : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                        }`}
                      >
                        {holidayOverride || workingOverride ? (
                          <>&#x2715; Remove Holiday</>
                        ) : isWeekend ? (
                          <>
                            <Sun size={12} /> Override: Working Day
                          </>
                        ) : (
                          <>
                            <Umbrella size={12} /> Mark as Holiday
                          </>
                        )}
                      </button>
                    )}
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
                        const canOverride =
                          isDesignatedDay &&
                          seatId <= 40 &&
                          isBooked &&
                          isBooked.type === "floating" &&
                          !isMySeat;

                        let isInvalidZone;
                        if (isDesignatedDay) {
                          isInvalidZone = seatId > 40;
                        } else {
                          isInvalidZone = designatedSeatsReleased
                            ? false
                            : seatId <= 40;
                        }

                        let bgClass =
                          "bg-green-100 hover:bg-green-200 border-green-300 text-green-700 cursor-pointer";

                        if (isMySeat)
                          bgClass =
                            "bg-blue-500 border-blue-600 text-white cursor-not-allowed shadow-inner ring-2 ring-blue-300";
                        else if (canOverride && isSelected)
                          bgClass =
                            "bg-red-500 border-red-600 text-white ring-2 ring-red-400";
                        else if (canOverride)
                          bgClass =
                            "bg-red-100 hover:bg-red-200 border-red-300 text-red-700 cursor-pointer";
                        else if (isBooked)
                          bgClass =
                            "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-70";
                        else if (isSelected)
                          bgClass =
                            "bg-yellow-100 border-yellow-400 text-yellow-700 ring-2 ring-yellow-400";
                        else if (
                          isEffectiveHoliday ||
                          (isInvalidZone && !bookingStatus)
                        )
                          bgClass =
                            "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50";

                        const isBufferSeat = seatId > 40;

                        return (
                          <div
                            key={seatId}
                            onClick={() => {
                              // If Admin, bypass everything and open Override Dialog
                              if (user.isAdmin) {
                                setAdminTargetSeat({
                                  id: seatId,
                                  occupant: isBooked, // { userId, userName } or undefined
                                });
                                setIsAdminActionOpen(true);
                                return;
                              }

                              if (isEffectiveHoliday) {
                                toast.info(
                                  "This is holiday, enjoy at your home!",
                                );
                                return;
                              }
                              if (
                                (!isBooked || canOverride) &&
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
                            ${(!isBooked || canOverride) && !bookingStatus && !isInvalidZone && !isEffectiveHoliday ? "active:scale-95 hover:shadow-sm" : ""}
                          `}
                            title={
                              isMySeat
                                ? "Your booked seat"
                                : canOverride
                                  ? `Booked by ${isBooked.userName} (Click to Override)`
                                  : isBooked
                                    ? `Booked by ${isBooked.userName}`
                                    : isEffectiveHoliday
                                      ? "Holiday - Not available"
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

                  <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mb-6 flex-wrap justify-center border-b dark:border-slate-700 pb-4">
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
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-200 border border-red-300"></div>{" "}
                      Override Available
                    </div>
                  </div>
                </div>

                {!bookingStatus ? (
                  <div className="space-y-4 border-t pt-4">
                    {isEffectiveHoliday ? (
                      <div className="bg-blue-50 rounded-lg p-6 border border-blue-100 text-center">
                        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                          <span className="text-2xl">🏖️</span>
                        </div>
                        <h4 className="font-semibold text-blue-800 mb-1">
                          Weekend Holiday
                        </h4>
                        <p className="text-sm text-blue-600">
                          This is holiday, enjoy at your home!
                        </p>
                      </div>
                    ) : isDesignatedDay ? (
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
                              {(() => {
                                const today = new Date();
                                const selectedDayOfWeek =
                                  selectedDateObj.getDay();
                                const todayDayOfWeek = today.getDay();

                                if (
                                  todayDayOfWeek === 5 &&
                                  selectedDayOfWeek === 1
                                ) {
                                  const daysDiff = Math.floor(
                                    (selectedDateObj - today) /
                                      (1000 * 60 * 60 * 24),
                                  );

                                  if (daysDiff <= 3 && daysDiff >= 0) {
                                    return isAfterCutoff
                                      ? "You can now book for Monday!"
                                      : "You can book for Monday after 12 PM today.";
                                  }
                                }

                                return isAfterCutoff
                                  ? "Floating seats are now available to book for tomorrow."
                                  : "You must wait until 12 PM the day prior to book a floating seat.";
                              })()}
                            </p>
                          </div>
                          <Clock className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 inline-block px-3 py-1 rounded-full border dark:border-slate-600 mb-3">
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
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 text-center border dark:border-slate-700">
                    <div className="mx-auto w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mb-3 shadow-sm text-emerald-500">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                      Seat #{bookedSeatId} Booked
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4 capitalize">
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
                    className={`p-3 rounded-lg flex justify-between ${batch1Days.includes(currentDay) ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" : "bg-slate-50 dark:bg-slate-800 border dark:border-slate-700"}`}
                  >
                    <span className="font-medium dark:text-slate-200">
                      Mon - Wed
                    </span>
                    <span className="text-sm bg-white dark:bg-slate-700 dark:text-slate-200 px-2 py-1 rounded shadow-sm">
                      Batch 1
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-lg flex justify-between ${batch2Days.includes(currentDay) ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" : "bg-slate-50 dark:bg-slate-800 border dark:border-slate-700"}`}
                  >
                    <span className="font-medium dark:text-slate-200">
                      Thu - Fri
                    </span>
                    <span className="text-sm bg-white dark:bg-slate-700 dark:text-slate-200 px-2 py-1 rounded shadow-sm">
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
                            className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded border dark:border-slate-700"
                          >
                            <span className="font-medium dark:text-slate-200">
                              {d.date}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
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
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    Name:
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {user.name}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    Batch:
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {user.batch}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    Squad:
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {user.squad}
                  </span>
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

          {user.isAdmin && (
            <TabsContent value="admin" className="mt-6">
              <AdminUserManagement />
            </TabsContent>
          )}

          {/* Admin Override Dialog */}
          {user.isAdmin && (
            <AdminSeatOverride
              isOpen={isAdminActionOpen}
              onClose={() => setIsAdminActionOpen(false)}
              seatId={adminTargetSeat?.id}
              date={selectedDate}
              currentOccupant={adminTargetSeat?.occupant}
              refreshData={() => fetchRef.current?.()}
            />
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Dashboard;
