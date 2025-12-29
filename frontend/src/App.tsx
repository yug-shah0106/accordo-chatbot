import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import DealsPage from "./pages/DealsPage";
import NewDealPage from "./pages/NewDealPage";
import NegotiationRoom from "./pages/NegotiationRoom";
import ConversationRoom from "./pages/ConversationRoom";
import ConversationDealPage from "./pages/ConversationDealPage";
import SummaryPage from "./pages/SummaryPage";
import DemoScenarios from "./pages/DemoScenarios";
import AboutPage from "./pages/AboutPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/deals" replace />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="deals/new" element={<NewDealPage />} />
          <Route path="deals/:dealId" element={<NegotiationRoom />} />
          <Route path="conversation/deals/:dealId" element={<ConversationDealPage />} />
          <Route path="deals/:dealId/summary" element={<SummaryPage />} />
          <Route path="demo-scenarios" element={<DemoScenarios />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
