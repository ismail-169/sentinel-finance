import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, TestTube, Coins, ArrowRight, Check } from 'lucide-react';

export default function NetworkSelector({ onSelectNetwork }) {
  return (
    <div className="network-selector">
      <div className="grid-bg"></div>
      <motion.div 
        className="selector-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="logo-section">
          <div className="logo-box">
            <Shield size={64} strokeWidth={1.5} />
          </div>
          <h1>SENTINEL FINANCE</h1>
          <div className="tagline">AI-POWERED SECURITY FOR MNEE</div>
        </div>

        <div className="mode-grid">
          <motion.div 
            className="mode-card demo"
            whileHover={{ y: -4, boxShadow: '8px 8px 0px 0px #ffcc00' }}
            onClick={() => onSelectNetwork('sepolia')}
          >
            <div className="card-header">
              <div className="badge">
                <TestTube size={14} />
                <span>DEMO MODE</span>
              </div>
              <div className="icon-box">
                <Zap size={32} />
              </div>
            </div>
            
            <div className="card-body">
              <h2>TRY IT FREE</h2>
              <p>TEST FEATURES WITH FREE DEMO MNEE ON SEPOLIA</p>
              
              <ul className="feature-list">
                <li><Check size={14} /> FREE 1000 TEST MNEE</li>
                <li><Check size={14} /> ALL FEATURES UNLOCKED</li>
                <li><Check size={14} /> NO REAL FUNDS NEEDED</li>
                <li><Check size={14} /> PERFECT FOR TESTING</li>
              </ul>
            </div>

            <button className="mode-btn">
              <span>START DEMO</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          <motion.div 
            className="mode-card live"
            whileHover={{ y: -4, boxShadow: '8px 8px 0px 0px #ffcc00' }}
            onClick={() => onSelectNetwork('mainnet')}
          >
            <div className="card-header">
              <div className="badge live">
                <Coins size={14} />
                <span>LIVE MODE</span>
              </div>
              <div className="icon-box live">
                <Shield size={32} />
              </div>
            </div>

            <div className="card-body">
              <h2>USE REAL MNEE</h2>
              <p>PROTECT REAL ASSETS WITH SENTINEL SECURITY</p>
              
              <ul className="feature-list">
                <li><Check size={14} /> REAL MNEE PROTECTION</li>
                <li><Check size={14} /> PRODUCTION SECURITY</li>
                <li><Check size={14} /> FULL AI AGENT SUPPORT</li>
                <li><Check size={14} /> YOUR KEYS, YOUR VAULT</li>
              </ul>
            </div>

            <button className="mode-btn live">
              <span>LAUNCH APP</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>

        <div className="footer-info">
          <a href="https://github.com/ismail-169/sentinel-finance" target="_blank" rel="noopener noreferrer" className="github-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <span>POWERED BY MNEE STABLECOIN</span>
        </div>
      </motion.div>

      <style jsx>{`
        .network-selector {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary, #1a1a1a);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .grid-bg {
          position: absolute; inset: 0;
          background-image: 
              linear-gradient(rgba(255, 204, 0, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 204, 0, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.6;
          z-index: 0;
        }

        .selector-container {
          max-width: 900px;
          width: 100%;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .logo-section { margin-bottom: 48px; }

        .logo-box {
          width: 96px; height: 96px;
          background: var(--bg-card, #2a2a2a); 
          border: 4px solid var(--border-color, #ffcc00);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 8px 8px 0px 0px var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }

        .logo-section h1 {
          font-family: var(--font-pixel);
          font-size: 48px;
          margin: 0 0 12px 0;
          line-height: 1;
          color: var(--text-primary, #ffcc00);
        }

        .tagline {
          font-family: var(--font-mono);
          font-size: 14px;
          letter-spacing: 2px;
          background: var(--border-color, #ffcc00); 
          color: var(--bg-primary, #1a1a1a);
          display: inline-block; padding: 4px 12px;
        }

        .mode-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 48px;
        }

        .mode-card {
          background: var(--bg-card, #2a2a2a); 
          border: 4px solid var(--border-color, #ffcc00); 
          padding: 32px;
          cursor: pointer; text-align: left;
          display: flex; flex-direction: column;
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
          transition: all 0.2s;
        }

        .card-header {
          display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
        }

        .badge {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px; border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 10px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #ffcc00);
        }
        .badge.live { background: var(--accent-emerald); color: var(--bg-primary, #1a1a1a); border-color: var(--accent-emerald); }

        .icon-box {
          width: 56px; height: 56px; border: 2px solid var(--border-color, #ffcc00);
          display: flex; align-items: center; justify-content: center;
          background: rgba(255, 204, 0, 0.1);
          color: var(--text-primary, #ffcc00);
        }
        .icon-box.live { background: rgba(0, 102, 255, 0.2); color: var(--accent-cyan); }

        .card-body { flex: 1; }

        .card-body h2 {
          font-family: var(--font-pixel); font-size: 24px; margin: 0 0 12px 0;
          color: var(--text-primary, #ffcc00);
        }

        .card-body p {
          font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00);
          margin-bottom: 24px; line-height: 1.5;
        }

        .feature-list { list-style: none; padding: 0; margin: 0 0 32px 0; }
        .feature-list li {
          display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
          font-size: 12px; font-weight: 700;
          color: var(--text-secondary, #e6b800);
        }
        .feature-list li svg { color: var(--accent-emerald); }

        .mode-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 16px; border: 2px solid var(--border-color, #ffcc00); 
          background: var(--bg-secondary, #252525);
          font-family: var(--font-pixel); font-size: 14px;
          transition: all 0.1s;
          color: var(--text-primary, #ffcc00);
          cursor: pointer;
        }
        .mode-btn:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        
        .mode-btn.live { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .mode-btn.live:hover { background: var(--accent-cyan); color: var(--bg-primary, #1a1a1a); border-color: var(--accent-cyan); }

        .footer-info { 
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); letter-spacing: 1px;
          display: flex; align-items: center; justify-content: center; gap: 16px;
        }
        .footer-info .github-link {
          display: flex; align-items: center; gap: 6px;
          color: var(--text-muted, #b38f00); text-decoration: none;
          padding: 6px 12px; border: 1px solid var(--text-muted, #b38f00);
          transition: all 0.2s;
        }
        .footer-info .github-link:hover {
          color: var(--text-primary, #ffcc00); border-color: var(--text-primary, #ffcc00);
        }

        @media (max-width: 768px) {
          .mode-grid { grid-template-columns: 1fr; gap: 20px; }
          .logo-section h1 { font-size: 32px; }
          .footer-info { flex-direction: column; gap: 12px; }
        }

        @media (max-width: 480px) {
          .network-selector { padding: 16px; }
          .logo-section h1 { font-size: 24px; }
          .logo-section .tagline { font-size: 10px; }
          .mode-card { padding: 20px; }
          .card-header h3 { font-size: 16px; }
          .feature-list li { font-size: 11px; }
          .mode-btn { padding: 12px; font-size: 12px; }
        }
      `}</style>
    </div>
  );
}