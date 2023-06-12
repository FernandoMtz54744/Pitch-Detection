import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Comparador from "./Containers/Comparador";
import GraficasContainer from "./Containers/GraficasContainer";

function App() {
  return (
    <BrowserRouter>
    <header>
      <Link to={"/"}>Comparador</Link>
      <Link to={"/Graficas"}>Graficas</Link>
      <Link to={"/FFT"}>FFT</Link>
    </header>
      <Routes>
        <Route path="/" element={ <Comparador/>}/>
        <Route path="/Graficas" element={<GraficasContainer/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
