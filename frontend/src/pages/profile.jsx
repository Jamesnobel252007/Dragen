
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { FileText, Share2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const initialProfile = {
    firstName: "User",
    lastName: "",
    email: "",
    bio: "",
};

function Profile() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [profile] = useState(() => {
        try {
            const savedProfile = localStorage.getItem("vdocsProfile");

            if (savedProfile) {
                return {
                    ...initialProfile,
                    ...JSON.parse(savedProfile),
                };
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
        }

        return initialProfile;
    });

    const firstName = profile.firstName || "User";
    const lastName = profile.lastName || "";
    const email = profile.email || "";
    const bio = profile.bio || "";

    return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#111110] flex font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} search="" setSearch={() => {}} />

                <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-6xl w-full mx-auto">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-xs border border-[#E8E3D8]">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-5 sm:gap-6">
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center min-w-0 flex-1">
                                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-[#111110] text-[#FAF8F5] flex items-center justify-center text-3xl sm:text-4xl font-bold shrink-0 shadow-sm">
                                    {firstName.charAt(0).toUpperCase()}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#111110] truncate">
                                        {firstName} {lastName}
                                    </h1>

                                    <p className="text-[#787265] mt-1 text-sm sm:text-base truncate">
                                        {email || "No email connected"}
                                    </p>

                                    {bio && (
                                        <p className="mt-3 text-[#4D4942] max-w-3xl leading-relaxed text-sm sm:text-base">
                                            {bio}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate("/settings")}
                                className="w-full sm:w-auto bg-[#111110] hover:bg-[#262422] active:scale-[0.98] text-[#FAF8F5] px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs"
                            >
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mt-6 sm:mt-8">
                        <div className="bg-white p-5 sm:p-8 rounded-2xl border border-[#E8E3D8] shadow-xs">
                            <FileText className="text-[#111110] mb-3" size={24} />
                            <h2 className="text-3xl sm:text-4xl font-bold text-[#111110]">12</h2>
                            <p className="text-[#8C867A] text-xs sm:text-sm mt-1">Documents Created</p>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-2xl border border-[#E8E3D8] shadow-xs">
                            <Share2 className="text-[#B58A3B] mb-3" size={24} />
                            <h2 className="text-3xl sm:text-4xl font-bold text-[#111110]">5</h2>
                            <p className="text-[#8C867A] text-xs sm:text-sm mt-1">Shared Documents</p>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-2xl border border-[#E8E3D8] shadow-xs">
                            <Users className="text-[#10B981] mb-3" size={24} />
                            <h2 className="text-3xl sm:text-4xl font-bold text-[#111110]">8</h2>
                            <p className="text-[#8C867A] text-xs sm:text-sm mt-1">Collaborators</p>
                        </div>
                    </div>

                    <div className="mt-6 sm:mt-8">
                        <h2 className="text-xl sm:text-2xl font-bold text-[#111110] mb-4">Recent Activity</h2>

                        <div className="bg-white rounded-2xl border border-[#E8E3D8] shadow-xs divide-y divide-[#EAE6DF] overflow-hidden">
                            <div className="p-4 sm:p-5">
                                <h3 className="font-semibold text-base text-[#111110]">Project Notes.doc</h3>
                                <p className="text-xs font-mono text-[#8C867A] mt-0.5">Edited 2 hours ago</p>
                            </div>

                            <div className="p-4 sm:p-5">
                                <h3 className="font-semibold text-base text-[#111110]">API Documentation</h3>
                                <p className="text-xs font-mono text-[#8C867A] mt-0.5">Edited yesterday</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 sm:mt-8 bg-[#111110] text-[#FAF8F5] rounded-2xl p-6 sm:p-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#262422] text-[#B58A3B] text-[10px] font-bold uppercase tracking-wider mb-2">
                                ✦ Enterprise Tier
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold">Workspace Premium</h2>
                            <p className="mt-2 text-[#C4BEB1] text-sm sm:text-base max-w-2xl leading-relaxed">
                                You are on the premium plan with unlimited neural documents and advanced collaboration tools.
                            </p>
                        </div>

                        <button className="w-full sm:w-auto bg-[#FAF8F5] hover:bg-[#EFECE5] text-[#111110] px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs shrink-0">
                            Manage Plan
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Profile;
