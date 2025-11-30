import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoEditor from './components/VideoEditor';
import Sidebar from './components/Sidebar';
import About from './components/About';
import './index.css';

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const editorRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      // Reset tool when new file loaded
      setActiveTool(null);
    }
  };

  const handleTrimClick = () => {
    setActiveTool(activeTool === 'trim' ? null : 'trim');
  };

  const handleDownloadClick = () => {
    if (editorRef.current) {
      editorRef.current.transcode();
    }
  };

  const handleCloseVideo = () => {
    setVideoFile(null);
    setActiveTool(null);
  };

  return (
    <Router>
      <div className="app-container">
        <div className="content-area">
          <Routes>
            <Route
              path="/"
              element={
                <VideoEditor
                  ref={editorRef}
                  videoFile={videoFile}
                  activeTool={activeTool}
                  onUpload={handleUpload}
                  onClose={handleCloseVideo}
                  onTrim={handleTrimClick}
                  onDownload={handleDownloadClick}
                />
              }
            />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
        <Sidebar
          onUpload={handleUpload}
          onTrim={handleTrimClick}
          onDownload={handleDownloadClick}
          activeTool={activeTool}
        />
      </div>
    </Router>
  );
}

export default App;
