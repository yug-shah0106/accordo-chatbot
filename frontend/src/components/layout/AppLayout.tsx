import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./AppLayout.css";

export default function AppLayout() {
  // const location = useLocation();
  // const isNegotiationRoom = location.pathname.includes("/deals/") && !location.pathname.includes("/summary");

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}


