import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp.jsx";

const rootElement = document.getElementById("root");
const reactRoot = (rootElement.__brocodeAdminRoot ||= createRoot(rootElement));
reactRoot.render(<AdminApp />);
