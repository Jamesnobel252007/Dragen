import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/dragen.jpeg";

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const NAV_ITEMS = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "Documents",
      path: "/documents",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h6.086a1.5 1.5 0 0 1 1.06.44l3.914 3.914a1.5 1.5 0 0 1 .44 1.06V15.5A1.5 1.5 0 0 1 15.5 17h-10A1.5 1.5 0 0 1 4 15.5v-11Z" />
          <path d="M12 3v4.5a.5.5 0 0 0 .5.5H17" />
          <path d="M7.5 11h5M7.5 14h3" />
        </svg>
      ),
    },
    {
      label: "Shared with you",
      path: "/shared",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 6.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0ZM6 11.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0ZM14 16.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
          <path d="m6.5 10.3 3-1.6M6.5 12.7l3 1.6" />
        </svg>
      ),
    },
    {
      label: "Favorites",
      path: "/favorites",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="10 2.5 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2.5" />
        </svg>
      ),
    },
    {
      label: "Trash",
      path: "/trash",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 5.5h13M7.5 5.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M15 5.5l-.8 10.5a1.5 1.5 0 0 1-1.5 1.4H7.3a1.5 1.5 0 0 1-1.5-1.4L5 5.5" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#111110]/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#FAF8F5] border-r border-[#EAE6DF] flex flex-col justify-between transition-transform duration-200 ease-out font-sans shadow-2xl lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* TOP: Brand Header & Workspace Nav */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#EAE6DF] shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <img src={logo} alt="Logo" className="w-10 h-10 rounded" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold tracking-tight text-[#111110]">
                  DRAGEN
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* AI badge */}
              <span className="text-[10px] font-bold text-[#B58A3B] bg-[#F2EFE9] border border-[#E4DFD5] px-2 py-0.5 rounded-md tracking-wider">
                ✦ 2.5
              </span>

              {/* Close Action on Mobile */}
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#6B665E] hover:text-[#111110] hover:bg-[#EFECE5] active:scale-95 transition-all"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation List */}
          <nav className="p-3.5 space-y-1 overflow-y-auto flex-1 overscroll-contain">
            <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold text-[#9E9789] uppercase tracking-wider">
              Workspace
            </div>

            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    onClose?.();
                  }}
                  className={`w-full min-h-[44px] flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-base font-medium transition-all group text-left ${
                    active
                      ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                      : "text-[#4D4942] hover:text-[#111110] hover:bg-[#F2EFE9]"
                  }`}
                >
                  <span
                    className={`transition-colors shrink-0 ${
                      active
                        ? "text-[#FAF8F5]"
                        : "text-[#847E72] group-hover:text-[#111110]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* BOTTOM: Settings Action */}
        <div className="p-3.5 border-t border-[#EAE6DF] bg-[#F7F4EF] shrink-0">
          <button
            onClick={() => {
              navigate("/settings");
              onClose?.();
            }}
            className={`w-full min-h-[44px] flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-base font-medium transition-all group text-left ${
              location.pathname === "/settings"
                ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                : "text-[#4D4942] hover:text-[#111110] hover:bg-[#EFECE5]"
            }`}
          >
            <span
              className={`transition-colors shrink-0 ${
                location.pathname === "/settings"
                  ? "text-[#FAF8F5]"
                  : "text-[#847E72] group-hover:text-[#111110]"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="3" />
                <path d="M16.2 12.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-1 1.4V18a1.7 1.7 0 1 1-3.4 0v-.5a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-1H2a1.7 1.7 0 1 1 0-3.4h.5a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.5 1.5 0 0 0 1.7.3 1.5 1.5 0 0 0 1-1.4V2a1.7 1.7 0 1 1 3.4 0v.5a1.5 1.5 0 0 0 1 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.5 1.5 0 0 0-.3 1.7 1.5 1.5 0 0 0 1.4 1H18a1.7 1.7 0 1 1 0 3.4h-.5a1.5 1.5 0 0 0-1.4 1Z" />
              </svg>
            </span>
            <span className="truncate">Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;