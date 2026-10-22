import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";


function Header({
  onMenuClick,
  search = "",
  setSearch = () => {},
}) {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  // --------------------------------------------------
  // LOAD CURRENT USER
  // --------------------------------------------------

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    const loadCurrentUser = async () => {
      try {
        const res = await api.get("user/");
        setCurrentUser(res.data);
      } catch (err) {
        if (err.response?.status !== 401) {
          console.error("Failed to load current user:", err);
        }
      }
    };

    loadCurrentUser();
  }, []);

  // --------------------------------------------------
  // LOAD NOTIFICATIONS
  // --------------------------------------------------

  // LOAD NOTIFICATIONS AND UNREAD COUNT

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const res = await api.get("notifications/");
        if (!cancelled) {
          setNotifications(res.data);
        }
      } catch (err) {
        if (!cancelled && err.response?.status !== 401) {
          console.error("Failed to load notifications:", err);
        }
      }
    };

    const loadUnreadCount = async () => {
      try {
        const res = await api.get("notifications/unread-count/");
        if (!cancelled) {
          setUnreadCount(res.data.count);
        }
      } catch (err) {
        if (!cancelled && err.response?.status !== 401) {
          console.error("Failed to load unread count:", err);
        }
      }
    };

    // Initial load and periodic refresh
    void loadNotifications();
    void loadUnreadCount();

    const interval = setInterval(() => {
      const activeToken = localStorage.getItem("access");
      if (!activeToken) {
        clearInterval(interval);
        return;
      }
      void loadNotifications();
      void loadUnreadCount();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Refresh notifications when the dropdown is opened.
  const loadNotifications = async () => {
    if (!localStorage.getItem("access")) return;
    try {
      const res = await api.get("notifications/");
      setNotifications(res.data);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Failed to load notifications:", err);
      }
    }
  };

  const loadUnreadCount = async () => {
    if (!localStorage.getItem("access")) return;
    try {
      const res = await api.get("notifications/unread-count/");
      setUnreadCount(res.data.count);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Failed to load unread count:", err);
      }
    }
  };



  // --------------------------------------------------
  // CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
  // --------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    setProfileOpen(false);

    navigate("/");
  };

  // --------------------------------------------------
  // OPEN NOTIFICATION
  // --------------------------------------------------

  const handleNotificationClick = async (notification) => {
    try {
      // Mark notification as read
      if (!notification.is_read) {
        await api.patch(
          `notifications/${notification.id}/read/`
        );
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );

      // Decrease unread count
      if (!notification.is_read) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }

      // Close notification dropdown
      setNotificationOpen(false);

      // If notification belongs to a document
      if (notification.document) {
        navigate(`/documents/${notification.document}`);
      }

    } catch (err) {
      console.error(
        "Failed to open notification:",
        err
      );
    }
  };

  // --------------------------------------------------
  // MARK ALL AS READ
  // --------------------------------------------------

  const handleMarkAllRead = async () => {
    try {
      await api.patch(
        "notifications/read-all/"
      );

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);

    } catch (err) {
      console.error(
        "Failed to mark notifications as read:",
        err
      );
    }
  };

  // --------------------------------------------------
  // AVATAR
  // --------------------------------------------------

  const avatarLetter =
    currentUser?.username?.charAt(0).toUpperCase() || "U";

  // --------------------------------------------------
  // TIME FORMAT
  // --------------------------------------------------

  const formatNotificationTime = (date) => {
    const notificationDate = new Date(date);
    const now = new Date();

    const diff =
      Math.floor(
        (now - notificationDate) / 1000
      );

    if (diff < 60) {
      return "Just now";
    }

    if (diff < 3600) {
      return `${Math.floor(diff / 60)}m ago`;
    }

    if (diff < 86400) {
      return `${Math.floor(diff / 3600)}h ago`;
    }

    if (diff < 604800) {
      return `${Math.floor(diff / 86400)}d ago`;
    }

    return notificationDate.toLocaleDateString();
  };

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-5 lg:px-8 border-b border-[#EAE6DF] bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-30 transition-all font-sans">

      {/* LEFT */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">

        {/* MOBILE MENU */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F2EFE9] transition-colors shrink-0"
          aria-label="Open menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </button>

        {/* SEARCH */}
        <div className="relative hidden sm:flex items-center w-full max-w-md group">

          <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-[#9E9789] group-focus-within:text-[#111110] transition-colors">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>

          <input
            type="text"
            placeholder="Ask AI or search documents..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full pl-11 pr-24 py-2.5 text-base font-normal rounded-xl border border-[#E4DFD5] bg-[#F3EFE8]/70 text-[#111110] placeholder:text-[#9E9789] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#111110] focus:ring-4 focus:ring-[#111110]/5 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          />

          <div className="absolute right-2.5 pointer-events-none hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-[#E0DBD0] bg-[#FAF8F5] text-[#847E72] text-[11px] font-semibold tracking-wider">
            <span className="text-[9px] text-[#B58A3B]">
              ✦
            </span>

           
          </div>

        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3 shrink-0">

        {/* =========================================
            NOTIFICATIONS
        ========================================== */}

        <div
          ref={notificationRef}
          className="relative"
        >

          <button
            onClick={() => {
              setNotificationOpen(
                (prev) => !prev
              );

              // Refresh when opening
              loadNotifications();
              loadUnreadCount();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F2EFE9] transition-colors relative"
            aria-label="Notifications"
          >

            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>

            {/* UNREAD BADGE */}

            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#111110] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#FAF8F5]">
                {unreadCount > 99
                  ? "99+"
                  : unreadCount}
              </span>
            )}

          </button>

          {/* =========================================
              NOTIFICATION DROPDOWN
          ========================================== */}

          {notificationOpen && (
            <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-2rem)] bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl shadow-2xl shadow-[#111110]/10 z-50 overflow-hidden">

              {/* HEADER */}

              <div className="px-4 py-3 border-b border-[#EAE6DF] flex items-center justify-between">

                <div>
                  <h3 className="text-sm font-semibold text-[#111110]">
                    Notifications
                  </h3>

                  {unreadCount > 0 && (
                    <p className="text-xs text-[#847E72] mt-0.5">
                      {unreadCount} unread
                    </p>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-[#5A554D] hover:text-[#111110] hover:underline"
                  >
                    Mark all as read
                  </button>
                )}

              </div>

              {/* NOTIFICATION LIST */}

              <div className="max-h-[420px] overflow-y-auto">

                {notifications.length === 0 ? (

                  <div className="px-6 py-10 text-center">

                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F0EBE3] flex items-center justify-center">

                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#847E72"
                        strokeWidth="1.6"
                      >
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      </svg>

                    </div>

                    <p className="text-sm font-medium text-[#4D4942]">
                      No notifications
                    </p>

                    <p className="text-xs text-[#9E9789] mt-1">
                      You're all caught up.
                    </p>

                  </div>

                ) : (

                  notifications.map((notification) => (

                    <button
                      key={notification.id}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      className={`w-full text-left px-4 py-3.5 border-b border-[#EEEAE3] hover:bg-[#F2EFE9] transition-colors ${
                        !notification.is_read
                          ? "bg-[#F5F1EA]"
                          : "bg-transparent"
                      }`}
                    >

                      <div className="flex gap-3">

                        {/* ICON */}

                        <div className="w-9 h-9 rounded-full bg-[#111110] text-white flex items-center justify-center shrink-0">

                          {notification.notification_type ===
                          "document_shared" ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <path d="M8 13h8M8 17h5" />
                            </svg>
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle
                                cx="12"
                                cy="7"
                                r="4"
                              />
                            </svg>
                          )}

                        </div>

                        {/* CONTENT */}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-2">

                            <p
                              className={`text-sm leading-5 ${
                                notification.is_read
                                  ? "font-normal text-[#5E5951]"
                                  : "font-semibold text-[#111110]"
                              }`}
                            >
                              {notification.message}
                            </p>

                            {/* UNREAD DOT */}

                            {!notification.is_read && (
                              <span className="w-2 h-2 rounded-full bg-[#111110] shrink-0 mt-1.5" />
                            )}

                          </div>

                          <div className="flex items-center gap-2 mt-1.5">

                            {notification.sender_username && (
                              <span className="text-xs text-[#847E72]">
                                @{notification.sender_username}
                              </span>
                            )}

                            <span className="text-xs text-[#A39D92]">
                              {formatNotificationTime(
                                notification.created_at
                              )}
                            </span>

                          </div>

                        </div>

                      </div>

                    </button>

                  ))

                )}

              </div>

            </div>
          )}

        </div>

        {/* DIVIDER */}

        <div className="h-5 w-[1px] bg-[#EAE6DF] mx-0.5 hidden sm:block" />

        {/* =========================================
            PROFILE
        ========================================== */}

        <div
          ref={profileRef}
          className="relative"
        >

          <button
            onClick={() =>
              setProfileOpen((prev) => !prev)
            }
            className="flex items-center gap-2 p-1 rounded-full hover:bg-[#F2EFE9] transition-colors focus:outline-none"
            aria-label="Open account menu"
            aria-expanded={profileOpen}
          >

            <div className="w-9 h-9 rounded-full bg-[#111110] text-[#FAF8F5] border border-[#2D2C29] flex items-center justify-center text-sm font-semibold shadow-xs">
              {avatarLetter}
            </div>

            <svg
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className={`text-[#847E72] transition-transform duration-200 ${
                profileOpen
                  ? "rotate-180 text-[#111110]"
                  : ""
              }`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>

          </button>

          {/* PROFILE DROPDOWN */}

          {profileOpen && (
            <div className="absolute right-0 top-12 w-72 bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl shadow-2xl shadow-[#111110]/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              
              {/* User Overview */}
              <div className="px-3.5 py-3 mb-1.5 rounded-xl bg-[#F3EFE8] border border-[#E9E4DB] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#111110] flex items-center justify-center text-[#FAF8F5] text-base font-semibold shrink-0 shadow-xs">
                  {avatarLetter}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-base font-semibold text-[#111110] truncate leading-tight">
                      {currentUser?.username || "User"}
                    </p>
                  
                  </div>
                  <p className="text-xs text-[#847E72] truncate mt-0.5">
                    {currentUser?.email || "No email connected"}
                  </p>
                </div>
              </div>

              {/* Actions List */}
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                >
                  <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Profile</span>
                </button>

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                >
                  <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    alert("Help & support will be available soon.");
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                >
                  <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Help & support</span>
                </button>
              </div>

              {/* Logout Option */}
              <div className="mt-1.5 pt-1.5 border-t border-[#EAE6DF]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#A63529] hover:bg-[#FAECEB] transition-colors text-left group"
                >
                  <svg className="w-4 h-4 text-[#A63529] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;
