import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import asleepSong from '../assets/asleep.mp3';

function Sidebar({ onUpload, onTrim, onDownload, activeTool }) {
    const location = useLocation();
    const isEditor = location.pathname === '/';
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isCopied, setIsCopied] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'cuddles',
                    text: 'Check out cuddles - a lightweight browser video editor!',
                    url: window.location.origin,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.origin);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    };

    return (
        <div className="sidebar" style={{ position: 'relative' }}>
            <audio ref={audioRef} src={asleepSong} loop />

            {/* Share Button (Left) */}
            <button
                onClick={handleShare}
                className="sidebar-item share-btn"
                title={isCopied ? "Copied!" : "Share"}
                style={{ position: 'absolute', left: '2rem' }}
            >
                <div className="icon-container">
                    {isCopied ? (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                    )}
                </div>
            </button>

            <div className="sidebar-bottom">
                {/* Logo */}
                <Link to="/" className="sidebar-item" title="Home">
                    <div className="icon-container">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="9" y1="9" x2="9" y2="14" />
                            <line x1="15" y1="9" x2="15" y2="14" />
                            <path d="M8 17l2 2 2-2 2 2 2-2" />
                        </svg>
                    </div>
                    <span className="label">home</span>
                </Link>

                {/* Donate */}
                <button
                    className="sidebar-item donate-btn"
                >
                    <div className="icon-container">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </div>
                    <span className="label">donate</span>
                </button>

                {/* About */}
                <Link to="/about" className="sidebar-item" title="About">
                    <div className="icon-container">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                    </div>
                    <span className="label">about</span>
                </Link>
            </div>

            {/* Music Player Section */}
            <div className="music-player-section" style={{ position: 'absolute', right: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span className="now-playing-text">now playing: asleep</span>

                <div className="player-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Volume Slider */}
                    <div className="volume-control-wrapper">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="volume-slider"
                            title="Volume"
                        />
                    </div>

                    {/* Play/Pause Button */}
                    <button
                        onClick={togglePlay}
                        className="sidebar-item"
                        title={isPlaying ? "Pause Music" : "Play Music"}
                        style={{ width: 'auto', minWidth: 'auto' }}
                    >
                        <div className="icon-container">
                            {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
