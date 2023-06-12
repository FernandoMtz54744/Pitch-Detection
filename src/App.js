import { BrowserRouter, Route, Routes } from "react-router-dom";
import Comparador from "./Containers/Comparador";
import DetectorContainer from "./Containers/DetectorContainer";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={ <Comparador/>}/>
        <Route path="/Graficas" element={<DetectorContainer/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
