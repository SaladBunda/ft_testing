import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';

export default function App() {
    return (
    <BrowserRouter>
        <nav style={{ padding: "1rem" }} >
            <Link to="/"> </Link> | <Link to="/login">  </Link>
        </nav>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
        </Routes>
    </BrowserRouter>
    )
}