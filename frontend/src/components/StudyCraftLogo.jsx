import React from 'react';

export default function StudyCraftLogo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`studycraft-logo-svg ${className}`}
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 198, 255, 0.35))' }}
    >
      <defs>
        {/* Outer Droplet Fluid Gradient */}
        <linearGradient id="dropletGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="45%" stopColor="#0072FF" />
          <stop offset="100%" stopColor="#7000FF" />
        </linearGradient>

        {/* Specular Inner Rim Highlight */}
        <linearGradient id="specularRim" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>

        {/* Book / Crystal Gradient */}
        <linearGradient id="bookGrad" x1="20" y1="40" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Sparkle Glow Gradient */}
        <linearGradient id="sparkleGrad" x1="50" y1="20" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#67E8F9" />
        </linearGradient>
      </defs>

      {/* Main Liquid Droplet Crest */}
      <path
        d="M 50 6 C 50 6 16 46 16 68 C 16 85.673 31.227 94 50 94 C 68.773 94 84 85.673 84 68 C 84 46 50 6 50 6 Z"
        fill="url(#dropletGrad)"
      />

      {/* Specular Top-Light Reflection Surface */}
      <path
        d="M 50 8 C 50 8 20 46 20 67 C 20 73 22 78 26 83 C 23 77 22 71 22 66 C 22 48 50 14 50 14 C 50 14 78 48 78 66 C 78 71 77 77 74 83 C 78 78 80 73 80 67 C 80 46 50 8 50 8 Z"
        fill="url(#specularRim)"
      />

      {/* Stylized Open Book Wings */}
      {/* Left Page Wing */}
      <path
        d="M 48 54 C 38 49 28 51 25 53 C 24.5 53.5 24 68 24 69 C 27 67 36 65 48 70 Z"
        fill="url(#bookGrad)"
        fillOpacity="0.95"
      />
      {/* Right Page Wing */}
      <path
        d="M 52 54 C 62 49 72 51 75 53 C 75.5 53.5 76 68 76 69 C 73 67 64 65 52 70 Z"
        fill="url(#bookGrad)"
        fillOpacity="0.95"
      />

      {/* Central Book Spine */}
      <path
        d="M 50 52 L 50 72"
        stroke="#0072FF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* AI Intelligence Core Sparkle (4-point Star) */}
      <path
        d="M 50 25 C 50 33 46 37 38 37 C 46 37 50 41 50 49 C 50 41 54 37 62 37 C 54 37 50 33 50 25 Z"
        fill="url(#sparkleGrad)"
      />

      {/* Floating Accent Orbital Sparks */}
      <circle cx="68" cy="28" r="2.5" fill="#FFFFFF" fillOpacity="0.9" />
      <circle cx="32" cy="33" r="1.8" fill="#FFFFFF" fillOpacity="0.8" />
    </svg>
  );
}
