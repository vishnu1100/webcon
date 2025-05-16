import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import VideoRoom from './components/VideoRoom'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<VideoRoom />} />
      </Routes>
    </Router>
  )
}

export default App
