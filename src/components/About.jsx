import { Link } from 'react-router-dom';

function About() {
    return (
        <div className="about-page">
            <div className="about-header">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="9" y1="9" x2="9" y2="14" />
                    <line x1="15" y1="9" x2="15" y2="14" />
                    <path d="M8 17l2 2 2-2 2 2 2-2" />
                </svg>
                <h1>about</h1>
            </div>

            <div className="about-container">
                <div className="about-nav">
                    <button className="nav-pill active">
                        :3
                    </button>
                </div>

                <div className="about-content">
                    <section>
                        <h2>What's cuddles?</h2>
                        <p>
                            Cuddles is a lightweight browser video editor for quick edits that runs on your local machine. So no signups required, your data isn't being sent anywhere, none of that. It's secure, and somewhat pretty! Inspired quite a bit by <a href="https://cobalt.tools">cobalt.tools</a>.
                        </p>
                        <p>
                            I made this because I couldn't find any good on-browser video-editors for quick edits. I don't want to download anything, or open an app! That's too heavyy
                        </p>
                    </section>

                    <section>
                        <h2>privacy first</h2>
                        <p>
                            everything happens locally on your device using <strong>ffmpeg.wasm</strong> and <strong>WebCodecs</strong>. Your videos are never uploaded to any server, ensuring complete privacy and security. This does mean the processing is quite slow right now, it'll take a while, sorry! I'm working on fixing that.
                        </p>
                    </section>

                    <section>
                        <h2>future plans</h2>
                        <p>
                            - Faster export.
                            - More video formats for export. - more!
                        </p>
                    </section>
                    <p>Built with <span style={{ color: "red" }}>&lt;3</span> by <a href="https://arypa.in">Aryan Pahwani.</a></p>
                </div>
            </div>
        </div>
    );
}

export default About;
